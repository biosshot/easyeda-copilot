import type { FootprintPad, PlacementInput } from '../../src/types/pcb/layout-model.ts';
import {
    anchor,
    awayHint,
    block,
    blockRef,
    bypassHint,
    centeredBoard,
    comp,
    component,
    defaultSolverOptions,
    edgeHint,
    footprint,
    lineHint,
    nearHint,
    pad,
    pin,
    qfnPads,
    sameSideHint,
    veryNearHint,
} from '../../src/pcb-layout/pcb-auto-place/utils.ts';
const fp = {
    USB_C: footprint('USB_C', 9, 7, [
        pad('VBUS', 2.6, -1.8, 1.0, 0.5),
        pad('D+', 2.6, -0.5, 1.0, 0.35),
        pad('D-', 2.6, 0.5, 1.0, 0.35),
        pad('GND', 2.6, 1.8, 1.0, 0.5),
    ]),
    QFN32: footprint('QFN32', 7, 7, qfnPads(32, 7, 0.8, 0.4, 0.9, {
        3: 'D+',
        4: 'D-',
        11: 'XTAL1',
        14: 'XTAL2',
        20: 'LED',
        27: 'GND',
        30: 'VDD',
    })),
    QFN48: footprint('QFN48', 9, 9, qfnPads(48, 9, 0.5, 0.4, 0.9, {
        4: 'USB_DP',
        5: 'USB_DM',
        16: 'SWDIO',
        18: 'SWCLK',
        20: 'I2C_SDA',
        22: 'I2C_SCL',
        31: 'XTAL1',
        33: 'XTAL2',
        38: 'LED1',
        40: 'LED2',
        43: 'GND',
        46: 'VDD2',
        48: 'VDD1',
    })),
    C_0603: footprint('C_0603', 1.6, 0.8, [pad('1', -0.55, 0, 0.55, 0.75), pad('2', 0.55, 0, 0.55, 0.75)]),
    R_0603: footprint('R_0603', 1.6, 0.8, [pad('1', -0.55, 0, 0.55, 0.75), pad('2', 0.55, 0, 0.55, 0.75)]),
    XTAL_3225: footprint('XTAL_3225', 3.2, 2.5, [
        pad('1', -1.0, -0.75, 0.75, 0.65),
        pad('2', 1.0, -0.75, 0.75, 0.65),
        pad('3', 1.0, 0.75, 0.75, 0.65),
        pad('4', -1.0, 0.75, 0.75, 0.65),
    ]),
    LED_0603: footprint('LED_0603', 1.6, 0.8, [pad('A', -0.55, 0, 0.55, 0.75), pad('K', 0.55, 0, 0.55, 0.75)]),
    JST_2: footprint('JST_2', 8.0, 6.0, [pad('1', -1.5, 1.8, 1.1, 1.4), pad('2', 1.5, 1.8, 1.1, 1.4)]),
    SOT23_5: footprint('SOT23_5', 2.9, 1.6, [
        pad('IN', -1.2, -0.95, 0.5, 0.6),
        pad('GND', 0, -0.95, 0.5, 0.6),
        pad('EN', 1.2, -0.95, 0.5, 0.6),
        pad('NC', 0.6, 0.95, 0.5, 0.6),
        pad('OUT', -0.6, 0.95, 0.5, 0.6),
    ]),
    SOT23_6: footprint('SOT23_6', 3.0, 1.7, [
        pad('VDD', -1.0, -1.0, 0.5, 0.6),
        pad('GND', 0, -1.0, 0.5, 0.6),
        pad('SDA', 1.0, -1.0, 0.5, 0.6),
        pad('SCL', 1.0, 1.0, 0.5, 0.6),
        pad('INT', 0, 1.0, 0.5, 0.6),
        pad('ADDR', -1.0, 1.0, 0.5, 0.6),
    ]),
    HDR_2X5: footprint('HDR_2X5', 7.0, 12.0, [
        pad('VDD', -1.27, -5.08, 0.9, 0.9),
        pad('GND', 1.27, -5.08, 0.9, 0.9),
        pad('SWDIO', -1.27, -2.54, 0.9, 0.9),
        pad('SWCLK', 1.27, -2.54, 0.9, 0.9),
        pad('RST', -1.27, 0, 0.9, 0.9),
        pad('TX', 1.27, 0, 0.9, 0.9),
        pad('RX', -1.27, 2.54, 0.9, 0.9),
        pad('NC1', 1.27, 2.54, 0.9, 0.9),
        pad('NC2', -1.27, 5.08, 0.9, 0.9),
        pad('NC3', 1.27, 5.08, 0.9, 0.9),
    ]),
} satisfies Record<string, FootprintSpec>;

export const fakePcbPlacementExample: PlacementInput = {
    board: centeredBoard(25, 25),
    blocks: [
        block('USB', 'USB connector', ['J1'], 'connector'),
        block('MCU', 'Main controller', ['U1', 'C1'], 'mcu'),
        block('Clock', 'Crystal oscillator', ['Y1', 'C2', 'C3'], 'generic'),
        block('Indicator', 'Status LED', ['R1', 'D1'], 'generic'),
    ],
    modules: [],
    components: [
        component('J1', 'USB-C', fp.USB_C, 'USB', 'connector', { VBUS: 'VBUS', 'D+': 'USB_DP', 'D-': 'USB_DM', GND: 'GND' }),
        component('U1', 'MCU', fp.QFN32, 'MCU', 'main_ic', { VDD: 'VDD', GND: 'GND', 'D+': 'USB_DP', 'D-': 'USB_DM', XTAL1: 'XTAL1', XTAL2: 'XTAL2', LED: 'LED_SIG' }),
        component('C1', '100nF', fp.C_0603, 'MCU', 'decoupling_cap', { 1: 'VDD', 2: 'GND' }),
        component('Y1', '16MHz', fp.XTAL_3225, 'Clock', 'crystal', { 1: 'XTAL1', 3: 'XTAL2', 2: 'GND', 4: 'GND' }),
        component('C2', '12pF', fp.C_0603, 'Clock', 'passive', { 1: 'XTAL1', 2: 'GND' }),
        component('C3', '12pF', fp.C_0603, 'Clock', 'passive', { 1: 'XTAL2', 2: 'GND' }),
        component('R1', '1k', fp.R_0603, 'Indicator', 'passive', { 1: 'LED_SIG', 2: 'LED_A' }),
        component('D1', 'LED', fp.LED_0603, 'Indicator', 'indicator', { A: 'LED_A', K: 'GND' }),
    ],
    hints: [
        edgeHint('J1', 'left', 'outward', 'critical'),
        nearHint(comp('U1'), anchor('board.center'), 'high'),
        veryNearHint(pin('C1', '1'), pin('U1', 'VDD'), 'critical'),
        veryNearHint(pin('C1', '2'), pin('U1', 'GND'), 'critical'),
        sameSideHint(comp('C1'), comp('U1'), 'critical'),
        nearHint(pin('Y1', '1'), pin('U1', 'XTAL1'), 'high'),
        nearHint(pin('Y1', '3'), pin('U1', 'XTAL2'), 'high'),
        nearHint(pin('C2', '1'), pin('U1', 'XTAL1'), 'normal'),
        nearHint(pin('C3', '1'), pin('U1', 'XTAL2'), 'normal'),
        nearHint(pin('R1', '1'), pin('U1', 'LED'), 'high'),
        veryNearHint(pin('D1', 'A'), pin('R1', '2'), 'high'),
    ],
    solverOptions: defaultSolverOptions,
};

export const fakeComplexPcbPlacementExample: PlacementInput = {
    board: centeredBoard(35, 30),
    blocks: [
        block('USB', 'USB connector', ['J1'], 'connector'),
        block('Power', 'Input connector and LDO', ['J2', 'U2', 'C10', 'C11'], 'power'),
        block('MCU', 'Controller and local decoupling', ['U1', 'C1', 'C4'], 'mcu'),
        block('Clock', 'Crystal cluster', ['Y1', 'C2', 'C3'], 'generic'),
        block('Sensor', 'I2C sensor and pullups', ['U3', 'C20', 'R20', 'R21'], 'sensor'),
        block('Debug', 'Programming header', ['J3'], 'connector'),
        block('Indicator', 'Two status LEDs', ['R1', 'D1', 'R2', 'D2'], 'generic'),
    ],
    modules: [],
    components: [
        component('J1', 'USB-C', fp.USB_C, 'USB', 'connector', { VBUS: 'VBUS', 'D+': 'USB_DP', 'D-': 'USB_DM', GND: 'GND' }),
        component('J2', 'JST-2', fp.JST_2, 'Power', 'connector', { 1: 'VIN', 2: 'GND' }),
        component('U2', 'LDO', fp.SOT23_5, 'Power', 'main_ic', { IN: 'VIN', OUT: 'VDD', GND: 'GND', EN: 'VIN', NC: 'NC' }),
        component('C10', '10uF', fp.C_0603, 'Power', 'decoupling_cap', { 1: 'VIN', 2: 'GND' }),
        component('C11', '10uF', fp.C_0603, 'Power', 'decoupling_cap', { 1: 'VDD', 2: 'GND' }),
        component('U1', 'MCU', fp.QFN48, 'MCU', 'main_ic', { VDD1: 'VDD', VDD2: 'VDD', GND: 'GND', USB_DP: 'USB_DP', USB_DM: 'USB_DM', SWDIO: 'SWDIO', SWCLK: 'SWCLK', I2C_SDA: 'I2C_SDA', I2C_SCL: 'I2C_SCL', XTAL1: 'XTAL1', XTAL2: 'XTAL2', LED1: 'LED1_SIG', LED2: 'LED2_SIG' }),
        component('C1', '100nF', fp.C_0603, 'MCU', 'decoupling_cap', { 1: 'VDD', 2: 'GND' }),
        component('C4', '100nF', fp.C_0603, 'MCU', 'decoupling_cap', { 1: 'VDD', 2: 'GND' }),
        component('Y1', '16MHz', fp.XTAL_3225, 'Clock', 'crystal', { 1: 'XTAL1', 3: 'XTAL2', 2: 'GND', 4: 'GND' }),
        component('C2', '12pF', fp.C_0603, 'Clock', 'passive', { 1: 'XTAL1', 2: 'GND' }),
        component('C3', '12pF', fp.C_0603, 'Clock', 'passive', { 1: 'XTAL2', 2: 'GND' }),
        component('U3', 'I2C sensor', fp.SOT23_6, 'Sensor', 'main_ic', { VDD: 'VDD', GND: 'GND', SDA: 'I2C_SDA', SCL: 'I2C_SCL', INT: 'SENSOR_INT', ADDR: 'GND' }),
        component('C20', '100nF', fp.C_0603, 'Sensor', 'decoupling_cap', { 1: 'VDD', 2: 'GND' }),
        component('R20', '4.7k', fp.R_0603, 'Sensor', 'passive', { 1: 'I2C_SDA', 2: 'VDD' }),
        component('R21', '4.7k', fp.R_0603, 'Sensor', 'passive', { 1: 'I2C_SCL', 2: 'VDD' }),
        component('J3', 'SWD', fp.HDR_2X5, 'Debug', 'connector', { VDD: 'VDD', GND: 'GND', SWDIO: 'SWDIO', SWCLK: 'SWCLK', RST: 'RST', TX: 'TX', RX: 'RX', NC1: 'NC1', NC2: 'NC2', NC3: 'NC3' }),
        component('R1', '1k', fp.R_0603, 'Indicator', 'passive', { 1: 'LED1_SIG', 2: 'LED1_A' }),
        component('D1', 'LED', fp.LED_0603, 'Indicator', 'indicator', { A: 'LED1_A', K: 'GND' }),
        component('R2', '1k', fp.R_0603, 'Indicator', 'passive', { 1: 'LED2_SIG', 2: 'LED2_A' }),
        component('D2', 'LED', fp.LED_0603, 'Indicator', 'indicator', { A: 'LED2_A', K: 'GND' }),
    ],
    hints: [
        edgeHint('J1', 'left', 'outward', 'critical'),
        edgeHint('J2', 'top', 'outward', 'critical'),
        edgeHint('J3', 'right', 'outward', 'critical'),
        nearHint(blockRef('Power'), anchor('board.top_left'), 'high'),
        nearHint(comp('U1'), anchor('board.center'), 'high'),
        nearHint(comp('U2'), comp('J2'), 'high'),
        awayHint(blockRef('Power'), blockRef('Sensor'), 'high'),
        nearHint(pin('U2', 'IN'), pin('J2', '1'), 'high'),
        veryNearHint(pin('C10', '1'), pin('U2', 'IN'), 'critical'),
        veryNearHint(pin('C10', '2'), pin('U2', 'GND'), 'critical'),
        veryNearHint(pin('C11', '1'), pin('U2', 'OUT'), 'critical'),
        veryNearHint(pin('C11', '2'), pin('U2', 'GND'), 'critical'),
        bypassHint(['C10'], pin('U2', 'IN'), 'critical'),
        bypassHint(['C11'], pin('U2', 'OUT'), 'critical'),
        veryNearHint(pin('C1', '1'), pin('U1', 'VDD1'), 'critical'),
        veryNearHint(pin('C1', '2'), pin('U1', 'GND'), 'critical'),
        veryNearHint(pin('C4', '1'), pin('U1', 'VDD2'), 'critical'),
        veryNearHint(pin('C4', '2'), pin('U1', 'GND'), 'critical'),
        bypassHint(['C1', 'C4'], pin('U1', 'VDD1'), 'critical'),
        nearHint(pin('Y1', '1'), pin('U1', 'XTAL1'), 'high'),
        nearHint(pin('Y1', '3'), pin('U1', 'XTAL2'), 'high'),
        nearHint(pin('C2', '1'), pin('U1', 'XTAL1'), 'normal'),
        nearHint(pin('C3', '1'), pin('U1', 'XTAL2'), 'normal'),
        nearHint(pin('U3', 'SDA'), pin('U1', 'I2C_SDA'), 'normal'),
        nearHint(pin('U3', 'SCL'), pin('U1', 'I2C_SCL'), 'normal'),
        veryNearHint(pin('C20', '1'), pin('U3', 'VDD'), 'critical'),
        nearHint(pin('R20', '1'), pin('U3', 'SDA'), 'normal'),
        nearHint(pin('R21', '1'), pin('U3', 'SCL'), 'normal'),
        nearHint(pin('R1', '1'), pin('U1', 'LED1'), 'normal'),
        veryNearHint(pin('D1', 'A'), pin('R1', '2'), 'high'),
        nearHint(pin('R2', '1'), pin('U1', 'LED2'), 'normal'),
        veryNearHint(pin('D2', 'A'), pin('R2', '2'), 'high'),
    ],
    solverOptions: defaultSolverOptions,
};

export const fakeLargePcbPlacementExample: PlacementInput = createFakeLargePcbPlacementExample();

function createFakeLargePcbPlacementExample(): PlacementInput {
    const ledSignalPins = Array.from({ length: 8 }, (_, index) => {
        const ledNumber = index + 3;
        const pinNumber = ['NC1', 'NC2', 'NC3', 'NC6', 'NC7', 'NC8', 'NC9', 'NC10'][index];
        return { pin_number: pinNumber, name: pinNumber, signal_name: `LED${ledNumber}_SIG` };
    });
    const ledPairs = Array.from({ length: 8 }, (_, index) => {
        const ledNumber = index + 3;
        return [
            component(`R${ledNumber}`, '1k', fp.R_0603, 'LED Bank', 'passive', { 1: `LED${ledNumber}_SIG`, 2: `LED${ledNumber}_A` }),
            component(`D${ledNumber}`, 'LED', fp.LED_0603, 'LED Bank', 'indicator', { A: `LED${ledNumber}_A`, K: 'GND' }),
        ];
    }).flat();
    const baseComponents = fakeComplexPcbPlacementExample.components.map((componentValue) => componentValue.designator === 'U1'
        ? { ...componentValue, pins: [...componentValue.pins, ...ledSignalPins] }
        : componentValue);

    const components = [
        ...baseComponents,
        component('U4', 'SPI flash', fp.SOT23_6, 'Memory', 'main_ic', { VDD: 'VDD', GND: 'GND', SDA: 'SPI_MOSI', SCL: 'SPI_SCK', INT: 'SPI_MISO', ADDR: 'SPI_CS' }),
        component('C30', '100nF', fp.C_0603, 'Memory', 'decoupling_cap', { 1: 'VDD', 2: 'GND' }),
        component('R30', '10k', fp.R_0603, 'Memory', 'passive', { 1: 'SPI_CS', 2: 'VDD' }),
        component('R31', '33R', fp.R_0603, 'Memory', 'passive', { 1: 'SPI_SCK', 2: 'SPI_SCK_R' }),
        component('R32', '33R', fp.R_0603, 'Memory', 'passive', { 1: 'SPI_MOSI', 2: 'SPI_MOSI_R' }),
        component('R33', '33R', fp.R_0603, 'Memory', 'passive', { 1: 'SPI_MISO', 2: 'SPI_MISO_R' }),
        component('U5', 'I2C sensor', fp.SOT23_6, 'Sensor Aux', 'main_ic', { VDD: 'VDD', GND: 'GND', SDA: 'I2C_SDA', SCL: 'I2C_SCL', INT: 'AUX_INT', ADDR: 'AUX_ADDR' }),
        component('C31', '100nF', fp.C_0603, 'Sensor Aux', 'decoupling_cap', { 1: 'VDD', 2: 'GND' }),
        component('R34', '4.7k', fp.R_0603, 'Sensor Aux', 'passive', { 1: 'AUX_INT', 2: 'VDD' }),
        component('R35', '10k', fp.R_0603, 'Sensor Aux', 'passive', { 1: 'AUX_ADDR', 2: 'GND' }),
        component('J4', 'EXP', fp.HDR_2X5, 'Expansion', 'connector', { VDD: 'VDD', GND: 'GND', SWDIO: 'SPI_MOSI_R', SWCLK: 'SPI_SCK_R', RST: 'SPI_CS', TX: 'UART_TX', RX: 'UART_RX', NC1: 'I2C_SDA', NC2: 'I2C_SCL', NC3: 'AUX_INT' }),
        component('J5', 'UART', fp.JST_2, 'Expansion', 'connector', { 1: 'UART_TX', 2: 'UART_RX' }),
        ...ledPairs,
        component('C5', '100nF', fp.C_0603, 'MCU', 'decoupling_cap', { 1: 'VDD', 2: 'GND' }),
        component('C6', '100nF', fp.C_0603, 'MCU', 'decoupling_cap', { 1: 'VDD', 2: 'GND' }),
    ];

    return {
        board: centeredBoard(45, 45),
        blocks: [
            ...fakeComplexPcbPlacementExample.blocks,
            block('Memory', 'SPI flash and damping resistors', ['U4', 'C30', 'R30', 'R31', 'R32', 'R33'], 'generic'),
            block('Sensor Aux', 'Second I2C sensor and support passives', ['U5', 'C31', 'R34', 'R35'], 'sensor'),
            block('Expansion', 'Expansion and UART connectors', ['J4', 'J5'], 'connector'),
            block('LED Bank', 'Additional indicator bank', ledPairs.map((componentValue) => componentValue.designator), 'generic', { placementClearance: 0.8 }),
        ],
        modules: [],
        components,
        hints: [
            ...fakeComplexPcbPlacementExample.hints,
            edgeHint('J4', 'bottom', 'outward', 'critical'),
            edgeHint('J5', 'right', 'outward', 'high'),
            nearHint(blockRef('Memory'), comp('U1'), 'normal'),
            nearHint(blockRef('Sensor Aux'), blockRef('Sensor'), 'normal'),
            veryNearHint(blockRef('LED Bank'), anchor('board.bottom_left'), 'critical'),
            lineHint(
                Array.from({ length: 8 }, (_, index) => [`D${index + 3}`, `R${index + 3}`]).flat(),
                'x',
                0.8,
                'high',
                90,
            ),
            veryNearHint(pin('C30', '1'), pin('U4', 'VDD'), 'critical'),
            veryNearHint(pin('C31', '1'), pin('U5', 'VDD'), 'critical'),
            veryNearHint(pin('R35', '1'), pin('U5', 'ADDR'), 'critical'),
            nearHint(comp('J4'), comp('U4'), 'normal'),
            nearHint(comp('J5'), comp('J4'), 'normal'),
            nearHint(pin('R32', '1'), pin('U4', 'SDA'), 'high'),
            nearHint(pin('R32', '2'), pin('J4', 'SWDIO'), 'high'),

            nearHint(pin('R31', '1'), pin('U4', 'SCL'), 'high'),
            nearHint(pin('R31', '2'), pin('J4', 'SWCLK'), 'high'),
            nearHint(pin('R33', '1'), pin('U4', 'INT'), 'high'),

            ...ledPairs
                .filter((componentValue) => componentValue.designator.startsWith('D'))
                .map((componentValue) => {
                    const resistor = `R${componentValue.designator.slice(1)}`;
                    return veryNearHint(pin(componentValue.designator, 'A'), pin(resistor, '2'), 'normal');
                }),
        ],
        solverOptions: {
            ...defaultSolverOptions,
            candidateRadii: [1.2, 2.0, 3.5, 5.0, 8.0, 12.0, 18.0, 24.0, 30.0],
        },
    };
}
