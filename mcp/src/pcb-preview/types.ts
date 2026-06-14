export type LayerKey =
    | 'top'
    | 'bottom'
    | 'top_silkscreen'
    | 'bottom_silkscreen'
    | 'top_soldermask'
    | 'bottom_soldermask'
    | 'top_paste'
    | 'bottom_paste'
    | 'top_assembly'
    | 'bottom_assembly'
    | 'board_outline'
    | 'multi'
    | 'document'
    | 'mechanical'
    | string;

export type Point = [number, number];

export type PolygonSource = (number | string)[];

export interface PcbComponent {
    designator: string;
    x: number;
    y: number;
    rotate?: number;
    layer?: LayerKey;
}

export interface PcbPad {
    x: number;
    y: number;
    net?: string;
    padNumber?: string;
    designator?: string;
    layer: LayerKey;
    shapeType?: string;
    width?: number;
    height?: number;
    rotation?: number;
}

export interface PcbTrack {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    width: number;
    layer: LayerKey;
    net?: string;
}

export interface PcbArc {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    arcAngle: number;
    width: number;
    layer: LayerKey;
    net?: string;
}

export interface PcbVia {
    x: number;
    y: number;
    diameter: number;
    drill: number;
    net?: string;
}

export interface PcbPolygon {
    net: string;
    layer: LayerKey;
    fill: boolean;
    lineWidth: number;
    sources: PolygonSource[];
    /** Pre-computed rings kept for backward compatibility with old exports. */
    rings?: Point[][];
}

export interface PcbData {
    boardPolygon?: Point[];
    components?: PcbComponent[];
    pads?: PcbPad[];
    tracks?: PcbTrack[];
    arcs?: PcbArc[];
    vias?: PcbVia[];
    polygons?: PcbPolygon[];
}

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
    layers: LayerKey[];
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
