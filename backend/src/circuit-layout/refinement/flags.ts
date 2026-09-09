import type { ElkExtendedEdge } from 'elkjs';
import type { CircuitComponent } from '#types/circuit.ts';
import { coalesceNetRoutes, connectedNetEdges } from './net-routes.ts';
import { type Placed, pinPositions, edgeSegments, EPS } from './geometry.ts';
import { SCHEMATIC_CLEARANCE as gap } from './policy.ts';

/** Collapse identical generated flags on one physical bus at any distance,
 * or on nearby stems that can safely share a tree. Original parts survive. */
export function mergeLocalFlags(nodes: Placed[], edges: ElkExtendedEdge[], added: readonly CircuitComponent[],
    nets: ReadonlyMap<string, string>, blocks: ReadonlyMap<string, string>) {
    const removed = new Set<string>();
    const positions = pinPositions(nodes);
    const flags = [...added].sort((a, b) => {
        const ap = positions.get(`${a.designator}_pin_1`), bp = positions.get(`${b.designator}_pin_1`);
        // Retain the lower ground marker when two markers share a bus.
        return (a.part_uuid === 'GND' && b.part_uuid === 'GND' ? (bp?.y ?? 0) - (ap?.y ?? 0) : 0)
            || a.designator.localeCompare(b.designator);
    });
    let attempts = 0;
    for (let i = 0; i < flags.length; i++) for (const b of flags.slice(i + 1)) {
        const a = flags[i];
        if (removed.has(a.designator) || removed.has(b.designator) || a.part_uuid !== b.part_uuid
            || a.pins.length !== 1 || b.pins.length !== 1 || a.pins[0].signal_name !== b.pins[0].signal_name
            || blocks.get(a.designator) !== blocks.get(b.designator)) continue;
        const aId = `${a.designator}_pin_${a.pins[0].pin_number}`, bId = `${b.designator}_pin_${b.pins[0].pin_number}`;
        const pins = pinPositions(nodes), ap = pins.get(aId), bp = pins.get(bId);
        if (!ap || !bp) continue;
        const buses = connectedNetEdges(edges.filter(e => nets.get(e.sources[0]) === nets.get(aId)), nets);
        const bus = (id: string) => buses.find(group => group.some(e => [...e.sources, ...e.targets].includes(id)));
        const aBus = bus(aId), bBus = bus(bId), sameBus = aBus === bBus;
        // Flag positions can be far apart while their return rails run side by
        // side. Use the rails' overlap to discover that merge opportunity.
        const adjacent = aBus?.flatMap(edgeSegments).some(a => bBus?.flatMap(edgeSegments).some(b => {
            const vertical = Math.abs(a.a.x - a.b.x) < EPS;
            if (vertical !== (Math.abs(b.a.x - b.b.x) < EPS)) return false;
            const across = vertical ? 'x' : 'y', along = vertical ? 'y' : 'x';
            return Math.abs(a.a[across] - b.a[across]) <= gap.bridge
                && Math.min(Math.max(a.a[along], a.b[along]), Math.max(b.a[along], b.b[along]))
                - Math.max(Math.min(a.a[along], a.b[along]), Math.min(b.a[along], b.b[along])) >= gap.branch;
        }));
        if (!sameBus && !adjacent && Math.abs(ap.x - bp.x) + Math.abs(ap.y - bp.y) > gap.branch * 4) continue;
        if (++attempts > 24) break;
        const remaining = nodes.filter(n => n.id !== b.designator);
        const result = coalesceNetRoutes(edges, nets, remaining, [...pinPositions(remaining).values()], {
            maxBridgeDistance: sameBus ? gap.branch * 2 : gap.branch * 4, flagRemovalAllowance: gap.branch * 2,
            terminalAliases: new Map([[bId, { id: aId, point: ap }]]) });
        if (!result.groupsChanged || result.edges.some(e => [...e.sources, ...e.targets].includes(bId))) continue;
        nodes = remaining; edges = result.edges.filter(e => e.sources[0] !== e.targets[0]); removed.add(b.designator);
    }
    return { nodes, edges, removed };
}
