import test from 'node:test';
import assert from 'node:assert/strict';
import PQueue from 'p-queue';
import { mcpCommandTimeoutMs } from '../src/mcp-command-timeout';
import { withTimeout } from '../src/timeout';

test('command budgets preserve long operations and respect the remaining transport deadline', () => {
    assert.equal(mcpCommandTimeoutMs('get-schematic'), 120_000);
    assert.equal(mcpCommandTimeoutMs('execute-js'), 60_000);
    for (const event of ['assemble-circuit', 'beautify-current-page', 'assemble-board', 'export-routing-input', 'apply-routing-result', 'check-pcb-drc', 'inspect-net', 'inspect-component', 'annotate-designators', 'import-pcb-changes', 'sync-current-document']) {
        assert.equal(mcpCommandTimeoutMs(event), 300_000);
    }
    assert.equal(mcpCommandTimeoutMs('assemble-board', 1500, 1000), 500);
    assert.equal(mcpCommandTimeoutMs('get-schematic', 1_000_000, 1000), 120_000);
    assert.equal(mcpCommandTimeoutMs('execute-js', 900, 1000), 0);
    assert.equal(mcpCommandTimeoutMs('get-schematic', NaN), 120_000);
});

test('a never-settling command releases the serial queue on timeout', async () => {
    const queue = new PQueue({ concurrency: 1 });
    let timedOutSignal: AbortSignal | undefined;
    const first = queue.add(() => withTimeout(signal => {
        timedOutSignal = signal;
        return new Promise<void>(() => {});
    }, 15));
    const failure = assert.rejects(first, /Operation timeout/);
    const second = queue.add(async () => {
        assert.equal(timedOutSignal?.aborted, true);
        return 'next command';
    });
    await failure;
    assert.equal(await second, 'next command');
    await queue.onIdle();
});

test('late failure is observed and cannot cancel the next command', async () => {
    let rejectLate!: (error: Error) => void;
    let firstSignal!: AbortSignal;
    const first = withTimeout(signal => {
        firstSignal = signal;
        return new Promise<void>((_, reject) => { rejectLate = reject; });
    }, 10);
    await assert.rejects(first, /Operation timeout/);
    await withTimeout(async signal => {
        rejectLate(new Error('late native failure'));
        await Promise.resolve();
        assert.equal(firstSignal.aborted, true);
        assert.equal(signal.aborted, false);
    }, 1000);
});

test('expired or aborted commands never start; successful calls clear their timer', async () => {
    let started = false;
    const action = async () => { started = true; };
    await assert.rejects(withTimeout(action, 0), /Operation timeout/);
    const controller = new AbortController();
    controller.abort(new Error('parent expired'));
    await assert.rejects(withTimeout(action, 1000, undefined, controller.signal), /parent expired/);
    assert.equal(started, false);
    let completedSignal!: AbortSignal;
    assert.equal(await withTimeout(async signal => {
        completedSignal = signal;
        return 42;
    }, 10), 42);
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(completedSignal.aborted, false);
});

test('existing Promise calls retain results, rejections and custom timeout messages', async () => {
    assert.equal(await withTimeout(Promise.resolve(42), 1000), 42);
    const error = new Error('native error');
    await assert.rejects(withTimeout(Promise.reject(error), 1000), e => e === error);
    await assert.rejects(withTimeout(new Promise(() => {}), 10, 'custom timeout'), /custom timeout/);
});
