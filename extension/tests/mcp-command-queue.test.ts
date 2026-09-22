import assert from 'node:assert/strict';
import test from 'node:test';
import { McpCommandQueue } from '../src/mcp-command-queue';

test('clearing waiting commands settles them without running or releasing active work', async () => {
    const queue = new McpCommandQueue();
    let release!: () => void;
    const first = queue.add(() => new Promise<void>(resolve => { release = resolve; }));
    await new Promise(resolve => setImmediate(resolve));
    let calls = 0;
    const waiting = queue.add(async () => { calls++; });
    queue.clear();
    await waiting;
    assert.equal(queue.size, 0);
    assert.equal(calls, 0);
    const next = queue.add(async () => { calls++; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 0);
    release(); await Promise.all([first, next]);
    assert.equal(calls, 1);
});

test('pre-cancelled tasks do not run and a failed task does not stall the queue', async () => {
    const queue = new McpCommandQueue();
    const controller = new AbortController();
    controller.abort();
    await queue.add(async () => { assert.fail('cancelled task ran'); }, { signal: controller.signal });
    const first = queue.add(async () => { throw new Error('failure'); });
    const failure = assert.rejects(first, /failure/);
    let next = false;
    await queue.add(async () => { next = true; });
    await failure;
    assert.equal(next, true);
});
