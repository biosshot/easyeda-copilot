import assert from 'node:assert/strict';
import test from 'node:test';
import type { BlockNode } from '../src/types/auto-place.ts';
import { setSingleLocalBlockDirection } from '../src/circuit-layout/local-transforms.ts';

test.describe('local layout transforms', () => {
    test('changes only the sole circuit block direction', () => {
        const input: BlockNode = {
            id: 'block___v_root__',
            layoutOptions: { 'org.eclipse.elk.direction': 'LEFT' },
            children: [{ id: 'block_Main', children: [{ id: 'R1' }] }],
        };
        const result = setSingleLocalBlockDirection(input, 'DOWN');

        assert.equal(result?.layoutOptions?.['org.eclipse.elk.direction'], 'LEFT');
        assert.equal(result?.children?.[0].layoutOptions?.['org.eclipse.elk.direction'], 'DOWN');
        assert.equal(input.children?.[0].layoutOptions, undefined);
    });

    test('refuses to alter a multi-block hierarchy', () => {
        const input: BlockNode = {
            id: 'block___v_root__',
            children: [{ id: 'block_A' }, { id: 'block_B' }],
        };
        assert.equal(setSingleLocalBlockDirection(input, 'RIGHT'), null);
    });
});
