import type { BlockNode } from '#types/auto-place.ts';
import type { MacroInstance } from './types.ts';
import { shortSymbolKindForSignal } from './helpers.ts';
import { shortSymbolsMap, stableShortSymbolId } from '../short-symbol.ts';

/** Preserved macro boundaries bypass ordinary supply-flag creation. Label their
 * routed supply rails even when the whole bank stays inline with its IC.
 * Ordinary pin names alone do not connect them to other labeled drawings. */
export function labelLocalizedPatternBoundaries(root: BlockNode, signalMap: Record<string, { nodeId: string; portId: string; blockName: string }[]>,
    macros: readonly MacroInstance[], namedSupplySignals: readonly string[] = []) {
    const boundary = new Set(macros.flatMap(m => m.ports.map(p => p.signalName)));
    const labeled = new Set([...namedSupplySignals, ...[...boundary].filter(net => shortSymbolKindForSignal(net)),
        ...macros.flatMap(m => m.placements.flatMap(p => p.generatedComponent?.pins.map(pin => pin.signal_name) ?? []))]);
    const blocks = new Map<string, BlockNode>();
    const visit = (n: BlockNode) => { if (n.children) blocks.set(n.id, n); n.children?.forEach(visit); };
    visit(root);
    for (const net of [...labeled].sort()) {
        if (!boundary.has(net)) continue;
        const endpoints = signalMap[net], kind = shortSymbolKindForSignal(net) ?? (namedSupplySignals.includes(net) ? 'NETPORT' : undefined);
        if (!endpoints?.length || !kind) continue;
        for (const blockName of new Set(endpoints.map(p => p.blockName))) {
            const block = blocks.get(blockName);
            if (!block || endpoints.some(p => p.blockName === blockName && p.nodeId === '__virt__')) continue;
            const flag = shortSymbolsMap[kind].create(net, blockName, stableShortSymbolId(`PATTERN_BOUNDARY_${kind}`, net, blockName));
            block.children!.push(flag.node);
            block.shortSymbols ??= {};
            (block.shortSymbols[kind] ??= []).push(flag);
            endpoints.push({ nodeId: flag.node.id, portId: flag.node.ports![0].id, blockName });
        }
    }
}
