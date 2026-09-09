import type { BoardEdge, Box, Layer, PlacementRelationKind, Point } from '#types/pcb/layout-model.ts';

export const NATIVE_BOARD_PACK_CONTRACT_VERSION = 3 as const;
export const NATIVE_BLOCK_SOLVE_CONTRACT_VERSION = 2 as const;
export const NATIVE_PASSIVE_ISLAND_CONTRACT_VERSION = 1 as const;
export const NATIVE_POST_PLACE_SCORE_CONTRACT_VERSION = 1 as const;
export const NATIVE_SIGNAL_PATH_CONTRACT_VERSION = 1 as const;

export interface NativePlacement {
    designator: string;
    x: number;
    y: number;
    rotate: number;
    layer: Layer;
    score: number;
}

export interface NativeConnectionPoint extends Point {
    ref: string;
    net?: string;
}

export interface NativePathPort extends Point {
    pathId: string;
    order: number;
    ref: string;
    role: 'source' | 'target' | 'entry' | 'exit';
    normal: Point;
}

export interface NativeEdgePlaceIntent {
    edges: BoardEdge[];
    inset?: number;
    align?: 'center' | 'start' | 'end';
    x?: number;
    y?: number;
    offset?: number;
}

export interface NativePrimitive {
    id: string;
    kind: 'component' | 'island' | 'block' | 'module' | 'board';
    label: string;
    sourceNodeId: string;
    sourceNodeIds: string[];
    locked: boolean;
    canRotate: boolean;
    allowedOrientations: number[];
    bbox: Box;
    collisionBoxes: Box[];
    width: number;
    height: number;
    placements: NativePlacement[];
    connectionPoints: NativeConnectionPoint[];
    pathPorts: NativePathPort[];
    edgePlace: NativeEdgePlaceIntent | null;
}

export interface NativeRelation {
    id: string;
    kind: PlacementRelationKind;
    from: string;
    to: string;
    relation?: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    hard: boolean;
    weight?: number;
    effect: 'move_from' | 'move_both' | 'score_only' | 'lock';
    maxDistance?: number;
    minDistance?: number;
    satelliteAnchor: boolean;
    anchorOffset?: Point;
    sidePreference?: BoardEdge;
    pathId?: string;
    pathShape?: 'flexible' | 'straight';
    preferFacingPads: boolean;
}

export interface NativeComponentGeometry {
    designator: string;
    primitiveId: string;
    blockName: string;
    layer: Layer;
    bodyBox: Box;
    throughHoleBoxes: Box[];
}

export interface NativeBoardComponentGeometry extends NativeComponentGeometry {
    boardOverflow: { left: number; right: number; top: number; bottom: number };
    edgeClearance: number;
}

export interface NativeConstraintRegion {
    name: string;
    box: Box;
    layers: Layer[];
    allowBlocks: string[];
}

export interface NativeBoardPackProblemV3 {
    version: typeof NATIVE_BOARD_PACK_CONTRACT_VERSION;
    grid: number;
    clearance: number;
    searchWidth: number;
    compactness: 'normal' | 'high';
    bounds: Box;
    fullBoardBounds: Box;
    boardOutline: Point[];
    edgeClearance: number;
    primitives: NativePrimitive[];
    relations: NativeRelation[];
    obstacles: Box[];
    constraintRegions: NativeConstraintRegion[];
    components: NativeBoardComponentGeometry[];
    componentPairClearance: number[];
    componentConflict: number[];
}

export interface NativePrimitiveState {
    primitiveId: string;
    rotation: number;
    translationX: number;
    translationY: number;
    placements?: NativePlacement[];
}

export interface NativePrimitivePackSolution {
    version: number;
    states: NativePrimitiveState[];
    rank: { hardCount: number; hardSeverity: number; score: number };
}

export interface NativeBoardPackSolutionV3 extends NativePrimitivePackSolution {
    version: typeof NATIVE_BOARD_PACK_CONTRACT_VERSION;
}

export interface NativeBlockSolveSolutionV2 extends NativePrimitivePackSolution {
    version: typeof NATIVE_BLOCK_SOLVE_CONTRACT_VERSION;
}

export interface NativeBoardPackerAddon {
    contractVersion(): number;
    solveBoardPacked(problem: NativeBoardPackProblemV3): NativeBoardPackSolutionV3;
    blockContractVersion(): number;
    solveBlockPrimitives(problem: NativeBlockSolveProblemV2): NativeBlockSolveSolutionV2;
    passiveIslandContractVersion(): number;
    solvePassiveNetIsland(problem: NativePassiveIslandProblemV1): NativePassiveIslandSolutionV1;
    postPlaceScoreContractVersion(): number;
    scorePostPlace(problem: NativePostPlaceScoreProblemV1): number;
    signalPathContractVersion(): number;
    evaluateSignalPath(problem: NativeSignalPathEvaluationProblemV1): NativeSignalPathTopologyEvaluation | null;
    signalPathBridgeDeltas(problem: NativeSignalPathBridgeProblemV1): Point[];
}

export interface NativeBlockComponentGeometry extends NativeComponentGeometry {
    pinCount: number;
    role?: string;
    powerComponent: boolean;
}

export interface NativeBlockSolveProblemV2 {
    version: typeof NATIVE_BLOCK_SOLVE_CONTRACT_VERSION;
    grid: number;
    clearance: number;
    searchWidth: number;
    compactness: 'normal' | 'high';
    targetWidth?: number;
    targetHeight?: number;
    bounds?: Box;
    collisionMode: 'components' | 'envelope' | 'hybrid';
    hardCollisionMode: 'components' | 'primitive';
    candidateBoxMode: 'bbox' | 'collision';
    primitives: NativePrimitive[];
    relations: NativeRelation[];
    obstacles: Box[];
    components: NativeBlockComponentGeometry[];
    componentPairClearance: number[];
    componentConflict: number[];
}

export interface NativePassiveIslandOrientation {
    rotation: number;
    width: number;
    height: number;
    bodyBox: Box;
    throughHoleBoxes: Box[];
    pinPoints: Array<Point | null>;
}

export interface NativePassiveIslandComponent {
    id: number;
    designator: string;
    layer: Layer;
    pinNetIds: number[];
    orientations: NativePassiveIslandOrientation[];
}

export interface NativePassiveIslandProblemV1 {
    version: typeof NATIVE_PASSIVE_ISLAND_CONTRACT_VERSION;
    grid: number;
    clearance: number;
    mainNetId: number;
    netNames: string[];
    netGround: boolean[];
    components: NativePassiveIslandComponent[];
    componentPairClearance: number[];
    componentConflict: number[];
}

export interface NativePassiveIslandPlacement {
    componentId: number;
    x: number;
    y: number;
    rotation: number;
}

export interface NativePassiveIslandSolutionV1 {
    version: typeof NATIVE_PASSIVE_ISLAND_CONTRACT_VERSION;
    placements: NativePassiveIslandPlacement[];
    score: number;
    legal: boolean;
    evaluatedVariants: number;
}

export interface NativePostPlaceScoreProblemV1 {
    version: typeof NATIVE_POST_PLACE_SCORE_CONTRACT_VERSION;
    nets: Array<{ name: string; points: Point[]; weight: number }>;
    distances: Array<{ source: Point; target: Point; weight: number; min?: number; max?: number }>;
    clearances: Array<{ source: Box; target: Box; minimum: number; weight: number }>;
    fixedPenalties: number[];
    edges: Array<{ source: Box; board: Box; edge: BoardEdge; weight: number }>;
    paths: Array<{
        pathId: string;
        ports: NativePathPort[];
        shape: 'flexible' | 'straight';
        priority: 'low' | 'normal' | 'high' | 'critical';
        weight: number;
        preferFacingPads: boolean;
    }>;
}

export interface NativeSignalPathEvaluationProblemV1 {
    version: typeof NATIVE_SIGNAL_PATH_CONTRACT_VERSION;
    pathId: string;
    ports: NativePathPort[];
    shape: 'flexible' | 'straight';
    priority: 'low' | 'normal' | 'high' | 'critical';
    weight: number;
    preferFacingPads: boolean;
}

export interface NativeSignalPathBridgeProblemV1 {
    version: typeof NATIVE_SIGNAL_PATH_CONTRACT_VERSION;
    movingPorts: NativePathPort[];
    placedPorts: NativePathPort[];
}

export interface NativeSignalPathTopologyEvaluation {
    pathId: string;
    shape: 'flexible' | 'straight';
    resolvedPoints: number;
    firstOrder: number;
    lastOrder: number;
    directDistance: number;
    pathDistance: number;
    detour: number;
    backtrack: number;
    turns: number;
    facing: number;
    penalty: number;
}
