import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const testRoot = fileURLToPath(new URL('../.test-data/', import.meta.url));
await mkdir(testRoot, { recursive: true });
const outfile = join(await mkdtemp(join(testRoot, 'checkpoints-')), 'checkpoint.mjs');
await build({
    entryPoints: [fileURLToPath(new URL('../src/tools/checkpoint.ts', import.meta.url))],
    bundle: true, outfile, platform: 'node', format: 'esm', packages: 'external',
    alias: {
        '@copilot/shared/timeout-policy': fileURLToPath(new URL('../../shared/timeout-policy.ts', import.meta.url)),
    },
});
const { registerCheckpointTools } = await import(pathToFileURL(outfile));
const registered = new Map();
const requests = [];
registerCheckpointTools({
    registerTool: (name, config, handler) => registered.set(name, { ...config, handler }),
}, {
    requestEasyEda: async (event, body) => {
        requests.push({ event, body: JSON.parse(JSON.stringify(body)) });
        return { checkpointId: 'saved-id' };
    },
    getVersionWarning: async () => undefined,
});
const call = async (name, input) => {
    const tool = registered.get(name);
    return tool.handler(tool.inputSchema.parse(input), { signal: new AbortController().signal });
};
await call('save_checkpoint_for_current_page', {});
assert.deepEqual(requests.pop(), { event: 'checkpoint-save', body: {} });
await call('save_checkpoint_for_current_page', { name: '  Before property changes  ' });
assert.deepEqual(requests.pop(), { event: 'checkpoint-save', body: { name: 'Before property changes' } });
await call('list_checkpoints', {});
assert.deepEqual(requests.pop(), { event: 'checkpoint-list', body: {} });
await call('list_checkpoints', { limit: 100 });
assert.deepEqual(requests.pop(), { event: 'checkpoint-list', body: { limit: 100 } });
for (const limit of [0, -1, 513, 1.5, '100']) {
    await assert.rejects(call('list_checkpoints', { limit }));
}
for (const name of [42, 'x'.repeat(201)]) {
    await assert.rejects(call('save_checkpoint_for_current_page', { name }));
}
await call('restore_checkpoint_for_current_page', { id: 'saved-id' });
assert.deepEqual(requests.pop(), { event: 'checkpoint-restore', body: { checkpointId: 'saved-id' } });
assert.equal(requests.length, 0);
console.log('Checkpoint tool compatibility, parameter forwarding and validation passed.');
