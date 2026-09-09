import assert from 'assert';
import test from 'node:test';
import { opAmpVoltageFollowerPattern } from '../../src/circuit-layout/patterns/catalog/opamp-voltage-follower.ts';
import { detectPatternMacros, routeMacroInternals } from '../../src/circuit-layout/patterns/index.ts';
import {
    assertExpandedLayout,
    assertMacroRoutes,
    assertPlacementRotations,
    edgeConnects,
    writePatternArtifacts,
} from './helpers.ts';
import { opampFollowerFixture } from './fixtures.ts';

test.describe('circuit pattern: op-amp voltage follower', () => {
    test('matches direct output feedback and rejects an open feedback input', () => {
        const fixture = opampFollowerFixture();
        const detected = detectPatternMacros(fixture.circuit, fixture.symbols, [opAmpVoltageFollowerPattern]);
        assert.strictEqual(detected.macros.length, 1);
        assert.deepStrictEqual([...detected.absorbedDesignators], ['U1', 'R6', 'R5']);
        assertPlacementRotations(detected.macros[0], { U1: 0, R6: 0, R5: 270 });

        const nearMiss = opampFollowerFixture();
        nearMiss.circuit.components.find(item => item.designator === 'U1')!.pins
            .find(pin => pin.pin_number == 2)!.signal_name = 'OPEN';
        nearMiss.symbols.find(item => item.designator === 'U1')!.symbol.pins
            .find(pin => pin.num == 2)!.signal_name = 'OPEN';
        assert.strictEqual(detectPatternMacros(nearMiss.circuit, nearMiss.symbols, [opAmpVoltageFollowerPattern]).macros.length, 0);
    });

    test('routes same-symbol feedback around the op-amp body', async () => {
        const fixture = opampFollowerFixture();
        const macro = detectPatternMacros(fixture.circuit, fixture.symbols, [opAmpVoltageFollowerPattern]).macros[0];
        macro.routedPaths = await routeMacroInternals(macro);
        assertMacroRoutes(macro);
        assert.ok(macro.routedPaths.some(route => route.sourcePinId === 'U1_pin_1' && route.targetPinId === 'U1_pin_2'));
        const sharedGroundPin = macro.placements
            .find(placement => placement.generatedComponent && placement.pins[0]?.side === 'WEST')!.pins[0].id;
        for (const route of macro.routedPaths.filter(route => route.signalName === 'GND'
            && (route.sourcePinId === sharedGroundPin || route.targetPinId === sharedGroundPin))) {
            assert.strictEqual(route.points.length, 2);
        }
    });

    test('renders the input and output shunts as part of the macro', async () => {
        const fixture = opampFollowerFixture();
        const { withPattern, assembly } = await writePatternArtifacts('circuit-pattern-opamp-voltage-follower', fixture);
        assertExpandedLayout(fixture, withPattern);
        assert.ok(edgeConnects(withPattern, 'U1_pin_1', 'R5_pin_1'));
        assert.strictEqual(assembly.components.find(item => item.designator === 'U1')?.part_uuid,
            'bde388b03d05419ba1102540cf0c29dc');
    });
});
