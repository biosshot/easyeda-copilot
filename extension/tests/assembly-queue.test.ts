import assert from 'node:assert/strict';
import test from 'node:test';
import PQueue from 'p-queue';
import { ASSEMBLY_QUEUE_TIMEOUT_MS, runAssemblyQueueTask } from '../src/eda/assembly-queue';

test('assembly queues use the 120-second production timeout', () => {
    assert.equal(ASSEMBLY_QUEUE_TIMEOUT_MS, 120_000);
});

test('a timed-out assembly releases the queue and cannot start a later stage', async () => {
    const queue = new PQueue({ concurrency: 1 });
    let resume!: () => void;
    let lateMutationStarted = false;
    const first = runAssemblyQueueTask(queue, 'PCB', undefined, async signal => {
        await new Promise<void>(resolve => { resume = resolve; });
        signal.throwIfAborted();
        lateMutationStarted = true;
    }, 20);
    const second = runAssemblyQueueTask(queue, 'PCB', undefined, async () => 'next', 1000);

    await assert.rejects(first, /timed out after 0.02 seconds/);
    assert.equal(await second, 'next');
    resume();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(lateMutationStarted, false);
});
