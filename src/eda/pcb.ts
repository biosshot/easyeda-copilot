import type {
    ExplainPCB,
    ExplainPcbBox,
    ExplainPcbComponent,
    ExplainPcbPadRef,
    ExplainPcbPolygon,
    ExplainPcbVia,
    ExplainPcbWire,
} from "@copilot/shared/types/pcb/explain";

const MIL_TO_MM = 25.4 / 1000;
const SNAP_TOLERANCE_MM = 0.05;
const SNAP_TOLERANCE_MIL = SNAP_TOLERANCE_MM / MIL_TO_MM;
const DIRECT_DISTANCE_MIN_MM = 0.1;
const ROUND_DIGITS = 10000;

type RawPoint = {
    x: number;
    y: number;
};

type RawBox = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
};

type CoordinateContext = {
    origin: RawPoint;
};

type RawComponent = Omit<ExplainPcbComponent, "x" | "y" | "pads"> & {
    x: number;
    y: number;
    pads: ExplainPcbComponent["pads"];
};

type InternalPad = ExplainPcbPadRef & {
    net?: string;
    x: number;
    y: number;
    radius: number;
    hasGeometry: boolean;
};

type TrackSegment = {
    net: string;
    layer: "top" | "bottom";
    start: RawPoint;
    end: RawPoint;
    width: number;
};

type GraphEdge = TrackSegment & {
    a: string;
    b: string;
};

type ViaNode = {
    key: string;
    net: string;
    x: number;
    y: number;
    radius: number;
};

type WireIsland = {
    nodeKeys: Set<string>;
    edges: GraphEdge[];
    viaKeys: Set<string>;
};

type RawPolygon = {
    net: string;
    layer: "top" | "bottom";
    rings: RawPoint[][];
};

type PcbPadLike = Pick<
    IPCB_PrimitivePad,
    "getState_PrimitiveId" | "getState_X" | "getState_Y" | "getState_Net" | "getState_PadNumber" | "getState_Pad"
>;

function round(value: number) {
    return Math.round(value * ROUND_DIGITS) / ROUND_DIGITS;
}

function normalizeRotation(rotation: number) {
    const normalized = rotation % 360;
    return round(normalized < 0 ? normalized + 360 : normalized);
}

function milToMm(value: number) {
    return round(value * MIL_TO_MM);
}

function safeString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function safeNet(value: unknown) {
    return safeString(value);
}

function layerToSide(layer: number | undefined): "top" | "bottom" | undefined {
    if (layer === EPCB_LayerId.TOP) return "top";
    if (layer === EPCB_LayerId.BOTTOM) return "bottom";
    return undefined;
}

function toExplainPoint(point: RawPoint, context: CoordinateContext) {
    return {
        x: round((point.x - context.origin.x) * MIL_TO_MM),
        y: round((context.origin.y - point.y) * MIL_TO_MM),
    };
}

function toExplainBox(box: RawBox, context: CoordinateContext): ExplainPcbBox {
    return {
        left: round((box.minX - context.origin.x) * MIL_TO_MM),
        right: round((box.maxX - context.origin.x) * MIL_TO_MM),
        top: round((context.origin.y - box.minY) * MIL_TO_MM),
        bottom: round((context.origin.y - box.maxY) * MIL_TO_MM),
    };
}

function emptyBox(): RawBox {
    return {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
    };
}

function includePoint(box: RawBox, point: RawPoint, radius = 0) {
    box.minX = Math.min(box.minX, point.x - radius);
    box.minY = Math.min(box.minY, point.y - radius);
    box.maxX = Math.max(box.maxX, point.x + radius);
    box.maxY = Math.max(box.maxY, point.y + radius);
}

function isValidBox(box: RawBox) {
    return Number.isFinite(box.minX) && Number.isFinite(box.minY)
        && Number.isFinite(box.maxX) && Number.isFinite(box.maxY);
}

function boxFromPoints(points: RawPoint[], radius = 0) {
    const box = emptyBox();
    for (const point of points) includePoint(box, point, radius);
    return box;
}

function centerOfBox(box: RawBox): RawPoint {
    return {
        x: (box.minX + box.maxX) / 2,
        y: (box.minY + box.maxY) / 2,
    };
}

function samePoint(a: RawPoint, b: RawPoint, tolerance = SNAP_TOLERANCE_MIL) {
    return distance(a, b) <= tolerance;
}

function distance(a: RawPoint, b: RawPoint) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function distancePointToSegment(point: RawPoint, start: RawPoint, end: RawPoint) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return distance(point, start);

    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / len2));
    return distance(point, {
        x: start.x + t * dx,
        y: start.y + t * dy,
    });
}

function trimClosingPoint(points: RawPoint[]) {
    if (points.length > 1 && samePoint(points[0], points[points.length - 1])) {
        return points.slice(0, -1);
    }

    return points;
}

function normalizeRawPolygon(points: RawPoint[]) {
    const normalized: RawPoint[] = [];
    for (const point of trimClosingPoint(points)) {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
        if (normalized.length && samePoint(normalized[normalized.length - 1], point, 1e-6)) continue;
        normalized.push(point);
    }

    return trimClosingPoint(normalized);
}

function isNumberToken(value: TPCB_PolygonSourceArray[number]): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function readNumber(source: TPCB_PolygonSourceArray, index: number) {
    const value = source[index];
    return typeof value === "number" ? value : undefined;
}

function polygonSourceToPoints(source: TPCB_PolygonSourceArray) {
    const points: RawPoint[] = [];
    let index = 0;

    if (isNumberToken(source[0]) && isNumberToken(source[1])) {
        points.push({ x: source[0], y: source[1] });
        index = 2;
    }

    while (index < source.length) {
        const token = source[index++];
        if (typeof token !== "string") continue;

        if (token === "L") {
            while (isNumberToken(source[index]) && isNumberToken(source[index + 1])) {
                points.push({ x: source[index] as number, y: source[index + 1] as number });
                index += 2;
            }
            continue;
        }

        if (token === "R") {
            const x = readNumber(source, index);
            const y = readNumber(source, index + 1);
            const width = readNumber(source, index + 2);
            const height = readNumber(source, index + 3);
            if (x !== undefined && y !== undefined && width !== undefined && height !== undefined) {
                points.push(
                    { x, y },
                    { x: x + width, y },
                    { x: x + width, y: y + height },
                    { x, y: y + height },
                );
            }
            index += 6;
            continue;
        }

        if (token === "CIRCLE") {
            const cx = readNumber(source, index);
            const cy = readNumber(source, index + 1);
            const radius = readNumber(source, index + 2);
            if (cx !== undefined && cy !== undefined && radius !== undefined) {
                for (let i = 0; i < 24; i++) {
                    const angle = (Math.PI * 2 * i) / 24;
                    points.push({
                        x: cx + Math.cos(angle) * radius,
                        y: cy + Math.sin(angle) * radius,
                    });
                }
            }
            index += 3;
            continue;
        }

        if (token === "ARC" || token === "CARC") {
            while (isNumberToken(source[index]) && isNumberToken(source[index + 1])) {
                const next = source[index + 2];
                points.push({ x: source[index] as number, y: source[index + 1] as number });
                index += 2;
                if (typeof next === "string") break;
            }
            continue;
        }

        if (token === "C") {
            while (isNumberToken(source[index]) && isNumberToken(source[index + 1])) {
                points.push({ x: source[index] as number, y: source[index + 1] as number });
                index += 2;
            }
        }
    }

    return normalizeRawPolygon(points);
}

function complexPolygonToRings(source: TPCB_PolygonSourceArray | Array<TPCB_PolygonSourceArray>) {
    if (!Array.isArray(source[0])) {
        return [polygonSourceToPoints(source as TPCB_PolygonSourceArray)].filter(points => points.length >= 3);
    }

    return (source as Array<TPCB_PolygonSourceArray>)
        .map(polygonSourceToPoints)
        .filter(points => points.length >= 3);
}

function polygonArea(points: RawPoint[]) {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const current = points[i];
        const next = points[(i + 1) % points.length];
        area += current.x * next.y - next.x * current.y;
    }

    return Math.abs(area) / 2;
}

function pointInPolygon(point: RawPoint, polygon: RawPoint[]) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const pi = polygon[i];
        const pj = polygon[j];
        const crosses = (pi.y > point.y) !== (pj.y > point.y)
            && point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x;
        if (crosses) inside = !inside;
    }

    return inside;
}

function padTouchesPolygon(pad: InternalPad, rings: RawPoint[][]) {
    const [outer, ...cutouts] = rings;
    if (!outer) return false;

    if (pointInPolygon(pad, outer) && !cutouts.some(cutout => pointInPolygon(pad, cutout))) {
        return true;
    }

    const tolerance = SNAP_TOLERANCE_MIL + pad.radius;
    return rings.some(ring => {
        return ring.some((start, index) => {
            const end = ring[(index + 1) % ring.length];
            return distancePointToSegment(pad, start, end) <= tolerance;
        });
    });
}

function nodeKey(point: RawPoint) {
    return `${Math.round(point.x / SNAP_TOLERANCE_MIL)},${Math.round(point.y / SNAP_TOLERANCE_MIL)}`;
}

function uniquePadRefs(pads: ExplainPcbPadRef[]) {
    const seen = new Set<string>();
    const unique: ExplainPcbPadRef[] = [];

    for (const pad of pads) {
        const key = `${pad.designator}\0${pad.pad_number}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(pad);
    }

    return unique;
}

function maxIslandNodeDistance(island: WireIsland) {
    const pointByKey = new Map<string, RawPoint>();

    for (const edge of island.edges) {
        pointByKey.set(edge.a, edge.start);
        pointByKey.set(edge.b, edge.end);
    }

    const points = [...pointByKey.values()];
    let maxDistance = 0;

    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            maxDistance = Math.max(maxDistance, distance(points[i], points[j]));
        }
    }

    return maxDistance;
}

function getComponentValue(component: IPCB_PrimitiveComponent) {
    const otherProperty = component.getState_OtherProperty();
    const value = safeString(otherProperty?.Value)
        ?? safeString(component.getState_Name())
        ?? safeString(component.getState_ManufacturerId());

    return value;
}

function padShapeRadius(shape: TPCB_PrimitivePadShape | undefined) {
    if (!shape) return SNAP_TOLERANCE_MIL;

    const shapeType = shape[0];
    if (shapeType === EPCB_PrimitivePadShapeType.POLYLINE_COMPLEX_POLYGON) {
        const rings = complexPolygonToRings(shape[1]);
        const box = boxFromPoints(rings.flat());
        if (!isValidBox(box)) return SNAP_TOLERANCE_MIL;

        return Math.max(box.maxX - box.minX, box.maxY - box.minY) / 2;
    }

    if (shapeType === EPCB_PrimitivePadShapeType.REGULAR_POLYGON) {
        return Math.max(shape[1] / 2, SNAP_TOLERANCE_MIL);
    }

    return Math.max(shape[1] / 2, shape[2] / 2, SNAP_TOLERANCE_MIL);
}

async function getPadsByPrimitiveIds(primitiveIds: string[]) {
    const pads = new Map<string, PcbPadLike>();
    if (!primitiveIds.length) return pads;

    const primitives = await eda.pcb_Primitive.getPrimitivesByPrimitiveId(primitiveIds).catch(() => []);
    for (const primitive of primitives) {
        const candidate = primitive as IPCB_Primitive & Partial<PcbPadLike>;
        if (typeof candidate.getState_PrimitiveId !== "function"
            || typeof candidate.getState_PadNumber !== "function"
            || typeof candidate.getState_X !== "function"
            || typeof candidate.getState_Y !== "function") {
            continue;
        }

        pads.set(candidate.getState_PrimitiveId(), candidate as PcbPadLike);
    }

    return pads;
}

async function getComponentPads(component: IPCB_PrimitiveComponent) {
    const statePads = component.getState_Pads() ?? [];
    const statePadIds = statePads
        .map(pad => safeString(pad.primitiveId))
        .filter((primitiveId): primitiveId is string => Boolean(primitiveId));
    const pinsByPrimitiveId = await getPadsByPrimitiveIds(statePadIds);
    const allPins = await component.getAllPins().catch(() => []);
    const pinsByNumber = new Map<string, PcbPadLike>();

    for (const pin of allPins ?? []) {
        const padNumber = safeString(pin.getState_PadNumber());
        if (padNumber && !pinsByNumber.has(padNumber)) {
            pinsByNumber.set(padNumber, pin);
        }
    }

    const byNumber = new Map<string, {
        pad_number: string;
        signal_name?: string;
        raw?: PcbPadLike;
    }>();

    for (const pad of statePads) {
        const padNumber = safeString(pad.padNumber);
        if (!padNumber) continue;

        const primitiveId = safeString(pad.primitiveId);
        byNumber.set(padNumber, {
            pad_number: padNumber,
            signal_name: safeNet(pad.net),
            raw: primitiveId ? pinsByPrimitiveId.get(primitiveId) ?? pinsByNumber.get(padNumber) : pinsByNumber.get(padNumber),
        });
    }

    for (const pin of allPins ?? []) {
        const padNumber = safeString(pin.getState_PadNumber());
        if (!padNumber || byNumber.has(padNumber)) continue;

        byNumber.set(padNumber, {
            pad_number: padNumber,
            signal_name: safeNet(pin.getState_Net()),
            raw: pin,
        });
    }

    return [...byNumber.values()];
}

async function readComponents() {
    const rawComponents: RawComponent[] = [];
    const pads: InternalPad[] = [];
    const primitives = await eda.pcb_PrimitiveComponent.getAll().catch(() => []);

    for (const primitive of primitives) {
        const designator = safeString(primitive.getState_Designator());
        if (!designator) continue;

        const componentPads = await getComponentPads(primitive);
        const rawComponent: RawComponent = {
            designator,
            part_uuid: safeString(primitive.getState_Component()?.uuid),
            value: getComponentValue(primitive),
            footprint: safeString(primitive.getState_Footprint()?.name),
            x: primitive.getState_X(),
            y: primitive.getState_Y(),
            rotate: normalizeRotation(primitive.getState_Rotation()),
            layer: layerToSide(primitive.getState_Layer()) ?? "top",
            pads: componentPads.map(pad => ({
                pad_number: pad.pad_number,
                signal_name: pad.signal_name,
            })),
        };

        rawComponents.push(rawComponent);

        for (const pad of componentPads) {
            pads.push({
                designator,
                pad_number: pad.pad_number,
                net: pad.signal_name,
                x: pad.raw?.getState_X() ?? primitive.getState_X(),
                y: pad.raw?.getState_Y() ?? primitive.getState_Y(),
                radius: pad.raw ? padShapeRadius(pad.raw.getState_Pad()) : SNAP_TOLERANCE_MIL,
                hasGeometry: Boolean(pad.raw),
            });
        }
    }

    return { rawComponents, pads };
}

function stitchSegments(segments: Array<{ start: RawPoint; end: RawPoint }>) {
    if (!segments.length) return [];

    const unused = [...segments];
    const first = unused.shift()!;
    const points = [first.start, first.end];

    while (unused.length) {
        const tail = points[points.length - 1];
        const nextIndex = unused.findIndex(segment => samePoint(segment.start, tail) || samePoint(segment.end, tail));
        if (nextIndex < 0) break;

        const [next] = unused.splice(nextIndex, 1);
        points.push(samePoint(next.start, tail) ? next.end : next.start);

        if (samePoint(points[0], points[points.length - 1])) break;
    }

    return normalizeRawPolygon(points);
}

async function readBoardPolygon() {
    const polylines = await eda.pcb_PrimitivePolyline.getAll(undefined, EPCB_LayerId.BOARD_OUTLINE).catch(() => []);
    const polylinePolygons = polylines
        .map(polyline => polygonSourceToPoints(polyline.getState_Polygon().getSource()))
        .filter(points => points.length >= 3)
        .sort((a, b) => polygonArea(b) - polygonArea(a));

    if (polylinePolygons[0]) return polylinePolygons[0];

    const lines = await eda.pcb_PrimitiveLine.getAll(undefined, EPCB_LayerId.BOARD_OUTLINE).catch(() => []);
    const segments = lines.map(line => ({
        start: { x: line.getState_StartX(), y: line.getState_StartY() },
        end: { x: line.getState_EndX(), y: line.getState_EndY() },
    }));

    const stitched = stitchSegments(segments);
    return stitched.length >= 3 ? stitched : undefined;
}

async function readTrackSegments() {
    const lines = await eda.pcb_PrimitiveLine.getAll().catch(() => []);
    const segments: TrackSegment[] = [];

    for (const line of lines) {
        const net = safeNet(line.getState_Net());
        const layer = layerToSide(line.getState_Layer());
        if (!net || !layer) continue;

        segments.push({
            net,
            layer,
            start: { x: line.getState_StartX(), y: line.getState_StartY() },
            end: { x: line.getState_EndX(), y: line.getState_EndY() },
            width: line.getState_LineWidth(),
        });
    }

    return segments;
}

async function readVias() {
    const primitiveVias = await eda.pcb_PrimitiveVia.getAll().catch(() => []);
    const vias: ExplainPcbVia[] = [];
    const viaNodes: ViaNode[] = [];

    for (const via of primitiveVias) {
        const net = safeNet(via.getState_Net());
        const diameter = via.getState_Diameter();
        const drill = via.getState_HoleDiameter();
        const x = via.getState_X();
        const y = via.getState_Y();

        vias.push({
            net,
            x,
            y,
            diameter,
            drill,
        });

        if (net) {
            viaNodes.push({
                key: nodeKey({ x, y }),
                net,
                x,
                y,
                radius: diameter / 2,
            });
        }
    }

    const freePads = await eda.pcb_PrimitivePad.getAll().catch(() => []);
    for (const pad of freePads) {
        const asComponentPad = pad as IPCB_PrimitivePad & {
            getState_ParentComponentPrimitiveId?: () => string;
        };
        if (typeof asComponentPad.getState_ParentComponentPrimitiveId === "function") continue;

        const hole = pad.getState_Hole();
        if (!hole) continue;

        const drill = Math.max(...hole.slice(1).filter((value): value is number => typeof value === "number"));
        const padShape = pad.getState_Pad();
        const diameter = padShape
            ? Math.max(...padShape.slice(1).filter((value): value is number => typeof value === "number"))
            : drill;

        vias.push({
            net: safeNet(pad.getState_Net()),
            x: pad.getState_X(),
            y: pad.getState_Y(),
            diameter,
            drill,
        });
    }

    return { vias, viaNodes };
}

function findConnectedIslands(segments: TrackSegment[], viaNodes: ViaNode[]) {
    const graph = new Map<string, Set<string>>();
    const edges: GraphEdge[] = [];

    const ensureNode = (key: string) => {
        if (!graph.has(key)) graph.set(key, new Set());
    };

    for (const segment of segments) {
        const a = nodeKey(segment.start);
        const b = nodeKey(segment.end);
        ensureNode(a);
        ensureNode(b);
        graph.get(a)!.add(b);
        graph.get(b)!.add(a);
        edges.push({ ...segment, a, b });
    }

    for (const via of viaNodes) {
        ensureNode(via.key);
    }

    const visited = new Set<string>();
    const islands: WireIsland[] = [];

    for (const node of graph.keys()) {
        if (visited.has(node)) continue;

        const nodeKeys = new Set<string>();
        const queue = [node];
        visited.add(node);

        while (queue.length) {
            const current = queue.shift()!;
            nodeKeys.add(current);
            for (const next of graph.get(current) ?? []) {
                if (visited.has(next)) continue;
                visited.add(next);
                queue.push(next);
            }
        }

        const islandEdges = edges.filter(edge => nodeKeys.has(edge.a) || nodeKeys.has(edge.b));
        if (!islandEdges.length) continue;

        islands.push({
            nodeKeys,
            edges: islandEdges,
            viaKeys: new Set(viaNodes.filter(via => nodeKeys.has(via.key)).map(via => via.key)),
        });
    }

    return islands;
}

function padTouchesIsland(pad: InternalPad, island: WireIsland) {
    if (island.nodeKeys.has(nodeKey(pad))) return true;

    return island.edges.some(edge => {
        const tolerance = SNAP_TOLERANCE_MIL + edge.width / 2 + pad.radius;
        return distancePointToSegment(pad, edge.start, edge.end) <= tolerance;
    });
}

function createWireFromIsland(net: string, island: WireIsland, pads: InternalPad[], viaNodes: ViaNode[], context: CoordinateContext): ExplainPcbWire | undefined {
    if (!island.edges.length) return undefined;

    const layers = new Set(island.edges.map(edge => edge.layer));
    const vias = viaNodes.filter(via => via.net === net && island.viaKeys.has(via.key));
    const geometryEndpoints = pads
        .filter(pad => pad.net === net && padTouchesIsland(pad, island))
        .map(({ designator, pad_number }) => ({ designator, pad_number }));
    const netEndpoints = pads
        .filter(pad => pad.net === net)
        .map(({ designator, pad_number }) => ({ designator, pad_number }));
    const endpoints = uniquePadRefs([...geometryEndpoints, ...netEndpoints]);

    const length = island.edges.reduce((total, edge) => total + distance(edge.start, edge.end), 0);
    const widths = island.edges.map(edge => edge.width);
    const box = emptyBox();

    for (const edge of island.edges) {
        includePoint(box, edge.start, edge.width / 2);
        includePoint(box, edge.end, edge.width / 2);
    }
    for (const via of vias) includePoint(box, via, via.radius);

    const wire: ExplainPcbWire = {
        net,
        layer: layers.size > 1 || vias.length ? "mixed" : [...layers][0],
        endpoints,
        length: milToMm(length),
        vias: vias.length,
        width: {
            min: milToMm(Math.min(...widths)),
            max: milToMm(Math.max(...widths)),
        },
        segments: island.edges.length,
        bbox: toExplainBox(box, context),
    };

    if (endpoints.length === 2) {
        const directDistance = maxIslandNodeDistance(island) * MIL_TO_MM;
        if (directDistance >= DIRECT_DISTANCE_MIN_MM) {
            wire.directDistance = round(directDistance);
            wire.detourRatio = round((length * MIL_TO_MM) / directDistance);
        }
    }

    return wire;
}

function buildWires(segments: TrackSegment[], viaNodes: ViaNode[], pads: InternalPad[], context: CoordinateContext) {
    const byNet = new Map<string, TrackSegment[]>();
    const viasByNet = new Map<string, ViaNode[]>();

    for (const segment of segments) {
        const list = byNet.get(segment.net) ?? [];
        list.push(segment);
        byNet.set(segment.net, list);
    }

    for (const via of viaNodes) {
        const list = viasByNet.get(via.net) ?? [];
        list.push(via);
        viasByNet.set(via.net, list);
    }

    const wires: ExplainPcbWire[] = [];
    for (const [net, netSegments] of byNet) {
        const netVias = viasByNet.get(net) ?? [];
        const islands = findConnectedIslands(netSegments, netVias);
        for (const island of islands) {
            const wire = createWireFromIsland(net, island, pads, netVias, context);
            if (wire) wires.push(wire);
        }
    }

    return wires;
}

async function readRawPolygons() {
    const polygons: RawPolygon[] = [];

    const addPolygon = (
        net: string | undefined,
        layer: number | undefined,
        source: TPCB_PolygonSourceArray | Array<TPCB_PolygonSourceArray>,
    ) => {
        const safe = safeNet(net);
        const side = layerToSide(layer);
        if (!safe || !side) return;

        const rings = complexPolygonToRings(source);
        if (rings[0]) polygons.push({ net: safe, layer: side, rings });
    };

    const pours = await eda.pcb_PrimitivePour.getAll().catch(() => []);
    for (const pour of pours) {
        addPolygon(pour.getState_Net(), pour.getState_Layer(), pour.getState_ComplexPolygon().getSource());
    }

    const fills = await eda.pcb_PrimitiveFill.getAll().catch(() => []);
    for (const fill of fills) {
        addPolygon(fill.getState_Net(), fill.getState_Layer(), fill.getState_ComplexPolygon().getSource());
    }

    return polygons;
}

function buildPolygons(rawPolygons: RawPolygon[], pads: InternalPad[], context: CoordinateContext) {
    const polygons: ExplainPcbPolygon[] = [];

    for (const polygon of rawPolygons) {
        const sortedRings = [...polygon.rings]
            .filter(ring => ring.length >= 3)
            .sort((a, b) => polygonArea(b) - polygonArea(a));
        const islands: Array<{ outer: RawPoint[]; cutouts: RawPoint[][] }> = [];

        for (const ring of sortedRings) {
            const container = islands.find(island => pointInPolygon(ring[0], island.outer));
            if (container) {
                container.cutouts.push(ring);
            } else {
                islands.push({ outer: ring, cutouts: [] });
            }
        }

        for (const island of islands) {
            const rings = [island.outer, ...island.cutouts];
            const outerArea = polygonArea(island.outer);
            const cutoutArea = island.cutouts.reduce((total, ring) => total + polygonArea(ring), 0);
            const geometryConnects = pads
                .filter(pad => pad.net === polygon.net && padTouchesPolygon(pad, rings))
                .map(({ designator, pad_number }) => ({ designator, pad_number }));
            const connects = uniquePadRefs(geometryConnects.length
                ? geometryConnects
                : pads
                    .filter(pad => pad.net === polygon.net)
                    .map(({ designator, pad_number }) => ({ designator, pad_number })));

            polygons.push({
                net: polygon.net,
                layer: polygon.layer,
                points: island.outer.map(point => toExplainPoint(point, context)),
                cutouts: island.cutouts.length
                    ? island.cutouts.map(ring => ring.map(point => toExplainPoint(point, context)))
                    : undefined,
                area: round((outerArea - cutoutArea) * MIL_TO_MM * MIL_TO_MM),
                bbox: toExplainBox(boxFromPoints(island.outer), context),
                connects,
            });
        }
    }

    return polygons;
}

function transformComponents(rawComponents: RawComponent[], context: CoordinateContext): ExplainPcbComponent[] {
    return rawComponents.map(component => ({
        ...component,
        ...toExplainPoint(component, context),
    }));
}

function transformVias(vias: ExplainPcbVia[], context: CoordinateContext): ExplainPcbVia[] {
    return vias.map(via => ({
        net: via.net,
        ...toExplainPoint(via, context),
        diameter: milToMm(via.diameter),
        drill: milToMm(via.drill),
    }));
}

function createFallbackOrigin(points: RawPoint[]) {
    const box = boxFromPoints(points);
    return isValidBox(box) ? centerOfBox(box) : { x: 0, y: 0 };
}

export async function getPcb(): Promise<ExplainPCB> {
    const docType = await eda.dmt_SelectControl.getCurrentDocumentInfo().then(d => d?.documentType).catch(() => undefined);
    if (docType !== EDMT_EditorDocumentType.PCB) {
        throw new Error("Failed getPcb. Open PCB doc to fix.");
    }

    const [boardPolygon, componentResult, segments, viaResult, rawPolygons] = await Promise.all([
        readBoardPolygon(),
        readComponents(),
        readTrackSegments(),
        readVias(),
        readRawPolygons(),
    ]);

    const fallbackPoints: RawPoint[] = [
        ...(boardPolygon ?? []),
        ...componentResult.rawComponents.map(component => ({ x: component.x, y: component.y })),
        ...componentResult.pads.map(pad => ({ x: pad.x, y: pad.y })),
        ...segments.flatMap(segment => [segment.start, segment.end]),
        ...viaResult.vias.map(via => ({ x: via.x, y: via.y })),
        ...rawPolygons.flatMap(polygon => polygon.rings.flat()),
    ];

    const origin = boardPolygon?.length
        ? centerOfBox(boxFromPoints(boardPolygon))
        : createFallbackOrigin(fallbackPoints);
    const context: CoordinateContext = { origin };

    const wires = buildWires(segments, viaResult.viaNodes, componentResult.pads, context);
    const polygons = buildPolygons(rawPolygons, componentResult.pads, context);

    return {
        board: boardPolygon?.length
            ? { polygon: boardPolygon.map(point => toExplainPoint(point, context)) }
            : undefined,
        components: transformComponents(componentResult.rawComponents, context),
        wires: wires.length ? wires : undefined,
        polygons: polygons.length ? polygons : undefined,
    };
}
