import test from 'node:test';
import assert from 'node:assert/strict';
import { readOtherPageSignals } from '../src/utils/other-page-signals.ts';

test('optional cross-page hint falls back to an empty list on read failure', async () => {
    assert.deepEqual(await readOtherPageSignals(async () => { throw new Error('Netlist export failed'); }), []);
    assert.deepEqual(await readOtherPageSignals(async () => null), []);
    assert.deepEqual(await readOtherPageSignals(async () => ['DATA', 3]), []);
    assert.deepEqual(await readOtherPageSignals(async () => ['DATA']), ['DATA']);
});
