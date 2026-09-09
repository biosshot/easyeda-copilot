import type {
    Box,
    Layer,
    PcbComponent,
    Placement,
    PlacementGraph,
    PlacementInput,
    PlacementTreeNode,
    Point,
} from '#types/pcb/layout-model.ts';
import {
    componentBox,
    componentPairCollisionBoxPairs,
    dist,
    getPadOffset,
    overlaps,
    pointsBox,
    roundPlacement,
    rotatedSize,
    unionBoxes,
} from '../pcb-auto-place/geometry.ts';
import type { ClearanceResolver } from '../pcb-auto-place/clearance-resolver.ts';
import { createClearanceResolver } from '../pcb-auto-place/clearance-resolver.ts';
import { placementsCanConflict } from '../pcb-auto-place/utils.ts';

type IslandKind = 'line' | 'bypass' | 'cap_cluster' | 'core_pairs';

export interface IslandSolverOptions {
    grid?: number;
    clearance?: number;
}

export interface IslandSolveDiagnostic {
    severity: 'warning' | 'error';
    message: string;
}

export interface IslandSolveResult {
    islandId: string;
    label: string;
    kind: IslandKind;
    scope: string;
    placements: Placement[];
    bbox: Box;
    width: number;
    height: number;
    area: number;
    score: number;
    diagnostics: IslandSolveDiagnostic[];
}

type CandidatePlacement = Placement & { box: Box; component: PcbComponent };

type IslandNode = PlacementTreeNode & {
    kind: 'island';
    data: Record<string, unknown> & {
        kind: IslandKind;
        components?: string[];
    };
};

export function solvePlacementIslands(
    input: PlacementInput,
    graph: PlacementGraph,
    options: IslandSolverOptions = {},
): IslandSolveResult[] {
    const componentByDesignator = new Map(input.components.map((component) => [component.designator, component]));
    const grid = options.grid ?? input.solverOptions.placementGridStep ?? 0.5;
    const clearance = options.clearance ?? input.board.clearances.component ?? 0.8;
    const clearanceResolver = createClearanceResolver(input);
    return collectIslandNodes(graph.root)
        .map((island) => solveIsland(island, input, componentByDesignator, grid, clearance, clearanceResolver))
        .filter((result): result is IslandSolveResult => Boolean(result));
}

function solveIsland(
    island: IslandNode,
    input: PlacementInput,
    componentByDesignator: Map<string, PcbComponent>,
    grid: number,
    clearance: number,
    clearanceResolver: ClearanceResolver,
): IslandSolveResult | null {
    const components = island.data.components
        ?.map((designator) => componentByDesignator.get(designator))
        .filter((component): component is PcbComponent => Boolean(component)) ?? [];
    if (components.length === 0) return null;

    const diagnostics: IslandSolveDiagnostic[] = [];
    const kind = island.data.kind;
    const placements = kind === 'cap_cluster'
        ? solveCapCluster(island, components, input, grid, clearance, clearanceResolver)
        : kind === 'core_pairs' && components.length === 2
            ? solveTwoComponentCorePairs(island, components, grid, clearance, clearanceResolver)
        : kind === 'bypass'
            ? solveBypass(island, input, components, grid, clearance, clearanceResolver)
        : kind === 'line'
            ? solveOrderedIsland(island, input, components, grid, clearance, clearanceResolver)
            : solveCompactIsland(island, components, grid, clearance, clearanceResolver);

    const bbox = placementsBox(components, placements);
    const score = scorePlacements(island, components, placements, clearanceResolver);
    if (hasOverlap(components, placements, clearanceResolver)) {
        diagnostics.push({ severity: 'error', message: 'Island placements overlap after compact solve' });
    }

    return {
        islandId: island.id,
        label: island.label,
        kind,
        scope: island.ref ?? island.id,
        placements: placements.map(({ designator, x, y, rotate, layer, score }) => ({ designator, x, y, rotate, layer, score })),
        bbox,
        width: roundPlacement(bbox.right - bbox.left),
        height: roundPlacement(bbox.bottom - bbox.top),
        area: roundPlacement((bbox.right - bbox.left) * (bbox.bottom - bbox.top)),
        score: roundPlacement(score),
        diagnostics,
    };
}

function solveCapCluster(island: IslandNode, components: PcbComponent[], input: PlacementInput, grid: number, clearance: number, clearanceResolver: ClearanceResolver): CandidatePlacement[] {
    const axis = island.data.axis === 'x' || island.data.axis === 'y' ? island.data.axis : null;
    const maxRows = island.data.maxRows === 1 || island.data.maxRows === 2 ? island.data.maxRows : 2;
    const topology = island.data.topology === 'center_power_bus' ? 'center_power_bus' : 'edge_bus';
    const gap = typeof island.data.gap === 'number' ? Math.max(island.data.gap, clearance) : clearance;
    const rowGap = typeof island.data.rowGap === 'number' ? Math.max(island.data.rowGap, clearance) : gap;
    const axes: Array<'x' | 'y'> = axis ? [axis] : ['x', 'y'];
    const rotations = normalizedRotations(components[0]);
    const variants: CandidatePlacement[][] = [];

    for (const candidateAxis of axes) {
        const powerSide = targetPinPowerSide(island, input, candidateAxis);
        for (let rows = 1; rows <= maxRows; rows += 1) {
            const maxPerRow = typeof island.data.maxPerRow === 'number'
                ? Math.max(1, Math.floor(island.data.maxPerRow))
                : Math.ceil(components.length / rows);
            const actualRows = Math.ceil(components.length / maxPerRow);
            if (actualRows > maxRows) continue;
            if (topology === 'center_power_bus' && rows === 1 && maxRows >= 2 && Math.ceil(components.length / maxPerRow) >= 2) {
                // a two-row center_power_bus variant will be generated at rows === 2
                continue;
            }
            if (topology === 'center_power_bus' && rows === 2 && actualRows === 2) {
                variants.push(placeCenterPowerBus(components, candidateAxis, maxPerRow, grid, gap, rowGap, island, powerSide));
            } else if (actualRows === 1) {
                variants.push(placeRowWithPowerSide(components, candidateAxis, powerSide, gap, grid, island));
            } else {
                for (const rotate of rotationsForAxis(rotations, components, island, candidateAxis)) {
                    variants.push(placeGrid(components, candidateAxis, maxPerRow, rotate, grid, clearance, gap, rowGap));
                }
            }
        }
    }

    return bestVariant(island, components, variants, clearance, clearanceResolver);
}

function solveOrderedIsland(island: IslandNode, input: PlacementInput, components: PcbComponent[], grid: number, clearance: number, clearanceResolver: ClearanceResolver): CandidatePlacement[] {
    const axis = island.data.axis === 'x' || island.data.axis === 'y' ? island.data.axis : chooseCompactAxis(components);
    const rotate = bestLineRotation(components, axis, island, input, clearance, clearanceResolver);
    return placeGrid(components, axis, components.length, rotate, grid, clearance);
}

function solveBypass(island: IslandNode, input: PlacementInput, components: PcbComponent[], grid: number, clearance: number, _clearanceResolver: ClearanceResolver): CandidatePlacement[] {
    if (components.length === 0) return [];
    const promoted = promotedBypassClusterData(island, input, components);
    if (promoted) {
        return solveCapCluster({ ...island, data: { ...island.data, ...promoted } }, components, input, grid, clearance, _clearanceResolver);
    }
    const axis = island.data.axis === 'x' || island.data.axis === 'y' ? island.data.axis : chooseCompactAxis(components);
    const gap = typeof island.data.gap === 'number' ? Math.max(island.data.gap, clearance) : clearance;
    const targetNet = resolveTargetNet(island, input);
    const explicitRotate = typeof island.data.rotate === 'number' ? normalizeRotation(island.data.rotate) : null;
    const rotate = explicitRotate ?? (targetNet ? bestBypassRotation(components, axis, targetNet) : bestLineRotation(components, axis, island, input, clearance, _clearanceResolver));
    return placeGrid(components, axis, components.length, rotate, grid, clearance, gap);
}

function promotedBypassClusterData(island: IslandNode, input: PlacementInput, components: PcbComponent[]) {
    if (island.data.kind !== 'bypass' || components.length < 5) return null;
    const powerNet = resolveTargetNet(island, input);
    if (!powerNet) return null;
    const returnNet = commonBypassReturnNet(components, powerNet);
    if (!returnNet) return null;
    return {
        kind: 'cap_cluster' as const,
        powerNet,
        returnNet,
        maxRows: 2,
        maxPerRow: Math.ceil(components.length / 2),
        topology: 'center_power_bus',
        axis: island.data.axis === 'x' || island.data.axis === 'y' ? island.data.axis : null,
        rowGap: typeof island.data.rowGap === 'number' ? island.data.rowGap : island.data.gap,
    };
}

function commonBypassReturnNet(components: PcbComponent[], powerNet: string) {
    const counts = new Map<string, number>();
    for (const component of components) {
        const nets = new Set(component.pins
            .map((pin) => pin.signal_name)
            .filter((net): net is string => Boolean(net) && net !== powerNet));
        for (const net of nets) counts.set(net, (counts.get(net) ?? 0) + 1);
    }
    return [...counts.entries()]
        .filter(([, count]) => count >= Math.max(2, Math.floor(components.length * 0.5)))
        .sort((a, b) => b[1] - a[1] || Number(isGroundNet(b[0])) - Number(isGroundNet(a[0])) || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}

function bestBypassRotation(components: PcbComponent[], axis: 'x' | 'y', targetNet: string): number {
    const rotations = normalizedRotations(components[0]);
    const scored = rotations.map((rotate) => {
        let sumAbs = 0;
        let positive = 0;
        let negative = 0;
        for (const component of components) {
            const pin = component.pins.find((item) => item.signal_name === targetNet);
            if (!pin) continue;
            const offset = getPadOffset(component, pin.pin_number, rotate);
            if (!offset) continue;
            const cross = axis === 'x' ? offset.y : offset.x;
            sumAbs += Math.abs(cross);
            if (cross > 0.0001) positive += 1;
            else if (cross < -0.0001) negative += 1;
        }
        const sameSide = positive === 0 || negative === 0;
        return { rotate, score: sameSide ? sumAbs : sumAbs * 0.2 };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.rotate ?? 0;
}

function solveCompactIsland(island: IslandNode, components: PcbComponent[], grid: number, clearance: number, clearanceResolver: ClearanceResolver): CandidatePlacement[] {
    const ordered = components
        .slice()
        .sort((a, b) => pairDegree(island, b.designator) - pairDegree(island, a.designator) || footprintArea(b) - footprintArea(a));
    const placed: CandidatePlacement[] = [];

    for (const component of ordered) {
        const candidates = compactCandidates(component, placed, grid, clearance);
        let best = candidates[0];
        let bestScore = Infinity;
        for (const candidate of candidates) {
            const variant = [...placed, candidate];
            if (hasOverlap(ordered, variant, clearanceResolver)) continue;
            const score = scorePlacements(island, ordered, variant, clearanceResolver);
            if (score < bestScore) {
                best = candidate;
                bestScore = score;
            }
        }
        placed.push(best);
    }

    return centerPlacements(placed, grid);
}

function solveTwoComponentCorePairs(island: IslandNode, components: PcbComponent[], grid: number, clearance: number, clearanceResolver: ClearanceResolver): CandidatePlacement[] {
    const anchor = selectCoreAnchor(island, components);
    const moving = components.find((component) => component.designator !== anchor.designator) ?? components[1];
    const variants: CandidatePlacement[][] = [];

    for (const anchorRotate of coreAnchorRotations(anchor)) {
        const anchorPlacement = candidatePlacement(anchor, 0, 0, anchorRotate);
        for (const movingRotate of normalizedRotations(moving)) {
            for (const center of movingCentersAround(anchorPlacement.box, rotatedSize(moving.footprint, movingRotate), grid, clearance)) {
                variants.push([
                    anchorPlacement,
                    candidatePlacement(moving, center.x, center.y, movingRotate),
                ]);
            }
        }
    }

    return centerPlacements(bestCorePairVariant(island, components, variants, clearanceResolver), grid);
}

function coreAnchorRotations(anchor: PcbComponent) {
    const rotations = normalizedRotations(anchor);
    if (anchor.pcb.role !== 'main_ic') return rotations;
    const scored = rotations.map((rotate) => ({ rotate, score: pinOneUpperLeftRotationPenalty(anchor, rotate) }));
    const best = Math.min(...scored.map((item) => item.score));
    return scored
        .filter((item) => item.score <= best + 0.001)
        .map((item) => item.rotate);
}

function selectCoreAnchor(island: IslandNode, components: PcbComponent[]) {
    return components.slice().sort((a, b) =>
        Number(b.pcb.role === 'main_ic') - Number(a.pcb.role === 'main_ic')
        || pairDegree(island, b.designator) - pairDegree(island, a.designator)
        || b.footprint.pads.length - a.footprint.pads.length
        || footprintArea(b) - footprintArea(a))[0];
}

function movingCentersAround(anchorBox: Box, movingSize: { width: number; height: number }, _grid: number, clearance: number) {
    const anchorCenter = {
        x: (anchorBox.left + anchorBox.right) / 2,
        y: (anchorBox.top + anchorBox.bottom) / 2,
    };
    const offsets = uniqueNumbers([
        0,
        clearance,
        -clearance,
        clearance * 2,
        -clearance * 2,
        movingSize.width / 2,
        -movingSize.width / 2,
        movingSize.height / 2,
        -movingSize.height / 2,
    ]);
    const baseCenters = [
        { x: anchorBox.left - clearance - movingSize.width / 2, y: anchorCenter.y, axis: 'y' as const },
        { x: anchorBox.right + clearance + movingSize.width / 2, y: anchorCenter.y, axis: 'y' as const },
        { x: anchorCenter.x, y: anchorBox.top - clearance - movingSize.height / 2, axis: 'x' as const },
        { x: anchorCenter.x, y: anchorBox.bottom + clearance + movingSize.height / 2, axis: 'x' as const },
    ];
    const centers: Point[] = [];
    for (const base of baseCenters) {
        for (const offset of offsets) {
            centers.push({
                x: roundPlacement(base.x + (base.axis === 'x' ? offset : 0)),
                y: roundPlacement(base.y + (base.axis === 'y' ? offset : 0)),
            });
        }
    }
    return dedupePoints(centers);
}

function bestCorePairVariant(island: IslandNode, components: PcbComponent[], variants: CandidatePlacement[][], clearanceResolver: ClearanceResolver) {
    return variants
        .filter((variant) => !hasOverlap(components, variant, clearanceResolver))
        .sort((a, b) => scoreCorePairVariant(island, components, a, clearanceResolver) - scoreCorePairVariant(island, components, b, clearanceResolver))[0]
        ?? variants.sort((a, b) => scoreCorePairVariant(island, components, a, clearanceResolver) - scoreCorePairVariant(island, components, b, clearanceResolver))[0]
        ?? [];
}

function scoreCorePairVariant(island: IslandNode, components: PcbComponent[], placements: CandidatePlacement[], clearanceResolver: ClearanceResolver) {
    const pairs = parseIslandPairs(island);
    const bbox = placementsBox(components, placements);
    let score = hasOverlap(components, placements, clearanceResolver) ? 1_000_000 : 0;

    let pairScore = 0;
    let sumDistance = 0;
    let maxDistance = 0;
    const expectedMax = typeof island.data.maxDistance === 'number' ? island.data.maxDistance : null;
    for (const [a, b] of pairs) {
        const first = padWorld(components, placements, a);
        const second = padWorld(components, placements, b);
        if (!first || !second) continue;
        const value = dist(first, second);
        const excess = expectedMax !== null ? Math.max(0, value - expectedMax) : 0;
        pairScore += value + excess * excess * 100;
        sumDistance += value;
        maxDistance = Math.max(maxDistance, value);
    }

    score += (pairs.length > 0 ? pairScore * 10_000 : 0);
    score += pairBalancePenalty(island, components, placements) * 25;
    score += pairSegmentCrossingPenalty(island, components, placements) * 600;
    score += facingPadsPenalty(island, components, placements) * 15;
    score += (bbox.right - bbox.left) * (bbox.bottom - bbox.top) * 0.4;
    score += sumDistance + maxDistance;
    score += anchorPinOneUpperLeftPenalty(island, components, placements) * 5;
    return score;
}

function pairBalancePenalty(island: IslandNode, components: PcbComponent[], placements: CandidatePlacement[]) {
    const distances = parseIslandPairs(island).map(([a, b]) => {
        const first = padWorld(components, placements, a);
        const second = padWorld(components, placements, b);
        return first && second ? dist(first, second) : 0;
    }).filter((value) => value > 0);
    if (distances.length < 2) return 0;
    return Math.max(...distances) - Math.min(...distances);
}

function pairSegmentCrossingPenalty(island: IslandNode, components: PcbComponent[], placements: CandidatePlacement[]) {
    const segments = parseIslandPairs(island).map(([a, b]) => {
        const first = padWorld(components, placements, a);
        const second = padWorld(components, placements, b);
        return first && second ? [first, second] as const : null;
    }).filter((segment): segment is readonly [Point, Point] => Boolean(segment));
    let penalty = 0;
    for (let i = 0; i < segments.length; i += 1) {
        for (let j = i + 1; j < segments.length; j += 1) {
            if (segmentsCross(segments[i][0], segments[i][1], segments[j][0], segments[j][1])) penalty += 1;
        }
    }
    return penalty;
}

function facingPadsPenalty(island: IslandNode, components: PcbComponent[], placements: CandidatePlacement[]) {
    let penalty = 0;
    for (const [a, b] of parseIslandPairs(island)) {
        const [aDesignator, aPin] = a.split('.');
        const [bDesignator, bPin] = b.split('.');
        const aComponent = components.find((component) => component.designator === aDesignator);
        const bComponent = components.find((component) => component.designator === bDesignator);
        const aPlacement = placements.find((placement) => placement.designator === aDesignator);
        const bPlacement = placements.find((placement) => placement.designator === bDesignator);
        if (!aComponent || !bComponent || !aPlacement || !bPlacement) continue;
        const aPad = padPoint(aComponent, aPlacement, aPin);
        const bPad = padPoint(bComponent, bPlacement, bPin);
        if (!aPad || !bPad) continue;
        const aOut = normalizeVector({ x: aPad.x - aPlacement.x, y: aPad.y - aPlacement.y });
        const bOut = normalizeVector({ x: bPad.x - bPlacement.x, y: bPad.y - bPlacement.y });
        const link = normalizeVector({ x: bPad.x - aPad.x, y: bPad.y - aPad.y });
        penalty += Math.max(0, 1 - dot(aOut, link));
        penalty += Math.max(0, 1 + dot(bOut, link));
    }
    return penalty;
}

function anchorPinOneUpperLeftPenalty(island: IslandNode, components: PcbComponent[], placements: CandidatePlacement[]) {
    const anchor = selectCoreAnchor(island, components);
    const placement = placements.find((item) => item.designator === anchor.designator);
    if (!placement) return 0;
    const pinOne = getPadOffset(anchor, '1', placement.rotate, placement.layer);
    if (!pinOne) return 0;
    return pinOneUpperLeftPenaltyForOffset(anchor, pinOne, placement.rotate);
}

function pinOneUpperLeftRotationPenalty(component: PcbComponent, rotate: number) {
    const pinOne = getPadOffset(component, '1', rotate, component.pcb.allowedLayers[0] ?? 'top');
    return pinOne ? pinOneUpperLeftPenaltyForOffset(component, pinOne, rotate) : 0;
}

function pinOneUpperLeftPenaltyForOffset(component: PcbComponent, pinOne: Point, rotate: number) {
    const size = rotatedSize(component.footprint, rotate);
    const normalizedX = pinOne.x / Math.max(size.width / 2, 0.001);
    const normalizedY = pinOne.y / Math.max(size.height / 2, 0.001);
    return Math.max(0, normalizedX + 0.25) ** 2
        + Math.max(0, normalizedY + 0.25) ** 2
        + Math.max(0, normalizedX - normalizedY) * 0.15;
}

function compactCandidates(component: PcbComponent, placed: CandidatePlacement[], grid: number, clearance: number) {
    const candidates: CandidatePlacement[] = [];
    const rotations = normalizedRotations(component);
    if (placed.length === 0) {
        for (const rotate of rotations) candidates.push(candidatePlacement(component, 0, 0, rotate));
        return candidates;
    }

    const bbox = unionBoxes(placed.map((placement) => placement.box));
    for (const rotate of rotations) {
        const size = rotatedSize(component.footprint, rotate);
        const offsets = [
            { x: bbox.right + clearance + size.width / 2, y: 0 },
            { x: bbox.left - clearance - size.width / 2, y: 0 },
            { x: 0, y: bbox.bottom + clearance + size.height / 2 },
            { x: 0, y: bbox.top - clearance - size.height / 2 },
            { x: bbox.right + clearance + size.width / 2, y: bbox.bottom + clearance + size.height / 2 },
            { x: bbox.right + clearance + size.width / 2, y: bbox.top - clearance - size.height / 2 },
            { x: bbox.left - clearance - size.width / 2, y: bbox.bottom + clearance + size.height / 2 },
            { x: bbox.left - clearance - size.width / 2, y: bbox.top - clearance - size.height / 2 },
        ];
        for (const point of offsets) candidates.push(candidatePlacement(component, snap(point.x, grid), snap(point.y, grid), rotate));
    }
    return candidates;
}

function placeGrid(
    components: PcbComponent[],
    axis: 'x' | 'y',
    maxPerRow: number,
    rotate: number,
    grid: number,
    clearance: number,
    gap?: number,
    rowGap?: number,
): CandidatePlacement[] {
    const componentGap = Math.max(gap ?? clearance, clearance);
    const rowSpacing = Math.max(rowGap ?? gap ?? clearance, clearance);
    const sizes = components.map((component) => rotatedSize(component.footprint, rotate));
    const rowCount = Math.ceil(components.length / maxPerRow);
    const rowSizes: Array<{ width: number; height: number }> = [];
    for (let row = 0; row < rowCount; row += 1) {
        const rowComponents = components.slice(row * maxPerRow, (row + 1) * maxPerRow);
        const rowComponentSizes = sizes.slice(row * maxPerRow, (row + 1) * maxPerRow);
        const width = axis === 'x'
            ? rowComponentSizes.reduce((sum, size) => sum + size.width, 0) + componentGap * Math.max(0, rowComponents.length - 1)
            : Math.max(...rowComponentSizes.map((size) => size.width));
        const height = axis === 'x'
            ? Math.max(...rowComponentSizes.map((size) => size.height))
            : rowComponentSizes.reduce((sum, size) => sum + size.height, 0) + componentGap * Math.max(0, rowComponents.length - 1);
        rowSizes.push({ width, height });
    }

    const placements: CandidatePlacement[] = [];
    let crossCursor = -rowSizes.reduce((sum, size) => sum + (axis === 'x' ? size.height : size.width), 0) / 2
        - rowSpacing * Math.max(0, rowCount - 1) / 2;
    for (let row = 0; row < rowCount; row += 1) {
        const start = row * maxPerRow;
        const end = Math.min(components.length, start + maxPerRow);
        const rowSize = rowSizes[row];
        let mainCursor = -(axis === 'x' ? rowSize.width : rowSize.height) / 2;
        const crossCenter = crossCursor + (axis === 'x' ? rowSize.height : rowSize.width) / 2;
        for (let index = start; index < end; index += 1) {
            const component = components[index];
            const size = sizes[index];
            const mainCenter = mainCursor + (axis === 'x' ? size.width : size.height) / 2;
            const x = axis === 'x' ? mainCenter : crossCenter;
            const y = axis === 'x' ? crossCenter : mainCenter;
            placements.push(candidatePlacement(component, roundPlacement(x), roundPlacement(y), rotate));
            mainCursor += (axis === 'x' ? size.width : size.height) + componentGap;
        }
        crossCursor += (axis === 'x' ? rowSize.height : rowSize.width) + rowSpacing;
    }
    return centerPlacements(placements, grid);
}

function targetPinPowerSide(island: IslandNode, input: PlacementInput, axis: 'x' | 'y'): 1 | -1 {
    const target = island.data.target;
    if (!target || typeof target !== 'object' || (target as { type?: string }).type !== 'pin') return 1;
    const pinTarget = target as { type: 'pin'; designator: string; pin_number: string | number };
    const component = input.components.find((item) => item.designator === pinTarget.designator);
    if (!component) return 1;
    const pin = component.pins.find((item) => String(item.pin_number) === String(pinTarget.pin_number));
    if (!pin) return 1;
    const pad = component.footprint.pads.find((item) => String(item.pin_number) === String(pin.pin_number));
    if (!pad) return 1;
    return axis === 'x' ? (pad.y >= 0 ? 1 : -1) : (pad.x >= 0 ? 1 : -1);
}

function placeCenterPowerBus(
    components: PcbComponent[],
    axis: 'x' | 'y',
    maxPerRow: number,
    grid: number,
    gap: number,
    rowGap: number,
    island: IslandNode,
    powerSide: 1 | -1,
): CandidatePlacement[] {
    const rowCount = Math.ceil(components.length / maxPerRow);
    if (rowCount < 2) {
        return placeRowWithPowerSide(components, axis, powerSide, gap, grid, island);
    }

    const rows: CandidatePlacement[][] = [];
    for (let row = 0; row < rowCount; row += 1) {
        const start = row * maxPerRow;
        const rowComponents = components.slice(start, start + maxPerRow);
        const desiredSide = row === 0 ? powerSide : (-powerSide as 1 | -1);
        rows.push(placeRowWithPowerSide(rowComponents, axis, desiredSide, gap, grid, island));
    }

    const rowCrossSizes = rows.map((rowPlacements) => {
        const box = unionBoxes(rowPlacements.map((placement) => placement.box));
        return axis === 'x' ? box.bottom - box.top : box.right - box.left;
    });
    const totalCross = rowCrossSizes.reduce((sum, size) => sum + size, 0) + rowGap * (rows.length - 1);
    let crossCursor = -totalCross / 2;

    const result: CandidatePlacement[] = [];
    for (let row = 0; row < rows.length; row += 1) {
        const rowBox = unionBoxes(rows[row].map((placement) => placement.box));
        const rowCrossCenter = crossCursor + rowCrossSizes[row] / 2;
        const dx = axis === 'x' ? -(rowBox.left + rowBox.right) / 2 : rowCrossCenter;
        const dy = axis === 'x' ? rowCrossCenter : -(rowBox.top + rowBox.bottom) / 2;
        for (const placement of rows[row]) {
            result.push(candidatePlacement(placement.component, roundPlacement(placement.x + dx), roundPlacement(placement.y + dy), placement.rotate));
        }
        crossCursor += rowCrossSizes[row] + rowGap;
    }
    return result;
}

function placeRowWithPowerSide(
    components: PcbComponent[],
    axis: 'x' | 'y',
    desiredSide: 1 | -1,
    gap: number,
    grid: number,
    island: IslandNode,
): CandidatePlacement[] {
    const placements: CandidatePlacement[] = [];
    const sizes: Array<{ width: number; height: number }> = [];
    for (const component of components) {
        const rotations = normalizedRotations(component);
        const { powerPin, returnPin } = powerReturnPins(component, island);
        let bestRotate = rotations[0] ?? 0;
        let bestScore = -Infinity;
        for (const rotate of rotations) {
            const powerOffset = powerPin ? getPadOffset(component, powerPin.pin_number, rotate) : null;
            const returnOffset = returnPin ? getPadOffset(component, returnPin.pin_number, rotate) : null;
            if (!powerOffset || !returnOffset) continue;
            const powerCross = axis === 'x' ? powerOffset.y : powerOffset.x;
            const returnCross = axis === 'x' ? returnOffset.y : returnOffset.x;
            const axisAlign = Math.abs(axis === 'x' ? powerOffset.x - returnOffset.x : powerOffset.y - returnOffset.y);
            const score = powerCross * desiredSide + returnCross * (-desiredSide) - axisAlign;
            if (score > bestScore) {
                bestScore = score;
                bestRotate = rotate;
            }
        }
        sizes.push(rotatedSize(component.footprint, bestRotate));
        placements.push(candidatePlacement(component, 0, 0, bestRotate));
    }

    const mainSize = sizes.reduce((sum, size) => sum + (axis === 'x' ? size.width : size.height), 0) + gap * Math.max(0, sizes.length - 1);
    let mainCursor = -mainSize / 2;
    const result: CandidatePlacement[] = [];
    for (let index = 0; index < components.length; index += 1) {
        const size = sizes[index];
        const mainCenter = mainCursor + (axis === 'x' ? size.width : size.height) / 2;
        const x = axis === 'x' ? mainCenter : 0;
        const y = axis === 'x' ? 0 : mainCenter;
        result.push(candidatePlacement(components[index], roundPlacement(x), roundPlacement(y), placements[index].rotate));
        mainCursor += (axis === 'x' ? size.width : size.height) + gap;
    }
    return centerPlacements(result, grid);
}

function powerReturnPins(component: PcbComponent, island: IslandNode) {
    const powerNet = typeof island.data.powerNet === 'string' ? island.data.powerNet : null;
    const returnNet = typeof island.data.returnNet === 'string' ? island.data.returnNet : null;
    const powerPin = powerNet ? component.pins.find((pin) => pin.signal_name === powerNet) ?? null : null;
    const returnPin = returnNet ? component.pins.find((pin) => pin.signal_name === returnNet) ?? null : null;
    return { powerPin, returnPin };
}

function bestVariant(island: IslandNode, components: PcbComponent[], variants: CandidatePlacement[][], clearance: number, clearanceResolver: ClearanceResolver) {
    return variants.reduce((best, variant) =>
        scorePlacements(island, components, variant, clearanceResolver) < scorePlacements(island, components, best, clearanceResolver)
            ? variant
            : best,
    variants[0] ?? []);
}

function scorePlacements(island: IslandNode, components: PcbComponent[], placements: CandidatePlacement[], clearanceResolver: ClearanceResolver) {
    if (placements.length === 0) return Infinity;
    const bbox = placementsBox(components, placements);
    const width = bbox.right - bbox.left;
    const height = bbox.bottom - bbox.top;
    let score = width * height * 2 + (width + height);
    if (hasOverlap(components, placements, clearanceResolver)) score += 1_000_000;
    score += pairDistancePenalty(island, components, placements) * 8;
    score += sameNetPadSpreadPenalty(components, placements) * 5;
    score += capClusterPadAlignmentPenalty(island, components, placements) * 6;
    return score;
}

function pairDistancePenalty(island: IslandNode, components: PcbComponent[], placements: CandidatePlacement[]) {
    const pairs = parseIslandPairs(island);
    let penalty = 0;
    for (const [a, b] of pairs) {
        const first = padWorld(components, placements, a);
        const second = padWorld(components, placements, b);
        if (!first || !second) continue;
        penalty += dist(first, second);
    }
    return penalty;
}

const GROUND_NET_SPREAD_WEIGHT = 0.2;

function isGroundNet(net: string) {
    return net.toUpperCase().includes('GND');
}

function sameNetPadSpreadPenalty(components: PcbComponent[], placements: CandidatePlacement[]) {
    const padsByNet = new Map<string, Point[]>();
    for (const component of components) {
        const placement = placements.find((item) => item.designator === component.designator);
        if (!placement) continue;
        for (const pin of component.pins) {
            if (!pin.signal_name) continue;
            const point = padPoint(component, placement, pin.pin_number);
            if (!point) continue;
            const points = padsByNet.get(pin.signal_name) ?? [];
            points.push(point);
            padsByNet.set(pin.signal_name, points);
        }
    }
    let penalty = 0;
    for (const [net, points] of padsByNet.entries()) {
        if (points.length < 2) continue;
        const box = pointsBox(points);
        const spread = (box.right - box.left) + (box.bottom - box.top);
        penalty += isGroundNet(net) ? spread * GROUND_NET_SPREAD_WEIGHT : spread;
    }
    return penalty;
}

function capClusterPadAlignmentPenalty(island: IslandNode, components: PcbComponent[], placements: CandidatePlacement[]) {
    if (island.data.kind !== 'cap_cluster') return 0;
    const powerNet = typeof island.data.powerNet === 'string' ? island.data.powerNet : null;
    const returnNet = typeof island.data.returnNet === 'string' ? island.data.returnNet : null;
    if (!powerNet || !returnNet) return 0;
    let penalty = netAlignmentPenalty(components, placements, powerNet) + netAlignmentPenalty(components, placements, returnNet);
    if (island.data.topology === 'center_power_bus') {
        penalty += centerPowerBusCentroidPenalty(island, components, placements);
    }
    return penalty;
}

function centerPowerBusCentroidPenalty(island: IslandNode, components: PcbComponent[], placements: CandidatePlacement[]) {
    const axis = island.data.axis === 'x' || island.data.axis === 'y' ? island.data.axis : null;
    const powerNet = typeof island.data.powerNet === 'string' ? island.data.powerNet : null;
    const returnNet = typeof island.data.returnNet === 'string' ? island.data.returnNet : null;
    if (!powerNet || !returnNet || !axis) return 0;
    const powerCentroid = netCentroidCross(components, placements, powerNet, axis);
    const returnCentroid = netCentroidCross(components, placements, returnNet, axis);
    if (powerCentroid === null || returnCentroid === null) return 0;
    // power pads should be closer to island center than return pads
    const outward = Math.max(0, Math.abs(powerCentroid) - Math.abs(returnCentroid));
    return outward * 100;
}

function netCentroidCross(components: PcbComponent[], placements: CandidatePlacement[], net: string, axis: 'x' | 'y') {
    let sum = 0;
    let count = 0;
    for (const component of components) {
        const pin = component.pins.find((item) => item.signal_name === net);
        const placement = placements.find((item) => item.designator === component.designator);
        if (!pin || !placement) continue;
        const point = padPoint(component, placement, pin.pin_number);
        if (!point) continue;
        sum += axis === 'x' ? point.y : point.x;
        count += 1;
    }
    return count > 0 ? sum / count : null;
}

function netAlignmentPenalty(components: PcbComponent[], placements: CandidatePlacement[], net: string) {
    const points: Point[] = [];
    for (const component of components) {
        const pin = component.pins.find((item) => item.signal_name === net);
        const placement = placements.find((item) => item.designator === component.designator);
        if (!pin || !placement) continue;
        const point = padPoint(component, placement, pin.pin_number);
        if (point) points.push(point);
    }
    if (points.length < 2) return 0;
    const box = pointsBox(points);
    return Math.min(box.right - box.left, box.bottom - box.top);
}

function rotationsForAxis(rotations: number[], components: PcbComponent[], island: IslandNode, axis: 'x' | 'y') {
    const powerNet = typeof island.data.powerNet === 'string' ? island.data.powerNet : null;
    const returnNet = typeof island.data.returnNet === 'string' ? island.data.returnNet : null;
    if (!powerNet || !returnNet) return rotations;
    const scored = rotations.map((rotate) => ({
        rotate,
        score: components.reduce((sum, component) => sum + padVectorAxisScore(component, powerNet, returnNet, rotate, axis), 0),
    }));
    const bestScore = Math.min(...scored.map((item) => item.score));
    return scored.filter((item) => item.score <= bestScore + 0.001).map((item) => item.rotate);
}

function padVectorAxisScore(component: PcbComponent, powerNet: string, returnNet: string, rotate: number, axis: 'x' | 'y') {
    const powerPin = component.pins.find((pin) => pin.signal_name === powerNet);
    const returnPin = component.pins.find((pin) => pin.signal_name === returnNet);
    if (!powerPin || !returnPin) return 0;
    const power = getPadOffset(component, powerPin.pin_number, rotate);
    const ret = getPadOffset(component, returnPin.pin_number, rotate);
    if (!power || !ret) return 0;
    const dx = Math.abs(power.x - ret.x);
    const dy = Math.abs(power.y - ret.y);
    return axis === 'x' ? dx - dy : dy - dx;
}

function bestLineRotation(components: PcbComponent[], axis: 'x' | 'y', island: IslandNode, input: PlacementInput, clearance: number, clearanceResolver: ClearanceResolver) {
    const targetNet = resolveTargetNet(island, input);
    const rotations = normalizedRotations(components[0]);
    if (targetNet) {
        const scored = rotations.map((rotate) => ({
            rotate,
            topology: targetPadPerpendicularScore(components, axis, rotate, targetNet),
            compact: scorePlacements(island, components, placeGrid(components, axis, components.length, rotate, 0.5, clearance), clearanceResolver),
        }));
        scored.sort((a, b) => {
            if (b.topology !== a.topology) return b.topology - a.topology;
            return a.compact - b.compact;
        });
        return scored[0]?.rotate ?? 0;
    }
    return bestSharedRotation(components, axis, island, clearanceResolver);
}

function bestSharedRotation(components: PcbComponent[], axis: 'x' | 'y', island: IslandNode, clearanceResolver: ClearanceResolver) {
    const rotations = normalizedRotations(components[0]);
    return rotations
        .map((rotate) => ({
            rotate,
            score: scorePlacements(island, components, placeGrid(components, axis, components.length, rotate, 0.5, 0.8), clearanceResolver),
        }))
        .sort((a, b) => a.score - b.score)[0]?.rotate ?? 0;
}

function resolveTargetNet(island: IslandNode, input: PlacementInput): string | null {
    const target = island.data.target;
    if (!target || typeof target !== 'object' || (target as { type?: string }).type !== 'pin') return null;
    const pinTarget = target as { type: 'pin'; designator: string; pin_number: string | number };
    const component = input.components.find((item) => item.designator === pinTarget.designator);
    if (!component) return null;
    const pin = component.pins.find((item) => String(item.pin_number) === String(pinTarget.pin_number));
    return pin?.signal_name ?? null;
}

function padNet(component: PcbComponent, pinNumber: string | number): string | null {
    const pin = component.pins.find((item) => String(item.pin_number) === String(pinNumber));
    return pin?.signal_name ?? null;
}

function targetPadPerpendicularScore(components: PcbComponent[], axis: 'x' | 'y', rotate: number, targetNet: string): number {
    let total = 0;
    let count = 0;
    for (const component of components) {
        const pad = component.footprint.pads.find((item) => padNet(component, item.pin_number) === targetNet);
        if (!pad) continue;
        const layer = component.pcb.allowedLayers[0] ?? 'top';
        const offset = getPadOffset(component, pad.pin_number, rotate, layer);
        if (!offset) continue;
        total += axis === 'x' ? Math.abs(offset.y) : Math.abs(offset.x);
        count += 1;
    }
    return count > 0 ? total / count : 0;
}

function chooseCompactAxis(components: PcbComponent[]) {
    const totalWidth = components.reduce((sum, component) => sum + component.footprint.width, 0);
    const totalHeight = components.reduce((sum, component) => sum + component.footprint.height, 0);
    return totalWidth <= totalHeight ? 'x' : 'y';
}

function parseIslandPairs(island: IslandNode): Array<[string, string]> {
    const pairs = island.data.pairs;
    if (!Array.isArray(pairs)) return [];
    return pairs
        .filter((pair): pair is [string, string] => Array.isArray(pair) && typeof pair[0] === 'string' && typeof pair[1] === 'string');
}

function pairDegree(island: IslandNode, designator: string) {
    return parseIslandPairs(island)
        .filter(([a, b]) => a.startsWith(`${designator}.`) || b.startsWith(`${designator}.`))
        .length;
}

function collectIslandNodes(root: PlacementTreeNode): IslandNode[] {
    const nodes: IslandNode[] = [];
    const visit = (node: PlacementTreeNode) => {
        if (node.kind === 'island' && isIslandKind(node.data?.kind)) nodes.push(node as IslandNode);
        for (const child of node.children) visit(child);
    };
    visit(root);
    return nodes;
}

function isIslandKind(kind: unknown): kind is IslandKind {
    return kind === 'line' || kind === 'bypass' || kind === 'cap_cluster' || kind === 'core_pairs';
}

function normalizedRotations(component: PcbComponent) {
    const rotations = component.pcb.allowedRotations.length ? component.pcb.allowedRotations : [0, 90, 180, 270];
    return [...new Set(rotations.map((rotation) => normalizeRotation(rotation)))];
}

function normalizeRotation(value: number) {
    return ((Math.round(value) % 360) + 360) % 360;
}

function candidatePlacement(component: PcbComponent, x: number, y: number, rotate: number): CandidatePlacement {
    const layer = component.pcb.allowedLayers[0] ?? 'top';
    const placement = { designator: component.designator, x, y, rotate, layer, score: 0 };
    return { ...placement, component, box: componentBox(component, placement) };
}

function centerPlacements(placements: CandidatePlacement[], grid: number) {
    if (placements.length === 0) return [];
    const bbox = unionBoxes(placements.map((placement) => placement.box));
    const dx = (bbox.left + bbox.right) / 2;
    const dy = (bbox.top + bbox.bottom) / 2;
    return placements.map((placement) => candidatePlacement(
        placement.component,
        roundPlacement(placement.x - dx),
        roundPlacement(placement.y - dy),
        placement.rotate,
    ));
}

function padWorld(components: PcbComponent[], placements: CandidatePlacement[], ref: string) {
    const [designator, pin] = ref.split('.');
    const component = components.find((item) => item.designator === designator);
    const placement = placements.find((item) => item.designator === designator);
    if (!component || !placement) return null;
    return padPoint(component, placement, pin);
}

function padPoint(component: PcbComponent, placement: Placement, pin: string | number) {
    const offset = getPadOffset(component, pin, placement.rotate, placement.layer);
    return offset ? { x: placement.x + offset.x, y: placement.y + offset.y } : null;
}







function placementsBox(components: PcbComponent[], placements: Placement[]) {
    return unionBoxes(placements.map((placement) => {
        const component = components.find((item) => item.designator === placement.designator);
        return component ? componentBox(component, placement) : null;
    }).filter((box): box is Box => Boolean(box)));
}



function hasOverlap(components: PcbComponent[], placements: Placement[], clearanceResolver: ClearanceResolver) {
    for (let i = 0; i < placements.length; i += 1) {
        for (let j = i + 1; j < placements.length; j += 1) {
            const aComponent = components.find((component) => component.designator === placements[i].designator);
            const bComponent = components.find((component) => component.designator === placements[j].designator);
            if (!aComponent || !bComponent) continue;
            if (!placementsCanConflict(aComponent, placements[i], bComponent, placements[j])) continue;
            const clearance = clearanceResolver(aComponent.designator, bComponent.designator);
            const boxPairs = componentPairCollisionBoxPairs(aComponent, placements[i], bComponent, placements[j]);
            if (boxPairs.some((pair) => overlaps(pair.a, pair.b, clearance))) return true;
        }
    }
    return false;
}







function segmentsCross(a: Point, b: Point, c: Point, d: Point) {
    return orientation(a, b, c) * orientation(a, b, d) < 0
        && orientation(c, d, a) * orientation(c, d, b) < 0;
}

function orientation(a: Point, b: Point, c: Point) {
    const value = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(value) < 0.000001) return 0;
    return value > 0 ? 1 : -1;
}

function normalizeVector(vector: Point) {
    const length = Math.hypot(vector.x, vector.y);
    if (length <= 0.000001) return { x: 0, y: 0 };
    return { x: vector.x / length, y: vector.y / length };
}

function dot(a: Point, b: Point) {
    return a.x * b.x + a.y * b.y;
}

function uniqueNumbers(values: number[]) {
    return [...new Set(values.filter((value) => Number.isFinite(value)).map((value) => roundPlacement(value)))];
}

function dedupePoints(points: Point[]) {
    const seen = new Set<string>();
    return points.filter((point) => {
        const key = `${roundPlacement(point.x)}:${roundPlacement(point.y)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}



function footprintArea(component: PcbComponent) {
    return component.footprint.width * component.footprint.height;
}

function snap(value: number, grid: number) {
    if (grid <= 0) return value;
    return Math.round(value / grid) * grid;
}
