import type { Point, PolygonSource } from './types.js';

export interface PolygonDiagnostics {
    net?: string;
    layer?: string;
    commandsSeen?: string[];
    unknownCommands?: string[];
}

function trimClosingPoint(points: Point[]): Point[] {
    if (points.length > 1 &&
        points[0][0] === points[points.length - 1][0] &&
        points[0][1] === points[points.length - 1][1]) {
        points.pop();
    }
    return points;
}

function flattenCubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, steps = 12): Point[] {
    const pts: Point[] = [];
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        const u2 = u * u;
        const t2 = t * t;
        const x = u2 * u * p0[0] + 3 * u2 * t * p1[0] + 3 * u * t2 * p2[0] + t2 * t * p3[0];
        const y = u2 * u * p0[1] + 3 * u2 * t * p1[1] + 3 * u * t2 * p2[1] + t2 * t * p3[1];
        pts.push([x, y]);
    }
    return pts;
}

function flattenQuadraticBezier(p0: Point, p1: Point, p2: Point, steps = 12): Point[] {
    const pts: Point[] = [];
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
        const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
        pts.push([x, y]);
    }
    return pts;
}

function arcPoints(start: Point, end: Point, angleDeg: number): Point[] {
    const [sx, sy] = start;
    const [ex, ey] = end;
    const angleRad = angleDeg * Math.PI / 180;
    const absAngle = Math.abs(angleRad);

    if (absAngle < 1e-9 || (Math.abs(sx - ex) < 1e-9 && Math.abs(sy - ey) < 1e-9)) {
        return [[ex, ey]];
    }

    const dx = ex - sx;
    const dy = ey - sy;
    const chord = Math.hypot(dx, dy);
    const radius = chord / (2 * Math.sin(absAngle / 2));
    const h = radius * Math.cos(absAngle / 2);

    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;

    const nx = -dy / chord;
    const ny = dx / chord;

    const sign = angleRad >= 0 ? 1 : -1;
    const cx = mx + sign * nx * h;
    const cy = my + sign * ny * h;

    const startAngle = Math.atan2(sy - cy, sx - cx);
    const endAngle = startAngle + angleRad;

    const pts: Point[] = [];
    const count = Math.max(4, Math.min(64, Math.ceil(Math.abs(angleDeg) / 3)));
    for (let i = 1; i <= count; i++) {
        const t = i / count;
        const a = startAngle + (endAngle - startAngle) * t;
        pts.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
    }
    return pts;
}

function rotatePoint(p: Point, cx: number, cy: number, angleDeg: number): Point {
    const angleRad = angleDeg * Math.PI / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}

function roundedRectPoints(x: number, y: number, w: number, h: number, rot: number, round: number): Point[] {
    const corners: Point[] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    const rotated = corners.map(p => rotatePoint(p, x, y, rot || 0));
    if (!round || round <= 1e-6) return rotated;
    return rotated;
}

function samePoint(a: Point, b: Point): boolean {
    return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
}

export function parsePolygonSource(source: PolygonSource, diagnostics?: PolygonDiagnostics): Point[][] {
    const rings: Point[][] = [];
    let current: Point[] = [];
    let i = 0;
    const commandsSeen = new Set<string>();

    function flush(forceClose = false) {
        if (current.length >= 2) {
            if (forceClose && !samePoint(current[0], current[current.length - 1])) {
                current.push([...current[0]]);
            }
            rings.push(trimClosingPoint([...current]));
        }
        current = [];
    }

    if (typeof source[0] === 'number' && typeof source[1] === 'number') {
        current.push([source[0], source[1]]);
        i = 2;
    }

    while (i < source.length) {
        const cmd = source[i++];
        if (typeof cmd !== 'string') continue;
        commandsSeen.add(cmd);

        if (cmd === 'M') {
            flush();
            if (i + 1 < source.length && typeof source[i] === 'number' && typeof source[i + 1] === 'number') {
                current.push([source[i], source[i + 1]]);
                i += 2;
            }
        } else if (cmd === 'Z') {
            flush(true);
        } else if (cmd === 'L') {
            while (i + 1 < source.length && typeof source[i] === 'number' && typeof source[i + 1] === 'number') {
                current.push([source[i], source[i + 1]]);
                i += 2;
            }
        } else if (cmd === 'R') {
            const x = source[i], y = source[i + 1], w = source[i + 2], h = source[i + 3], rot = source[i + 4], round = source[i + 5];
            if (typeof x === 'number' && typeof y === 'number' && typeof w === 'number' && typeof h === 'number') {
                current.push(...roundedRectPoints(x, y, w, h, (rot as number) || 0, (round as number) || 0));
            }
            i += 6;
        } else if (cmd === 'CIRCLE') {
            const cx = source[i], cy = source[i + 1], r = source[i + 2];
            if (typeof cx === 'number' && typeof cy === 'number' && typeof r === 'number') {
                const circle: Point[] = [];
                for (let a = 0; a < 24; a++) {
                    const ang = (2 * Math.PI * a) / 24;
                    circle.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]);
                }
                rings.push(trimClosingPoint(circle));
            }
            i += 3;
        } else if (cmd === 'C') {
            while (i + 5 < source.length &&
                typeof source[i] === 'number' && typeof source[i + 1] === 'number' &&
                typeof source[i + 2] === 'number' && typeof source[i + 3] === 'number' &&
                typeof source[i + 4] === 'number' && typeof source[i + 5] === 'number') {
                const p0 = current.length ? current[current.length - 1] : [source[i], source[i + 1]];
                const p1: Point = [source[i], source[i + 1]];
                const p2: Point = [source[i + 2], source[i + 3]];
                const p3: Point = [source[i + 4], source[i + 5]];
                current.push(...flattenCubicBezier(p0, p1, p2, p3));
                i += 6;
            }
        } else if (cmd === 'Q') {
            while (i + 3 < source.length &&
                typeof source[i] === 'number' && typeof source[i + 1] === 'number' &&
                typeof source[i + 2] === 'number' && typeof source[i + 3] === 'number') {
                const p0 = current.length ? current[current.length - 1] : [source[i], source[i + 1]];
                const p1: Point = [source[i], source[i + 1]];
                const p2: Point = [source[i + 2], source[i + 3]];
                current.push(...flattenQuadraticBezier(p0, p1, p2));
                i += 4;
            }
        } else if (cmd === 'ARC' || cmd === 'CARC') {
            if (i + 2 < source.length &&
                typeof source[i] === 'number' &&
                typeof source[i + 1] === 'number' &&
                typeof source[i + 2] === 'number') {
                const start = current.length ? current[current.length - 1] : [0, 0];
                const angleDeg = source[i];
                const end: Point = [source[i + 1], source[i + 2]];
                current.push(...arcPoints(start, end, angleDeg));
                i += 3;
            }
        } else {
            if (diagnostics) {
                diagnostics.unknownCommands = [...(diagnostics.unknownCommands || []), cmd];
            }
            if (typeof source[i] === 'number') i++;
        }
    }

    flush();

    if (diagnostics) {
        diagnostics.commandsSeen = [...commandsSeen];
    }
    return rings.filter(ring => ring.length >= 2);
}

export function ringsFromComplex(complex: PolygonSource[] | PolygonSource, diagnostics?: PolygonDiagnostics): Point[][] {
    if (!complex) return [];
    if (Array.isArray(complex) && complex.length > 0 && Array.isArray(complex[0])) {
        const allRings: Point[][] = [];
        for (const source of complex as PolygonSource[]) {
            allRings.push(...parsePolygonSource(source, diagnostics));
        }
        return allRings.filter(ring => ring.length >= 2);
    }
    return parsePolygonSource(complex as PolygonSource, diagnostics);
}

export function polygonRings(poly: { sources?: PolygonSource[]; rings?: Point[][] }, diagnostics?: PolygonDiagnostics): Point[][] {
    if (poly.sources && poly.sources.length) {
        return ringsFromComplex(poly.sources, diagnostics);
    }
    if (poly.rings && poly.rings.length) {
        return poly.rings.filter(r => r.length >= 3);
    }
    return [];
}
