import type { Layer, PcbRuleLevel, TargetRef } from "./layout-model.ts";

export interface PcbViaStitchOptions {
    grid?: number;
    diameter?: number;
    drill?: number;
    clearance?: number;
    edge?: number;
    maxCount?: number;
}

export interface PcbViaStitchRule extends PcbViaStitchOptions {
    net: string;
    around?: TargetRef;
    area?: { left: number; right: number; top: number; bottom: number };
    margin?: number;
    source?: 'explicit' | 'polygon';
}

export interface PcbPolygonRule {
    net: string;
    kind: 'polygon' | 'power_polygon';
    around?: TargetRef;
    area?: { left: number; right: number; top: number; bottom: number };
    margin?: number;
    connect?: Array<Extract<TargetRef, { type: 'pin' }>>;
    expansion?: number;
    clearance?: number;
    minWidth?: number;
    minArea?: number;
    minPadConnections?: number;
    style?: 'compact' | 'smooth' | 'orthogonal45';
    cleanup?: 'none' | 'normal' | 'strong';
    stitch?: PcbViaStitchOptions;
}

export interface PcbRoutingRules {
    layers: Array<{
        name: string;
        side: Layer;
        direction: 'horizontal' | 'vertical' | 'any';
    }>;
    defaultTraceWidth: number;
    defaultClearance: number;
    defaultViaDiameter: number;
    defaultViaDrill: number;
    ignoredSignals: string[];
    stitchRules: PcbViaStitchRule[];
    polygonRules: PcbPolygonRule[];
    netClasses: Array<{
        name: string;
        signals: string[];
        traceWidth?: number;
        clearance?: number;
        zIndex?: number;
        routeMode?: 'route' | 'ignore';
    }>;
}
