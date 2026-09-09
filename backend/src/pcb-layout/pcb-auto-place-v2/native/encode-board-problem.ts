import type { BoardEdge, Box, PcbComponent, Placement } from '#types/pcb/layout-model.ts';
import { boardOutlinePolygon, componentBox, componentCollisionBoxes } from '../../pcb-auto-place/geometry.ts';
import { placementsCanConflict } from '../../pcb-auto-place/utils.ts';
import type { BoardPackParams } from '../board-packer.ts';
import type { PlacementPrimitive } from '../primitives.ts';
import {
    NATIVE_BOARD_PACK_CONTRACT_VERSION,
    type NativeBoardPackProblemV3,
    type NativeEdgePlaceIntent,
    type NativePrimitive,
    type NativeRelation,
} from './contract.ts';

type ComponentEntry = { component: PcbComponent; placement: Placement; primitiveId: string };

export function encodeNativeBoardPackProblem(params: BoardPackParams): NativeBoardPackProblemV3 {
    const components = collectComponents(params);
    const count = components.length;
    const componentPairClearance = new Array<number>(count * count);
    const componentConflict = new Array<number>(count * count);

    for (let aIndex = 0; aIndex < count; aIndex += 1) {
        const a = components[aIndex];
        for (let bIndex = 0; bIndex < count; bIndex += 1) {
            const b = components[bIndex];
            const matrixIndex = aIndex * count + bIndex;
            componentPairClearance[matrixIndex] = aIndex === bIndex
                ? 0
                : params.options.clearanceResolver?.(a.component.designator, b.component.designator) ?? params.options.clearance;
            componentConflict[matrixIndex] = placementsCanConflict(a.component, a.placement, b.component, b.placement) ? 1 : 0;
        }
    }

    const fullBoardBounds = params.options.board
        ? centeredBoardBounds(params.options.board.outline.width, params.options.board.outline.height)
        : cloneBox(params.options.bounds);

    return assertFiniteProblem({
        version: NATIVE_BOARD_PACK_CONTRACT_VERSION,
        grid: params.options.grid,
        clearance: params.options.clearance,
        searchWidth: Math.max(32, Math.floor(params.options.searchWidth ?? 96)),
        compactness: params.options.compactness ?? 'normal',
        bounds: cloneBox(params.options.bounds),
        fullBoardBounds,
        boardOutline: params.options.board ? boardOutlinePolygon(params.options.board) : boxPolygon(fullBoardBounds),
        edgeClearance: params.options.edgeClearance ?? 0,
        primitives: params.primitives.map((primitive) => encodePrimitive(primitive, params.options.componentByDesignator)),
        relations: params.relations.map(encodeRelation),
        obstacles: (params.options.obstacles ?? []).map(cloneBox),
        constraintRegions: (params.options.constraintRegions ?? []).map((region) => ({
            name: region.name,
            box: cloneBox(region.box),
            layers: [...region.layers],
            allowBlocks: [...region.allowBlocks],
        })),
        components: components.map(({ component, placement, primitiveId }) => ({
            designator: component.designator,
            primitiveId,
            blockName: component.block_name,
            layer: placement.layer,
            bodyBox: componentBox(component, placement),
            throughHoleBoxes: componentCollisionBoxes(
                component,
                placement,
                placement.layer === 'top' ? 'bottom' : 'top',
            ),
            boardOverflow: {
                left: Math.max(0, component.pcb.boardOverflow?.left ?? 0),
                right: Math.max(0, component.pcb.boardOverflow?.right ?? 0),
                top: Math.max(0, component.pcb.boardOverflow?.top ?? 0),
                bottom: Math.max(0, component.pcb.boardOverflow?.bottom ?? 0),
            },
            edgeClearance: Math.max(0, component.pcb.edgePlace?.inset ?? params.options.edgeClearance ?? 0),
        })),
        componentPairClearance,
        componentConflict,
    });
}

function collectComponents(params: BoardPackParams): ComponentEntry[] {
    const result: ComponentEntry[] = [];
    const seen = new Set<string>();
    for (const primitive of params.primitives) {
        for (const placement of primitive.placements) {
            if (seen.has(placement.designator)) continue;
            const component = params.options.componentByDesignator?.get(placement.designator);
            if (!component) continue;
            seen.add(placement.designator);
            result.push({ component, placement, primitiveId: primitive.id });
        }
    }
    return result;
}

function encodePrimitive(
    primitive: PlacementPrimitive,
    componentByDesignator: Map<string, PcbComponent> | undefined,
): NativePrimitive {
    return {
        id: primitive.id,
        kind: primitive.kind,
        label: primitive.label,
        sourceNodeId: primitive.sourceNodeId,
        sourceNodeIds: collectSourceNodeIds(primitive),
        locked: primitive.locked === true,
        canRotate: primitive.canRotate === true,
        allowedOrientations: [...(primitive.allowedOrientations ?? (primitive.canRotate ? [0, 90, 180, 270] : [0]))],
        bbox: cloneBox(primitive.bbox),
        collisionBoxes: (primitive.collisionBoxes?.length ? primitive.collisionBoxes : [primitive.bbox]).map(cloneBox),
        width: primitive.width,
        height: primitive.height,
        placements: primitive.placements.map((placement) => ({ ...placement })),
        connectionPoints: primitive.connectionPoints.map((point) => ({ ...point })),
        pathPorts: (primitive.pathPorts ?? []).map((port) => ({ ...port, normal: { ...port.normal } })),
        edgePlace: primitiveEdgePlaceIntent(primitive, componentByDesignator),
    };
}

function collectSourceNodeIds(primitive: PlacementPrimitive) {
    const result = new Set<string>();
    const visit = (item: PlacementPrimitive) => {
        result.add(item.sourceNodeId);
        for (const child of item.children) visit(child);
    };
    visit(primitive);
    return [...result];
}

function primitiveEdgePlaceIntent(
    primitive: PlacementPrimitive,
    componentByDesignator: Map<string, PcbComponent> | undefined,
): NativeEdgePlaceIntent | null {
    const edges = new Set<BoardEdge>();
    let inset: number | undefined;
    let align: NativeEdgePlaceIntent['align'];
    let x: number | undefined;
    let y: number | undefined;
    let offset: number | undefined;
    for (const placement of primitive.placements) {
        const edgePlace = componentByDesignator?.get(placement.designator)?.pcb.edgePlace;
        if (!edgePlace) continue;
        for (const edge of edgePlace.edges) edges.add(edge);
        inset = Math.max(inset ?? 0, edgePlace.inset ?? 0);
        align ??= edgePlace.align;
        x ??= edgePlace.x;
        y ??= edgePlace.y;
        offset ??= edgePlace.offset;
    }
    return edges.size > 0 ? { edges: [...edges], inset, align, x, y, offset } : null;
}

function encodeRelation(relation: BoardPackParams['relations'][number]): NativeRelation {
    return {
        id: relation.id,
        kind: relation.kind,
        from: relation.from,
        to: relation.to,
        relation: relation.relation,
        priority: relation.priority,
        hard: relation.hard === true,
        weight: relation.weight,
        effect: relation.effect,
        maxDistance: finiteOptional(relation.data?.maxDistance),
        minDistance: finiteOptional(relation.data?.minDistance),
        satelliteAnchor: relation.data?.satelliteAnchor === true,
        anchorOffset: pointOptional(relation.data?.anchorOffset),
        sidePreference: boardEdgeOptional(relation.data?.sidePreference),
        pathId: stringOptional(relation.data?.pathId),
        pathShape: relation.data?.pathShape === 'straight' ? 'straight' : relation.data?.pathShape === 'flexible' ? 'flexible' : undefined,
        preferFacingPads: relation.data?.preferFacingPads === true,
    };
}

function centeredBoardBounds(width: number, height: number): Box {
    return { left: -width / 2, right: width / 2, top: -height / 2, bottom: height / 2 };
}

function boxPolygon(box: Box) {
    return [
        { x: box.left, y: box.top },
        { x: box.right, y: box.top },
        { x: box.right, y: box.bottom },
        { x: box.left, y: box.bottom },
    ];
}

function cloneBox(box: Box): Box {
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
}

function finiteOptional(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function pointOptional(value: unknown) {
    if (!value || typeof value !== 'object') return undefined;
    const point = value as { x?: unknown; y?: unknown };
    return typeof point.x === 'number' && Number.isFinite(point.x)
        && typeof point.y === 'number' && Number.isFinite(point.y)
        ? { x: point.x, y: point.y }
        : undefined;
}

function boardEdgeOptional(value: unknown): BoardEdge | undefined {
    return value === 'left' || value === 'right' || value === 'top' || value === 'bottom' ? value : undefined;
}

function stringOptional(value: unknown) {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function assertFiniteProblem(problem: NativeBoardPackProblemV3) {
    const visit = (value: unknown, path: string): void => {
        if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`Non-finite native board pack value at ${path}`);
        if (Array.isArray(value)) {
            value.forEach((item, index) => visit(item, `${path}[${index}]`));
            return;
        }
        if (!value || typeof value !== 'object') return;
        for (const [key, item] of Object.entries(value)) visit(item, `${path}.${key}`);
    };
    visit(problem, 'problem');
    return problem;
}
