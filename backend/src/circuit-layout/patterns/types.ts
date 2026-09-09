import type { ElkExtendedEdge } from 'elkjs';
import type { PositionedSchNode } from '#types/auto-place.ts';
import type { Circuit, CircuitComponent } from '#types/circuit.ts';
import type { SymbolPin, SymbolWithMeta } from '#types/symbol.ts';

export type OrthogonalSide = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';

export interface PatternPinEndpoint {
    designator: string;
    blockName: string;
    pinNumber: string | number;
    signalName: string;
}

export interface PatternContext {
    circuit: Circuit;
    componentsByBlock: Map<string, CircuitComponent[]>;
    componentsByDesignator: Map<string, CircuitComponent>;
    signalEndpoints: Map<string, PatternPinEndpoint[]>;
    symbolsByDesignator: Map<string, SymbolWithMeta>;
}

export interface PatternMatch {
    patternId: string;
    priority: number;
    blockName: string;
    designators: string[];
    roles: Record<string, string>;
}

export interface RotatedSymbolGeometry {
    width: number;
    height: number;
    center: { x: number; y: number };
    pins: SymbolPin[];
}

export interface MacroComponentPlacement extends PositionedSchNode {
    blockName: string;
    generatedComponent?: CircuitComponent;
    pins: Array<SymbolPin & {
        id: string;
        side: OrthogonalSide;
        routingSignalName?: string;
    }>;
}

export interface MacroPort {
    key: string;
    pinNumber: string;
    elkPortId: string;
    signalName: string;
    x: number;
    y: number;
    side: OrthogonalSide;
    terminalSide: OrthogonalSide;
    primaryPinId: string;
    tailMode?: 'routed' | 'straight';
    tailBendPoints?: { x: number; y: number }[];
}

export interface MacroRoutedPath {
    id: string;
    signalName: string;
    sourcePinId: string;
    targetPinId: string;
    points: { x: number; y: number }[];
    kind: 'internal' | 'port-tail';
    macroPortId?: string;
}

export interface MacroInstance {
    id: string;
    patternId: string;
    blockName: string;
    absorbedDesignators: string[];
    node: SymbolWithMeta;
    placements: MacroComponentPlacement[];
    ports: MacroPort[];
    routedPaths: MacroRoutedPath[];
    forceRoutedSignals?: string[];
    routingClearance?: number;
    preferredBlockDirection?: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';
    /** Opt-in rigid turns of an expanded passive group during refinement. */
    refinementRotations?: readonly (90 | 180 | 270)[];
    layoutChildBlock?: {
        name: string;
        description: string;
        layoutOptions: Record<string, string>;
    };
}

export interface CircuitLayoutPattern {
    id: string;
    priority: number;
    findMatches(context: PatternContext): PatternMatch[];
    instantiate(match: PatternMatch, context: PatternContext): MacroInstance | null;
}

export interface PatternCollapseResult {
    macros: MacroInstance[];
    absorbedDesignators: Set<string>;
}

export interface PatternExpansionResult {
    positioned: PositionedSchNode[];
    edges: ElkExtendedEdge[];
    addedSymbols: CircuitComponent[];
}
