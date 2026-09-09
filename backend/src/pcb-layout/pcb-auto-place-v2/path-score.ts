import type { PlacementRelation } from '#types/pcb/layout-model.ts';
import {
    NATIVE_SIGNAL_PATH_CONTRACT_VERSION,
    type NativeSignalPathTopologyEvaluation,
} from './native/contract.ts';
import { loadNativeBoardPacker } from './native/load-native-board-packer.ts';
import type { PlacementPathPort, PlacementPrimitive } from './primitives.ts';

export type SignalPathTopologyEvaluation = NativeSignalPathTopologyEvaluation;

export interface SignalPathTopologyOptions {
    shape: 'flexible' | 'straight';
    priority?: PlacementRelation['priority'];
    weight?: number;
    preferFacingPads?: boolean;
}

export function signalPathTopologyPenalty(primitives: PlacementPrimitive[], relations: PlacementRelation[]) {
    return evaluateSignalPathTopology(primitives, relations).reduce((sum, path) => sum + path.penalty, 0);
}

/** Uses the same native bridge generator as the board and block solvers. */
export function signalPathBridgeDeltas(moving: PlacementPrimitive, placed: PlacementPrimitive[]) {
    const addon = signalPathAddon();
    return addon.signalPathBridgeDeltas({
        version: NATIVE_SIGNAL_PATH_CONTRACT_VERSION,
        movingPorts: collectPathPorts(moving),
        placedPorts: placed.flatMap(collectPathPorts),
    });
}

export function evaluateSignalPathTopology(
    primitives: PlacementPrimitive[],
    relations: PlacementRelation[] = [],
): SignalPathTopologyEvaluation[] {
    const metadata = pathMetadata(relations);
    const portsByPath = new Map<string, PlacementPathPort[]>();
    for (const primitive of primitives) {
        for (const port of collectPathPorts(primitive)) {
            const ports = portsByPath.get(port.pathId) ?? [];
            ports.push(port);
            portsByPath.set(port.pathId, ports);
        }
    }
    return [...portsByPath.entries()]
        .map(([pathId, ports]) => evaluateSignalPathPorts(pathId, ports, metadata.get(pathId)))
        .filter((item): item is SignalPathTopologyEvaluation => Boolean(item))
        .sort((a, b) => a.pathId.localeCompare(b.pathId));
}

export function evaluateSignalPathPorts(
    pathId: string,
    ports: PlacementPathPort[],
    metadata: SignalPathTopologyOptions | undefined,
) {
    return signalPathAddon().evaluateSignalPath({
        version: NATIVE_SIGNAL_PATH_CONTRACT_VERSION,
        pathId,
        ports,
        shape: metadata?.shape ?? 'flexible',
        priority: metadata?.priority ?? 'normal',
        weight: metadata?.weight ?? 1,
        preferFacingPads: metadata?.preferFacingPads === true,
    });
}

function signalPathAddon() {
    const addon = loadNativeBoardPacker();
    const version = addon.signalPathContractVersion();
    if (version !== NATIVE_SIGNAL_PATH_CONTRACT_VERSION) {
        throw new Error(`Rust signal-path contract ${version} does not match TypeScript contract ${NATIVE_SIGNAL_PATH_CONTRACT_VERSION}`);
    }
    return addon;
}

function collectPathPorts(primitive: PlacementPrimitive): PlacementPathPort[] {
    if (primitive.pathPorts?.length) return primitive.pathPorts;
    return primitive.children.flatMap(collectPathPorts);
}

function pathMetadata(relations: PlacementRelation[]) {
    const result = new Map<string, SignalPathTopologyOptions>();
    for (const relation of relations) {
        const pathId = typeof relation.data?.pathId === 'string' && relation.data.pathId.length > 0
            ? relation.data.pathId
            : null;
        if (!pathId) continue;
        const shape = relation.data?.pathShape === 'straight' ? 'straight' as const : 'flexible' as const;
        const weight = typeof relation.weight === 'number' && Number.isFinite(relation.weight)
            ? Math.max(0.25, relation.weight / 70)
            : 1;
        const previous = result.get(pathId);
        result.set(pathId, {
            shape: previous?.shape === 'straight' || shape === 'straight' ? 'straight' : 'flexible',
            priority: strongerPriority(previous?.priority, relation.priority),
            weight: Math.max(previous?.weight ?? 0, weight),
            preferFacingPads: (previous?.preferFacingPads ?? false) || relation.data?.preferFacingPads === true,
        });
    }
    return result;
}

function strongerPriority(a: PlacementRelation['priority'], b: PlacementRelation['priority']) {
    const rank = { low: 0, normal: 1, high: 2, critical: 3 } as const;
    return (rank[b ?? 'normal'] > rank[a ?? 'normal'] ? b : a) ?? 'normal';
}
