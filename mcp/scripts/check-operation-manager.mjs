import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const { OperationManager } = await import(
    pathToFileURL(resolve('dist/operations/manager.js')).href
);
const { compactRoutingDiagnostics, routingResultBlocksApplication } = await import(
    pathToFileURL(resolve('dist/routing/routing-operation.js')).href
);

assert.equal(routingResultBlocksApplication({ status: 'complete' }), false);
assert.equal(routingResultBlocksApplication({ status: 'partial' }), false,
    'partial copper must reach the EasyEDA apply transaction');
assert.equal(routingResultBlocksApplication({ status: 'error' }), true);

const compactDiagnostics = compactRoutingDiagnostics([
    { code: 'INFO', severity: 'info', message: 'omit me', details: { large: true } },
    ...Array.from({ length: 25 }, (_, index) => ({
        code: `WARN_${index}`,
        severity: 'warning',
        message: `warning ${index}`,
        path: `nets.${index}`,
        details: { large: true },
    })),
]);
assert.equal(compactDiagnostics.diagnostics.length, 20);
assert.equal(compactDiagnostics.omitted, 5);
assert.deepEqual(Object.keys(compactDiagnostics.diagnostics[0]), ['code', 'message', 'path']);

const manager = new OperationManager();
const completedId = manager.start('pcb-dsl', async ({ id }) => ({ ok: true, operation_id: id }));
const completed = await manager.wait(completedId, 1000);
assert.deepEqual(completed, { ok: true, operation_id: completedId });

let release;
const pendingId = manager.start('pcb-layout', async () => {
    await new Promise(resolvePromise => { release = resolvePromise; });
    return { ok: true };
}, { resource: 'pcb' });
const pending = await manager.wait(pendingId, 1);
assert.equal(pending.status, 'running');
assert.equal(pending.operation_id, pendingId);
assert.throws(
    () => manager.start('pcb-dsl', async () => ({}), { resource: 'pcb' }),
    /already using pcb/,
);
release();
await manager.wait(pendingId, 1000);

let cancelled = false;
let markCancelledOperationStarted;
const cancelledOperationStarted = new Promise(resolvePromise => {
    markCancelledOperationStarted = resolvePromise;
});
const cancelledId = manager.start('pcb-dsl', async ({ signal, onCancel }) => {
    onCancel(() => { cancelled = true; });
    markCancelledOperationStarted();
    await new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
});
await cancelledOperationStarted;
const cancelResult = await manager.cancel(cancelledId);
assert.equal(cancelResult.status, 'cancel_requested');
assert.equal(cancelled, true);
await assert.rejects(() => manager.wait(cancelledId, 1000), /cancel/i);

let preStartRunnerCalled = false;
const preStartCancelledId = manager.start('pcb-dsl', async () => {
    preStartRunnerCalled = true;
});
await manager.cancel(preStartCancelledId);
await assert.rejects(() => manager.wait(preStartCancelledId, 1000), /cancel/i);
assert.equal(preStartRunnerCalled, false);

await assert.rejects(() => manager.wait('pcb-dsl:00000000', 1), /not found/i);

let applyAttempts = 0;
const retryableId = manager.start('pcb-dsl', async ({ setApplyHandler }) => {
    setApplyHandler(async () => {
        applyAttempts++;
        if (applyAttempts === 1) throw new Error('connection lost');
        return { applied: true };
    });
    return { prepared: true };
});
await manager.wait(retryableId, 1000);
await assert.rejects(() => manager.apply(retryableId), /connection lost/i);
const retriedApply = await manager.apply(retryableId);
assert.equal(retriedApply.status, 'applied');
assert.deepEqual(retriedApply.apply_result, { applied: true });
const duplicateApply = await manager.apply(retryableId);
assert.equal(duplicateApply.status, 'already_applied');
assert.equal(applyAttempts, 2);

await assert.rejects(() => manager.apply(completedId), /no saved result/i);

let rejectHungApply;
let markHungApplyStarted;
const hungApplyStarted = new Promise(resolvePromise => { markHungApplyStarted = resolvePromise; });
let hungApplyAttempts = 0;
const hungApplyId = manager.start('pcb-dsl', async ({ setApplyHandler, applyResult }) => {
    setApplyHandler(async () => {
        hungApplyAttempts++;
        if (hungApplyAttempts === 1) {
            markHungApplyStarted();
            return new Promise((_, reject) => { rejectHungApply = reject; });
        }
        return { applied: true };
    });
    return applyResult();
});
await hungApplyStarted;
const concurrentApply = manager.apply(hungApplyId);
const failedApply = assert.rejects(concurrentApply, /stale connection failed/);
await new Promise(resolve => setImmediate(resolve));
assert.equal(hungApplyAttempts, 1, 'concurrent application must share one execution');
rejectHungApply(new Error('stale connection failed'));
await failedApply;
await assert.rejects(manager.wait(hungApplyId, 1000), /stale connection failed/);
assert.equal((await manager.apply(hungApplyId)).status, 'applied');
assert.equal(hungApplyAttempts, 2, 'retry only after the first application settled');

let releaseApply;
const lockedId = manager.start('pcb-dsl', async ({ setApplyHandler }) => {
    setApplyHandler(() => new Promise(resolve => { releaseApply = resolve; }));
    return { prepared: true };
}, { resource: 'locked-board' });
await manager.wait(lockedId, 1000);
const lockedApply = manager.apply(lockedId);
await new Promise(resolve => setImmediate(resolve));
assert.throws(() => manager.start('pcb-dsl', async () => {}, { resource: 'locked-board' }), /already using/);
assert.equal(manager.list().find(op => op.operation_id === lockedId).stage, 'applying');
releaseApply({ applied: true });
await lockedApply;
process.stdout.write('Operation manager: ok\n');
