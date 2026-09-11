import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import fs from 'node:fs/promises';
import { mock } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import PQueue from 'p-queue';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { executeJs, ExecuteJsInputSchema, registerExecuteJsTools } from '../dist/tools/execute-js.js';
const MAX_INLINE_RESPONSE_BYTES = 16 * 1024;
const MAX_CODE_BYTES = 64 * 1024 * 1024;
const MAX_INPUT_BYTES = 512 * 1024 * 1024;

const mcpRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(mcpRoot, '..');
await mkdir(join(mcpRoot, '.test-data'), { recursive: true });
const temp = await mkdtemp(join(mcpRoot, '.test-data', 'execute-js-'));
const runtimeFile = join(temp, 'runtime.mjs');
await build({ entryPoints: [join(root, 'src/eda/execute-js.ts')], outfile: runtimeFile,
    bundle: true, minify: true, platform: 'browser', format: 'esm', logLevel: 'silent' });
const { executeJavaScript } = await import(pathToFileURL(runtimeFile).href);

const cases = [];
const test = (name, fn) => cases.push([name, fn]);
const size = value => Buffer.byteLength(JSON.stringify(value));
const payload = result => JSON.parse(result.content[0].text);
const bounded = result => assert.ok(size(result) <= MAX_INLINE_RESPONSE_BYTES, 'response exceeds 16 KiB');
const save = async () => 'checkpoint-test';
const runtime = (code, api = {}, checkpoint = save) => executeJavaScript(code, api, checkpoint);
const dispatches = [];
const api = { edits: 0 };
const bridge = {
    async requestEasyEda(event, body, timeout) {
        dispatches.push({ event, code: body.code, timeout });
        // Exercise the real executor and the JSON bridge boundary, not just a result fixture.
        return JSON.parse(JSON.stringify(await executeJavaScript(body.code, api, save, JSON.parse(JSON.stringify(body.inputs ?? {})))));
    },
};

test('inline and file inputs are mutually exclusive', () => {
    for (const input of [{}, { code: 'return 1', file_path: 'x' }, { code: '' }, { code: 4 }]) {
        assert.equal(ExecuteJsInputSchema.safeParse(input).success, false);
    }
    assert.equal(ExecuteJsInputSchema.safeParse({ code: 'return 1' }).success, true);
});

test('async JavaScript, multiline comments, checkpoint and public result', async () => {
    const result = await executeJs(bridge, { code: '// comment\nreturn await Promise.resolve({answer: 42});' });
    bounded(result);
    assert.deepEqual(payload(result), { checkpoint: 'checkpoint-test', result: { answer: 42 }, artifacts: [] });
    assert.equal(dispatches.at(-1).timeout, 60_000);
    assert.equal(dispatches.at(-1).event, 'execute-js');
});

test('file_path reads UTF-8 from the MCP host, including spaces and BOM', async () => {
    const path = join(temp, 'script with spaces.js');
    await writeFile(path, '\uFEFF// file\nreturn "Привет";');
    const result = await executeJs(bridge, { file_path: path });
    assert.equal(payload(result).result, 'Привет');
});

test('invalid files and oversized UTF-8 code never dispatch', async () => {
    const empty = join(temp, 'empty.js');
    const huge = join(temp, 'huge.js');
    await writeFile(empty, '   \n');
    await writeFile(huge, '');
    await fs.truncate(huge, MAX_CODE_BYTES + 1);
    const before = dispatches.length;
    for (const input of [
        { file_path: 'relative.js' }, { file_path: join(temp, 'missing.js') }, { file_path: temp },
        { file_path: empty }, { file_path: huge }, { code: ' \n' },
        { code: '界'.repeat(Math.floor(MAX_CODE_BYTES / 3) + 1) },
    ]) {
        const result = await executeJs(bridge, input);
        bounded(result);
        assert.equal(result.isError, true);
        assert.equal(payload(result).checkpoint, null);
    }
    assert.equal(dispatches.length, before);
});

test('checkpoint happens before compilation and execution', async () => {
    let created = 0;
    const checkpoint = async () => { created++; return 'syntax-checkpoint'; };
    const bad = await runtime('return (', {}, checkpoint);
    assert.equal(created, 1);
    assert.equal(bad.checkpoint, 'syntax-checkpoint');
    assert.equal(bad.error.phase, 'execute');
    assert.match(bad.error.message, /SyntaxError/);
    const good = await runtime('return eda.created();', { created: () => created }, checkpoint);
    assert.equal(JSON.parse(good.result.json), 2);
});

test('checkpoint failure prevents side effects', async () => {
    for (const checkpoint of [async () => null, async () => { throw new Error('storage failed'); }]) {
        const state = { edited: false };
        const result = await runtime('eda.edited = true;', state, checkpoint);
        assert.equal(state.edited, false);
        assert.equal(result.checkpoint, null);
        assert.equal(result.error.phase, 'checkpoint');
    }
});

test('existing runtime constants remain accessible without injection', async () => {
    globalThis.EPCB_LayerId = { TOP: 1 };
    assert.equal(JSON.parse((await runtime('return EPCB_LayerId.TOP;')).result.json), 1);
});

test('null, undefined, empty string, false and zero retain the intended values', async () => {
    for (const [code, expected] of [['', null], ['return null', null], ['return undefined', null],
        ['return ""', ''], ['return false', false], ['return 0', 0]]) {
        assert.equal(JSON.parse((await runtime(code)).result.json), expected);
    }
});

test('serialization failures retain checkpoint and report already-applied changes', async () => {
    for (const expression of ['1n', '(()=>{})', 'Symbol("x")',
        '(()=>{ const x={};x.x=x;return x; })()', '{blob: new Blob(["x"])}',
        '{data:new Uint8Array([1])}', '{ get value() { throw new Error("getter failed"); } }']) {
        const result = await executeJs(bridge, { code: `eda.edits++; return ${expression};` });
        bounded(result);
        assert.equal(result.isError, true);
        assert.equal(payload(result).checkpoint, 'checkpoint-test');
        assert.equal(payload(result).result.error.phase, 'serialize');
    }
    assert.equal(api.edits, 7);
});

test('thrown primitives and errors with broken string conversion are reported', async () => {
    for (const code of ['throw null', 'throw 5', 'throw Object.create(null)',
        'throw {toString(){throw Error("bad conversion")}}']) {
        const result = await runtime(code);
        assert.equal(result.error.phase, 'execute');
        assert.equal(typeof result.error.message, 'string');
        assert.equal(result.checkpoint, 'checkpoint-test');
    }
});

for (const length of [0, 1, 2, 3, 4, 24577, 1_000_000]) {
    test(`binary round trip, ${length} bytes`, async () => {
        const result = await executeJs(bridge, { code:
            `return new Blob([Uint8Array.from({length:${length}}, (_,i)=>i%256)], {type:'image/png'});` });
        bounded(result);
        const body = payload(result);
        assert.equal(body.result, null);
        const artifact = body.artifacts[0];
        assert.equal(artifact.mime_type, 'image/png');
        assert.equal(artifact.bytes, length);
        assert.ok(artifact.path.endsWith('.png'));
        const bytes = await readFile(artifact.path);
        assert.equal(bytes.equals(Buffer.from(Array.from({ length }, (_, i) => i % 256))), true);
        assert.equal(JSON.stringify(result).includes('base64'), false);
    });
}

test('typed arrays and DataView preserve byteOffset and byteLength', async () => {
    for (const expression of ['a.subarray(1,3)', 'new DataView(a.buffer,1,2)', 'a.buffer.slice(1,3)']) {
        const result = await executeJs(bridge, { code: `const a=new Uint8Array([0,11,22,33]); return ${expression};` });
        assert.deepEqual([...await readFile(payload(result).artifacts[0].path)], [11, 22]);
    }
});

test('binary data from another JavaScript realm is preserved', async () => {
    const data = runInNewContext('new Uint8Array([11,22]).buffer');
    const result = await runtime('return eda.data;', { data });
    assert.equal(result.result.kind, 'binary');
    assert.deepEqual([...Buffer.from(result.result.base64, 'base64')], [11, 22]);
});

test('a file exactly at the 64 MiB code limit executes', async () => {
    const path = join(temp, 'limit.js');
    const code = '/*' + 'x'.repeat(MAX_CODE_BYTES - 15) + '*/return 1;';
    assert.equal(Buffer.byteLength(code), MAX_CODE_BYTES - 2);
    // Pad trailing whitespace to exactly 64 MiB.
    await writeFile(path, code + '  ');
    assert.equal(payload(await executeJs(bridge, { file_path: path })).result, 1);
});

test('named UTF-8 inputs remain data across transport, including BOM and code-like text', async () => {
    const path = join(temp, 'source data.txt');
    const value = '\uFEFFПривет\r\n` ${eda.edits++} \\" \\u0000';
    await writeFile(path, value);
    const before = api.edits;
    const result = await executeJs(bridge, { code: 'return inputs.source;', input_files: { source: { path, encoding: 'utf8' } } });
    assert.equal(payload(result).result, value);
    assert.equal(api.edits, before);
    const script = join(temp, 'with-input.js');
    await writeFile(script, 'return inputs.source.length;');
    assert.equal(payload(await executeJs(bridge, { file_path: script, input_files: { source: { path } } })).result, value.length);
});

test('bad input files and aggregate size are rejected before dispatch', async () => {
    const huge = join(temp, 'huge-input.txt');
    const extra = join(temp, 'extra-input.txt');
    const invalid = join(temp, 'invalid-utf8.txt');
    await writeFile(huge, ''); await fs.truncate(huge, MAX_INPUT_BYTES);
    await writeFile(extra, 'x'); await writeFile(invalid, Buffer.from([0xff]));
    const before = dispatches.length;
    for (const input_files of [
        { a: { path: 'relative.txt' } }, { a: { path: temp } },
        { a: { path: join(temp, 'missing.txt') } }, { a: { path: invalid } },
        { a: { path: huge }, b: { path: extra } },
        { a: { path: extra, encoding: 'base64' } },
    ]) {
        const result = await executeJs(bridge, { code: 'return 1;', input_files });
        assert.equal(result.isError, true); assert.equal(payload(result).checkpoint, null);
    }
    assert.equal(dispatches.length, before);
});

test('native screenshot call becomes a file, without model-visible bytes', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/AAAAABJRU5ErkJggg==', 'base64');
    const eda = { dmt_EditorControl: { getCurrentRenderedAreaImage: async () => new Blob([png], { type: 'image/png' }) } };
    const screenshotBridge = { requestEasyEda: async (_event, { code }) => runtime(code, eda) };
    const result = await executeJs(screenshotBridge, {
        code: 'return await eda.dmt_EditorControl.getCurrentRenderedAreaImage();',
    });
    assert.equal((await readFile(payload(result).artifacts[0].path)).equals(png), true);
    bounded(result);
});

test('File names and MIME parameters cannot control artifact paths', async () => {
    const result = await executeJs(bridge, { code: 'return new File(["file"], "../../escape.js", {type:"text/plain; charset=utf-8"});' });
    const artifact = payload(result).artifacts[0];
    assert.equal(dirname(artifact.path), join(tmpdir(), 'easyeda-copilot-mcp', 'responses'));
    assert.equal(artifact.mime_type, 'text/plain');
    assert.equal(artifact.path.includes('escape'), false);
    assert.equal(await readFile(artifact.path, 'utf8'), 'file');
});

test('large JavaScript result is preserved in a file with checkpoint', async () => {
    const result = await executeJs(bridge, { code: 'return {items:Array.from({length:10000},(_,i)=>({i,text:"界😀"}))};' });
    bounded(result);
    const body = payload(result);
    assert.equal(body.checkpoint, 'checkpoint-test');
    assert.equal(body.result, null);
    const saved = JSON.parse(await readFile(body.artifacts[0].path, 'utf8'));
    assert.equal(saved.result.items.length, 10000);
    assert.deepEqual(saved.result.items[9999], { i: 9999, text: '界😀' });
});

test('large execution error is preserved without leaking its message inline', async () => {
    const result = await executeJs(bridge, { code: 'throw new Error("PRIVATE_MARKER".repeat(10000));' });
    bounded(result);
    assert.equal(result.isError, true);
    assert.equal(JSON.stringify(result).includes('PRIVATE_MARKER'), false);
    const saved = JSON.parse(await readFile(payload(result).artifacts[0].path, 'utf8'));
    assert.ok(saved.result.error.message.length > 100000);
    assert.equal(saved.checkpoint, 'checkpoint-test');
});

test('artifact write failures stay small and preserve known checkpoint', async () => {
    const stub = mock.method(fs, 'writeFile', async () => { throw Error('DISK_MARKER'.repeat(50000)); });
    try {
        for (const code of ['return "x".repeat(100000)', 'return new Blob(["x"])', 'throw Error("x".repeat(100000))']) {
            const result = await executeJs(bridge, { code });
            bounded(result);
            assert.equal(result.isError, true);
            assert.equal(payload(result).checkpoint, 'checkpoint-test');
            assert.equal(payload(result).result.error.phase, 'artifact');
            assert.equal(JSON.stringify(result).includes('DISK_MARKER'), false);
        }
    } finally { stub.mock.restore(); }
});

test('disconnect/timeout is not reported as cancellation and does not trigger a retry', async () => {
    let calls = 0;
    const result = await executeJs({ requestEasyEda: async () => { calls++; throw Error('Timeout waiting EasyEDA event'); } },
        { code: 'return 1' });
    assert.equal(calls, 1);
    assert.equal(payload(result).checkpoint, null);
    assert.match(payload(result).result.error.message, /does not stop JavaScript/);
});

test('caller timeout cannot release the extension queue while execution continues', async () => {
    const queue = new PQueue({ concurrency: 1 });
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const order = [];
    const first = queue.add(() => runtime('await eda.wait; eda.order.push("first");', { wait: pending, order }));
    const timed = await Promise.race([first, new Promise(resolve => setTimeout(() => resolve('timed out'), 5))]);
    assert.equal(timed, 'timed out');
    const second = queue.add(() => runtime('eda.order.push("second");', { order }));
    assert.deepEqual(order, []);
    release();
    await Promise.all([first, second]);
    assert.deepEqual(order, ['first', 'second']);
});

test('16 KiB boundary counts the serialized execute_js response', async () => {
    const empty = await executeJs(bridge, { code: 'return "";' });
    const overhead = size(empty);
    const exactValue = 'x'.repeat(MAX_INLINE_RESPONSE_BYTES - overhead);
    const exact = await executeJs(bridge, { code: `return ${JSON.stringify(exactValue)};` });
    assert.equal(size(exact), MAX_INLINE_RESPONSE_BYTES);
    assert.equal(payload(exact).result, exactValue);
    assert.deepEqual(payload(exact).artifacts, []);
    const above = await executeJs(bridge, { code: `return ${JSON.stringify(exactValue + 'x')};` });
    bounded(above);
    assert.equal(payload(above).result, null);
    const saved = JSON.parse(await readFile(payload(above).artifacts[0].path, 'utf8'));
    assert.equal(saved.result, exactValue + 'x');
});

for (const [name, value] of [['UTF-8', '界😀'.repeat(4000)], ['JSON escapes', '\u0000\\"\n'.repeat(3000)]]) {
    test(`large ${name} result survives file round trip`, async () => {
        const result = await executeJs(bridge, { code: `return ${JSON.stringify(value)};` });
        bounded(result);
        const saved = JSON.parse(await readFile(payload(result).artifacts[0].path, 'utf8'));
        assert.equal(saved.result, value);
    });
}

test('unknown binary format is saved verbatim as .bin with a format note', async () => {
    const result = await executeJs(bridge, { code: 'return new Blob([new Uint8Array([0,255,12])], {type:"application/x-custom"});' });
    bounded(result);
    const artifact = payload(result).artifacts[0];
    assert.ok(artifact.path.endsWith('.bin'));
    assert.equal(artifact.mime_type, 'application/x-custom');
    assert.match(artifact.note, /Unsupported format/);
    assert.deepEqual([...await readFile(artifact.path)], [0,255,12]);
    assert.equal(result.isError, undefined);
});

test('unprintable transport errors still return the public error contract', async () => {
    const result = await executeJs({ requestEasyEda: async () => { throw Object.create(null); } }, { code: 'return 1' });
    bounded(result);
    assert.equal(result.isError, true);
    assert.equal(payload(result).checkpoint, null);
    assert.equal(payload(result).result.error.phase, 'transport');
});

test('concurrent artifacts use unique names and preserve each payload', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) =>
        executeJs(bridge, { code: `return new Blob(["${i}"], {type:"text/plain"});` })));
    const artifacts = results.map(result => payload(result).artifacts[0]);
    assert.equal(new Set(artifacts.map(item => item.path)).size, 20);
    for (let i = 0; i < artifacts.length; i++) assert.equal(await readFile(artifacts[i].path, 'utf8'), String(i));
});

test('execute_js works through the ordinary MCP SDK transport', async () => {
    const server = new McpServer({ name: 'test', version: '1' });
    const client = new Client({ name: 'test-client', version: '1' });
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    server.registerTool('existing_tool', {}, async () => ({ content: [{ type: 'text', text: 'x'.repeat(20000) }] }));
    registerExecuteJsTools(server, bridge);
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
        const listed = await client.listTools();
        assert.ok(listed.tools.some(tool => tool.name === 'execute_js'));
        const small = await client.callTool({ name: 'execute_js', arguments: { code: 'return 42' } });
        assert.equal(payload(small).result, 42);
        for (const code of ['return "x".repeat(50000)', 'return new Blob(["x"])', 'throw Error("x".repeat(50000))']) {
            const result = await client.callTool({ name: 'execute_js', arguments: { code } });
            bounded(result);
            assert.ok(payload(result).artifacts[0].path);
        }
        const invalid = await client.callTool({ name: 'execute_js', arguments: {} });
        assert.equal(invalid.isError, true);
        const existing = await client.callTool({ name: 'existing_tool', arguments: {} });
        assert.equal(existing.content[0].text.length, 20000);
    } finally {
        await client.close();
        await server.close();
    }
});

let failures = 0;
for (const [name, fn] of cases) {
    try { await fn(); }
    catch (error) {
        failures++;
        console.error(`FAIL: ${name}\n${String(error.stack ?? error).slice(0, 1600)}`);
    }
}
if (failures) throw new Error(`${failures}/${cases.length} execute-js checks failed.`);
console.log(`Execute JS checks passed: ${cases.length} cases (runtime, tool-local artifacts, ordinary MCP transport).`);
