import assert from 'node:assert/strict';
import test from 'node:test';
import { easyEdaPointToPlacement, easyEdaRotationToPlacement } from '../src/eda/pcb-existing-placement.ts';

test('converts EasyEDA y-up coordinates to placement y-down coordinates', () => {
    const origin = { x: 100, y: 50 };

    assert.deepEqual(easyEdaPointToPlacement({ x: 104, y: 58 }, origin), { x: 4, y: -8 });
    assert.deepEqual(easyEdaPointToPlacement({ x: 96, y: 43 }, origin), { x: -4, y: 7 });
    const precise = easyEdaPointToPlacement({ x: 104.26, y: 58.24 }, origin);
    assert.ok(Math.abs(precise.x - 4.26) < 1e-12);
    assert.ok(Math.abs(precise.y + 8.24) < 1e-12);
});

test('converts an asymmetric board outline with the same transform as components', () => {
    const origin = { x: 5, y: 4 };
    const board = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 6 },
        { x: 7, y: 8 },
        { x: 0, y: 8 },
    ];

    assert.deepEqual(board.map(point => easyEdaPointToPlacement(point, origin)), [
        { x: -5, y: 4 },
        { x: 5, y: 4 },
        { x: 5, y: -2 },
        { x: 2, y: -4 },
        { x: -5, y: -4 },
    ]);
    assert.deepEqual(easyEdaPointToPlacement({ x: 7, y: 7 }, origin), { x: 2, y: -3 });
});

test('converts EasyEDA component rotations to placement rotations', () => {
    assert.deepEqual(
        [0, 90, 180, 270].map(rotation => easyEdaRotationToPlacement(rotation, 'top')),
        [180, 90, 0, 270],
    );
    assert.deepEqual(
        [0, 90, 180, 270].map(rotation => easyEdaRotationToPlacement(rotation, 'bottom')),
        [0, 270, 180, 90],
    );
});
