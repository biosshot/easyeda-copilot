import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { buildSync } from 'esbuild';
import { CheckpointScopes } from '../src/eda/checkpoint-scopes';
import { withTimeout } from '../src/timeout';

const src = join(__dirname, '../src');
const extensionVersion = JSON.parse(readFileSync(join(__dirname, '../extension.json'), 'utf8')).version;
const runtime = buildSync({
    stdin: {
        contents: readFileSync(join(src, 'mcp-client.ts'), 'utf8')
            + '\nexport const testQueue = { state, queue: mcpCommandQueue, run: handleQueuedMcpMessage, enqueue: enqueueMcpCommand, cancel: cancelMcpCommand, refreshMetadata: refreshEasyEdaMetadata };',
        loader: 'ts', resolveDir: src,
    },
    bundle: true, write: false, platform: 'node', format: 'cjs',
    external: ['./eda/*', '@copilot/shared/types/eda', 'p-queue'],
}).outputFiles[0].text;

function fixture(
    save: () => Promise<string | null>,
    assembleBoard = async () => {},
    getCurrentProjectInfo = async () => ({ friendlyName: 'Fixture project' }),
) {
    const replies: any[] = [];
    const events: any[] = [];
    const module = { exports: {} as any };
    runInNewContext(runtime, {
        module, exports: module.exports, setTimeout, clearTimeout, AbortController,
        ESCH_PrimitiveComponentType: {}, ESYS_LogType: {},
        eda: {
            sys_Log: { add() {} },
            sys_WebSocket: { send(_id: string, value: string) {
                const message = JSON.parse(value);
                const body = JSON.parse(message.body);
                events.push({ event: message.event, body });
                replies.push(body);
            } },
            dmt_Project: { getCurrentProjectInfo },
        },
        require(id: string) {
            if (id === './eda/checkpoint-scopes') return { CheckpointScopes };
            if (id === './eda/checkpointer') return { checkpointer: { save } };
            if (id === './eda/pcb-assemble') return { assembleBoard };
            if (id === './eda/utils') return { withTimeout };
            if (id === './eda/mcp-document-context') return { assertMcpDocumentContext: async () => {} };
            return {};
        },
    });
    const { state, queue, enqueue: submit, cancel, refreshMetadata } = module.exports.testQueue;
    state.isRegistered = true;
    const enqueue = (id: string, deadline = Date.now() + 1000, event = 'checkpoint-save', body = {}) => submit({
        event, body: JSON.stringify({ ...body, id, __easyedaCopilotDeadlineAt: deadline }),
    }, state.connectionEpoch);
    return {
        enqueue, replies, events, state, queue, refreshMetadata,
        cancel: (id: string) => cancel({ body: JSON.stringify({ id }) }),
    };
}

test('heartbeat metadata refresh updates the project name only when it changes', async () => {
    let projectName = 'Project A';
    const f = fixture(async () => 'checkpoint', async () => {}, async () => ({ friendlyName: projectName }));
    await f.refreshMetadata(f.state.connectionEpoch);
    assert.equal(f.events.at(-1).event, 'easyeda:hello');
    assert.equal(f.events.at(-1).body.projectName, 'Project A');
    assert.equal(f.events.at(-1).body.extensionVersion, extensionVersion);

    const sent = f.events.length;
    await f.refreshMetadata(f.state.connectionEpoch);
    assert.equal(f.events.length, sent);

    projectName = 'Project B';
    await f.refreshMetadata(f.state.connectionEpoch);
    assert.equal(f.events.at(-1).body.projectName, 'Project B');
    assert.equal(f.events.at(-1).body.instanceId, f.state.instanceId);
});

test('actual MCP handler releases its queue and suppresses the late success reply', async () => {
    let complete!: (value: string) => void;
    let calls = 0;
    const f = fixture(() => ++calls === 1 ? new Promise(resolve => { complete = resolve; }) : Promise.resolve('next'));
    const first = f.enqueue('first', Date.now() + 30);
    const second = f.enqueue('second');
    await Promise.all([first, second]);
    assert.equal(f.replies.length, 2);
    assert.equal(f.replies[0].id, 'first');
    assert.equal(f.replies[0].ok, false);
    assert.match(f.replies[0].error, /timed out/);
    assert.equal(f.replies[1].id, 'second');
    assert.equal(f.replies[1].result.checkpointId, 'next');
    complete('late');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.replies.length, 2);
});

test('a command that times out while checkpointing cannot start a late board mutation', async () => {
    let complete!: (value: string) => void;
    let mutations = 0;
    const f = fixture(
        () => new Promise(resolve => { complete = resolve; }),
        async () => { mutations++; },
    );
    await f.enqueue('assembly', Date.now() + 30, 'assemble-board', { board: {} });
    assert.equal(f.replies[0].ok, false);
    complete('late-checkpoint');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(mutations, 0);
});

test('board assembly fails closed when its checkpoint cannot be saved', async () => {
    let mutations = 0;
    const f = fixture(async () => null, async () => { mutations++; });
    await f.enqueue('assembly', Date.now() + 1000, 'assemble-board', { board: {} });
    assert.equal(f.replies[0].ok, false);
    assert.match(f.replies[0].error, /Failed to create PCB placement checkpoint/);
    assert.equal(mutations, 0);
});

test('actual MCP handler never starts a request whose deadline expired in the queue', async () => {
    let calls = 0;
    const f = fixture(async () => { calls++; return 'checkpoint'; });
    await f.enqueue('expired', Date.now() - 1);
    assert.equal(calls, 0);
    assert.match(f.replies[0].error, /expired before execution/);
});


test('cancelled queued command never starts, and another command can complete', async () => {
    let resume!: (id: string) => void;
    let calls = 0;
    const f = fixture(() => ++calls === 1 ? new Promise(resolve => { resume = resolve; }) : Promise.resolve('next'));
    const first = f.enqueue('first');
    await new Promise(resolve => setImmediate(resolve));
    const cancelled = f.enqueue('cancelled');
    const next = f.enqueue('next');
    assert.equal(f.queue.size, 2);
    f.cancel('cancelled');
    await cancelled;
    assert.equal(f.queue.size, 1);
    resume('first');
    await Promise.all([first, cancelled, next]);
    assert.equal(calls, 2);
    assert.equal(f.replies.some(reply => reply.id === 'cancelled' && reply.ok), false);
    assert.equal(f.replies.at(-1).id, 'next');
});

test('cancel during checkpoint prevents a late mutation and suppresses late success', async () => {
    let resume!: (id: string) => void;
    let mutations = 0;
    const f = fixture(() => new Promise(resolve => { resume = resolve; }), async () => { mutations++; });
    const pending = f.enqueue('cancelled', Date.now() + 1000, 'assemble-board', { board: {} });
    await new Promise(resolve => setImmediate(resolve));
    f.cancel('cancelled');
    await pending;
    resume('checkpoint');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(mutations, 0);
    assert.equal(f.replies.some(reply => reply.ok), false);
});
