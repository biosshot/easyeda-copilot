// Exercise the production owner/proxy protocol with disposable editor fixtures, never the live board.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import { connect, listInstances } from '../dist/lib/node/index.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(join(root, '.test-data'), { recursive: true });
const temp = await mkdtemp(join(root, '.test-data/sdk-broker-'));
await build({ entryPoints: { bridge: join(root, 'src/bridge/index.ts'), executor: join(root, '../extension/src/eda/checkpoint-scopes.ts') },
    outdir: temp, outExtension: { '.js': '.mjs' }, bundle: true, platform: 'node', format: 'esm', external: ['ws'], logLevel: 'silent' });
const { startBridge } = await import(pathToFileURL(join(temp, 'bridge.mjs')));
const { CheckpointScopes } = await import(pathToFileURL(join(temp, 'executor.mjs')));
const probe = createServer().listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const url = `ws://127.0.0.1:${port}`;
const owner = await startBridge({ host: '127.0.0.1', port });
const sessions = [], editors = [];
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
const open = async (id, options = {}) => { const s = await connect({ url, instanceId: id, ...options }); sessions.push(s); return s; };
async function editor(id) {
    const socket = new WebSocket(url);
    const state = { id, writes: 0, executions: 0, saves:0, delayed: 0, drop: false, socket };
    const scopes=new CheckpointScopes({save:async()=>`cp-${id}-${++state.saves}`,pin:()=>{},unpin:()=>{}});
    const api = { dmt_SelectControl: { getCurrentDocumentInfo: () => ({ uuid: `board-${id}` }) },
        test: { read: () => id, write: async () => { await delay(state.delayed); return ++state.writes; }, echo: x => x } };
    let queue = Promise.resolve();
    let ready;
    const handshake = new Promise(resolve => { ready = resolve; });
    socket.on('message', raw => {
        const { event, body: encoded } = JSON.parse(raw);
        const send = (event, body) => { if (socket.readyState === 1) socket.send(JSON.stringify({ event, body: JSON.stringify(body) })); };
        if (event === 'connected') {
            send('easyeda:hello', { instanceId: id, projectName: id }); send('ping', {});
        } else if (event === 'pong') ready();
        else if (event === 'execute-js') {
            const body = JSON.parse(encoded);
            queue = queue.then(async () => {
                state.executions++;
                const result = await scopes.execute(body, api, 1);
                if (state.drop) { state.drop = false; socket.terminate(); return; }
                send(event, { id: body.id, ok: true, result });
            });
        }
    });
    editors.push(state);
    await Promise.race([handshake, delay(3000).then(() => { throw Error('Editor handshake timeout'); })]);
    return state;
}
try {
    const a = await editor('A'), b = await editor('B');
    await test('real owner requires explicit selection for multiple editors', async () => {
        assert.equal((await listInstances({ url })).length, 2);
        await assert.rejects(connect({ url }), /Select a connected/);
    });
    const sA = await open('A'), sB = await open('B');
    await test('simultaneous clients route to their own editor and preserve request IDs', async () => {
        const results = await Promise.all(Array.from({ length: 100 }, (_, i) => (i % 2 ? sA : sB).eda.test.echo({ i })));
        assert.deepEqual(results, Array.from({ length: 100 }, (_, i) => ({ i })));
        assert.deepEqual(await Promise.all([sA.eda.test.read(), sB.eda.test.read()]), ['A', 'B']);
    });
    await test('repeated SDK connection/close does not remove editors or the owner', async () => {
        for (let i = 0; i < 30; i++) {
            const s = await open('A');
            assert.equal(await s.eda.test.read(), 'A');
            await s.close();
        }
        assert.equal((await listInstances({ url })).length, 2);
        assert.equal(await sB.eda.test.read(), 'B');
    });
    await test('ten concurrent sessions each batch 100 ordered writes exactly once', async () => {
        const clients = await Promise.all(Array.from({ length: 10 }, () => open('B')));
        const before = b.writes;
        const results = await Promise.all(clients.map(s => Promise.all(Array.from({ length: 100 }, () => s.eda.test.write()))));
        assert.equal(b.writes - before, 1000);
        assert.equal(new Set(results.flat()).size, 1000);
        await Promise.all(clients.map(s => s.close()));
    });
    await test('production timeout leaves a running mutation alive and never retries it', async () => {
        const s = await open('A', { timeoutMs: 30 });
        const before = a.writes;
        a.delayed = 120;
        await assert.rejects(Promise.resolve(s.eda.test.write()), e => e.outcomeUnknown === true);
        await delay(160);
        a.delayed = 0;
        assert.equal(a.writes - before, 1);
        await assert.rejects(Promise.resolve(s.eda.test.write()), /closed or disconnected/);
        await s.close();
        assert.equal(await sB.eda.test.read(), 'B');
    });
    await test('production broker forwards checkpoint scopes without leaking between clients',async()=>{
        const before=a.saves;
        await sA.checkpointScope('A edits',async scope=>{
            await scope.eda.test.write();await scope.eda.test.write();
            assert.equal(sA.lastCheckpoint,scope.checkpointId);
            await sB.eda.test.write();
            assert.notEqual(sB.lastCheckpoint,scope.checkpointId);
        });
        assert.equal(a.saves-before,1);
    });
    await test('lost reply after mutation is reported as unknown, without replay on reconnect', async () => {
        const s = await open('A');
        const before = a.writes;
        a.drop = true;
        await assert.rejects(Promise.resolve(s.eda.test.write()), e => e.outcomeUnknown === true);
        assert.equal(a.writes - before, 1);
        await s.close();
        const replacement = await editor('A');
        const fresh = await open('A');
        assert.equal(await fresh.eda.test.read(), 'A');
        assert.equal(replacement.writes, 0);
    });
    await test('owner shutdown never promotes an SDK connection to owner', async () => {
        await owner.close();
        await assert.rejects(Promise.resolve(sB.eda.test.read()));
        await delay(1200);
        const listener = createServer().listen(port, '127.0.0.1');
        await once(listener, 'listening');
        await new Promise(resolve => listener.close(resolve));
        await assert.rejects(listInstances({ url }));
    });
    await test('a rejected proxy handshake releases the client socket', async () => {
        const rejecting = new WebSocketServer({ host: '127.0.0.1', port });
        await once(rejecting, 'listening');
        rejecting.on('connection', socket => socket.on('message', () => socket.send(JSON.stringify({ event: 'proxy:hello:result', body: '{"ok":false}' }))));
        try { await assert.rejects(listInstances({ url }), /rejected proxy handshake/); await delay(30); assert.equal(rejecting.clients.size, 0); }
        finally { for (const socket of rejecting.clients) socket.terminate(); await new Promise(resolve => rejecting.close(resolve)); }
    });
} finally {
    for (const e of editors) e.socket.terminate();
    await owner.close();
    await Promise.all(sessions.map(s => s.close().catch(() => undefined)));
    delete globalThis.__easyedaCopilotLocalSdkV1;
}
console.log(`Production broker + local SDK: ${passed} checks passed.`);
