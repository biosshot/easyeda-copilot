/**
 * Разбор контуров SVG в плоские полигоны.
 *
 * EasyEDA принимает картинку не как SVG, а как набор колец вида
 * [x0, y0, 'L', x1, y1, ...] (TPCB_PolygonSourceArray), поэтому кривые и дуги
 * приходится линеаризовать самим.
 */

export interface Point {
    x: number;
    y: number;
}

export type Ring = Point[];

export interface SvgOutline {
    rings: Ring[];
    /** Габарит в исходных единицах SVG. */
    bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

const NUMBER_RE = /-?\d*\.?\d+(?:[eE][+-]?\d+)?/g;
const COMMAND_RE = /[MmZzLlHhVvCcSsQqTtAa]/;

interface Segment {
    command: string;
    args: number[];
}

function tokenize(d: string): Segment[] {
    const segments: Segment[] = [];
    let index = 0;

    while (index < d.length) {
        const char = d[index];

        if (!COMMAND_RE.test(char)) {
            index += 1;
            continue;
        }

        // Аргументы тянутся до следующей буквы-команды.
        let end = index + 1;
        while (end < d.length && !COMMAND_RE.test(d[end])) end += 1;

        const chunk = d.slice(index + 1, end);
        const args = (chunk.match(NUMBER_RE) ?? []).map(Number);

        segments.push({ command: char, args });
        index = end;
    }

    return segments;
}

/** Сколько отрезков нужно, чтобы кривая длиной len выглядела гладкой. */
function segmentCount(len: number, tolerance: number) {
    return Math.min(Math.max(Math.ceil(len / tolerance), 2), 64);
}

function distance(a: Point, b: Point) {
    return Math.hypot(b.x - a.x, b.y - a.y);
}

function flattenCubic(p0: Point, p1: Point, p2: Point, p3: Point, tolerance: number, out: Point[]) {
    const approxLen = distance(p0, p1) + distance(p1, p2) + distance(p2, p3);
    const steps = segmentCount(approxLen, tolerance);

    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;

        out.push({
            x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
            y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
        });
    }
}

function flattenQuadratic(p0: Point, p1: Point, p2: Point, tolerance: number, out: Point[]) {
    const approxLen = distance(p0, p1) + distance(p1, p2);
    const steps = segmentCount(approxLen, tolerance);

    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;

        out.push({
            x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
            y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
        });
    }
}

/** Дуга A: перевод из endpoint- в center-параметризацию по спецификации SVG. */
function flattenArc(
    from: Point,
    rxIn: number,
    ryIn: number,
    xAxisRotationDeg: number,
    largeArc: boolean,
    sweep: boolean,
    to: Point,
    tolerance: number,
    out: Point[],
) {
    let rx = Math.abs(rxIn);
    let ry = Math.abs(ryIn);

    if (rx === 0 || ry === 0) {
        out.push(to);
        return;
    }

    const phi = (xAxisRotationDeg * Math.PI) / 180;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);

    const dx2 = (from.x - to.x) / 2;
    const dy2 = (from.y - to.y) / 2;

    const x1p = cosPhi * dx2 + sinPhi * dy2;
    const y1p = -sinPhi * dx2 + cosPhi * dy2;

    // Радиусы могут не дотягивать до хорды — спецификация требует их увеличить.
    const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lambda > 1) {
        const scale = Math.sqrt(lambda);
        rx *= scale;
        ry *= scale;
    }

    const sign = largeArc === sweep ? -1 : 1;
    const numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    const denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    const coefficient = sign * Math.sqrt(Math.max(0, numerator / denominator));

    const cxp = (coefficient * rx * y1p) / ry;
    const cyp = (-coefficient * ry * x1p) / rx;

    const cx = cosPhi * cxp - sinPhi * cyp + (from.x + to.x) / 2;
    const cy = sinPhi * cxp + cosPhi * cyp + (from.y + to.y) / 2;

    const angleOf = (x: number, y: number) => Math.atan2((y - cyp) / ry, (x - cxp) / rx);
    const theta1 = angleOf(x1p, y1p);
    let deltaTheta = angleOf(-x1p, -y1p) - theta1;

    if (!sweep && deltaTheta > 0) deltaTheta -= 2 * Math.PI;
    else if (sweep && deltaTheta < 0) deltaTheta += 2 * Math.PI;

    const radius = Math.max(rx, ry);
    const steps = segmentCount(Math.abs(deltaTheta) * radius, tolerance);

    for (let i = 1; i <= steps; i++) {
        const theta = theta1 + (deltaTheta * i) / steps;
        const x = rx * Math.cos(theta);
        const y = ry * Math.sin(theta);

        out.push({
            x: cosPhi * x - sinPhi * y + cx,
            y: sinPhi * x + cosPhi * y + cy,
        });
    }
}

/**
 * Превращает атрибут `d` в набор замкнутых колец.
 * `tolerance` — в единицах SVG: чем меньше, тем больше точек на кривых.
 */
export function parseSvgPath(d: string, tolerance = 0.4): Ring[] {
    const segments = tokenize(d);
    const rings: Ring[] = [];

    let current: Point[] = [];
    let cursor: Point = { x: 0, y: 0 };
    let subpathStart: Point = { x: 0, y: 0 };
    // Отражённая контрольная точка для S/T.
    let lastCubicControl: Point | undefined;
    let lastQuadControl: Point | undefined;

    const finish = () => {
        if (current.length >= 3) rings.push(current);
        current = [];
    };

    for (const { command, args } of segments) {
        const relative = command === command.toLowerCase();
        const abs = (x: number, y: number): Point => relative
            ? { x: cursor.x + x, y: cursor.y + y }
            : { x, y };

        switch (command.toUpperCase()) {
            case 'M': {
                for (let i = 0; i + 1 < args.length; i += 2) {
                    const point = abs(args[i], args[i + 1]);

                    if (i === 0) {
                        finish();
                        subpathStart = point;
                        current = [point];
                    }
                    else current.push(point);

                    cursor = point;
                }
                lastCubicControl = lastQuadControl = undefined;
                break;
            }

            case 'L': {
                for (let i = 0; i + 1 < args.length; i += 2) {
                    cursor = abs(args[i], args[i + 1]);
                    current.push(cursor);
                }
                lastCubicControl = lastQuadControl = undefined;
                break;
            }

            case 'H': {
                for (const value of args) {
                    cursor = { x: relative ? cursor.x + value : value, y: cursor.y };
                    current.push(cursor);
                }
                lastCubicControl = lastQuadControl = undefined;
                break;
            }

            case 'V': {
                for (const value of args) {
                    cursor = { x: cursor.x, y: relative ? cursor.y + value : value };
                    current.push(cursor);
                }
                lastCubicControl = lastQuadControl = undefined;
                break;
            }

            case 'C': {
                for (let i = 0; i + 5 < args.length; i += 6) {
                    const c1 = abs(args[i], args[i + 1]);
                    const c2 = abs(args[i + 2], args[i + 3]);
                    const end = abs(args[i + 4], args[i + 5]);

                    flattenCubic(cursor, c1, c2, end, tolerance, current);
                    lastCubicControl = c2;
                    cursor = end;
                }
                lastQuadControl = undefined;
                break;
            }

            case 'S': {
                for (let i = 0; i + 3 < args.length; i += 4) {
                    const c1 = lastCubicControl
                        ? { x: 2 * cursor.x - lastCubicControl.x, y: 2 * cursor.y - lastCubicControl.y }
                        : cursor;
                    const c2 = abs(args[i], args[i + 1]);
                    const end = abs(args[i + 2], args[i + 3]);

                    flattenCubic(cursor, c1, c2, end, tolerance, current);
                    lastCubicControl = c2;
                    cursor = end;
                }
                lastQuadControl = undefined;
                break;
            }

            case 'Q': {
                for (let i = 0; i + 3 < args.length; i += 4) {
                    const c1 = abs(args[i], args[i + 1]);
                    const end = abs(args[i + 2], args[i + 3]);

                    flattenQuadratic(cursor, c1, end, tolerance, current);
                    lastQuadControl = c1;
                    cursor = end;
                }
                lastCubicControl = undefined;
                break;
            }

            case 'T': {
                for (let i = 0; i + 1 < args.length; i += 2) {
                    const c1 = lastQuadControl
                        ? { x: 2 * cursor.x - lastQuadControl.x, y: 2 * cursor.y - lastQuadControl.y }
                        : cursor;
                    const end = abs(args[i], args[i + 1]);

                    flattenQuadratic(cursor, c1, end, tolerance, current);
                    lastQuadControl = c1;
                    cursor = end;
                }
                lastCubicControl = undefined;
                break;
            }

            case 'A': {
                for (let i = 0; i + 6 < args.length; i += 7) {
                    const end = abs(args[i + 5], args[i + 6]);

                    flattenArc(
                        cursor,
                        args[i],
                        args[i + 1],
                        args[i + 2],
                        args[i + 3] !== 0,
                        args[i + 4] !== 0,
                        end,
                        tolerance,
                        current,
                    );
                    cursor = end;
                }
                lastCubicControl = lastQuadControl = undefined;
                break;
            }

            case 'Z': {
                finish();
                cursor = subpathStart;
                lastCubicControl = lastQuadControl = undefined;
                break;
            }
        }
    }

    finish();
    return rings;
}

/** Аффинная матрица [a c e; b d f], как в SVG. */
type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(m: Matrix, n: Matrix): Matrix {
    return [
        m[0] * n[0] + m[2] * n[1],
        m[1] * n[0] + m[3] * n[1],
        m[0] * n[2] + m[2] * n[3],
        m[1] * n[2] + m[3] * n[3],
        m[0] * n[4] + m[2] * n[5] + m[4],
        m[1] * n[4] + m[3] * n[5] + m[5],
    ];
}

function applyMatrix(m: Matrix, point: Point): Point {
    return {
        x: m[0] * point.x + m[2] * point.y + m[4],
        y: m[1] * point.x + m[3] * point.y + m[5],
    };
}

/** Насколько матрица меняет масштаб — нужно, чтобы кривые не грубели после scale. */
function matrixScale(m: Matrix) {
    return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
}

function parseTransform(value: string): Matrix {
    let result: Matrix = IDENTITY;

    for (const match of value.matchAll(/([a-zA-Z]+)\s*\(([^)]*)\)/g)) {
        const args = (match[2].match(NUMBER_RE) ?? []).map(Number);
        const rad = (deg: number) => (deg * Math.PI) / 180;
        let step: Matrix | undefined;

        switch (match[1]) {
            case 'translate':
                step = [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0];
                break;
            case 'scale':
                step = [args[0] ?? 1, 0, 0, args[1] ?? args[0] ?? 1, 0, 0];
                break;
            case 'rotate': {
                const cos = Math.cos(rad(args[0] ?? 0));
                const sin = Math.sin(rad(args[0] ?? 0));
                step = [cos, sin, -sin, cos, 0, 0];

                // rotate(angle, cx, cy) — поворот вокруг точки.
                if (args.length >= 3) {
                    step = multiply([1, 0, 0, 1, args[1], args[2]], step);
                    step = multiply(step, [1, 0, 0, 1, -args[1], -args[2]]);
                }
                break;
            }
            case 'matrix':
                if (args.length >= 6) step = [args[0], args[1], args[2], args[3], args[4], args[5]];
                break;
            case 'skewX':
                step = [1, 0, Math.tan(rad(args[0] ?? 0)), 1, 0, 0];
                break;
            case 'skewY':
                step = [1, Math.tan(rad(args[0] ?? 0)), 0, 1, 0, 0];
                break;
        }

        if (step) result = multiply(result, step);
    }

    return result;
}

function attributes(source: string): Record<string, string> {
    const result: Record<string, string> = {};

    for (const match of source.matchAll(/([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
        result[match[1]] = match[3] ?? match[4] ?? '';
    }

    return result;
}

function num(attrs: Record<string, string>, name: string, fallback = 0) {
    const value = Number.parseFloat(attrs[name]);
    return Number.isFinite(value) ? value : fallback;
}

function pointsToRing(value: string): Ring {
    const numbers = (value.match(NUMBER_RE) ?? []).map(Number);
    const ring: Ring = [];

    for (let i = 0; i + 1 < numbers.length; i += 2) {
        ring.push({ x: numbers[i], y: numbers[i + 1] });
    }

    return ring;
}

function sampleEllipse(cx: number, cy: number, rx: number, ry: number, tolerance: number): Ring {
    const steps = segmentCount(2 * Math.PI * Math.max(rx, ry), tolerance);
    const ring: Ring = [];

    for (let i = 0; i < steps; i++) {
        const angle = (2 * Math.PI * i) / steps;
        ring.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
    }

    return ring;
}

function rectRing(attrs: Record<string, string>, tolerance: number): Ring {
    const x = num(attrs, 'x');
    const y = num(attrs, 'y');
    const width = num(attrs, 'width');
    const height = num(attrs, 'height');

    if (width <= 0 || height <= 0) return [];

    let rx = Math.min(num(attrs, 'rx', num(attrs, 'ry')), width / 2);
    let ry = Math.min(num(attrs, 'ry', num(attrs, 'rx')), height / 2);
    if (!(rx > 0) || !(ry > 0)) rx = ry = 0;

    if (!rx) {
        return [
            { x, y },
            { x: x + width, y },
            { x: x + width, y: y + height },
            { x, y: y + height },
        ];
    }

    const steps = segmentCount((Math.PI / 2) * Math.max(rx, ry), tolerance);
    const ring: Ring = [];

    const corner = (cx: number, cy: number, from: number) => {
        for (let i = 0; i <= steps; i++) {
            const angle = from + (Math.PI / 2) * (i / steps);
            ring.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
        }
    };

    corner(x + width - rx, y + ry, -Math.PI / 2);
    corner(x + width - rx, y + height - ry, 0);
    corner(x + rx, y + height - ry, Math.PI / 2);
    corner(x + rx, y + ry, Math.PI);

    return ring;
}

/** Содержимое этих элементов не рисуется, брать его в контур нельзя. */
const NON_RENDERED = new Set(['defs', 'clippath', 'mask', 'symbol', 'style', 'title', 'desc', 'metadata']);

const TAG_RE = /<(\/)?([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/)?>/g;

/**
 * Контуры всего документа: path, rect, circle, ellipse, polygon, polyline.
 * Учитываются transform на самих фигурах и на охватывающих группах.
 */
export function parseSvgOutline(svg: string, tolerance = 0.4): SvgOutline {
    const rings: Ring[] = [];
    const stack: Matrix[] = [IDENTITY];
    let skipDepth = 0;

    for (const match of svg.matchAll(TAG_RE)) {
        const closing = Boolean(match[1]);
        const tag = match[2].toLowerCase().replace(/^.*:/, '');
        const selfClosing = Boolean(match[4]);

        if (NON_RENDERED.has(tag)) {
            if (closing) skipDepth = Math.max(0, skipDepth - 1);
            else if (!selfClosing) skipDepth += 1;
            continue;
        }

        if (skipDepth > 0) continue;

        if (closing) {
            if (stack.length > 1) stack.pop();
            continue;
        }

        const attrs = attributes(match[3] ?? '');
        const parent = stack[stack.length - 1];
        const matrix = attrs.transform ? multiply(parent, parseTransform(attrs.transform)) : parent;

        // Кривые линеаризуем до трансформации, поэтому допуск приводим к
        // локальным единицам — иначе после scale контур станет угловатым.
        const localTolerance = tolerance / matrixScale(matrix);
        const shapeRings: Ring[] = [];

        switch (tag) {
            case 'path':
                if (attrs.d) shapeRings.push(...parseSvgPath(attrs.d, localTolerance));
                break;
            case 'rect': {
                const ring = rectRing(attrs, localTolerance);
                if (ring.length >= 3) shapeRings.push(ring);
                break;
            }
            case 'circle': {
                const r = num(attrs, 'r');
                if (r > 0) shapeRings.push(sampleEllipse(num(attrs, 'cx'), num(attrs, 'cy'), r, r, localTolerance));
                break;
            }
            case 'ellipse': {
                const rx = num(attrs, 'rx');
                const ry = num(attrs, 'ry');
                if (rx > 0 && ry > 0) shapeRings.push(sampleEllipse(num(attrs, 'cx'), num(attrs, 'cy'), rx, ry, localTolerance));
                break;
            }
            case 'polygon':
            case 'polyline': {
                const ring = pointsToRing(attrs.points ?? '');
                if (ring.length >= 3) shapeRings.push(ring);
                break;
            }
        }

        for (const ring of shapeRings) {
            rings.push(matrix === IDENTITY ? ring : ring.map(point => applyMatrix(matrix, point)));
        }

        // Группы держат трансформацию для вложенных элементов.
        if (!selfClosing) stack.push(matrix);
    }

    if (!rings.length) {
        throw new Error('No drawable outlines found in the SVG. Supported: path, rect, circle, ellipse, polygon, polyline — convert text to paths first.');
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const ring of rings) {
        for (const point of ring) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }
    }

    return { rings, bbox: { minX, minY, maxX, maxY } };
}

/**
 * Приводит контуры к целевому размеру в мм и центрирует в начале координат.
 * Ось Y переворачивается: в SVG она растёт вниз, на плате — вверх.
 * Пропорции сохраняются, задавать можно только ширину или только высоту.
 */
export function fitOutline(outline: SvgOutline, widthMm?: number, heightMm?: number): Ring[] {
    const { bbox } = outline;
    const sourceWidth = bbox.maxX - bbox.minX;
    const sourceHeight = bbox.maxY - bbox.minY;

    if (sourceWidth <= 0 || sourceHeight <= 0) throw new Error('SVG outline is degenerate');
    if (!widthMm && !heightMm) throw new Error('Pass width or height in mm');

    const scale = widthMm && heightMm
        ? Math.min(widthMm / sourceWidth, heightMm / sourceHeight)
        : widthMm
            ? widthMm / sourceWidth
            : heightMm! / sourceHeight;

    const centerX = (bbox.minX + bbox.maxX) / 2;
    const centerY = (bbox.minY + bbox.maxY) / 2;

    return outline.rings.map(ring => ring.map(point => ({
        x: (point.x - centerX) * scale,
        y: -(point.y - centerY) * scale,
    })));
}

/** Кольцо в формате EasyEDA: [x0, y0, 'L', x1, y1, ...]. */
export function ringToPolygonSource(ring: Ring, round: (value: number) => number): Array<string | number> {
    const source: Array<string | number> = [round(ring[0].x), round(ring[0].y), 'L'];

    for (let i = 1; i < ring.length; i++) {
        source.push(round(ring[i].x), round(ring[i].y));
    }

    return source;
}
