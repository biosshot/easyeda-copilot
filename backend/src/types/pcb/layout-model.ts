import type { SolverOptions } from "./layout-rules.ts";
import type { PcbRoutingRules } from "./routing-model.ts";
import { z } from "zod";

export type Layer = 'top' | 'bottom';
export type BoardPadLayer = Layer | 'multi';
export type BoardPadShape = 'rect' | 'oval' | 'round';
export type BoardEdge = 'left' | 'right' | 'top' | 'bottom';
export type BoardAnchor =
    | 'board.center'
    | 'board.left'
    | 'board.right'
    | 'board.top'
    | 'board.bottom'
    | 'board.top_left'
    | 'board.top_right'
    | 'board.bottom_left'
    | 'board.bottom_right';
export type ComponentRole = 'connector' | 'main_ic' | 'decoupling_cap' | 'crystal' | 'passive' | 'indicator';
export type BlockRole = 'power' | 'mcu' | 'analog' | 'rf' | 'connector' | 'sensor' | 'generic';
export type BlockPlacement = 'main' | 'satellite';
export type PcbRuleLevel = 'low' | 'normal' | 'high' | 'critical';
export type HintPriority = PcbRuleLevel;
export type MechanicalFaceDirection = 'left' | 'right' | 'top' | 'bottom';
export type MechanicalFaceSource = 'explicit' | 'auto_pads';
export type EdgeMountFace = 'outward' | 'inward' | 'any' | MechanicalFaceDirection;
export type EdgePlaceFace = EdgeMountFace;

export interface Point {
    x: number;
    y: number;
}

export const ExistingPlacementSchema = () => z.object({
    board: z.object({
        polygon: z.array(z.object({
            x: z.number(),
            y: z.number(),
        })).min(3),
    }).strict().optional(),
    components: z.array(z.object({
        designator: z.string(),
        x: z.number(),
        y: z.number(),
        rotate: z.number(),
        layer: z.enum(['top', 'bottom']),
    }).strict()),
}).strict();

export type ExistingPlacement = z.infer<ReturnType<typeof ExistingPlacementSchema>>;

export type BoardOutline =
    | {
        type: 'rect';
        width: number;
        height: number;
    }
    | {
        type: 'polygon';
        width: number;
        height: number;
        points: Point[];
    };

export const PCB_PLACEMENT_ASSUMPTIONS = {
    units: 'mm',
    boardOrigin: 'center',
    footprintOrigin: 'center',
    padOrigin: 'footprint_center',
    rotation: 'degrees_counter_clockwise',
    yAxis: 'down',
} as const;

export interface CenteredRectBoard {
    coordinateSystem: 'centered';
    outline: BoardOutline;
    defaultLayer: Layer;
    allowedLayers: Layer[];
    clearances: {
        component: number;
        edge: number;
    };
}

export interface BoardHole {
    name: string;
    x: number;
    y: number;
    drill: number;
    diameter: number;
    keepout: number;
}

export interface FootprintPad {
    pin_number: string | number;
    name?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    shape?: BoardPadShape;
    mount?: 'smd' | 'through_hole';
    drillDiameter?: number;
}

export type FootprintGraphicLayer = 'silk' | 'body' | 'marking' | 'document' | 'other';

export type FootprintGraphic =
    | {
        kind: 'path';
        layer: FootprintGraphicLayer;
        points: Point[];
        closed: boolean;
        strokeWidth: number;
    }
    | {
        kind: 'circle';
        layer: FootprintGraphicLayer;
        x: number;
        y: number;
        radius: number;
        strokeWidth: number;
    };

export interface FootprintSpec {
    name: string;
    width: number;
    height: number;
    pads: FootprintPad[];
    graphics?: FootprintGraphic[];
    sourceOriginOffset?: Point;
}

const FootprintPointSchema = () => z.object({
    x: z.number(),
    y: z.number(),
});

export const FootprintSpecSchema = () => z.object({
    name: z.string(),
    width: z.number().positive(),
    height: z.number().positive(),
    pads: z.array(z.object({
        pin_number: z.union([z.string(), z.number()]),
        name: z.string().optional(),
        x: z.number(),
        y: z.number(),
        width: z.number().positive(),
        height: z.number().positive(),
        shape: z.enum(["rect", "oval", "round"]).optional(),
        mount: z.enum(["smd", "through_hole"]).optional(),
        drillDiameter: z.number().positive().optional(),
    })),
    graphics: z.array(z.discriminatedUnion("kind", [
        z.object({
            kind: z.literal("path"),
            layer: z.enum(["silk", "body", "marking", "document", "other"]),
            points: z.array(FootprintPointSchema()),
            closed: z.boolean(),
            strokeWidth: z.number().nonnegative(),
        }),
        z.object({
            kind: z.literal("circle"),
            layer: z.enum(["silk", "body", "marking", "document", "other"]),
            x: z.number(),
            y: z.number(),
            radius: z.number().nonnegative(),
            strokeWidth: z.number().nonnegative(),
        }),
    ])).optional(),
    sourceOriginOffset: FootprintPointSchema().optional(),
});

export interface PcbPin {
    pin_number: string | number;
    name: string;
    signal_name: string;
}

export interface PcbComponent {
    designator: string;
    value: string;
    pins: PcbPin[];
    block_name: string;
    search_query: string;
    part_uuid: string | null;
    footprint_uuid?: string | null;
    footprint: FootprintSpec;
    pcb: {
        role: ComponentRole;
        allowedLayers: Layer[];
        allowedRotations: number[];
        prohibitRoutingUnder?: boolean;
        prohibitRoutingUnderAllowOwnNets?: boolean;
        fixedPlacement?: PcbFixedPlacement;
        boardOverflow?: PcbBoardOverflowAllowance;
        edgeMount?: PcbEdgeMountOptions;
        edgePlace?: PcbEdgePlaceOptions;
        mechanicalFaceAt0?: MechanicalFaceDirection;
        mechanicalFaceAt0Source?: MechanicalFaceSource;
        faceTo?: MechanicalFaceDirection;
        faceWarning?: string;
        designatorText?: PcbDesignatorTextOptions;
        syntheticBoardPad?: PcbSyntheticBoardPad;
        syntheticFootprint?: PcbGeneratedGeometry;
        generatedGeometry?: PcbGeneratedGeometry[];
    };
}

export interface PcbSyntheticBoardPadHole {
    diameter: number;
    offset?: Point;
}

export interface PcbSyntheticBoardPadCell {
    pin_number: string | number;
    name: string;
    net: string;
    x: number;
    y: number;
    shape: BoardPadShape;
    width?: number;
    height?: number;
    diameter?: number;
    hole?: PcbSyntheticBoardPadHole;
}

export interface PcbSyntheticBoardPad {
    name: string;
    layer: BoardPadLayer;
    pads: PcbSyntheticBoardPadCell[];
}

export type PcbGeneratedGeometryLayer = 'same' | 'opposite';

export interface PcbGeneratedPad {
    name: string;
    net: string;
    x: number;
    y: number;
    layer: PcbGeneratedGeometryLayer;
    shape: BoardPadShape;
    width?: number;
    height?: number;
    diameter?: number;
}

export interface PcbGeneratedTrack {
    net: string;
    layer: PcbGeneratedGeometryLayer;
    width: number;
    points: Point[];
}

export interface PcbGeneratedVia {
    name: string;
    net: string;
    x: number;
    y: number;
    diameter: number;
    drill: number;
}

export interface PcbGeneratedPolygon {
    net: string;
    layer: PcbGeneratedGeometryLayer;
    points: Point[];
}

export interface PcbGeneratedKeepout {
    layers: Layer[];
    points: Point[];
}

export interface PcbGeneratedGeometry {
    kind: 'solder_jumper' | 'thermal_pad' | 'antenna';
    name: string;
    pads: PcbGeneratedPad[];
    tracks: PcbGeneratedTrack[];
    vias: PcbGeneratedVia[];
    polygons: PcbGeneratedPolygon[];
    routingKeepouts?: PcbGeneratedKeepout[];
    diagnostics?: string[];
}

export interface PcbEdgeMountOptions {
    edge: BoardEdge;
    overhang?: number;
    face?: EdgeMountFace;
    align?: 'center' | 'start' | 'end';
    x?: number;
    y?: number;
    offset?: number;
    layer?: Layer;
    slide?: boolean;
}

export interface PcbEdgePlaceOptions {
    edges: BoardEdge[];
    inset?: number;
    face?: EdgePlaceFace;
    align?: 'center' | 'start' | 'end';
    x?: number;
    y?: number;
    offset?: number;
    layer?: Layer;
}

export interface PcbBoardOverflowAllowance {
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
}

export interface PcbDesignatorTextOptions {
    enabled?: boolean;
    height?: number;
    rotations?: number[];
    margin?: number;
}

export interface PcbSilkscreenRules {
    designators: PcbDesignatorTextOptions;
}

export interface PcbConstraintRegion {
    name: string;
    box: Box;
    layers: Layer[];
    allowBlocks: string[];
}

export interface PcbFixedPlacement {
    x?: number;
    y?: number;
    anchor?: Extract<TargetRef, { type: 'board_anchor' }>;
    offset?: { x?: number; y?: number };
    rotate?: number;
    layer?: Layer;
}

export interface PcbBlock {
    name: string;
    description: string;
    component_designators: string[];
    role: BlockRole;
    placement?: BlockPlacement;
    attachTo?: string;
    anchor?: TargetRef;
    anchorOffset?: Point;
    sidePreference?: BoardEdge;
    maxBboxScale?: number;
    maxBboxWidth?: number;
    maxBboxHeight?: number;
    hardBbox?: boolean;
    maxAnchorGap?: number;
    hardAnchor?: boolean;
    familyMaxBboxScale?: number;
    familyMaxWidth?: number;
    familyMaxHeight?: number;
    familyHard?: boolean;
    placementClearance?: number;
    allowDisconnected?: boolean;
}

export interface PcbModule {
    name: string;
    block_names: string[];
    anchor?: TargetRef;
    sidePreference?: BoardEdge;
    maxBboxScale?: number;
    maxWidth?: number;
    maxHeight?: number;
    hardBbox?: boolean;
    lockInternalAfterPlace?: boolean;
    allowInternalRefine?: false | 'satellitesOnly' | 'all';
    placementPriority?: PcbRuleLevel;
}

export interface SignalPathSegment {
    index: number;
    source: Extract<TargetRef, { type: 'pin' }>;
    target: Extract<TargetRef, { type: 'pin' }>;
    priority: HintPriority;
    maxDistance?: number;
    minDistance?: number;
    weightMultiplier?: number;
    hard?: boolean;
    crossingPenalty?: number;
    preferFacingPads?: boolean;
}

export interface SignalPathStage {
    index: number;
    designator: string;
    entryPin: string | number;
    exitPin: string | number;
    blockName: string;
}

export interface PlacementSignalPath {
    id: string;
    priority: HintPriority;
    shape: 'flexible' | 'straight';
    preferFacingPads: boolean;
    segments: SignalPathSegment[];
    stages: SignalPathStage[];
    terminals: {
        first: Extract<TargetRef, { type: 'pin' }>;
        last: Extract<TargetRef, { type: 'pin' }>;
    };
}

export interface PlacementRefineGroup {
    name: string;
    componentDesignators: string[];
    swap: boolean;
    /** Additional rotations relative to a resolved post-placement pose. */
    rotateBy: number[];
}

export interface SignalPathRelationMetadata {
    id: string;
    segmentIndex: number;
    segmentCount: number;
    shape: PlacementSignalPath['shape'];
}

export type TargetRef =
    | { type: 'component'; designator: string }
    | { type: 'pin'; designator: string; pin_number: string | number }
    | { type: 'block'; block_name: string }
    | { type: 'board_anchor'; anchor: BoardAnchor };

export type PlacementHint =
    | {
        relation: 'very_near' | 'near' | 'away_from' | 'same_side' | 'cluster_with';
        source: TargetRef;
        target: TargetRef;
        priority: HintPriority;
        reason?: string;
    }
    | {
        relation: 'clearance';
        source: TargetRef;
        target: TargetRef | 'all';
        min: number;
        priority: HintPriority;
        reason?: string;
    }
    | {
        relation: 'edge';
        source: Extract<TargetRef, { type: 'component' | 'block' }>;
        edge: BoardEdge;
        orientation?: 'outward' | 'inward' | 'any';
        priority: HintPriority;
        reason?: string;
    }
    | {
        relation: 'prefer_layer';
        source: Extract<TargetRef, { type: 'component' | 'block' }>;
        layer: Layer;
        priority: HintPriority;
        reason?: string;
    }
    | {
        relation: 'line';
        components: string[];
        axis: 'x' | 'y';
        gap?: number;
        rotate?: number;
        priority: HintPriority;
        reason?: string;
    }
    | {
        relation: 'bypass';
        capacitors: string[];
        target: Extract<TargetRef, { type: 'pin' }>;
        axis?: 'x' | 'y';
        gap?: number;
        rotate?: number;
        priority: HintPriority;
        reason?: string;
    }
    | {
        relation: 'cap_cluster';
        capacitors: string[];
        powerNet: string;
        returnNet: string;
        target?: Extract<TargetRef, { type: 'pin' }>;
        axis?: 'x' | 'y';
        maxRows?: 1 | 2;
        maxPerRow?: number;
        gap?: number;
        rowGap?: number;
        topology?: 'edge_bus' | 'center_power_bus';
        priority: HintPriority;
        reason?: string;
    }
    | {
        relation: 'critical_pair';
        source: Extract<TargetRef, { type: 'pin' }>;
        target: Extract<TargetRef, { type: 'pin' }>;
        priority: HintPriority;
        maxDistance?: number;
        minDistance?: number;
        weightMultiplier?: number;
        hard?: boolean;
        crossingPenalty?: number;
        preferFacingPads?: boolean;
        core?: boolean;
        block?: string;
        path?: SignalPathRelationMetadata;
        reason?: string;
    };

export type RemoveNull<T> = {
    [K in keyof T]: NonNullable<T[K]>;
};

export interface PlacementInput {
    board: CenteredRectBoard;
    boardHoles?: BoardHole[];
    silkscreen?: PcbSilkscreenRules;
    constraintRegions: PcbConstraintRegion[];
    components: PcbComponent[];
    blocks: PcbBlock[];
    modules: PcbModule[];
    hints: PlacementHint[];
    /** Ordered placement intent. Optional for source compatibility; normalized DSL input always supplies an array. */
    paths?: PlacementSignalPath[];
    /** Explicit post-placement search scopes. Optional for source compatibility. */
    refineGroups?: PlacementRefineGroup[];
    solverOptions: RemoveNull<SolverOptions>;
}

export interface Placement {
    designator: string;
    x: number;
    y: number;
    rotate: number;
    layer: Layer;
    score: number;
}

export interface PlacementStage {
    name: string;
    placements: Placement[];
    data: unknown
}

export type PlacementIslandKind = 'line' | 'bypass' | 'cap_cluster' | 'core_pairs';

export type PlacementTreeNodeKind = 'board' | 'module' | 'block' | 'island' | 'component' | 'pad';

export interface PlacementTreeNode {
    id: string;
    kind: PlacementTreeNodeKind;
    label: string;
    ref?: string;
    children: PlacementTreeNode[];
    data?: Record<string, unknown>;
}

export interface PlacementGraphDiagnostic {
    severity: 'error' | 'warning';
    code: string;
    message: string;
    nodeId?: string;
    edgeId?: string;
}

export type PlacementRelationKind =
    | 'net'
    | 'mechanical'
    | 'anchor'
    | 'hint'
    | 'critical_pair'
    | 'clearance'
    | 'edge'
    | 'prefer_layer'
    | 'island_target';

export interface PlacementRelation {
    id: string;
    kind: PlacementRelationKind;
    from: string;
    to: string;
    relation?: PlacementHint['relation'];
    priority?: HintPriority;
    hard?: boolean;
    weight?: number;
    scope: string;
    effect: 'move_from' | 'move_both' | 'score_only' | 'lock';
    data?: Record<string, unknown>;
}

export interface PlacementGraphReport {
    ok: boolean;
    treeNodes: number;
    relations: number;
    roots: number;
    maxDepth: number;
    components: number;
    pads: number;
    nets: number;
    blocks: number;
    modules: number;
    islands: number;
    islandKinds: Partial<Record<PlacementIslandKind, number>>;
    orphanComponents: string[];
    unparentedBlocks: string[];
    diagnostics: PlacementGraphDiagnostic[];
}

export interface PlacementGraph {
    root: PlacementTreeNode;
    relations: PlacementRelation[];
    paths: PlacementSignalPath[];
    report: PlacementGraphReport;
}

export interface PcbLayout {
    assumptions: typeof PCB_PLACEMENT_ASSUMPTIONS;
    board: CenteredRectBoard;
    boardHoles: BoardHole[];
    silkscreen?: PcbSilkscreenRules;
    routingRules: PcbRoutingRules;
    components: Array<{
        designator: string;
        value: string;
        block_name: string;
        footprint: FootprintSpec;
        x: number;
        y: number;
        rotate: number;
        layer: Layer;
        prohibitRoutingUnder?: boolean;
        prohibitRoutingUnderAllowOwnNets?: boolean;
        designatorText?: PcbDesignatorTextOptions;
        syntheticBoardPad?: PcbSyntheticBoardPad;
        syntheticFootprint?: PcbGeneratedGeometry;
        generatedGeometry?: PcbGeneratedGeometry[];
    }>;
    nets: Array<{
        signal_name: string;
        pins: Array<{ designator: string; pin_number: string | number }>;
    }>;
}

export interface PlacementReport {
    ok: boolean;
    placed: number;
    unplaced: string[];
    blockReports: Array<{
        name: string;
        components: number;
        box: Box;
        width: number;
        height: number;
        area: number;
        estimatedWidth: number;
        estimatedHeight: number;
        estimatedArea: number;
        widthRatio: number;
        heightRatio: number;
        areaRatio: number;
        oversized: boolean;
        limitViolations?: string[];
    }>;
    moduleReports: Array<{
        name: string;
        blocks: string[];
        components: number;
        box: Box;
        width: number;
        height: number;
        area: number;
        limitViolations?: string[];
        oversized: boolean;
        locked: boolean;
    }>;
    graphReport: PlacementGraphReport;
    outsideBoard: Array<{ designator: string; box: Box; board: Box }>;
    overlaps: Array<{ a: string; b: string; gap: number; required: number }>;
    boardHoleViolations: Array<{ designator: string; hole: string; gap: number; required: number }>;
    constraintRegionViolations: Array<{ designator: string; region: string; block: string; overlap: number }>;
    layerViolations: Array<{ designator: string; layer: Layer; allowedLayers: Layer[] }>;
    hintViolations: Array<{ hint: PlacementHint; actual: number | string; expected: string }>;
    signalPaths: Array<{
        id: string;
        shape: PlacementSignalPath['shape'];
        priority: HintPriority;
        resolved: boolean;
        withinConstraints: boolean;
        directDistance: number | null;
        pathDistance: number | null;
        detour: number | null;
        backtrack: number | null;
        turns: number | null;
        facing: number | null;
        segments: Array<{
            index: number;
            source: string;
            target: string;
            resolved: boolean;
            distance: number | null;
            minDistance?: number;
            maxDistance?: number;
            withinConstraints: boolean;
        }>;
    }>;
    scoreByComponent: Array<{ designator: string; score: number }>;
}

export interface Box {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export interface ScoredCandidate extends Placement {
    hardViolation: boolean;
}

export interface NumericRule {
    kind: 'distance' | 'clearance' | 'same_side' | 'edge' | 'prefer_layer';
    source: TargetRef;
    target?: TargetRef | 'all';
    edge?: BoardEdge;
    layer?: Layer;
    orientation?: 'outward' | 'inward' | 'any';
    min?: number;
    max?: number;
    weight: number;
    hard?: boolean;
    criticalPair?: boolean;
    corePair?: boolean;
    crossingPenalty?: number;
    preferFacingPads?: boolean;
}

export class PlacementError extends Error {
    readonly report: PlacementReport;

    constructor(message: string, report: PlacementReport) {
        super(message);
        this.name = 'PlacementError';
        this.report = report;
    }
}
