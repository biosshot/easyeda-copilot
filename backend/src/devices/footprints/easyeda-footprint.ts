import { getEasyEdaDataStr } from "#devices/easy-eda-datastr.ts";
import { getEasyEdaDevice } from "#devices/easy-eda.ts";
import type { FootprintGraphic, FootprintGraphicLayer, FootprintPad, FootprintSpec, Point } from "#types/pcb/layout-model.ts";
import { fetchWithRetry } from "#utils/fetch-with-retry.ts";
import { memoize } from "#utils/memoize.ts";

const MIL_PER_MM = 39.37007874015748;
const PAD_ONLY_FOOTPRINT_MARGIN_MM = 0.254;

type EasyEdaFootprintDocument = {
    uuid: string;
    title?: string;
    display_title?: string;
    dataStr?: string;
    dataStrId?: string;
    key?: string;
    iv?: string;
};

type Box = {
    left: number;
    right: number;
    top: number;
    bottom: number;
};

export const getEasyEdaFootprintDocument = memoize(async (footprintUuid: string): Promise<EasyEdaFootprintDocument> => {
    const response = await fetchWithRetry(`https://pro.easyeda.com/api/v2/components/${footprintUuid}?uuid=${footprintUuid}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch EasyEDA footprint ${footprintUuid}: ${response.status}`);
    }

    const json = await response.json() as { success?: boolean; msg?: string; result?: EasyEdaFootprintDocument };
    if (!json.success || !json.result) {
        throw new Error(`Failed to fetch EasyEDA footprint ${footprintUuid}: ${json.msg ?? "unknown error"}`);
    }

    return json.result;
});

export const resolveEasyEdaFootprintByUuid = memoize(async (footprintUuid: string): Promise<FootprintSpec> => {
    const document = await getEasyEdaFootprintDocument(footprintUuid);
    const dataStr = await getEasyEdaDataStr(document);
    if (!dataStr) {
        throw new Error(`EasyEDA footprint ${footprintUuid} has no dataStr`);
    }

    return parseEasyEdaFootprintDataStr(dataStr, document.display_title ?? document.title ?? footprintUuid);
});

export const resolveEasyEdaFootprintByPartUuid = memoize(async (partUuid: string): Promise<FootprintSpec | null> => {
    const device = await getEasyEdaDevice(partUuid);
    const footprintUuid = device.footprint?.uuid;
    if (!footprintUuid) return null;

    return resolveEasyEdaFootprintByUuid(footprintUuid);
});

export function parseEasyEdaFootprintDataStr(dataStr: string, fallbackName = "EASYEDA_FOOTPRINT"): FootprintSpec {
    const pads: Array<FootprintPad & { box: Box }> = [];
    const bodyBoxes: Box[] = [];
    const fallbackBodyBoxes: Box[] = [];
    const silkscreenBoxes: Box[] = [];
    const rawGraphics: Array<FootprintGraphic & { box: Box }> = [];
    let name = fallbackName;
    let mechanicalHoleIndex = 1;
    let footprintViaIndex = 1;

    for (const line of dataStr.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let item: unknown[];
        try {
            item = JSON.parse(trimmed);
        } catch {
            continue;
        }

        if (item[0] === "DOCTYPE" && item[1] !== "FOOTPRINT") {
            throw new Error(`Expected EasyEDA FOOTPRINT dataStr, got ${String(item[1])}`);
        }

        if (item[0] === "ATTR" && item[3] === "Name" && typeof item[4] === "string") {
            name = item[4];
            continue;
        }

        if (item[0] === "PAD") {
            const pad = parsePad(item);
            if (pad) {
                pads.push(pad);
            }
            continue;
        }

        const footprintVia = parseFootprintVia(item, footprintViaIndex);
        if (footprintVia) {
            pads.push(footprintVia);
            footprintViaIndex += 1;
            continue;
        }

        const mechanicalHole = parseMechanicalHole(item, mechanicalHoleIndex);
        if (mechanicalHole) {
            pads.push(mechanicalHole);
            mechanicalHoleIndex += 1;
            continue;
        }

        const graphic = parseGraphic(item);
        if (graphic && !isIgnorableFootprintGraphic(graphic)) {
            rawGraphics.push(graphic);
            if (graphic.layer === "silk") silkscreenBoxes.push(graphic.box);
        }

        const box = bodyGeometryBox(item);
        if (box) bodyBoxes.push(box);
        const fallbackBox = fallbackBodyGeometryBox(item);
        if (fallbackBox) fallbackBodyBoxes.push(fallbackBox);
    }

    if (pads.length === 0) {
        throw new Error(`EasyEDA footprint ${name} has no PAD entries`);
    }

    const bodySourceBoxes = bodyBoxes.length > 0 ? bodyBoxes : fallbackBodyBoxes;
    const bodyBox = bodySourceBoxes.length > 0 ? mergeBoxes(bodySourceBoxes) : null;
    const padBoxes = pads.map((pad) => pad.box);
    const paddedPadBox = inflateBox(mergeBoxes(padBoxes), PAD_ONLY_FOOTPRINT_MARGIN_MM);
    const physicalBaseBox = bodyBox ? mergeBoxes([bodyBox, paddedPadBox]) : paddedPadBox;
    const physicalSilkscreenBoxes = bodyBox
        ? silkscreenBoxes.filter((box) => isPhysicalSilkscreenBox(box, physicalBaseBox))
        : silkscreenBoxes;
    const visualBoxes = [physicalBaseBox, ...physicalSilkscreenBoxes];
    const visualBox = visualBoxes.length > 0 ? mergeBoxes(visualBoxes) : null;
    const footprintBox = visualBox && boxContains(visualBox, paddedPadBox)
        ? visualBox
        : mergeBoxes([...(visualBox ? [visualBox] : []), paddedPadBox]);
    const center = {
        x: (footprintBox.left + footprintBox.right) / 2,
        y: (footprintBox.top + footprintBox.bottom) / 2,
    };

    return {
        name,
        width: roundMm(footprintBox.right - footprintBox.left),
        height: roundMm(footprintBox.bottom - footprintBox.top),
        pads: pads.map(({ box: _box, ...pad }) => ({
            ...pad,
            x: roundMm(center.x - pad.x),
            y: roundMm(pad.y - center.y),
        })),
        graphics: rawGraphics.map(({ box: _box, ...graphic }) => normalizeGraphic(graphic, center)),
        sourceOriginOffset: {
            x: roundMm(center.x),
            y: roundMm(-center.y),
        },
    };
}

function parseFootprintVia(item: unknown[], index: number): (FootprintPad & { box: Box }) | null {
    if (item[0] !== "VIA") return null;

    const candidates = [
        viaCandidate(item, 4, 5, 6, 7),
        viaCandidate(item, 5, 6, 7, 8),
        viaCandidate(item, 5, 6, 8, 7),
        viaCandidate(item, 2, 3, 4, 5),
    ].filter((candidate): candidate is { x: number; y: number; diameter: number; drill: number } => candidate !== null);
    const via = candidates[0];
    if (!via) return null;

    const center = { x: milToMm(via.x), y: milToMm(via.y) };
    const diameter = roundMm(milToMm(via.diameter));
    const drill = roundMm(milToMm(via.drill));
    const radius = diameter / 2;

    return {
        pin_number: `FV${index}`,
        name: `FV${index}`,
        x: center.x,
        y: center.y,
        width: diameter,
        height: diameter,
        mount: "through_hole",
        drillDiameter: drill,
        box: {
            left: center.x - radius,
            right: center.x + radius,
            top: center.y - radius,
            bottom: center.y + radius,
        },
    };
}

function viaCandidate(item: unknown[], xIndex: number, yIndex: number, diameterIndex: number, drillIndex: number) {
    const x = numberAt(item, xIndex);
    const y = numberAt(item, yIndex);
    const diameter = numberAt(item, diameterIndex);
    const drill = numberAt(item, drillIndex);
    if (x === null || y === null || diameter === null || drill === null) return null;
    if (diameter <= 0 || drill <= 0 || diameter < drill) return null;
    return { x, y, diameter, drill };
}

function parseMechanicalHole(item: unknown[], index: number): (FootprintPad & { box: Box }) | null {
    if (item[0] !== "FILL" && item[0] !== "POLY") return null;
    const layer = numberAt(item, 4);
    if (layer !== 12) return null;

    const geometry = item[0] === "FILL" ? item[7] : item[6];
    const circle = singleCircle(geometry);
    if (!circle) return null;

    const center = { x: milToMm(circle.x), y: milToMm(circle.y) };
    const radius = milToMm(circle.radius);
    const diameter = roundMm(radius * 2);
    const box = {
        left: center.x - radius,
        right: center.x + radius,
        top: center.y - radius,
        bottom: center.y + radius,
    };

    return {
        pin_number: `MH${index}`,
        name: `MH${index}`,
        x: center.x,
        y: center.y,
        width: diameter,
        height: diameter,
        mount: "through_hole",
        drillDiameter: diameter,
        box,
    };
}

function parsePad(item: unknown[]): (FootprintPad & { box: Box }) | null {
    const pinNumber = item[5];
    const x = numberAt(item, 6);
    const y = numberAt(item, 7);
    const rotation = numberAt(item, 8) ?? 0;
    const layer = numberAt(item, 4);
    const drillShape = Array.isArray(item[9]) ? item[9] : null;
    const shape = Array.isArray(item[10]) ? item[10] : null;
    if ((typeof pinNumber !== "string" && typeof pinNumber !== "number") || x === null || y === null || !shape) {
        return null;
    }

    const center = { x: milToMm(x), y: milToMm(y) };
    const localBox = padShapeLocalBox(shape);
    if (!localBox) return null;

    // POLY pad shapes encode polygon points in absolute footprint coordinates,
    // not relative to the pad center. Convert to a local box before rotating.
    const shapeType = String(shape[0] ?? "").toUpperCase();
    const adjustedLocalBox = shapeType === "POLY"
        ? {
            left: localBox.left - center.x,
            right: localBox.right - center.x,
            top: localBox.top - center.y,
            bottom: localBox.bottom - center.y,
        }
        : localBox;

    const box = rotateLocalBox(center, adjustedLocalBox, rotation);
    const pad: FootprintPad = {
        pin_number: pinNumber,
        name: String(pinNumber),
        x: center.x,
        y: center.y,
        width: roundMm(box.right - box.left),
        height: roundMm(box.bottom - box.top),
    };
    const drillDiameter = drillShapeDiameter(drillShape);
    const isThroughHole = layer === 12 || drillDiameter !== null;

    return {
        ...pad,
        mount: isThroughHole ? "through_hole" : "smd",
        ...(drillDiameter !== null ? { drillDiameter: roundMm(drillDiameter) } : {}),
        box,
    };
}

function drillShapeDiameter(shape: unknown[] | null): number | null {
    if (!shape) return null;
    const type = String(shape[0] ?? "").toUpperCase();
    if (type !== "ROUND" && type !== "CIRCLE" && type !== "OVAL" && type !== "ELLIPSE") return null;

    const width = numberAt(shape, 1);
    const height = numberAt(shape, 2) ?? width;
    if (width === null || height === null) return null;

    return Math.max(milToMm(width), milToMm(height));
}

function rotateLocalBox(center: Point, localBox: Box, rotation: number): Box {
    const radians = rotation * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const corners = [
        { x: localBox.left, y: localBox.top },
        { x: localBox.right, y: localBox.top },
        { x: localBox.right, y: localBox.bottom },
        { x: localBox.left, y: localBox.bottom },
    ].map((corner) => ({
        x: center.x + corner.x * cos - corner.y * sin,
        y: center.y + corner.x * sin + corner.y * cos,
    }));

    return pointsToBox(corners);
}

function padShapeLocalBox(shape: unknown[]): Box | null {
    const type = String(shape[0] ?? "").toUpperCase();
    if (type === "RECT" || type === "OVAL" || type === "ELLIPSE" || type === "ROUND") {
        const width = numberAt(shape, 1);
        const height = numberAt(shape, 2);
        return width !== null && height !== null ? centeredMilBox(width, height) : null;
    }

    if (type === "CIRCLE") {
        const diameter = numberAt(shape, 1) ?? numberAt(shape, 3);
        return diameter !== null ? centeredMilBox(diameter, diameter) : null;
    }

    if (type === "POLY") {
        const geometry = Array.isArray(shape[1]) ? shape[1] : shape;
        const points = collectGeometryPoints(geometry);
        return points.length > 0 ? pointsToBox(points.map((point) => ({ x: milToMm(point.x), y: milToMm(point.y) }))) : null;
    }

    return null;
}

function centeredMilBox(width: number, height: number): Box {
    const halfWidth = milToMm(width) / 2;
    const halfHeight = milToMm(height) / 2;
    return {
        left: -halfWidth,
        right: halfWidth,
        top: -halfHeight,
        bottom: halfHeight,
    };
}

function geometryBox(item: unknown[]): Box | null {
    const type = item[0];
    if (type !== "FILL" && type !== "POLY" && type !== "RECT" && type !== "CIRCLE" && type !== "ARC") {
        return null;
    }

    const geometry = type === "FILL" ? item[7] : type === "POLY" ? item[6] : item;
    const points = collectGeometryPoints(geometry);
    const boxes = collectShapeBoxes(geometry);
    if (points.length === 0 && boxes.length === 0) return null;

    return mergeBoxes([
        ...(points.length > 0 ? [pointsToBox(points.map((point) => ({ x: milToMm(point.x), y: milToMm(point.y) })))] : []),
        ...boxes,
    ]);
}

function bodyGeometryBox(item: unknown[]): Box | null {
    if (item[0] !== "FILL" && item[0] !== "POLY") return null;
    const layer = numberAt(item, 4);
    if (layer !== 48) return null;

    return geometryBox(item);
}

function fallbackBodyGeometryBox(item: unknown[]): Box | null {
    if (item[0] !== "FILL" && item[0] !== "POLY") return null;
    const layer = numberAt(item, 4);
    if (layer !== 3) return null;
    const graphic = parseGraphic(item);
    if (graphic && isIgnorableFootprintGraphic(graphic)) return null;

    return geometryBox(item);
}

function isIgnorableFootprintGraphic(graphic: FootprintGraphic & { box: Box }) {
    if (graphic.kind !== "path") return false;
    if (!graphic.closed || graphic.strokeWidth > 0.01 || graphic.points.length > 8) return false;
    return uniquePointCount(graphic.points) <= 3 && polygonArea(graphic.points) > 1;
}

function parseGraphic(item: unknown[]): (FootprintGraphic & { box: Box }) | null {
    if (item[0] !== "FILL" && item[0] !== "POLY") return null;

    const layerNumber = numberAt(item, 4);
    const layer = graphicLayer(layerNumber);
    if (!layer) return null;

    const geometry = item[0] === "FILL" ? item[7] : item[6];
    const strokeWidth = roundMm(milToMm(numberAt(item, 5) ?? 1));
    const circle = singleCircle(geometry);
    if (circle) {
        const box = {
            left: milToMm(circle.x - circle.radius),
            right: milToMm(circle.x + circle.radius),
            top: milToMm(circle.y - circle.radius),
            bottom: milToMm(circle.y + circle.radius),
        };
        return {
            kind: "circle",
            layer,
            x: milToMm(circle.x),
            y: milToMm(circle.y),
            radius: milToMm(circle.radius),
            strokeWidth,
            box,
        };
    }

    const points = collectGeometryPoints(geometry).map((point) => ({ x: milToMm(point.x), y: milToMm(point.y) }));
    if (points.length < 2) return null;

    return {
        kind: "path",
        layer,
        points,
        closed: isClosedPath(points),
        strokeWidth,
        box: pointsToBox(points),
    };
}

function graphicLayer(layer: number | null): FootprintGraphicLayer | null {
    if (layer === 3 || layer === 4) return "silk";
    if (layer === 48) return "body";
    if (layer === 49) return "marking";
    if (layer === 13) return "document";
    return null;
}

function singleCircle(value: unknown): { x: number; y: number; radius: number } | null {
    if (!Array.isArray(value)) return null;
    const circle = Array.isArray(value[0]) ? value[0] : value;
    if (!Array.isArray(circle) || String(circle[0]).toUpperCase() !== "CIRCLE") return null;

    const x = numberAt(circle, 1);
    const y = numberAt(circle, 2);
    const radius = numberAt(circle, 3);
    return x !== null && y !== null && radius !== null ? { x, y, radius } : null;
}

function normalizeGraphic(graphic: FootprintGraphic, center: Point): FootprintGraphic {
    if (graphic.kind === "circle") {
        return {
            ...graphic,
            x: roundMm(center.x - graphic.x),
            y: roundMm(graphic.y - center.y),
            radius: roundMm(graphic.radius),
        };
    }

    return {
        ...graphic,
        points: graphic.points.map((point) => ({
            x: roundMm(center.x - point.x),
            y: roundMm(point.y - center.y),
        })),
    };
}

function isClosedPath(points: Point[]) {
    if (points.length < 3) return false;
    const first = points[0];
    const last = points[points.length - 1];
    return Math.abs(first.x - last.x) < 0.001 && Math.abs(first.y - last.y) < 0.001;
}

function polygonArea(points: Point[]) {
    if (points.length < 3) return 0;
    let area = 0;
    for (let index = 0; index < points.length; index++) {
        const current = points[index];
        const next = points[(index + 1) % points.length];
        area += current.x * next.y - next.x * current.y;
    }
    return Math.abs(area) / 2;
}

function uniquePointCount(points: Point[]) {
    const unique = new Set(points.map((point) => `${point.x.toFixed(4)},${point.y.toFixed(4)}`));
    return unique.size;
}

function collectGeometryPoints(value: unknown): Point[] {
    if (isEasyEdaPath(value)) {
        return collectPathPoints(value);
    }

    const points: Point[] = [];
    collectNumbers(value, [], points);
    return points;
}

function isEasyEdaPath(value: unknown): value is unknown[] {
    return Array.isArray(value) && value.some((item) => item === "L" || item === "ARC");
}

function collectPathPoints(path: unknown[]): Point[] {
    const points: Point[] = [];

    for (let index = 0; index < path.length;) {
        const token = path[index];
        if (token === "L") {
            index++;
            continue;
        }

        if (token === "ARC") {
            const x = numberAt(path, index + 2);
            const y = numberAt(path, index + 3);
            if (x !== null && y !== null) points.push({ x, y });
            index += 4;
            continue;
        }

        const x = numberAt(path, index);
        const y = numberAt(path, index + 1);
        if (x !== null && y !== null) {
            points.push({ x, y });
            index += 2;
            continue;
        }

        index++;
    }

    return points;
}

function collectNumbers(value: unknown, pending: number[], points: Point[]) {
    if (typeof value === "number" && Number.isFinite(value)) {
        pending.push(value);
        if (pending.length === 2) {
            points.push({ x: pending[0], y: pending[1] });
            pending.length = 0;
        }
        return;
    }

    if (Array.isArray(value)) {
        const localPending: number[] = [];
        for (const item of value) {
            collectNumbers(item, localPending, points);
        }
    }
}

function collectShapeBoxes(value: unknown): Box[] {
    if (!Array.isArray(value)) return [];

    const type = String(value[0] ?? "").toUpperCase();
    if (type === "CIRCLE") {
        const x = numberAt(value, 1);
        const y = numberAt(value, 2);
        const radius = numberAt(value, 3);
        if (x !== null && y !== null && radius !== null) {
            return [{
                left: milToMm(x - radius),
                right: milToMm(x + radius),
                top: milToMm(y - radius),
                bottom: milToMm(y + radius),
            }];
        }
    }

    return value.flatMap((item) => collectShapeBoxes(item));
}

function pointsToBox(points: Point[]): Box {
    return {
        left: Math.min(...points.map((point) => point.x)),
        right: Math.max(...points.map((point) => point.x)),
        top: Math.min(...points.map((point) => point.y)),
        bottom: Math.max(...points.map((point) => point.y)),
    };
}

function mergeBoxes(boxes: Box[]): Box {
    return {
        left: Math.min(...boxes.map((box) => box.left)),
        right: Math.max(...boxes.map((box) => box.right)),
        top: Math.min(...boxes.map((box) => box.top)),
        bottom: Math.max(...boxes.map((box) => box.bottom)),
    };
}

function inflateBox(box: Box, margin: number): Box {
    return {
        left: box.left - margin,
        right: box.right + margin,
        top: box.top - margin,
        bottom: box.bottom + margin,
    };
}

function boxContains(outer: Box, inner: Box) {
    return inner.left >= outer.left
        && inner.right <= outer.right
        && inner.top >= outer.top
        && inner.bottom <= outer.bottom;
}

function isPhysicalSilkscreenBox(box: Box, physicalBaseBox: Box) {
    const nearBody = boxesOverlapOrTouch(inflateBox(physicalBaseBox, 0.8), box);
    if (!nearBody) return false;

    const merged = mergeBoxes([physicalBaseBox, box]);
    const baseWidth = physicalBaseBox.right - physicalBaseBox.left;
    const baseHeight = physicalBaseBox.bottom - physicalBaseBox.top;
    const mergedWidth = merged.right - merged.left;
    const mergedHeight = merged.bottom - merged.top;

    return mergedWidth <= baseWidth + 1.6
        && mergedHeight <= baseHeight + 1.6;
}

function boxesOverlapOrTouch(a: Box, b: Box) {
    return a.left <= b.right
        && a.right >= b.left
        && a.top <= b.bottom
        && a.bottom >= b.top;
}

function numberAt(items: unknown[], index: number) {
    const value = items[index];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function milToMm(value: number) {
    return value / MIL_PER_MM;
}

function roundMm(value: number) {
    return Number(value.toFixed(4));
}
