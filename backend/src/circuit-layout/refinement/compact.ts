import type { ElkExtendedEdge } from 'elkjs';
import { type Placed, path, withPath } from './geometry.ts';
import { SCHEMATIC_CLEARANCE as gap } from './policy.ts';

/** Compress only empty coordinate bands. A strictly increasing coordinate
 * map preserves incidence, orthogonality and crossing order. Body intervals
 * are rigid; padded wire vertices reserve routing lanes and terminal escapes. */
export function compactEmptyBands(nodes: Placed[], edges: ElkExtendedEdge[]) {
    let removed = 0;
    for (const axis of ['x', 'y'] as const) {
        const size = axis === 'x' ? 'width' : 'height';
        const intervals = nodes.map(n => [n[axis] - gap.largeIC / 2, n[axis] + n[size] + gap.largeIC / 2]);
        for (const e of edges) for (const p of path(e)) intervals.push([p[axis] - gap.pinEscape, p[axis] + gap.pinEscape]);
        const occupied: number[][] = [];
        for (const interval of intervals.sort((a, b) => a[0] - b[0])) {
            const last = occupied.at(-1);
            if (last && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1]);
            else occupied.push([...interval]);
        }
        const bands = occupied.slice(1).map((p, i) => ({ start: occupied[i][1], end: p[0] }))
            .filter(b => b.end - b.start > gap.wire);
        const map = (value: number) => value - bands.reduce((sum, b) => sum
            + Math.max(0, Math.min(1, (value - b.start) / (b.end - b.start))) * (b.end - b.start - gap.wire), 0);
        nodes = nodes.map(n => ({ ...n, [axis]: map(n[axis]) }));
        edges = edges.map(e => withPath(e, path(e).map(p => ({ ...p, [axis]: map(p[axis]) }))));
        removed += bands.reduce((sum, b) => sum + b.end - b.start - gap.wire, 0);
    }
    return { nodes, edges, removed };
}
