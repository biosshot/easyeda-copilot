import test from 'node:test';
import assert from 'node:assert/strict';
import { executeJavaScript } from '../src/eda/execute-js';

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(r => { resolve = r; });
    return { promise, resolve };
}

test('timeout clears only the private API copy, before late JS resumes', async () => {
    const pending = deferred<void>();
    const finished = deferred<void>();
    let captured: Record<string, unknown> | undefined;
    let writes = 0;
    const api = {
        namespace: { write() { writes++; } },
        capture(value: Record<string, unknown>) { captured = value; },
        wait: () => pending.promise,
        finished: () => finished.resolve(),
    };
    const result = await executeJavaScript(`
        eda.capture(eda);
        const finished = eda.finished;
        try { await eda.wait(); eda.namespace.write(); }
        finally { finished(); }
    `, api, async () => 'checkpoint', {}, { timeoutMs: 15 });
    assert.equal(result.checkpoint, 'checkpoint');
    assert.equal(result.error?.phase, 'execute');
    assert.match(result.error!.message, /timed out/);
    assert.notEqual(captured, api);
    assert.deepEqual(Reflect.ownKeys(captured!), []);
    assert.equal(typeof api.namespace.write, 'function');
    pending.resolve();
    await finished.promise;
    assert.equal(writes, 0);
    const next = await executeJavaScript('eda.namespace.write(); return 42;', api, async () => 'next');
    assert.equal(next.error, undefined);
    assert.equal(writes, 1);
    assert.deepEqual(next.result, { kind: 'json', json: '42' });
});

test('timeout covers checkpoint creation and prevents a late checkpoint from starting JS', async () => {
    const checkpoint = deferred<string>();
    let writes = 0;
    const result = await executeJavaScript('eda.write();', { write() { writes++; } },
        () => checkpoint.promise, {}, { timeoutMs: 10 });
    assert.equal(result.error?.phase, 'checkpoint');
    checkpoint.resolve('late');
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(writes, 0);
});

test('timeout also covers async serialization', async () => {
    class PendingBlob extends Blob {
        arrayBuffer(): Promise<ArrayBuffer> { return new Promise(() => {}); }
    }
    const result = await executeJavaScript('return eda.blob;', { blob: new PendingBlob() },
        async () => 'checkpoint', {}, { timeoutMs: 10 });
    assert.equal(result.error?.phase, 'serialize');
    assert.match(result.error!.message, /timed out/);
});

test('parent queue timeout immediately clears the API copy', async () => {
    const controller = new AbortController();
    const started = deferred<void>();
    let captured: object | undefined;
    const result = executeJavaScript('eda.capture(eda); await new Promise(() => {});', {
        capture(scope: object) { captured = scope; started.resolve(); },
    }, async () => 'checkpoint', {}, { signal: controller.signal });
    await started.promise;
    controller.abort(new Error('queue expired'));
    assert.deepEqual(Reflect.ownKeys(captured!), []);
    assert.match((await result).error!.message, /queue expired/);
});
