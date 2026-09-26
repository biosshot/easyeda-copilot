import assert from 'node:assert/strict';
import test from 'node:test';
import type { Bridge } from '../src/bridge';
import { optionalVersionWarning, toolHandler, VERSION_WARNING_TIMEOUT_MS } from '../src/tools/handler';

const bridgeWithWarning = (getVersionWarning: Bridge['getVersionWarning']) => ({ getVersionWarning }) as Bridge;

test('version warning has a 10-second default budget', () => {
    assert.equal(VERSION_WARNING_TIMEOUT_MS, 10_000);
});

test('unresponsive version check is ignored without losing the completed tool result', { timeout: 2000 }, async t => {
    // AbortSignal.timeout() is unref'd; Node 20 needs a referenced handle while
    // this fixture deliberately has no sockets or other active application work.
    const keepAlive = setInterval(() => {}, 1000);
    t.after(() => clearInterval(keepAlive));
    let diagnosticStarted!: () => void;
    const bridge = bridgeWithWarning(() => {
        diagnosticStarted?.();
        return new Promise(() => {});
    });
    const controller = new AbortController();
    const result = { content: [{ type: 'text' as const, text: 'completed' }] };
    assert.equal(await optionalVersionWarning(bridge, controller.signal, 20), undefined);
    const started = new Promise<void>(resolve => { diagnosticStarted = resolve; });
    const pending = toolHandler(bridge, async () => result)({}, { signal: controller.signal });
    await started;
    controller.abort(new Error('caller disconnected'));
    assert.equal(await pending, result);
    assert.deepEqual(result.content, [{ type: 'text', text: 'completed' }]);
});

test('failed version check is ignored and a successful warning is preserved', async () => {
    const controller = new AbortController();
    const failedBridge = bridgeWithWarning(async () => { throw new Error('offline'); });
    const result = { content: [{ type: 'text' as const, text: 'completed' }] };
    assert.equal(await toolHandler(failedBridge, async () => result)({}, { signal: controller.signal }), result);
    assert.deepEqual(result.content, [{ type: 'text', text: 'completed' }]);

    const goodBridge = bridgeWithWarning(async () => 'Version mismatch');
    const withWarning = await toolHandler(goodBridge, async () => ({
        content: [{ type: 'text' as const, text: 'completed' }],
    }))({}, { signal: controller.signal });
    assert.deepEqual(withWarning.content, [
        { type: 'text', text: 'completed' },
        { type: 'text', text: 'Version mismatch' },
    ]);
});
