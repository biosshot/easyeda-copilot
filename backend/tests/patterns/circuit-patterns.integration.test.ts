import assert from 'assert';
import test from 'node:test';
import { autoPlaceCircuitWithHierarchy } from '../../src/circuit-layout/index.ts';
import { detectPatternMacros, preparePatternMacros } from '../../src/circuit-layout/patterns/index.ts';
import { assertExpandedLayout, combinedFixture, edgeConnects } from './helpers.ts';
import { powerSenseDecouplingFixture } from './fixtures.ts';

test.describe('circuit pattern integration', () => {
    test('selects overlapping patterns by priority and expands both macros', async () => {
        const fixture = combinedFixture();
        const detected = detectPatternMacros(fixture.circuit, fixture.symbols);
        assert.deepStrictEqual(
            detected.macros.map(macro => macro.patternId).sort(),
            ['opamp-noninverting', 'voltage-divider'],
        );
        assert.strictEqual(detected.absorbedDesignators.size, fixture.circuit.components.length - 1);
        assert.ok(!detected.absorbedDesignators.has('R5'));

        const prepared = await preparePatternMacros(detected.macros);
        assert.strictEqual(prepared.length, detected.macros.length);

        const result = await autoPlaceCircuitWithHierarchy(fixture.circuit, fixture.symbols, {}, {
            layoutMode: 'legacy',
            layoutPatterns: true,
        });
        assertExpandedLayout(fixture, result);
        assert.ok(edgeConnects(result, 'U1_pin_1', 'R5_pin_1'));

    });

    test('re-matches a parallel capacitor bank after the pi-filter consumes one capacitor', async () => {
        const fixture = powerSenseDecouplingFixture();
        const detected = detectPatternMacros(fixture.circuit, fixture.symbols);
        const piFilter = detected.macros.find(macro => macro.patternId === 'power-pi-filter');
        const parallelBank = detected.macros.find(macro => macro.patternId === 'parallel-two-pin');

        assert.deepStrictEqual(piFilter?.absorbedDesignators.slice().sort(), ['C10', 'C21', 'R5']);
        assert.deepStrictEqual(parallelBank?.absorbedDesignators.slice().sort(), ['C11', 'C12', 'C13', 'C14']);
        assert.deepStrictEqual([...detected.absorbedDesignators].sort(),
            ['C10', 'C11', 'C12', 'C13', 'C14', 'C21', 'R5']);

        const prepared = await preparePatternMacros(detected.macros);
        assert.strictEqual(prepared.length, 2);

        const result = await autoPlaceCircuitWithHierarchy(fixture.circuit, fixture.symbols, {}, {
            layoutMode: 'legacy',
            layoutPatterns: true,
        });
        assertExpandedLayout(fixture, result);
    });
});
