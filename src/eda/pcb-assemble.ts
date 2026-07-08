import { BoardAssemble } from "@copilot/shared/types/pcb/board-assemble";
import PQueue from "p-queue";
import { VERSION_EDASYEDA, withTimeout, yieldToEventLoop } from "./utils";

const assembleBoardQueue = new PQueue({ concurrency: 1 });
const MM_TO_MIL = 1000 / 25.4;
const BOARD_OUTLINE_WIDTH_MM = 0.254;
const DEFAULT_POUR_LINE_WIDTH_MM = 0.15;
const MIN_COPPER_WIDTH_MM = 0.01;
const SAME_POINT_EPS = 1e-9;
const DEFAULT_GND_NET = "GND";
const DEFAULT_GND_POUR_PREFIX = "COPILOT_GND";
const PCB_CLEAR_TIMEOUT_MS = 5000;
const PCB_POST_CLEAR_SETTLE_MS = 500;

type BoardPoint = {
    x: number;
    y: number;
};

type BoardLayer = NonNullable<BoardAssemble["components"]>[number]["layer"];
type BoardPad = NonNullable<BoardAssemble["pads"]>[number];
type BoardPadLayer = BoardPad["layer"];

export type GroundSutureOptions = {
    gridMm?: number;
    diameterMm?: number;
    drillMm?: number;
    edgeMarginMm?: number;
    maxCount?: number;
};

export type ClearPcbBoardOptions = {
    ignoreToClearNet?: string[];
    clearOnlyNet?: string[];
    preserveBoardOutline?: boolean;
};

export type ClearPcbBoardResult = {
    deleted: Record<string, number>;
};

type DoneablePrimitive<T> = {
    isAsync(): boolean;
    done(): T | Promise<T>;
};

function layerToComponent(layer: BoardLayer): TPCB_LayersOfComponent {
    return layer === "bottom" ? EPCB_LayerId.BOTTOM : EPCB_LayerId.TOP;
}

function layerToCopper(layer: BoardLayer): TPCB_LayersOfCopper {
    return layer === "bottom" ? EPCB_LayerId.BOTTOM : EPCB_LayerId.TOP;
}

function layerToLine(layer: BoardLayer): TPCB_LayersOfLine {
    return layer === "bottom" ? EPCB_LayerId.BOTTOM : EPCB_LayerId.TOP;
}

function layerToPad(layer: BoardPadLayer): TPCB_LayersOfPad {
    if (layer === "multi") return EPCB_LayerId.MULTI;

    return layer === "bottom" ? EPCB_LayerId.BOTTOM : EPCB_LayerId.TOP;
}

function normalizeRotation(rotation: number) {
    const normalized = rotation % 360;
    return normalized < 0 ? normalized + 360 : normalized;
}

function mmToMil(value: number) {
    return value * MM_TO_MIL;
}

function pointMmToPcbMil(point: BoardPoint): BoardPoint {
    return {
        x: mmToMil(point.x),
        y: mmToMil(point.y),
    };
}

function samePoint(a: BoardPoint, b: BoardPoint) {
    return Math.abs(a.x - b.x) <= SAME_POINT_EPS && Math.abs(a.y - b.y) <= SAME_POINT_EPS;
}

function trimClosingPoint(points: BoardPoint[]) {
    if (points.length > 1 && samePoint(points[0], points[points.length - 1])) {
        return points.slice(0, -1);
    }

    return points;
}

function pointInPolygon(point: BoardPoint, polygon: BoardPoint[]) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i];
        const b = polygon[j];
        const intersects = ((a.y > point.y) !== (b.y > point.y)) &&
            point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
        if (intersects) inside = !inside;
    }

    return inside;
}

function polygonBounds(points: BoardPoint[]) {
    return points.reduce((bounds, point) => ({
        minX: Math.min(bounds.minX, point.x),
        maxX: Math.max(bounds.maxX, point.x),
        minY: Math.min(bounds.minY, point.y),
        maxY: Math.max(bounds.maxY, point.y),
    }), {
        minX: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
    });
}

function normalizePolygonPoints(points: BoardPoint[]) {
    const normalized: BoardPoint[] = [];
    for (const point of trimClosingPoint(points)) {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
        if (normalized.length && samePoint(normalized[normalized.length - 1], point)) continue;

        normalized.push(point);
    }

    return trimClosingPoint(normalized);
}

function polygonSource(points: BoardPoint[]): TPCB_PolygonSourceArray {
    const normalized = normalizePolygonPoints(points).map(pointMmToPcbMil);
    const [first, ...rest] = normalized;
    const closed = samePoint(first, normalized[normalized.length - 1])
        ? rest
        : [...rest, first];

    return [
        first.x,
        first.y,
        "L",
        ...closed.flatMap(point => [point.x, point.y]),
    ] as TPCB_PolygonSourceArray;
}

function safeNetName(net: string | undefined) {
    return net?.trim() ?? "";
}

function safePrimitiveName(prefix: string, ...parts: Array<string | number | undefined>) {
    const name = [prefix, ...parts]
        .filter(part => part !== undefined && String(part).length > 0)
        .join("_")
        .replace(/[^A-Za-z0-9_]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");

    return name || prefix;
}

function validLengthMm(value: number | undefined, fallbackMm: number) {
    const safeFallbackMm = Number.isFinite(fallbackMm) && fallbackMm > 0 ? fallbackMm : MIN_COPPER_WIDTH_MM;
    const safeValueMm = value === undefined || !Number.isFinite(value) || value <= 0 ? safeFallbackMm : value;

    return Math.max(safeValueMm, MIN_COPPER_WIDTH_MM);
}

function validLengthMmToMil(value: number | undefined, fallbackMm: number) {
    return mmToMil(validLengthMm(value, fallbackMm));
}

function warning(message: string) {
    eda.sys_Log.add(message, ESYS_LogType.WARNING);
    eda.sys_Message.showToastMessage(message, ESYS_ToastMessageType.WARNING);
}

type PcbPrimitiveCleanupApi = {
    getAllPrimitiveId(): Promise<Array<string>>;
    getAll?: () => Promise<Array<PcbCleanupPrimitive>>;
    delete(primitiveIds: Array<string>): Promise<boolean>;
};

type PcbCleanupPrimitive = {
    getState_PrimitiveId?: () => string;
    getState_Net?: () => string | undefined;
    getState_Layer?: () => unknown;
};

function normalizeNetFilter(nets: string[] | undefined) {
    return new Set((nets ?? [])
        .map(net => safeNetName(net).toUpperCase())
        .filter(Boolean));
}

function shouldClearPrimitive(primitive: PcbCleanupPrimitive, options: ClearPcbBoardOptions) {
    if (options.preserveBoardOutline && primitive.getState_Layer?.() === EPCB_LayerId.BOARD_OUTLINE) {
        return false;
    }

    const net = safeNetName(primitive.getState_Net?.()).toUpperCase();
    const only = normalizeNetFilter(options.clearOnlyNet);
    const ignored = normalizeNetFilter(options.ignoreToClearNet);

    if (only.size && !only.has(net)) return false;
    if (ignored.size && ignored.has(net)) return false;
    return true;
}

export async function clearCurrentPcbBoard(options: ClearPcbBoardOptions = {}): Promise<ClearPcbBoardResult> {
    const groups: Array<[string, { api: PcbPrimitiveCleanupApi, filter?: (id: string) => boolean }]> = [
        ["pour", { api: eda.pcb_PrimitivePour }],
        ["fill", { api: eda.pcb_PrimitiveFill }],
        ["region", { api: eda.pcb_PrimitiveRegion }],
        ["via", { api: eda.pcb_PrimitiveVia }],
        ["line", { api: eda.pcb_PrimitiveLine }],
        ["arc", { api: eda.pcb_PrimitiveArc }],
        ["polyline", { api: eda.pcb_PrimitivePolyline }],
        // ["string", eda.pcb_PrimitiveString],
        // ["attribute", eda.pcb_PrimitiveAttribute],
        // ["pad", { api: eda.pcb_PrimitivePad, filter: (id) => !id.startsWith('e') }],
        // ["dimension", eda.pcb_PrimitiveDimension],
        // ["image", eda.pcb_PrimitiveImage],
        // ["object", eda.pcb_PrimitiveObject],
    ];

    const deleted: Record<string, number> = {};
    const needsPrimitiveRead = Boolean(
        options.preserveBoardOutline ||
        options.clearOnlyNet?.length ||
        options.ignoreToClearNet?.length,
    );

    for (const [name, api] of groups) {
        let ids: string[] = [];

        if (needsPrimitiveRead) {
            if (!api.api.getAll) {
                warning(`PCB cleanup ${name} skipped: primitive filtering is not supported`);
                continue;
            }

            const primitives = await withTimeout(
                api.api.getAll(),
                PCB_CLEAR_TIMEOUT_MS,
                `PCB cleanup ${name} get timeout`,
            ).catch(error => {
                warning(`PCB cleanup ${name} get failed: ${(error as Error).message}`);
                return [];
            });

            ids = primitives
                .filter(primitive => shouldClearPrimitive(primitive, options))
                .map(primitive => primitive.getState_PrimitiveId?.())
                .filter((id): id is string => Boolean(id));
        } else {
            ids = await withTimeout(
                api.api.getAllPrimitiveId(),
                PCB_CLEAR_TIMEOUT_MS,
                `PCB cleanup ${name} get timeout`,
            ).catch(error => {
                warning(`PCB cleanup ${name} get failed: ${(error as Error).message}`);
                return [];
            });
        }

        if (!ids.length) continue;
        if (api.filter) ids = ids.filter(api.filter)

        await withTimeout(
            api.api.delete(ids),
            PCB_CLEAR_TIMEOUT_MS,
            `PCB cleanup ${name} delete timeout`,
        ).catch(error => {
            warning(`PCB cleanup ${name} delete failed: ${(error as Error).message}`);
            return false;
        });
        deleted[name] = (deleted[name] ?? 0) + ids.length;

        await yieldToEventLoop();
    }

    return { deleted };
}

async function commitPrimitive<T extends DoneablePrimitive<T>>(primitive: T | undefined, message: string) {
    if (!primitive) throw new Error(message);

    return await Promise.resolve(primitive.done());
}

async function commitPourCopperRegion(pour: IPCB_PrimitivePour) {
    const poured = await pour.rebuildCopperRegion();
    if (!poured) {
        warning(`PCB polygon copper rebuild returned empty region: ${pour.getState_Net()}`);
    } else if (poured.isAsync()) {
        await Promise.resolve(poured.done());
    }
}

async function createCommittedPour(args: {
    net: string;
    layer: TPCB_LayersOfCopper;
    polygon: IPCB_Polygon;
    preserveSilos: boolean;
    pourName: string;
    pourPriority: number;
    lineWidth: number;
}) {
    try {
        return await commitPrimitive(
            await eda.pcb_PrimitivePour.create(
                args.net,
                args.layer,
                args.polygon,
                EPCB_PrimitivePourFillMethod.SOLID,
                args.preserveSilos,
                args.pourName,
                args.pourPriority,
                args.lineWidth,
                false,
            ),
            "create returned undefined",
        );
    } catch (firstError) {
        eda.sys_Log.add(
            `PCB pour create retry without pourName: ${args.net}: ${(firstError as Error).message}`,
            ESYS_LogType.WARNING,
        );

        return await commitPrimitive(
            await eda.pcb_PrimitivePour.create(
                args.net,
                args.layer,
                args.polygon,
                EPCB_PrimitivePourFillMethod.SOLID,
                args.preserveSilos,
                undefined,
                args.pourPriority,
                args.lineWidth,
                false,
            ),
            `create returned undefined after retry: ${(firstError as Error).message}`,
        );
    }
}

async function createCommittedFill(args: {
    net: string;
    layer: TPCB_LayersOfFill;
    polygon: IPCB_Polygon;
    lineWidth: number;
}) {
    return await commitPrimitive(
        await eda.pcb_PrimitiveFill.create(
            args.layer,
            args.polygon,
            args.net,
            EPCB_PrimitiveFillMode.SOLID,
            args.lineWidth,
            false,
        ),
        "create fill returned undefined",
    );
}

async function drawBoardOutline(board: BoardAssemble["board"]) {
    if (!board) return;

    const points = normalizePolygonPoints(board.polygon).map(pointMmToPcbMil);
    if (points.length < 3) {
        warning("PCB board outline skipped: polygon must contain at least 3 points");
        return;
    }

    const oldOutlineLines = await eda.pcb_PrimitiveLine.getAll(undefined, EPCB_LayerId.BOARD_OUTLINE).catch(() => []);
    if (oldOutlineLines.length) {
        await eda.pcb_PrimitiveLine.delete(oldOutlineLines).catch(error => {
            warning(`PCB board outline cleanup failed: ${(error as Error).message}`);
            return false;
        });
    }

    const oldOutlinePolylines = await eda.pcb_PrimitivePolyline.getAll(undefined, EPCB_LayerId.BOARD_OUTLINE).catch(() => []);
    if (oldOutlinePolylines.length) {
        await eda.pcb_PrimitivePolyline.delete(oldOutlinePolylines).catch(error => {
            warning(`PCB board outline polyline cleanup failed: ${(error as Error).message}`);
            return false;
        });
    }

    const polygon = eda.pcb_MathPolygon.createPolygon(polygonSource(board.polygon));
    if (!polygon) {
        warning("PCB board outline skipped: invalid polygon geometry");
        return;
    }

    await commitPrimitive(
        await eda.pcb_PrimitivePolyline.create(
            "",
            EPCB_LayerId.BOARD_OUTLINE,
            polygon,
            mmToMil(BOARD_OUTLINE_WIDTH_MM),
            false,
        ),
        "Failed to create board outline polyline",
    );

    eda.sys_Log.add(`PCB board outline polyline created: ${points.length} points`, ESYS_LogType.INFO);
}

async function placeComponents(components: BoardAssemble["components"]) {
    if (!components?.length) return;

    const primitives = await eda.pcb_PrimitiveComponent.getAll().catch(error => {
        throw new Error(`Failed to read PCB components: ${(error as Error).message}`);
    });

    const byDesignator = new Map<string, IPCB_PrimitiveComponent>();
    for (const primitive of primitives) {
        const designator = primitive.getState_Designator()?.trim();
        if (!designator) continue;

        const key = designator.toUpperCase();
        if (!byDesignator.has(key)) byDesignator.set(key, primitive);
    }

    for (const component of components) {
        const designator = component.designator.trim();
        const primitive = byDesignator.get(designator.toUpperCase());

        if (!primitive) {
            warning(`PCB component not found: ${component.designator}`);
            await yieldToEventLoop();
            continue;
        }

        try {
            await commitPrimitive(
                await eda.pcb_PrimitiveComponent.modify(primitive, {
                    x: mmToMil(component.x),
                    y: mmToMil(component.y),
                    rotation: normalizeRotation(component.rotate),
                    layer: layerToComponent(component.layer),
                }),
                "modify returned undefined",
            );

            eda.sys_Log.add(
                `PCB component placed: ${designator} at ${component.x}mm ${component.y}mm rot: ${normalizeRotation(component.rotate)} layer: ${component.layer}`,
                ESYS_LogType.INFO,
            );
        } catch (error) {
            warning(`PCB component placement failed ${component.designator}: ${(error as Error).message}`);
        }

        if (VERSION_EDASYEDA[0] >= 3) {
            const attrs = await eda.pcb_PrimitiveAttribute.getAll(primitive.getState_PrimitiveId());
            const attr = attrs.find(a => a.getState_Key() === "Designator");
            if (attr) {
                const modifyBody: Parameters<typeof eda.pcb_PrimitiveAttribute.modify>[1] = {};

                if (component.designatorText) {
                    modifyBody.x = mmToMil(component.designatorText.x);
                    modifyBody.y = mmToMil(component.designatorText.y);
                    modifyBody.valueVisible = true;
                    modifyBody.rotation = component.designatorText.rotate;
                    modifyBody.fontSize = mmToMil(component.designatorText.height);
                    modifyBody.alignMode = EPCB_PrimitiveStringAlignMode.CENTER
                }
                else {
                    modifyBody.valueVisible = false;
                }

                await eda.pcb_PrimitiveAttribute.modify(attr, modifyBody)
                    .then(_ => {
                        eda.sys_Log.add(
                            `PCB skillkscrean placed: at ${modifyBody.x}, ${modifyBody.y}, ${modifyBody.valueVisible}`,
                            ESYS_LogType.INFO,
                        );
                    })
                    .catch(e => {
                        eda.sys_Log.add(
                            `PCB skillkscrean place failed: ${designator}, ${e.message}`,
                            ESYS_LogType.INFO,
                        );
                    });
            }
            else {
                eda.sys_Log.add(
                    `PCB skillkscrean not found: ${designator}`,
                    ESYS_LogType.INFO,
                );
            }
        }
        else {
            eda.sys_Log.add(
                `PCB skillkscrean not placed: VERSION_EDASYEDA[0] >= 3: v${VERSION_EDASYEDA[0]}`,
                ESYS_LogType.INFO,
            );
        }

        await yieldToEventLoop();
    }
}

async function drawTracks(tracks: BoardAssemble["tracks"]) {
    if (!tracks?.length) return;

    for (const track of tracks) {
        const points = track.points.map(pointMmToPcbMil);
        if (points.length < 2) continue;

        const net = safeNetName(track.net);
        if (!net) {
            warning("PCB track skipped: net is empty");
            continue;
        }

        const layer = layerToLine(track.layer);
        const width = validLengthMmToMil(track.width, DEFAULT_POUR_LINE_WIDTH_MM);

        for (let i = 0; i < points.length - 1; i++) {
            const start = points[i];
            const end = points[i + 1];
            if (samePoint(start, end)) continue;

            try {
                await commitPrimitive(
                    await eda.pcb_PrimitiveLine.create(
                        net,
                        layer,
                        start.x,
                        start.y,
                        end.x,
                        end.y,
                        width,
                    ),
                    "create returned undefined",
                );
            } catch (error) {
                warning(`PCB track failed ${net}: ${(error as Error).message}`);
            }

            await yieldToEventLoop();
        }
    }
}

async function createMechanicalHole(via: NonNullable<BoardAssemble["vias"]>[number], index: number) {
    const drill = validLengthMmToMil(via.drill, MIN_COPPER_WIDTH_MM);
    const diameter = Math.max(validLengthMmToMil(via.diameter, via.drill), drill);
    const pad: TPCB_PrimitivePadShape = [EPCB_PrimitivePadShapeType.ELLIPSE, diameter, diameter];
    const hole: TPCB_PrimitivePadHole = [EPCB_PrimitivePadHoleType.ROUND, drill];

    await commitPrimitive(
        await eda.pcb_PrimitivePad.create(
            EPCB_LayerId.MULTI,
            `MH${index + 1}`,
            mmToMil(via.x),
            mmToMil(via.y),
            0,
            pad,
            undefined,
            hole,
            0,
            0,
            0,
            false,
            EPCB_PrimitivePadType.NORMAL,
            undefined,
            null,
            null,
        ),
        "create mechanical hole returned undefined",
    );
}

async function drawVias(vias: BoardAssemble["vias"]) {
    if (!vias?.length) return;

    for (let i = 0; i < vias.length; i++) {
        const via = vias[i];
        const net = safeNetName(via.net);
        const drill = validLengthMmToMil(via.drill, MIN_COPPER_WIDTH_MM);
        const diameter = Math.max(validLengthMmToMil(via.diameter, via.drill), drill);

        try {
            if (net) {
                await commitPrimitive(
                    await eda.pcb_PrimitiveVia.create(
                        net,
                        mmToMil(via.x),
                        mmToMil(via.y),
                        drill,
                        diameter,
                        EPCB_PrimitiveViaType.VIA,
                        null,
                        null,
                    ),
                    "create returned undefined",
                );
            } else {
                await createMechanicalHole(via, i);
            }
        } catch (error) {
            warning(`PCB via failed ${net || "mechanical"}: ${(error as Error).message}`);
        }

        await yieldToEventLoop();
    }
}

function boardPadShape(pad: BoardPad): TPCB_PrimitivePadShape {
    if (pad.shape === "round") {
        const diameter = validLengthMmToMil(pad.diameter ?? pad.width ?? pad.height, MIN_COPPER_WIDTH_MM);
        return [EPCB_PrimitivePadShapeType.ELLIPSE, diameter, diameter];
    }

    const widthMm = validLengthMm(pad.width ?? pad.diameter, MIN_COPPER_WIDTH_MM);
    const heightMm = validLengthMm(pad.height ?? pad.diameter ?? pad.width, widthMm);
    const width = mmToMil(widthMm);
    const height = mmToMil(heightMm);

    if (pad.shape === "oval") {
        return [EPCB_PrimitivePadShapeType.OBLONG, width, height];
    }

    return [EPCB_PrimitivePadShapeType.RECTANGLE, width, height, 0];
}

function boardPadHole(pad: BoardPad): TPCB_PrimitivePadHole | null {
    if (!pad.hole) return null;

    return [EPCB_PrimitivePadHoleType.ROUND, validLengthMmToMil(pad.hole.diameter, MIN_COPPER_WIDTH_MM)];
}

function boardPadLayers(pad: BoardPad): TPCB_LayersOfPad[] {
    if (pad.layer !== "multi") return [layerToPad(pad.layer)];
    if (pad.hole) return [EPCB_LayerId.MULTI];

    return [EPCB_LayerId.TOP, EPCB_LayerId.BOTTOM];
}

async function createBoardPad(pad: BoardPad, name: string, layer: TPCB_LayersOfPad, hole: TPCB_PrimitivePadHole | null) {
    await eda.pcb_PrimitivePad.create(
        layer,
        name,
        mmToMil(pad.x),
        mmToMil(pad.y),
        0,
        boardPadShape(pad),
        safeNetName(pad.net) || undefined,
        hole,
        mmToMil(pad.hole?.x ?? 0),
        mmToMil(pad.hole?.y ?? 0),
    ).catch(e => undefined);
}

async function drawPads(pads: BoardAssemble["pads"]) {
    if (!pads?.length) return;

    for (let i = 0; i < pads.length; i++) {
        const pad = pads[i];
        const name = safePrimitiveName(pad.name.trim() || `P${i + 1}`);
        const hole = boardPadHole(pad);
        const layers = boardPadLayers(pad);

        try {
            for (const layer of layers) {
                await createBoardPad(pad, name, layer, hole);
            }

            eda.sys_Log.add(
                `PCB pad created: ${name} net: ${pad.net || "none"} at ${pad.x}mm ${pad.y}mm layer: ${pad.layer} primitives: ${layers.length}`,
                ESYS_LogType.INFO,
            );
        } catch (error) {
            warning(`PCB pad failed ${name}: ${(error as Error).message}`);
        }

        await yieldToEventLoop();
    }
}

async function drawPolygons(polygons: BoardAssemble["polygons"]) {
    if (!polygons?.length) return;

    for (let i = 0; i < polygons.length; i++) {
        const item = polygons[i];
        const points = normalizePolygonPoints(item.points);
        if (points.length < 3) continue;

        const net = safeNetName(item.net);
        if (!net) {
            warning("PCB polygon skipped: net is empty");
            continue;
        }

        try {
            const polygon = eda.pcb_MathPolygon.createPolygon(polygonSource(points));
            if (!polygon) throw new Error("invalid polygon geometry");

            await createCommittedFill({
                net,
                layer: layerToCopper(item.layer),
                polygon,
                lineWidth: mmToMil(DEFAULT_POUR_LINE_WIDTH_MM),
            });
        } catch (error) {
            warning(`PCB fill polygon failed ${net}: ${(error as Error).message}`);
        }

        await yieldToEventLoop();
    }
}

async function getCopperLayers(): Promise<TPCB_LayersOfCopper[]> {
    const layerCount = await eda.pcb_Layer.getTheNumberOfCopperLayers().catch(error => {
        warning(`PCB copper layer count read failed, fallback to 2 layers: ${(error as Error).message}`);
        return 2;
    });

    const count = Math.min(Math.max(Math.floor(layerCount || 2), 2), 32);
    const layers: TPCB_LayersOfCopper[] = [EPCB_LayerId.TOP];

    for (let i = 0; i < count - 2; i++) {
        layers.push((EPCB_LayerId.INNER_1 + i) as TPCB_LayersOfCopper);
    }

    layers.push(EPCB_LayerId.BOTTOM);
    return layers;
}

function copperLayerName(layer: TPCB_LayersOfCopper) {
    if (layer === EPCB_LayerId.TOP) return "TOP";
    if (layer === EPCB_LayerId.BOTTOM) return "BOTTOM";

    return `INNER_${Number(layer) - Number(EPCB_LayerId.INNER_1) + 1}`;
}

async function removeOldDefaultGroundPours() {
    const oldPours = await eda.pcb_PrimitivePour.getAll(DEFAULT_GND_NET).catch(() => []);
    const targets = oldPours.filter(pour => pour.getState_PourName()?.startsWith(DEFAULT_GND_POUR_PREFIX));

    if (targets.length) {
        await eda.pcb_PrimitivePour.delete(targets).catch(error => {
            warning(`PCB old GND pour cleanup failed: ${(error as Error).message}`);
            return false;
        });
    }
}

async function drawDefaultGroundPours(board: BoardAssemble["board"]) {
    if (!board) return;

    const points = normalizePolygonPoints(board.polygon);
    if (points.length < 3) {
        warning("PCB default GND pour skipped: board polygon must contain at least 3 points");
        return;
    }

    await removeOldDefaultGroundPours();

    const layers = await getCopperLayers();
    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        const layerName = copperLayerName(layer);

        try {
            const polygon = eda.pcb_MathPolygon.createPolygon(polygonSource(points));
            if (!polygon) throw new Error("invalid board polygon geometry");

            const pour = await createCommittedPour({
                net: DEFAULT_GND_NET,
                layer,
                polygon,
                preserveSilos: false,
                pourName: safePrimitiveName(DEFAULT_GND_POUR_PREFIX, layerName),
                pourPriority: i,
                lineWidth: mmToMil(DEFAULT_POUR_LINE_WIDTH_MM),
            });

            await commitPourCopperRegion(pour);
        } catch (error) {
            warning(`PCB default GND pour failed ${layerName}: ${(error as Error).message}`);
        }

        await yieldToEventLoop();
    }
}

async function removeOldDefaultGroundSutureVias() {
    const oldVias = await eda.pcb_PrimitiveVia.getAll(DEFAULT_GND_NET, true).catch(() => []);
    const targets = oldVias.filter(via => via.getState_ViaType() === EPCB_PrimitiveViaType.SUTURE);

    if (targets.length) {
        await eda.pcb_PrimitiveVia.delete(targets).catch(error => {
            warning(`PCB old GND suture via cleanup failed: ${(error as Error).message}`);
            return false;
        });
    }
}

function collectClearanceViolationObjectIds(drcResult: unknown) {
    const ids = new Set<string>();
    const categories = Array.isArray(drcResult) ? drcResult : [];

    for (const category of categories) {
        if (!category || typeof category !== "object") continue;
        const rawCategory = category as Record<string, unknown>;
        if (rawCategory.name !== "Clearance Error") continue;

        const groups = Array.isArray(rawCategory.list) ? rawCategory.list : [];
        for (const group of groups) {
            if (!group || typeof group !== "object") continue;
            const rawGroup = group as Record<string, unknown>;
            const items = Array.isArray(rawGroup.list) ? rawGroup.list : [];

            for (const item of items) {
                if (!item || typeof item !== "object") continue;
                const rawItem = item as Record<string, unknown>;

                if (Array.isArray(rawItem.objs)) {
                    for (const obj of rawItem.objs) {
                        if (typeof obj === "string") ids.add(obj);
                    }
                }

                const explanation = rawItem.explanation;
                const errData = explanation && typeof explanation === "object"
                    ? (explanation as Record<string, unknown>).errData
                    : undefined;
                if (errData && typeof errData === "object") {
                    const rawErrData = errData as Record<string, unknown>;
                    if (typeof rawErrData.obj1 === "string") ids.add(rawErrData.obj1);
                    if (typeof rawErrData.obj2 === "string") ids.add(rawErrData.obj2);
                }
            }
        }
    }

    return ids;
}

async function deleteGroundSutureViasWithClearanceErrors(createdViaIds: Set<string>) {
    if (!createdViaIds.size) return 0;

    const drcResult = await eda.pcb_Drc.check(true, true, true).catch(error => {
        warning(`PCB GND suture via DRC post-clean skipped: ${(error as Error).message}`);
        return [];
    });
    const violationIds = collectClearanceViolationObjectIds(drcResult);
    const deleteIds = [...createdViaIds].filter(id => violationIds.has(id));

    if (!deleteIds.length) return 0;

    const deleted = await eda.pcb_PrimitiveVia.delete(deleteIds).catch(error => {
        warning(`PCB GND suture via DRC post-clean delete failed: ${(error as Error).message}`);
        return false;
    });

    if (!deleted) return 0;

    eda.sys_Log.add(`PCB GND suture via DRC post-clean deleted: ${deleteIds.length}`, ESYS_LogType.INFO);
    return deleteIds.length;
}

async function drawDefaultGroundSutureVias(board: BoardAssemble["board"], options: GroundSutureOptions = {}) {
    if (!board) return { created: 0, skipped: true };

    const points = normalizePolygonPoints(board.polygon);
    if (points.length < 3) {
        warning("PCB GND suture vias skipped: board polygon must contain at least 3 points");
        return { created: 0, skipped: true };
    }

    await removeOldDefaultGroundSutureVias();

    const gridMm = validLengthMm(options.gridMm, 4);
    const drillMm = validLengthMm(options.drillMm, 0.305);
    const diameterMm = Math.max(validLengthMm(options.diameterMm, 0.61), drillMm);
    const edgeMarginMm = Math.max(0, Number.isFinite(options.edgeMarginMm) ? options.edgeMarginMm! : 1);
    const maxCount = Math.max(0, Math.floor(Number.isFinite(options.maxCount) ? options.maxCount! : 500));
    const bounds = polygonBounds(points);
    const drill = mmToMil(drillMm);
    const diameter = mmToMil(diameterMm);
    const createdViaIds = new Set<string>();
    let created = 0;

    outer: for (let x = bounds.minX + edgeMarginMm; x <= bounds.maxX - edgeMarginMm; x += gridMm) {
        for (let y = bounds.minY + edgeMarginMm; y <= bounds.maxY - edgeMarginMm; y += gridMm) {
            if (created >= maxCount) break outer;
            if (!pointInPolygon({ x, y }, points)) continue;

            try {
                const via = await eda.pcb_PrimitiveVia.create(
                    DEFAULT_GND_NET,
                    mmToMil(x),
                    mmToMil(y),
                    drill,
                    diameter,
                    EPCB_PrimitiveViaType.SUTURE
                );
                if (!via) throw new Error('Failed create via')
                createdViaIds.add(via.getState_PrimitiveId());
                created++;
            } catch (error) {
                warning(`PCB GND suture via failed: ${(error as Error).message}`);
            }

            await yieldToEventLoop();
        }
    }

    eda.sys_Log.add(`Create vias: ${created}; ${JSON.stringify(createdViaIds)}`, ESYS_LogType.INFO);
    const deletedByDrc = await deleteGroundSutureViasWithClearanceErrors(createdViaIds);
    return { created, deletedByDrc, skipped: false };
}

export async function pourDefaultGroundAndSutureVias(board: BoardAssemble["board"], options: {
    pourGround?: boolean;
    sutureGround?: boolean;
    suture?: GroundSutureOptions;
} = {}) {
    const pourGround = options.pourGround ?? true;
    const sutureGround = options.sutureGround ?? true;
    const result: { poured?: boolean; suture?: Awaited<ReturnType<typeof drawDefaultGroundSutureVias>> } = {};

    if (pourGround) {
        await drawDefaultGroundPours(board);
        result.poured = true;
    }

    if (sutureGround) {
        result.suture = await drawDefaultGroundSutureVias(board, options.suture);
    }

    await refreshPcbState();
    return result;
}

async function refreshPcbState() {
    await eda.pcb_Document.startCalculatingRatline().catch(error => {
        warning(`PCB ratline recalculation failed: ${(error as Error).message}`);
        return false;
    });
}

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function saveCurrentPcbDocument() {
    const document = await eda.dmt_SelectControl.getCurrentDocumentInfo();
    if (!document || document.documentType !== EDMT_EditorDocumentType.PCB) {
        throw new Error("Current document is not a PCB");
    }

    const saved = await eda.pcb_Document.save(document.uuid);
    if (!saved) throw new Error(`Failed to save PCB document: ${document.uuid}`);

    await delay(PCB_POST_CLEAR_SETTLE_MS);
}

async function assembleBoardTask(board: BoardAssemble) {
    const startTimeTotal = Date.now();
    const logTiming = (label: string, startTime: number) => {
        const duration = Date.now() - startTime;
        const totalElapsed = Date.now() - startTimeTotal;
        eda.sys_Log.add(`Time for PCB ${label}: ${duration}ms (total: ${totalElapsed}ms)`, ESYS_LogType.INFO);
    };
    const runStep = async <T>(label: string, fn: () => Promise<T>) => {
        const startedAt = Date.now();
        eda.sys_Log.add(`Assemble PCB step start: ${label}`, ESYS_LogType.INFO);

        try {
            const result = await fn();
            logTiming(label, startedAt);
            eda.sys_Log.add(`Assemble PCB step done: ${label}`, ESYS_LogType.INFO);
            return result;
        } catch (error) {
            eda.sys_Log.add(`Assemble PCB step error: ${label}: ${(error as Error).message}`, ESYS_LogType.ERROR);
            throw error;
        }
    };

    eda.sys_Message.showToastMessage("Assemble PCB...", ESYS_ToastMessageType.INFO);
    eda.sys_Log.add("Assemble PCB...", ESYS_LogType.INFO);

    await runStep("Checkpoint save", async () => {
        if (eda.checkpointer) await eda.checkpointer.save(true);
        else {
            eda.sys_Log.add("Checkpointer is null", ESYS_LogType.WARNING);
            eda.sys_Message.showToastMessage("Checkpointer is null", ESYS_ToastMessageType.WARNING);
        }
    });

    for (const message of board.warnings ?? []) {
        eda.sys_Log.add(`PCB assemble warning: ${message}`, ESYS_LogType.WARNING);
    }

    await runStep("Clear PCB board", clearCurrentPcbBoard);
    await runStep("Save PCB after clear", saveCurrentPcbDocument);
    await runStep("Draw board outline", () => drawBoardOutline(board.board));
    await runStep("Place components", () => placeComponents(board.components));
    await runStep("Draw pads", () => drawPads(board.pads));
    await runStep("Draw tracks", () => drawTracks(board.tracks));
    await runStep("Draw vias", () => drawVias(board.vias));
    await runStep("Draw copper fills", () => drawPolygons(board.polygons));
    await runStep("Refresh PCB state", refreshPcbState);
    await runStep("Post-assemble settle", yieldToEventLoop);

    const totalDuration = Date.now() - startTimeTotal;
    eda.sys_Message.showToastMessage("PCB assemble complete.", ESYS_ToastMessageType.SUCCESS);
    eda.sys_Log.add(`PCB assemble complete. Total time: ${totalDuration}ms`, ESYS_LogType.INFO);
}

export function assembleBoard(...args: Parameters<typeof assembleBoardTask>) {
    return assembleBoardQueue.add(() => assembleBoardTask(...args));
}
