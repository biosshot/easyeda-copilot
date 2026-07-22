import { PcbLayerName } from '@copilot/shared/types/pcb/shared.js';

const makePalette = (
    count: number,
    startHue: number,
    step: number,
    saturation: number,
    lightness: number,
): string[] =>
    Array.from(
        { length: count },
        (_, i) => `hsl(${(startHue + i * step) % 360} ${saturation}% ${lightness}%)`,
    );

const INNER_COLORS = makePalette(30, 120, 11, 55, 48);
const CUSTOM_COLORS = makePalette(30, 280, 9, 35, 58);

export const LAYER_ORDER: PcbLayerName[] = [
    'BOTTOM',
    'BOTTOM_SOLDER_MASK',
    'BOTTOM_PASTE_MASK',
    'BOTTOM_SILKSCREEN',
    'BOTTOM_ASSEMBLY',
    'BOTTOM_STIFFENER',

    'INNER_30',
    'INNER_29',
    'INNER_28',
    'INNER_27',
    'INNER_26',
    'INNER_25',
    'INNER_24',
    'INNER_23',
    'INNER_22',
    'INNER_21',
    'INNER_20',
    'INNER_19',
    'INNER_18',
    'INNER_17',
    'INNER_16',
    'INNER_15',
    'INNER_14',
    'INNER_13',
    'INNER_12',
    'INNER_11',
    'INNER_10',
    'INNER_9',
    'INNER_8',
    'INNER_7',
    'INNER_6',
    'INNER_5',
    'INNER_4',
    'INNER_3',
    'INNER_2',
    'INNER_1',

    'TOP',
    'TOP_SOLDER_MASK',
    'TOP_PASTE_MASK',
    'TOP_SILKSCREEN',
    'TOP_ASSEMBLY',
    'TOP_STIFFENER',

    'MULTI',
    'BOARD_OUTLINE',
    'RATLINE',

    'HOLE',
    'DRILL_DRAWING',

    'COMPONENT_SHAPE',
    'COMPONENT_MARKING',
    'PIN_SOLDERING',
    'PIN_FLOATING',
    'COMPONENT_MODEL',

    'SHELL_3D_OUTLINE',
    'SHELL_3D_TOP',
    'SHELL_3D_BOTTOM',

    'SUBSTRATE_1',

    'MECHANICAL',
    'DOCUMENT',

    'CUSTOM_1',
    'CUSTOM_2',
    'CUSTOM_3',
    'CUSTOM_4',
    'CUSTOM_5',
    'CUSTOM_6',
    'CUSTOM_7',
    'CUSTOM_8',
    'CUSTOM_9',
    'CUSTOM_10',
    'CUSTOM_11',
    'CUSTOM_12',
    'CUSTOM_13',
    'CUSTOM_14',
    'CUSTOM_15',
    'CUSTOM_16',
    'CUSTOM_17',
    'CUSTOM_18',
    'CUSTOM_19',
    'CUSTOM_20',
    'CUSTOM_21',
    'CUSTOM_22',
    'CUSTOM_23',
    'CUSTOM_24',
    'CUSTOM_25',
    'CUSTOM_26',
    'CUSTOM_27',
    'CUSTOM_28',
    'CUSTOM_29',
    'CUSTOM_30',
];

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
export const LAYER_COLORS: Record<PcbLayerName | 'highlight' | 'netLabel', string> = {
    TOP: '#ffab91',
    TOP_SILKSCREEN: '#ffffff',
    TOP_SOLDER_MASK: '#2e7d32',
    TOP_PASTE_MASK: '#cfd8dc',
    TOP_ASSEMBLY: '#ffcc80',
    TOP_STIFFENER: '#a1887f',

    BOTTOM: '#82b1ff',
    BOTTOM_SILKSCREEN: '#ffffff',
    BOTTOM_SOLDER_MASK: '#2e7d32',
    BOTTOM_PASTE_MASK: '#cfd8dc',
    BOTTOM_ASSEMBLY: '#90caf9',
    BOTTOM_STIFFENER: '#a1887f',

    BOARD_OUTLINE: '#ff7fff',
    MULTI: '#ffab91',
    DOCUMENT: '#e0e0e0',
    MECHANICAL: '#9e9e9e',
    RATLINE: '#ffeb3b',

    ...Object.fromEntries(
        Array.from({ length: 30 }, (_, i) => [`INNER_${i + 1}`, INNER_COLORS[i]]),
    ) as Record<`INNER_${number}`, string>,

    ...Object.fromEntries(
        Array.from({ length: 30 }, (_, i) => [`CUSTOM_${i + 1}`, CUSTOM_COLORS[i]]),
    ) as Record<`CUSTOM_${number}`, string>,

    SUBSTRATE_1: '#8d6e63',
    HOLE: '#000000',
    COMPONENT_SHAPE: '#ffffff',
    COMPONENT_MARKING: '#eeeeee',
    PIN_SOLDERING: '#ffab91',
    PIN_FLOATING: '#82b1ff',
    COMPONENT_MODEL: '#bdbdbd',
    SHELL_3D_OUTLINE: '#ffffff',
    SHELL_3D_TOP: '#d7ccc8',
    SHELL_3D_BOTTOM: '#bcaaa4',
    DRILL_DRAWING: '#000000',

    highlight: '#ffeb3b',
    netLabel: '#000000',
};