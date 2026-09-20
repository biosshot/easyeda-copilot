import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { WebSocketServer } from 'ws';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { setTimeout as delay, setImmediate as nextTurn } from 'node:timers/promises';
import { connect, listInstances, EPCB_LayerId } from '../dist/lib/node/index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await mkdir(resolve(root, '.test-data'), { recursive: true });
const temp = await mkdtemp(resolve(root, '.test-data/sdk-'));
const runtimeFile = resolve(temp, 'executor.mjs');
await build({ entryPoints: [resolve(root, '../extension/src/eda/execute-js.ts')], outfile: runtimeFile,
    bundle: true, platform: 'browser', format: 'esm', logLevel: 'silent' });
const { executeJavaScript } = await import(pathToFileURL(runtimeFile));
const scopesFile = resolve(temp, 'scopes.mjs');
await build({ entryPoints: [resolve(root, '../extension/src/eda/checkpoint-scopes.ts')], outfile: scopesFile,
    bundle: true, platform: 'browser', format: 'esm', logLevel: 'silent' });
const { CheckpointScopes } = await import(pathToFileURL(scopesFile));
let saves = 0, legacyExtension = false;
const pins = new Map();
const scopes = new CheckpointScopes({ save: async () => { saves++; return `checkpoint-${dispatches}`; },
    pin: (id, until) => pins.set(id, until), unpin: id => pins.delete(id) });
let documentUuid = 'test-board', dispatches = 0, creates = 0, ignored = false, instances = 1;
class Component {
    constructor(name) { this.name = name; }
    getState_Designator() { return this.name; }
    setState_Designator(name) { this.name = name; return this; }
    done() { return this; }
}
const components = [new Component('C1'), new Component('R1')];
const eda = {
    dmt_SelectControl: { getCurrentDocumentInfo: () => ({ uuid: documentUuid }) },
    pcb_PrimitiveComponent: { getAll: () => components, create: () => { creates++; return new Component('NEW'); } },
    test: { echo: x => x, fail: () => { throw Error('test failure'); }, scalar: () => 42,
        switchDocument: () => { documentUuid = 'changed'; return 1; },
        write: () => { creates++; return documentUuid; },
        throwValue: value => { throw value; },
        throwUnprintable: () => { throw Object.create(null); },
        slow: async (ms, value) => { await delay(ms); return value; },
    },
};
const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
await once(server, 'listening');
const url = `ws://127.0.0.1:${server.address().port}`;
let tail = Promise.resolve();
server.on('connection', socket => {
    socket.on('message', bytes => {
        const message = JSON.parse(bytes), body = JSON.parse(message.body);
        const send = (event, body) => { if (socket.readyState === 1) socket.send(JSON.stringify({ event, body: JSON.stringify(body) })); };
        if (message.event === 'proxy:hello') return send('proxy:hello:result', { ok: true });
        const reply = result => send('proxy:response', { id: body.id, ok: true, result });
        if (message.event === 'proxy:list-easyeda-instances') return reply(Array.from({ length: instances }, (_, i) => ({ instanceId: `test-${i}`, projectName: 'Test', connectedAt: 1, lastSeenAt: 1 })));
        assert.equal(message.event, 'proxy:request-easyeda');
        assert.equal(body.targetInstanceId, 'test-0');
        assert.equal(body.event, 'execute-js');
        if (ignored) return;
        tail = tail.then(async () => {
            dispatches++;
            reply(legacyExtension ? await executeJavaScript(body.body.code, eda, async () => `checkpoint-${dispatches}`, body.body.inputs)
                : await scopes.execute(body.body, eda, 1));
        });
    });
});
const cases = [];
const test = (name, fn) => cases.push([name, fn]);
const open = options => connect({ url, checkpointScope: false, ...options });
let session;
try {
    session = await open();
    test('client-only discovery, ambiguity and explicit target', async () => {
        assert.equal((await listInstances({ url }))[0].instanceId, 'test-0');
        instances = 2;
        try { await assert.rejects(open(), /Select a connected/); }
        finally { instances = 1; }
        await assert.rejects(open({ documentUuid: 'another-board' }), /not active/);
        await assert.rejects(open({ instanceId: 'missing' }), /Select a connected/);
    });
    test('native objects, correct receiver and automatic batching', async () => {
        const list = await session.eda.pcb_PrimitiveComponent.getAll();
        assert.equal(list.length, 2);
        const before = dispatches;
        assert.deepEqual(await Promise.all(list.map(c => c.getState_Designator())), ['C1', 'R1']);
        assert.equal(dispatches - before, 1);
        const c = await list[0].setState_Designator('C2');
        assert.equal(await (await c.done()).getState_Designator(), 'C2');
        assert.equal(await c.name, 'C2');
    });
    test('lazy calls, repeated awaits and cross-batch expression dependencies execute once', async () => {
        const before = creates;
        const call = session.eda.pcb_PrimitiveComponent.create();
        assert.equal(creates, before);
        const component = await call;
        await call;
        assert.equal(await call.getState_Designator(), 'NEW');
        assert.equal(await (await session.eda.test.echo(call)).getState_Designator(), 'NEW');
        assert.equal(await (await session.eval('return inputs.c', { c: call })).getState_Designator(), 'NEW');
        assert.equal(creates - before, 1);
        const obj = await session.eda.test.echo({ component });
        assert.equal(await obj.component.getState_Designator(), 'NEW');
    });
    test('plain data, shared subobjects, escaping and large results stay local', async () => {
        const data = { quote: '` ${eda.test.fail()} " \\ \n Привет', missing: undefined, big: 12345678901234567890n,
            nan: NaN, inf: Infinity, nil: null, date: new Date('2026-01-01Z'), values: Array.from({ length: 20000 }, (_, i) => ({ i })) };
        assert.deepEqual(await session.eda.test.echo(data), data);
        assert.deepEqual(await session.eval('const x={n:1}; return [x,x]'), [{ n: 1 }, { n: 1 }]);
        await assert.rejects(Promise.resolve(session.eda.test.echo(() => 1)), /callback/);
        const cycle = {}; cycle.self = cycle;
        await assert.rejects(Promise.resolve(session.eda.test.echo(cycle)), /Cyclic/);
    });
    test('binary types round-trip nested and with byte offsets, including a multi-megabyte Blob', async () => {
        const bytes = Uint8Array.from({ length: 2 * 1024 * 1024 + 7 }, (_, i) => i % 251);
        const data = { blob: new Blob([bytes], { type: 'image/png' }), file: new File(['hello'], 'test.bin', { type: 'application/test', lastModified: 123 }),
            buffer: bytes.slice(0, 17).buffer, typed: new Int16Array([1, -300, 500]).subarray(1), view: new DataView(bytes.buffer, 5, 13),
            big: new BigUint64Array([1n, 9007199254740993n]) };
        const result = await session.eda.test.echo(data);
        assert(result.blob instanceof Blob); assert(result.file instanceof File);
        assert.equal(result.blob.type, 'image/png');
        assert.deepEqual(Buffer.from(await result.blob.arrayBuffer()), Buffer.from(bytes));
        assert.equal(result.file.name, 'test.bin'); assert.equal(result.file.lastModified, 123);
        assert.equal(await result.file.text(), 'hello');
        assert.deepEqual(result.buffer, data.buffer); assert.deepEqual(result.typed, data.typed);
        assert.deepEqual(new Uint8Array(result.view.buffer), bytes.slice(5, 18));
        assert.deepEqual(result.big, data.big);
    });
    test('legacy code/file_path and input_files preserve script execution semantics', async () => {
        const script = resolve(temp, 'legacy.js'), input = resolve(temp, 'input.txt');
        await writeFile(script, 'return {value:inputs.value, count: (await eda.pcb_PrimitiveComponent.getAll()).length};');
        await writeFile(input, 'legacy');
        assert.deepEqual(await session.executeJs({ file_path: script, input_files: { value: { path: input } } }), { value: 'legacy', count: 2 });
        assert.deepEqual(await session.executeJs({ code: 'return [inputs.__proto__, inputs.constructor, inputs.toString]',
            input_files: Object.fromEntries(['__proto__', 'constructor', 'toString'].map(key => [key, { path: input }])) }), ['legacy', 'legacy', 'legacy']);
        assert(await session.executeJs({ code: 'return new Blob(["image"], {type:"image/png"});' }) instanceof Blob);
        await assert.rejects(session.executeJs({ code: '', file_path: script }), /exactly one/);
    });
    test('invalid scripts, UTF-8 files and overflowing timers fail before dispatch', async () => {
        const bad = resolve(temp, 'invalid-utf8.txt');
        await writeFile(bad, Buffer.from([0xff, 0xfe, 0xff]));
        const before = dispatches;
        for (const options of [{ code: '' }, { code: 123 }, { file_path: 'relative.js' }, { file_path: temp },
            { code: 'return inputs.x', input_files: { x: { path: bad } } },
            { code: 'return inputs.x', input_files: { x: { path: bad, encoding: 'base64' } } }]) {
            await assert.rejects(session.executeJs(options));
        }
        for (const timeoutMs of [0, -1, Infinity, NaN, 2 ** 31, '100']) await assert.rejects(open({ timeoutMs }), /timeoutMs/);
        assert.equal(dispatches, before);
        assert.equal(await session.eda.test.scalar(), 42);
    });
    test('failed batches stop at the first error and expose the checkpoint', async () => {
        const before = creates;
        const results = await Promise.allSettled([session.eda.test.scalar(), session.eda.test.fail(), session.eda.pcb_PrimitiveComponent.create()]);
        assert.equal(results[0].value, 42);
        assert.match(results[1].reason.message, /test failure/);
        assert.match(results[1].reason.checkpoint, /^checkpoint-/);
        assert.equal(results[1].reason.failedIndex, 1);
        assert.match(results[2].reason.message, /Not executed/);
        assert.equal(creates, before);
    });
    test('session isolation, explicit release, close and document change', async () => {
        const other = await open();
        const [c] = await session.eda.pcb_PrimitiveComponent.getAll();
        await assert.rejects(Promise.resolve(other.eda.test.echo(c)), /different SDK session/);
        await session.release(c);
        await assert.rejects(Promise.resolve(c.getState_Designator()), /expired/);
        documentUuid = 'new-board';
        try { await assert.rejects(Promise.resolve(other.eda.test.scalar()), /document changed/); }
        finally { documentUuid = 'test-board'; }
        await other.close();
        await assert.rejects(Promise.resolve(other.eda.test.scalar()), /closed/);
    });
    test('disconnect/timeout never elects an owner or retries a call', async () => {
        const short = await open({ timeoutMs: 20 });
        ignored = true;
        try {
            await assert.rejects(Promise.resolve(short.eda.test.scalar()), e => e.outcomeUnknown === true);
            await assert.rejects(Promise.resolve(short.eda.test.scalar()), /closed or disconnected/);
        } finally { ignored = false; await short.close(); }
        assert.equal((await listInstances({ url })).length, 1);
    });
    test('Python uses the same broker, batches and binary codec', async () => {
        const processResult = await run(process.env.EASYEDA_COPILOT_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), [resolve(root, 'tests/sdk-python.py'), url], {
            ...process.env, PYTHONPATH: resolve(root, 'dist/lib/python'), EASYEDA_COPILOT_NODE: process.execPath,
        });
        assert.equal(processResult.code, 0, processResult.stderr + processResult.stdout);
        console.log(processResult.stdout.trim());
    });
    test('generated Node types check return values, arguments, overloads and enums', async () => {
        const consumer = resolve(temp, 'consumer.mts');
        // Use a relative module specifier so tsc tests normal on-disk module resolution on both platforms.
        await writeFile(consumer, `import {connect,EPCB_LayerId,milToMm,assertUnitScale,type API} from '../../dist/lib/node/index.mjs';
const s=await connect();
const components: API.IPCB_PrimitiveComponent[]=await s.eda.pcb_PrimitiveComponent.getAll(EPCB_LayerId.TOP);
const one: API.IPCB_PrimitiveComponent|undefined=await s.eda.pcb_PrimitiveComponent.get('id');
const many: API.IPCB_PrimitiveComponent[]=await s.eda.pcb_PrimitiveComponent.get(['id']);
const names: (string|undefined)[]=await Promise.all(components.map(c=>c.getState_Designator()));
const image: Blob|undefined=await s.eda.dmt_EditorControl.getCurrentRenderedAreaImage();
const scopeResult: number=await s.checkpointScope('typed',async scope=>{
  const scoped: API.IPCB_PrimitiveComponent[]=await scope.eda.pcb_PrimitiveComponent.getAll();
  const cp: string=scope.checkpointId;
  return scoped.length;
});
const explicit=await s.beginCheckpointScope('explicit');await explicit.close();
const mm: number=milToMm(10);assertUnitScale(10,.254,.0254,.001);
// @ts-expect-error conversion input must be numeric
milToMm('10');
if(image) { const bytes: ArrayBuffer=await image.arrayBuffer(); }
await s.eda.pcb_PrimitiveComponent.modify(components[0], {x:1,y:2});
// @ts-expect-error misspelled API method
s.eda.pcb_PrimitiveComponent.getEverything();
// @ts-expect-error wrong native argument type
s.eda.pcb_PrimitiveComponent.getAll('top');
// @ts-expect-error remote getter requires await
const name: string=components[0].getState_Designator();
// @ts-expect-error callbacks must run in session.eval or executeJs
s.eda.pcb_Event.addCrossProbeSelectEventListener('x',()=>{});
await s.close();
`);
        const program = ts.createProgram([consumer], { noEmit: true, strict: true, target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext });
        const diagnostics = ts.getPreEmitDiagnostics(program);
        assert.equal(diagnostics.length, 0, ts.formatDiagnostics(diagnostics, { getCurrentDirectory: () => root, getCanonicalFileName: x => x, getNewLine: () => '\n' }));
        assert.equal(EPCB_LayerId.TOP, 1);
    });
    test('sparse arrays and negative zero survive both directions', async () => {
        const values = [undefined, -0, , 3];
        const result = await session.eda.test.echo(values);
        assert.equal(result.length, 4);
        assert(Object.is(result[1], -0));
        assert.equal(result[2], undefined);
        assert(Object.is(await session.eval('return -0'), -0));
        assert.deepEqual(await session.eval('return new Array(3)'), [undefined, undefined, undefined]);
    });
    test('concurrent close is idempotent', async () => {
        const s = await open();
        await Promise.all([s.close(), s.close(), s.close()]);
        await s.close();
    });
    test('close drains a dispatched batch still encoding its binary arguments', async () => {
        const s = await open();
        class SlowBlob extends Blob { async arrayBuffer() { await delay(60); return super.arrayBuffer(); } }
        const pending = Promise.resolve(s.eda.test.echo(new SlowBlob(['slow'])));
        const outcome = Promise.allSettled([pending]);
        await nextTurn();
        await nextTurn();
        await s.close();
        const [result] = await outcome;
        assert.equal(result.status, 'fulfilled', result.reason?.message);
        assert.equal(await result.value.text(), 'slow');
    });
    test('a document-changing dependency cannot run the outer write', async () => {
        const s = await open();
        const before = creates;
        try {
            await assert.rejects(Promise.resolve(s.eda.test.write(s.eda.test.switchDocument())), /document changed/);
            assert.equal(creates, before, 'write ran in the wrong document');
        } finally { documentUuid = 'test-board'; await s.close(); }
    });
    test('a document-changing eval input cannot run the script body', async () => {
        const s = await open();
        const before = creates;
        try {
            await assert.rejects(s.eval('return eda.test.write()', { value: s.eda.test.switchDocument() }), /document changed/);
            assert.equal(creates, before, 'eval ran in the wrong document');
        } finally { documentUuid = 'test-board'; await s.close(); }
    });
    test('failed expression arguments do not execute later write dependencies', async () => {
        const before = creates;
        await assert.rejects(Promise.resolve(session.eda.test.echo([session.eda.test.fail(), session.eda.test.write()])), /test failure/);
        assert.equal(creates, before);
        await assert.rejects(session.eval('return inputs', { a: session.eda.test.fail(), b: session.eda.test.write() }), /test failure/);
        assert.equal(creates, before);
    });
    test('serializing a native accessor does not execute its getter twice', async () => {
        const object = await session.eval('let n=0; return { get value(){ return ++n; } };');
        assert.equal(await object.value, 1);
        assert.equal(await object.value, 2);
    });
    test('thrown values without toString preserve the successful batch prefix', async () => {
        const results = await Promise.allSettled([session.eda.test.scalar(), session.eda.test.throwUnprintable(), session.eda.test.scalar()]);
        assert.equal(results[0].value, 42);
        assert.equal(results[1].status, 'rejected');
        assert.equal(results[1].reason.failedIndex, 1);
        assert.equal(results[2].status, 'rejected');
    });
    test('all typed-array classes, empty binary and base64 padding boundaries', async () => {
        const constructors = [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array,
            Float32Array, Float64Array, BigInt64Array, BigUint64Array];
        const values = constructors.flatMap(C => [new C(), new C(C.name.startsWith('Big') ? [1n, 2n, 3n] : [1, 2, 3]).subarray(1)]);
        values.push(new DataView(new ArrayBuffer(0)), new Blob([]), new File([], 'empty.bin'), Buffer.from([1, 2, 3]));
        const result = await session.eda.test.echo(values);
        for (let i = 0; i < values.length; i++) {
            const a = values[i], b = result[i];
            assert.equal(Object.prototype.toString.call(b), Object.prototype.toString.call(a));
            if (a instanceof Blob) assert.deepEqual(await b.arrayBuffer(), await a.arrayBuffer());
            else assert.deepEqual(Buffer.from(b.buffer, b.byteOffset, b.byteLength), Buffer.from(a.buffer, a.byteOffset, a.byteLength));
        }
        for (const size of [1, 2, 3, 4, 7, 31, 24575, 24576, 24577, 65537]) {
            const bytes = Uint8Array.from({ length: size }, (_, i) => (i * 113 + 97) % 256);
            assert.deepEqual(await session.eda.test.echo(bytes), bytes);
        }
    });
    test('deep records, special property names and deterministic randomized values', async () => {
        let seed = 12345;
        const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
        const value = depth => depth ? random() % 2 ? Array.from({ length: random() % 5 }, () => value(depth - 1))
            : Object.fromEntries(Array.from({ length: random() % 5 }, (_, i) => [`key-${i}`, value(depth - 1)]))
            : [undefined, null, false, '', '💡\u0000\u2028', random(), BigInt(random()), NaN, -Infinity, -0][random() % 10];
        const records = Array.from({ length: 200 }, () => value(4));
        records.push(JSON.parse('{"__proto__":{"polluted":true},"constructor":4,"prototype":5}'));
        assert.deepEqual(await session.eda.test.echo(records), records);
        assert.equal({}.polluted, undefined);
    });
    test('unknown classes and cyclic remote graphs remain usable through handles', async () => {
        const map = await session.eval('return new Map([["a", 42]])');
        assert.equal(await map.get('a'), 42);
        const cycle = await session.eval('const x={n:42};x.self=x;return x');
        assert.equal(cycle.n, 42);
        assert.equal(await cycle.self.n, 42);
        const fn = await session.eval('return x => x + 1');
        assert.equal(await fn(4), 5);
    });
    test('expiry and editor reload reject stale references without recreating sessions', async () => {
        const s = await open();
        const [component] = await s.eda.pcb_PrimitiveComponent.getAll();
        const originalNow = Date.now;
        try {
            const future = originalNow() + 31 * 60_000;
            Date.now = () => future;
            await assert.rejects(Promise.resolve(component.getState_Designator()), /expired/);
        } finally { Date.now = originalNow; await s.close(); }
        const fresh = await open();
        try {
            await fresh.executeJs({ code: 'delete globalThis.__easyedaCopilotLocalSdkV1; return true;' });
            await assert.rejects(Promise.resolve(fresh.eda.test.scalar()), /expired/);
        } finally { await fresh.close(); }
    });
    test('checkpoint scope shares one baseline across dependent Node calls and legacy bodies', async () => {
        const s = await open();
        const before = saves;
        await s.checkpointScope('Ground repair', async scope => {
            const cp = scope.checkpointId;
            assert.equal(await scope.eda.test.scalar(), 42);
            assert.equal(s.lastCheckpoint, cp);
            await s.eval('return eda.test.write()');
            await s.executeJs({ code: 'return 123' });
            assert.equal(s.lastCheckpoint, cp);
            await assert.rejects(s.beginCheckpointScope('nested'), /Nested/);
        });
        assert.equal(saves-before, 1);
        assert.equal(pins.size, 0);
        await s.eda.test.scalar(); assert.equal(saves-before, 2);
        await s.close();
    });
    test('Node connect automatically shares one file-level checkpoint without explicit LLM code', async () => {
        const before = saves;
        const s = await connect({ url });
        const cp = s.lastCheckpoint;
        assert.ok(cp);
        assert.equal(saves - before, 1);
        assert.equal(await s.eda.test.scalar(), 42);
        await s.eval('return eda.test.write()');
        await s.executeJs({ code: 'return 123' });
        assert.equal(s.lastCheckpoint, cp);
        await assert.rejects(s.beginCheckpointScope(''), /1 to 200/);
        await s.checkpointScope('legacy explicit wrapper', async scope => {
            assert.equal(scope.checkpointId, cp);
            await scope.eda.test.write();
        });
        assert.equal(saves - before, 1);
        await s.close();
        assert.equal(pins.size, 0);
    });
    test('checkpoint scope failures keep edits and return baseline; close is idempotent', async () => {
        const s=await open(); const n=creates; let cp;
        await assert.rejects(s.checkpointScope('failure', async scope => {
            cp=scope.checkpointId;
            await scope.eda.test.write();
            await scope.eda.test.fail();
        }), e => e.checkpoint===cp && /test failure/.test(e.message));
        assert.equal(creates,n+1); assert.equal(pins.size,0);
        const scope=await s.beginCheckpointScope('close');
        const work=Promise.resolve(scope.eda.test.slow(20,42));
        await nextTurn();
        await Promise.all([scope.close(),scope.close()]);
        assert.equal(await work,42);
        assert.throws(()=>scope.eda,/closed/);
        await s.close();
    });
    test('scope document checks also protect legacy executeJs and session close unpins', async () => {
        const s=await open(); const scope=await s.beginCheckpointScope('bound');const n=creates;
        documentUuid='other-board';
        try { await assert.rejects(s.executeJs({code:'return eda.test.write()'}),/document changed/); }
        finally { documentUuid='test-board'; }
        assert.equal(creates,n);
        await s.close(); assert.equal(pins.size,0); await scope.close();
    });
    test('old extension fails scope negotiation before user code, ordinary execution remains available', async () => {
        const s=await open(); let called=false;
        legacyExtension=true;
        try {
            await assert.rejects(s.checkpointScope('unsupported',async()=>{called=true}),/update the extension/);
            assert.equal(called,false);
            assert.equal(await s.eda.test.scalar(),42);
        } finally {legacyExtension=false;await s.close();}
    });
    test('ending a scope drains eval binary encoding before releasing its baseline',async()=>{
        const s=await open(); const scope=await s.beginCheckpointScope('binary drain');const before=saves;
        const blob=new Blob(['x']); const original=blob.arrayBuffer.bind(blob);
        blob.arrayBuffer=async()=>{await delay(30);return original()};
        const work=s.eval('return inputs.blob',{blob});
        await scope.close();assert.equal(await (await work).text(),'x');assert.equal(saves,before);
        await s.close();
    });
    test('session close during scope entry releases any created pin',async()=>{
        const s=await open();
        const opening=s.beginCheckpointScope('closing during entry');
        const results=await Promise.allSettled([opening,s.close()]);
        assert.equal(results[1].status,'fulfilled');
        assert.equal(pins.size,0);
    });
    let failures = 0;
    for (const [name, fn] of cases) {
        try { await fn(); console.log(`PASS ${name}`); }
        catch (error) { failures++; console.error(`FAIL ${name}\n${error.stack}`); }
    }
    assert.equal(failures, 0, `${failures} SDK checks failed`);
} finally {
    await session?.close();
    for (const socket of server.clients) socket.terminate();
    await new Promise(resolve => server.close(resolve));
    delete globalThis.__easyedaCopilotLocalSdkV1;
}
console.log(`Local SDK: ${cases.length} integration checks passed.`);

async function run(command, args, env) {
    const child = spawn(command, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', b => { stdout += b; }); child.stderr.on('data', b => { stderr += b; });
    const [code] = await once(child, 'close');
    return { code, stdout, stderr };
}
