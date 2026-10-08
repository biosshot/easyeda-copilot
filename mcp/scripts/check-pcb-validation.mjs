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
const diagnostics = (input, groups) => JSON.parse(JSON.stringify(validatePcbLayoutIntent(input, groups)));
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
    { name: 'schematic group info', input: { code: board + 'block("main",["U1"]); block("second",["U2"]);',
        circuit: { components: [component('U1'), component('U2')] } },
        groups: { maybe_blocks: ['U1 U2'], wires: [] }, backendGroups: { groups: [{ components: ['U1', 'U2'] }] },
        finding: 'PCB_SCHEMATIC_GROUP_MISMATCH', severity: 'info' },
    { name: 'partial grouping', input: base, groups: { maybe_blocks: [], wires: [], errors: ['Partial page read'] },
        backendGroups: { groups: [], incomplete: true }, finding: 'PCB_SCHEMATIC_GROUP_COVERAGE', severity: 'info' },
    { name: 'grouping unavailable', input: base, groupReadFails: true,
        finding: 'PCB_SCHEMATIC_GROUP_COVERAGE', severity: 'info' },
    { name: 'multipart and whitespace parsed by EasyEDA adapter',
        input: { code: board + 'block("main",["U1"]); block("second",["U2"]);', circuit: { components: [component('U1'), component('U2')] } },
        groups: { maybe_blocks: ['  U2.2\tU1.1  U1.2  '], wires: [{ net: 'SIG', pins: ' U2.1\tU1.1 U1.1 ' }] },
        backendGroups: { groups: [{ components: ['U1', 'U2'] }], wireIslands: [{ net: 'SIG',
            pins: [{ designator: 'U1', pin_number: '1' }, { designator: 'U2', pin_number: '1' }] }] },
        finding: 'PCB_SCHEMATIC_GROUP_MISMATCH', severity: 'info' },
    { name: 'exact dotted designator takes precedence over multipart reference',
        input: { code: board + 'block("base",["U1"]); block("main",["U1.1"]); block("second",["U2"]);',
            circuit: { components: [component('U1'), component('U1.1'), component('U2')] } },
        groups: { maybe_blocks: ['U1.1 U2'], wires: [{ net: 'SIG', pins: 'U1.1.1 U2.1' }] },
        backendGroups: { groups: [{ components: ['U1.1', 'U2'] }], wireIslands: [{ net: 'SIG',
            pins: [{ designator: 'U1.1', pin_number: '1' }, { designator: 'U2', pin_number: '1' }] }] },
        finding: 'PCB_SCHEMATIC_GROUP_MISMATCH', severity: 'info' },
    { name: 'unresolved group is dropped without shrinking it', input: base,
        groups: { maybe_blocks: ['U1 UNKNOWN.1'], wires: [] }, backendGroups: { groups: [], incomplete: true },
        finding: 'PCB_SCHEMATIC_GROUP_COVERAGE', severity: 'info' },
    { name: 'unexpected editor contract stays on EasyEDA side', input: base,
        groups: { changed_field: ['U1'] }, backendGroups: { groups: [], incomplete: true },
        finding: 'PCB_SCHEMATIC_GROUP_COVERAGE', severity: 'info' },
    { name: 'unknown wire pin drops the island and marks incomplete evidence', input: base,
        groups: { maybe_blocks: [], wires: [{ net: 'SIG', pins: 'U1.1 U1.99' }] }, backendGroups: { groups: [], incomplete: true },
        finding: 'PCB_SCHEMATIC_GROUP_COVERAGE', severity: 'info' },
    { name: 'ambiguous wire reference is not split heuristically',
        input: { code: board + 'block("main",["U1","U1.1"]);', circuit: { components: [
            { ...component('U1'), pins: [{ pin_number: '1.1', name: 'SIG', signal_name: 'SIG' }] }, component('U1.1'),
        ] } },
        groups: { maybe_blocks: [], wires: [{ net: 'SIG', pins: 'U1.1.1 U1.1.1' }] }, backendGroups: { groups: [], incomplete: true },
        finding: 'PCB_SCHEMATIC_GROUP_COVERAGE', severity: 'info' },
    { name: 'wire ownership discrepancy',
        input: { code: board + 'block("one",["U1","C1"]); block("two",["U2"]); bypass(["C1"],pin("U2",1));',
            circuit: { components: [
                { ...component('U1'), pins: [{ pin_number: 1, name: 'VDD', signal_name: 'v' }, { pin_number: 2, name: 'GND', signal_name: 'g' }] },
                { ...component('U2'), pins: [{ pin_number: 1, name: 'VDD', signal_name: 'v' }, { pin_number: 2, name: 'GND', signal_name: 'g' }] },
                { ...component('C1'), pins: [{ pin_number: 1, name: '1', signal_name: 'v' }, { pin_number: 2, name: '2', signal_name: 'g' }] },
            ] } },
        groups: { maybe_blocks: [], wires: [{ net: 'v', pins: 'U1.1 C1.1' }] },
        backendGroups: { groups: [], wireIslands: [{ net: 'v', pins: [{ designator: 'C1', pin_number: 1 }, { designator: 'U1', pin_number: 1 }] }] },
        finding: 'PCB_SCHEMATIC_WIRE_OWNER_MISMATCH', severity: 'info' },
];
let activeInput = base, activeGroups = { maybe_blocks: [], wires: [] }, groupReadFails = false, requests = [], editor, daemon;
const selectCase = item => {
    activeInput = item.input; activeGroups = item.groups ?? { maybe_blocks: [], wires: [] };
    groupReadFails = !!item.groupReadFails; requests = [];
};
const expectedCase = item => diagnostics(item.input, item.groupReadFails
    ? { groups: [], incomplete: true } : item.backendGroups);
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
                    } else if (event === 'get-schematic-groups') {
                        assert.equal(requests.at(-2), 'get-multi-page-schematic', 'Read group context after circuit extraction');
                        assert.equal(body.get_full_schematic_groups, true, 'Always read every schematic page without an LLM flag');
                        if (groupReadFails) {
                            editor.send(JSON.stringify({ event, body: JSON.stringify({ id: body.id, ok: false, error: 'Group extraction failed' }) }));
                            return;
                        }
                        result = activeGroups;
                    } else throw new Error(`Unexpected editor event: ${event}`);
                }
                editor.send(JSON.stringify({ event, body: JSON.stringify({ id: body.id, ok: true, result }) }));
            } catch (error) { clearTimeout(deadline); reject(error); editor.close(); }
        });
    });
}
function assertReads() {
    assert.deepEqual(requests, ['get-command-target', 'get-pcb-existing-placement', 'get-multi-page-schematic', 'get-schematic-groups'],
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
    for (const item of cases) {
        const { name, input, finding, severity, noConnectorWarning } = item;
        selectCase(item);
        await writeFile(file, input.code);
        const expected = expectedCase(item);
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
    for (const item of cases) {
        const { name, input } = item;
        selectCase(item);
        await writeFile(file, input.code);
        assert.deepEqual(await json(daemon, 'call', tool.name, '--input', inputFile), expectedCase(item), `${name}: CLI parity`);
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
