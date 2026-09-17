import type { SchematicGroups } from '@copilot/shared/types/schematic-groups';

type Point = { x: number; y: number };
type Pin = Point & { number: string; net: string | null };
type Component = Point & { designator: string; subPartName?: string; pins: Pin[] };
type Box = { minX: number; minY: number; maxX: number; maxY: number };

/** Plain-data input for reproducible offline tests; not an MCP input parameter. */
export interface SchematicGroupsSnapshot {
    components: Component[];
    wires: { net: string | null; segments: number[][] }[];
}

type Contact = { component: number; ref: string; net: string | null };
type WireGraph = {
    points: Point[];
    edges: Map<number, number>[];
    contacts: Contact[][];
    starts: number[][];
    wires: SchematicGroups['wires'];
};

// Numerical tolerance only: never snap to the editor's 5/10-unit drawing grid.
const EPSILON = 1e-4;
const JOIN_SCORE = 0.30;
const compare = new Intl.Collator('en', { numeric: true }).compare;
const sorted = (values: Iterable<string>) => [...new Set(values)].sort((a, b) => compare(a, b) || (a < b ? -1 : a > b ? 1 : 0));
const netName = (value: string | null | undefined) => {
    const name = value?.trim();
    return name && !/^(?:NC|N\/C)$/i.test(name) ? name : null;
};

class InconsistentSnapshot extends Error {}

function token(value: string, kind: string) {
    if (!value || /\s/.test(value)) throw new Error(`Schematic groups: invalid ${kind}: ${JSON.stringify(value)}`);
    return value;
}

function checkedPoint(x: number, y: number): Point {
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Schematic groups: non-finite coordinate.');
    return { x: Math.round(x / EPSILON) * EPSILON, y: Math.round(y / EPSILON) * EPSILON };
}

async function collectSnapshot(): Promise<SchematicGroupsSnapshot> {
    const document = await eda.dmt_SelectControl.getCurrentDocumentInfo();
    if (document?.documentType !== EDMT_EditorDocumentType.SCHEMATIC_PAGE) {
        throw new Error('Open a schematic page before requesting schematic groups.');
    }
    // Lazy imports keep the deterministic analysis usable without the editor globals.
    const { getSchematic } = await import('./schematic');
    const { normalizeWireLine, normWireY } = await import('./utils');
    const primitives = (await eda.sch_PrimitiveComponent.getAll())
        .filter(component => component.getState_ComponentType() === ESCH_PrimitiveComponentType.COMPONENT);
    const seen = new Map<string, Set<string>>();
    for (const primitive of primitives) {
        const ref = token(primitive.getState_Designator().trim(), 'designator');
        const part = primitive.getState_SubPartName() ?? '';
        const parts = seen.get(ref) ?? new Set<string>();
        if (parts.has(part) || (parts.size && (!part || parts.has('')))) {
            throw new Error(`Duplicate designator ${ref}; annotate the schematic before requesting groups.`);
        }
        parts.add(part);
        seen.set(ref, parts);
    }
    // Reuse the existing resolved-netlist reader, without library/MPN/footprint requests.
    const circuit = primitives.length ? await getSchematic(primitives.map(p => p.getState_PrimitiveId()), {
        disableExtractPartUuid: true, disableExtractPos: true,
    }) : { components: [] };
    const nets = new Map<string, string | null>();
    for (const component of circuit.components) {
        for (const pin of component.pins) {
            nets.set(`${component.designator}.${pin.pin_number}`, netName(pin.signal_name));
        }
    }
    const components: Component[] = [];
    // Read-only, bounded batches; do not fan out hundreds of editor API calls at once.
    for (let start = 0; start < primitives.length; start += 16) {
        components.push(...await Promise.all(primitives.slice(start, start + 16).map(async primitive => {
            const designator = primitive.getState_Designator().trim();
            const pins = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(primitive.getState_PrimitiveId());
            if (!Array.isArray(pins)) throw new Error(`Could not read pins of ${designator}.`);
            return {
                designator,
                subPartName: primitive.getState_SubPartName() || undefined,
                // Pin and wire coordinates already share a frame. Only the v2 symbol origin is inverted.
                ...checkedPoint(primitive.getState_X(), normWireY(primitive.getState_Y())),
                pins: pins.map(pin => {
                    const number = token(String(pin.getState_PinNumber()), 'pin number');
                    const ref = `${designator}.${number}`;
                    if (!nets.has(ref)) throw new Error(`Could not resolve schematic pin ${ref}; refresh and retry.`);
                    return { number, net: nets.get(ref) ?? null,
                        ...checkedPoint(pin.getState_X(), pin.getState_Y()) };
                }),
            };
        })));
    }
    // Use a fresh editor read, not the assembly-only wire-snap cache.
    const wires = (await eda.sch_PrimitiveWire.getAll()).map(wire => {
        const raw = wire.getState_Line();
        const segments = normalizeWireLine(raw);
        if (!segments.length && raw?.length) throw new Error('Unsupported schematic wire geometry.');
        return { net: netName(wire.getState_Net()), segments };
    });
    const current = await eda.dmt_SelectControl.getCurrentDocumentInfo();
    if (current?.uuid !== document.uuid || current?.tabId !== document.tabId) {
        throw new Error('Schematic page changed while reading groups; retry on the intended page.');
    }
    return { components, wires };
}

function onSegment(p: Point, a: Point, b: Point) {
    const dx = b.x - a.x, dy = b.y - a.y;
    return p.x >= Math.min(a.x, b.x) - EPSILON && p.x <= Math.max(a.x, b.x) + EPSILON
        && p.y >= Math.min(a.y, b.y) - EPSILON && p.y <= Math.max(a.y, b.y) + EPSILON
        && Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) <= EPSILON * Math.hypot(dx, dy);
}

function buildWireGraph(snapshot: SchematicGroupsSnapshot): WireGraph {
    const points: Point[] = [], edges: Map<number, number>[] = [], contacts: Contact[][] = [];
    const names: Set<string>[] = [], indices = new Map<string, number>();
    const starts: number[][] = snapshot.components.map(() => []);
    const node = (point: Point) => {
        const p = checkedPoint(point.x, point.y);
        const key = `${Math.round(p.x / EPSILON)},${Math.round(p.y / EPSILON)}`;
        let index = indices.get(key);
        if (index === undefined) {
            index = points.length;
            indices.set(key, index);
            points.push(p); edges.push(new Map()); contacts.push([]); names.push(new Set());
        }
        return index;
    };
    const segments: { a: number; b: number }[] = [];
    for (const wire of snapshot.wires) {
        for (const segment of wire.segments) {
            if (segment.length !== 4) throw new Error('Expected normalized four-coordinate wire segments.');
            const [x1, y1, x2, y2] = segment;
            const a = node({ x: x1, y: y1 }), b = node({ x: x2, y: y2 });
            if (a === b) continue;
            segments.push({ a, b });
            const name = netName(wire.net);
            if (name) { names[a].add(name); names[b].add(name); }
        }
    }
    snapshot.components.forEach((component, ci) => {
        token(component.designator, 'designator');
        for (const pin of component.pins) {
            const id = node(pin);
            contacts[id].push({ component: ci, ref: `${component.designator}.${token(pin.number, 'pin number')}`, net: netName(pin.net) });
            starts[ci].push(id);
        }
    });
    // Split at existing vertices and pin contacts, including T-junctions/overlaps.
    // Do NOT introduce a vertex at a mere interior/interior crossing, even on the same net.
    for (const segment of segments) {
        const a = points[segment.a], b = points[segment.b];
        const dx = b.x - a.x, dy = b.y - a.y;
        const along: number[] = [];
        for (let index = 0; index < points.length; index++) {
            if (onSegment(points[index], a, b)) along.push(index);
        }
        along.sort((i, j) => (points[i].x - points[j].x) * dx + (points[i].y - points[j].y) * dy);
        for (let i = 1; i < along.length; i++) {
            const u = along[i - 1], v = along[i];
            const length = Math.hypot(points[u].x - points[v].x, points[u].y - points[v].y);
            edges[u].set(v, length); edges[v].set(u, length);
        }
    }
    const visited = new Set<number>(), wires: SchematicGroups['wires'] = [];
    for (let root = 0; root < points.length; root++) {
        if (!edges[root].size || visited.has(root)) continue;
        const queue = [root], pinRefs: string[] = [], pinNames = new Set<string>(), wireNames = new Set<string>();
        visited.add(root);
        for (let head = 0; head < queue.length; head++) {
            const current = queue[head];
            for (const pin of contacts[current]) {
                pinRefs.push(pin.ref);
                if (pin.net) pinNames.add(pin.net);
            }
            for (const name of names[current]) wireNames.add(name);
            for (const next of edges[current].keys()) {
                if (!visited.has(next)) { visited.add(next); queue.push(next); }
            }
        }
        if (pinNames.size > 1) {
            throw new InconsistentSnapshot(`Conflicting resolved nets on a wire path: ${sorted(pinNames).join(', ')}. Refresh the schematic and retry.`);
        }
        // Resolved pin nets take precedence over possibly stale Wire.net metadata.
        const net = pinNames.size ? [...pinNames][0] : wireNames.size === 1 ? [...wireNames][0] : null;
        const pins = sorted(pinRefs);
        if (pins.length > 1) wires.push({ net, pins: pins.join(' ') });
    }
    wires.sort((a, b) => compare(a.pins, b.pins) || compare(a.net ?? '', b.net ?? ''));
    return { points, edges, contacts, starts, wires };
}

/** Tiny min-heap shared by bounded Dijkstra and the merge queue. */
class Heap<T> {
    private items: { priority: number; order: number; value: T }[] = [];
    private order = 0;
    private before(a: typeof this.items[number], b: typeof this.items[number]) {
        return a.priority < b.priority || (a.priority === b.priority && a.order < b.order);
    }
    push(priority: number, value: T) {
        const item = { priority, value, order: this.order++ };
        let i = this.items.length;
        this.items.push(item);
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (!this.before(item, this.items[parent])) break;
            this.items[i] = this.items[parent]; i = parent;
        }
        this.items[i] = item;
    }
    pop() {
        if (!this.items.length) return undefined;
        const result = this.items[0], last = this.items.pop()!;
        if (this.items.length) {
            let i = 0;
            while (2 * i + 1 < this.items.length) {
                let child = 2 * i + 1;
                if (child + 1 < this.items.length && this.before(this.items[child + 1], this.items[child])) child++;
                if (!this.before(this.items[child], last)) break;
                this.items[i] = this.items[child]; i = child;
            }
            this.items[i] = last;
        }
        return result;
    }
}

function bounds(points: Point[]): Box {
    const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const p of points) {
        checkedPoint(p.x, p.y);
        box.minX = Math.min(box.minX, p.x); box.minY = Math.min(box.minY, p.y);
        box.maxX = Math.max(box.maxX, p.x); box.maxY = Math.max(box.maxY, p.y);
    }
    return box;
}
const span = (b: Box) => Math.max(b.maxX - b.minX, b.maxY - b.minY);
const union = (a: Box, b: Box): Box => ({
    minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY),
});
const gap = (a: Box, b: Box) => Math.hypot(
    Math.max(0, a.minX - b.maxX, b.minX - a.maxX),
    Math.max(0, a.minY - b.maxY, b.minY - a.maxY),
);

// Naming roles match backend circuit-layout/{ground,power}.ts. They change weights,
// never electrical identity; keeping this tiny predicate local avoids bundling the backend.
function netRoleWeight(name: string) {
    if (/gnd/i.test(name) || /(^|[_+\-/])GROUND(?:$|[_+\-/])/i.test(name) || /^PGMD$/i.test(name)) return 0.15;
    if (/^BATTERY$/i.test(name) || /^USB_[V\d]/i.test(name)
        || /^V(?:CC|DD|BAT|IN|OUT|REF|REG|PP|SS|EE|BUS|[0-9])/i.test(name)
        || /^[AVDG]?V(?:DD|CC)/i.test(name) || /^[+-]?V[+-]?$/i.test(name)
        || /^[+-]?\d+(?:\.\d+)?V/i.test(name) || /^\d+V\d+$/i.test(name)) return 0.6;
    return 1;
}

function pairScores(components: Component[], boxes: Box[], graph: WireGraph, scale: number) {
    const n = components.length, scores = Array.from({ length: n }, () => new Float64Array(n));
    const nets = components.map(c => new Set(c.pins.map(p => netName(p.net)).filter((s): s is string => s !== null)));
    const owners = new Map<string, Set<string>>();
    nets.forEach((names, ci) => names.forEach(name => {
        const refs = owners.get(name) ?? new Set<string>();
        refs.add(components[ci].designator); owners.set(name, refs);
    }));
    for (let i = 0; i < n; i++) {
        // Multi-source shortest paths start at this component's pins only. No traversal through components.
        const distances = new Float64Array(graph.points.length).fill(Infinity);
        const wireDistances = new Float64Array(n).fill(Infinity), queue = new Heap<number>();
        for (const node of new Set(graph.starts[i])) {
            if (graph.edges[node].size) { distances[node] = 0; queue.push(0, node); }
        }
        for (let item = queue.pop(); item; item = queue.pop()) {
            const node = item.value, distance = item.priority;
            if (distance !== distances[node]) continue;
            for (const contact of graph.contacts[node]) {
                wireDistances[contact.component] = Math.min(wireDistances[contact.component], distance);
            }
            for (const [next, length] of graph.edges[node]) {
                const candidate = distance + length;
                if (candidate <= 10 * scale && candidate < distances[next]) {
                    distances[next] = candidate; queue.push(candidate, next);
                }
            }
        }
        for (let j = i + 1; j < n; j++) {
            const distance = gap(boxes[i], boxes[j]);
            if (distance > 8 * scale) continue;
            let common = 0, role = 0;
            for (const name of nets[i]) {
                if (!nets[j].has(name)) continue;
                const weight = netRoleWeight(name);
                role = Math.max(role, weight);
                common += weight / Math.sqrt(Math.max(1, owners.get(name)!.size - 1));
            }
            const locality = 1 / (1 + (distance / (3 * scale)) ** 2);
            const wire = Number.isFinite(wireDistances[j])
                ? (0.5 + 0.5 * (role || 1)) / (1 + wireDistances[j] / (3 * scale)) : 0;
            scores[i][j] = scores[j][i] = locality * (0.35 + 1.8 * wire + 1.2 * Math.min(1.5, common));
        }
    }
    return scores;
}

function findMaybeBlocks(components: Component[], graph: WireGraph): string[] {
    if (components.length < 2) return [];
    const boxes = components.map(c => bounds([c, ...c.pins]));
    const sizes = boxes.map(span).filter(size => size > EPSILON).sort((a, b) => a - b);
    const scale = Math.max(5, sizes[Math.floor(sizes.length / 2)] ?? 20);
    const scores = pairScores(components, boxes, graph, scale);
    type Cluster = { id: number; members: number[]; box: Box; largest: number };
    const active = new Map<number, Cluster>();
    components.forEach((_, i) => active.set(i, { id: i, members: [i], box: boxes[i], largest: span(boxes[i]) }));
    let nextId = components.length;
    const queue = new Heap<[number, number]>();
    const mergeScore = (a: Cluster, b: Cluster) => {
        const box = union(a.box, b.box), largest = Math.max(a.largest, b.largest);
        if (gap(a.box, b.box) > 8 * scale || span(box) > largest + 10 * scale) return 0;
        // Symmetric mean nearest-link support: unlike max-link, one bridge cannot join two large groups;
        // unlike an all-pairs mean, a connector's directly related peripheral parts are not diluted away.
        const left = new Float64Array(a.members.length), right = new Float64Array(b.members.length);
        a.members.forEach((i, ai) => b.members.forEach((j, bi) => {
            left[ai] = Math.max(left[ai], scores[i][j]); right[bi] = Math.max(right[bi], scores[i][j]);
        }));
        const support = (left.reduce((s, v) => s + v, 0) / left.length + right.reduce((s, v) => s + v, 0) / right.length) / 2;
        const growth = Math.max(0, span(box) - largest - 6 * scale) / (4 * scale);
        return support / (1 + growth * growth);
    };
    const offer = (a: Cluster, b: Cluster) => {
        const score = mergeScore(a, b);
        if (score > JOIN_SCORE) queue.push(-score, [a.id, b.id]);
    };
    const initial = [...active.values()];
    for (let i = 0; i < initial.length; i++) for (let j = i + 1; j < initial.length; j++) offer(initial[i], initial[j]);
    for (let item = queue.pop(); item; item = queue.pop()) {
        const a = active.get(item.value[0]), b = active.get(item.value[1]);
        if (!a || !b) continue; // Discard stale candidates after a merge.
        active.delete(a.id); active.delete(b.id);
        const merged = { id: nextId++, members: [...a.members, ...b.members].sort((i, j) => i - j),
            box: union(a.box, b.box), largest: Math.max(a.largest, b.largest) };
        for (const other of active.values()) offer(other, merged);
        active.set(merged.id, merged);
    }
    // Block membership identifies a symbol section, not its shared physical package.
    // Keep base designators unchanged for netlist lookups, wire pins and net prevalence.
    const refs = components.map(c => c.subPartName
        ? `${c.designator}.${token(c.subPartName, 'sub-part name')}` : c.designator);
    const membership = new Map<string, Set<number>>();
    for (const cluster of active.values()) for (const i of cluster.members) {
        const ref = refs[i], ids = membership.get(ref) ?? new Set<number>();
        ids.add(cluster.id); membership.set(ref, ids);
    }
    return [...active.values()].map(cluster => sorted(cluster.members.map(i => refs[i])
        .filter(ref => membership.get(ref)!.size === 1)))
        .filter(refs => refs.length > 1).map(refs => refs.join(' ')).sort(compare);
}

/** The only runtime entry point. Omit snapshot to read the complete current EasyEDA page. */
export async function getSchematicGroups(snapshot?: SchematicGroupsSnapshot): Promise<SchematicGroups> {
    for (let attempt = 0; ; attempt++) {
        const input = snapshot ?? await collectSnapshot();
        // Stable input order makes both tie-breaking and compact output independent of API enumeration.
        const components = [...input.components].sort((a, b) => compare(a.designator, b.designator) || a.x - b.x || a.y - b.y);
        try {
            const graph = buildWireGraph({ ...input, components });
            return { maybe_blocks: findMaybeBlocks(components, graph), wires: graph.wires };
        } catch (error) {
            if (snapshot || attempt || !(error instanceof InconsistentSnapshot)) throw error;
            // One fresh read for EasyEDA's asynchronous net refresh; never return fabricated connectivity.
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
}
