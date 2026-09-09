import type { ElkExtendedEdge } from 'elkjs';
import { type Placed, type Point, type Box, boundsOf, path, shift, withPath } from './geometry.ts';
import { connectedNetEdges } from './net-routes.ts';
import { SCHEMATIC_CLEARANCE as gap } from './policy.ts';
import { compactEmptyBands } from './compact.ts';
import { packSchematicRectangles, SCHEMATIC_SHEET, type PackingNet, type PackingLayout } from '#utils/schematic-packing.ts';
import { shortSymbolsMap } from '../short-symbol.ts';

type Item = Box & { id: string; ids: Set<string> };

function islandNets(items: Item[], nodes: Placed[], nets: ReadonlyMap<string, string>, originals: ReadonlySet<string>) {
    const byNode = new Map(items.flatMap(i => [...i.ids].map(id => [id, i] as const)));
    const byNet = new Map<string, Map<string, PackingNet['terminals'][number]>>();
    for (const n of nodes) {
        if (!originals.has(n.id)) continue;
        const item = byNode.get(n.id)!;
        for (const p of n.ports ?? []) {
            const net = nets.get(p.id);
            if (!net || net.startsWith('unconnected:') || shortSymbolsMap.GND.is(net)) continue;
            const terminals = byNet.get(net) ?? new Map<string, PackingNet['terminals'][number]>();
            const terminal = terminals.get(item.id) ?? { id: item.id, points: [], anchor: false };
            terminal.points.push({ x: n.x + p.x! - item.x, y: n.y + p.y! - item.y });
            terminal.anchor ||= /^U/i.test(n.id) || (n.ports?.length ?? 0) > 2;
            terminals.set(item.id, terminal); byNet.set(net, terminals);
        }
    }
    return [...byNet].filter(([, ts]) => ts.size > 1).map(([net, ts]) => ({
        weight: shortSymbolsMap.VCC.is(net) ? 0.5 : 1,
        terminals: [...ts.values()].map(t => {
            // A passive bank is represented by its shared port. Targets on an
            // IC retain their actual pin coordinates, not the block's center.
            const flags = nodes.filter(n => !originals.has(n.id) && byNode.get(n.id)?.id === t.id && n.ports?.length === 1 && nets.get(n.ports[0].id) === net);
            const item = items.find(i => i.id === t.id)!;
            return { ...t, points: !t.anchor && flags.length ? flags.map(n => ({ x: n.x + n.ports![0].x! - item.x, y: n.y + n.ports![0].y! - item.y })) : t.points };
        }),
    }));
}

/** Repack disconnected DRAWING islands, not electrical nets: named ports may
 * deliberately connect different islands. Same-net physical taps are joined
 * before moving anything; each resulting region and all its routes stay rigid. */
export function packDrawingIslands(nodes: Placed[], edges: ElkExtendedEdge[], nets: ReadonlyMap<string, string>, blocks: ReadonlyMap<string, string>,
    originals: ReadonlySet<string> = new Set(nodes.map(n => n.id))) {
    if (!nodes.length) return { nodes, edges, moved: 0 };
    const owner = new Map(nodes.flatMap(n => (n.ports ?? []).map(p => [p.id, n.id]))), parent = new Map(nodes.map(n => [n.id, n.id]));
    const find = (id: string): string => { const p = parent.get(id)!; if (p === id) return id; const root = find(p); parent.set(id, root); return root; };
    const join = (a: string, b: string) => { const root = find(a), other = find(b); if (root !== other) parent.set(other, root); };
    for (const group of connectedNetEdges(edges, nets)) {
        const ids = [...new Set(group.flatMap(e => [...e.sources, ...e.targets]).map(p => owner.get(p)).filter((id): id is string => !!id))];
        for (const id of ids.slice(1)) join(ids[0], id);
    }
    const members = new Map<string, Placed[]>();
    for (const n of nodes) { const id = find(n.id), list = members.get(id) ?? []; list.push(n); members.set(id, list); }
    if (members.size <= 1) return { nodes, edges, moved: 0 };
    // Validate all scopes before changing any island geometry.
    for (const ns of members.values()) {
        const scopes = new Set(ns.map(n => blocks.get(n.id)));
        if (scopes.size !== 1 || scopes.has(undefined)) return { nodes, edges, moved: 0 };
    }
    const perBlock = new Map<string, Item[]>();
    for (const ns of members.values()) {
        const id = ns.map(n => n.id).sort()[0];
        const scopes = new Set(ns.map(n => blocks.get(n.id)));
        const ids = new Set(ns.map(n => n.id)), localEdges = edges.filter(e => ids.has(owner.get(e.sources[0])!));
        // Other disconnected regions must not occupy a band's projection and
        // prevent this island from closing its own empty space.
        const compacted = compactEmptyBands(ns, localEdges);
        const replacements = new Map(compacted.nodes.map(n => [n.id, n])), routes = new Map(compacted.edges.map(e => [e.id, e]));
        nodes = nodes.map(n => replacements.get(n.id) ?? n); edges = edges.map(e => routes.get(e.id) ?? e);
        const box = boundsOf([...compacted.nodes, ...compacted.edges.flatMap(path).map(p => ({ ...p, width: 0, height: 0 }))]);
        const block = [...scopes][0]!, list = perBlock.get(block) ?? [];
        list.push({ ...box, id, ids }); perBlock.set(block, list);
    }
    const affinities = islandNets([...perBlock.values()].flat(), nodes, nets, originals);
    const choices = new Map<string, PackingLayout[]>(), selected = new Map<string, PackingLayout>();
    const islandBlock = new Map<string, string>();
    for (const [block, islands] of perBlock) {
        const ids = new Set(islands.map(i => i.id));
        const localNets = affinities.map(n => ({ ...n, terminals: n.terminals.filter(t => ids.has(t.id)) })).filter(n => n.terminals.length > 1);
        const layout = packSchematicRectangles(islands, gap.largeIC, localNets);
        choices.set(block, layout.alternatives); selected.set(block, layout);
        for (const i of islands) islandBlock.set(i.id, block);
    }
    const arrangeBlocks = () => {
        const blockNets = affinities.map(n => {
            const terminals = new Map<string, PackingNet['terminals'][number]>();
            for (const t of n.terminals) {
                const id = islandBlock.get(t.id)!;
                const next = terminals.get(id) ?? { id, points: [], anchor: false };
                next.points.push(...t.points.map(p => shift(p, selected.get(id)!.positions.get(t.id)!))); next.anchor ||= t.anchor;
                terminals.set(id, next);
            }
            return { ...n, terminals: [...terminals.values()] };
        }).filter(n => n.terminals.length > 1);
        // Reserve both blocks' frame padding plus a visible gap between frames;
        // keep islands within a block compact.
        const packed = packSchematicRectangles([...selected].map(([id, layout]) => ({ id, width: layout.width, height: layout.height })),
            Math.max(gap.largeIC, SCHEMATIC_SHEET.blockPadding * 2) + SCHEMATIC_SHEET.extraBlockGap, blockNets);
        return { ...packed, score: packed.score + [...selected.values()].reduce((sum, l) => sum + l.affinity * Math.sqrt(l.width * l.height) * 0.1, 0) };
    };
    let packed = arrangeBlocks(), trials = 0;
    // The whole page is landscape; individual blocks may be tall or wide.
    // Try alternate child shapes against the actual parent footprint, with a
    // fixed budget instead of an exponential combination search.
    for (const block of [...selected.keys()].sort((a, b) => selected.get(b)!.width * selected.get(b)!.height - selected.get(a)!.width * selected.get(a)!.height || a.localeCompare(b))) {
        let best = selected.get(block)!;
        for (const candidate of choices.get(block)!) {
            if (candidate === best || trials >= 24) continue;
            selected.set(block, candidate); trials++;
            const trial = arrangeBlocks();
            if (trial.score < packed.score - 1e-6) { best = candidate; packed = trial; }
        }
        selected.set(block, best);
    }
    const deltas = new Map<string, Point>();
    for (const [block, islands] of perBlock) for (const island of islands) {
        const at = shift(selected.get(block)!.positions.get(island.id)!, packed.positions.get(block)!);
        for (const id of island.ids) deltas.set(id, { x: at.x - island.x, y: at.y - island.y });
    }
    const origin = boundsOf(nodes);
    for (const [id, d] of deltas) deltas.set(id, shift(d, { x: origin.x, y: origin.y }));
    const next = nodes.map(n => ({ ...n, ...shift(n, deltas.get(n.id)!) }));
    const routed = edges.map(e => withPath(e, path(e).map(p => shift(p, deltas.get(owner.get(e.sources[0])!)!))));
    return { nodes: next, edges: routed, moved: members.size > 1 ? members.size : 0 };
}
