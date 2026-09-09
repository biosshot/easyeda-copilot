import type { ElkExtendedEdge, ElkNode } from 'elkjs';
import { pointOnSegment, routeSegments, segmentLength, segmentThroughBox, simplifyRoute } from './net-routes.ts';

export type Point = { x: number; y: number };
export type Box = Point & { width: number; height: number };
export type Placed = ElkNode & Box & { rotation?: number; center?: Point };
export type Segment = { a: Point; b: Point };
export const EPS = 1e-5;
export const path = (e: ElkExtendedEdge) => e.sections?.length === 1
    ? [e.sections[0].startPoint, ...(e.sections[0].bendPoints ?? []), e.sections[0].endPoint] : [];
export const edgeSegments = (e: ElkExtendedEdge) => (e.sections ?? []).flatMap(s => routeSegments([s.startPoint, ...(s.bendPoints ?? []), s.endPoint]));
export const routeLength = (p: Point[]) => routeSegments(p).reduce((sum, s) => sum + segmentLength(s), 0);
export const shift = (p: Point, d: Point) => ({ x: p.x + d.x, y: p.y + d.y });
export const expand = (b: Box, gap: number): Box => ({ x: b.x - gap, y: b.y - gap, width: b.width + gap * 2, height: b.height + gap * 2 });
export const overlaps = (a: Box, b: Box, gap = 0) => Math.min(a.x + a.width + gap, b.x + b.width) > Math.max(a.x - gap, b.x) + EPS
    && Math.min(a.y + a.height + gap, b.y + b.height) > Math.max(a.y - gap, b.y) + EPS;
export const pinPositions = (nodes: readonly Placed[]) => new Map(nodes.flatMap(n => (n.ports ?? []).map(p =>
    [p.id, { x: n.x + p.x!, y: n.y + p.y! }] as const)));
export const withPath = (edge: ElkExtendedEdge, points: Point[]): ElkExtendedEdge => {
    const p = simplifyRoute(points);
    return { ...edge, junctionPoints: undefined, sections: [{ ...edge.sections![0],
        incomingShape: edge.sources[0], outgoingShape: edge.targets[0], startPoint: p[0], endPoint: p.at(-1)!, bendPoints: p.slice(1, -1) }] };
};
export function normal(node: Placed, id: string): Point {
    const p = node.ports!.find(p => p.id === id)!;
    return [ { d: p.x!, x: -1, y: 0 }, { d: node.width - p.x!, x: 1, y: 0 },
        { d: p.y!, x: 0, y: -1 }, { d: node.height - p.y!, x: 0, y: 1 } ].sort((a, b) => a.d - b.d)[0];
}
export function exitsAlong(p: Point[], n: Point, distance: number) {
    if (p.length < 2) return false;
    const dx = p[1].x - p[0].x, dy = p[1].y - p[0].y;
    return dx * n.x + dy * n.y >= distance - EPS && Math.abs(dx * n.y - dy * n.x) < EPS;
}
export const segmentBox = (s: Segment): Box => ({ x: Math.min(s.a.x, s.b.x), y: Math.min(s.a.y, s.b.y), width: Math.abs(s.a.x - s.b.x), height: Math.abs(s.a.y - s.b.y) });

/** Uniform spatial buckets avoid rescanning every scene object per candidate.
 * Long wires are stored once in a bounded overflow list. */
export class SpatialIndex<T> {
    private buckets = new Map<string, T[]>();
    private overflow: T[] = [];
    private bounds: (item: T) => Box;
    private cell: number;
    constructor(items: readonly T[], bounds: (item: T) => Box, cell = 128) {
        this.bounds = bounds; this.cell = cell;
        for (const item of items) {
            const keys = this.keys(bounds(item));
            if (!keys) { this.overflow.push(item); continue; }
            for (const key of keys) { const list = this.buckets.get(key) ?? []; list.push(item); this.buckets.set(key, list); }
        }
    }
    private keys(b: Box): string[] | null {
        const x0 = Math.floor(b.x / this.cell), x1 = Math.floor((b.x + b.width) / this.cell);
        const y0 = Math.floor(b.y / this.cell), y1 = Math.floor((b.y + b.height) / this.cell);
        if ((x1 - x0 + 1) * (y1 - y0 + 1) > 256) return null;
        const keys: string[] = [];
        for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) keys.push(`${x},${y}`);
        return keys;
    }
    query(b: Box): T[] {
        const keys = this.keys(b);
        const found = new Set(keys ? keys.flatMap(k => this.buckets.get(k) ?? []) : [...this.buckets.values()].flat());
        for (const item of this.overflow) found.add(item);
        return [...found].filter(item => {
            const a = this.bounds(item);
            return a.x <= b.x + b.width + EPS && a.x + a.width >= b.x - EPS && a.y <= b.y + b.height + EPS && a.y + a.height >= b.y - EPS;
        });
    }
}

export function boundsOf(nodes: readonly Box[]): Box {
    const x = Math.min(...nodes.map(n => n.x)), y = Math.min(...nodes.map(n => n.y));
    return { x, y, width: Math.max(...nodes.map(n => n.x + n.width)) - x, height: Math.max(...nodes.map(n => n.y + n.height)) - y };
}
export function orthogonal(points: Point[]) {
    return points.length >= 2 && routeSegments(points).every(s => Math.abs(s.a.x - s.b.x) < EPS || Math.abs(s.a.y - s.b.y) < EPS);
}
export { pointOnSegment, routeSegments, segmentThroughBox, simplifyRoute };
