import { RawPcbPolygon } from "@copilot/shared/types/pcb/raw";
import { PcbPoint } from "@copilot/shared/types/pcb/shared";

export interface PolygonDiagnostics {
    net?: string;
    layer?: string;
    commandsSeen?: string[];
    unknownCommands?: string[];
}

function trimClosingPoint(points: PcbPoint[]): PcbPoint[] {
    if (points.length > 1 &&
        points[0].x === points[points.length - 1].x &&
        points[0].y === points[points.length - 1].y) {
        points.pop();
    }
    return points;
}

function flattenCubicBezier(p0: PcbPoint, p1: PcbPoint, p2: PcbPoint, p3: PcbPoint, steps = 12): PcbPoint[] {
    const pts: PcbPoint[] = [];
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        const u2 = u * u;
        const t2 = t * t;
        const x = u2 * u * p0.x + 3 * u2 * t * p1.x + 3 * u * t2 * p2.x + t2 * t * p3.x;
        const y = u2 * u * p0.y + 3 * u2 * t * p1.y + 3 * u * t2 * p2.y + t2 * t * p3.y;
        pts.push({ x, y });
    }
    return pts;
}

function flattenQuadraticBezier(p0: PcbPoint, p1: PcbPoint, p2: PcbPoint, steps = 12): PcbPoint[] {
    const pts: PcbPoint[] = [];
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        const x = u * u * p0.x + 2 * u * t * p1.x + t * t * p2.y;
        const y = u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y;
        pts.push({ x, y });
    }
    return pts;
}

function arcPoints(start: PcbPoint, end: PcbPoint, angleDeg: number): PcbPoint[] {
    const { x: sx, y: sy } = start;
    const { x: ex, y: ey } = end;
    const angleRad = angleDeg * Math.PI / 180;
    const absAngle = Math.abs(angleRad);

    if (absAngle < 1e-9 || (Math.abs(sx - ex) < 1e-9 && Math.abs(sy - ey) < 1e-9)) {
        return [{ x: ex, y: ey }];
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

    const pts: PcbPoint[] = [];
    const count = Math.max(4, Math.min(64, Math.ceil(Math.abs(angleDeg) / 3)));
    for (let i = 1; i <= count; i++) {
        const t = i / count;
        const a = startAngle + (endAngle - startAngle) * t;
        pts.push({ x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius });
    }
    return pts;
}

function rotatePoint(p: PcbPoint, cx: number, cy: number, angleDeg: number): PcbPoint {
    const angleRad = angleDeg * Math.PI / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const dx = p.x - cx;
    const dy = p.y - cy;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

function roundedRectPoints(x: number, y: number, w: number, h: number, rot: number, round: number): PcbPoint[] {
    const corners: PcbPoint[] = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
    const rotated = corners.map(p => rotatePoint(p, x, y, rot || 0));
    if (!round || round <= 1e-6) return rotated;
    return rotated;
}

function samePoint(a: PcbPoint, b: PcbPoint): boolean {
    return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
}

export function parsePolygonSource(source: RawPcbPolygon['sources'][0], diagnostics?: PolygonDiagnostics): PcbPoint[][] {
    const rings: PcbPoint[][] = [];
    let current: PcbPoint[] = [];
    let i = 0;
    const commandsSeen = new Set<string>();

    function flush(forceClose = false) {
        if (current.length >= 2) {
            if (forceClose && !samePoint(current[0], current[current.length - 1])) {
                current.push({ ...current[0] });
            }
            rings.push(trimClosingPoint([...current]));
        }
        current = [];
    }

    if (typeof source[0] === 'number' && typeof source[1] === 'number') {
        current.push({ x: source[0], y: source[1] });
        i = 2;
    }

    while (i < source.length) {
        const cmd = source[i++];
        if (typeof cmd !== 'string') continue;
        commandsSeen.add(cmd);

        if (cmd === 'M') {
            flush();
            if (i + 1 < source.length && typeof source[i] === 'number' && typeof source[i + 1] === 'number') {
                current.push({ x: source[i] as number, y: source[i + 1] as number });
                i += 2;
            }
        } else if (cmd === 'Z') {
            flush(true);
        } else if (cmd === 'L') {
            while (i + 1 < source.length && typeof source[i] === 'number' && typeof source[i + 1] === 'number') {
                current.push({ x: source[i] as number, y: source[i + 1] as number });
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
                const circle: PcbPoint[] = [];
                for (let a = 0; a < 24; a++) {
                    const ang = (2 * Math.PI * a) / 24;
                    circle.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
                }
                rings.push(trimClosingPoint(circle));
            }
            i += 3;
        } else if (cmd === 'C') {
            while (i + 5 < source.length &&
                typeof source[i] === 'number' && typeof source[i + 1] === 'number' &&
                typeof source[i + 2] === 'number' && typeof source[i + 3] === 'number' &&
                typeof source[i + 4] === 'number' && typeof source[i + 5] === 'number') {
                const p0 = current.length ? current[current.length - 1] : { x: source[i] as number, y: source[i + 1] as number };
                const p1: PcbPoint = { x: source[i] as number, y: source[i + 1] as number };
                const p2: PcbPoint = { x: source[i + 2] as number, y: source[i + 3] as number };
                const p3: PcbPoint = { x: source[i + 4] as number, y: source[i + 5] as number };
                current.push(...flattenCubicBezier(p0, p1, p2, p3));
                i += 6;
            }
        } else if (cmd === 'Q') {
            while (i + 3 < source.length &&
                typeof source[i] === 'number' && typeof source[i + 1] === 'number' &&
                typeof source[i + 2] === 'number' && typeof source[i + 3] === 'number') {
                const p0 = current.length ? current[current.length - 1] : { x: source[i] as number, y: source[i + 1] as number };
                const p1: PcbPoint = { x: source[i] as number, y: source[i + 1] as number };
                const p2: PcbPoint = { x: source[i + 2] as number, y: source[i + 3] as number };
                current.push(...flattenQuadraticBezier(p0, p1, p2));
                i += 4;
            }
        } else if (cmd === 'ARC' || cmd === 'CARC') {
            if (i + 2 < source.length &&
                typeof source[i] === 'number' &&
                typeof source[i + 1] === 'number' &&
                typeof source[i + 2] === 'number') {
                const start = current.length ? current[current.length - 1] : { x: 0, y: 0 };
                const angleDeg = source[i] as number;
                const end: PcbPoint = { x: source[i + 1] as number, y: source[i + 2] as number };
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

export function ringsFromComplex(complex: RawPcbPolygon['sources'] | RawPcbPolygon['sources'][0], diagnostics?: PolygonDiagnostics): PcbPoint[][] {
    if (!complex) return [];
    if (Array.isArray(complex) && complex.length > 0 && Array.isArray(complex[0])) {
        const allRings: PcbPoint[][] = [];
        for (const source of complex as RawPcbPolygon['sources']) {
            allRings.push(...parsePolygonSource(source, diagnostics));
        }
        return allRings.filter(ring => ring.length >= 2);
    }
    return parsePolygonSource(complex as RawPcbPolygon['sources'][0], diagnostics);
}

export function polygonRings(poly: { sources?: RawPcbPolygon['sources']; rings?: PcbPoint[][] }, diagnostics?: PolygonDiagnostics): PcbPoint[][] {
    if (poly.sources && poly.sources.length) {
        return ringsFromComplex(poly.sources, diagnostics);
    }
    if (poly.rings && poly.rings.length) {
        return poly.rings.filter(r => r.length >= 3);
    }
    return [];
}
