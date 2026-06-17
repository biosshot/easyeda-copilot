import { PcbPoint } from '@copilot/shared/types/pcb/shared';
import ClipperLib from 'clipper-lib';

export interface Box {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

export function boxFromPoints(points: PcbPoint[]): Box {
    if (!points || !points.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    let minX = points[0].x, minY = points[0].y, maxX = points[0].x, maxY = points[0].y;
    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
}

export function expandBox(box: Box, padding: number): Box {
    return {
        minX: box.minX - padding,
        minY: box.minY - padding,
        maxX: box.maxX + padding,
        maxY: box.maxY + padding,
    };
}

export function svgY(y: number): number {
    return -y;
}

export function polygonArea(ring: PcbPoint[]): number {
    let area = 0;
    for (let i = 0; i < ring.length; i++) {
        const { x: x1, y: y1 } = ring[i];
        const { x: x2, y: y2 } = ring[(i + 1) % ring.length];
        area += x1 * y2 - x2 * y1;
    }
    return Math.abs(area) / 2;
}

export function pointInRing(point: PcbPoint, ring: PcbPoint[]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const { x: xi, y: yi } = ring[i];
        const { x: xj, y: yj } = ring[j];
        const intersect = ((yi > point.y) !== (yj > point.y)) &&
            (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

export function ringBounds(ring: PcbPoint[]): Box {
    return boxFromPoints(ring);
}

export function ringFullyInside(container: PcbPoint[], candidate: PcbPoint[]): boolean {
    const cb = ringBounds(container);
    const bb = ringBounds(candidate);
    if (bb.minX < cb.minX || bb.minY < cb.minY || bb.maxX > cb.maxX || bb.maxY > cb.maxY) {
        return false;
    }
    for (const p of candidate) {
        if (!pointInRing(p, container)) return false;
    }
    return true;
}

const CUTOUT_MIN_AREA = 0.2;
const CUTOUT_MIN_DENSITY = 0.25;

export function isSliverCutout(ring: PcbPoint[]): boolean {
    const area = polygonArea(ring);
    if (area < CUTOUT_MIN_AREA) return true;
    const bbox = ringBounds(ring);
    const bboxArea = (bbox.maxX - bbox.minX) * (bbox.maxY - bbox.minY);
    if (bboxArea <= 0) return true;
    return area / bboxArea < CUTOUT_MIN_DENSITY;
}

export interface Island {
    outer: PcbPoint[];
    cutouts: PcbPoint[][];
}

export function buildIslands(rings: PcbPoint[][]): Island[] {
    const valid = rings.filter(r => r.length >= 3);
    const sorted = [...valid].sort((a, b) => polygonArea(b) - polygonArea(a));

    const parents = sorted.map((ring, idx) => {
        let best = -1;
        let bestArea = Infinity;
        for (let i = 0; i < sorted.length; i++) {
            if (i === idx) continue;
            if (polygonArea(sorted[i]) > polygonArea(ring) && ringFullyInside(sorted[i], ring)) {
                const area = polygonArea(sorted[i]);
                if (area < bestArea) {
                    bestArea = area;
                    best = i;
                }
            }
        }
        return best;
    });

    const indexToIsland = new Map<number, Island>();
    const islands: Island[] = [];

    for (let i = 0; i < sorted.length; i++) {
        const parent = parents[i];
        if (parent === -1) {
            const island: Island = { outer: sorted[i], cutouts: [] };
            indexToIsland.set(i, island);
            islands.push(island);
        } else {
            const island = indexToIsland.get(parent);
            if (island) {
                island.cutouts.push(sorted[i]);
            } else {
                const orphan: Island = { outer: sorted[i], cutouts: [] };
                islands.push(orphan);
            }
        }
    }

    for (const island of islands) {
        island.cutouts = island.cutouts.filter(c => !isSliverCutout(c));
    }

    return islands;
}

export function cleanPolygonRings(rings: PcbPoint[][]): Island[] {
    const scale = 1000;
    const allPaths: PcbPoint[][] = [];

    for (const ring of rings) {
        if (ring.length < 3) continue;
        const path = ring.map(p => ({ X: Math.round(p.x * scale), Y: Math.round(p.y * scale) }));
        const simplified = ClipperLib.Clipper.SimplifyPolygon(path, ClipperLib.PolyFillType.pftNonZero);
        for (const sp of simplified) {
            if (sp.length < 3) continue;
            const cleaned = ClipperLib.Clipper.CleanPolygon(sp, 0);
            if (cleaned.length < 3) continue;
            allPaths.push(cleaned.map((pt: { X: number, Y: number }): PcbPoint => ({ x: pt.X / scale, y: pt.Y / scale })));
        }
    }

    return buildIslands(allPaths);
}
