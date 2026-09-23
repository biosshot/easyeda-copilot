import test from 'node:test';
import assert from 'node:assert/strict';
import { matchPortStyles, readPortStyles } from '../src/eda/port-styles';

test('port directions follow physical wire islands, even when the net name is shared', () => {
    const pins = [
        { designator: 'U1', pin_number: 1, signal_name: 'AMP_OUT', x: 0, y: 0 },
        { designator: 'R3', pin_number: 1, signal_name: 'AMP_OUT', x: 100, y: 0 },
    ];
    const ports = [
        { signal_name: 'AMP_OUT', style: 'out' as const, x: 20, y: 0 },
        { signal_name: 'AMP_OUT', style: 'in' as const, x: 120, y: 0 },
    ];
    const result = matchPortStyles(pins, ports, [[0, 0, 20, 0], [100, 0, 120, 0]]);
    assert.deepEqual(Object.fromEntries(result), { 'U1.1': 'out', 'R3.1': 'in' });
});

test('multi-segment wires resolve, while crossings without a junction stay separate', () => {
    const result = matchPortStyles(
        [{ designator: 'U1', pin_number: 1, signal_name: 'A', x: 0, y: 0 }],
        [{ signal_name: 'A', style: 'bi', x: 20, y: 20 }],
        [[0, 0, 20, 0], [20, 0, 20, 20]],
    );
    assert.equal(result.get('U1.1'), 'bi');
    const crossing = matchPortStyles(
        [{ designator: 'U1', pin_number: 1, signal_name: 'A', x: 0, y: 0 }],
        [{ signal_name: 'A', style: 'in', x: 10, y: 10 }],
        [[0, 0, 20, 0], [10, -10, 10, 10]],
    );
    assert.equal(crossing.size, 0);
});

test('ambiguous or disconnected ports leave pins without a style', () => {
    const pins = [
        { designator: 'R1', pin_number: 1, signal_name: 'A', x: 0, y: 0 },
        { designator: 'R2', pin_number: 1, signal_name: 'A', x: 20, y: 0 },
    ];
    assert.equal(matchPortStyles(pins, [{ signal_name: 'A', style: 'out', x: 10, y: 0 }], [[0, 0, 20, 0]]).size, 0);
    assert.equal(matchPortStyles(pins, [{ signal_name: 'A', style: 'out', x: 40, y: 0 }], [[0, 0, 20, 0]]).size, 0);
});

test('missing or failing native APIs leave style detection empty', async () => {
    const previous = (globalThis as { eda?: unknown }).eda;
    const pins = [{ designator: 'U1', pin_number: 1, signal_name: 'A', x: 0, y: 0 }];
    try {
        (globalThis as { eda?: unknown }).eda = {};
        assert.equal((await readPortStyles(pins)).size, 0);
        (globalThis as { eda?: unknown }).eda = {
            sch_PrimitiveComponent: {
                getAll: () => { throw new Error('API unavailable'); },
                getAllPinsByPrimitiveId: () => [],
            },
            sch_PrimitiveWire: { getAll: () => [] },
        };
        assert.equal((await readPortStyles(pins)).size, 0);
    } finally {
        (globalThis as { eda?: unknown }).eda = previous;
    }
});
