import assert from 'assert';
import test from 'node:test';
import { voltageDividerPattern } from '../../src/circuit-layout/patterns/catalog/voltage-divider.ts';
import { shortSymbolsMap } from '../../src/circuit-layout/short-symbol.ts';
import { detectPatternMacros, routeMacroInternals } from '../../src/circuit-layout/patterns/index.ts';
import type { Circuit } from '../../src/types/circuit.ts';
import {
    assertExpandedLayout,
    assertMacroRoutes,
    assertPinHasLocalShort,
    assertPlacementRotations,
    component,
    edgeConnects,
    pinsConnected,
    resistorSymbol,
    voltageDividerFixture,
    writePatternArtifacts,
} from './helpers.ts';

test.describe('circuit pattern: voltage divider', () => {
    test('matches topology and exposes MID through a fixed boundary tail', () => {
        const fixture = voltageDividerFixture();
        const detected = detectPatternMacros(fixture.circuit, fixture.symbols, [voltageDividerPattern]);
        assert.strictEqual(detected.macros.length, 1);
        assert.deepStrictEqual([...detected.absorbedDesignators].sort(), ['R3', 'R4']);

        const macro = detected.macros[0];
        const middle = macro.ports.find(port => port.key === 'MID')!;
        assert.strictEqual(middle.x, macro.node.symbol.width);
        assert.strictEqual(middle.y, macro.node.symbol.height / 2);
        assert.deepStrictEqual(middle.tailBendPoints, [{
            x: macro.node.symbol.width / 2,
            y: macro.node.symbol.height / 2,
        }]);
        assert.strictEqual(macro.placements.filter(placement => placement.generatedComponent).length, 2);
        assertPlacementRotations(macro, { R3: 270, R4: 270 });
    });

    test('does not match resistors from different circuit blocks', () => {
        const top = component('R10', [[1, '1', 'VCC'], [2, '2', 'MID']], 'left');
        const bottom = component('R11', [[1, '1', 'MID'], [2, '2', 'GND']], 'right');
        const circuit: Circuit = {
            metadata: { project_name: 'blocks', description: 'Cross-block near match' },
            blocks: [
                { name: 'left', description: '', next_block_names: [] },
                { name: 'right', description: '', next_block_names: [] },
            ],
            components: [top, bottom],
            reused_blocks: [],
        };
        const detected = detectPatternMacros(
            circuit,
            [resistorSymbol(top), resistorSymbol(bottom)],
            [voltageDividerPattern],
        );
        assert.strictEqual(detected.macros.length, 0);
    });

    test('routes MID through the real center junction', async () => {
        const fixture = voltageDividerFixture();
        const macro = detectPatternMacros(
            fixture.circuit,
            fixture.symbols,
            [voltageDividerPattern],
        ).macros[0];
        macro.routedPaths = await routeMacroInternals(macro);
        assertMacroRoutes(macro);

        const middleRoutes = macro.routedPaths.filter(route => route.signalName === '$1N431');
        assert.ok(middleRoutes.length >= 2);
        const tail = middleRoutes.find(route => route.kind === 'port-tail')!;
        assert.deepStrictEqual(tail.points[0], {
            x: macro.node.symbol.width,
            y: macro.node.symbol.height / 2,
        });
        assert.ok(tail.points.some(point => point.x === macro.node.symbol.width / 2
            && point.y === macro.node.symbol.height / 2));
    });

    test('renders before/after images and saves EasyEDA assembly', async () => {
        const fixture = voltageDividerFixture();
        const { withPattern } = await writePatternArtifacts('circuit-pattern-voltage-divider', fixture);
        assertExpandedLayout(fixture, withPattern);
        assert.ok(edgeConnects(withPattern, 'R3_pin_2', 'U1_pin_3'));
        assert.ok(pinsConnected(withPattern, 'R4_pin_1', 'U1_pin_3'));
        assert.ok(!withPattern.addedSymbol.some(symbol =>
            symbol.part_uuid === shortSymbolsMap.NETPORT.partUuid
            && symbol.value === '$1N431'));
        assertPinHasLocalShort(withPattern, 'R3_pin_1');
        assertPinHasLocalShort(withPattern, 'R4_pin_2');

    });
});
