import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { buildSync } from 'esbuild';
import PQueue from 'p-queue';
import { CheckpointScopes } from '../src/eda/checkpoint-scopes';
import { withTimeout } from '../src/timeout';

const src = join(__dirname, '../src');
const runtime = buildSync({
    stdin: {
        contents: readFileSync(join(src, 'mcp-client.ts'), 'utf8')
            + '\nexport const testQueue = { state, queue: mcpCommandQueue, run: handleQueuedMcpMessage };',
        loader: 'ts', resolveDir: src,
    },
    bundle: true, write: false, platform: 'node', format: 'cjs',
    external: ['./eda/*', '@copilot/shared/types/eda', 'p-queue'],
}).outputFiles[0].text;

function fixture(save: () => Promise<string>) {
    const replies: any[] = [];
    const module = { exports: {} as any };
    runInNewContext(runtime, {
        module, exports: module.exports, setTimeout, clearTimeout, AbortController,
        ESCH_PrimitiveComponentType: {}, ESYS_LogType: {},
        eda: {
            sys_Log: { add() {} },
            sys_WebSocket: { send(_id: string, value: string) { replies.push(JSON.parse(JSON.parse(value).body)); } },
        },
        require(id: string) {
            if (id === 'p-queue') return PQueue;
            if (id === './eda/checkpoint-scopes') return { CheckpointScopes };
            if (id === './eda/checkpointer') return { checkpointer: { save } };
            if (id === './eda/utils') return { withTimeout };
            if (id === './eda/mcp-document-context') return { assertMcpDocumentContext: async () => {} };
            return {};
        },
    });
    const { state, queue, run } = module.exports.testQueue;
    state.isRegistered = true;
    const enqueue = (id: string, deadline = Date.now() + 1000) => queue.add(() => run({
        event: 'checkpoint-save', body: JSON.stringify({ id, __easyedaCopilotDeadlineAt: deadline }),
    }, state.connectionEpoch));
    return { enqueue, replies, state };
}

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

test('actual MCP handler never starts a request whose deadline expired in the queue', async () => {
    let calls = 0;
    const f = fixture(async () => { calls++; return 'checkpoint'; });
    await f.enqueue('expired', Date.now() - 1);
    assert.equal(calls, 0);
    assert.match(f.replies[0].error, /expired before execution/);
});
