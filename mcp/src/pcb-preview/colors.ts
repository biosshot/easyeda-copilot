import type { LayerKey } from './types.js';

export const LAYER_ORDER: LayerKey[] = [
    'bottom',
    'bottom_silkscreen',
    'top',
    'top_silkscreen',
    'multi',
];

export const LAYER_COLORS: Record<string, string> = {
    board: '#0f3d0f',
    board_edge: '#ffffff',
    top: '#ffab91',
    bottom: '#82b1ff',
    multi: '#ffab91',
    top_silkscreen: '#ffffff',
    bottom_silkscreen: '#ffffff',
    highlight: '#ffeb3b',
    drill: '#000000',
    component: '#ffffff',
};
