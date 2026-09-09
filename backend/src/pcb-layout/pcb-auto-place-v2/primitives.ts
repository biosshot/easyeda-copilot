import type { Box, Placement, Point } from '#types/pcb/layout-model.ts';
import {
    boxCenter,
    rotateBox,
    roundPlacement,
    translateBox,
    unionBoxes,
} from '../pcb-auto-place/geometry.ts';

export type PlacementPrimitiveKind = 'component' | 'island' | 'block' | 'module' | 'board';

export interface PlacementConnectionPoint extends Point {
    ref: string;
    net?: string;
}

export interface PlacementPathPort extends Point {
    pathId: string;
    order: number;
    ref: string;
    role: 'source' | 'target' | 'entry' | 'exit';
    normal: Point;
}

export interface PlacementPathFragment {
    pathId: string;
    firstOrder: number;
    lastOrder: number;
    entryRef: string;
    exitRef: string;
    internalCost: number;
}

export interface PlacementPrimitive {
    id: string;
    kind: PlacementPrimitiveKind;
    label: string;
    sourceNodeId: string;
    locked?: boolean;
    canRotate?: boolean;
    allowedOrientations?: number[];
    bbox: Box;
    collisionBoxes?: Box[];
    width: number;
    height: number;
    placements: Placement[];
    connectionPoints: PlacementConnectionPoint[];
    pathPorts?: PlacementPathPort[];
    pathFragments?: PlacementPathFragment[];
    children: PlacementPrimitive[];
    deferredRelations?: string[];
}

export interface PrimitiveSolveDiagnostic {
    severity: 'warning' | 'error';
    nodeId: string;
    message: string;
}

export function translatePrimitive(primitive: PlacementPrimitive, dx: number, dy: number): PlacementPrimitive {
    return {
        ...primitive,
        bbox: translateBox(primitive.bbox, dx, dy),
        collisionBoxes: primitive.collisionBoxes?.map((box) => translateBox(box, dx, dy)),
        placements: primitive.placements.map((placement) => ({
            ...placement,
            x: roundPlacement(placement.x + dx),
            y: roundPlacement(placement.y + dy),
        })),
        connectionPoints: primitive.connectionPoints.map((point) => ({
            ...point,
            x: roundPlacement(point.x + dx),
            y: roundPlacement(point.y + dy),
        })),
        pathPorts: primitive.pathPorts?.map((port) => ({
            ...port,
            x: roundPlacement(port.x + dx),
            y: roundPlacement(port.y + dy),
        })),
        children: primitive.children.map((child) => translatePrimitive(child, dx, dy)),
    };
}

export function rotatePrimitive(primitive: PlacementPrimitive, angle: number): PlacementPrimitive {
    const normalizedAngle = normalizeRotation(angle);
    if (normalizedAngle === 0) return primitive;
    const origin = boxCenter(primitive.bbox);
    const bbox = rotateBox(primitive.bbox, origin, normalizedAngle);
    return {
        ...primitive,
        bbox,
        allowedOrientations: rotateAllowedOrientations(primitive.allowedOrientations, normalizedAngle),
        collisionBoxes: primitive.collisionBoxes?.map((box) => rotateBox(box, origin, normalizedAngle)),
        width: roundPlacement(bbox.right - bbox.left),
        height: roundPlacement(bbox.bottom - bbox.top),
        placements: primitive.placements.map((placement) => {
            const point = rotatePoint(placement, origin, normalizedAngle);
            return {
                ...placement,
                x: point.x,
                y: point.y,
                rotate: normalizeRotation(placement.rotate + normalizedAngle),
            };
        }),
        connectionPoints: primitive.connectionPoints.map((point) => ({
            ...point,
            ...rotatePoint(point, origin, normalizedAngle),
        })),
        pathPorts: primitive.pathPorts?.map((port) => ({
            ...port,
            ...rotatePoint(port, origin, normalizedAngle),
            normal: rotateVector(port.normal, normalizedAngle),
        })),
        children: primitive.children.map((child) => rotatePrimitive(child, normalizedAngle)),
    };
}

export function unionPrimitive(id: string, kind: PlacementPrimitiveKind, label: string, sourceNodeId: string, children: PlacementPrimitive[], deferredRelations: string[] = []): PlacementPrimitive {
    const bbox = unionBoxes(children.map((child) => child.bbox));
    const allowedOrientations = commonAllowedOrientations(children);
    const pathPorts = dedupePathPorts(children.flatMap((child) => child.pathPorts ?? []));
    return {
        id,
        kind,
        label,
        sourceNodeId,
        locked: children.some((child) => child.locked),
        canRotate: allowedOrientations.length > 1,
        allowedOrientations,
        bbox,
        collisionBoxes: children.flatMap((child) => child.collisionBoxes?.length ? child.collisionBoxes : [child.bbox]),
        width: roundPlacement(bbox.right - bbox.left),
        height: roundPlacement(bbox.bottom - bbox.top),
        placements: children.flatMap((child) => child.placements),
        connectionPoints: children.flatMap((child) => child.connectionPoints),
        pathPorts,
        pathFragments: summarizePathFragments(pathPorts),
        children,
        deferredRelations,
    };
}

function commonAllowedOrientations(children: PlacementPrimitive[]) {
    if (children.length === 0) return [0];
    let common = orientationsForPrimitive(children[0]);
    for (const child of children.slice(1)) {
        const allowed = new Set(orientationsForPrimitive(child));
        common = common.filter((angle) => allowed.has(angle));
    }
    return common.length ? common : [0];
}

function orientationsForPrimitive(primitive: PlacementPrimitive) {
    if (primitive.locked) return [0];
    if (primitive.allowedOrientations?.length) return uniqueAngles(primitive.allowedOrientations);
    return primitive.canRotate ? [0, 90, 180, 270] : [0];
}

function rotateAllowedOrientations(orientations: number[] | undefined, angle: number) {
    if (!orientations?.length) return orientations;
    return uniqueAngles(orientations.map((orientation) => orientation - angle));
}

function uniqueAngles(values: number[]) {
    return [...new Set(values.map(normalizeRotation))].sort((a, b) => a - b);
}

function rotatePoint(point: Point, origin: Point, angle: number): Point {
    const radians = angle * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    return {
        x: roundPlacement(origin.x + dx * cos - dy * sin),
        y: roundPlacement(origin.y + dx * sin + dy * cos),
    };
}

function rotateVector(point: Point, angle: number): Point {
    const radians = angle * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
        x: roundPlacement(point.x * cos - point.y * sin),
        y: roundPlacement(point.x * sin + point.y * cos),
    };
}

function dedupePathPorts(ports: PlacementPathPort[]) {
    const byKey = new Map<string, PlacementPathPort>();
    for (const port of ports) {
        const key = `${port.pathId}:${port.order}:${port.ref}:${port.role}`;
        if (!byKey.has(key)) byKey.set(key, port);
    }
    return [...byKey.values()].sort((a, b) => a.pathId.localeCompare(b.pathId) || a.order - b.order || a.ref.localeCompare(b.ref));
}

function summarizePathFragments(ports: PlacementPathPort[]): PlacementPathFragment[] {
    const byPath = new Map<string, PlacementPathPort[]>();
    for (const port of ports) {
        const items = byPath.get(port.pathId) ?? [];
        items.push(port);
        byPath.set(port.pathId, items);
    }
    return [...byPath.entries()].flatMap(([pathId, items]) => {
        const ordered = items.slice().sort((a, b) => a.order - b.order || a.ref.localeCompare(b.ref));
        if (ordered.length < 2) return [];
        let internalCost = 0;
        for (let index = 1; index < ordered.length; index += 1) {
            internalCost += Math.hypot(ordered[index].x - ordered[index - 1].x, ordered[index].y - ordered[index - 1].y);
        }
        return [{
            pathId,
            firstOrder: ordered[0].order,
            lastOrder: ordered[ordered.length - 1].order,
            entryRef: ordered[0].ref,
            exitRef: ordered[ordered.length - 1].ref,
            internalCost: roundPlacement(internalCost),
        }];
    });
}

function normalizeRotation(value: number) {
    return ((Math.round(value) % 360) + 360) % 360;
}
