import test from 'node:test';
import assert from 'node:assert/strict';
import { LEGACY_PORT_LENGTHS, matchingWirePort, wirePortLabel, wirePortLengths, wirePortMinLength } from '../src/eda/wire-port-layout';

test('wire ports prefer a common length, then their own text length, keeping all legacy fallbacks', () => {
    assert.equal(wirePortMinLength('MCU_FPGA_MISO'), 80);
    const lengths = wirePortLengths('FPGA_TMS', 80);
    assert.deepEqual(lengths.slice(0, 2), [80, 50]);
    assert.deepEqual(lengths.slice(-3), [15, 10, 5]);
    assert(LEGACY_PORT_LENGTHS.every(length => lengths.includes(length)));
    // A crowded pin can still use the same short route as before.
    assert.equal(lengths.find(length => length <= 15), 15);
    assert(wirePortLengths('A', NaN).every(Number.isFinite));
});

test('long horizontal stubs align labels inward at their outer end with 5 units padding', () => {
    assert.deepEqual(wirePortLabel('FPGA_TMS', [100, 0, 20, 0]), { x: 25, y: 0, rotation: 0, align: 'LEFT_BOTTOM' });
    assert.deepEqual(wirePortLabel('FPGA_TMS', [100, 0, 180, 0]), { x: 175, y: 0, rotation: 0, align: 'RIGHT_BOTTOM' });
    // A 75-unit wire fits 13 characters plus padding, even though new routes round up to 80.
    assert.equal(wirePortLabel('MCU_FPGA_MISO', [100, 0, 25, 0])?.align, 'LEFT_BOTTOM');
});

test('short stubs flip the label origin outward on both sides', () => {
    assert.deepEqual(wirePortLabel('FPGA_CFG_MISO', [100, 0, 85, 0]), { x: 85, y: 0, rotation: 0, align: 'RIGHT_BOTTOM' });
    assert.deepEqual(wirePortLabel('FPGA_CFG_MISO', [100, 0, 115, 0]), { x: 115, y: 0, rotation: 0, align: 'LEFT_BOTTOM' });
});

test('vertical stubs use the same inward/outward rule along a rotated label', () => {
    assert.deepEqual(wirePortLabel('FPGA_TMS', [0, 0, 0, -80]), { x: 0, y: -75, rotation: 90, align: 'RIGHT_BOTTOM' });
    assert.deepEqual(wirePortLabel('FPGA_TMS', [0, 0, 0, 80]), { x: 0, y: 75, rotation: 90, align: 'LEFT_BOTTOM' });
    assert.equal(wirePortLabel('FPGA_TMS', [0, 0, 0, -5])?.align, 'LEFT_BOTTOM');
    assert.equal(wirePortLabel('FPGA_TMS', [0, 0, 0, 5])?.align, 'RIGHT_BOTTOM');
});

test('normalization retains pin-to-tip direction only for an isolated wire port', () => {
    const port: [number, number, number, number] = [100, 0, 20, 0];
    assert.deepEqual(matchingWirePort([[20, 0, 100, 0]], [port]), port);
    assert.equal(matchingWirePort([[20, 0, 100, 0]], []), undefined);
    assert.equal(matchingWirePort([[20, 0, 120, 0]], [port]), undefined);
    assert.equal(matchingWirePort([[20, 0, 100, 0], [100, 0, 100, 20]], [port]), undefined);
    assert.equal(wirePortLabel('A', [0, 0, 10, 10]), undefined);
    assert.equal(wirePortLabel('A', [0, 0, NaN, 0]), undefined);
});
