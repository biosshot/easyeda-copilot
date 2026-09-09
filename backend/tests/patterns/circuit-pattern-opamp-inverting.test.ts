import assert from 'assert';
import test from 'node:test';
import { opAmpInvertingPattern } from '../../src/circuit-layout/patterns/catalog/opamp-inverting.ts';
import { detectPatternMacros, routeMacroInternals } from '../../src/circuit-layout/patterns/index.ts';
import {
    assertExpandedLayout,
    assertMacroRoutes,
    assertPlacementRotations,
    edgeConnects,
    writePatternArtifacts,
} from './helpers.ts';
import { opampInvertingFixture } from './fixtures.ts';

test.describe('circuit pattern: inverting op-amp', () => {
    test('matches input and feedback resistors but leaves the load outside', () => {
        const fixture = opampInvertingFixture();
        const detected = detectPatternMacros(fixture.circuit, fixture.symbols, [opAmpInvertingPattern]);
        assert.strictEqual(detected.macros.length, 1);
        assert.deepStrictEqual([...detected.absorbedDesignators].sort(), ['R1', 'R2', 'U1']);
        assert.ok(!detected.absorbedDesignators.has('R5'));
        assertPlacementRotations(detected.macros[0], { U1: 0, R1: 0, R2: 0 });

        const nearMiss = opampInvertingFixture();
        nearMiss.circuit.components.find(item => item.designator === 'R2')!.pins[0].signal_name = 'OTHER';
        nearMiss.symbols.find(item => item.designator === 'R2')!.symbol.pins[0].signal_name = 'OTHER';
        assert.strictEqual(detectPatternMacros(nearMiss.circuit, nearMiss.symbols, [opAmpInvertingPattern]).macros.length, 0);
    });

    test('does not combine stages across blocks', () => {
        const fixture = opampInvertingFixture();
        fixture.circuit.blocks.push({ name: 'other', description: 'other', next_block_names: [] });
        fixture.circuit.components.find(item => item.designator === 'R1')!.block_name = 'other';
        fixture.symbols.find(item => item.designator === 'R1')!.block_name = 'other';
        assert.strictEqual(detectPatternMacros(fixture.circuit, fixture.symbols, [opAmpInvertingPattern]).macros.length, 0);
    });

    test('routes, renders and preserves the output load', async () => {
        const fixture = opampInvertingFixture();
        const macro = detectPatternMacros(fixture.circuit, fixture.symbols, [opAmpInvertingPattern]).macros[0];
        macro.routedPaths = await routeMacroInternals(macro);
        assertMacroRoutes(macro);
        const { withPattern } = await writePatternArtifacts('circuit-pattern-opamp-inverting', fixture);
        assertExpandedLayout(fixture, withPattern);
        assert.ok(edgeConnects(withPattern, 'U1_pin_1', 'R5_pin_1'));
    });
});
