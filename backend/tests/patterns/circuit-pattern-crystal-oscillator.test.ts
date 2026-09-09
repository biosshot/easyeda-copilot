import assert from 'assert';
import test from 'node:test';
import { crystalOscillatorPattern } from '../../src/circuit-layout/patterns/catalog/crystal-oscillator.ts';
import { detectPatternMacros, routeMacroInternals } from '../../src/circuit-layout/patterns/index.ts';
import {
    assertExpandedLayout,
    assertMacroRoutes,
    assertPlacementRotations,
    edgeConnects,
    writePatternArtifacts,
} from './helpers.ts';
import { crystalFixture } from './fixtures.ts';

test.describe('circuit pattern: crystal oscillator', () => {
    test('matches a four-pin crystal, two load capacitors and optional series resistor', () => {
        const fixture = crystalFixture();
        const detected = detectPatternMacros(fixture.circuit, fixture.symbols, [crystalOscillatorPattern]);
        assert.strictEqual(detected.macros.length, 1);
        assert.deepStrictEqual([...detected.absorbedDesignators].sort(), ['C3', 'C9', 'R4', 'U4']);
        assert.ok(!detected.absorbedDesignators.has('R5'));
        assertPlacementRotations(detected.macros[0], { U4: 0, C3: 180, C9: 180, R4: 180 });

        const nearMiss = crystalFixture();
        nearMiss.circuit.components.find(item => item.designator === 'C9')!.pins[0].signal_name = 'OTHER';
        nearMiss.symbols.find(item => item.designator === 'C9')!.symbol.pins[0].signal_name = 'OTHER';
        assert.strictEqual(detectPatternMacros(nearMiss.circuit, nearMiss.symbols, [crystalOscillatorPattern]).macros.length, 0);
    });

    test('does not combine components from different blocks', () => {
        const fixture = crystalFixture();
        fixture.circuit.blocks.push({ name: 'other', description: 'other', next_block_names: [] });
        fixture.circuit.components.find(item => item.designator === 'C3')!.block_name = 'other';
        fixture.symbols.find(item => item.designator === 'C3')!.block_name = 'other';
        assert.strictEqual(detectPatternMacros(fixture.circuit, fixture.symbols, [crystalOscillatorPattern]).macros.length, 0);
    });

    test('rejects a two-pin crystal', () => {
        const fixture = crystalFixture();
        const crystal = fixture.circuit.components.find(item => item.designator === 'U4')!;
        crystal.pins = crystal.pins.filter(pin => !/GND/i.test(pin.signal_name));
        const crystalSymbol = fixture.symbols.find(item => item.designator === 'U4')!;
        crystalSymbol.symbol.pins = crystalSymbol.symbol.pins.filter(pin => !/GND/i.test(pin.signal_name));
        const detected = detectPatternMacros(fixture.circuit, fixture.symbols, [crystalOscillatorPattern]);
        assert.strictEqual(detected.macros.length, 0);
    });

    test('routes and renders the real EasyEDA fixture', async () => {
        const fixture = crystalFixture();
        const macro = detectPatternMacros(fixture.circuit, fixture.symbols, [crystalOscillatorPattern]).macros[0];
        macro.routedPaths = await routeMacroInternals(macro);
        assertMacroRoutes(macro);
        const { withPattern, assembly } = await writePatternArtifacts('circuit-pattern-crystal-oscillator', fixture);
        assertExpandedLayout(fixture, withPattern);
        assert.ok(edgeConnects(withPattern, 'R4_pin_1', 'R5_pin_1'));
        assert.strictEqual(assembly.components.find(item => item.designator === 'U4')?.part_uuid,
            'f8a79db3e3654a8297251a96bd8eef5d');
    });
});
