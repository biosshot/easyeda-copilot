import type { SchematicGroups } from '@copilot/shared/types/schematic-groups';
import { shortSymbolsMap } from './types';

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
    const name = typeof value === 'string' ? value.trim() : '';
    return name && !/^(?:NC|N\/C)$/i.test(name) ? name : null;
};

class InconsistentSnapshot extends Error { }

function token(value: string, kind: string) {
    if (!value || /\s/.test(value)) throw new Error(`Schematic groups: invalid ${kind}: ${JSON.stringify(value)}`);
    return value;
}

function checkedPoint(x: number, y: number): Point {
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Schematic groups: non-finite coordinate.');
    return { x: Math.round(x / EPSILON) * EPSILON, y: Math.round(y / EPSILON) * EPSILON };
}

// A suffix is a display hint, not proof of multipart: even a single-part resistor may end in .1.
function getPartSuffix(name?: string): string | undefined {
    if (typeof name !== 'string') return undefined;
    const dot = name.lastIndexOf('.');
    if (dot < 0) return undefined;
    const suffix = name.slice(dot + 1);
    return suffix && !/[^A-Za-z0-9]/.test(suffix) ? suffix : undefined;
}

type Report = (message: string, cause?: unknown) => void;
function boundedDiagnostics(messages: Iterable<string>) {
    const entries = [...new Set(messages)];
    const errors = (entries.length > 10 ? entries.slice(0, 9) : entries)
        .map(message => message.replace(/\s+/g, ' ').slice(0, 200));
    if (entries.length > 10) errors.push(`${entries.length - 9} additional errors; see editor log.`);
    return errors;
}

function diagnostics() {
    const messages = new Set<string>();
    const report: Report = (message, cause) => {
        if (messages.has(message)) return;
        messages.add(message);
        try {
            if (typeof eda !== 'undefined') eda.sys_Log.add(
                `[schematic-groups] ${message}${cause ? ` ${cause instanceof Error ? cause.stack ?? cause.message : String(cause)}` : ''}`,
                ESYS_LogType.WARNING,
            );
        } catch { /* Logging must not discard a partial result. */ }
    };
    return {
        report, result: (): Pick<SchematicGroups, 'errors'> => {
            if (!messages.size) return {};
            return { errors: boundedDiagnostics(messages) };
        }
    };
}

/** Concatenate page-local results without inventing cross-page groups or wire islands. */
export function mergeSchematicGroups(pages: readonly SchematicGroups[]): SchematicGroups {
    const result: SchematicGroups = {
        maybe_blocks: pages.flatMap(page => page.maybe_blocks),
        wires: pages.flatMap(page => page.wires),
    };
    const errors = boundedDiagnostics(pages.flatMap(page => page.errors ?? []));
    return errors.length ? { ...result, errors } : result;
}

async function collectSnapshot(report: Report): Promise<SchematicGroupsSnapshot> {
    const document = await eda.dmt_SelectControl.getCurrentDocumentInfo();
    if (document?.documentType !== EDMT_EditorDocumentType.SCHEMATIC_PAGE) {
        throw new Error('Open a schematic page before requesting schematic groups.');
    }
    // Lazy imports keep the deterministic analysis usable without the editor globals.
    const { getSchematic } = await import('./schematic');
    const { normalizeWireLine, normWireY } = await import('./utils');
    // No usable component list means no trustworthy page context: this read remains fatal.
    const primitives = (await eda.sch_PrimitiveComponent.getAll()).filter((component, i) => {
        try { return component.getState_ComponentType() === ESCH_PrimitiveComponentType.COMPONENT; }
        catch (error) { report(`Component ${i + 1}: unreadable type; component omitted.`, error); return false; }
    });
    const nets = new Map<string, string | null>();
    let netlistAvailable = false;
    try {
        // Reuse resolved-netlist reading, never fetch library metadata to interpret a suffix.
        const circuit = primitives.length ? await getSchematic(primitives.map(p => p.getState_PrimitiveId()), {
            disableExtractPartUuid: true, disableExtractPos: true,
        }) : { components: [] };
        for (const component of circuit.components) for (const pin of component.pins) {
            nets.set(`${component.designator}.${pin.pin_number}`, netName(pin.signal_name));
        }
        netlistAvailable = true;
    } catch (error) {
        nets.clear();
        report('Netlist unavailable; common-net evidence disabled, wire names use available metadata.', error);
    }
    const components: Component[] = [];
    // Read-only, bounded batches; a failed component/pin must not reject the other reads.
    for (let start = 0; start < primitives.length; start += 16) {
        const batch = await Promise.all(primitives.slice(start, start + 16).map(async (primitive, i) => {
            let designator = `Component ${start + i + 1}`;
            try {
                designator = token(primitive.getState_Designator().trim(), 'designator');
                let subPartName: string | undefined;
                try { subPartName = primitive.getState_SubPartName() || undefined; }
                catch (error) { report(`${designator}: part name unavailable; using base reference.`, error); }
                let position = { x: NaN, y: NaN };
                try { position = { x: primitive.getState_X(), y: normWireY(primitive.getState_Y()) }; }
                catch (error) { report(`${designator}: origin unavailable; using valid pins if possible.`, error); }
                const pins: Pin[] = [];
                try {
                    const rawPins = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(primitive.getState_PrimitiveId());
                    if (!Array.isArray(rawPins)) throw new Error('Invalid pin list.');
                    for (const pin of rawPins) {
                        try {
                            const number = token(String(pin.getState_PinNumber() ?? ''), 'pin number');
                            const ref = `${designator}.${number}`;
                            if (netlistAvailable && !nets.has(ref)) report(`${designator}: some pin nets unavailable; common-net evidence incomplete.`);
                            pins.push({ number, net: nets.get(ref) ?? null, x: pin.getState_X(), y: pin.getState_Y() });
                        } catch (error) { report(`${designator}: unreadable pin omitted; wires may be incomplete.`, error); }
                    }
                } catch (error) { report(`${designator}: pins unavailable; keeping position only, connections omitted.`, error); }
                return { designator, subPartName, ...position, pins };
            } catch (error) {
                report(`${designator}: component unreadable; omitted from groups and pins.`, error);
                return undefined;
            }
        }));
        components.push(...batch.filter((c): c is NonNullable<typeof c> => c !== undefined));
    }
    const wires: SchematicGroupsSnapshot['wires'] = [];
    try {
        // Fresh editor read, not the assembly-only wire-snap cache.
        const rawWires = await eda.sch_PrimitiveWire.getAll();
        for (const [i, wire] of rawWires.entries()) {
            try {
                const raw = wire.getState_Line();
                if (!Array.isArray(raw)) throw new Error('Missing wire geometry.');
                const segments = normalizeWireLine(raw);
                if (!segments.length && raw?.length) throw new Error('Unsupported wire geometry.');
                if (Array.isArray(raw?.[0]) && segments.length !== raw.length) {
                    report(`Wire ${i + 1}: invalid segments omitted; wire groups may be incomplete.`);
                }
                let net: string | null = null;
                try { net = netName(wire.getState_Net()); }
                catch (error) { report(`Wire ${i + 1}: name unavailable; using pin nets if known.`, error); }
                wires.push({ net, segments });
            } catch (error) { report(`Wire ${i + 1}: unreadable geometry omitted; wire groups may be incomplete.`, error); }
        }
    } catch (error) { report('Wires unavailable; direct-wire evidence disabled and wires is incomplete.', error); }
    const current = await eda.dmt_SelectControl.getCurrentDocumentInfo();
    if (current?.uuid !== document.uuid || current?.tabId !== document.tabId
        || current?.documentType !== document.documentType) {
        throw new Error('Schematic page changed while reading groups; retry on the intended page.');
    }
    return { components, wires };
}

// Validate locally before graph construction, for both live reads and offline fixtures.
function prepareSnapshot(input: SchematicGroupsSnapshot, report: Report): SchematicGroupsSnapshot {
    const candidates: Component[] = [];
    for (const [i, c] of input.components.entries()) {
        try {
            token(c.designator, 'designator');
            const pins: Pin[] = [];
            if (!Array.isArray(c.pins)) report(`${c.designator}: pins unavailable; keeping position only, connections omitted.`);
            for (const pin of Array.isArray(c.pins) ? c.pins : []) {
                try { pins.push({ ...pin, number: token(pin.number, 'pin number'), ...checkedPoint(pin.x, pin.y) }); }
                catch (error) { report(`${c.designator}: invalid pin omitted; wires may be incomplete.`, error); }
            }
            let position: Point;
            try { position = checkedPoint(c.x, c.y); }
            catch (error) {
                if (!pins.length) throw error;
                position = { x: pins[0].x, y: pins[0].y };
                report(`${c.designator}: invalid origin; grouping uses valid pin coordinates.`, error);
            }
            candidates.push({ ...c, ...position, pins });
        } catch (error) { report(`Component ${i + 1}: invalid identity/geometry; omitted from groups and pins.`, error); }
    }
    const identity = (c: Component) => JSON.stringify([c.designator, c.subPartName ?? '']);
    const counts = new Map<string, number>();
    for (const c of candidates) counts.set(identity(c), (counts.get(identity(c)) ?? 0) + 1);
    const components = candidates.filter(c => {
        if (counts.get(identity(c)) === 1) return true;
        report(`${c.designator}: duplicate component/section identity; ambiguous instances omitted from groups and pins.`);
        return false;
    });
    const wires = input.wires.map((wire, i) => {
        if (!Array.isArray(wire.segments)) {
            report(`Wire ${i + 1}: unreadable geometry omitted; wire groups may be incomplete.`);
            return { ...wire, segments: [] };
        }
        return {
            ...wire, segments: wire.segments.filter(segment => {
                try {
                    if (segment.length !== 4) throw new Error('Expected four-coordinate wire segment.');
                    checkedPoint(segment[0], segment[1]); checkedPoint(segment[2], segment[3]);
                    return true;
                } catch (error) {
                    report(`Wire ${i + 1}: invalid segments omitted; wire groups may be incomplete.`, error);
                    return false;
                }
            })
        };
    });
    return { components, wires };
}

function onSegment(p: Point, a: Point, b: Point) {
    const dx = b.x - a.x, dy = b.y - a.y;
    return p.x >= Math.min(a.x, b.x) - EPSILON && p.x <= Math.max(a.x, b.x) + EPSILON
        && p.y >= Math.min(a.y, b.y) - EPSILON && p.y <= Math.max(a.y, b.y) + EPSILON
        && Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) <= EPSILON * Math.hypot(dx, dy);
}

function buildWireGraph(snapshot: SchematicGroupsSnapshot, report: Report, retryConflicts = false): WireGraph {
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
            if (retryConflicts) throw new InconsistentSnapshot('Resolved nets need a fresh read.');
            report(`Conflicting resolved nets (${sorted(pinNames).join(', ')}); affected wire path omitted, wires is incomplete.`);
            // A disputed path must not reappear as direct-wire evidence in the block score.
            for (const id of queue) edges[id].clear();
            continue;
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
    if (shortSymbolsMap.GND.is(name)) return 0.15;
    if (shortSymbolsMap.VCC.is(name)) return 0.6;
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

function findMaybeBlocks(components: Component[], graph: WireGraph, report: Report): string[] {
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
        const merged = {
            id: nextId++, members: [...a.members, ...b.members].sort((i, j) => i - j),
            box: union(a.box, b.box), largest: Math.max(a.largest, b.largest)
        };
        for (const other of active.values()) offer(other, merged);
        active.set(merged.id, merged);
    }
    // Block membership identifies a symbol section, not its shared physical package.
    // Keep base designators unchanged for netlist lookups, wire pins and net prevalence.
    const partCounts = new Map<string, number>();

    for (const c of components) {
        partCounts.set(c.designator, (partCounts.get(c.designator) ?? 0) + 1);
    }

    const refs = components.map(c => {
        const suffix = getPartSuffix(c.subPartName);
        const hasSeveralParts = (partCounts.get(c.designator) ?? 0) > 1;

        if (!suffix || (suffix === '1' && !hasSeveralParts)) {
            return c.designator;
        }

        return c.designator.endsWith(`.${suffix}`)
            ? c.designator
            : `${c.designator}.${suffix}`;
    });
    const membership = new Map<string, Set<number>>();
    for (const cluster of active.values()) for (const i of cluster.members) {
        const ref = refs[i], ids = membership.get(ref) ?? new Set<number>();
        ids.add(cluster.id); membership.set(ref, ids);
    }
    for (const [ref, ids] of membership) if (ids.size > 1) {
        report(`${ref}: ambiguous block reference; omitted from maybe_blocks.`);
    }
    return [...active.values()].map(cluster => sorted(cluster.members.map(i => refs[i])
        .filter(ref => membership.get(ref)!.size === 1)))
        .filter(refs => refs.length > 1).map(refs => refs.join(' ')).sort(compare);
}

/** The only runtime entry point. Omit snapshot to read the complete current EasyEDA page. */
export async function getSchematicGroups(snapshot?: SchematicGroupsSnapshot): Promise<SchematicGroups> {
    for (let attempt = 0; ; attempt++) {
        const issues = diagnostics();
        const input = prepareSnapshot(snapshot ?? await collectSnapshot(issues.report), issues.report);
        // Stable input order makes both tie-breaking and compact output independent of API enumeration.
        const components = [...input.components].sort((a, b) => compare(a.designator, b.designator) || a.x - b.x || a.y - b.y);
        try {
            const graph = buildWireGraph({ ...input, components }, issues.report, !snapshot && attempt === 0);
            let maybe_blocks: string[] = [];
            try { maybe_blocks = findMaybeBlocks(components, graph, issues.report); }
            catch (error) { issues.report('Block grouping failed; maybe_blocks unavailable, wire results preserved.', error); }
            return {
                maybe_blocks,
                wires: graph.wires.filter(wire => wire.net === null || !shortSymbolsMap.GND.is(wire.net)),
                ...issues.result(),
            };
        } catch (error) {
            if (!(error instanceof InconsistentSnapshot)) throw error;
            // One fresh read for asynchronous nets, then omit only the disputed paths.
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
}
