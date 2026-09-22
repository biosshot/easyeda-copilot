import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { WebSocket } from 'ws';

const execute = promisify(execFile);
const entry = resolve(process.argv[2] ?? fileURLToPath(new URL('../dist/cli.js', import.meta.url)));
const stdioEntry = resolve(process.argv[3] ?? join(dirname(entry), 'index.js'));
const directory = await mkdtemp(join(tmpdir(), 'easyeda-cli-test-'));
const fixtureSource = new URL('../tests/fixtures/api-fixtures.mjs', import.meta.url);
const { schematicInput, FOOTPRINT_UUID } = await import(fixtureSource.href);
const fixture = join(directory, 'fixture.mjs');
await writeFile(fixture, await readFile(fixtureSource, 'utf8') + '\ninstallEasyEdaFixture();\n');
const probe = createServer().listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
await new Promise(resolveClose => probe.close(resolveClose));
const env = { ...process.env, EASYEDA_COPILOT_CLI_HOME: join(directory, 'state'), EASYEDA_COPILOT_MCP_WS_PORT: String(port), EDA_BACKEND_LOG_LEVEL: 'silent',
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${pathToFileURL(fixture).href}` };
const run = (...args) => execute(process.execPath, [entry, ...args], { env, cwd: directory, windowsHide: true, timeout: 40_000, maxBuffer: 4 * 1024 * 1024 });
const json = async (...args) => JSON.parse((await run(...args)).stdout);
const input = (value) => ['--json', JSON.stringify(value)];
const daemons = [];
const editors = [];
const assemblies = [];
const cancelledRequests = new Set();
let releaseSnapshot;
let heldSnapshot;
let holdProject;
let releaseProject;
let holdMutation;
let releaseMutation;
const client = new Client({ name: 'cli-regression', version: '1.0.0' });
let connected = false;

async function editor(instanceId) {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    editors.push(socket);
    await new Promise((ready, reject) => {
        const deadline = setTimeout(() => reject(new Error('Editor handshake timeout')), 5000);
        socket.once('error', reject);
        socket.on('message', async bytes => {
            const { event, body: encoded } = JSON.parse(bytes.toString());
            if (event === 'connected') {
                socket.send(JSON.stringify({ event: 'easyeda:hello', body: JSON.stringify({ instanceId, projectName: instanceId }) }));
                socket.send(JSON.stringify({ event: 'ping', body: '{}' }));
                return;
            }
            if (event === 'pong') { clearTimeout(deadline); ready(); return; }
            const body = JSON.parse(encoded);
            if (event === 'cancel-command') { cancelledRequests.add(body.id); return; }
            let result;
            if (event === 'get-command-target') result = { documentUuid: `board-${instanceId}` };
            else if (event === 'get-current-project-info') { await holdProject; result = { project_name: instanceId }; }
            else if (event === 'annotate-designators') { await holdMutation; result = { changed: 2, checkpoints: [] }; }
            else if (event === 'get-pcb-existing-placement') result = null;
            else if (event === 'get-multi-page-schematic') { await heldSnapshot; result = {
                components: schematicInput.circuit.add_components.map(component => ({ ...component, footprint_uuid: FOOTPRINT_UUID })),
            }; }
            else if (event === 'assemble-board') { assemblies.push(body.boardAssemble); result = { assembled: true, checkpointId: 'assembly-checkpoint' }; }
            else throw new Error(`Unexpected fixture event: ${event}`);
            if (!cancelledRequests.has(body.id) && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ event, body: JSON.stringify({ id: body.id, ok: true, result }) }));
        });
    });
}

try {
    const starts = await Promise.all([run('start'), run('start')]);
    daemons.push(...starts.map(result => result.stdout.trim()));
    const [a, b] = daemons;
    assert.match(a, /^[a-z0-9]{4}$/);
    assert.match(b, /^[a-z0-9]{4}$/);
    assert.notEqual(a, b);
    await editor('window-a');
    await editor('window-b');
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [stdioEntry], env, stderr: 'pipe' }));
    connected = true;
    const catalog = (await client.listTools()).tools;
    assert.deepEqual((await json(a, 'tools', 'list')).map(tool => tool.name), catalog.map(tool => tool.name));
    for (const name of ['make_pcb_layout', 'wait_operation', 'open_document', 'execute_js']) {
        const cliTool = await json(a, 'tools', 'help', name);
        assert.deepEqual(cliTool.inputSchema, catalog.find(tool => tool.name === name).inputSchema);
    }
    assert.equal((await json(a, 'call', 'list_easyeda_instances')).instances.length, 2, 'Omitted input must become {}');
    await json(a, 'call', 'select_easyeda_instance', ...input({ instanceId: 'window-a' }));
    await json(b, 'call', 'select_easyeda_instance', ...input({ instanceId: 'window-b' }));
    const cliResult = await run(a, 'call', 'get_current_project_info');
    assert.equal(JSON.parse(cliResult.stdout).project_name, 'window-a');
    assert.match(cliResult.stderr, /extension version is unknown/);
    assert.equal((await json(b, 'call', 'get_current_project_info')).project_name, 'window-b');
    const raw = await json(a, 'call', 'get_current_project_info', '--raw');
    assert.equal(raw.content[0].type, 'text');
    assert.match(raw.content[1].text, /extension version is unknown/);
    await assert.rejects(run(a, 'call', 'wait_operation'), error => error.code === 1 && /operation_id/.test(error.stdout));
    await assert.rejects(run(a, 'tools', 'help', 'does_not_exist'), /Unknown tool/);
    await assert.rejects(run(a, 'call', 'does_not_exist'), error => error.code === 1);
    await assert.rejects(run(a, 'call', 'get_current_project_info', '--json', '[]'), /JSON object/);
    await assert.rejects(run(a, 'call', 'get_current_project_info', '--json', '{}', '--input', 'other.json'), /easyeda-copilot-cli/);

    const dsl = join(directory, 'layout.js');
    await writeFile(dsl, '// Cancellation fixture: no placement should be calculated.');
    heldSnapshot = new Promise(resolveSnapshot => { releaseSnapshot = resolveSnapshot; });
    await writeFile(join(directory, 'input.json'), JSON.stringify({ file: dsl, wait_ms: 1000 }));
    const operation = await json(a, 'call', 'make_pcb_layout', '--input', 'input.json');
    assert.equal(operation.status, 'running');
    assert.equal((await json(a, 'call', 'wait_operation', ...input({ operation_id: operation.operation_id, wait_ms: 1000 }))).status, 'running');
    await assert.rejects(run(b, 'call', 'wait_operation', ...input({ operation_id: operation.operation_id })), error => /Operation not found/.test(error.stdout));
    await assert.rejects(run(a, 'stop'), /active calls or operations/);
    const cancellation = await json(a, 'call', 'cancel_operation', ...input({ operation_id: operation.operation_id }));
    assert.equal(cancellation.status, 'cancel_requested');
    releaseSnapshot();
    await assert.rejects(run(a, 'call', 'wait_operation', ...input({ operation_id: operation.operation_id, wait_ms: 1000 })), error => /cancel/i.test(error.stdout));

    heldSnapshot = undefined;
    await writeFile(dsl, 'board.rect(30, 20); block("divider", ["R1", "R2"], "generic");');
    let layout = await json(a, 'call', 'make_pcb_layout', ...input({ file: dsl, wait_ms: 1000 }));
    while (layout.status === 'running') layout = await json(a, 'call', 'wait_operation', ...input({ operation_id: layout.operation_id, wait_ms: 1000 }));
    assert.ok(layout.layoutId, JSON.stringify(layout));
    assert.deepEqual([...await readFile(layout.previewImagePath)].slice(0, 8), [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal((await json(a, 'call', 'wait_operation', ...input({ operation_id: layout.operation_id }))).layoutId, layout.layoutId);
    const assembled = await json(a, 'call', 'assemble_pcb_layout_on_current_pcbdoc', ...input({ layoutId: layout.layoutId }));
    assert.match(assembled.operation_id, /^mutation:[0-9a-f]{8}$/);
    assert.equal(assembled.checkpointId, 'assembly-checkpoint');
    assert.deepEqual(assemblies[0].components.map(component => component.designator).sort(), ['R1', 'R2']);

    holdMutation = new Promise(resolveMutation => { releaseMutation = resolveMutation; });
    const abandonedMutation = spawn(process.execPath, [entry, b, 'call', 'annotate_designators'], {
        env, cwd: directory, windowsHide: true, stdio: 'ignore',
    });
    let startedMutation;
    for (let i = 0; i < 30; i++) {
        const operations = (await json(b, 'call', 'list_operations')).operations;
        startedMutation = operations.find(operation => operation.tool === 'annotate_designators' && operation.status === 'running');
        if (startedMutation) break;
        await new Promise(wait => setTimeout(wait, 50));
    }
    assert.ok(startedMutation?.operation_id, 'Managed mutation must register before its client disconnects');
    abandonedMutation.kill();
    await once(abandonedMutation, 'exit');
    for (let i = 0; i < 30; i++) {
        if (!(await json(b, 'status')).activeCalls) break;
        await new Promise(wait => setTimeout(wait, 50));
    }
    const recoveredMutation = (await json(b, 'call', 'list_operations')).operations
        .find(operation => operation.operation_id === startedMutation.operation_id);
    assert.equal(recoveredMutation?.status, 'running', 'Registered mutation must survive cancellation of its initial wait');
    assert.equal((await json(b, 'call', 'cancel_operation', ...input({ operation_id: startedMutation.operation_id }))).status, 'cancel_requested');
    releaseMutation();
    await assert.rejects(
        run(b, 'call', 'wait_operation', ...input({ operation_id: startedMutation.operation_id, wait_ms: 1000 })),
        error => /cancel/i.test(error.stdout),
    );
    holdMutation = undefined;

    holdProject = new Promise(resolveProject => { releaseProject = resolveProject; });
    const cancellationsBeforeDisconnect = cancelledRequests.size;
    const abandoned = spawn(process.execPath, [entry, b, 'call', 'get_current_project_info'], {
        env, cwd: directory, windowsHide: true, stdio: 'ignore',
    });
    for (let i = 0; i < 30; i++) {
        if ((await json(b, 'status')).activeCalls) break;
        await new Promise(wait => setTimeout(wait, 50));
    }
    assert.equal((await json(b, 'status')).activeCalls, 1);
    abandoned.kill();
    await once(abandoned, 'exit');
    for (let i = 0; i < 30; i++) {
        if (!(await json(b, 'status')).activeCalls && cancelledRequests.size > cancellationsBeforeDisconnect) break;
        await new Promise(wait => setTimeout(wait, 50));
    }
    assert.equal((await json(b, 'status')).activeCalls, 0, 'Disconnected CLI client must release its active call');
    assert.ok(cancelledRequests.size > cancellationsBeforeDisconnect, 'Disconnected CLI client must cancel the EasyEDA request');
    releaseProject();
    holdProject = undefined;

    holdProject = new Promise(resolveProject => { releaseProject = resolveProject; });
    const pending = run(b, 'call', 'get_current_project_info');
    const outcome = pending.then(() => null, error => error);
    for (let i = 0; i < 30; i++) {
        if ((await json(b, 'status')).activeCalls) break;
        await new Promise(wait => setTimeout(wait, 50));
    }
    await assert.rejects(run(b, 'stop'), /active calls or operations/);
    await json(b, 'stop', '--force');
    assert.ok(await outcome, 'Force stop must end the waiting CLI with an error');
    releaseProject();
    holdProject = undefined;
    assert.equal((await json(a, 'call', 'get_current_project_info')).project_name, 'window-a');
    assert.equal((await client.callTool({ name: 'list_easyeda_instances', arguments: {} })).isError, undefined);
    for (const socket of editors) socket.terminate();
    await client.close();
    connected = false;
    await json(a, 'stop');
    await assert.rejects(run(a, 'status'), /unavailable|Cannot reach|disconnected/);
    console.log('CLI passed: schema parity, default {}, independent windows, files, errors, native placement/preview/assembly, retained operations, cancel, stop/force, and coexistence with stdio MCP.');
} finally {
    releaseSnapshot?.();
    releaseProject?.();
    releaseMutation?.();
    for (const socket of editors) socket.terminate();
    if (connected) await client.close();
    for (const id of daemons) await run(id, 'stop', '--force').catch(() => undefined);
}
