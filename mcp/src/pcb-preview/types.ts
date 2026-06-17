import { PcbLayerName } from "@copilot/shared/types/pcb/shared";

export interface BboxMm {
    x: number;
    y: number;
    width: number;
    height: number;
    unit?: 'mm';
}

export interface BboxRel {
    x: number;
    y: number;
    width: number;
    height: number;
    unit: 'rel';
}

export type Bbox = BboxMm | BboxRel;

export type ZoomTarget =
    | { mode: 'full' }
    | { mode: 'net'; net: string }
    | { mode: 'component'; designator: string }
    | { mode: 'bbox'; bbox: Bbox };

export interface PreviewShowOptions {
    tracks?: boolean;
    pads?: boolean;
    vias?: boolean;
    polygons?: boolean;
    components?: boolean;
    netLabels?: boolean;
}

export interface PreviewOptions {
    layers: (PcbLayerName | "all")[];
    highlightNets: string[];
    highlightComponents: string[];
    highlightNetColors?: Record<string, string>;
    highlightComponentColors?: Record<string, string>;
    zoom: ZoomTarget;
    paddingMm: number;
    show: PreviewShowOptions;
    widthPx: number;
    polygonLabelStepMm?: number;
    debug?: boolean;
}

export interface PreviewResult {
    svg: string;
    pngBuffer: Buffer;
    viewBox: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    };
}
