import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const runtime = buildSync({
    entryPoints: [join(__dirname, '../src/eda/checkpointer.ts')],
    bundle: true, write: false, platform: 'node', format: 'cjs',
    external: ['appdb', '@copilot/shared/types/eda'],
}).outputFiles[0].text;

type Saved = { _id: string; timestamp: number; content: string; pageId?: string; name?: string };

function load(rows: Saved[]) {
    const state = { pageId: 'page-1', content: 'current source' };
    const module = { exports: {} as any };
    class AppDB {
        async init(name: string, indexes: unknown) {
            assert.equal(name, 'checkpoints');
            assert.deepEqual(JSON.parse(JSON.stringify(indexes)), {
                checkpoints: ['timestamp', 'content', '_id', 'pageId'],
            });
            return { checkpoints: {
                find: async (query: { _id?: string }) => structuredClone(rows.filter(row => !query._id || row._id === query._id)),
                insert: async (row: Saved) => rows.push(structuredClone(row)),
                remove: async (query: { _id: string }) => rows.splice(rows.findIndex(row => row._id === query._id), 1),
            } };
        }
    }
    runInNewContext(runtime, {
        module, exports: module.exports,
        require: (id: string) => id === 'appdb' ? AppDB : {},
        ESYS_ToastMessageType: { WARNING: 1, SUCCESS: 2, ERROR: 3, INFO: 4 },
        eda: {
            dmt_SelectControl: { getCurrentDocumentInfo: async () => ({ uuid: state.pageId, documentType: 3 }) },
            sys_FileManager: {
                getDocumentSource: async () => state.content,
                setDocumentSource: async (content: string) => { state.content = content; return true; },
            },
            sys_Message: { showToastMessage: () => {} },
        },
    });
    return { checkpointer: module.exports.checkpointer, state };
}

test('old checkpoints get English display names without rewriting records and still restore', async () => {
    const rows: Saved[] = [{ _id: 'old', timestamp: 1700000000000, content: 'old source', pageId: 'page-1' }];
    const original = structuredClone(rows);
    const { checkpointer, state } = load(rows);
    const [entry] = await checkpointer.list();
    assert.equal(entry.name, 'Unnamed — 2023-11-14T22:13:20.000Z');
    assert.deepEqual(rows, original);
    assert.equal(await checkpointer.restore('old', true), true);
    assert.equal(state.content, 'old source');
});

test('names survive reload and duplicate names restore distinct snapshots by ID', async () => {
    const rows: Saved[] = [];
    const first = load(rows);
    const name = 'Schematic verified, before property changes';
    first.state.content = 'first source';
    const firstId = await first.checkpointer.save(false, `  ${name}  `);
    first.state.content = 'second source';
    const secondId = await first.checkpointer.save(false, name);
    assert.notEqual(firstId, secondId);
    const reloaded = load(rows);
    assert.equal((await reloaded.checkpointer.read(firstId)).name, name);
    assert.equal((await reloaded.checkpointer.list()).filter((row: Saved) => row.name === name).length, 2);
    assert.equal(await reloaded.checkpointer.restore(firstId, true), true);
    assert.equal(reloaded.state.content, 'first source');
    assert.equal(await reloaded.checkpointer.restore(secondId, true), true);
    assert.equal(reloaded.state.content, 'second source');
    reloaded.state.pageId = 'another-page';
    assert.equal(await reloaded.checkpointer.restore(firstId, true), false);
});

test('legacy save calls and blank names work; invalid names do not save', async () => {
    const rows: Saved[] = [];
    const { checkpointer } = load(rows);
    assert.ok(await checkpointer.save(false));
    assert.ok(await checkpointer.save(false, '   '));
    assert.equal(rows.length, 2);
    assert.ok(rows.every(row => !Object.hasOwn(row, 'name')));
    assert.equal(await checkpointer.save(false, 'x'.repeat(201)), null);
    assert.equal(await checkpointer.save(false, 42), null);
    assert.equal(rows.length, 2);
    assert.ok(await checkpointer.save(true, 'Temporary checkpoint'));
    assert.equal(rows.length, 2);
    assert.equal(await checkpointer.restore(undefined, true), true);
});

test('active scope baselines survive history pruning, expired pins do not', async () => {
    const rows: Saved[]=Array.from({length:512},(_,i)=>({_id:`cp-${i}`,timestamp:i,content:'source',pageId:'page-1'}));
    const {checkpointer}=load(rows);
    checkpointer.pin('cp-0',Date.now()+60000);
    checkpointer.pin('cp-1',Date.now()-1);
    await checkpointer.save(false);
    assert.ok(rows.some(r=>r._id==='cp-0'));
    assert.ok(!rows.some(r=>r._id==='cp-1'));
    checkpointer.unpin('cp-0');
    while(rows.length<512) rows.push({_id:`new-${rows.length}`,timestamp:Date.now(),content:'source'});
    await checkpointer.save(false);
    assert.ok(!rows.some(r=>r._id==='cp-0'));
});
