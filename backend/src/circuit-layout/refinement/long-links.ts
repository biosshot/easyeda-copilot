import type { ElkExtendedEdge } from 'elkjs';
import type { CircuitComponent } from '#types/circuit.ts';
import { shortSymbolsMap, stableShortSymbolId } from '../short-symbol.ts';
import { type Placed, pinPositions, path, edgeSegments, routeLength, expand, overlaps, segmentThroughBox, EPS } from './geometry.ts';
import { straightRuns, segmentLength, connectedNetEdges } from './net-routes.ts';
import { RouteEnvironment, reconnect, localCrossings } from './router.ts';
import { SCHEMATIC_CLEARANCE as gap, LOCAL_SUPPLY_POLICY } from './policy.ts';
import { translations } from './groups.ts';

export const LONG_LINK_POLICY = Object.freeze({ fraction: 0.2, minimumLength: 480, medianFactor: 3, maximumLinks: 4 });

/** Replace outlier links by explicit labels, retaining every other complete
 * terminal-to-terminal route. Shared portions therefore keep all their taps.
 * Local IC attachments are kept wired so a port cannot hide poor placement. */
export function labelLongLinks(nodes: Placed[], edges: ElkExtendedEdge[], nets: Map<string, string>, blocks: Map<string, string>, originalIds: ReadonlySet<string>, maximumLinks: number = LONG_LINK_POLICY.maximumLinks,
    patternByMember: ReadonlyMap<string, string> = new Map()) {
    const added: CircuitComponent[] = [];
    const byNet = new Map<string, ElkExtendedEdge[]>();
    for (const e of edges) { const list = byNet.get(nets.get(e.sources[0])!) ?? []; list.push(e); byNet.set(nets.get(e.sources[0])!, list); }
    const total = [...byNet.values()].reduce((n, list) => n + straightRuns(list.flatMap(edgeSegments)).reduce((sum, s) => sum + segmentLength(s), 0), 0);
    const initial = [...edges].sort((a, b) => routeLength(path(b)) - routeLength(path(a)) || a.id.localeCompare(b.id));
    const lengths = initial.map(e => routeLength(path(e))).sort((a, b) => a - b);
    const typical = lengths[Math.floor(lengths.length / 2)] ?? 0;
    let links = 0;
    for (const edge of initial) {
        if (links >= maximumLinks) break;
        const p = path(edge), length = routeLength(p), net = nets.get(edge.sources[0]);
        if (!net || net.startsWith('unconnected:') || length < LONG_LINK_POLICY.minimumLength
            || (length < total * LONG_LINK_POLICY.fraction && length < typical * LONG_LINK_POLICY.medianFactor)) continue;
        const owners = [edge.sources[0], edge.targets[0]].map(id => nodes.find(n => n.ports?.some(p => p.id === id)));
        if (owners.some(n => !n || !originalIds.has(n.id)) || blocks.get(owners[0]!.id) !== blocks.get(owners[1]!.id)) continue;
        // Internal pattern rails remain wired, however wide the bank becomes.
        // Only a connection across a pattern boundary may become a net port.
        const pattern = patternByMember.get(owners[0]!.id);
        if (pattern && pattern === patternByMember.get(owners[1]!.id)) continue;
        const members = nodes.filter(n => originalIds.has(n.id) && blocks.get(n.id) === blocks.get(owners[0]!.id));
        if (members.length < LOCAL_SUPPLY_POLICY.minimumComponents
            && members.every(n => (n.ports?.length ?? 0) < LOCAL_SUPPLY_POLICY.minimumPins)) continue;
        if (segmentLength({ a: p[0], b: p.at(-1)! }) < LONG_LINK_POLICY.minimumLength / 2) continue;
        const retained = edges.filter(e => e !== edge), sameNet = retained.filter(e => nets.get(e.sources[0]) === net);
        // A lone IC's feedback/series network needs better placement, not labels.
        // Follow both sides of a series part: a USB resistor between a connector
        // and an MCU is an inter-group bridge, despite having two net names.
        const attachmentNets = new Set([net, ...owners.filter(n => n!.ports?.length === 2)
            .flatMap(n => n!.ports!.map(p => nets.get(p.id)!))].filter(n => n && !shortSymbolsMap.GND.is(n)));
        if (owners.some(n => n!.ports?.length === 2) && !shortSymbolsMap.GND.is(net) && !shortSymbolsMap.VCC.is(net)
            && members.filter(n => (n.ports?.length ?? 0) > 2 && n.ports?.some(p => attachmentNets.has(nets.get(p.id)!))).length < 2) continue;
        // Cut only this bridge, preserving the other branches of the named net.
        // A small part must retain a wired attachment to another real component;
        // otherwise a fuse/diode would become an isolated part between two flags.
        const realOwner = new Map(nodes.filter(n => originalIds.has(n.id)).flatMap(n => (n.ports ?? []).map(p => [p.id, n.id])));
        if (owners.some(n => n!.ports?.length === 2 && !retained.some(e => {
            const ids = [...e.sources, ...e.targets].map(p => realOwner.get(p));
            return ids.includes(n!.id) && ids.some(id => id && id !== n!.id);
        }))) continue;
        // Cutting a redundant logical edge would leave the same long connection
        // in place and add useless flags. Only split a bridge between terminals.
        if (connectedNetEdges(sameNet, nets).some(group => [edge.sources[0], edge.targets[0]].every(id =>
            group.some(e => [...e.sources, ...e.targets].includes(id))))) continue;
        const pendingNodes: Placed[] = [], pendingComponents: CircuitComponent[] = [], pendingEdges: ElkExtendedEdge[] = [];
        const trialNets = new Map(nets);
        const retainedGroups = connectedNetEdges(sameNet, nets);
        let labeledEnds = 0;
        for (const [ordinal, pinId] of [edge.sources[0], edge.targets[0]].entries()) {
            const owner = owners[ordinal]!, block = blocks.get(owner.id)!;
            // A retained local port already names this side of the cut. Reuse
            // it instead of trying to fit a duplicate into the same pin fan-out.
            const local = retainedGroups.find(g => g.some(e => [...e.sources, ...e.targets].includes(pinId)));
            if (local?.some(e => [...e.sources, ...e.targets].some(p => nodes.some(n => !originalIds.has(n.id)
                && n.ports?.length === 1 && n.ports[0].id === p && blocks.get(n.id) === block)))) {
                labeledEnds++; continue;
            }
            const kind = shortSymbolsMap.GND.is(net) ? shortSymbolsMap.GND : shortSymbolsMap.VCC.is(net) ? shortSymbolsMap.VCC : shortSymbolsMap.NETPORT;
            const id = stableShortSymbolId(kind.name, net, `${block}:${edge.id}:long`, ordinal);
            if (nodes.some(n => n.id === id)) break;
            const created = kind.create(net, block, id), flagId = `${id}_pin_1`;
            trialNets.set(flagId, net);
            const env = new RouteEnvironment([...nodes, ...pendingNodes], retained, trialNets);
            let best: { node: Placed; edge: ElkExtendedEdge; length: number } | undefined;
            const origin = { ...created.node, x: 0, y: 0 } as Placed;
            const terminals = [...new Set([pinId, ...(local ?? []).flatMap(e => [...e.sources, ...e.targets])
                .filter(p => realOwner.has(p))])].slice(0, 4);
            const positions = pinPositions(nodes);
            const sites = terminals.map(terminal => {
                const lead: ElkExtendedEdge = { id: `${edge.id}:label:${ordinal}`, container: edge.container, sources: [terminal], targets: [flagId],
                    sections: [{ id: `${edge.id}:label:${ordinal}:s`, startPoint: positions.get(terminal)!, endPoint: pinPositions([origin]).get(flagId)! }] };
                return { lead, shifts: translations({ nodes: [origin] }, [lead], env.nodes, sameNet, trialNets).slice(1) };
            });
            // The local bus may have space near another terminal, even when
            // the connector pin itself is crowded. Share the same bounded search.
            const candidates = Array.from({ length: Math.max(...sites.map(s => s.shifts.length)) }, (_, i) =>
                sites.filter(s => s.shifts[i]).map(s => ({ lead: s.lead, d: s.shifts[i] }))).flat().slice(0, 96);
            for (const { lead, d } of candidates) {
                const node = { ...origin, x: d.x, y: d.y };
                if (env.nodes.some(n => overlaps(node, n, gap.port))
                    || [...retained, ...pendingEdges].some(e => edgeSegments(e).some(s => segmentThroughBox(s, expand(node, gap.wire))))) continue;
                const route = reconnect(lead, [node], env, pendingEdges);
                if (!route) continue;
                const value = routeLength(path(route)) + (path(route).length - 2) * gap.pinEscape;
                if (!best || value < best.length - EPS) best = { node, edge: route, length: value };
            }
            if (!best) break;
            pendingNodes.push(best.node); pendingComponents.push(created.component); pendingEdges.push(best.edge); labeledEnds++;
        }
        if (labeledEnds !== 2) continue;
        const env = new RouteEnvironment(nodes, retained, trialNets), prior = localCrossings([edge, ...sameNet], env);
        if ([...localCrossings([...pendingEdges, ...sameNet], env)].some(([pair, count]) => count > (prior.get(pair) ?? 0))) continue;
        for (const c of pendingComponents) { nets.set(`${c.designator}_pin_1`, net); blocks.set(c.designator, c.block_name); }
        nodes = [...nodes, ...pendingNodes]; edges = [...retained, ...pendingEdges]; added.push(...pendingComponents); links++;
    }
    return { nodes, edges, added, links };
}
