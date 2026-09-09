import type { ElkExtendedEdge } from 'elkjs';
import { SCHEMATIC_CLEARANCE as gap, REFINEMENT_LIMITS as limit } from './policy.ts';
import { SpatialIndex, type Placed, type Point, type Segment, type Box, EPS, path, edgeSegments, expand,
    normal, pinPositions, shift, routeLength, exitsAlong, segmentBox, pointOnSegment, routeSegments, segmentThroughBox, simplifyRoute, withPath } from './geometry.ts';
import { pointKey, segmentsTouch } from './net-routes.ts';

type Wire = Segment & { net: string; edge: string };
type Pin = Point & { id: string; net: string };
export class RouteEnvironment {
    wires: SpatialIndex<Wire>;
    bodies: SpatialIndex<Placed>;
    pins: SpatialIndex<Pin>;
    nodes: Placed[];
    edges: ElkExtendedEdge[];
    nets: ReadonlyMap<string, string>;
    constructor(nodes: Placed[], edges: ElkExtendedEdge[], nets: ReadonlyMap<string, string>) {
        this.nodes = nodes; this.edges = edges; this.nets = nets;
        this.wires = new SpatialIndex(edges.flatMap(e => edgeSegments(e).map(s => ({ ...s, net: nets.get(e.sources[0]) ?? `unknown:${e.id}`, edge: e.id }))), segmentBox);
        this.bodies = new SpatialIndex(nodes, n => n);
        this.pins = new SpatialIndex([...pinPositions(nodes)].map(([id, p]) => ({ ...p, id, net: nets.get(id) ?? `unknown:${id}` })), p => ({ ...p, width: 0, height: 0 }));
    }
}

function properCrossing(a: Segment, b: Segment) {
    if (!segmentsTouch(a, b)) return false;
    return ![a.a, a.b, b.a, b.b].some(p => pointOnSegment(p, a) && pointOnSegment(p, b));
}
function parallelTooClose(a: Segment, b: Segment) {
    const av = Math.abs(a.a.x - a.b.x) < EPS, bv = Math.abs(b.a.x - b.b.x) < EPS;
    if (av !== bv) return false;
    const separation = Math.abs(av ? a.a.x - b.a.x : a.a.y - b.a.y);
    const along = (s: Segment) => av ? [Math.min(s.a.y, s.b.y), Math.max(s.a.y, s.b.y)] : [Math.min(s.a.x, s.b.x), Math.max(s.a.x, s.b.x)];
    const aa = along(a), bb = along(b);
    return separation < gap.wire - EPS && Math.min(aa[1], bb[1]) - Math.max(aa[0], bb[0]) > EPS;
}

/** Only the changing routes are checked against indexed local obstacles. This
 * is routing feasibility, not a second electrical validation of the scene. */
export function clearPath(points: Point[], net: string, environment: RouteEnvironment, moving: Placed[],
    dynamic: ElkExtendedEdge[], endpointOwners: ReadonlySet<string>, newGeometry = true) {
    for (const s of routeSegments(points)) {
        const region = expand(segmentBox(s), gap.wire);
        for (const n of [...environment.bodies.query(region), ...moving]) {
            if (segmentThroughBox(s, n)) return false;
            if (newGeometry && segmentThroughBox(s, expand(n, gap.wire))) {
                const terminalSegment = endpointOwners.has(n.id) && (n.ports ?? []).some(pin => {
                    const p = { x: n.x + pin.x!, y: n.y + pin.y! };
                    return [points[0], points.at(-1)!].some(end => Math.abs(p.x - end.x) < EPS && Math.abs(p.y - end.y) < EPS)
                        && pointOnSegment(p, s);
                });
                if (!terminalSegment) return false;
            }
        }
        const obstacles = [...environment.wires.query(region), ...dynamic.flatMap(e => edgeSegments(e).map(part => ({ ...part,
            net: environment.nets.get(e.sources[0]) ?? `unknown:${e.id}`, edge: e.id })))];
        for (const wire of obstacles) {
            if (wire.net === net) continue;
            if (segmentsTouch(s, wire) && !properCrossing(s, wire)) return false;
            if (newGeometry && parallelTooClose(s, wire)) return false;
        }
        const pins = [...environment.pins.query(region), ...[...pinPositions(moving)].map(([id, p]) => ({ ...p, id, net: environment.nets.get(id) }))];
        if (pins.some(p => p.net !== net && pointOnSegment(p, s))) return false;
    }
    return true;
}

function candidates(a: Point, b: Point, startNormal: Point, endNormal: Point, channels: Box[]) {
    const start = shift(a, { x: startNormal.x * gap.pinEscape, y: startNormal.y * gap.pinEscape });
    const end = shift(b, { x: endNormal.x * gap.pinEscape, y: endNormal.y * gap.pinEscape });
    const middle: Point[][] = [[{ x: end.x, y: start.y }], [{ x: start.x, y: end.y }]];
    for (const n of channels.slice(0, limit.channels)) {
        for (const x of [n.x - gap.pinEscape, n.x + n.width + gap.pinEscape]) middle.push([{ x, y: start.y }, { x, y: end.y }]);
        for (const y of [n.y - gap.pinEscape, n.y + n.height + gap.pinEscape]) middle.push([{ x: start.x, y }, { x: end.x, y }]);
    }
    return middle.map(m => simplifyRoute([a, start, ...m, end, b])).filter(p => exitsAlong(p, startNormal, gap.pinEscape)
        && exitsAlong(p.toReversed(), endNormal, gap.pinEscape));
}

export function reconnect(edge: ElkExtendedEdge, moving: Placed[], environment: RouteEnvironment, accepted: ElkExtendedEdge[]) {
    const allNodes = [...environment.nodes, ...moving], pins = pinPositions(allNodes);
    const from = edge.sources[0], to = edge.targets[0], a = pins.get(from), b = pins.get(to);
    const net = environment.nets.get(from);
    if (!a || !b || !net || net !== environment.nets.get(to)) return null;
    const fromNode = allNodes.find(n => n.ports?.some(p => p.id === from))!, toNode = allNodes.find(n => n.ports?.some(p => p.id === to))!;
    const endpointOwners = new Set([fromNode.id, toNode.id]);
    const an = normal(fromNode, from), bn = normal(toNode, to);
    const nearby = environment.bodies.query(expand(segmentBox({ a, b }), gap.pinEscape));
    const proposed = candidates(a, b, an, bn, [...moving, ...nearby]);
    // Keep an old suffix when only one endpoint moved; existing crossings can
    // stay in place while a long lead is shortened. Both terminal escapes remain.
    const movingIds = new Set(moving.map(n => n.id));
    if (movingIds.has(fromNode.id) !== movingIds.has(toNode.id)) {
        const sourceMoved = movingIds.has(fromNode.id), start = sourceMoved ? a : b, sn = sourceMoved ? an : bn;
        const old = sourceMoved ? path(edge) : path(edge).toReversed();
        for (let i = 1; i < old.length; i++) {
            const s = { a: old[i - 1], b: old[i] };
            const v = Math.abs(s.a.x - s.b.x) < EPS;
            const projected = v ? { x: s.a.x, y: Math.max(Math.min(start.y, Math.max(s.a.y, s.b.y)), Math.min(s.a.y, s.b.y)) }
                : { x: Math.max(Math.min(start.x, Math.max(s.a.x, s.b.x)), Math.min(s.a.x, s.b.x)), y: s.a.y };
            for (const join of [projected, s.a, s.b]) {
                const lead = shift(start, { x: sn.x * gap.pinEscape, y: sn.y * gap.pinEscape });
                for (const elbow of [{ x: join.x, y: lead.y }, { x: lead.x, y: join.y }]) {
                    const prefix = simplifyRoute([start, lead, elbow, join]);
                    if (!exitsAlong(prefix, sn, gap.pinEscape) || !clearPath(prefix, net, environment, moving, accepted, endpointOwners)) continue;
                    const p = simplifyRoute([...prefix, ...old.slice(i)]);
                    const ordered = sourceMoved ? p : p.toReversed();
                    if (exitsAlong(ordered, an, gap.pinEscape) && exitsAlong(ordered.toReversed(), bn, gap.pinEscape)) proposed.push(ordered);
                }
            }
        }
    }
    proposed.sort((a, b) => routeLength(a) + a.length * gap.pinEscape - routeLength(b) - b.length * gap.pinEscape);
    for (const p of proposed) if (clearPath(p, net, environment, moving, accepted, endpointOwners)) return withPath(edge, p);
    return null;
}

/** Count crossings involving just the modified routes, by pair of net IDs.
 * A shared line is counted once. Unchanged-unrelated routes are never compared. */
export function localCrossings(edges: ElkExtendedEdge[], environment: RouteEnvironment) {
    const found = new Set<string>();
    const dynamic = edges.flatMap(e => edgeSegments(e).map(s => ({ ...s, net: environment.nets.get(e.sources[0]) ?? e.id, edge: e.id })));
    for (const a of dynamic) {
        for (const b of [...environment.wires.query(segmentBox(a)), ...dynamic]) {
            if (a.net === b.net || !properCrossing(a, b)) continue;
            const av = Math.abs(a.a.x - a.b.x) < EPS;
            found.add(JSON.stringify([[a.net, b.net].sort(), pointKey({ x: av ? a.a.x : b.a.x, y: av ? b.a.y : a.a.y })]));
        }
    }
    const counts = new Map<string, number>();
    for (const entry of found) { const key = JSON.stringify(JSON.parse(entry)[0]); counts.set(key, (counts.get(key) ?? 0) + 1); }
    return counts;
}
