import type { PcbLayerName } from './shared';

export interface PreviewPcbInput {
    layers: (PcbLayerName | 'all')[];
    highlight_net?: string;
    highlight_component?: string;
    highlight_net_colors?: Record<string, string>;
    highlight_component_colors?: Record<string, string>;
    zoom: { mode: 'full' } | { mode: 'net'; net: string } | { mode: 'component'; designator: string }
        | { mode: 'bbox'; bbox: { x: number; y: number; width: number; height: number; unit?: 'mm' | 'rel' } };
    padding_mm: number;
}

export type PreviewPcbReply = { renderer: 'native'; base64: string; mime_type: string; notes: string[] };
