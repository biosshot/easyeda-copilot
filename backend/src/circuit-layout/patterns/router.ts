import { routeEdges } from '@mr_mint/elkjs-libavoid';
import type { ElkExtendedEdge, ElkNode, ElkPort } from 'elkjs';
import masterLogger from '#logger.ts';
import type { MacroInstance, MacroRoutedPath } from './types.ts';
import { SCHEMATIC_CLEARANCE } from '../refinement/policy.ts';

const logger = masterLogger.child({ TAG: 'circuit-pattern-router' });
const TERMINAL_SIZE = 1;
const ORTHOGONAL_EPSILON = 1e-6;

type EdgeMeta = {
    signalName: string;
    sourcePinId: string;
    targetPinId: string;
    kind: MacroRoutedPath['kind'];
    macroPortId?: string;
};

type RouteEndpoint = {
    x: number;
    y: number;
    side: string;
};

function routeAroundPlacement(
    source: RouteEndpoint,
    target: RouteEndpoint,
    placement: { x: number; y: number; width: number; height: number },
) {
    const gap = SCHEMATIC_CLEARANCE.wire;
    const top = placement.y - gap;
    const bottom = placement.y + placement.height + gap;
    const left = placement.x - gap;
    const right = placement.x + placement.width + gap;
    const outside = (endpoint: RouteEndpoint) => {
        if (endpoint.side === 'EAST') return { x: right, y: endpoint.y };
        if (endpoint.side === 'WEST') return { x: left, y: endpoint.y };
        if (endpoint.side === 'SOUTH') return { x: endpoint.x, y: bottom };
        return { x: endpoint.x, y: top };
    };
    const sourceOutside = outside(source);
    const targetOutside = outside(target);
    const sourceHorizontal = source.side === 'EAST' || source.side === 'WEST';
    const targetHorizontal = target.side === 'EAST' || target.side === 'WEST';
    const middle: { x: number; y: number }[] = [];
    if (source.side === target.side) {
        // The two outward stubs already share one coordinate.
    } else if (sourceHorizontal && targetHorizontal) {
        middle.push({ x: sourceOutside.x, y: top }, { x: targetOutside.x, y: top });
    } else if (!sourceHorizontal && !targetHorizontal) {
        middle.push({ x: left, y: sourceOutside.y }, { x: left, y: targetOutside.y });
    } else {
        const horizontal = sourceHorizontal ? sourceOutside : targetOutside;
        const vertical = sourceHorizontal ? targetOutside : sourceOutside;
        middle.push({ x: horizontal.x, y: vertical.y });
    }
    return simplifyOrthogonalPoints([
        { x: source.x, y: source.y },
        sourceOutside,
        ...middle,
        targetOutside,
        { x: target.x, y: target.y },
    ]);
}

function simplifyOrthogonalPoints(points: { x: number; y: number }[]) {
    const snapped = points.map(point => ({ ...point }));
    for (let index = 1; index < snapped.length; index++) {
        if (Math.abs(snapped[index].x - snapped[index - 1].x) <= ORTHOGONAL_EPSILON) {
            snapped[index].x = snapped[index - 1].x;
        }
        if (Math.abs(snapped[index].y - snapped[index - 1].y) <= ORTHOGONAL_EPSILON) {
            snapped[index].y = snapped[index - 1].y;
        }
    }
    const unique = snapped.filter((point, index) => index === 0
        || point.x !== snapped[index - 1].x
        || point.y !== snapped[index - 1].y);
    const result: typeof unique = [];
    for (const point of unique) {
        const previous = result.at(-1);
        const beforePrevious = result.at(-2);
        if (previous && beforePrevious
            && ((beforePrevious.x === previous.x && previous.x === point.x)
                || (beforePrevious.y === previous.y && previous.y === point.y))) {
            result[result.length - 1] = point;
        } else {
            result.push(point);
        }
    }
    return result;
}

function anchorRouteEndpoint(
    points: { x: number; y: number }[],
    endpoint: RouteEndpoint,
    source: boolean,
) {
    const index = source ? 0 : points.length - 1;
    points[index] = { x: endpoint.x, y: endpoint.y };
    if (points.length < 2) return;

    const adjacentIndex = source ? 1 : points.length - 2;
    const adjacent = points[adjacentIndex];
    if (adjacent.x === endpoint.x || adjacent.y === endpoint.y) return;

    const horizontal = endpoint.side === 'WEST' || endpoint.side === 'EAST';
    const elbow = horizontal
        ? { x: adjacent.x, y: endpoint.y }
        : { x: endpoint.x, y: adjacent.y };
    points.splice(source ? 1 : points.length - 1, 0, elbow);
}

function anchorRoute(
    points: { x: number; y: number }[],
    source: RouteEndpoint,
    target: RouteEndpoint,
) {
    const anchored = points.map(point => ({ ...point }));
    anchorRouteEndpoint(anchored, source, true);
    anchorRouteEndpoint(anchored, target, false);
    return simplifyOrthogonalPoints(anchored);
}

function directRouteIfClear(
    source: RouteEndpoint,
    target: RouteEndpoint,
    placements: MacroInstance['placements'],
) {
    if (source.x !== target.x && source.y !== target.y) return null;
    const vertical = source.x === target.x;
    const crossesPlacement = placements.some(placement => {
        const left = placement.x;
        const right = placement.x + placement.width;
        const top = placement.y;
        const bottom = placement.y + placement.height;
        if (vertical) {
            return source.x > left + ORTHOGONAL_EPSILON
                && source.x < right - ORTHOGONAL_EPSILON
                && Math.min(source.y, target.y) < bottom - ORTHOGONAL_EPSILON
                && Math.max(source.y, target.y) > top + ORTHOGONAL_EPSILON;
        }
        return source.y > top + ORTHOGONAL_EPSILON
            && source.y < bottom - ORTHOGONAL_EPSILON
            && Math.min(source.x, target.x) < right - ORTHOGONAL_EPSILON
            && Math.max(source.x, target.x) > left + ORTHOGONAL_EPSILON;
    });
    return crossesPlacement ? null : [
        { x: source.x, y: source.y },
        { x: target.x, y: target.y },
    ];
}

function portProperties(side: string) {
    return { 'elk.port.side': side };
}

export async function routeMacroInternals(macro: MacroInstance): Promise<MacroRoutedPath[]> {
    const endpoints = new Map<string, RouteEndpoint>();
    const placementByPin = new Map<string, MacroInstance['placements'][number]>();
    const children: ElkNode[] = macro.placements.map(placement => ({
        id: placement.designator,
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height,
        ports: placement.pins.map(pin => ({
            id: pin.id,
            x: pin.x,
            y: pin.y,
            width: 0,
            height: 0,
            properties: portProperties(pin.side),
        }) as ElkPort),
    }));
    for (const placement of macro.placements) {
        for (const pin of placement.pins) {
            placementByPin.set(pin.id, placement);
            endpoints.set(pin.id, {
                x: placement.x + pin.x,
                y: placement.y + pin.y,
                side: pin.side,
            });
        }
    }
    const edges: ElkExtendedEdge[] = [];
    const edgeMeta = new Map<string, EdgeMeta>();
    const pinsBySignal = new Map<string, { id: string; signalName: string }[]>();

    for (const placement of macro.placements) {
        for (const pin of placement.pins) {
            if (!pin.signal_name || /^NC$/i.test(pin.signal_name)) continue;
            const routingSignalName = pin.routingSignalName ?? pin.signal_name;
            const pins = pinsBySignal.get(routingSignalName) ?? [];
            pins.push({ id: pin.id, signalName: pin.signal_name });
            pinsBySignal.set(routingSignalName, pins);
        }
    }

    let edgeOrdinal = 0;
    const fixedInternals: MacroRoutedPath[] = [];
    const publicEdgePrefix = `pattern_${macro.patternId}_${macro.absorbedDesignators.join('_')}`
        .replace(/[^A-Za-z0-9_.-]/g, '_');
    for (const pins of pinsBySignal.values()) {
        if (pins.length < 2) continue;
        const preferredPrimary = macro.ports.find(port => port.signalName === pins[0].signalName)?.primaryPinId;
        const primary = pins.find(pin => pin.id === preferredPrimary) ?? pins[0];
        for (const pin of pins) {
            if (pin.id === primary.id) continue;
            const id = `${publicEdgePrefix}_internal_${edgeOrdinal++}`;
            const sourcePlacement = placementByPin.get(primary.id);
            const targetPlacement = placementByPin.get(pin.id);
            if (sourcePlacement && sourcePlacement === targetPlacement) {
                const source = endpoints.get(primary.id);
                const target = endpoints.get(pin.id);
                if (!source || !target) throw new Error(`Intra-symbol endpoint missing for ${id}`);
                fixedInternals.push({
                    id,
                    signalName: primary.signalName,
                    sourcePinId: primary.id,
                    targetPinId: pin.id,
                    kind: 'internal',
                    points: routeAroundPlacement(source, target, sourcePlacement),
                });
                continue;
            }
            edges.push({ id, sources: [primary.id], targets: [pin.id] });
            edgeMeta.set(id, {
                signalName: primary.signalName,
                sourcePinId: primary.id,
                targetPinId: pin.id,
                kind: 'internal',
            });
        }
    }

    const fixedTails: MacroRoutedPath[] = [];
    for (const port of macro.ports) {
        if (port.tailMode === 'straight' || port.tailBendPoints) {
            const primary = macro.placements.flatMap(placement => placement.pins.map(pin => ({
                id: pin.id,
                x: placement.x + pin.x,
                y: placement.y + pin.y,
            }))).find(pin => pin.id === port.primaryPinId);
            if (!primary) throw new Error(`Primary pin ${port.primaryPinId} not found for ${macro.id}`);
            const points = simplifyOrthogonalPoints([
                { x: port.x, y: port.y },
                ...(port.tailBendPoints ?? []),
                { x: primary.x, y: primary.y },
            ]);
            if (points.some((point, index) => index > 0
                && point.x !== points[index - 1].x
                && point.y !== points[index - 1].y)) {
                throw new Error(`Fixed macro tail ${macro.id}.${port.key} is not orthogonal`);
            }
            fixedTails.push({
                id: `${macro.id}__tail_${port.pinNumber}`,
                signalName: port.signalName,
                sourcePinId: `${macro.id}__terminal_${port.pinNumber}_pin`,
                targetPinId: port.primaryPinId,
                kind: 'port-tail',
                macroPortId: port.elkPortId,
                points,
            });
            continue;
        }
        const terminalNodeId = `${macro.id}__terminal_${port.pinNumber}`;
        const terminalPinId = `${terminalNodeId}_pin`;
        endpoints.set(terminalPinId, { x: port.x, y: port.y, side: port.terminalSide });
        children.push({
            id: terminalNodeId,
            x: port.x - TERMINAL_SIZE / 2,
            y: port.y - TERMINAL_SIZE / 2,
            width: TERMINAL_SIZE,
            height: TERMINAL_SIZE,
            ports: [{
                id: terminalPinId,
                x: TERMINAL_SIZE / 2,
                y: TERMINAL_SIZE / 2,
                width: 0,
                height: 0,
                properties: portProperties(port.terminalSide),
            } as ElkPort],
        });
        const id = `${macro.id}__tail_${port.pinNumber}`;
        edges.push({ id, sources: [terminalPinId], targets: [port.primaryPinId] });
        edgeMeta.set(id, {
            signalName: port.signalName,
            sourcePinId: terminalPinId,
            targetPinId: port.primaryPinId,
            kind: 'port-tail',
            macroPortId: port.elkPortId,
        });
    }

    const graph: ElkNode = {
        id: `${macro.id}__routing_root`,
        width: macro.node.symbol.width,
        height: macro.node.symbol.height,
        children,
        edges,
    };
    const routes = await routeEdges(graph as never, {
        routingType: 'orthogonal',
        shapeBufferDistance: macro.routingClearance ?? SCHEMATIC_CLEARANCE.wire,
        idealNudgingDistance: macro.routingClearance ?? SCHEMATIC_CLEARANCE.wire,
        segmentPenalty: 10,
        crossingPenalty: 25,
        nudgeSharedPathsWithCommonEndPoint: false,
    });
    const routed: MacroRoutedPath[] = [...fixedTails, ...fixedInternals];
    for (const [edgeId, route] of routes) {
        const meta = edgeMeta.get(edgeId);
        if (!meta) continue;
        const rawPoints = [
            route.sourcePoint,
            ...route.bendPoints,
            route.targetPoint,
        ];
        const source = endpoints.get(meta.sourcePinId);
        const target = endpoints.get(meta.targetPinId);
        if (!source || !target) {
            throw new Error(`Route endpoint not found for ${edgeId}: ${meta.sourcePinId}->${meta.targetPinId}`);
        }
        const forceRouted = macro.forceRoutedSignals?.includes(meta.signalName) ?? false;
        const points = (forceRouted ? null : directRouteIfClear(source, target, macro.placements))
            ?? anchorRoute(rawPoints, source, target);
        if (points.length < 2) throw new Error(`libavoid returned an empty route for ${edgeId}`);
        if (points.some((point, index) => index > 0
            && point.x !== points[index - 1].x
            && point.y !== points[index - 1].y)) {
            throw new Error(`libavoid returned a non-orthogonal route for ${edgeId} ${meta.sourcePinId}->${meta.targetPinId}: ${JSON.stringify(points)}`);
        }
        routed.push({ id: edgeId, points, ...meta });
    }
    if (routed.length !== edges.length + fixedTails.length + fixedInternals.length) {
        throw new Error(`libavoid routed ${routed.length - fixedTails.length - fixedInternals.length} of ${edges.length} macro edges`);
    }
    return routed;
}

export async function preparePatternMacros(macros: MacroInstance[]) {
    const prepared: MacroInstance[] = [];
    for (const macro of macros) {
        try {
            macro.routedPaths = await routeMacroInternals(macro);
            prepared.push(macro);
        } catch (error) {
            logger.warn({ macroId: macro.id, patternId: macro.patternId, error: String(error) },
                'Pattern rejected because internal routing failed');
        }
    }
    return prepared;
}
