import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const template = await readFile(new URL('../docs/execution/examples/pcb-refill-and-drc.js', import.meta.url), 'utf8');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
// Replace only the target value, leaving the guard against an unset placeholder.
const run = new AsyncFunction('eda', template.replace("const expectedDocument = 'REPLACE_WITH_TARGET_PCB_UUID'", "const expectedDocument = 'pcb-test'"));
function fixture(statuses, drc = []) {
    const calls = [];
    let document = 'pcb-test';
    const eda = {
        dmt_SelectControl: { getCurrentDocumentInfo: async () => ({ uuid: document, documentType: 3 }) },
        pcb_PrimitivePour: { getAll: async () => statuses.map((status, i) => ({
            getState_PrimitiveId: () => `pour-${i}`,
            rebuildCopperRegion: async () => {
                calls.push(`rebuild-${i}`);
                if (status === 'throw') throw new Error('rebuild failed');
                if (status === 'switch') document = 'other-pcb';
                return status === 'undefined' ? undefined : {};
            },
        })) },
        pcb_PrimitivePoured: { getAll: async () => { calls.push('read-fill'); return []; } },
        pcb_Drc: { check: async (...args) => { assert.deepEqual(args, [true, false, true]); calls.push('drc'); return drc; } },
    };
    return { eda, calls };
}
await assert.rejects(new AsyncFunction('eda', template)({}), /Set the target PCB UUID/);
const success = fixture(['ok', 'ok'], [{ list: [{ list: [{ errorType: 'Connection Error' }] }] }]);
const result = await run(success.eda);
assert.deepEqual(success.calls, ['rebuild-0', 'rebuild-1', 'read-fill', 'drc']);
assert.equal(result.refill_confirmed, true);
assert.equal(result.drc_passed, false); assert.equal(result.violation_count, 1);
const failed = await run(fixture(['throw', 'undefined']).eda);
assert.equal(failed.refill_confirmed, false); assert.equal(failed.drc_passed, true);
assert.deepEqual(failed.rebuilds.map(r => r.status), ['failed', 'unconfirmed']);
const switched = fixture(['switch', 'ok']);
await assert.rejects(run(switched.eda), /Target PCB/);
assert.deepEqual(switched.calls, ['rebuild-0']);
await assert.rejects(run(fixture([], true).eda), /detailed results/);
await assert.rejects(run(fixture([], [{ list: [{}] }]).eda), /Unexpected DRC group/);
console.log('PCB refill example checks passed: sequencing, partial failures, document switch, malformed DRC, unset target.');
