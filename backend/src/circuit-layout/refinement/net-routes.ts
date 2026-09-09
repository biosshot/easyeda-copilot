import type { ElkExtendedEdge } from 'elkjs';
import { SCHEMATIC_CLEARANCE as gap } from './policy.ts';
import { RouteQueue } from './route-queue.ts';

type Point = { x: number; y: number };
type Segment = { a: Point; b: Point };
type Box = { x: number; y: number; width: number; height: number };
type NetEdge = { edge: ElkExtendedEdge; net: string; points: Point[] };
export type CoalesceRouteOptions = {
    maxBridgeDistance?: number;
    terminalAliases?: ReadonlyMap<string, { id: string; point: Point }>;
    /** A nearby flag can be traded for a short shared wire. Only groups that
     * actually contain a removed terminal receive this allowance. */
    flagRemovalAllowance?: number;
};
const EPS = 1e-5;
const key = (p: Point) => `${Math.round(p.x / EPS)},${Math.round(p.y / EPS)}`;
const equal = (a: number, b: number) => Math.abs(a - b) < EPS;
const vertical = (s: Segment) => equal(s.a.x, s.b.x);
const length = (s: Segment) => Math.abs(s.a.x - s.b.x) + Math.abs(s.a.y - s.b.y);
const on = (p: Point, s: Segment) => (vertical(s) ? equal(p.x, s.a.x) : equal(p.y, s.a.y))
    && p.x >= Math.min(s.a.x, s.b.x) - EPS && p.x <= Math.max(s.a.x, s.b.x) + EPS
    && p.y >= Math.min(s.a.y, s.b.y) - EPS && p.y <= Math.max(s.a.y, s.b.y) + EPS;
const segments = (points: Point[]): Segment[] => points.slice(1).map((b, i) => ({ a: points[i], b })).filter(s => length(s) > EPS);
function intersection(a: Segment, b: Segment): Point | null {
    if (vertical(a) === vertical(b)) return null;
    const v = vertical(a) ? a : b, h = vertical(a) ? b : a;
    const p = { x: v.a.x, y: h.a.y };
    return on(p, a) && on(p, b) ? p : null;
}
function touches(a: Segment, b: Segment) {
    return intersection(a, b) !== null || on(a.a, b) || on(a.b, b) || on(b.a, a) || on(b.b, a);
}
function tooClose(a: Segment, b: Segment) {
    if (touches(a, b)) return true;
    if (vertical(a) !== vertical(b)) return false;
    const v = vertical(a), separation = Math.abs(v ? a.a.x - b.a.x : a.a.y - b.a.y);
    const low = Math.max(Math.min(v ? a.a.y : a.a.x, v ? a.b.y : a.b.x), Math.min(v ? b.a.y : b.a.x, v ? b.b.y : b.b.x));
    const high = Math.min(Math.max(v ? a.a.y : a.a.x, v ? a.b.y : a.b.x), Math.max(v ? b.a.y : b.a.x, v ? b.b.y : b.b.x));
    return separation < gap.wire && high - low > EPS;
}
function throughBox(s: Segment, b: Box) {
    return vertical(s)
        ? s.a.x > b.x + EPS && s.a.x < b.x + b.width - EPS
            && Math.min(s.a.y, s.b.y) < b.y + b.height - EPS && Math.max(s.a.y, s.b.y) > b.y + EPS
        : s.a.y > b.y + EPS && s.a.y < b.y + b.height - EPS
            && Math.min(s.a.x, s.b.x) < b.x + b.width - EPS && Math.max(s.a.x, s.b.x) > b.x + EPS;
}
function simplify(points: Point[]) {
    const result: Point[] = [];
    for (const p of points) {
        const b = result.at(-1), a = result.at(-2);
        if (b && key(b) === key(p)) continue;
        if (a && b && ((equal(a.x, b.x) && equal(b.x, p.x)) || (equal(a.y, b.y) && equal(b.y, p.y)))) result.pop();
        result.push(p);
    }
    return result;
}

export function straightRuns(input: readonly Segment[]) {
    const lines = new Map<string, { fixed: number; v: boolean; intervals: number[][] }>();
    for (const s of input) {
        const v = vertical(s), fixed = v ? s.a.x : s.a.y, id = `${v}:${Math.round(fixed / EPS)}`;
        const line = lines.get(id) ?? { fixed, v, intervals: [] };
        line.intervals.push(v ? [Math.min(s.a.y, s.b.y), Math.max(s.a.y, s.b.y)] : [Math.min(s.a.x, s.b.x), Math.max(s.a.x, s.b.x)]);
        lines.set(id, line);
    }
    const runs: Segment[] = [];
    for (const { fixed, v, intervals } of lines.values()) {
        const merged: number[][] = [];
        for (const interval of intervals.sort((a, b) => a[0] - b[0])) {
            const last = merged.at(-1);
            if (last && interval[0] <= last[1] + EPS) last[1] = Math.max(last[1], interval[1]);
            else merged.push([...interval]);
        }
        for (const [a, b] of merged) runs.push(v ? { a: { x: fixed, y: a }, b: { x: fixed, y: b } } : { a: { x: a, y: fixed }, b: { x: b, y: fixed } });
    }
    return runs.sort((a, b) => length(b) - length(a) || a.a.x - b.a.x || a.a.y - b.a.y || a.b.x - b.b.x || a.b.y - b.b.y);
}

/** Physical corners of ONE exact net, counting shared ink only once. A short
 * jog switches between parallel rails <=15 units apart, with >=20-unit arms
 * extending in opposite directions. T branches must not hide a staircase. */
export function measureRouteShape(edges: readonly ElkExtendedEdge[]) {
    const runs = straightRuns(edges.flatMap(e => (e.sections ?? []).flatMap(s => segments([s.startPoint, ...(s.bendPoints ?? []), s.endPoint]))));
    const points = new Map(runs.flatMap(s => [s.a, s.b]).map(p => [key(p), p]));
    const elbows = new Set<string>();
    for (const [id, p] of points) {
        const directions = new Set<string>();
        for (const s of runs) if (on(p, s)) {
            if (vertical(s)) {
                if (Math.min(s.a.y, s.b.y) < p.y - EPS) directions.add('N');
                if (Math.max(s.a.y, s.b.y) > p.y + EPS) directions.add('S');
            } else {
                if (Math.min(s.a.x, s.b.x) < p.x - EPS) directions.add('W');
                if (Math.max(s.a.x, s.b.x) > p.x + EPS) directions.add('E');
            }
        }
        if (directions.size === 2 && (directions.has('N') || directions.has('S')) && (directions.has('E') || directions.has('W'))) elbows.add(id);
    }
    const jogs = new Set<string>();
    for (const connector of runs) {
        const crossings = runs.map(rail => ({ rail, point: intersection(connector, rail) })).filter(c => c.point !== null);
        for (let i = 0; i < crossings.length; i++) for (const b of crossings.slice(i + 1)) {
            const a = crossings[i], distance = length({ a: a.point!, b: b.point! });
            if (distance <= EPS || distance > 15 + EPS) continue;
            const positions = [a.point!, b.point!].map(p => vertical(connector) ? p.y : p.x).sort((x, y) => x - y);
            const low = vertical(connector) ? connector.a.y : connector.a.x, high = vertical(connector) ? connector.b.y : connector.b.x;
            // Opposite taps close together on a continuous bus are not a
            // staircase. A step changes rail; this bus continues on both sides.
            if (positions[0] - low >= 20 && high - positions[1] >= 20) continue;
            const arms = ({ rail, point }: typeof a) => vertical(rail)
                ? [point!.y - Math.min(rail.a.y, rail.b.y), Math.max(rail.a.y, rail.b.y) - point!.y]
                : [point!.x - Math.min(rail.a.x, rail.b.x), Math.max(rail.a.x, rail.b.x) - point!.x];
            const aa = arms(a), ba = arms(b);
            if ((aa[0] >= 20 && ba[1] >= 20) || (aa[1] >= 20 && ba[0] >= 20)) jogs.add([key(a.point!), key(b.point!)].sort().join('|'));
        }
    }
    return { elbows: elbows.size, shortJogs: jogs.size };
}

function coalesceGroup(group: NetEdge[], foreign: Segment[], boxes: readonly Box[], pins: readonly Point[], options: CoalesceRouteOptions) {
    const maxDistance = options.maxBridgeDistance ?? 15;
    const aliases = options.terminalAliases;
    const removesFlag = group.some(e => [...e.edge.sources, ...e.edge.targets].some(id => aliases?.has(id)));
    const allowance = removesFlag ? options.flagRemovalAllowance ?? 0 : 0;
    const exits = new Map(group.flatMap(item => [[item.edge.sources[0], item.points], [item.edge.targets[0], item.points.toReversed()]] as const));
    const terminal = (item: NetEdge, source: boolean) => aliases?.get((source ? item.edge.sources : item.edge.targets)[0])?.point
        ?? (source ? item.points[0] : item.points.at(-1)!);
    const anchor = (item: NetEdge, source: boolean) => {
        const id = (source ? item.edge.sources : item.edge.targets)[0], alias = aliases?.get(id);
        const old = alias ? exits.get(alias.id) : source ? item.points : item.points.toReversed();
        const start = terminal(item, source);
        if (!old || old.length < 2) return start;
        const distance = length({ a: old[0], b: old[1] });
        // Reserve valid terminal escapes BEFORE constructing the tree. A
        // nearest rail inside that escape must not defeat every candidate.
        const escape = distance >= gap.pinEscape && segments(old).reduce((n, s) => n + length(s), 0) >= gap.pinEscape * 2
            ? gap.pinEscape : 0;
        return distance > EPS ? { x: start.x + (old[1].x - old[0].x) * escape / distance,
            y: start.y + (old[1].y - old[0].y) * escape / distance } : start;
    };
    const inputSegments = group.flatMap(e => segments(e.points));
    if (inputSegments.length > 250 || group.length < 2) return null; // bounded local postprocessing
    const originals = straightRuns(inputSegments);
    const points = new Map<string, Point>();
    const addPoint = (p: Point) => points.set(key(p), p);
    for (const s of inputSegments) { addPoint(s.a); addPoint(s.b); }
    for (const item of group) { addPoint(terminal(item, true)); addPoint(terminal(item, false)); addPoint(anchor(item, true)); addPoint(anchor(item, false)); }
    const bridges = new Map<string, Segment>();
    const bridgeClear = (s: Segment) => !boxes.some(box => throughBox(s, { x: box.x - gap.wire, y: box.y - gap.wire,
        width: box.width + 2 * gap.wire, height: box.height + 2 * gap.wire }))
        && !foreign.some(f => tooClose(s, f)) && !pins.some(pin => on(pin, s));
    // Extend a tap to the neighbouring bus. Bridging parallel runs alone
    // cannot straighten a bank whose short pin stems stop at the nearer rail.
    for (const stem of originals) for (const rail of originals) {
        if (vertical(stem) === vertical(rail)) continue;
        for (const p of [stem.a, stem.b]) {
            const q = vertical(stem) ? { x: p.x, y: rail.a.y } : { x: rail.a.x, y: p.y };
            const bridge = { a: p, b: q }, distance = length(bridge);
            if (distance < EPS || distance > maxDistance || !on(q, rail) || !bridgeClear(bridge)) continue;
            bridges.set([key(p), key(q)].sort().join('|'), bridge);
            addPoint(p); addPoint(q);
        }
    }
    // A staggered T has parallel arms that only meet at their common stem.
    // Project each arm onto the neighbouring level, reusing the existing pin
    // stems. Merely bridging overlapping rails cannot remove this step.
    for (let i = 0; i < originals.length; i++) for (const b of originals.slice(i + 1)) {
        const a = originals[i], v = vertical(a);
        if (v !== vertical(b)) continue;
        const distance = Math.abs(v ? a.a.x - b.a.x : a.a.y - b.a.y);
        if (distance < EPS || distance > maxDistance) continue;
        const interval = (s: Segment) => v ? [s.a.y, s.b.y] : [s.a.x, s.b.x];
        const aa = interval(a), bb = interval(b);
        if (Math.max(aa[0], bb[0]) > Math.min(aa[1], bb[1]) + EPS) continue;
        for (const [arm, rail] of [[a, b], [b, a]]) {
            const project = (p: Point) => v ? { x: rail.a.x, y: p.y } : { x: p.x, y: rail.a.y };
            const candidate = { a: project(arm.a), b: project(arm.b) };
            if (![candidate.a, candidate.b].every(p => originals.some(s => on(p, s))) || !bridgeClear(candidate)) continue;
            bridges.set([key(candidate.a), key(candidate.b)].sort().join('|'), candidate);
            addPoint(candidate.a); addPoint(candidate.b);
        }
    }
    for (let i = 0; i < originals.length; i++) for (const b of originals.slice(i + 1)) {
        const a = originals[i];
        const cross = intersection(a, b);
        if (cross) addPoint(cross);
        if (vertical(a) !== vertical(b)) continue;
        const distance = vertical(a) ? Math.abs(a.a.x - b.a.x) : Math.abs(a.a.y - b.a.y);
        if (distance < EPS || distance > maxDistance) continue;
        // Project neighbouring run endpoints onto BOTH rails. This permits a
        // straight tap through several close rails instead of a staircase that
        // switches rails only at their staggered original endpoints.
        const stops = new Set(originals.filter(s => vertical(s) === vertical(a)
            && Math.min(Math.abs((vertical(a) ? s.a.x : s.a.y) - (vertical(a) ? a.a.x : a.a.y)),
                Math.abs((vertical(a) ? s.a.x : s.a.y) - (vertical(a) ? b.a.x : b.a.y))) <= maxDistance)
            .flatMap(s => [vertical(a) ? s.a.y : s.a.x, vertical(a) ? s.b.y : s.b.x]));
        const low = Math.max(Math.min(vertical(a) ? a.a.y : a.a.x, vertical(a) ? a.b.y : a.b.x),
            Math.min(vertical(b) ? b.a.y : b.a.x, vertical(b) ? b.b.y : b.b.x));
        const high = Math.min(Math.max(vertical(a) ? a.a.y : a.a.x, vertical(a) ? a.b.y : a.b.x),
            Math.max(vertical(b) ? b.a.y : b.a.x, vertical(b) ? b.b.y : b.b.x));
        if (high - low >= gap.pinEscape * 2) {
            stops.add(low + gap.pinEscape); stops.add(high - gap.pinEscape); stops.add((low + high) / 2);
        }
        for (const stop of stops) {
            const p = vertical(a) ? { x: a.a.x, y: stop } : { x: stop, y: a.a.y };
            const q = vertical(b) ? { x: b.a.x, y: stop } : { x: stop, y: b.a.y };
            if (!on(p, a) || !on(q, b)) continue;
            const bridge = { a: p, b: q };
            if (!bridgeClear(bridge)) continue;
            bridges.set([key(p), key(q)].sort().join('|'), bridge);
            addPoint(p); addPoint(q);
        }
    }
    for (const a of bridges.values()) for (const b of [...originals, ...bridges.values()]) {
        const cross = intersection(a, b); if (cross) addPoint(cross);
    }
    if (points.size > 1000) return null;
    const adjacency = new Map<string, Map<string, number>>();
    const connect = (a: string, b: string) => {
        if (a === b) return;
        const distance = length({ a: points.get(a)!, b: points.get(b)! });
        for (const [from, to] of [[a, b], [b, a]]) {
            const neighbours = adjacency.get(from) ?? new Map<string, number>();
            neighbours.set(to, distance); adjacency.set(from, neighbours);
        }
    };
    let oldLength = 0;
    const oldSegments = new Set<string>();
    for (const [index, s] of [...originals, ...bridges.values()].entries()) {
        const nodes = [...points.entries()].filter(([, p]) => on(p, s)).sort((a, b) => vertical(s) ? a[1].y - b[1].y : a[1].x - b[1].x);
        for (let i = 1; i < nodes.length; i++) {
            connect(nodes[i - 1][0], nodes[i][0]);
            const id = [nodes[i - 1][0], nodes[i][0]].sort().join('|');
            if (index < originals.length && !oldSegments.has(id)) {
                oldSegments.add(id); oldLength += length({ a: nodes[i - 1][1], b: nodes[i][1] });
            }
        }
    }
    const terminals = [...new Set(group.flatMap(e => [key(anchor(e, true)), key(anchor(e, false))]))].sort();
    const originalShape = measureRouteShape(group.map(e => e.edge));
    const candidates = [undefined, ...originals.filter(s => [...bridges.values()].some(b => on(b.a, s) || on(b.b, s))).slice(0, 3)];
    const build = (trunk?: Segment) => {
        const seed = trunk ? [...points.entries()].filter(([, p]) => on(p, trunk))
            .sort((a, b) => vertical(trunk) ? a[1].y - b[1].y : a[1].x - b[1].x).map(([id]) => id) : [terminals[0]];
        const tree = new Map<string, Set<string>>(seed.map(id => [id, new Set()]));
        const remaining = new Set(terminals.filter(id => !tree.has(id)));
        let newLength = 0;
        for (let i = 1; i < seed.length; i++) {
            tree.get(seed[i - 1])!.add(seed[i]); tree.get(seed[i])!.add(seed[i - 1]);
            newLength += adjacency.get(seed[i - 1])!.get(seed[i])!;
        }
        while (remaining.size) {
            // Keep the chosen trunk as the attraction target. Seeding from every
            // newly attached twig recreates the nearest-neighbour staircase.
            const starts = trunk ? seed : [...tree.keys()];
            const distance = new Map(starts.map(k => [k, 0]));
            const previous = new Map<string, string>();
            const pending = new RouteQueue();
            for (const id of starts) pending.push(id, 0);
            let target: string | undefined;
            while (pending.size) {
                const nextEntry = pending.pop(), current = nextEntry.id;
                if (nextEntry.distance !== distance.get(current)) continue;
                if (remaining.has(current)) { target = current; break; }
                for (const [next, cost] of adjacency.get(current) ?? []) {
                    const candidate = distance.get(current)! + cost;
                    if (candidate + EPS < (distance.get(next) ?? Infinity)) {
                        distance.set(next, candidate); previous.set(next, current); pending.push(next, candidate);
                    }
                }
            }
            if (!target) return null;
            remaining.delete(target);
            const attachment: [string, string][] = [];
            while (!tree.has(target)) {
                const parent = previous.get(target);
                if (!parent) return null;
                attachment.push([target, parent]);
                target = parent;
            }
            for (const [child, parent] of attachment) {
                const neighbours = tree.get(parent) ?? new Set<string>();
                neighbours.add(child); tree.set(parent, neighbours);
                const own = tree.get(child) ?? new Set<string>(); own.add(parent); tree.set(child, own);
                newLength += adjacency.get(child)!.get(parent)!;
            }
        }
        if (newLength > oldLength + allowance + EPS) return null;
        const replacements: ElkExtendedEdge[] = [];
        for (const item of group) {
            const start = key(anchor(item, true)), end = key(anchor(item, false));
            const previous = new Map<string, string>();
            const pending = [start]; const visited = new Set([start]);
            for (let i = 0; i < pending.length && !visited.has(end); i++) for (const next of tree.get(pending[i]) ?? []) {
                if (visited.has(next)) continue;
                previous.set(next, pending[i]); visited.add(next); pending.push(next);
            }
            if (!visited.has(end)) return null;
            const route = [points.get(end)!];
            let cursor = end;
            while (cursor !== start) { cursor = previous.get(cursor)!; route.push(points.get(cursor)!); }
            const path = simplify([terminal(item, true), ...route.reverse(), terminal(item, false)]);
            if (key(terminal(item, true)) === key(terminal(item, false)) && removesFlag) continue;
            for (const from of [true, false]) {
                const id = (from ? item.edge.sources : item.edge.targets)[0], aliased = aliases?.get(id);
                const old = aliased ? exits.get(aliased.id) : from ? item.points : item.points.toReversed(), next = from ? path : path.toReversed();
                if (!old) return null;
                if (old.length < 2 || next.length < 2) return null;
                const oldLength = length({ a: old[0], b: old[1] });
                if (oldLength >= gap.pinEscape && (length({ a: next[0], b: next[1] }) < gap.pinEscape
                    || (old[1].x - old[0].x) * (next[1].x - next[0].x) + (old[1].y - old[0].y) * (next[1].y - next[0].y) <= 0)) return null;
            }
            // New junctions/bends must not turn an existing plain crossing into a
            // contact with a different net. Collinear sharing is only within this net.
            if (path.some(p => foreign.some(s => on(p, s)))) return null;
            const sources = item.edge.sources.map(id => aliases?.get(id)?.id ?? id);
            const targets = item.edge.targets.map(id => aliases?.get(id)?.id ?? id);
            replacements.push({ ...item.edge, junctionPoints: undefined, sources, targets, sections: [{ ...item.edge.sections![0],
                incomingShape: sources[0], outgoingShape: targets[0], startPoint: path[0], endPoint: path.at(-1)!, bendPoints: path.slice(1, -1) }] });
        }
        const shape = measureRouteShape(replacements);
        // Reserved stubs may overlap the tree or each other. Measure shared
        // ink once, rather than charging every logical path for its copy.
        newLength = straightRuns(replacements.flatMap(e => segments([e.sections![0].startPoint,
            ...(e.sections![0].bendPoints ?? []), e.sections![0].endPoint]))).reduce((sum, s) => sum + length(s), 0);
        if (newLength > oldLength + allowance + EPS) return null;
        if (shape.shortJogs > originalShape.shortJogs || shape.elbows > originalShape.elbows + (removesFlag ? 2 : 0)) return null;
        if (!removesFlag && newLength >= oldLength - 1 && shape.shortJogs >= originalShape.shortJogs && shape.elbows >= originalShape.elbows) return null;
        return { replacements, savedLength: oldLength - newLength, shape };
    };
    const results = candidates.map(build).filter(r => r !== null);
    results.sort((a, b) => a.shape.shortJogs - b.shape.shortJogs || a.shape.elbows - b.shape.elbows || b.savedLength - a.savedLength);
    return results[0] ?? null;
}

/** Connected drawing islands, including routes with different endpoint IDs
 * which already share physical ink. Matching a net name alone is insufficient. */
export function connectedNetEdges(edges: readonly ElkExtendedEdge[], netByPin: ReadonlyMap<string, string>) {
    const groups: ElkExtendedEdge[][] = [];
    const byNet = new Map<string, ElkExtendedEdge[]>();
    for (const edge of edges) {
        const net = netByPin.get(edge.sources[0]);
        if (!net || [...edge.sources, ...edge.targets].some(id => netByPin.get(id) !== net)) continue;
        const list = byNet.get(net) ?? []; list.push(edge); byNet.set(net, list);
    }
    for (const list of byNet.values()) {
        const geometry = new Map(list.map(e => [e, (e.sections ?? []).flatMap(s => segments([s.startPoint, ...(s.bendPoints ?? []), s.endPoint]))]));
        const remaining = new Set(list);
        while (remaining.size) {
            const group = [remaining.values().next().value!]; remaining.delete(group[0]);
            for (let i = 0; i < group.length; i++) for (const b of remaining) {
                const a = group[i];
                if (![...a.sources, ...a.targets].some(id => [...b.sources, ...b.targets].includes(id))
                    && !geometry.get(a)!.some(s => geometry.get(b)!.some(t => touches(s, t)))) continue;
                group.push(b); remaining.delete(b);
            }
            groups.push(group);
        }
    }
    return groups;
}

/** Reuse nearby routes of the SAME exact net. Endpoint IDs survive. */
export function coalesceNetRoutes(edges: readonly ElkExtendedEdge[], netByPin: ReadonlyMap<string, string>,
    boxes: readonly Box[], pins: readonly Point[] = [], options: CoalesceRouteOptions = {}) {
    for (const [from, to] of options.terminalAliases ?? []) {
        if (!netByPin.get(from) || netByPin.get(from) !== netByPin.get(to.id)) return { edges: [...edges], groupsChanged: 0, savedLength: 0 };
    }
    const identity = (id: string) => options.terminalAliases?.get(id)?.id ?? id;
    const entries: NetEdge[] = [];
    for (const edge of edges) {
        const endpointNets = [...edge.sources, ...edge.targets].map(id => netByPin.get(id));
        const nets = new Set(endpointNets);
        if (endpointNets.some(net => !net) || nets.size !== 1 || edge.sources.length !== 1
            || edge.targets.length !== 1 || edge.sections?.length !== 1) continue;
        const s = edge.sections[0], points = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint];
        if (segments(points).some(s => !equal(s.a.x, s.b.x) && !equal(s.a.y, s.b.y))) continue;
        entries.push({ edge, points, net: [...nets][0]! });
    }
    // Unknown, compound or non-orthogonal routes must not become invisible
    // obstacles. Leave this scene alone rather than make a partial safety claim.
    if (entries.length !== edges.length) return { edges: [...edges], groupsChanged: 0, savedLength: 0 };
    const replacement = new Map<string, ElkExtendedEdge>();
    const removedEdges = new Set<string>();
    let savedLength = 0, groupsChanged = 0;
    const islands = new Map(connectedNetEdges(edges, netByPin).flatMap((group, index) => group.map(e => [e.id, index] as const)));
    const aliasNets = options.terminalAliases?.size ? new Set([...options.terminalAliases.keys()].map(id => netByPin.get(id))) : null;
    for (const net of [...new Set(entries.map(e => e.net))].sort()) {
        if (aliasNets && !aliasNets.has(net)) continue;
        const remaining = entries.filter(e => e.net === net);
        while (remaining.length) {
            const group = [remaining.shift()!];
            const terminals = new Set([...group[0].edge.sources, ...group[0].edge.targets].map(identity));
            for (let changed = true; changed;) {
                changed = false;
                for (let i = remaining.length - 1; i >= 0; i--) {
                    const ids = [...remaining[i].edge.sources, ...remaining[i].edge.targets].map(identity);
                    if (!ids.some(id => terminals.has(id)) && !group.some(e => islands.get(e.edge.id) === islands.get(remaining[i].edge.id))) continue;
                    group.push(remaining.splice(i, 1)[0]); ids.forEach(id => terminals.add(id)); changed = true;
                }
            }
            group.sort((a, b) => a.edge.id < b.edge.id ? -1 : a.edge.id > b.edge.id ? 1 : 0);
            const foreign = entries.filter(e => e.net !== net).flatMap(e => {
                const section = replacement.get(e.edge.id)?.sections?.[0];
                return segments(section ? [section.startPoint, ...(section.bendPoints ?? []), section.endPoint] : e.points);
            });
            const result = coalesceGroup(group, foreign, boxes, pins, options);
            if (!result) continue;
            for (const edge of result.replacements) replacement.set(edge.id, edge);
            for (const item of group) if (!result.replacements.some(e => e.id === item.edge.id)) removedEdges.add(item.edge.id);
            savedLength += result.savedLength; groupsChanged++;
        }
    }
    return { edges: edges.filter(e => !removedEdges.has(e.id)).map(e => replacement.get(e.id) ?? e), groupsChanged, savedLength };
}

export { segments as routeSegments, on as pointOnSegment, touches as segmentsTouch, throughBox as segmentThroughBox,
    simplify as simplifyRoute, length as segmentLength, key as pointKey };
