import type { ElkExtendedEdge } from 'elkjs';
import type { CircuitComponent } from '#types/circuit.ts';
import type { MacroInstance } from '../patterns/types.ts';
import { RouteEnvironment, clearPath, reconnect, localCrossings } from './router.ts';
import { type Placed, pinPositions, normal, edgeSegments, path, withPath, overlaps, expand, segmentThroughBox, EPS } from './geometry.ts';
import { connectedNetEdges, straightRuns } from './net-routes.ts';
import { SCHEMATIC_CLEARANCE as gap } from './policy.ts';
import { turnNode } from './groups.ts';
import { routeLength } from './geometry.ts';
import { acceptsFlagOrientation } from './flag-policy.ts';

/** Packing can free space that was occupied when the group was optimized.
 * Finish private pin-to-flag leads with one straight segment. Shared buses
 * are excluded: shortening a leaf must not discard someone else's tap. */
export function alignLeafFlags(nodes: Placed[], edges: ElkExtendedEdge[], added: readonly CircuitComponent[], nets: ReadonlyMap<string, string>) {
    let aligned = 0;
    const rotated: Placed[] = [];
    for (const c of added) {
        const flag = nodes.find(n => n.id === c.designator); if (flag?.ports?.length !== 1) continue;
        const id = flag.ports[0].id, net = nets.get(id)!;
        const incident = edges.filter(e => [...e.sources, ...e.targets].includes(id));
        if (incident.length !== 1) continue;
        const edge = incident[0], other = edge.sources[0] === id ? edge.targets[0] : edge.sources[0];
        const anchorNode = nodes.find(n => n.ports?.some(p => p.id === other));
        if (!anchorNode || added.some(c => c.designator === anchorNode.id)) continue;
        const bus = connectedNetEdges(edges.filter(e => nets.get(e.sources[0]) === net), nets).find(group => group.includes(edge));
        if (bus?.length !== 1) continue;
        const anchor = pinPositions([anchorNode]).get(other)!, outward = normal(anchorNode, other);
        const retained = edges.filter(e => e !== edge), env = new RouteEnvironment(nodes.filter(n => n !== flag), retained, nets);
        const oldCrossings = [...localCrossings([edge], env).values()].reduce((a, b) => a + b, 0);
        for (const pose of [flag, turnNode(flag, 180)]) {
            const inward = normal(pose, id);
            if (outward.x * inward.x + outward.y * inward.y > -0.5) continue;
            const terminal = { x: anchor.x + outward.x * gap.port, y: anchor.y + outward.y * gap.port };
            const next = { ...pose, x: terminal.x - pose.ports![0].x!, y: terminal.y - pose.ports![0].y! };
            if (!canPlaceFlag(next, nodes, retained, nets) || routeLength(path(edge)) <= gap.port + EPS) continue;
            const route = withPath(edge, edge.sources[0] === id ? [terminal, anchor] : [anchor, terminal]);
            if (!acceptsFlagOrientation(flag, next, c, [edge], [route], true)) continue;
            if (!clearPath(path(route), net, env, [next], [], new Set([flag.id, anchorNode.id]))
                || [...localCrossings([route], env).values()].reduce((a, b) => a + b, 0) > oldCrossings) continue;
            nodes = nodes.map(n => n === flag ? next : n); edges = edges.map(e => e === edge ? route : e);
            if (next.rotation !== undefined && next.rotation !== flag.rotation) rotated.push(next);
            aligned++; break;
        }
    }
    return { nodes, edges, aligned, rotated };
}

function canPlaceFlag(flag: Placed, nodes: Placed[], edges: ElkExtendedEdge[], nets: ReadonlyMap<string, string>) {
    const fixed = nodes.filter(n => n.id !== flag.id);
    if (flag.x < 0 || flag.y < 0 || fixed.some(n => overlaps(flag, n, gap.port))) return false;
    return !edges.some(e => edgeSegments(e).some(s => segmentThroughBox(s, expand(flag, gap.wire))))
        && ![...pinPositions(fixed)].some(([id, p]) => nets.get(id) !== nets.get(flag.ports![0].id)
            && p.x >= flag.x && p.x <= flag.x + flag.width && p.y >= flag.y && p.y <= flag.y + flag.height);
}

/** A bank's flag belongs above/below the rail centre, even if ELK represents
 * that rail by an edge to the leftmost capacitor. Only the flag lead changes. */
export function centerBankFlags(nodes: Placed[], edges: ElkExtendedEdge[], added: readonly CircuitComponent[],
    macros: readonly MacroInstance[], nets: ReadonlyMap<string, string>) {
    let centered = 0;
    for (const macro of macros.filter(m => m.patternId === 'parallel-two-pin')) {
        const members = new Set(macro.absorbedDesignators), memberPins = pinPositions(nodes.filter(n => members.has(n.id)));
        for (const c of added) {
            const flag = nodes.find(n => n.id === c.designator); if (!flag || flag.ports?.length !== 1) continue;
            if (normal(flag, flag.ports[0].id).y !== (c.part_uuid === 'GND' ? -1 : 1)) continue;
            const id = flag.ports[0].id, net = nets.get(id), incident = edges.filter(e => [...e.sources, ...e.targets].includes(id));
            if (!incident.length || incident.some(e => [...e.sources, ...e.targets].some(p => p !== id && !memberPins.has(p)))) continue;
            const terminals = [...memberPins].filter(([p]) => nets.get(p) === net).map(([, p]) => p);
            if (terminals.length < 2) continue;
            const x = (Math.min(...terminals.map(p => p.x)) + Math.max(...terminals.map(p => p.x))) / 2;
            const ground = c.part_uuid === 'GND', targetY = ground ? Math.max(...terminals.map(p => p.y)) : Math.min(...terminals.map(p => p.y));
            const rails = straightRuns(edges.filter(e => nets.get(e.sources[0]) === net
                && [...e.sources, ...e.targets].every(p => memberPins.has(p) || p === id)).flatMap(edgeSegments))
                .filter(s => Math.abs(s.a.y - s.b.y) < EPS && s.a.x <= x && s.b.x >= x
                    && (ground ? s.a.y > targetY : s.a.y < targetY)).sort((a, b) => Math.abs(a.a.y - targetY) - Math.abs(b.a.y - targetY));
            const rail = rails[0]; if (!rail) continue;
            const terminal = { x, y: rail.a.y + (ground ? gap.port : -gap.port) };
            const next = { ...flag, x: terminal.x - flag.ports[0].x!, y: terminal.y - flag.ports[0].y! };
            if (Math.abs(next.x - flag.x) < EPS && Math.abs(next.y - flag.y) < EPS) continue;
            const retained = edges.filter(e => !incident.includes(e));
            if (!canPlaceFlag(next, nodes, retained, nets)) continue;
            const env = new RouteEnvironment(nodes.filter(n => n !== flag), retained, nets);
            const routed = incident.map(e => {
                const other = e.sources[0] === id ? e.targets[0] : e.sources[0], pin = memberPins.get(other)!;
                const p = [terminal, { x, y: rail.a.y }, { x: pin.x, y: rail.a.y }, pin];
                return withPath(e, e.sources[0] === id ? p : p.toReversed());
            });
            if (routed.some(e => !clearPath(path(e), net!, env, [next], [], new Set([flag.id,
                nodes.find(n => n.ports?.some(p => p.id === (e.sources[0] === id ? e.targets[0] : e.sources[0])))!.id])))) continue;
            nodes = nodes.map(n => n === flag ? next : n); edges = edges.map(e => routed.find(r => r.id === e.id) ?? e); centered++;
        }
    }
    return { nodes, edges, centered };
}

/** Slide a ground flag down an existing nearby stem. Main-bus geometry and
 * every unrelated route stay byte-for-byte unchanged. */
export function lowerGroundFlags(nodes: Placed[], edges: ElkExtendedEdge[], added: readonly CircuitComponent[], nets: ReadonlyMap<string, string>) {
    let lowered = 0;
    for (const c of added.filter(c => c.part_uuid === 'GND')) {
        const flag = nodes.find(n => n.id === c.designator); if (!flag || flag.ports?.length !== 1) continue;
        if (normal(flag, flag.ports[0].id).y !== -1) continue;
        const id = flag.ports[0].id, p = pinPositions([flag]).get(id)!, net = nets.get(id)!;
        const incident = edges.filter(e => [...e.sources, ...e.targets].includes(id)), retained = edges.filter(e => !incident.includes(e));
        const bus = connectedNetEdges(edges.filter(e => nets.get(e.sources[0]) === net), nets).find(group => group.some(e => incident.includes(e)));
        const candidates = straightRuns((bus ?? []).flatMap(edgeSegments)).filter(s => Math.abs(s.a.x - s.b.x) < EPS
            && Math.abs(s.a.x - p.x) <= gap.branch * 4 && s.a.y <= p.y + EPS && s.b.y > p.y + gap.port)
            .map(s => ({ x: s.a.x, y: s.b.y + gap.port })).sort((a, b) => b.y - a.y || Math.abs(a.x - p.x) - Math.abs(b.x - p.x)).slice(0, 4);
        const env = new RouteEnvironment(nodes.filter(n => n !== flag), retained, nets), oldCrossings = localCrossings(incident, env);
        for (const target of candidates) {
            const next = { ...flag, x: target.x - flag.ports[0].x!, y: target.y - flag.ports[0].y! };
            if (!canPlaceFlag(next, nodes, retained, nets)) continue;
            const routes: ElkExtendedEdge[] = [];
            for (const e of incident) { const route = reconnect(e, [next], env, routes); if (!route) break; routes.push(route); }
            if (routes.length !== incident.length || [...localCrossings(routes, env)].some(([pair, count]) => count > (oldCrossings.get(pair) ?? 0))) continue;
            nodes = nodes.map(n => n === flag ? next : n); edges = edges.map(e => routes.find(r => r.id === e.id) ?? e); lowered++; break;
        }
    }
    return { nodes, edges, lowered };
}
