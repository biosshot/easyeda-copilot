import type {
    BlockRole,
    BlockPlacement,
    BoardAnchor,
    BoardEdge,
    CenteredRectBoard,
    ComponentRole,
    FootprintPad,
    FootprintSpec,
    HintPriority,
    PcbBlock,
    PcbComponent,
    Placement,
    PlacementInput,
    PlacementHint,
    TargetRef,
    Point,
    Box,
} from '../../types/pcb/layout-model.ts';
import { isConnectedSignalName } from '#utils/signals.ts';
import { dist, GEOMETRY_EPSILON } from './geometry.ts';

export const defaultSolverOptions = {
    candidateRadii: [1.2, 2.0, 3.5, 5.0, 8.0, 12.0, 18.0],
    candidateAngles: [0, 45, 90, 135, 180, 225, 270, 315],
    fallbackGridStep: 4,
    placementGridStep: 1,
    ignoredRatsnestSignals: ['GND'],
    localImproveIterations: 16,
    localImproveMinDelta: 0.05,
    hierarchicalBlocks: true,
    compactness: 'normal' as const,
    preview: false,
    placeOnlyComponents: [] as string[],
    ignoreComponents: [] as string[],
};

export function centeredBoard(width: number, height: number): CenteredRectBoard {
    return {
        coordinateSystem: 'centered',
        outline: { type: 'rect', width, height },
        defaultLayer: 'top',
        allowedLayers: ['top'],
        clearances: {
            component: 0.35,
            edge: 0.8,
        },
    };
}

export function footprint(name: string, width: number, height: number, pads: FootprintPad[]): FootprintSpec {
    return { name, width, height, pads };
}

export function pad(pin_number: string | number, x: number, y: number, width: number, height: number): FootprintPad {
    return { pin_number, name: String(pin_number), x, y, width, height };
}

export function qfnPads(
    pinCount: 32 | 48,
    bodySize: number,
    pitch: number,
    padWidth: number,
    padHeight: number,
    aliasesByPin: Record<number, string>,
) {
    const pinsPerSide = pinCount / 4;
    const half = bodySize / 2 + 0.3;
    const first = -((pinsPerSide - 1) * pitch) / 2;
    const pads: FootprintPad[] = [];

    for (let index = 0; index < pinsPerSide; index++) {
        const offset = first + index * pitch;
        const topPin = index + 1;
        const rightPin = pinsPerSide + index + 1;
        const bottomPin = pinsPerSide * 2 + index + 1;
        const leftPin = pinsPerSide * 3 + index + 1;

        pads.push(pad(aliasesByPin[topPin] ?? `NC${topPin}`, offset, -half, padWidth, padHeight));
        pads.push(pad(aliasesByPin[rightPin] ?? `NC${rightPin}`, half, offset, padHeight, padWidth));
        pads.push(pad(aliasesByPin[bottomPin] ?? `NC${bottomPin}`, -offset, half, padWidth, padHeight));
        pads.push(pad(aliasesByPin[leftPin] ?? `NC${leftPin}`, -half, -offset, padHeight, padWidth));
    }

    return pads.sort((a, b) => naturalPinOrder(a.pin_number) - naturalPinOrder(b.pin_number));
}

export function component(designator: string, value: string, footprintValue: FootprintSpec, blockName: string, role: ComponentRole, nets: Record<string, string>): PcbComponent {
    return {
        designator,
        value,
        pins: Object.entries(nets).map(([pin_number, signal_name]) => ({ pin_number, name: pin_number, signal_name })),
        block_name: blockName,
        search_query: `${value} ${footprintValue.name}`,
        part_uuid: null,
        footprint: footprintValue,
        pcb: {
            role,
            allowedLayers: ['top'],
            allowedRotations: [0, 90, 180, 270],
        },
    };
}

export function block(
    name: string,
    description: string,
    componentDesignators: string[],
    role: BlockRole,
    options: {
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
    } = {},
): PcbBlock {
    return { name, description, component_designators: componentDesignators, role, ...options };
}

export function comp(designator: string): TargetRef {
    return { type: 'component', designator };
}

export function pin(designator: string, pin_number: string | number): TargetRef {
    return { type: 'pin', designator, pin_number };
}

export function blockRef(block_name: string): TargetRef {
    return { type: 'block', block_name };
}

export function anchor(anchorValue: BoardAnchor): TargetRef {
    return { type: 'board_anchor', anchor: anchorValue };
}

export function nearHint(source: TargetRef, target: TargetRef, priority: HintPriority): PlacementHint {
    return { relation: 'near', source, target, priority };
}

export function veryNearHint(source: TargetRef, target: TargetRef, priority: HintPriority): PlacementHint {
    return { relation: 'very_near', source, target, priority };
}

export function criticalPairHint(
    source: Extract<TargetRef, { type: 'pin' }>,
    target: Extract<TargetRef, { type: 'pin' }>,
    priority: HintPriority = 'critical',
    options: {
        maxDistance?: number;
        minDistance?: number;
        weightMultiplier?: number;
        hard?: boolean;
        crossingPenalty?: number;
        preferFacingPads?: boolean;
        core?: boolean;
        block?: string;
    } = {},
): PlacementHint {
    return { relation: 'critical_pair', source, target, priority, ...options };
}

export function awayHint(source: TargetRef, target: TargetRef, priority: HintPriority): PlacementHint {
    return { relation: 'away_from', source, target, priority };
}

export function clearanceHint(source: TargetRef, target: TargetRef | 'all', min: number, priority: HintPriority): PlacementHint {
    return { relation: 'clearance', source, target, min, priority };
}

export function sameSideHint(source: TargetRef, target: TargetRef, priority: HintPriority): PlacementHint {
    return { relation: 'same_side', source, target, priority };
}

export function edgeHint(designator: string, edge: BoardEdge, orientation: 'outward' | 'inward' | 'any', priority: HintPriority): PlacementHint {
    return { relation: 'edge', source: { type: 'component', designator }, edge, orientation, priority };
}

export function lineHint(components: string[], axis: 'x' | 'y', gap: number, priority: HintPriority, rotate?: number): PlacementHint {
    return { relation: 'line', components, axis, gap, rotate, priority };
}

export function bypassHint(capacitors: string[], target: Extract<TargetRef, { type: 'pin' }>, priority: HintPriority, axis?: 'x' | 'y', rotate?: number): PlacementHint {
    return { relation: 'bypass', capacitors, target, priority, axis, rotate };
}

export function naturalPinOrder(pinNumber: string | number) {
    const match = String(pinNumber).match(/\d+$/);
    return match ? Number(match[0]) : 0;
}

export function componentArea(component: PcbComponent) {
    return component.footprint.width * component.footprint.height;
}

export function componentHasThroughHolePads(component: PcbComponent) {
    return component.footprint.pads.some((pad) => pad.mount === 'through_hole' || (pad.drillDiameter ?? 0) > 0);
}

export function placementsCanConflict(a: PcbComponent, aPlacement: Placement, b: PcbComponent, bPlacement: Placement) {
    return aPlacement.layer === bPlacement.layer
        || componentHasThroughHolePads(a)
        || componentHasThroughHolePads(b);
}

export function isFixedComponent(component: PcbComponent) {
    return component.pcb.fixedPlacement !== undefined;
}

export function orientation(a: Point, b: Point, c: Point) {
    const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
    if (Math.abs(value) < GEOMETRY_EPSILON) return 0;
    return value > 0 ? 1 : 2;
}

export function pointOnSegment(point: Point, a: Point, b: Point) {
    return point.x <= Math.max(a.x, b.x) + GEOMETRY_EPSILON
        && point.x >= Math.min(a.x, b.x) - GEOMETRY_EPSILON
        && point.y <= Math.max(a.y, b.y) + GEOMETRY_EPSILON
        && point.y >= Math.min(a.y, b.y) - GEOMETRY_EPSILON;
}

export function pointInsideBox(point: Point, box: Box) {
    return point.x >= box.left - GEOMETRY_EPSILON
        && point.x <= box.right + GEOMETRY_EPSILON
        && point.y >= box.top - GEOMETRY_EPSILON
        && point.y <= box.bottom + GEOMETRY_EPSILON;
}

export function expandBox(box: Box, amount: number): Box {
    return {
        left: box.left - amount,
        right: box.right + amount,
        top: box.top - amount,
        bottom: box.bottom + amount,
    };
}

export function pathLength(path: Point[]) {
    return path.reduce((sum, point, index) => index === 0 ? 0 : sum + dist(path[index - 1], point), 0);
}

export function normalizeVector(vector: Point): Point | null {
    const length = Math.hypot(vector.x, vector.y);
    if (length < GEOMETRY_EPSILON) return null;
    return { x: vector.x / length, y: vector.y / length };
}

export function segmentIntersectsBox(a: Point, b: Point, box: Box) {
    if (pointInsideBox(a, box) || pointInsideBox(b, box)) return true;

    const corners = [
        { x: box.left, y: box.top },
        { x: box.right, y: box.top },
        { x: box.right, y: box.bottom },
        { x: box.left, y: box.bottom },
    ];

    return segmentsIntersect(a, b, corners[0], corners[1])
        || segmentsIntersect(a, b, corners[1], corners[2])
        || segmentsIntersect(a, b, corners[2], corners[3])
        || segmentsIntersect(a, b, corners[3], corners[0]);
}

export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point) {
    const o1 = orientation(a, b, c);
    const o2 = orientation(a, b, d);
    const o3 = orientation(c, d, a);
    const o4 = orientation(c, d, b);

    if (o1 === 0 && pointOnSegment(c, a, b)) return true;
    if (o2 === 0 && pointOnSegment(d, a, b)) return true;
    if (o3 === 0 && pointOnSegment(a, c, d)) return true;
    if (o4 === 0 && pointOnSegment(b, c, d)) return true;

    return o1 !== o2 && o3 !== o4;
}

export function pathIntersectsObstacles(path: Point[], obstacles: Box[]) {
    for (let index = 1; index < path.length; index += 1) {
        const a = path[index - 1];
        const b = path[index];
        if (dist(a, b) < GEOMETRY_EPSILON) continue;
        if (obstacles.some((obstacle) => segmentIntersectsBox(a, b, obstacle))) return true;
    }

    return false;
}

export function isConnectedSignal(signalName: string | undefined | null): signalName is string {
    return isConnectedSignalName(signalName);
}

export function ignoredSignalSet(input: PlacementInput) {
    const ignoredSignals = new Set(input.solverOptions.ignoredRatsnestSignals);
    for (const component of input.components) {
        for (const pinValue of component.pins) {
            if (!isConnectedSignal(pinValue.signal_name)) ignoredSignals.add(pinValue.signal_name);
        }
    }
    return ignoredSignals;
}

export function allNets(input: PlacementInput) {
    return [...new Set(input.components.flatMap((component) => component.pins
        .map((pin) => pin.signal_name)
        .filter(isConnectedSignal)))];
}
