import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAbsolutePositions } from '../src/circuit-layout/index.ts';
import { rotateSymbolGeometry } from '../src/circuit-layout/patterns/helpers.ts';
import { turnNode } from '../src/circuit-layout/refinement/groups.ts';
import type { SymbolData } from '../src/types/symbol.ts';

// KPT-2012LZGCK-3.0U, used by LED_B1..4 in bank case 60f850f0.
// Library pins are (-20, 0), (20, 0); layout reserves 10 more units per pin.
const led: SymbolData = {
    width: 60, height: 45, center: { x: 30, y: 27.5 },
    pins: [
        { num: 1, name: 'A', signal_name: '+3V3', part: '', x: 0, y: 27.5 },
        { num: 2, name: 'K', signal_name: 'LED_K', part: '', x: 60, y: 27.5 },
    ],
};
const orientations = [
    { angle: 0, width: 60, height: 45, center: { x: 30, y: 27.5 }, anode: [-30, 0], cathode: [30, 0] },
    { angle: 90, width: 45, height: 60, center: { x: 27.5, y: 30 }, anode: [0, 30], cathode: [0, -30] },
    { angle: 180, width: 60, height: 45, center: { x: 30, y: 17.5 }, anode: [30, 0], cathode: [-30, 0] },
    { angle: 270, width: 45, height: 60, center: { x: 17.5, y: 30 }, anode: [0, -30], cathode: [0, 30] },
];

for (const expected of orientations) {
    test(`LED library anchor and wire terminals agree at ${expected.angle} degrees`, () => {
        const g = rotateSymbolGeometry(led, expected.angle);
        assert.deepEqual(g.center, expected.center);
        // Independent check against the library's pin offsets, including the
        // reserved lead: client insertion point + offset must reach each wire.
        for (const [i, offset] of [expected.anode, expected.cathode].entries()) {
            assert.deepEqual([g.pins[i].x - g.center.x, g.pins[i].y - g.center.y], offset);
        }
    });

    test(`ELK export preserves the LED insertion point at ${expected.angle} degrees`, () => {
        const [p] = computeAbsolutePositions({ id: 'block', x: 100, y: 200, children: [{
            id: 'LED_B1', x: 353, y: 98, width: expected.width, height: expected.height,
            center: led.center, rotate: expected.angle,
        }] });
        assert.deepEqual(p.center, expected.center);
        assert.deepEqual([p.x, p.y], [453, 298]);
        assert.equal(p.rotate, expected.angle);
    });
}

test('anchors offset on both axes, including outside bounds, remain signed points', () => {
    const symbol = { width: 80, height: 50, center: { x: 12, y: 37 }, pins: [] };
    const expected = [{ x: 12, y: 37 }, { x: 37, y: 68 }, { x: 68, y: 13 }, { x: 13, y: 12 }];
    for (const [i, angle] of [0, 90, 180, 270].entries()) {
        assert.deepEqual(rotateSymbolGeometry(symbol, angle).center, expected[i]);
    }
    assert.deepEqual(rotateSymbolGeometry({ ...symbol, center: { x: -5, y: 60 } }, 180).center, { x: 85, y: -10 });
});

test('refinement turns compose without losing the asymmetric insertion point', () => {
    const g = rotateSymbolGeometry(led, 90);
    const turned = turnNode({ id: 'LED_B1', x: 100, y: 200, width: g.width, height: g.height,
        rotation: 90, center: g.center, ports: g.pins.map(p => ({ id: String(p.num), x: p.x, y: p.y })) }, 180);
    assert.deepEqual(turned.center, { x: 17.5, y: 30 });
    assert.equal(turned.rotation, 270);
    assert.deepEqual(turned.ports?.map(p => [p.x, p.y]), [[17.5, 0], [17.5, 60]]);
    assert.deepEqual(rotateSymbolGeometry(rotateSymbolGeometry(led, 180), 180), led);
});
