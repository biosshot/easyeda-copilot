import type { CircuitComponent } from '../../src/types/circuit.ts';
import type { SymbolPin, SymbolWithMeta } from '../../src/types/symbol.ts';
import {
    createPatternFixtureCircuit,
    PATTERN_FIXTURE_BLOCK_NAME,
    type PatternFixture,
} from './helpers.ts';

const OPAMP_UUID = 'bde388b03d05419ba1102540cf0c29dc';
const RESISTOR_UUID = '0cc9cee0c09e4a1c8b41e9d1feefa5b2';
const CAPACITOR_UUID = '80fa7ac3273a449bb12ff7bb85082a66';

type PinTuple = [string | number, string, string];

function item(designator: string, value: string, partUuid: string, pins: PinTuple[],
    blockName = PATTERN_FIXTURE_BLOCK_NAME): CircuitComponent {
    return {
        designator,
        value,
        search_query: value,
        part_uuid: partUuid,
        block_name: blockName,
        pins: pins.map(([pin_number, name, signal_name]) => ({ pin_number, name, signal_name })),
    };
}

function symbol(component: CircuitComponent, width: number, height: number,
    pinPosition: (pin: CircuitComponent['pins'][number], index: number) => [number, number],
    center = { x: width / 2, y: height / 2 }): SymbolWithMeta {
    return {
        designator: component.designator,
        block_name: component.block_name,
        symbol: {
            width,
            height,
            center,
            pins: component.pins.map((pin, index): SymbolPin => {
                const [x, y] = pinPosition(pin, index);
                return { num: pin.pin_number, name: pin.name, signal_name: pin.signal_name, x, y, part: '' };
            }),
        },
    };
}

function resistorSymbol(component: CircuitComponent) {
    return symbol(component, 60, 28, pin => [pin.pin_number == 1 ? 0 : 60, 14]);
}

function verticalCapacitorSymbol(component: CircuitComponent) {
    return symbol(component, 37, 60, pin => [18.5, pin.pin_number == 1 ? 60 : 0]);
}

function horizontalCapacitorSymbol(component: CircuitComponent) {
    return symbol(component, 60, 37, pin => [pin.pin_number == 1 ? 0 : 60, 18.5]);
}

function opampSymbol(component: CircuitComponent) {
    const positions = new Map<string, [number, number]>([
        ['1', [100, 50]], ['2', [0, 40]], ['3', [0, 60]], ['4', [50, 100]], ['8', [50, 0]],
    ]);
    return symbol(component, 100, 100, pin => positions.get(String(pin.pin_number)) ?? [50, 50],
        { x: 40, y: 50 });
}

function buildFixture(projectName: string, components: CircuitComponent[], symbols: SymbolWithMeta[]): PatternFixture {
    return {
        circuit: createPatternFixtureCircuit(projectName, projectName, components),
        symbols,
    };
}

type RealisticBlockOptions = {
    componentBlocks?: Record<string, 'input' | 'pattern' | 'output'>;
    inputSignals: string[];
    outputSignals: string[];
};

export type RealisticPatternFixture = PatternFixture & {
    externalConnections: Array<{
        internalPin: string;
        externalPin: string;
        signalName: string;
    }>;
    patternBlockName: string;
};

function pinRefForSignal(fixture: PatternFixture, signalName: string, blockName: string) {
    const component = fixture.circuit.components.find(item =>
        item.block_name === blockName && item.pins.some(pin => pin.signal_name === signalName));
    const pin = component?.pins.find(item => item.signal_name === signalName);
    if (!component || !pin) throw new Error(`No ${signalName} pin in block ${blockName}`);
    return `${component.designator}_pin_${pin.pin_number}`;
}

function addEndpoint(
    fixture: PatternFixture,
    designator: string,
    blockName: string,
    signalName: string,
    side: 'WEST' | 'EAST',
) {
    const component = item(
        designator,
        side === 'EAST' ? 'INPUT PORT' : 'OUTPUT PORT',
        `test-endpoint-${designator.toLowerCase()}`,
        [[1, '1', signalName]],
        blockName,
    );
    fixture.circuit.components.push(component);
    fixture.symbols.push(symbol(component, 40, 30, () => [side === 'WEST' ? 0 : 40, 15]));
    return `${designator}_pin_1`;
}

export function withRealisticBlocks(
    fixture: PatternFixture,
    options: RealisticBlockOptions,
): RealisticPatternFixture {
    const inputBlockName = 'Input';
    const patternBlockName = 'Pattern stage';
    const outputBlockName = 'Output';
    const supportSourceBlockName = 'Support source';
    const supportSinkBlockName = 'Support sink';
    fixture.circuit.blocks = [
        { name: inputBlockName, description: 'External inputs', next_block_names: [patternBlockName] },
        { name: patternBlockName, description: 'Pattern under test', next_block_names: [outputBlockName] },
        { name: outputBlockName, description: 'External outputs and loads', next_block_names: [] },
        { name: supportSourceBlockName, description: 'Unrelated source', next_block_names: [supportSinkBlockName] },
        { name: supportSinkBlockName, description: 'Unrelated sink', next_block_names: [] },
    ];

    const blockNames = {
        input: inputBlockName,
        pattern: patternBlockName,
        output: outputBlockName,
    } as const;
    for (const component of fixture.circuit.components) {
        component.block_name = blockNames[options.componentBlocks?.[component.designator] ?? 'pattern'];
        const componentSymbol = fixture.symbols.find(item => item.designator === component.designator);
        if (componentSymbol) componentSymbol.block_name = component.block_name;
    }

    const externalConnections: RealisticPatternFixture['externalConnections'] = [];
    options.inputSignals.forEach((signalName, index) => {
        const internalPin = pinRefForSignal(fixture, signalName, patternBlockName);
        const externalPin = addEndpoint(
            fixture,
            `JIN${index + 1}`,
            inputBlockName,
            signalName,
            'EAST',
        );
        externalConnections.push({ internalPin, externalPin, signalName });
    });
    options.outputSignals.forEach((signalName, index) => {
        const internalPin = pinRefForSignal(fixture, signalName, patternBlockName);
        const externalPin = addEndpoint(
            fixture,
            `JOUT${index + 1}`,
            outputBlockName,
            signalName,
            'WEST',
        );
        externalConnections.push({ internalPin, externalPin, signalName });
    });

    const supportSignal = `AUX_${fixture.circuit.metadata.project_name}`;
    addEndpoint(fixture, 'J901', supportSourceBlockName, supportSignal, 'EAST');
    addEndpoint(fixture, 'J902', supportSinkBlockName, supportSignal, 'WEST');

    return Object.assign(fixture, { externalConnections, patternBlockName });
}

export function renameSignal(fixture: PatternFixture, from: string, to: string) {
    for (const component of fixture.circuit.components) {
        for (const pin of component.pins) {
            if (pin.signal_name === from) pin.signal_name = to;
        }
    }
    for (const component of fixture.symbols) {
        for (const pin of component.symbol.pins) {
            if (pin.signal_name === from) pin.signal_name = to;
        }
    }
    return fixture;
}

export function crystalFixture() {
    const components = [
        item('U4', '12MHz', 'f8a79db3e3654a8297251a96bd8eef5d', [
            [1, '1', 'XIN'], [3, '3', 'XOUT_XTAL'], [4, 'GND', 'GND'], [2, 'GND', 'GND'],
        ]),
        item('C3', '15pF', 'd13296afc9b04976857fdbc5dd987cb1', [[1, '1', 'XIN'], [2, '2', 'GND']]),
        item('C9', '15pF', 'd13296afc9b04976857fdbc5dd987cb1', [[1, '1', 'XOUT_XTAL'], [2, '2', 'GND']]),
        item('R4', '1kΩ', '17aa4e57569d4d22adc28d945ba5559d', [[2, '2', 'XOUT_XTAL'], [1, '1', 'XOUT']]),
        item('R5', '100kΩ', RESISTOR_UUID, [[1, '1', 'XOUT'], [2, '2', 'GND']]),
    ];
    const crystal = symbol(components[0], 80, 60, pin => {
        if (pin.pin_number == 1) return [0, 40];
        if (pin.pin_number == 3) return [80, 20];
        return pin.pin_number == 4 ? [0, 20] : [80, 40];
    });
    return buildFixture('circuit-pattern-crystal-oscillator', components,
        [crystal, verticalCapacitorSymbol(components[1]), verticalCapacitorSymbol(components[2]),
            resistorSymbol(components[3]), resistorSymbol(components[4])]);
}

export function powerPiFilterFixture() {
    const components = [
        item('R9', '33Ω', '1f1e772b30d54f119255cd0da7dd806e', [[2, '2', 'VREG_AVDD'], [1, '1', '+3V3']]),
        item('C6', '4.7uF', '80fa7ac3273a449bb12ff7bb85082a66', [[1, '1', '+3V3'], [2, '2', 'GND']]),
        item('C7', '4.7uF', '80fa7ac3273a449bb12ff7bb85082a66', [[1, '1', 'VREG_AVDD'], [2, '2', 'GND']]),
        item('R10', '100kΩ', RESISTOR_UUID, [[1, '1', 'VREG_AVDD'], [2, '2', 'GND']]),
    ];
    return buildFixture('circuit-pattern-power-pi-filter', components,
        [resistorSymbol(components[0]), verticalCapacitorSymbol(components[1]),
            verticalCapacitorSymbol(components[2]), resistorSymbol(components[3])]);
}

export function powerSenseDecouplingFixture() {
    const components = [
        item('C14', '220uF', CAPACITOR_UUID, [[1, '1', 'VOUT_PRE'], [2, '2', 'GND']]),
        item('C12', '10uF', CAPACITOR_UUID, [[1, '1', 'VOUT_PRE'], [2, '2', 'GND']]),
        item('C13', '10uF', CAPACITOR_UUID, [[1, '1', 'VOUT_PRE'], [2, '2', 'GND']]),
        item('C11', '10uF', CAPACITOR_UUID, [[1, '1', 'VOUT_PRE'], [2, '2', 'GND']]),
        item('R5', '20mΩ', RESISTOR_UUID, [[1, '1', 'VOUT_SENSED'], [2, '2', 'VOUT_PRE']]),
        item('C21', '1uF', CAPACITOR_UUID, [[1, '1', 'VOUT_SENSED'], [2, '2', 'GND']]),
        item('C10', '10uF', CAPACITOR_UUID, [[1, '1', 'VOUT_PRE'], [2, '2', 'GND']]),
    ];
    return buildFixture('circuit-pattern-power-sense-decoupling', components, components.map(component =>
        component.designator === 'R5' ? resistorSymbol(component) : verticalCapacitorSymbol(component)));
}

function opampComponent(minusSignal: string, plusSignal: string, outputSignal: string) {
    return item('U1', 'TLV9062IDR', OPAMP_UUID, [
        [8, 'VCC', 'VCC'], [4, 'VEE/GND', 'GND'],
        [2, 'INA-', minusSignal], [3, 'INA+', plusSignal], [1, 'OUTA', outputSignal],
    ]);
}

export function opampFollowerFixture() {
    const components = [
        opampComponent('$1N437', 'VIN', '$1N437'),
        item('R5', '100kΩ', RESISTOR_UUID, [[1, '1', '$1N437'], [2, '2', 'GND']]),
        item('R6', '100kΩ', RESISTOR_UUID, [[1, '1', 'VIN'], [2, '2', 'GND']]),
    ];
    return buildFixture('circuit-pattern-opamp-voltage-follower', components,
        [opampSymbol(components[0]), ...components.slice(1).map(resistorSymbol)]);
}

export function opampInvertingFixture() {
    const components = [
        opampComponent('$1N425', 'GND', '$1N437'),
        item('R2', '100kΩ', RESISTOR_UUID, [[2, '2', '$1N437'], [1, '1', '$1N425']]),
        item('R1', '10kΩ', RESISTOR_UUID, [[2, '2', '$1N425'], [1, '1', 'VIN']]),
        item('R5', '100kΩ', RESISTOR_UUID, [[1, '1', '$1N437'], [2, '2', 'GND']]),
    ];
    return buildFixture('circuit-pattern-opamp-inverting', components,
        [opampSymbol(components[0]), ...components.slice(1).map(resistorSymbol)]);
}

export function usbCUfpFixture() {
    const components = [
        item('J1', 'TYPE-C-31-M-12', '730e76758f9742ca9ca85c73f4ec0ecd', [
            ['A1B12', 'GND', 'GND'], ['A4B9', 'VBUS', 'VBUS'], ['B8', 'SBU2', 'NC_SBU2'],
            ['A5', 'CC1', 'USB_CC1'], ['B7', 'DN2', 'USB_D-'], ['A6', 'DP1', 'USB_D+'],
            ['A7', 'DN1', 'USB_D-'], ['B6', 'DP2', 'USB_D+'], ['A8', 'SBU1', 'NC_SBU1'],
            ['B5', 'CC2', 'USB_CC2'], ['B4A9', 'VBUS', 'VBUS'], ['B1A12', 'GND', 'GND'],
            [4, 'EH', 'GND'], [3, 'EH', 'GND'], [2, 'EH', 'GND'], [1, 'EH', 'GND'],
        ]),
        item('C1', '10uF', '9f83e90cf78c4f3396a8045b3e521dd5', [[1, '1', 'VBUS'], [2, '2', 'GND']]),
        item('R2', '5.1kΩ', '3614094eae9e47dbbbde1f877b2c30ef', [[2, '2', 'GND'], [1, '1', 'USB_CC1']]),
        item('R8', '5.1kΩ', '3614094eae9e47dbbbde1f877b2c30ef', [[2, '2', 'GND'], [1, '1', 'USB_CC2']]),
        item('R3', '27Ω', '9323f3adb93843ac85e5d4c603a03bbc', [[2, '2', 'USB_D-'], [1, '1', 'USB_DM_MCU']]),
        item('R7', '27Ω', '9323f3adb93843ac85e5d4c603a03bbc', [[2, '2', 'USB_D+'], [1, '1', 'USB_DP_MCU']]),
        item('R10', '100kΩ', RESISTOR_UUID, [[1, '1', 'USB_DP_MCU'], [2, '2', 'GND']]),
        item('R11', '100kΩ', RESISTOR_UUID, [[1, '1', 'USB_DM_MCU'], [2, '2', 'GND']]),
    ];
    const connector = symbol(components[0], 90, 150, (pin, index) => {
        if (index < 12) return [0, 20 + index * 10];
        return [90, 100 + (index - 12) * 10];
    });
    return buildFixture('circuit-pattern-usb-c-ufp-usb2', components,
        [connector, horizontalCapacitorSymbol(components[1]),
            ...components.slice(2).map(resistorSymbol)]);
}
