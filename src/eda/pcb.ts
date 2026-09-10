import type {
    ExplainPCB,
    ExplainPcbBox,
    ExplainPcbComponent,
    InspectPcbNet,
    ExplainPcbPolygon,
    ExplainPcbVia,
    ExplainPcbWire,
} from "@copilot/shared/types/pcb/explain";
import { RawPcb, RawPcbArc, RawPcbComponent, RawPcbPad, RawPcbPolygon, RawPcbTrack } from "@copilot/shared/types/pcb/raw";
import { checkPcbNetDrc } from "./drc";
import { PcbLayerName } from "@copilot/shared/types/pcb/shared";
import { milToMm, mmToMil, round, safeString, VERSION_EDASYEDA } from "./utils";
import { easyEdaPointToPlacement, easyEdaRotationToPlacement } from "./pcb-existing-placement";

const MIL_TO_MM = 25.4 / 1000;
const SNAP_TOLERANCE_MIL = mmToMil(0.05);

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

// Measurements only: no spatial connectivity or pad-contact inference.
type CopperMeasure = {
    net: string;
    layer: PcbLayerName;
    kind: 'track' | 'via';
    length: number;
    width?: number;
    bounds: RawBox;
};

type RawPolygon = {
    net: string;
    layer: PcbLayerName;
    rings: RawPoint[][];
};


function layerToSide(layer: EPCB_LayerId) {
    if (layer === EPCB_LayerId.TOP) return "TOP";
    if (layer === EPCB_LayerId.BOTTOM) return "BOTTOM";
    return undefined;
}

function isCopperLayer(layer: PcbLayerName) {
    return layer === "TOP" || layer === "BOTTOM" || layer.startsWith("INNER_");
}

function toExplainPoint(point: RawPoint) {
    return {
        x: round(milToMm(point.x), 10),
        y: round(milToMm(point.y), 10),
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

function getComponentValue(component: IPCB_PrimitiveComponent) {
    const otherProperty = component.getState_OtherProperty();
    const value = safeString(otherProperty?.Value)
        ?? safeString(component.getState_Name())
        ?? safeString(component.getState_ManufacturerId());

    return value;
}

async function readComponents() {
    const rawComponents: ExplainPcbComponent[] = [];
    const ownedIds = new Set<string>();
    for (const component of await eda.pcb_PrimitiveComponent.getAll()) {
        const statePads = component.getState_Pads() ?? [];
        const pads = statePads.map(pad => ({ pad: safeString(pad.padNumber), net: safeString(pad.net) }));
        // State pad IDs can be footprint-local; getAllPins supplies actual board IDs.
        // Read ownership and missing membership metadata, never pad shapes or contacts.
        for (const pin of await component.getAllPins()) {
            ownedIds.add(pin.getState_PrimitiveId());
            if (!statePads.length || statePads.some(pad => !pad.primitiveId)) {
                pads.push({ pad: safeString(pin.getState_PadNumber()), net: safeString(pin.getState_Net()) });
            }
        }
        const designator = safeString(component.getState_Designator());
        if (!designator) continue;
        const membership = new Map<string, { pad: string; net: string }>();
        for (const pad of pads) {
            if (pad.pad && pad.net) membership.set(JSON.stringify([pad.pad, pad.net]), { pad: pad.pad, net: pad.net });
        }
        rawComponents.push({
            designator,
            value: getComponentValue(component),
            footprint: safeString(component.getState_Footprint()?.name),
            x: round(milToMm(component.getState_X()), 10),
            y: round(milToMm(component.getState_Y()), 10),
            layer: layerToSide(component.getState_Layer()) ?? 'TOP',
            pads: [...membership.values()],
        });
    }
    const standalonePads: NonNullable<ExplainPCB['standalone_pads']> = [];
    for (const pad of await eda.pcb_PrimitivePad.getAll()) {
        const id = pad.getState_PrimitiveId();
        if (ownedIds.has(id)) continue;
        const layer = rawLayerName(pad.getState_Layer());
        if (!isCopperLayer(layer) && layer !== 'MULTI') continue;
        standalonePads.push({ ref: 'pad:' + id, net: safeString(pad.getState_Net()), layer,
            x: milToMm(pad.getState_X()), y: milToMm(pad.getState_Y()) });
    }
    return { rawComponents, standalonePads };
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

export async function getPcbExistingPlacement() {
    const document = await eda.dmt_SelectControl.getCurrentDocumentInfo().catch(() => undefined);
    if (document?.documentType !== EDMT_EditorDocumentType.PCB) return undefined;

    const [boardPolygon, primitives] = await Promise.all([
        readBoardPolygon(),
        eda.pcb_PrimitiveComponent.getAll(),
    ]);
    if (!boardPolygon?.length) return undefined;

    const left = Math.min(...boardPolygon.map(point => point.x));
    const right = Math.max(...boardPolygon.map(point => point.x));
    const top = Math.min(...boardPolygon.map(point => point.y));
    const bottom = Math.max(...boardPolygon.map(point => point.y));
    const origin = {
        x: (left + right) / 2,
        y: (top + bottom) / 2,
    };
    const normalizeAngle = (angle: number) => ((angle % 360) + 360) % 360;

    return {
        board: {
            polygon: boardPolygon.map(point => easyEdaPointToPlacement(point, origin)),
        },
        components: primitives.flatMap(primitive => {
            const designator = primitive.getState_Designator()?.trim();
            const layer = primitive.getState_Layer();
            if (!designator || (layer !== EPCB_LayerId.TOP && layer !== EPCB_LayerId.BOTTOM)) return [];

            const position = easyEdaPointToPlacement({
                x: milToMm(primitive.getState_X()),
                y: milToMm(primitive.getState_Y()),
            }, origin);
            const placementLayer = layer === EPCB_LayerId.BOTTOM ? 'bottom' as const : 'top' as const;
            return [{
                designator,
                ...position,
                rotate: easyEdaRotationToPlacement(normalizeAngle(primitive.getState_Rotation()), placementLayer),
                layer: placementLayer,
            }];
        }),
    };
}

async function readTrackSegments() {
    const measures: CopperMeasure[] = [];
    for (const line of await eda.pcb_PrimitiveLine.getAll()) {
        const net = safeString(line.getState_Net());
        const layer = rawLayerName(line.getState_Layer());
        if (!net || !isCopperLayer(layer)) continue;
        const start = { x: line.getState_StartX(), y: line.getState_StartY() };
        const end = { x: line.getState_EndX(), y: line.getState_EndY() };
        const width = line.getState_LineWidth();
        measures.push({ net, layer, kind: 'track', length: distance(start, end), width,
            bounds: boxFromPoints([start, end], width / 2) });
    }
    for (const arc of await eda.pcb_PrimitiveArc.getAll()) {
        const net = safeString(arc.getState_Net());
        const layer = rawLayerName(arc.getState_Layer());
        if (!net || !isCopperLayer(layer)) continue;
        const start = { x: arc.getState_StartX(), y: arc.getState_StartY() };
        const end = { x: arc.getState_EndX(), y: arc.getState_EndY() };
        const angle = arc.getState_ArcAngle() * Math.PI / 180;
        const width = arc.getState_LineWidth();
        const chord = distance(start, end);
        const points = [start, end];
        let length = chord;
        if (Math.abs(angle) > 1e-9) {
            if (!chord || Math.abs(angle) >= 2 * Math.PI) throw new Error('Cannot measure a PCB arc with invalid endpoints or angle');
            const radius = chord / (2 * Math.sin(Math.abs(angle) / 2));
            const h = radius * Math.cos(Math.abs(angle) / 2) * Math.sign(angle);
            const cx = (start.x + end.x) / 2 - (end.y - start.y) / chord * h;
            const cy = (start.y + end.y) / 2 + (end.x - start.x) / chord * h;
            const startAngle = Math.atan2(start.y - cy, start.x - cx);
            const normalize = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            // Only extrema are needed for bounds; do not tessellate or trace connections.
            for (let i = 0; i < 4; i++) {
                const a = i * Math.PI / 2;
                if (normalize((a - startAngle) * Math.sign(angle)) <= Math.abs(angle) + 1e-9) {
                    points.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
                }
            }
            length = radius * Math.abs(angle);
        }
        measures.push({ net, layer, kind: 'track', length, width, bounds: boxFromPoints(points, width / 2) });
    }
    return measures;
}

async function readVias() {
    const vias: ExplainPcbVia[] = [];
    const measures: CopperMeasure[] = [];
    for (const via of await eda.pcb_PrimitiveVia.getAll()) {
        const net = safeString(via.getState_Net());
        const point = { x: via.getState_X(), y: via.getState_Y() };
        const diameter = via.getState_Diameter();
        vias.push({ net, x: milToMm(point.x), y: milToMm(point.y), diameter: milToMm(diameter), drill: milToMm(via.getState_HoleDiameter()) });
        if (net) measures.push({ net, layer: 'MULTI', kind: 'via', length: 0, bounds: boxFromPoints([point], diameter / 2) });
    }
    return { vias, measures };
}

function summarizeCopper(measures: CopperMeasure[]): ExplainPcbWire[] {
    const byNet = new Map<string, {
        layers: Set<PcbLayerName>; length: number; minWidth: number; maxWidth: number;
        segments: number; vias: number; bounds: RawBox;
    }>();
    for (const measure of measures) {
        const summary = byNet.get(measure.net) ?? {
            layers: new Set<PcbLayerName>(), length: 0, minWidth: Infinity, maxWidth: -Infinity,
            segments: 0, vias: 0, bounds: emptyBox(),
        };
        summary.layers.add(measure.layer);
        summary.length += measure.length;
        if (measure.kind === 'via') summary.vias++;
        else {
            summary.segments++;
            summary.minWidth = Math.min(summary.minWidth, measure.width!);
            summary.maxWidth = Math.max(summary.maxWidth, measure.width!);
        }
        includePoint(summary.bounds, { x: measure.bounds.minX, y: measure.bounds.minY });
        includePoint(summary.bounds, { x: measure.bounds.maxX, y: measure.bounds.maxY });
        byNet.set(measure.net, summary);
    }
    return [...byNet].map(([net, summary]) => ({
        net, layer: [...summary.layers], length: milToMm(summary.length), vias: summary.vias,
        width: summary.segments ? { min: milToMm(summary.minWidth), max: milToMm(summary.maxWidth) } : null,
        segments: summary.segments, bbox: toExplainBox(summary.bounds),
    }));
}

async function readRawPolygons() {
    const polygons: RawPolygon[] = [];

    const addPolygon = (
        net: string | undefined,
        layer: EPCB_LayerId,
        source: TPCB_PolygonSourceArray | Array<TPCB_PolygonSourceArray>,
    ) => {
        const safe = safeString(net);
        const side = rawLayerName(layer);
        if (!safe || !isCopperLayer(side)) return;

        const rings = complexPolygonToRings(source);
        if (rings[0]) polygons.push({ net: safe, layer: side, rings });
    };

    const pours = await eda.pcb_PrimitivePour.getAll();
    for (const pour of pours) {
        addPolygon(pour.getState_Net(), pour.getState_Layer(), pour.getState_ComplexPolygon().getSource());
    }

    const fills = await eda.pcb_PrimitiveFill.getAll();
    for (const fill of fills) {
        addPolygon(fill.getState_Net(), fill.getState_Layer(), fill.getState_ComplexPolygon().getSource());
    }

    return polygons;
}

function buildPolygons(rawPolygons: RawPolygon[]) {
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
            const outerArea = polygonArea(island.outer);
            const cutoutArea = island.cutouts.reduce((total, ring) => total + polygonArea(ring), 0);

            polygons.push({
                net: polygon.net,
                layer: polygon.layer,
                geometry: "source_outline",
                cutouts: island.cutouts.length
                    ? island.cutouts.map(ring => ring.map(point => toExplainPoint(point)))
                    : undefined,
                area: round((outerArea - cutoutArea) * MIL_TO_MM * MIL_TO_MM),
                bbox: toExplainBox(boxFromPoints(island.outer)),
            });
        }
    }

    return polygons;
}

export async function getPcb(): Promise<ExplainPCB> {
    if (VERSION_EDASYEDA[0] < 3) throw new Error(`EasyEda version required >= 3, current ${VERSION_EDASYEDA[0]}`);

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

    const wires = summarizeCopper([...segments, ...viaResult.measures]);
    const polygons = buildPolygons(rawPolygons);

    const allLayers = await eda.pcb_Layer.getAllLayers().catch(e => []);
    const layers = allLayers
        .filter(l => l.layerStatus && l.type === EPCB_LayerType.SIGNAL)
        .map(l => ({
            layer: rawLayerName(l.id),
            type: l.type
        }));

    return {
        layers: layers.length ? layers : undefined,
        board: boardPolygon?.length
            ? { polygon: boardPolygon }
            : undefined,
        components: componentResult.rawComponents,
        standalone_pads: componentResult.standalonePads.length ? componentResult.standalonePads : undefined,
        vias: viaResult.vias,
        wires: wires.length ? wires : undefined,
        polygons: polygons.length ? polygons : undefined,
    };
}

export async function inspectNet(netName: string, drcLimit: number): Promise<InspectPcbNet> {
    if (VERSION_EDASYEDA[0] < 3) throw new Error(`EasyEda version required >= 3, current ${VERSION_EDASYEDA[0]}`);
    const document = await eda.dmt_SelectControl.getCurrentDocumentInfo();
    if (!document?.uuid || document.documentType !== EDMT_EditorDocumentType.PCB) throw new Error('Open the target PCB document first');
    const pcb = await getPcb();
    const pads = [...new Set([
        ...pcb.components.flatMap(component => component.pads
            .filter(pad => pad.net === netName).map(pad => component.designator + '.' + pad.pad)),
        ...(pcb.standalone_pads ?? []).filter(pad => pad.net === netName).map(pad => pad.ref),
    ])];
    const copper = pcb.wires?.find(wire => wire.net === netName);
    const polygons = pcb.polygons?.filter(polygon => polygon.net === netName) ?? [];
    const drc = await checkPcbNetDrc(netName, drcLimit);
    const current = await eda.dmt_SelectControl.getCurrentDocumentInfo();
    if (current?.uuid !== document.uuid) throw new Error('Active PCB changed during inspection; open the target PCB and retry');
    return {
        net: netName, document_uuid: document.uuid, found: Boolean(pads.length || copper || polygons.length || drc.violation_count),
        units: 'mm', pads, layer: copper?.layer ?? [], length: copper?.length ?? 0, vias: copper?.vias ?? 0,
        width: copper?.width ?? null, segments: copper?.segments ?? 0, bbox: copper?.bbox, polygons, drc,
    };
}

export async function inspectComponent(pcb: ExplainPCB, designator: string, radius: number): Promise<ExplainPcbComponent> {
    if (VERSION_EDASYEDA[0] < 3) throw new Error(`EasyEda version required >= 3, current ${VERSION_EDASYEDA[0]}`);

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
    if (VERSION_EDASYEDA[0] < 3) throw new Error(`EasyEda version required >= 3, current ${VERSION_EDASYEDA[0]}`);
    const boardPolygon = await readBoardPolygon();
    if (!boardPolygon) throw new Error('Board outline is missing.')

    const components: RawPcbComponent[] = []
    const padOwnerByPrimitiveId = new Map<string, string>();
    for (const c of await eda.pcb_PrimitiveComponent.getAll().catch(() => [])) {
        const designator = c.getState_Designator() || '';
        for (const statePad of c.getState_Pads() ?? []) {
            const primitiveId = safeString(statePad.primitiveId);
            if (primitiveId) padOwnerByPrimitiveId.set(primitiveId, designator);
        }
        components.push({
            designator,
            x: milToMm(c.getState_X()),
            y: milToMm(c.getState_Y()),
            rotate: c.getState_Rotation(),
            layer: rawLayerName(c.getState_Layer()),
            bbox: await eda.pcb_Primitive.getPrimitivesBBox([c.getState_PrimitiveId()]).then(box => box ? ({
                left: milToMm(box.minX),
                right: milToMm(box.maxX),
                top: milToMm(box.maxY),
                bottom: milToMm(box.minY),
            }) : undefined)
        });
    }

    const pads: RawPcbPad[] = []
    for (const p of await eda.pcb_PrimitivePad.getAll().catch(() => [])) {
        const primitiveId = p.getState_PrimitiveId();
        pads.push({
            id: primitiveId,
            component: padOwnerByPrimitiveId.get(primitiveId),
            x: milToMm(p.getState_X()),
            y: milToMm(p.getState_Y()),
            net: safeString(p.getState_Net()) ?? '',
            padNumber: p.getState_PadNumber(),
            layer: rawLayerName(p.getState_Layer()),
            shape: p.getState_Pad()?.map(v => {
                if (typeof v === 'number') return milToMm(v);
                else if (Array.isArray(v)) return rawSourcesFromComplex(v, milToMm);
                return v;
            }),
            rotation: p.getState_Rotation(),
            hole: p.getState_Hole() ? {
                data: p.getState_Hole()!.map(v => typeof v === 'number' ? milToMm(v) : v),
                offsetX: toMmCopperGrid(p.getState_HoleOffsetX()),
                offsetY: toMmCopperGrid(p.getState_HoleOffsetY()),
                rotation: p.getState_HoleRotation(),
            } : undefined
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
