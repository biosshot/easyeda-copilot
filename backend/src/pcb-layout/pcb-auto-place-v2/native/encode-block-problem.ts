import type { PcbComponent, Placement } from '#types/pcb/layout-model.ts';
import { isGroundSignalName, isPowerSignalName } from '#utils/signals.ts';
import { componentBox, componentCollisionBoxes } from '../../pcb-auto-place/geometry.ts';
import { placementsCanConflict } from '../../pcb-auto-place/utils.ts';
import type { BlockSolveParams } from '../block-solver.ts';
import type { PlacementPrimitive } from '../primitives.ts';
import {
    NATIVE_BLOCK_SOLVE_CONTRACT_VERSION,
    type NativeBlockSolveProblemV2,
    type NativePrimitive,
    type NativeRelation,
} from './contract.ts';

type ComponentEntry = { component: PcbComponent; placement: Placement; primitiveId: string };

export function encodeNativeBlockSolveProblem(params: BlockSolveParams): NativeBlockSolveProblemV2 {
    const components = collectComponents(params);
    const count = components.length;
    const componentPairClearance = new Array<number>(count * count);
    const componentConflict = new Array<number>(count * count);
    for (let aIndex = 0; aIndex < count; aIndex += 1) {
        const a = components[aIndex];
        for (let bIndex = 0; bIndex < count; bIndex += 1) {
            const b = components[bIndex];
            const index = aIndex * count + bIndex;
            componentPairClearance[index] = aIndex === bIndex
                ? 0
                : params.options.clearanceResolver?.(a.component.designator, b.component.designator) ?? params.options.clearance;
            componentConflict[index] = placementsCanConflict(a.component, a.placement, b.component, b.placement) ? 1 : 0;
        }
    }

    return {
        version: NATIVE_BLOCK_SOLVE_CONTRACT_VERSION,
        grid: params.options.grid,
        clearance: params.options.clearance,
        searchWidth: Math.max(1, Math.floor(params.options.searchWidth ?? 1)),
        compactness: params.options.compactness ?? 'normal',
        targetWidth: params.options.targetWidth,
        targetHeight: params.options.targetHeight,
        bounds: params.options.bounds,
        collisionMode: params.options.collisionMode ?? 'components',
        hardCollisionMode: params.options.hardCollisionMode ?? 'components',
        candidateBoxMode: params.options.candidateBoxMode ?? 'bbox',
        primitives: params.primitives.map((primitive) => encodePrimitive(primitive)),
        relations: params.relations.map(encodeRelation),
        obstacles: params.options.obstacles ?? [],
        components: components.map(({ component, placement, primitiveId }) => ({
            designator: component.designator,
            primitiveId,
            blockName: component.block_name,
            layer: placement.layer,
            bodyBox: componentBox(component, placement),
            throughHoleBoxes: componentCollisionBoxes(component, placement, placement.layer === 'top' ? 'bottom' : 'top'),
            pinCount: component.pins.length,
            role: component.pcb.role,
            powerComponent: isPowerComponent(component, params),
        })),
        componentPairClearance,
        componentConflict,
    };
}

function collectComponents(params: BlockSolveParams): ComponentEntry[] {
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

function encodePrimitive(primitive: PlacementPrimitive): NativePrimitive {
    return {
        id: primitive.id,
        kind: primitive.kind,
        label: primitive.label,
        sourceNodeId: primitive.sourceNodeId,
        sourceNodeIds: collectSourceNodeIds(primitive),
        locked: primitive.locked === true,
        canRotate: primitive.canRotate === true,
        allowedOrientations: [...(primitive.allowedOrientations ?? (primitive.canRotate ? [0, 90, 180, 270] : [0]))],
        bbox: { ...primitive.bbox },
        collisionBoxes: (primitive.collisionBoxes?.length ? primitive.collisionBoxes : [primitive.bbox]).map((box) => ({ ...box })),
        width: primitive.width,
        height: primitive.height,
        placements: primitive.placements.map((placement) => ({ ...placement })),
        connectionPoints: primitive.connectionPoints.map((point) => ({ ...point })),
        pathPorts: (primitive.pathPorts ?? []).map((port) => ({ ...port, normal: { ...port.normal } })),
        edgePlace: null,
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

function encodeRelation(relation: BlockSolveParams['relations'][number]): NativeRelation {
    const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    const offset = relation.data?.anchorOffset as { x?: unknown; y?: unknown } | undefined;
    const side = relation.data?.sidePreference;
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
        maxDistance: number(relation.data?.maxDistance),
        minDistance: number(relation.data?.minDistance),
        satelliteAnchor: relation.data?.satelliteAnchor === true,
        anchorOffset: typeof offset?.x === 'number' && typeof offset.y === 'number' ? { x: offset.x, y: offset.y } : undefined,
        sidePreference: side === 'left' || side === 'right' || side === 'top' || side === 'bottom' ? side : undefined,
        pathId: typeof relation.data?.pathId === 'string' ? relation.data.pathId : undefined,
        pathShape: relation.data?.pathShape === 'straight' ? 'straight' : relation.data?.pathShape === 'flexible' ? 'flexible' : undefined,
        preferFacingPads: relation.data?.preferFacingPads === true,
    };
}

function isPowerComponent(component: PcbComponent, params: BlockSolveParams) {
    if (component.pcb.role === 'decoupling_cap') return true;
    if (params.options.blockRoleByName?.get(component.block_name) === 'power') return true;
    const connected = component.pins.filter((pin) => pin.signal_name && !isGroundSignalName(pin.signal_name));
    return connected.length > 0 && connected.every((pin) => isPowerSignalName(pin.signal_name));
}
