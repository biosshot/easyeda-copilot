import type {
    BlockRole,
    BoardEdge,
    Box,
    PcbComponent,
    PlacementGraph,
    PlacementInput,
    PlacementTreeNode,
} from '#types/pcb/layout-model.ts';
import { componentBox } from '../pcb-auto-place/geometry.ts';
import type { ClearanceResolver } from '../pcb-auto-place/clearance-resolver.ts';
import { solveBoardPackedPrimitives } from './board-packer-engine.ts';
import type { PlacementPrimitive, PrimitiveSolveDiagnostic } from './primitives.ts';

export interface BoardSolveParams {
    input: PlacementInput;
    graph: PlacementGraph;
    node: PlacementTreeNode;
    childPrimitives: PlacementPrimitive[];
    grid: number;
    clearance: number;
    componentByDesignator: Map<string, PcbComponent>;
    blockRoleByName: Map<string, BlockRole>;
    clearanceResolver: ClearanceResolver;
    compactness: 'normal' | 'high';
    diagnostics: PrimitiveSolveDiagnostic[];
}

export function solveBoardPrimitives(params: BoardSolveParams) {
    const boardPrimitives = boardPlacementPrimitives(params);
    return solveBoardPackedPrimitives({
        node: params.node,
        primitives: boardPrimitives.primitives.map(boardPackingPrimitive),
        relations: params.graph.relations.filter((relation) => (
            relation.scope === params.node.id
            || boardPrimitives.dissolvedScopes.has(relation.scope)
        )),
        options: {
            grid: params.grid,
            clearance: params.clearance,
            componentByDesignator: params.componentByDesignator,
            clearanceResolver: params.clearanceResolver,
            board: params.input.board,
            edgeClearance: params.input.board.clearances.edge,
            bounds: boardBounds(params.input),
            obstacles: boardHoleBoxes(params.input),
            constraintRegions: params.input.constraintRegions,
            compactness: params.compactness,
            searchWidth: 32,
        },
    });
}

function boardPackingPrimitive(primitive: PlacementPrimitive): PlacementPrimitive {
    return {
        ...primitive,
        collisionBoxes: primitive.collisionBoxes?.length ? primitive.collisionBoxes : [primitive.bbox],
    };
}

function boardPlacementPrimitives(params: BoardSolveParams) {
    const bounds = boardBounds(params.input);
    const dissolvedScopes = new Set<string>();
    const primitives: PlacementPrimitive[] = [];

    for (const primitive of params.childPrimitives) {
        if (shouldDissolveEdgePlacePrimitive(params, primitive)) {
            primitives.push(...primitive.children);
            dissolvedScopes.add(primitive.sourceNodeId);
            params.diagnostics.push({
                severity: 'warning',
                nodeId: primitive.sourceNodeId,
                message: `Dissolved edge-place mechanical group ${primitive.label} before board placement`,
            });
            continue;
        }

        const decision = moduleDissolveDecision(params, primitive, bounds);
        if (!decision.dissolve) {
            primitives.push(primitive);
            continue;
        }

        primitives.push(...expandDissolvedChildren(params, primitive.children, dissolvedScopes));
        dissolvedScopes.add(primitive.sourceNodeId);
        params.diagnostics.push({
            severity: 'warning',
            nodeId: primitive.sourceNodeId,
            message: `Dissolved sparse module ${primitive.label} before board placement: ${decision.reasons.join('; ')}`,
        });
    }

    return { primitives, dissolvedScopes };
}

function expandDissolvedChildren(
    params: BoardSolveParams,
    children: PlacementPrimitive[],
    dissolvedScopes: Set<string>,
): PlacementPrimitive[] {
    const result: PlacementPrimitive[] = [];
    for (const child of children) {
        if (!shouldDissolveEdgePlacePrimitive(params, child)) {
            result.push(child);
            continue;
        }
        dissolvedScopes.add(child.sourceNodeId);
        params.diagnostics.push({
            severity: 'warning',
            nodeId: child.sourceNodeId,
            message: `Dissolved edge-place mechanical group ${child.label} before board placement`,
        });
        result.push(...expandDissolvedChildren(params, child.children, dissolvedScopes));
    }
    return result;
}

function shouldDissolveEdgePlacePrimitive(params: BoardSolveParams, primitive: PlacementPrimitive): boolean {
    if (primitive.kind === 'component' || primitive.children.length === 0) return false;
    return primitive.placements.some((placement) => params.componentByDesignator.get(placement.designator)?.pcb.edgePlace)
        || primitive.children.some((child) => shouldDissolveEdgePlacePrimitive(params, child));
}

function moduleDissolveDecision(
    params: BoardSolveParams,
    primitive: PlacementPrimitive,
    bounds: Box,
): { dissolve: boolean; reasons: string[] } {
    if (primitive.kind !== 'module' || primitive.children.length <= 1) return { dissolve: false, reasons: [] };

    const usableWidth = bounds.right - bounds.left;
    const usableHeight = bounds.bottom - bounds.top;
    const boardArea = Math.max(1, usableWidth * usableHeight);
    const width = Math.max(0, primitive.width);
    const height = Math.max(0, primitive.height);
    const area = Math.max(1, width * height);
    const fillDensity = moduleFillDensity(primitive);
    const padDensity = modulePadDensity(params, primitive);
    const aspectRatio = height > 0 && width > 0 ? Math.max(width / height, height / width) : Infinity;
    const fixedEdges = moduleFixedEdges(params, primitive, bounds);

    const reasons: string[] = [];
    if (width > usableWidth * 0.82) reasons.push(`wide module ${round(width)}mm uses ${round(width / usableWidth)} of usable board width`);
    if (height > usableHeight * 0.82) reasons.push(`tall module ${round(height)}mm uses ${round(height / usableHeight)} of usable board height`);
    if (width > usableWidth * 0.45 && fillDensity < 0.65) reasons.push(`wide sparse bbox ${round(width)}mm, fill ${round(fillDensity)}`);
    if (height > usableHeight * 0.45 && fillDensity < 0.65) reasons.push(`tall sparse bbox ${round(height)}mm, fill ${round(fillDensity)}`);
    if (area > boardArea * 0.28 && fillDensity < 0.7) reasons.push(`module area ${round(area)}mm2 is large and sparse, fill ${round(fillDensity)}`);
    if (aspectRatio > 1.9 && fillDensity < 0.72) reasons.push(`stretched aspect ratio ${round(aspectRatio)}`);
    if (primitive.locked && fixedEdges.size >= 1 && primitive.children.length >= 2) {
        reasons.push(`locked module has fixed/edge child plus movable siblings (${[...fixedEdges].join(', ')})`);
    }
    if (fixedEdges.size >= 1 && primitive.children.length >= 3) reasons.push(`fixed/edge-mounted children inside multi-family module (${[...fixedEdges].join(', ')})`);
    if (fixedEdges.size >= 2) reasons.push(`fixed/edge-mounted children target multiple board edges (${[...fixedEdges].join(', ')})`);
    if (padDensity < 0.09 && (width > usableWidth * 0.35 || height > usableHeight * 0.35)) {
        reasons.push(`low pad density ${round(padDensity)} pads/mm2`);
    }

    return { dissolve: reasons.length > 0, reasons };
}

function moduleFillDensity(primitive: PlacementPrimitive) {
    const moduleArea = Math.max(1, primitive.width * primitive.height);
    const boxes = primitive.children.length > 0 ? primitive.children.map((child) => child.bbox) : [primitive.bbox];
    const occupied = boxes.reduce((sum, box) => sum + boxArea(box), 0);
    return Math.min(1, occupied / moduleArea);
}

function modulePadDensity(params: BoardSolveParams, primitive: PlacementPrimitive) {
    const moduleArea = Math.max(1, primitive.width * primitive.height);
    const padCount = primitive.placements.reduce((sum, placement) => {
        const component = params.componentByDesignator.get(placement.designator);
        return sum + (component?.pins.length ?? 0);
    }, 0);
    return padCount / moduleArea;
}

function moduleFixedEdges(params: BoardSolveParams, primitive: PlacementPrimitive, bounds: Box) {
    const edges = new Set<BoardEdge>();
    for (const placement of primitive.placements) {
        const component = params.componentByDesignator.get(placement.designator);
        if (!component) continue;
        const edge = component.pcb.edgeMount?.edge
            ?? component.pcb.edgePlace?.edges[0]
            ?? fixedPlacementEdge(component.pcb.fixedPlacement?.anchor?.anchor);
        if (edge) {
            edges.add(edge);
            continue;
        }
        if (!component.pcb.fixedPlacement) continue;
        const box = componentBox(component, placement);
        const nearest = nearestBoardEdge(box, bounds);
        if (nearest.distance <= Math.max(2, params.input.board.clearances.edge + 1)) edges.add(nearest.edge);
    }
    return edges;
}

function fixedPlacementEdge(anchor: unknown): BoardEdge | null {
    if (anchor === 'board.left' || anchor === 'left') return 'left';
    if (anchor === 'board.right' || anchor === 'right') return 'right';
    if (anchor === 'board.top' || anchor === 'top') return 'top';
    if (anchor === 'board.bottom' || anchor === 'bottom') return 'bottom';
    if (anchor === 'board.top_left') return 'top';
    if (anchor === 'board.top_right') return 'top';
    if (anchor === 'board.bottom_left') return 'bottom';
    if (anchor === 'board.bottom_right') return 'bottom';
    return null;
}

function nearestBoardEdge(box: Box, bounds: Box) {
    const distances: Array<{ edge: BoardEdge; distance: number }> = [
        { edge: 'left', distance: Math.abs(box.left - bounds.left) },
        { edge: 'right', distance: Math.abs(bounds.right - box.right) },
        { edge: 'top', distance: Math.abs(box.top - bounds.top) },
        { edge: 'bottom', distance: Math.abs(bounds.bottom - box.bottom) },
    ];
    return distances.sort((a, b) => a.distance - b.distance)[0];
}

function boardBounds(input: PlacementInput): Box {
    const edge = input.board.clearances.edge ?? 0;
    return {
        left: -input.board.outline.width / 2 + edge,
        right: input.board.outline.width / 2 - edge,
        top: -input.board.outline.height / 2 + edge,
        bottom: input.board.outline.height / 2 - edge,
    };
}

function boardHoleBoxes(input: PlacementInput): Box[] {
    return (input.boardHoles ?? []).map((hole) => {
        const radius = Math.max(hole.keepout, hole.diameter / 2, hole.drill / 2);
        return {
            left: hole.x - radius,
            right: hole.x + radius,
            top: hole.y - radius,
            bottom: hole.y + radius,
        };
    });
}

function boxArea(box: Box) {
    return Math.max(0, box.right - box.left) * Math.max(0, box.bottom - box.top);
}

function round(value: number) {
    return Math.round(value * 1000) / 1000;
}
