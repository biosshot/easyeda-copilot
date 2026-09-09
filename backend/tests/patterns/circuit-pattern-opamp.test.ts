import assert from 'assert';
import test from 'node:test';
import { shortSymbolsMap } from '../../src/circuit-layout/short-symbol.ts';
import { opAmpNonInvertingPattern } from '../../src/circuit-layout/patterns/catalog/opamp-noninverting.ts';
import { detectPatternMacros, routeMacroInternals } from '../../src/circuit-layout/patterns/index.ts';
import {
    assertExpandedLayout,
    assertMacroRoutes,
    assertPinHasLocalShort,
    assertPlacementRotations,
    component,
    edgeConnects,
    opampFixture,
    pinsConnected,
    writePatternArtifacts,
} from './helpers.ts';

test.describe('circuit pattern: non-inverting op-amp', () => {
    test('matches topology and builds the expected macro', () => {
        const fixture = opampFixture();
        const detected = detectPatternMacros(fixture.circuit, fixture.symbols, [opAmpNonInvertingPattern]);
        assert.strictEqual(detected.macros.length, 1);
        assert.deepStrictEqual([...detected.absorbedDesignators].sort(), ['R1', 'R2', 'U1']);
        assert.ok(!detected.absorbedDesignators.has('R5'));

        const macro = detected.macros[0];
        assert.strictEqual(macro.patternId, 'opamp-noninverting');
        assert.strictEqual(macro.preferredBlockDirection, 'RIGHT');
        assert.strictEqual(macro.placements.filter(placement => placement.generatedComponent).length, 3);
        assert.ok(macro.placements.some(placement =>
            placement.generatedComponent?.part_uuid === 'VCC'
            && placement.generatedComponent.value === 'VCC'));
        assert.ok(macro.ports.every(port =>
            !shortSymbolsMap.GND.is(port.signalName) && !shortSymbolsMap.VCC.is(port.signalName)));
        assertPlacementRotations(macro, { U1: 0, R1: 0, R2: 0 });

    });

    test('does not match an op-amp stage split between circuit blocks', () => {
        const fixture = opampFixture();
        fixture.circuit.blocks.push({
            name: 'other',
            description: 'Other block',
            next_block_names: [],
        });
        fixture.circuit.components.find(item => item.designator === 'R1')!.block_name = 'other';
        fixture.symbols.find(item => item.designator === 'R1')!.block_name = 'other';
        const detected = detectPatternMacros(fixture.circuit, fixture.symbols, [opAmpNonInvertingPattern]);
        assert.strictEqual(detected.macros.length, 0);
    });

    test('routes fixed placements to exact component pins', async () => {
        const fixture = opampFixture();
        const macro = detectPatternMacros(
            fixture.circuit,
            fixture.symbols,
            [opAmpNonInvertingPattern],
        ).macros[0];
        const placementsBefore = structuredClone(macro.placements);
        macro.routedPaths = await routeMacroInternals(macro);
        assert.deepStrictEqual(macro.placements, placementsBefore);
        assertMacroRoutes(macro);
        const vccPlacement = macro.placements.find(placement =>
            placement.generatedComponent?.part_uuid === 'VCC');
        assert.ok(vccPlacement, 'VCC local short was not generated');
        assert.ok(macro.routedPaths.some(route =>
            route.kind === 'internal'
            && [route.sourcePinId, route.targetPinId].includes('U1_pin_8')
            && [route.sourcePinId, route.targetPinId].includes(vccPlacement.pins[0].id)));
    });

    test('keeps feedback outside the op-amp when VCC uses a local short symbol', async () => {
        const fixture = opampFixture();
        fixture.circuit.components.find(item => item.designator === 'U1')!
            .pins.find(pin => pin.pin_number === 8)!.signal_name = 'VCC';
        fixture.symbols.find(item => item.designator === 'U1')!
            .symbol.pins.find(pin => pin.num === 8)!.signal_name = 'VCC';

        const macro = detectPatternMacros(
            fixture.circuit,
            fixture.symbols,
            [opAmpNonInvertingPattern],
        ).macros[0];
        const routes = await routeMacroInternals(macro);
        const feedback = routes.find(route =>
            route.sourcePinId === 'U1_pin_1' && route.targetPinId === 'R2_pin_2');
        assert.ok(feedback, 'feedback route was not generated');
        assert.ok(feedback.points[1].x > feedback.points[0].x,
            `feedback must leave the EAST output pin outwards: ${JSON.stringify(feedback.points)}`);
    });

    test('keeps a shared anonymous supply as an internal block wire without a NETPORT', async () => {
        const fixture = opampFixture();
        const supplySignal = 'PWR_RAIL';
        fixture.circuit.components.find(item => item.designator === 'U1')!
            .pins.find(pin => pin.pin_number === 8)!.signal_name = supplySignal;
        fixture.symbols.find(item => item.designator === 'U1')!
            .symbol.pins.find(pin => pin.num === 8)!.signal_name = supplySignal;
        fixture.circuit.components.find(item => item.designator === 'R5')!
            .pins.find(pin => pin.pin_number === 2)!.signal_name = supplySignal;
        fixture.symbols.find(item => item.designator === 'R5')!
            .symbol.pins.find(pin => pin.num === 2)!.signal_name = supplySignal;

        const { withPattern } = await writePatternArtifacts(
            'circuit-pattern-opamp-shared-supply',
            fixture,
        );
        assertExpandedLayout(fixture, withPattern);
        assert.ok(pinsConnected(withPattern, 'U1_pin_8', 'R5_pin_2'));
        assert.ok(!withPattern.addedSymbol.some(symbol =>
            symbol.part_uuid === shortSymbolsMap.NETPORT.partUuid
            && symbol.value === supplySignal));
    });

    test('keeps same-block input, output and power connectors internal', async () => {
        const fixture = opampFixture();
        const inputConnector = component('JIN', [[1, 'IN', '$1N431']]);
        const powerConnector = component('JPWR', [[1, 'VCC', 'VCC']]);
        fixture.circuit.components.push(inputConnector, powerConnector);
        fixture.symbols.push({
            designator: inputConnector.designator,
            block_name: inputConnector.block_name,
            symbol: {
                width: 40,
                height: 30,
                center: { x: 20, y: 15 },
                pins: [{
                    num: 1, name: 'IN', signal_name: '$1N431',
                    x: 40, y: 15, part: '',
                }],
            },
        }, {
            designator: powerConnector.designator,
            block_name: powerConnector.block_name,
            symbol: {
                width: 40,
                height: 30,
                center: { x: 20, y: 15 },
                pins: [{
                    num: 1, name: 'VCC', signal_name: 'VCC',
                    x: 20, y: 30, part: '',
                }],
            },
        });

        const { withPattern } = await writePatternArtifacts(
            'circuit-pattern-opamp-same-block-connectors',
            fixture,
        );
        assertExpandedLayout(fixture, withPattern);
        assert.ok(pinsConnected(withPattern, 'U1_pin_3', 'JIN_pin_1'));
        assert.ok(pinsConnected(withPattern, 'U1_pin_1', 'R5_pin_1'));
        assert.ok(pinsConnected(withPattern, 'U1_pin_8', 'JPWR_pin_1'));
        const positions = new Map(withPattern.positioned.map(item => [item.designator, item]));
        const opamp = positions.get('U1')!;
        const input = positions.get('JIN')!;
        const output = positions.get('R5')!;
        assert.ok(input.x + input.width <= opamp.x, 'same-block input was not placed west of U1');
        assert.ok(output.x >= opamp.x + opamp.width, 'same-block output was not placed east of U1');
        assert.deepStrictEqual(
            withPattern.addedSymbol.filter(symbol =>
                symbol.part_uuid === shortSymbolsMap.NETPORT.partUuid),
            [],
        );
    });

    test('renders before/after images and saves EasyEDA assembly', async () => {
        const fixture = opampFixture();
        const { withPattern, assembly } = await writePatternArtifacts('circuit-pattern-opamp', fixture);
        assertExpandedLayout(fixture, withPattern);
        assert.ok(edgeConnects(withPattern, 'U1_pin_1', 'R5_pin_1'));
        assert.ok(!withPattern.addedSymbol.some(symbol =>
            symbol.part_uuid === shortSymbolsMap.NETPORT.partUuid
            && symbol.value === '$1N437'));
        for (const pinRef of ['U1_pin_4', 'R1_pin_1', 'R5_pin_2']) {
            assertPinHasLocalShort(withPattern, pinRef);
        }
        assert.strictEqual(
            assembly.components.find(component => component.designator === 'U1')?.part_uuid,
            'bde388b03d05419ba1102540cf0c29dc',
        );
        assert.strictEqual(
            assembly.components.find(component => component.designator === 'R5')?.part_uuid,
            '0cc9cee0c09e4a1c8b41e9d1feefa5b2',
        );
    });
});
