import type {
    ExplainPCB,
    ExplainPcbBox,
    ExplainPcbComponent,
    ExplainPcbPadRef,
    ExplainPcbPolygon,
    ExplainPcbVia,
    ExplainPcbWire,
    SimplifiedDrcViolation,
} from "@copilot/shared/types/pcb/explain";
import { RawPcb, RawPcbArc, RawPcbComponent, RawPcbPad, RawPcbPolygon, RawPcbTrack } from "@copilot/shared/types/pcb/raw";
import { checkPcbDrc } from "./drc";
import { PcbLayerName } from "@copilot/shared/types/pcb/shared";
import { milToMm, mmToMil, round, safeString } from "./utils";

const MIL_TO_MM = 25.4 / 1000;
const SNAP_TOLERANCE_MIL = mmToMil(0.05);
const DIRECT_DISTANCE_MIN_MM = 0.1;

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
    layer: PcbLayerName;
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
    layer: "TOP" | "BOTTOM";
    rings: RawPoint[][];
};

function layerToSide(layer: EPCB_LayerId) {
    if (layer === EPCB_LayerId.TOP) return "TOP";
    if (layer === EPCB_LayerId.BOTTOM) return "BOTTOM";
    return undefined;
}

function toExplainPoint(point: RawPoint) {
    return {
        x: milToMm(point.x),
        y: milToMm(point.y),
    };
}

function toExplainBox(box: RawBox): ExplainPcbBox {
    return {
        left: milToMm(box.minX),
        right: milToMm(box.maxX),
        top: milToMm(box.maxY),
        bottom: milToMm(box.minY),
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
                    { x: x + width, y: y - height },
                    { x, y: y - height },
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
    const pads = new Map<string, IPCB_PrimitivePad>();
    if (!primitiveIds.length) return pads;

    const primitives = await eda.pcb_Primitive.getPrimitivesByPrimitiveId(primitiveIds).catch(() => []);
    for (const primitive of primitives) {
        const candidate = primitive as IPCB_Primitive & Partial<IPCB_PrimitivePad>;
        if (typeof candidate.getState_PrimitiveId !== "function"
            || typeof candidate.getState_PadNumber !== "function"
            || typeof candidate.getState_X !== "function"
            || typeof candidate.getState_Y !== "function") {
            continue;
        }

        pads.set(candidate.getState_PrimitiveId(), candidate as IPCB_PrimitivePad);
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
    const pinsByNumber = new Map<string, IPCB_PrimitivePad>();

    for (const pin of allPins ?? []) {
        const padNumber = safeString(pin.getState_PadNumber());
        if (padNumber && !pinsByNumber.has(padNumber)) {
            pinsByNumber.set(padNumber, pin);
        }
    }

    const byNumber = new Map<string, {
        pad_number: string;
        signal_name?: string;
        raw?: IPCB_PrimitivePad;
    }>();

    for (const pad of statePads) {
        const padNumber = safeString(pad.padNumber);
        if (!padNumber) continue;

        const primitiveId = safeString(pad.primitiveId);
        byNumber.set(padNumber, {
            pad_number: padNumber,
            signal_name: safeString(pad.net),
            raw: primitiveId ? pinsByPrimitiveId.get(primitiveId) ?? pinsByNumber.get(padNumber) : pinsByNumber.get(padNumber),
        });
    }

    for (const pin of allPins ?? []) {
        const padNumber = safeString(pin.getState_PadNumber());
        if (!padNumber || byNumber.has(padNumber)) continue;

        byNumber.set(padNumber, {
            pad_number: padNumber,
            signal_name: safeString(pin.getState_Net()),
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
            x: milToMm(primitive.getState_X()),
            y: milToMm(primitive.getState_Y()),
            rotate: (primitive.getState_Rotation()),
            layer: layerToSide(primitive.getState_Layer()) ?? "TOP",
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

async function readBoardPolygon() {
    const polylines = await eda.pcb_PrimitivePolyline.getAll().catch(() => []);

    const polylinePolygons = polylines
        .filter(poly => poly.getState_Layer() === EPCB_LayerId.BOARD_OUTLINE)
        .map(polyline => polygonSourceToPoints(polyline.getState_Polygon().getSource()))
        .filter(points => points.length >= 3)
        .sort((a, b) => polygonArea(b) - polygonArea(a));

    if (polylinePolygons[0]) return polylinePolygons[0].map(p => toExplainPoint(p));
    return undefined;
}

async function readTrackSegments() {
    const lines = await eda.pcb_PrimitiveLine.getAll().catch(() => []);
    const segments: TrackSegment[] = [];

    for (const line of lines) {
        const net = safeString(line.getState_Net());
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
        const net = safeString(via.getState_Net());
        const diameter = milToMm(via.getState_Diameter());
        const drill = milToMm(via.getState_HoleDiameter());
        const x = milToMm(via.getState_X());
        const y = milToMm(via.getState_Y());

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
            net: safeString(pad.getState_Net()),
            x: milToMm(pad.getState_X()),
            y: milToMm(pad.getState_Y()),
            diameter: milToMm(diameter),
            drill: milToMm(drill),
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

function createWireFromIsland(net: string, island: WireIsland, pads: InternalPad[], viaNodes: ViaNode[]): ExplainPcbWire | undefined {
    if (!island.edges.length) return undefined;

    const layers = new Set(island.edges.map(edge => edge.layer));
    const vias = viaNodes.filter(via => via.net === net && island.viaKeys.has(via.key));
    const geometryEndpoints = pads
        .filter(pad => pad.net === net && padTouchesIsland(pad, island))
        .map(({ designator, pad_number }) => ({ designator, pad_number }));
    const netEndpoints = pads
        .filter(pad => pad.net === net)
        .map(({ designator, pad_number }) => ({ designator, pad_number }));
    const connected_pads = uniquePadRefs([...geometryEndpoints, ...netEndpoints]);

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
        layer: [...layers],
        connected_pads,
        length: milToMm(length),
        vias: vias.length,
        width: {
            min: milToMm(Math.min(...widths)),
            max: milToMm(Math.max(...widths)),
        },
        segments: island.edges.length,
        bbox: toExplainBox(box),
    };

    if (connected_pads.length === 2) {
        const directDistance = maxIslandNodeDistance(island) * MIL_TO_MM;
        if (directDistance >= DIRECT_DISTANCE_MIN_MM) {
            wire.direct_distance = round(directDistance);
            wire.detour_ratio = round((length * MIL_TO_MM) / directDistance);
        }
    }

    return wire;
}

function buildWires(segments: TrackSegment[], viaNodes: ViaNode[], pads: InternalPad[]) {
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
            const wire = createWireFromIsland(net, island, pads, netVias);
            if (wire) wires.push(wire);
        }
    }

    return wires;
}

async function readRawPolygons() {
    const polygons: RawPolygon[] = [];

    const addPolygon = (
        net: string | undefined,
        layer: EPCB_LayerId,
        source: TPCB_PolygonSourceArray | Array<TPCB_PolygonSourceArray>,
    ) => {
        const safe = safeString(net);
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

function buildPolygons(rawPolygons: RawPolygon[], pads: InternalPad[]) {
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
                // points: island.outer.map(point => toExplainPoint(point, context)),
                cutouts: island.cutouts.length
                    ? island.cutouts.map(ring => ring.map(point => toExplainPoint(point)))
                    : undefined,
                area: round((outerArea - cutoutArea) * MIL_TO_MM * MIL_TO_MM),
                bbox: toExplainBox(boxFromPoints(island.outer)),
                connects,
            });
        }
    }

    return polygons;
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

    const wires = buildWires(segments, viaResult.viaNodes, componentResult.pads);
    const polygons = buildPolygons(rawPolygons, componentResult.pads);

    return {
        board: boardPolygon?.length
            ? { polygon: boardPolygon }
            : undefined,
        components: componentResult.rawComponents,
        wires: wires.length ? wires : undefined,
        polygons: polygons.length ? polygons : undefined,
    };
}

function padRefKey(ref: ExplainPcbPadRef) {
    return `${ref.designator}\0${ref.pad_number}`;
}

export async function inspectNet(pcb: ExplainPCB, netName: string, drcLimit: number): Promise<ExplainPcbWire[]> {
    const wires = pcb.wires?.filter(wire => wire.net === netName) ?? [];
    if (!wires.length) return [];

    const drcResult = await checkPcbDrc(drcLimit);
    const netInSuffix = `(${netName})`;
    const netViolations = drcResult.flatMap(category =>
        category.list.flatMap(group => group.list.filter(violation => {
            return violation.obj1?.includes(netInSuffix) || violation.obj2?.includes(netInSuffix);
        }))
    );

    const padToWireIndices = new Map<string, number[]>();
    wires.forEach((wire, index) => {
        for (const pad of wire.connected_pads) {
            const key = padRefKey(pad);
            const list = padToWireIndices.get(key) ?? [];
            list.push(index);
            padToWireIndices.set(key, list);
        }
    });

    function parsePadRefFromSuffix(suffix: string | undefined): ExplainPcbPadRef | undefined {
        if (!suffix) return undefined;
        const lastDash = suffix.lastIndexOf('-');
        if (lastDash <= 0 || lastDash === suffix.length - 1) return undefined;
        const designator = suffix.slice(0, lastDash);
        const padNumber = suffix.slice(lastDash + 1);
        if (!designator || !padNumber) return undefined;
        return { designator, pad_number: padNumber };
    }

    const result: ExplainPcbWire[] = wires.map(wire => ({ ...wire, drc_violations: [] }));
    const unmatched: SimplifiedDrcViolation[] = [];

    for (const violation of netViolations) {
        const refs = [
            parsePadRefFromSuffix(violation.obj1),
            parsePadRefFromSuffix(violation.obj2),
        ].filter((ref): ref is ExplainPcbPadRef => Boolean(ref));
        const targetIndices = new Set<number>();
        for (const ref of refs) {
            for (const index of padToWireIndices.get(padRefKey(ref)) ?? []) {
                targetIndices.add(index);
            }
        }
        if (targetIndices.size) {
            for (const index of targetIndices) {
                result[index].drc_violations!.push(violation);
            }
        } else {
            unmatched.push(violation);
        }
    }

    if (unmatched.length) {
        for (const wire of result) {
            wire.drc_violations!.push(...unmatched);
        }
    }

    for (const wire of result) {
        if (!wire.drc_violations?.length) {
            delete (wire as Partial<ExplainPcbWire>).drc_violations;
        }
    }

    return result;
}

export async function inspectComponent(pcb: ExplainPCB, designator: string, radius: number): Promise<ExplainPcbComponent> {
    const target = pcb.components.find(component => component.designator === designator);
    if (!target) throw new Error(`Component not found: ${designator}`);

    const radiusSquared = radius * radius;
    const nearest = pcb.components
        .filter(component => component.designator !== designator)
        .map(component => {
            const dx = component.x - target.x;
            const dy = component.y - target.y;
            return {
                component,
                distanceSquared: dx * dx + dy * dy,
            };
        })
        .filter(item => item.distanceSquared <= radiusSquared)
        .sort((a, b) => a.distanceSquared - b.distanceSquared)
        .map(item => ({
            designator: item.component.designator,
            distance: round(Math.sqrt(item.distanceSquared)),
            x: item.component.x,
            y: item.component.y,
            layer: item.component.layer,
        }));

    return {
        ...target,
        nearest_components: nearest,
    };
}

function rawLayerName(raw: number | string): PcbLayerName {
    if (typeof raw === 'string') return raw as PcbLayerName;
    return EPCB_LayerId[raw] as PcbLayerName;
}

function toMmCopperGrid(value: number) {
    return round(value * 0.254);
}

function convertSourceArray(source: TPCB_PolygonSourceArray, coordConv: (v: number) => number): (number | string)[] {
    const out: (number | string)[] = [];
    let i = 0;

    if (typeof source[0] === 'number' && typeof source[1] === 'number') {
        out.push(coordConv(source[0]), coordConv(source[1]));
        i = 2;
    }

    while (i < source.length) {
        const token = source[i];
        if (typeof token !== 'string') {
            out.push(token);
            i++;
            continue;
        }

        const cmd = token as string | number;
        out.push(cmd);
        i++;

        if (cmd === 'M') {
            if (i + 1 < source.length && typeof source[i] === 'number') {
                out.push(coordConv(source[i] as number), coordConv(source[i + 1] as number));
                i += 2;
            }
        } else if (cmd === 'L' || cmd === 'C' || cmd === 'Q') {
            while (i + 1 < source.length && typeof source[i] === 'number') {
                out.push(coordConv(source[i] as number), coordConv(source[i + 1] as number));
                i += 2;
            }
        } else if (cmd === 'Z') {
            // no args
        } else if (cmd === 'R') {
            const x = source[i], y = source[i + 1], w = source[i + 2], h = source[i + 3], rot = source[i + 4], round = source[i + 5];
            out.push(
                typeof x === 'number' ? coordConv(x) : x,
                typeof y === 'number' ? coordConv(y) : y,
                typeof w === 'number' ? coordConv(w) : w,
                typeof h === 'number' ? coordConv(h) : h,
                rot,
                typeof round === 'number' ? coordConv(round) : round,
            );
            i += 6;
        } else if (cmd === 'CIRCLE') {
            const cx = source[i], cy = source[i + 1], r = source[i + 2];
            out.push(
                typeof cx === 'number' ? coordConv(cx) : cx,
                typeof cy === 'number' ? coordConv(cy) : cy,
                typeof r === 'number' ? coordConv(r) : r,
            );
            i += 3;
        } else if (cmd === 'ARC' || cmd === 'CARC') {
            const angle = source[i], ex = source[i + 1], ey = source[i + 2];
            out.push(angle, typeof ex === 'number' ? coordConv(ex) : ex, typeof ey === 'number' ? coordConv(ey) : ey);
            i += 3;
        } else {
            while (i < source.length && typeof source[i] === 'number') {
                out.push(source[i]);
                i++;
            }
        }
    }

    return out;
}

function rawSourcesFromComplex(
    complex: TPCB_PolygonSourceArray | Array<TPCB_PolygonSourceArray>,
    coordConv: (v: number) => number,
): (number | string)[][] {
    if (!complex) return [];
    if (Array.isArray(complex[0])) {
        return (complex as Array<TPCB_PolygonSourceArray>).map(src => convertSourceArray(src, coordConv));
    }
    return [convertSourceArray(complex as TPCB_PolygonSourceArray, coordConv)];
}

export async function getPcbRaw(): Promise<RawPcb> {
    const boardPolygon = await readBoardPolygon();
    if (!boardPolygon) throw new Error('Board outline is missing.')

    const components: RawPcbComponent[] = []
    for (const c of await eda.pcb_PrimitiveComponent.getAll().catch(() => [])) {
        components.push({
            designator: c.getState_Designator() || '',
            x: milToMm(c.getState_X()),
            y: milToMm(c.getState_Y()),
            rotate: c.getState_Rotation(),
            layer: rawLayerName(c.getState_Layer()),
        });
    }

    const pads: RawPcbPad[] = []
    for (const p of await eda.pcb_PrimitivePad.getAll().catch(() => [])) {
        const shape = p.getState_Pad();
        pads.push({
            x: milToMm(p.getState_X()),
            y: milToMm(p.getState_Y()),
            net: safeString(p.getState_Net()) ?? '',
            padNumber: p.getState_PadNumber(),
            layer: rawLayerName(p.getState_Layer()),
            shapeType: shape ? String(shape[0]) : undefined,
            width: shape && typeof shape[1] === 'number' ? milToMm(shape[1]) : undefined,
            height: shape && typeof shape[2] === 'number' ? milToMm(shape[2]) : undefined,
            rotation: p.getState_Rotation(),
        });
    }

    const tracks: RawPcbTrack[] = [];
    for (const l of await eda.pcb_PrimitiveLine.getAll().catch(() => [])) {
        tracks.push({
            x1: milToMm(l.getState_StartX()),
            y1: milToMm(l.getState_StartY()),
            x2: milToMm(l.getState_EndX()),
            y2: milToMm(l.getState_EndY()),
            width: milToMm(l.getState_LineWidth()),
            layer: rawLayerName(l.getState_Layer()),
            net: safeString(l.getState_Net()) ?? '',
        });
    }

    const arcs: RawPcbArc[] = [];
    for (const a of await eda.pcb_PrimitiveArc.getAll().catch(() => [])) {
        arcs.push({
            x1: milToMm(a.getState_StartX()),
            y1: milToMm(a.getState_StartY()),
            x2: milToMm(a.getState_EndX()),
            y2: milToMm(a.getState_EndY()),
            arcAngle: a.getState_ArcAngle(),
            width: milToMm(a.getState_LineWidth()),
            layer: rawLayerName(a.getState_Layer()),
            net: safeString(a.getState_Net()) ?? '',
        });
    }

    const vias = await readVias().then(r => r.vias);

    const pours = await eda.pcb_PrimitivePour.getAll().catch(() => []);
    const pourById = new Map(pours.map(p => [p.getState_PrimitiveId(), p]));

    const poureds = await eda.pcb_PrimitivePoured.getAll().catch(() => []);

    const polygons: RawPcbPolygon[] = []

    for (const poured of poureds) {
        const pour = pourById.get(poured.getState_PourPrimitiveId());
        const net = pour ? safeString(pour.getState_Net()) ?? '' : '';
        const layer = pour ? rawLayerName(pour.getState_Layer()) : 'TOP';

        for (const fill of poured.getState_PourFills()) {
            const path = fill.path;
            const src = typeof path.getSourceStrictComplex === 'function'
                ? path.getSourceStrictComplex()
                : path.getSource();
            const sources = rawSourcesFromComplex(src, toMmCopperGrid);
            if (sources.length) {
                polygons.push({
                    net,
                    layer,
                    fill: fill.fill,
                    lineWidth: toMmCopperGrid(fill.lineWidth),
                    sources,
                });
            }
        }
    }

    const fills = await eda.pcb_PrimitiveFill.getAll().catch(() => []);
    for (const f of fills) {
        const src = f.getState_ComplexPolygon().getSource();
        const sources = rawSourcesFromComplex(src, milToMm);
        if (sources.length) {
            polygons.push({
                net: safeString(f.getState_Net()) ?? '',
                layer: rawLayerName(f.getState_Layer()),
                fill: true,
                lineWidth: 0,
                sources,
            });
        }
    }

    return {
        board: boardPolygon?.length
            ? { polygon: boardPolygon }
            : undefined,
        arcs,
        components,
        pads,
        polygons,
        tracks,
        vias
    };
}