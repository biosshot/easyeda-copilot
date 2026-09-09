import type { ElkExtendedEdge } from 'elkjs';
import type { CircuitComponent } from '#types/circuit.ts';

/** ELK parallel containers are layout groups, not electrical namespaces.
 * Resolve their generated flags through actual terminal references. */
export function resolveSceneBlocks(components: readonly CircuitComponent[], added: readonly CircuitComponent[], edges: readonly ElkExtendedEdge[]) {
    const known = new Set(components.map(c => c.block_name));
    const result = new Map(components.map(c => [c.designator, c.block_name]));
    const owner = new Map<string, string>([...components, ...added].flatMap(c => c.pins.map(p => [`${c.designator}_pin_${p.pin_number}`, c.designator] as const)));
    for (const c of added) {
        if (known.has(c.block_name)) result.set(c.designator, c.block_name);
        else if (c.block_name.startsWith('block_') && known.has(c.block_name.slice(6))) result.set(c.designator, c.block_name.slice(6));
        else {
            const neighbours = edges.filter(e => [...e.sources, ...e.targets].some(id => owner.get(id) === c.designator))
                .flatMap(e => [...e.sources, ...e.targets].map(id => owner.get(id))).filter(id => id !== c.designator);
            const blocks = new Set(neighbours.map(id => components.find(c => c.designator === id)?.block_name));
            result.set(c.designator, blocks.size === 1 && !blocks.has(undefined) ? [...blocks][0]! : c.block_name);
        }
    }
    return result;
}
