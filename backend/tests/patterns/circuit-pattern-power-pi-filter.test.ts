import assert from 'assert';
import test from 'node:test';
import { powerPiFilterPattern } from '../../src/circuit-layout/patterns/catalog/power-pi-filter.ts';
import { detectPatternMacros, routeMacroInternals } from '../../src/circuit-layout/patterns/index.ts';
import {
    assertExpandedLayout,
    assertMacroRoutes,
    assertPlacementRotations,
    pinsConnected,
    writePatternArtifacts,
} from './helpers.ts';
import { powerPiFilterFixture } from './fixtures.ts';

test.describe('circuit pattern: power pi filter', () => {
    test('matches C-series-C topology and rejects a missing shunt branch', () => {
        const fixture = powerPiFilterFixture();
        const detected = detectPatternMacros(fixture.circuit, fixture.symbols, [powerPiFilterPattern]);
        assert.strictEqual(detected.macros.length, 1);
        assert.deepStrictEqual([...detected.absorbedDesignators].sort(), ['C6', 'C7', 'R9']);
        assert.ok(!detected.absorbedDesignators.has('R10'));
        assertPlacementRotations(detected.macros[0], { R9: 0, C6: 180, C7: 180 });

        const nearMiss = powerPiFilterFixture();
        nearMiss.circuit.components.find(item => item.designator === 'C7')!.pins[1].signal_name = 'AUX';
        nearMiss.symbols.find(item => item.designator === 'C7')!.symbol.pins[1].signal_name = 'AUX';
        assert.strictEqual(detectPatternMacros(nearMiss.circuit, nearMiss.symbols, [powerPiFilterPattern]).macros.length, 0);
    });

    test('isolates circuit blocks', () => {
        const fixture = powerPiFilterFixture();
        fixture.circuit.blocks.push({ name: 'other', description: 'other', next_block_names: [] });
        fixture.circuit.components.find(item => item.designator === 'C6')!.block_name = 'other';
        fixture.symbols.find(item => item.designator === 'C6')!.block_name = 'other';
        assert.strictEqual(detectPatternMacros(fixture.circuit, fixture.symbols, [powerPiFilterPattern]).macros.length, 0);
    });

    test('routes and renders the real EasyEDA fixture', async () => {
        const fixture = powerPiFilterFixture();
        const macro = detectPatternMacros(fixture.circuit, fixture.symbols, [powerPiFilterPattern]).macros[0];
        macro.routedPaths = await routeMacroInternals(macro);
        assertMacroRoutes(macro);
        const { withPattern, assembly } = await writePatternArtifacts('circuit-pattern-power-pi-filter', fixture);
        assertExpandedLayout(fixture, withPattern);
        assert.ok(pinsConnected(withPattern, 'R9_pin_2', 'R10_pin_1'));
        assert.strictEqual(assembly.components.find(item => item.designator === 'R9')?.part_uuid,
            '1f1e772b30d54f119255cd0da7dd806e');
    });
});
