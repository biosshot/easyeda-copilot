/** The sheet goal is landscape. Bounds always describe occupied geometry;
 * this policy never adds blank canvas to manufacture an aspect ratio. */
export const SCHEMATIC_SHEET = Object.freeze({ aspectRatio: Math.SQRT2, rootPadding: 15, blockPadding: 30, extraBlockGap: 25 });

type Point = { x: number; y: number };
type Rect = Point & { width: number; height: number };
export type PackingItem = { id: string; width: number; height: number };
export type PackingNet = { weight: number; terminals: Array<{ id: string; points: Point[]; anchor: boolean }> };
export type PackingLayout = { positions: Map<string, Point>; width: number; height: number; affinity: number; score: number };
const EPS = 1e-6;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const intersects = (a: Rect, b: Rect) => a.x < b.x + b.width - EPS && a.x + a.width > b.x + EPS
    && a.y < b.y + b.height - EPS && a.y + a.height > b.y + EPS;

/** Named ports do not need drawn wires, but their islands still belong near
 * the real IC/connector terminals. Common supplies use the nearest anchor,
 * rather than attracting every decoupler to every supply pin on the sheet. */
export function packingAffinity(nets: readonly PackingNet[], positions: ReadonlyMap<string, Point>) {
    let sum = 0, weights = 0;
    for (const net of nets) {
        const present = net.terminals.filter(t => positions.has(t.id));
        const anchors = present.filter(t => t.anchor);
        const followers = present.filter(t => !t.anchor);
        for (const source of followers.length && anchors.length ? followers : present) {
            const targets = (anchors.length ? anchors : present).filter(t => t.id !== source.id);
            if (!targets.length) continue;
            const a = positions.get(source.id)!;
            let distance = Infinity;
            for (const target of targets) {
                const b = positions.get(target.id)!;
                for (const p of source.points) for (const q of target.points) {
                    distance = Math.min(distance, Math.abs(a.x + p.x - b.x - q.x) + Math.abs(a.y + p.y - b.y - q.y));
                }
            }
            if (Number.isFinite(distance)) { sum += distance * net.weight; weights += net.weight; }
        }
    }
    return weights ? sum / weights : 0;
}

function sheetScore(width: number, height: number, area: number, distance: number, padding: number) {
    const w = Math.max(EPS, width + padding * 2), h = Math.max(EPS, height + padding * 2), ratio = SCHEMATIC_SHEET.aspectRatio;
    // Area of the smallest landscape sheet enclosing this candidate. It
    // penalizes excess height more strongly than the same excess width.
    const sheetArea = Math.max(w * w / ratio, h * h * ratio);
    return sheetArea + w * h * 0.15 + sheetArea * Math.abs(Math.log(w / h / ratio)) * 0.1
        + distance * Math.sqrt(area) * 0.35;
}

/** Split free rectangles around the occupied one. Free rectangles may overlap;
 * containment pruning prevents redundant candidates. Occupied rectangles never do. */
function subtract(free: Rect[], used: Rect): Rect[] {
    const split = free.flatMap(r => {
        if (!intersects(r, used)) return [r];
        const parts: Rect[] = [];
        if (used.x > r.x + EPS) parts.push({ ...r, width: used.x - r.x });
        if (used.x + used.width < r.x + r.width - EPS) parts.push({ ...r, x: used.x + used.width, width: r.x + r.width - used.x - used.width });
        if (used.y > r.y + EPS) parts.push({ ...r, height: used.y - r.y });
        if (used.y + used.height < r.y + r.height - EPS) parts.push({ ...r, y: used.y + used.height, height: r.y + r.height - used.y - used.height });
        return parts;
    });
    return split.filter((r, i) => !split.some((b, j) => i !== j && b.x <= r.x + EPS && b.y <= r.y + EPS
        && b.x + b.width >= r.x + r.width - EPS && b.y + b.height >= r.y + r.height - EPS
        && (j < i || b.width * b.height > r.width * r.height + EPS)));
}

/** Bounded deterministic rectangle packing. All symbols, pins and routes stay
 * rigid; only translations are returned. Gaps are reserved inside the bins. */
export function packSchematicRectangles(items: readonly PackingItem[], gap: number,
    nets: readonly PackingNet[] = [], padding: number = SCHEMATIC_SHEET.rootPadding + SCHEMATIC_SHEET.blockPadding) {
    if (!items.length) return { positions: new Map<string, Point>(), width: 0, height: 0, affinity: 0, score: 0, alternatives: [] as PackingLayout[] };
    const area = items.reduce((sum, b) => sum + (b.width + gap) * (b.height + gap), 0);
    const widest = Math.max(...items.map(b => b.width)), tallest = Math.max(...items.map(b => b.height));
    const estimate = Math.sqrt(area * SCHEMATIC_SHEET.aspectRatio);
    const byArea = items.toSorted((a, b) => b.width * b.height - a.width * a.height || compare(a.id, b.id));
    const widths = new Set([widest, tallest * SCHEMATIC_SHEET.aspectRatio,
        ...[0.75, 0.9, 1, 1.12, 1.3, 1.5].map(f => estimate * f),
        ...[2, 3].map(n => byArea.slice(0, n).reduce((w, b) => w + b.width + gap, -gap)),
    ].map(w => Math.max(widest, w)));
    const orders = [byArea,
        items.toSorted((a, b) => b.height - a.height || b.width - a.width || compare(a.id, b.id)),
        items.toSorted((a, b) => b.width - a.width || b.height - a.height || compare(a.id, b.id)),
        ...byArea.slice(1, 3).map(first => [first, ...byArea.filter(b => b !== first)])];
    let best: PackingLayout | undefined;
    const layouts = new Map<string, PackingLayout>();
    for (const width of widths) for (const order of orders) {
        let free: Rect[] = [{ x: 0, y: 0, width: width + gap, height: items.reduce((h, b) => h + b.height + gap, 0) }];
        const positions = new Map<string, Point>();
        let right = 0, bottom = 0;
        for (const item of order) {
            const w = item.width + gap, h = item.height + gap;
            let choice: { x: number; y: number; score: number } | undefined;
            const localNets = nets.filter(n => n.terminals.some(t => t.id === item.id));
            for (const r of free) {
                if (r.width + EPS < w || r.height + EPS < h) continue;
                const sites = [{ x: r.x, y: r.y }];
                // Try aligning the module's local port with already placed
                // target pins, including free space partway down a tall IC.
                for (const net of localNets) {
                    const own = net.terminals.find(t => t.id === item.id)!;
                    for (const target of net.terminals.filter(t => t.id !== item.id && positions.has(t.id)).slice(0, 4)) {
                        const at = positions.get(target.id)!;
                        for (const p of own.points.slice(0, 2)) for (const q of target.points.slice(0, 4)) {
                            sites.push({ x: Math.max(r.x, Math.min(r.x + r.width - w, at.x + q.x - p.x)), y: r.y },
                                { x: r.x, y: Math.max(r.y, Math.min(r.y + r.height - h, at.y + q.y - p.y)) });
                        }
                    }
                }
                for (const site of sites) {
                    positions.set(item.id, site);
                    const score = sheetScore(Math.max(right, site.x + item.width), Math.max(bottom, site.y + item.height), area,
                        packingAffinity(localNets, positions), padding);
                    if (!choice || score < choice.score - EPS) choice = { ...site, score };
                }
            }
            if (!choice) throw new Error(`No packing space for ${item.id}`);
            positions.set(item.id, { x: choice.x, y: choice.y });
            free = subtract(free, { ...choice, width: w, height: h });
            right = Math.max(right, choice.x + item.width); bottom = Math.max(bottom, choice.y + item.height);
        }
        for (const [reverseX, reverseY] of [[false, false], [true, false], [false, true], [true, true]]) {
            // Reverse the order of whole rectangles, not their contents. An
            // IC keeps its left-facing pins when a module moves to its left.
            const arranged = new Map(items.map(b => {
                const p = positions.get(b.id)!;
                return [b.id, { x: reverseX ? right - p.x - b.width : p.x, y: reverseY ? bottom - p.y - b.height : p.y }];
            }));
            const affinity = packingAffinity(nets, arranged), score = sheetScore(right, bottom, area, affinity, padding);
            const layout = { positions: arranged, width: right, height: bottom, affinity, score };
            const key = `${right.toFixed(5)}:${bottom.toFixed(5)}`;
            if (!layouts.has(key) || score < layouts.get(key)!.score - EPS) layouts.set(key, layout);
            if (!best || score < best.score - EPS) best = layout;
        }
    }
    // A child block need not have the sheet's aspect ratio. Keep a few compact
    // tall/wide alternatives so the parent can fill the space beside neighbours.
    const frontier = [...layouts.values()].filter(a => ![...layouts.values()].some(b => b !== a
        && b.width <= a.width && b.height <= a.height && b.affinity <= a.affinity));
    const sorted = frontier.sort((a, b) => a.width - b.width || a.height - b.height);
    const alternatives = [...new Set([best!, ...Array.from({ length: Math.min(7, sorted.length) }, (_, i) =>
        sorted[Math.round(i * (sorted.length - 1) / Math.max(1, Math.min(7, sorted.length) - 1))])])];
    return { ...best!, alternatives };
}
