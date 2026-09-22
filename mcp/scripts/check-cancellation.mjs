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
export { OperationManager } from './operations/manager';
export { withExecutionSignal, currentSignal, abortable } from './operations/cancellation';
`, resolveDir: join(root, 'src'), loader: 'ts' }, outfile: join(temp, 'runtime.mjs'),
    bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    external: ['find-up', 'ws', 'sharp', 'eda-copilot-router', 'eda-copilot-backend'],
    plugins: [{ name: 'sdk-imports', setup(b) {
        b.onResolve({ filter: /^@modelcontextprotocol\/sdk\/server\/mcp$/ }, a => ({ path: require.resolve(a.path + '.js') }));
    } }],
});
const { startBridge, ProxyBridge, createServer, OperationManager, withExecutionSignal, currentSignal, abortable } =
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
    else if (event === 'cancel-command') cancelled.resolve(body.id);
    else { arrivals.push(body); arrival.resolve(body); }
});
const server = createServer(bridge);
const client = new Client({ name: 'cancellation-test', version: '1' });
const [ct, st] = InMemoryTransport.createLinkedPair();
let proxy;
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
} finally {
    editor.terminate(); await proxy?.close();
    await client.close(); await server.close(); await bridge.close();
    clearTimeout(watchdog);
}
