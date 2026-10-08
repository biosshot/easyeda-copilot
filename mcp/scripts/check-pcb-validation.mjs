import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { WebSocket } from 'ws';
import { validatePcbLayoutIntent } from 'eda-copilot-backend/pcb';

// Optional entry paths also exercise the packaged skill against a simulated editor.
const entry = resolve(process.argv[2] ?? fileURLToPath(new URL('../dist/index.js', import.meta.url)));
const cli = resolve(process.argv[3] ?? fileURLToPath(new URL('../dist/cli.js', import.meta.url)));
const directory = await mkdtemp(join(tmpdir(), 'easyeda-pcb-validation-'));
const probe = createServer().listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
await new Promise(resolveClose => probe.close(resolveClose));
const env = { ...process.env, EASYEDA_COPILOT_CLI_HOME: join(directory, 'state'),
    EASYEDA_COPILOT_MCP_WS_HOST: '127.0.0.1', EASYEDA_COPILOT_MCP_WS_PORT: String(port), EDA_BACKEND_LOG_LEVEL: 'silent' };
const client = new Client({ name: 'pcb-validation-regression', version: '1.0.0' });
const transport = new StdioClientTransport({ command: process.execPath, args: [entry], env, stderr: 'pipe' });
let logs = '';
transport.stderr?.on('data', bytes => { logs += bytes.toString(); });
const execute = promisify(execFile);
const run = (...args) => execute(process.execPath, [cli, ...args], { env, cwd: directory, windowsHide: true, timeout: 20_000 });
const json = async (...args) => JSON.parse((await run(...args)).stdout);
const version = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const component = designator => ({ designator, value: 'Test', part_uuid: null,
    pins: [{ pin_number: '1', name: 'SIG', signal_name: 'SIG' }] });
const circuit = { components: [component('U1')] };
const board = 'board.rect(40,30);';
const hole = 'boardHole("mount",{at:anchor("board.top_left"),drill:3.2});';
const base = { code: board + 'block("main",["U1"]);', circuit };
const diagnostics = input => JSON.parse(JSON.stringify(validatePcbLayoutIntent(input)));
const existingPlacement = {
    board: { polygon: [{ x: -20, y: -15 }, { x: 20, y: -15 }, { x: 20, y: 15 }, { x: -20, y: 15 }] },
    components: [{ designator: 'J1', x: 20, y: 0, rotate: 0, layer: 'top' }],
};
const cases = [
    { name: 'info', input: base, finding: 'PCB_INTENT_MOUNTING_HOLES', severity: 'info' },
    { name: 'warning', input: { code: board + hole + 'block("connector",["J1"]); fixed("J1",{x:0,y:0});',
        circuit: { components: [component('J1')] } }, finding: 'PCB_INTENT_CONNECTOR_PLACEMENT', severity: 'warning' },
    { name: 'DSL error', input: { ...base, code: 'board.rect(' }, severity: 'error' },
    { name: 'preserved placement', input: { code: 'preserve({board:true,components:"all"});' + hole,
        circuit: { components: [component('J1')] }, existingPlacement }, noConnectorWarning: true },
];
let activeInput = base, requests = [], editor, daemon;
async function connectEditor() {
    editor = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((ready, reject) => {
        const deadline = setTimeout(() => reject(new Error('Editor handshake timeout')), 5000);
        editor.once('error', reject);
        editor.on('message', bytes => {
            try {
                const { event, body: encoded } = JSON.parse(bytes.toString());
                if (event === 'connected') {
                    editor.send(JSON.stringify({ event: 'easyeda:hello', body: JSON.stringify({ instanceId: 'validation-editor', extensionVersion: version }) }));
                    editor.send(JSON.stringify({ event: 'ping', body: '{}' }));
                    return;
                }
                if (event === 'pong') { clearTimeout(deadline); ready(); return; }
                const body = JSON.parse(encoded);
                requests.push(event);
                let result;
                if (event === 'get-command-target') result = { documentUuid: 'validation-board' };
                else {
                    assert.equal(body.__easyedaCopilotDocumentUuid, 'validation-board', 'Pin reads to the invocation PCB');
                    if (event === 'get-pcb-existing-placement') {
                        const placement = activeInput.existingPlacement;
                        result = placement ? { ...placement, components: [
                            ...placement.components.map(c => ({ ...c, designator: ' j1 ' })),
                            { designator: 'PCB_ONLY', x: 0, y: 0, rotate: 0, layer: 'bottom' },
                        ] } : null;
                    } else if (event === 'get-multi-page-schematic') {
                        assert.equal(requests.at(-2), 'get-pcb-existing-placement', 'Capture PCB before extracting schematic');
                        assert.equal(body.extractFootprintUuid, true, 'Use the same full schematic extraction as placement');
                        result = activeInput.circuit;
                    } else throw new Error(`Unexpected editor event: ${event}`);
                }
                editor.send(JSON.stringify({ event, body: JSON.stringify({ id: body.id, ok: true, result }) }));
            } catch (error) { clearTimeout(deadline); reject(error); editor.close(); }
        });
    });
}
function assertReads() {
    assert.deepEqual(requests, ['get-command-target', 'get-pcb-existing-placement', 'get-multi-page-schematic'],
        'Validation only reads target/PCB/schematic; no placement or mutation commands');
}
try {
    await client.connect(transport);
    const tool = (await client.listTools()).tools.find(item => item.name === 'validate_pcb_dsl');
    assert.ok(tool, 'Compiled MCP must register validate_pcb_dsl');
    assert.deepEqual(tool.annotations, { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
    assert.deepEqual(tool.inputSchema.required, ['file']);
    assert.deepEqual(Object.keys(tool.inputSchema.properties), ['file'], 'LLM supplies only a DSL path');
    await connectEditor();
    const file = join(directory, 'layout.js');
    for (const { name, input, finding, severity, noConnectorWarning } of cases) {
        activeInput = input; requests = [];
        await writeFile(file, input.code);
        const expected = diagnostics(input);
        if (severity) assert.ok(expected.some(item => item.severity === severity && (!finding || item.code === finding)), name);
        if (noConnectorWarning) assert.ok(!expected.some(item => item.severity === 'error' || item.code === 'PCB_INTENT_CONNECTOR_PLACEMENT'), name);
        const response = await client.callTool({ name: tool.name, arguments: { file } });
        assert.ok(!response.isError, `${name}: diagnostic errors are result data`);
        assert.deepEqual(JSON.parse(response.content[0].text), expected, `${name}: backend diagnostic parity and normalized PCB context`);
        assertReads();
    }
    for (const arguments_ of [{}, { file: '' }, { file: 42 }]) {
        requests = [];
        const response = await client.callTool({ name: tool.name, arguments: arguments_ });
        assert.equal(response.isError, true, 'MCP validates the file argument');
        assert.deepEqual(requests, [], 'Reject invalid arguments before editor requests');
    }
    const missing = await client.callTool({ name: tool.name, arguments: { file: join(directory, 'missing.js') } });
    assert.equal(missing.isError, true, 'Missing files are tool errors');
    daemon = (await run('start')).stdout.trim();
    assert.match(daemon, /^[a-z0-9]{4}$/);
    assert.ok((await json(daemon, 'tools', 'list')).some(item => item.name === tool.name));
    const cliTool = await json(daemon, 'tools', 'help', tool.name);
    assert.deepEqual(cliTool.inputSchema, tool.inputSchema, 'CLI and stdio expose the same small schema');
    const inputFile = join(directory, 'validation.json');
    await writeFile(inputFile, JSON.stringify({ file }));
    for (const { name, input } of cases) {
        activeInput = input; requests = [];
        await writeFile(file, input.code);
        assert.deepEqual(await json(daemon, 'call', tool.name, '--input', inputFile), diagnostics(input), `${name}: CLI parity`);
        assertReads();
    }
    const docPath = cliTool.description.match(/For guidance, read (.+)\.$/)[1];
    assert.match(await readFile(docPath, 'utf8'), /validate_pcb_dsl/);
    console.log(`PCB validation passed: ${cases.length} backend/stdio/CLI cases, file-only schema, automatic schematic/PCB reads, preserved context, invalid/missing files, packaged documentation.`);
} catch (error) {
    if (logs) console.error(logs);
    throw error;
} finally {
    if (daemon) await run(daemon, 'stop', '--force').catch(() => undefined);
    editor?.close();
    await client.close();
}
