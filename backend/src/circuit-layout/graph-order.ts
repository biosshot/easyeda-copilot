import type { ElkNode, ElkExtendedEdge } from 'elkjs';
import type { CircuitComponent } from '#types/circuit.ts';
import type { SymbolWithMeta } from '#types/symbol.ts';
import type { LayoutRecommendation } from '#types/auto-place.ts';
import { chooseRotation, shortSymbolKindForSignal } from './patterns/helpers.ts';
import { isGroundSignal } from './ground.ts';
import { LOCAL_SUPPLY_POLICY } from './refinement/policy.ts';
import { hasConnection } from './signals.ts';
import type { MacroInstance } from './patterns/types.ts';

/** A supply capacitor bank can be a separate drawing even when its regulator's
 * inductor must stay wired to the IC. Localize the whole bank, never its members. */
export function localCapacitorBankBlocks(macros: readonly MacroInstance[], components: readonly CircuitComponent[], symbols: readonly SymbolWithMeta[]) {
    const byId = new Map(components.map(c => [c.designator, c]));
    const pins = new Map(symbols.map(s => [s.designator, s.symbol.pins.length]));
    const supplies = namedSupplyNets(components, symbols);
    return new Set(macros.filter(m => {
        if (m.patternId !== 'parallel-two-pin' || !m.layoutChildBlock) return false;
        const bank = m.absorbedDesignators.map(id => byId.get(id)!);
        if (!bank.every(c => /^C\d/i.test(c.designator) && c.pins.length === 2)
            || !bank[0].pins.some(p => isGroundSignal(p.signal_name))
            || !bank[0].pins.some(p => shortSymbolKindForSignal(p.signal_name) === 'VCC' || supplies.has(p.signal_name))) return false;
        const block = components.filter(c => c.block_name === m.blockName);
        return block.length >= LOCAL_SUPPLY_POLICY.minimumComponents
            || block.some(c => (pins.get(c.designator) ?? c.pins.length) >= LOCAL_SUPPLY_POLICY.minimumPins);
    }).map(m => m.layoutChildBlock!.name));
}

/** Keep small supply circuits connected. Even in a large block, don't cut the
 * supply path on either side of a fuse, diode or inductor into isolated flags. */
export function sharedSupplyNets(components: readonly CircuitComponent[], symbols: readonly SymbolWithMeta[]) {
    const pins = new Map(symbols.map(s => [s.designator, s.symbol.pins.length]));
    const explicit = namedSupplyNets(components, symbols);
    return new Map([...new Set(components.map(c => c.block_name))].map(block => {
        const members = components.filter(c => c.block_name === block);
        const compact = members.length < LOCAL_SUPPLY_POLICY.minimumComponents
            && members.every(c => (pins.get(c.designator) ?? c.pins.length) < LOCAL_SUPPLY_POLICY.minimumPins);
        const series = members.filter(c => /^(?:D|F|L|FB)\d/i.test(c.designator) && c.pins.length === 2
            && c.pins.every(p => hasConnection(p.signal_name))
            && c.pins[0].signal_name !== c.pins[1].signal_name);
        const shared = new Set((compact ? members : series).flatMap(c => c.pins.filter(p =>
            hasConnection(p.signal_name) && !isGroundSignal(p.signal_name)
            && (shortSymbolKindForSignal(p.signal_name) === 'VCC' || explicit.has(p.signal_name))).map(p => p.signal_name)));
        return [block, shared] as const;
    }));
}

/** Give a free series part the axis of its sole IC attachment before ELK adds
 * layers and return loops. Ambiguous parts with ICs on both nets stay free. */
export function seriesOrientations(components: readonly CircuitComponent[], symbols: readonly SymbolWithMeta[], excluded: ReadonlySet<string>) {
    const result: LayoutRecommendation[] = [];
    const byId = new Map(symbols.map(s => [s.designator, s]));
    for (const c of components) {
        const symbol = byId.get(c.designator);
        if (excluded.has(c.designator) || /^U/i.test(c.designator) || c.pins.length !== 2 || symbol?.symbol.pins.length !== 2
            || c.pins.some(p => isGroundSignal(p.signal_name))) continue;
        const attachments = c.pins.flatMap(p => {
            if (!p.signal_name || /^NC$/i.test(p.signal_name) || shortSymbolKindForSignal(p.signal_name)) return [];
            return components.filter(b => b.designator !== c.designator && (/^U/i.test(b.designator) || (byId.get(b.designator)?.symbol.pins.length ?? 0) > 4))
                .flatMap(b => b.pins.filter(q => q.signal_name === p.signal_name).map(q => ({ own: p, other: q, symbol: byId.get(b.designator)?.symbol })));
        });
        if (attachments.length !== 1) continue;
        const { own, other, symbol: anchor } = attachments[0], pin = anchor?.pins.find(p => String(p.num) === String(other.pin_number));
        if (!anchor || !pin) continue;
        const sides = [['EAST', pin.x], ['WEST', anchor.width - pin.x], ['SOUTH', pin.y], ['NORTH', anchor.height - pin.y]] as const;
        const opposed = [...sides].sort((a, b) => a[1] - b[1])[0][0];
        const geometry = chooseRotation(symbol.symbol, new Map([[String(own.pin_number), opposed]]));
        result.push({ type: 'rotate', designator: c.designator, rotate: geometry.rotation });
    }
    return result;
}

type Endpoint = { nodeId: string; portId: string; blockName: string };
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Explicit IC supply-pin names supplement the net-name classifier (e.g. SYS
 * on VIN). This only authorizes named drawing ports; it does not alias nets or
 * infer current direction from arbitrary user signal names. */
export function namedSupplyNets(components: readonly CircuitComponent[], symbols: readonly SymbolWithMeta[]) {
    const counts = new Map(symbols.map(s => [s.designator, s.symbol.pins.length]));
    return new Set(components.filter(c => /^U/i.test(c.designator) || (counts.get(c.designator) ?? 0) > 4)
        .flatMap(c => c.pins.filter(p => /^(?:VIN|VCC|VDD|VBAT|VSS|VEE)\d*$/i.test(p.name.trim())
            && p.signal_name && !/^NC$/i.test(p.signal_name)).map(p => p.signal_name)));
}

/** The direction of a drawing edge follows the fixed terminal geometry. It is
 * not a claim about electrical current or about a bidirectional signal. */
export function terminalAwareEdges(root: ElkNode, signals: Readonly<Record<string, readonly Endpoint[]>>) {
    const terminals = new Map<string, { node: ElkNode; outward: boolean }>();
    const visit = (node: ElkNode, direction = 'RIGHT') => {
        direction = node.layoutOptions?.['org.eclipse.elk.direction'] ?? direction;
        for (const p of node.ports ?? []) {
            const side = [ ['LEFT', p.x ?? 0], ['RIGHT', (node.width ?? 0) - (p.x ?? 0)],
                ['UP', p.y ?? 0], ['DOWN', (node.height ?? 0) - (p.y ?? 0)] ] as const;
            terminals.set(p.id, { node, outward: [...side].sort((a, b) => a[1] - b[1])[0][0] === direction });
        }
        for (const child of node.children ?? []) visit(child, direction);
    };
    visit(root);
    const edges: ElkExtendedEdge[] = [];
    for (const signal of Object.keys(signals).sort(compare)) {
        if (!signal || /^NC$/i.test(signal)) continue;
        const unique = [...new Map(signals[signal].map(e => [e.portId, e])).values()];
        const groups = signal.startsWith('ext_') ? [unique] : [...new Set(unique.map(e => e.blockName))].sort(compare)
            .map(block => unique.filter(e => e.blockName === block));
        for (const group of groups) {
            // Resolve by port ownership: synthetic boundary endpoints need not
            // carry the actual owning node id in the signal map.
            const sorted = group.toSorted((a, b) => (terminals.get(b.portId)?.node.ports?.length ?? 0)
                - (terminals.get(a.portId)?.node.ports?.length ?? 0) || compare(a.portId, b.portId));
            const anchor = sorted[0];
            for (const endpoint of sorted.slice(1)) {
                const source = terminals.get(anchor.portId)?.outward ? anchor : endpoint;
                const target = source === anchor ? endpoint : anchor;
                edges.push({ id: `edge_${signal}_${edges.length}`, sources: [source.portId], targets: [target.portId],
                    ...(group.length <= 4 ? { layoutOptions: {
                        'org.eclipse.elk.layered.priority.shortness': '4',
                        'org.eclipse.elk.layered.priority.straightness': '4',
                    } } : {}) });
            }
        }
    }
    return edges;
}

export function canonicalGraph(node: ElkNode) {
    node.children?.sort((a, b) => compare(a.id, b.id));
    node.ports?.sort((a, b) => (a.x ?? 0) - (b.x ?? 0) || (a.y ?? 0) - (b.y ?? 0) || compare(a.id, b.id));
    for (const child of node.children ?? []) canonicalGraph(child);
}

/** A drawing direction or permitted passive rotation can change between
 * candidates; original terminal identities and undirected links cannot. */
export function terminalTopologySignature(root: ElkNode) {
    const nodes: string[] = [], edges: string[] = [];
    const visit = (n: ElkNode) => {
        nodes.push(JSON.stringify([n.id, (n.ports ?? []).map(p => p.id).sort(compare)]));
        for (const e of n.edges ?? []) edges.push(JSON.stringify([...e.sources, ...e.targets].sort(compare)));
        for (const c of n.children ?? []) visit(c);
    };
    visit(root);
    return JSON.stringify([nodes.sort(compare), edges.sort(compare)]);
}
