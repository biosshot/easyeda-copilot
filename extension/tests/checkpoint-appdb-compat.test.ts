import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import AppDBClient from 'appdb';
import { IDBFactory, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb';
import type { Checkpoint } from '../src/eda/checkpoint-store';

const runtime = buildSync({
    entryPoints: [join(__dirname, '../src/eda/checkpoint-store.ts')],
    bundle: true, write: false, platform: 'node', format: 'cjs',
}).outputFiles[0].text;

test('native storage preserves snapshots written by the released AppDB client without bulk history reads', async t => {
    const factory = new IDBFactory();
    const legacy = await new AppDBClient(false, [], [], { indexedDB: factory, IDBKeyRange })
        .init('checkpoints', { checkpoints: [] });
    const original: Checkpoint[] = Array.from({ length: 8 }, (_, i) => ({
        _id: `legacy-${i}`, timestamp: 100 + i, pageId: 'page-1',
        name: i === 0 ? 'true' : i === 1 ? 'false' : `Before edit ${i}`,
        content: `["DOCHEAD",${i}]||{"title":"회로도"}|\n` + 'x'.repeat(512 * 1024),
    }));
    for (const row of original) await legacy.checkpoints.insert(row);

    const module = { exports: {} as { checkpointStore: typeof import('../src/eda/checkpoint-store').checkpointStore } };
    runInNewContext(runtime, { module, exports: module.exports, indexedDB: factory });
    const store = module.exports.checkpointStore;
    t.mock.method(IDBObjectStore.prototype, 'getAll', () => { throw new Error('Bulk history read forbidden'); });
    const get = t.mock.method(IDBObjectStore.prototype, 'get');

    assert.equal(await store.count(), original.length);
    const added: Checkpoint = { _id: 'native', timestamp: 200, pageId: 'page-1', content: 'new source' };
    await store.add(added, () => false);
    assert.equal(get.mock.callCount(), 0);
    const page = await store.listMetadata({ limit: 2, offset: 3 });
    assert.deepEqual(Array.from(page, row => row._id), ['legacy-5', 'legacy-4']);
    assert.ok(page.every(row => !Object.hasOwn(row, 'content')));
    assert.equal(get.mock.callCount(), 2);

    const hash = (row: Checkpoint) => createHash('sha256').update(JSON.stringify(row)).digest('hex');
    for (const expected of [...original, added]) {
        const actual = await store.get(expected._id);
        assert.ok(actual);
        assert.equal(hash(actual), hash(expected));
    }
    assert.equal(await store.count(), original.length + 1);
});
