type Row = unknown[];
type Pin = { id: string; number: string; name: string; x: number; y: number; length: number; rotation: number };
type Section = { id: string; bbox: [number, number, number, number]; rows: Row[]; pins: Pin[] };

const number = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const xml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);

function parse(dataStr: string): Section[] {
    const sections: Section[] = [];
    let current: Section | undefined;
    for (const raw of dataStr.split(/\r?\n/)) {
        if (!raw.trim()) continue;
        let row: Row;
        try { row = JSON.parse(raw); } catch { throw new Error('Invalid EasyEDA symbol data.'); }
        if (!Array.isArray(row) || typeof row[0] !== 'string') continue;
        if (row[0] === 'PART') {
            const bbox = (row[2] as { BBOX?: unknown } | undefined)?.BBOX;
            if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(v => number(v) !== undefined)
                || bbox[2] <= bbox[0] || bbox[3] <= bbox[1]) {
                throw new Error('Invalid PART bounding box.');
            }
            current = { id: String(row[1] ?? sections.length + 1), bbox: bbox as Section['bbox'], rows: [], pins: [] };
            sections.push(current);
        } else if (current) {
            current.rows.push(row);
        }
    }
    if (!sections.length) throw new Error('Symbol has no PART sections.');
    for (const section of sections) {
        const attrs = new Map<string, { number?: string; name?: string }>();
        for (const row of section.rows) {
            if (row[0] !== 'ATTR' || typeof row[2] !== 'string') continue;
            const kind = row[3];
            if (kind !== 'NUMBER' && kind !== 'NAME') continue;
            const attr = attrs.get(row[2]) ?? {};
            if (kind === 'NUMBER') attr.number = String(row[4] ?? '');
            else attr.name = String(row[4] ?? '');
            attrs.set(row[2], attr);
        }
        for (const row of section.rows) {
            if (row[0] !== 'PIN') continue;
            const x = number(row[4]), y = number(row[5]), length = number(row[6]), rotation = number(row[7]);
            if (x === undefined || y === undefined || length === undefined || rotation === undefined) {
                throw new Error(`Invalid PIN geometry in ${section.id}.`);
            }
            const attr = attrs.get(String(row[1])) ?? {};
            section.pins.push({ id: String(row[1]), number: attr.number ?? '?', name: attr.name ?? '', x, y, length, rotation });
        }
    }
    return sections;
}

function arcPath(row: Row, point: (x: number, y: number) => [number, number], scale: number): string | undefined {
    const coords = row.slice(2, 8).map(number);
    if (coords.some(v => v === undefined)) return undefined;
    const [x1, y1, x2, y2, x3, y3] = coords as number[];
    const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
    if (Math.abs(d) < 1e-8) return undefined;
    const q1 = x1 * x1 + y1 * y1, q2 = x2 * x2 + y2 * y2, q3 = x3 * x3 + y3 * y3;
    const cx = (q1 * (y2 - y3) + q2 * (y3 - y1) + q3 * (y1 - y2)) / d;
    const cy = (q1 * (x3 - x2) + q2 * (x1 - x3) + q3 * (x2 - x1)) / d;
    const r = Math.hypot(x1 - cx, y1 - cy);
    const mod = (v: number) => (v % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const a = Math.atan2(y1 - cy, x1 - cx);
    const mid = mod(Math.atan2(y2 - cy, x2 - cx) - a);
    const end = mod(Math.atan2(y3 - cy, x3 - cx) - a);
    const ccw = mid <= end;
    const span = ccw ? end : 2 * Math.PI - end;
    const p1 = point(x1, y1), p3 = point(x3, y3);
    return `M ${p1[0]} ${p1[1]} A ${r * scale} ${r * scale} 0 ${span > Math.PI ? 1 : 0} ${ccw ? 0 : 1} ${p3[0]} ${p3[1]}`;
}

export function renderComponentSymbol(dataStr: string) {
    const sections = parse(dataStr);
    const warnings = new Set<string>();
    const cards: string[] = [];
    let top = 0;
    let maxWidth = 0;
    const pinSections: { section: string; pins: { pin_number: string; name: string }[] }[] = [];

    for (const section of sections) {
        if (section.pins.some(pin => pin.number === '?')) warnings.add(`Missing pin number in ${section.id}.`);
        const pinNumbers = section.pins.map(pin => pin.number).filter(value => value !== '?');
        if (new Set(pinNumbers).size !== pinNumbers.length) warnings.add(`Duplicate pin number in ${section.id}.`);
        const bounds = [...section.bbox] as [number, number, number, number];
        for (const pin of section.pins) {
            const rad = pin.rotation * Math.PI / 180;
            const endX = pin.x + pin.length * Math.cos(rad);
            const endY = pin.y + pin.length * Math.sin(rad);
            const labelX = pin.x - 10 * Math.cos(rad), labelY = pin.y - 10 * Math.sin(rad);
            bounds[0] = Math.min(bounds[0], pin.x, endX, labelX);
            bounds[1] = Math.min(bounds[1], pin.y, endY, labelY);
            bounds[2] = Math.max(bounds[2], pin.x, endX, labelX);
            bounds[3] = Math.max(bounds[3], pin.y, endY, labelY);
        }
        let preferredScale = 4;
        // Make room for adjacent label columns, including bottom/top pin rows.
        for (const a of section.pins) for (const b of section.pins) {
            if (a === b) continue;
            const ax = a.x - 10 * Math.cos(a.rotation * Math.PI / 180);
            const ay = a.y - 10 * Math.sin(a.rotation * Math.PI / 180);
            const bx = b.x - 10 * Math.cos(b.rotation * Math.PI / 180);
            const by = b.y - 10 * Math.sin(b.rotation * Math.PI / 180);
            if (Math.abs(ay - by) < 1 && Math.abs(ax - bx) > 0) {
                const labelWidth = (pin: Pin) => Math.max(pin.name.length * 7, pin.number.length * 8);
                preferredScale = Math.max(preferredScale, ((labelWidth(a) + labelWidth(b)) / 2 + 12) / Math.abs(ax - bx));
            }
        }
        const scale = Math.min(preferredScale, 1600 / Math.max(1, bounds[2] - bounds[0]), 1800 / Math.max(1, bounds[3] - bounds[1]));
        const paddingX = Math.max(100, ...section.pins.map(pin => Math.max(pin.name.length * 7, pin.number.length * 8) / 2 + 20));
        const width = Math.ceil((bounds[2] - bounds[0]) * scale + paddingX * 2);
        const height = Math.ceil((bounds[3] - bounds[1]) * scale + 180);
        if (width > 2400 || height > 2400 || top + height > 6000) throw new Error('Symbol is too large to preview.');
        const point = (x: number, y: number): [number, number] =>
            [Math.round((x - bounds[0]) * scale + paddingX), Math.round((bounds[3] - y) * scale + 80)];
        const graphics: string[] = [];
        const labels: string[] = [];
        for (const row of section.rows) {
            const tag = row[0];
            if (tag === 'LINE') {
                const a = number(row[2]), b = number(row[3]), c = number(row[4]), d = number(row[5]);
                if ([a, b, c, d].some(v => v === undefined)) { warnings.add('Invalid LINE skipped.'); continue; }
                const [x1, y1] = point(a!, b!), [x2, y2] = point(c!, d!);
                graphics.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
            } else if (tag === 'RECT') {
                const a = number(row[2]), b = number(row[3]), c = number(row[4]), d = number(row[5]);
                if ([a, b, c, d].some(v => v === undefined)) { warnings.add('Invalid RECT skipped.'); continue; }
                const [x1, y1] = point(a!, b!), [x2, y2] = point(c!, d!);
                graphics.push(`<rect x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}"/>`);
            } else if (tag === 'POLY') {
                const coords = row[2];
                if (!Array.isArray(coords) || coords.length < 4 || coords.length % 2 || !coords.every(v => number(v) !== undefined)) {
                    warnings.add('Invalid POLY skipped.'); continue;
                }
                const points = [];
                for (let i = 0; i < coords.length; i += 2) points.push(point(coords[i], coords[i + 1]).join(','));
                graphics.push(`<polyline points="${points.join(' ')}"/>`);
            } else if (tag === 'CIRCLE') {
                const x = number(row[2]), y = number(row[3]), r = number(row[4]);
                if (x === undefined || y === undefined || r === undefined) { warnings.add('Invalid CIRCLE skipped.'); continue; }
                const [cx, cy] = point(x, y);
                graphics.push(`<circle cx="${cx}" cy="${cy}" r="${r * scale}"/>`);
            } else if (tag === 'ARC') {
                const path = arcPath(row, point, scale);
                if (path) graphics.push(`<path d="${path}"/>`);
                else warnings.add('Invalid ARC skipped.');
            } else if (tag === 'PIN') {
                const pin = section.pins.find(p => p.id === String(row[1]));
                if (!pin) continue;
                const rad = pin.rotation * Math.PI / 180;
                const vx = Math.cos(rad), vy = Math.sin(rad);
                const [x1, y1] = point(pin.x, pin.y);
                const [x2, y2] = point(pin.x + pin.length * vx, pin.y + pin.length * vy);
                graphics.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
                const [nx, ny] = point(pin.x - 10 * vx, pin.y - 10 * vy);
                labels.push(`<text x="${nx}" y="${ny + 10}" text-anchor="middle" dominant-baseline="middle" fill="#a32617">${xml(pin.number)}</text>`);
                if (pin.name && pin.name !== pin.number) {
                    // Use the same two-line label for every pin orientation.
                    labels.push(`<text x="${nx}" y="${ny - 10}" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="#35536f">${xml(pin.name)}</text>`);
                }
            } else if (typeof tag === 'string' && !['ATTR', 'DOCTYPE', 'HEAD', 'LINESTYLE', 'FONTSTYLE', 'PART'].includes(tag)) {
                warnings.add(`Unsupported symbol primitive: ${tag}.`);
            }
        }
        cards.push(`<g transform="translate(0 ${top})"><rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="8" fill="#fff" stroke="#d4d9df"/><text x="18" y="28" font-size="17" font-weight="bold">${xml(section.id)}</text><g fill="none" stroke="#202b37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${graphics.join('')}</g><g font-size="14" font-family="Arial, sans-serif" fill="#202b37">${labels.join('')}</g></g>`);
        pinSections.push({ section: section.id, pins: section.pins.map(pin => ({ pin_number: pin.number, name: pin.name })) });
        top += height + 12;
        maxWidth = Math.max(maxWidth, width);
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${maxWidth}" height="${top}" viewBox="0 0 ${maxWidth} ${top}"><rect width="100%" height="100%" fill="#f4f6f8"/>${cards.join('')}</svg>`;
    return { svg, sections: pinSections, warnings: [...warnings] };
}
