import type { ElkNode, ElkExtendedEdge } from 'elkjs';
import type { CircuitComponent } from '#types/circuit.ts';
import type { SymbolWithMeta } from '#types/symbol.ts';
import type { MacroInstance } from '../patterns/types.ts';
import { localGroups, orientations, translations } from './groups.ts';
import { RouteEnvironment, reconnect, localCrossings, clearPath } from './router.ts';
import { type Placed, type Point, EPS, pinPositions, path, normal, orthogonal, exitsAlong, overlaps, expand,
    edgeSegments, shift, withPath, boundsOf, routeLength } from './geometry.ts';
import { coalesceNetRoutes, straightRuns, segmentLength, measureRouteShape, connectedNetEdges } from './net-routes.ts';
import { acceptsFlagOrientation, flagReadabilityCost } from './flag-policy.ts';
import { SCHEMATIC_CLEARANCE as gap, REFINEMENT_LIMITS as limit, componentClearance } from './policy.ts';
import { resolveSceneBlocks } from './scope.ts';
import { mergeLocalFlags } from './flags.ts';
import { centerBankFlags, lowerGroundFlags, alignLeafFlags } from './flag-position.ts';
import { labelLongLinks, LONG_LINK_POLICY } from './long-links.ts';
import { compactEmptyBands } from './compact.ts';
import { packDrawingIslands } from './pack-islands.ts';
import { hasConnection } from '../signals.ts';

export function sceneNets(components: readonly CircuitComponent[]) {
    return new Map<string, string>(components.flatMap(c => c.pins.map(p => [`${c.designator}_pin_${p.pin_number}`,
        hasConnection(p.signal_name) ? p.signal_name : `unconnected:${c.designator}:${p.pin_number}`] as const)));
}

function physicalLength(edges: ElkExtendedEdge[], nets: ReadonlyMap<string, string>) {
    const byNet = new Map<string, ElkExtendedEdge[]>();
    for (const e of edges) { const key = nets.get(e.sources[0])!; const list = byNet.get(key) ?? []; list.push(e); byNet.set(key, list); }
    return [...byNet.values()].reduce((sum, list) => sum + straightRuns(list.flatMap(edgeSegments)).reduce((n, s) => n + segmentLength(s), 0), 0);
}
function cost(nodes: Placed[], edges: ElkExtendedEdge[], nets: ReadonlyMap<string, string>, originals: ReadonlySet<string>) {
    let result = physicalLength(edges, nets);
    for (const e of edges) {
        const p = path(e);
        result += Math.max(0, p.length - 2) * gap.pinEscape;
        const owners = [e.sources[0], e.targets[0]].map(id => nodes.find(n => n.ports?.some(port => port.id === id)));
        // Give the lead between real parts priority over the small bend needed
        // to connect an upright supply flag to a horizontal series component.
        if (owners.every(n => n && originals.has(n.id))) {
            const anchored = owners.some(n => /^U/i.test(n!.id) || (n!.ports?.length ?? 0) > 4);
            result += Math.max(0, p.length - 2) * gap.branch + routeLength(p) * (anchored ? 3 : 1);
        }
        for (const [id, points] of [[e.sources[0], p], [e.targets[0], p.toReversed()]] as const) {
            const owner = nodes.find(n => n.ports?.some(port => port.id === id));
            if (owner && !exitsAlong([...points], normal(owner, id), gap.pinEscape)) result += gap.branch * 4;
        }
    }
    return result;
}

/** Bounded local placement/routing. Complete electrical and export checks live
 * in the bank runner, never in this production candidate loop. */
export function refineSchematicScene(input: ElkNode, components: readonly CircuitComponent[], added: readonly CircuitComponent[],
    symbols: readonly SymbolWithMeta[], macros: readonly MacroInstance[] = []) {
    const started = performance.now(), scene = structuredClone(input);
    let nodes = (scene.children ?? []) as Placed[], edges = scene.edges ?? [];
    const nets = sceneNets([...components, ...added]), blocks = resolveSceneBlocks(components, added, edges);
    const originalIds = new Set(components.map(c => c.designator));
    const patternByMember = new Map(macros.flatMap(m => m.absorbedDesignators.map(id => [id, m.id] as const)));
    const rotations = new Map<string, { rotate: number; center: Point }>();
    const stats = { groupsMoved: 0, componentsRotated: 0, candidates: 0, netsCoalesced: 0, flagsRemoved: 0, flagsCentered: 0, flagsLowered: 0, flagsAligned: 0, longLinksLabeled: 0,
        relayouts: 0, localizedNets: [] as string[], islandsPacked: 0, emptySpaceRemoved: 0, sceneTranslation: { x: 0, y: 0 }, elapsedMs: 0, skipped: '' };
    if (edges.some(e => !orthogonal(path(e)) || e.sources.length !== 1 || e.targets.length !== 1)) {
        stats.skipped = 'Unsupported compound or non-orthogonal routes'; stats.elapsedMs = performance.now() - started;
        return { scene, rotations, addedSymbols: [] as CircuitComponent[], removedSymbolIds: new Set<string>(), stats };
    }
    const newSymbols: CircuitComponent[] = [];
    for (let pass = 0; pass < limit.passes; pass++) {
        const labeled = labelLongLinks(nodes, edges, nets, blocks, originalIds, Math.max(0, LONG_LINK_POLICY.maximumLinks - stats.longLinksLabeled), patternByMember);
        nodes = labeled.nodes; edges = labeled.edges; added = [...added, ...labeled.added]; stats.longLinksLabeled += labeled.links;
        newSymbols.push(...labeled.added);
        const flagKinds = new Map(added.map(c => [c.designator, c]));
        const groups = localGroups(nodes, edges, components, added, macros);
        for (const group of groups) {
            if (!group.ids.length || group.ids.length > limit.members) continue;
            const ids = new Set(group.ids), moving = nodes.filter(n => ids.has(n.id)), fixed = nodes.filter(n => !ids.has(n.id));
            const pins = new Set(moving.flatMap(n => (n.ports ?? []).map(p => p.id)));
            const incident = edges.filter(e => [...e.sources, ...e.targets].some(p => pins.has(p)));
            const boundary = incident.filter(e => [...e.sources, ...e.targets].some(p => !pins.has(p)));
            if (!incident.length || boundary.length > limit.boundaryEdges || incident.some(e => !orthogonal(path(e)) || e.sources.length !== 1 || e.targets.length !== 1)) continue;
            const owner = new Map(nodes.flatMap(n => (n.ports ?? []).map(p => [p.id, n.id])));
            const scopes = new Set(incident.flatMap(e => [...e.sources, ...e.targets]).map(p => blocks.get(owner.get(p)!)));
            if (scopes.size !== 1 || scopes.has(undefined)) continue;
            const incidentIds = new Set(incident.map(e => e.id)), env = new RouteEnvironment(fixed, edges.filter(e => !incidentIds.has(e.id)), nets);
            const affectedNets = new Set(incident.map(e => nets.get(e.sources[0])));
            const rails = edges.filter(e => affectedNets.has(nets.get(e.sources[0])) && !incidentIds.has(e.id));
            if ([...incident, ...rails].reduce((n, e) => n + edgeSegments(e).length, 0) > limit.netSegments) continue;
            // Include retained portions of these nets: moving one duplicate route
            // must not keep its old crossing AND introduce a second crossing nearby.
            const priorCrossings = localCrossings([...incident, ...rails], env);
            const oldJogs = new Map([...affectedNets].map(net => [net,
                measureRouteShape([...incident, ...rails].filter(e => nets.get(e.sources[0]) === net)).shortJogs]));
            const crowding = (moving: Placed[]) => moving.reduce((sum, n) => sum + fixed.filter(b => originalIds.has(n.id) && originalIds.has(b.id)
                && componentClearance(n, b) > gap.component && overlaps(n, b, componentClearance(n, b))).length * gap.largeIC * 8, 0);
            const privatePins = new Set(connectedNetEdges([...incident, ...rails], nets).filter(g => g.length === 1)
                .flatMap(g => [...g[0].sources, ...g[0].targets]));
            const initialCost = cost(nodes, [...incident, ...rails], nets, originalIds) + crowding(moving)
                + flagReadabilityCost(nodes, [...incident, ...rails], flagKinds);
            const initialLength = physicalLength([...incident, ...rails], nets);
            let best: { nodes: Placed[]; edges: ElkExtendedEdge[]; value: number } | undefined;
            let attempted = 0, screened = 0;
            const poses = orientations(group, nodes, symbols).map(pose => ({ pose, shifts: translations(pose, boundary, fixed, rails, nets) }));
            // Round-robin orientations: a busy first pose must not exhaust the
            // candidate budget before the useful 90-degree pose gets a turn.
            candidateSearch: for (let index = 0; index < Math.max(...poses.map(p => p.shifts.length)); index++) {
                for (const { pose, shifts } of poses) {
                    const d = shifts[index]; if (!d) continue;
                    if (++screened > limit.candidates * 4 || attempted >= limit.candidates) break candidateSearch;
                    stats.candidates++;
                    const candidate = pose.nodes.map(n => ({ ...n, x: n.x + d.x, y: n.y + d.y }));
                    if (candidate.some(n => env.bodies.query(expand(n, gap.largeIC)).some(b => overlaps(n, b, originalIds.has(n.id) && originalIds.has(b.id) ? componentClearance(n, b) : gap.port)))) continue;
                    // Rigid groups retain the spacing defined by their pattern.
                    // Rechecking it against a different padding froze whole groups
                    // (notably the existing pi filter, whose parts share a rail).
                    if (group.flexible && candidate.some((n, i) => candidate.slice(i + 1).some(b => overlaps(n, b, gap.port)))) continue;
                    // Bodies cannot move across an unchanged wire, even on their own net.
                    if (candidate.some(n => env.wires.query(expand(n, gap.wire)).some(s => {
                        const box = expand(n, gap.wire);
                        return Math.max(s.a.x, s.b.x) > box.x + EPS && Math.min(s.a.x, s.b.x) < box.x + box.width - EPS
                            && Math.max(s.a.y, s.b.y) > box.y + EPS && Math.min(s.a.y, s.b.y) < box.y + box.height - EPS;
                    }))) continue;
                    attempted++;
                    const routed: ElkExtendedEdge[] = [];
                    let valid = true;
                    for (const edge of incident) {
                        const internal = edge.sources.every(p => pins.has(p)) && edge.targets.every(p => pins.has(p));
                        let next: ElkExtendedEdge | null;
                        if (internal && !group.flexible) {
                            next = withPath(edge, path(edge).map(p => shift(pose.transform?.(p) ?? p, d)));
                            const owners = new Set([...edge.sources, ...edge.targets].map(p => owner.get(p)!));
                            if (!clearPath(path(next), nets.get(edge.sources[0])!, env, candidate, routed, owners, false)) next = null;
                        } else next = reconnect(edge, candidate, env, routed);
                        if (!next) { valid = false; break; }
                        // Preserve an established straight IC attachment. An old
                        // passive-to-passive axis must not lock an inductor far from
                        // its IC: that straightness is a cost preference, not a veto.
                        if (!internal && path(edge).length === 2 && [...edge.sources, ...edge.targets].every(p => originalIds.has(owner.get(p)!))) {
                            const oldOwners = [...edge.sources, ...edge.targets].map(p => nodes.find(n => n.id === owner.get(p))!);
                            if (oldOwners.some(n => /^U/i.test(n.id) || (n.ports?.length ?? 0) > 4)
                                && exitsAlong(path(edge), normal(oldOwners[0], edge.sources[0]), gap.pinEscape)
                                && exitsAlong(path(edge).toReversed(), normal(oldOwners[1], edge.targets[0]), gap.pinEscape)
                                && path(next).length !== 2) { valid = false; break; }
                        }
                        routed.push(next);
                    }
                    if (!valid) continue;
                    if (candidate.some(n => {
                        const flag = flagKinds.get(n.id), before = moving.find(b => b.id === n.id);
                        return flag && before && !acceptsFlagOrientation(before, n, flag, incident, routed, privatePins.has(n.ports![0].id));
                    })) continue;
                    if (pose.requiresShorter && physicalLength([...routed, ...rails], nets) >= initialLength - 1) continue;
                    const crossings = localCrossings([...routed, ...rails], env);
                    // Moving a group may replace a GND/output crossing with one
                    // GND/input crossing. Compare total physical crossings, not
                    // their old pair names; the count must still not grow.
                    if ([...crossings.values()].reduce((n, count) => n + count, 0)
                        > [...priorCrossings.values()].reduce((n, count) => n + count, 0)) continue;
                    const value = cost([...fixed, ...candidate], [...routed, ...rails], nets, originalIds)
                        + flagReadabilityCost([...fixed, ...candidate], [...routed, ...rails], flagKinds);
                    if (value < (best?.value ?? initialCost) - 1) {
                        if ([...affectedNets].some(net => measureRouteShape([...routed, ...rails].filter(e => nets.get(e.sources[0]) === net)).shortJogs > oldJogs.get(net)!)) continue;
                        best = { nodes: candidate, edges: routed, value };
                    }
                }
            }
            if (!best) continue;
            const replacement = new Map(best.nodes.map(n => [n.id, n])), routes = new Map(best.edges.map(e => [e.id, e]));
            nodes = nodes.map(n => replacement.get(n.id) ?? n); edges = edges.map(e => routes.get(e.id) ?? e);
            stats.groupsMoved++;
            for (const n of best.nodes) if (n.rotation !== undefined && n.center) rotations.set(n.id, { rotate: n.rotation, center: n.center });
        }
    }
    const centered = centerBankFlags(nodes, edges, added, macros, nets);
    nodes = centered.nodes; edges = centered.edges; stats.flagsCentered = centered.centered;
    const coalesced = coalesceNetRoutes(edges, nets, nodes, [...pinPositions(nodes).values()], { maxBridgeDistance: gap.bridge });
    edges = coalesced.edges; stats.netsCoalesced = coalesced.groupsChanged;
    const merged = mergeLocalFlags(nodes, edges, added, nets, blocks);
    nodes = merged.nodes; edges = merged.edges; stats.flagsRemoved = merged.removed.size;
    const lowered = lowerGroundFlags(nodes, edges, added, nets);
    nodes = lowered.nodes; edges = lowered.edges; stats.flagsLowered = lowered.lowered;
    const compacted = compactEmptyBands(nodes, edges);
    nodes = compacted.nodes; edges = compacted.edges; stats.emptySpaceRemoved = compacted.removed;
    const packed = packDrawingIslands(nodes, edges, nets, blocks, originalIds);
    nodes = packed.nodes; edges = packed.edges; stats.islandsPacked = packed.moved;
    const aligned = alignLeafFlags(nodes, edges, added, nets);
    nodes = aligned.nodes; edges = aligned.edges; stats.flagsAligned = aligned.aligned;
    for (const n of aligned.rotated) rotations.set(n.id, { rotate: n.rotation!, center: n.center! });
    // Packing and final flag alignment can create new adjacent stems. Finish
    // with the same net-aware cleanup so those moves do not leave twin rails.
    const finalRoutes = coalesceNetRoutes(edges, nets, nodes, [...pinPositions(nodes).values()], { maxBridgeDistance: gap.bridge });
    edges = finalRoutes.edges; stats.netsCoalesced += finalRoutes.groupsChanged;
    const finalFlags = mergeLocalFlags(nodes, edges, added, nets, blocks);
    nodes = finalFlags.nodes; edges = finalFlags.edges;
    for (const id of finalFlags.removed) merged.removed.add(id);
    stats.flagsRemoved = merged.removed.size;
    stats.componentsRotated = [...rotations.keys()].filter(id => {
        const before = input.children!.find(n => n.id === id), after = nodes.find(n => n.id === id);
        if (!before || !after) return false;
        return Math.abs(before.width! - after.width) > EPS || Math.abs(before.height! - after.height) > EPS
            || before.ports!.some(p => { const q = after.ports!.find(q => q.id === p.id)!; return Math.abs(p.x! - q.x!) > EPS || Math.abs(p.y! - q.y!) > EPS; });
    }).length;
    stats.elapsedMs = performance.now() - started;
    // The canvas origin is not a placement obstacle. Allow a local group to
    // use free space left/above the current drawing, then translate the whole
    // scene once. Relative pin/wire geometry is unchanged by this translation.
    const minX = Math.min(...nodes.map(n => n.x), ...edges.flatMap(e => path(e).map(p => p.x)));
    const minY = Math.min(...nodes.map(n => n.y), ...edges.flatMap(e => path(e).map(p => p.y)));
    const originalMinX = Math.min(...(input.children ?? []).map(n => n.x!), ...(input.edges ?? []).flatMap(e => path(e).map(p => p.x)));
    const originalMinY = Math.min(...(input.children ?? []).map(n => n.y!), ...(input.edges ?? []).flatMap(e => path(e).map(p => p.y)));
    // Remove blank margins left behind when the formerly topmost group moves
    // down. Preserve the original margin rather than preserving empty canvas.
    if (nodes.length && (minX < 0 || minY < 0 || minX > originalMinX || minY > originalMinY)) {
        const d = { x: minX < 0 ? gap.component - minX : Math.min(0, originalMinX - minX),
            y: minY < 0 ? gap.component - minY : Math.min(0, originalMinY - minY) };
        stats.sceneTranslation = d;
        nodes = nodes.map(n => ({ ...n, x: n.x + d.x, y: n.y + d.y }));
        edges = edges.map(e => withPath(e, path(e).map(p => shift(p, d))));
    }
    const bounds = nodes.length ? boundsOf(nodes) : { x: 0, y: 0, width: 0, height: 0 };
    scene.children = nodes; scene.edges = edges;
    scene.width = Math.max(bounds.x + bounds.width, ...edges.flatMap(e => path(e).map(p => p.x)), 0) + gap.component;
    scene.height = Math.max(bounds.y + bounds.height, ...edges.flatMap(e => path(e).map(p => p.y)), 0) + gap.component;
    return { scene, rotations, addedSymbols: newSymbols.filter(c => !merged.removed.has(c.designator)), removedSymbolIds: merged.removed, stats };
}
