import assert from 'node:assert/strict';
import test from 'node:test';
import { beginJavaScriptExecution, interruptJavaScriptExecution } from '../src/eda/execute-js-control.ts';

test('requests cooperative cancellation and clears completed execution state', () => {
    assert.equal(interruptJavaScriptExecution().status, 'idle');
    const first = beginJavaScriptExecution();
    assert.equal(first.control.cancelled, false);
    const interrupted = interruptJavaScriptExecution('test cancellation');
    assert.equal(interrupted.interrupted, true);
    assert.equal(interrupted.executionId, first.control.executionId);
    assert.equal(first.control.cancelled, true);
    assert.throws(() => first.control.throwIfCancelled(), /test cancellation/);
    first.finish();
    assert.equal(interruptJavaScriptExecution().status, 'idle');
});

test('does not leak cancellation into a later execution', () => {
    const first = beginJavaScriptExecution();
    interruptJavaScriptExecution();
    first.finish();
    const second = beginJavaScriptExecution();
    assert.equal(second.control.cancelled, false);
    assert.notEqual(second.control.executionId, first.control.executionId);
    second.finish();
});
