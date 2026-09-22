import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { once } from 'node:events';
import { createServer as netServer } from 'node:net';
import { WebSocket } from 'ws';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(join(root, '.test-data'), { recursive: true });
const temp = await mkdtemp(join(root, '.test-data/cancellation-'));
await build({ stdin: { contents: `
export { startBridge, ProxyBridge } from './bridge/index';
export { createServer } from './server';
export { TIMEOUT_POLICY } from '../../shared/timeout-policy';
export { OperationManager } from './operations/manager';
export { withExecutionSignal, currentSignal, abortable, withTarget } from './operations/cancellation';
`, resolveDir: join(root, 'src'), loader: 'ts' }, outfile: join(temp, 'runtime.mjs'),
    bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    external: ['find-up', 'ws', 'sharp', 'eda-copilot-router', 'eda-copilot-backend'],
    plugins: [{ name: 'sdk-imports', setup(b) {
        b.onResolve({ filter: /^@modelcontextprotocol\/sdk\/server\/mcp$/ }, a => ({ path: require.resolve(a.path + '.js') }));
    } }],
});
const { TIMEOUT_POLICY, startBridge, ProxyBridge, createServer, OperationManager, withExecutionSignal, currentSignal, abortable, withTarget } =
    await import(pathToFileURL(join(temp, 'runtime.mjs')));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(r => setImmediate(r));
const watchdog = setTimeout(() => { console.error('Cancellation test timed out'); process.exit(1); }, 15000);
const probe = netServer().listen(0, '127.0.0.1');
await once(probe, 'listening'); const port = probe.address().port;
await new Promise(r => probe.close(r));
const bridge = await startBridge({ host: '127.0.0.1', port });
const editor = new WebSocket(`ws://127.0.0.1:${port}`);
const ready = deferred(); const arrivals = [];
let arrival = deferred(), cancelled = deferred();
editor.on('message', raw => {
    const { event, body: encoded } = JSON.parse(raw);
    const body = JSON.parse(encoded || '{}');
    const send = (event, body) => editor.send(JSON.stringify({ event, body: JSON.stringify(body) }));
    if (event === 'connected') { send('easyeda:hello', { instanceId: 'fixture' }); send('ping', {}); }
    else if (event === 'pong') ready.resolve();
    else if (event === 'get-command-target') send(event, { id: body.id, ok: true, result: { documentUuid: 'board-fixture' } });
    else if (event === 'cancel-command') cancelled.resolve(body.id);
    else { arrivals.push(body); arrival.resolve(body); }
});
const server = createServer(bridge);
const client = new Client({ name: 'cancellation-test', version: '1' });
const [ct, st] = InMemoryTransport.createLinkedPair();
let proxy;
let otherEditor;
try {
    await ready.promise;
    await server.connect(st); await client.connect(ct);
    const controller = new AbortController();
    const call = client.callTool({ name: 'get_all_projects', arguments: {} }, undefined, { signal: controller.signal });
    const failure = assert.rejects(call);
    const request = await arrival.promise;
    controller.abort(new Error('test cancellation')); await failure;
    assert.equal(await cancelled.promise, request.id);
    console.log('PASS actual MCP client abort reaches editor through owner');
    arrival = deferred(); cancelled = deferred();
    const timedOut = assert.rejects(client.callTool({ name: 'get_all_projects', arguments: {} }, undefined, { timeout: 100 }), /timed out/i);
    const timedRequest = await arrival.promise;
    await timedOut;
    assert.equal(await cancelled.promise, timedRequest.id);
    console.log('PASS MCP client timeout also forwards cancellation');
    proxy = new ProxyBridge(`ws://127.0.0.1:${port}`); await proxy.connect();
    arrival = deferred(); cancelled = deferred();
    const c = new AbortController();
    const failure2 = assert.rejects(proxy.requestEasyEda('get-all-projects', {}, 1000, 'fixture', c.signal), /cancel/);
    const forwarded = await arrival.promise;
    c.abort(new Error('proxy cancelled')); await failure2;
    assert.equal(await cancelled.promise, forwarded.id);
    console.log('PASS proxy forwards cancellation to the matching editor request');
    const before = arrivals.length;
    await assert.rejects(bridge.requestEasyEda('get-all-projects', {}, 1000, c.signal));
    await tick(); assert.equal(arrivals.length, before);
    console.log('PASS pre-cancelled request is never sent');
    const catalog = (await client.listTools()).tools;
    const expectedTools = [
        'component_search', 'get_all_projects', 'get_current_project_info', 'get_schematic',
        'get_schematic_groups', 'get_pcb_component_sizes', 'get_pcb_stack_layers', 'get_pcb_drc_rules',
        'check_pcb_drc', 'preview_pcb', 'inspect_net', 'inspect_component', 'get_current_pcb',
        'list_checkpoints', 'list_easyeda_instances', 'list_operations', 'wait_operation', 'make_pcb_layout',
        'run_pcb_router_dsl', 'cancel_operation', 'apply_operation', 'select_easyeda_instance', 'open_document',
        'save_doc', 'sync_current_document', 'modify_name', 'create_doc', 'delete_doc', 'import_pcb_changes',
        'extract_circuit_on_current_page', 'beautify_schematic_on_current_page',
        'assemble_pcb_layout_on_current_pcbdoc', 'annotate_designators', 'save_checkpoint_for_current_page',
        'restore_checkpoint_for_current_page', 'execute_js',
    ];
    assert.deepEqual(catalog.map(t => t.name).sort(), expectedTools.sort());
    const readOnly = new Set([
        'component_search', 'get_all_projects', 'get_current_project_info', 'get_schematic',
        'get_schematic_groups', 'get_pcb_component_sizes', 'get_pcb_stack_layers', 'get_pcb_drc_rules',
        'check_pcb_drc', 'preview_pcb', 'inspect_net', 'inspect_component', 'get_current_pcb',
        'list_checkpoints', 'list_easyeda_instances', 'list_operations', 'wait_operation', 'make_pcb_layout',
        'save_checkpoint_for_current_page',
    ]);
    const nonDestructiveMutations = new Set([
        'cancel_operation', 'select_easyeda_instance', 'open_document', 'save_doc',
        'sync_current_document', 'create_doc',
    ]);
    const nonIdempotentReads = new Set(['make_pcb_layout', 'save_checkpoint_for_current_page']);
    const idempotentMutations = new Set([
        'cancel_operation', 'select_easyeda_instance', 'open_document', 'save_doc',
        'sync_current_document', 'modify_name',
    ]);
    for (const tool of catalog) {
        assert.deepEqual(tool.annotations, {
            readOnlyHint: readOnly.has(tool.name),
            destructiveHint: !readOnly.has(tool.name) && !nonDestructiveMutations.has(tool.name),
            idempotentHint: readOnly.has(tool.name)
                ? !nonIdempotentReads.has(tool.name)
                : idempotentMutations.has(tool.name),
            openWorldHint: tool.name === 'component_search' || tool.name === 'execute_js',
        }, tool.name);
    }
    assert.equal(catalog.find(t => t.name === 'execute_js').annotations.openWorldHint, true);
    assert.deepEqual(
        catalog.filter(t => t.description.includes('Runs as a managed operation')).map(t => t.name).sort(),
        [
            'annotate_designators', 'assemble_pcb_layout_on_current_pcbdoc',
            'beautify_schematic_on_current_page', 'execute_js', 'extract_circuit_on_current_page',
        ].sort(),
    );
    const circuitSchema = catalog.find(t => t.name === 'extract_circuit_on_current_page').inputSchema.properties;
    assert.deepEqual(circuitSchema.add_components.default, []);
    assert.deepEqual(circuitSchema.add_reused_blocks.default, []);
    assert.equal(circuitSchema.rm_components.default, null);
    assert.equal(circuitSchema.external_rm_connect.default, null);
    assert.equal(circuitSchema.external_connect.default, null);
    console.log('PASS every exposed tool has explicit effect annotations');
    const unpack = response => JSON.parse(response.content[0].text);
    const operationsBeforeCheckpoints = unpack(await client.callTool({ name: 'list_operations', arguments: {} })).operations;
    for (const [name, event] of [
        ['save_checkpoint_for_current_page', 'checkpoint-save'],
        ['restore_checkpoint_for_current_page', 'checkpoint-restore'],
    ]) {
        arrival = deferred();
        assert.ok(!catalog.find(t => t.name === name).description.includes('Runs as a managed operation'));
        const call = client.callTool({ name, arguments: {} });
        const request = await arrival.promise;
        editor.send(JSON.stringify({ event, body: JSON.stringify({ id: request.id, ok: true, result: { checkpointId: 'direct' } }) }));
        assert.deepEqual(unpack(await call), { checkpointId: 'direct' });
    }
    assert.deepEqual(unpack(await client.callTool({ name: 'list_operations', arguments: {} })).operations, operationsBeforeCheckpoints);
    console.log('PASS checkpoint save and restore return directly without creating operations');
    arrival = deferred();
    const initial = new AbortController();
    const lost = client.callTool({ name: 'annotate_designators', arguments: {} }, undefined, { signal: initial.signal });
    const lostFailure = assert.rejects(lost);
    const checkpointRequest = await arrival.promise;
    initial.abort(new Error('initial wait cancelled')); await lostFailure;
    const listed = unpack(await client.callTool({ name: 'list_operations', arguments: {} })).operations;
    const discovered = listed.find(op => op.tool === 'annotate_designators' && op.status === 'running');
    assert.ok(discovered);
    assert.deepEqual(discovered.target, { instanceId: 'fixture', documentUuid: 'board-fixture' });
    assert.equal(checkpointRequest.__easyedaCopilotDocumentUuid, 'board-fixture');
    editor.send(JSON.stringify({ event: 'annotate-designators', body: JSON.stringify({ id: checkpointRequest.id, ok: true, result: { checkpointId: 'saved' } }) }));
    const finished = unpack(await client.callTool({ name: 'wait_operation', arguments: { operation_id: discovered.operation_id, wait_ms: 1000 } }));
    assert.equal(finished.checkpointId, 'saved');
    assert.equal(finished.operation_id, discovered.operation_id);
    console.log('PASS lost initial mutation wait is discoverable and preserves checkpointId');
    const originalWait = TIMEOUT_POLICY.mutationWaitMs;
    TIMEOUT_POLICY.mutationWaitMs = 5;
    try {
        arrival = deferred();
        const call = client.callTool({ name: 'annotate_designators', arguments: {} });
        const request = await arrival.promise;
        const pending = unpack(await call);
        assert.equal(pending.status, 'running');
        editor.send(JSON.stringify({ event: 'annotate-designators', body: JSON.stringify({ id: request.id, ok: true, result: { checkpointId: 'later' } }) }));
        const completed = unpack(await client.callTool({ name: 'wait_operation', arguments: { operation_id: pending.operation_id, wait_ms: 1000 } }));
        assert.equal(completed.checkpointId, 'later');
    } finally { TIMEOUT_POLICY.mutationWaitMs = originalWait; }
    console.log('PASS bounded mutation wait returns an operation and later its original result');

    const manager = new OperationManager(); const parent = new AbortController();
    const routeFinished = deferred(), applied = deferred(), started = deferred();
    let operationSignal;
    arrival = deferred();
    const id = withExecutionSignal(parent.signal, () => manager.start('pcb-dsl', async context => {
        operationSignal = currentSignal(); started.resolve();
        await routeFinished.promise;
        context.setApplyHandler(async () => {
            assert.equal(currentSignal(), operationSignal);
            assert.equal(currentSignal().aborted, false);
            await applied.promise;
            return bridge.requestEasyEda('apply-routing-result', {});
        });
        return context.applyResult();
    }));
    await started.promise;
    const stoppedWaiting = assert.rejects(withExecutionSignal(parent.signal, () => manager.wait(id, 1000)), /stop waiting/);
    parent.abort(new Error('stop waiting')); await stoppedWaiting;
    assert.equal(operationSignal.aborted, false);
    assert.throws(() => withExecutionSignal(parent.signal, () => manager.start('pcb-dsl', async () => {})), /stop waiting/);
    routeFinished.resolve(); await tick();
    assert.equal((await manager.wait(id, 1)).status, 'running');
    applied.resolve();
    const application = await arrival.promise;
    assert.ok(application.__easyedaCopilotDeadlineAt - Date.now() > 299_000, 'application gets its own full 300-second budget');
    editor.send(JSON.stringify({ event: 'apply-routing-result', body: JSON.stringify({ id: application.id, ok: true, result: { applied: true } }) }));
    assert.deepEqual(await manager.wait(id, 1000), { applied: true });
    console.log('PASS cancelled wait leaves routing and later application alive');
    const running = deferred();
    const id2 = manager.start('pcb-dsl', async () => {
        const signal = currentSignal(); running.resolve();
        return abortable(new Promise(() => {}), signal);
    });
    await running.promise; await manager.cancel(id2);
    await assert.rejects(manager.wait(id2, 1000), /cancel/);
    console.log('PASS cancel_operation aborts operation work');
    arrival = deferred(); cancelled = deferred();
    const applyingId = manager.start('pcb-dsl', async context => {
        context.setApplyHandler(() => bridge.requestEasyEda('apply-routing-result', {}));
        return context.applyResult();
    });
    const applying = await arrival.promise;
    await manager.cancel(applyingId);
    assert.equal(await cancelled.promise, applying.id);
    await assert.rejects(manager.wait(applyingId, 1000), /cancel/i);
    console.log('PASS cancel_operation reaches active routing application');
    const otherReady = deferred();
    let wrongWindowRequests = 0;
    otherEditor = new WebSocket(`ws://127.0.0.1:${port}`);
    otherEditor.on('message', raw => {
        const message = JSON.parse(raw);
        if (message.event === 'connected') {
            otherEditor.send(JSON.stringify({ event: 'easyeda:hello', body: JSON.stringify({ instanceId: 'other' }) }));
            otherEditor.send(JSON.stringify({ event: 'ping', body: '{}' }));
        } else if (message.event === 'pong') otherReady.resolve();
        else wrongWindowRequests++;
    });
    await otherReady.promise;
    const routingGate = deferred();
    const pinnedId = withTarget({ instanceId: 'fixture', documentUuid: 'board-fixture' }, () => manager.start('pcb-dsl', async context => {
        await routingGate.promise;
        context.setApplyHandler(() => bridge.requestEasyEda('apply-routing-result', {}));
        return context.applyResult();
    }));
    await bridge.selectEasyEdaInstance('other');
    arrival = deferred();
    routingGate.resolve();
    const pinned = await arrival.promise;
    assert.equal(pinned.__easyedaCopilotDocumentUuid, 'board-fixture');
    editor.send(JSON.stringify({ event: 'apply-routing-result', body: JSON.stringify({ id: pinned.id, ok: true, result: { applied: true } }) }));
    await manager.wait(pinnedId, 1000);
    assert.equal(wrongWindowRequests, 0);
    assert.deepEqual(manager.list().find(op => op.operation_id === pinnedId).target, { instanceId: 'fixture', documentUuid: 'board-fixture' });
    console.log('PASS routing application stays pinned when the selected window changes');

} finally {
    otherEditor?.terminate();
    editor.terminate(); await proxy?.close();
    await client.close(); await server.close(); await bridge.close();
    clearTimeout(watchdog);
}
