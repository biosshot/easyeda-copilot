import assert from 'node:assert/strict';
import test from 'node:test';
import { deleteBoardWithDocuments, type BoardDeletionApi } from '../src/eda/delete-board.ts';

function fixture() {
    let board: { name: string; schematic: { uuid: string }; pcb: { uuid: string } } | undefined = {
        name: 'Temporary', schematic: { uuid: 'sch-1' }, pcb: { uuid: 'pcb-1' },
    };
    let schematics = [{ uuid: 'sch-1' }];
    let pcbs = [{ uuid: 'pcb-1' }];
    let autoRemoveBoardOnPcb = false;
    const calls: string[] = [];
    const api: BoardDeletionApi = {
        boards: async () => board ? [board] : [],
        schematics: async () => schematics,
        pcbs: async () => pcbs,
        deleteSchematic: async uuid => { calls.push(`schematic:${uuid}`); schematics = []; return true; },
        deletePcb: async uuid => {
            calls.push(`pcb:${uuid}`);
            pcbs = [];
            if (autoRemoveBoardOnPcb) board = undefined;
            return true;
        },
        deleteBoard: async name => { calls.push(`board:${name}`); board = undefined; return true; },
    };
    return {
        api,
        calls,
        failSchematic: () => { api.deleteSchematic = async () => { throw new Error('busy'); }; },
        removeBoardWithPcb: () => { autoRemoveBoardOnPcb = true; },
    };
}

test('deletes linked documents before their board container', async () => {
    const { api, calls } = fixture();
    const result = await deleteBoardWithDocuments('Temporary', api);
    assert.equal(result.success, true);
    assert.deepEqual(calls, ['schematic:sch-1', 'pcb:pcb-1', 'board:Temporary']);
});

test('retains the board when one linked document cannot be removed', async () => {
    const { api, calls, failSchematic } = fixture();
    failSchematic();
    const result = await deleteBoardWithDocuments('Temporary', api);
    assert.equal(result.success, false);
    assert.equal(result.schematicDeleted, false);
    assert.equal(result.pcbDeleted, true);
    assert.deepEqual(calls, ['pcb:pcb-1']);
    assert.match(result.errors.join('\n'), /schematic sch-1.*busy/);
});

test('accepts automatic board removal after the last linked document', async () => {
    const { api, calls, removeBoardWithPcb } = fixture();
    removeBoardWithPcb();
    const result = await deleteBoardWithDocuments('Temporary', api);
    assert.equal(result.success, true);
    assert.deepEqual(calls, ['schematic:sch-1', 'pcb:pcb-1']);
});
