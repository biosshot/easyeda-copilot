import { BoardAssemble } from "@copilot/shared/types/pcb/board-assemble";
import PQueue from "p-queue";
import { VERSION_EDASYEDA, withTimeout, yieldToEventLoop } from "./utils";

const assembleBoardQueue = new PQueue({ concurrency: 1 });
const MM_TO_MIL = 1000 / 25.4;
const BOARD_OUTLINE_WIDTH_MM = 0.254;
const DEFAULT_POUR_LINE_WIDTH_MM = 0.15;
const MIN_COPPER_WIDTH_MM = 0.01;
const SAME_POINT_EPS = 1e-9;
const PCB_CLEAR_TIMEOUT_MS = 5000;
const COPILOT_PAD_PREFIX = "copilot_";
const VIA_SOLDER_MASK_EXPANSION: IPCB_PrimitiveSolderMaskAndPasteMaskExpansion = {
    topSolderMask: 0,
    bottomSolderMask: 0,
};

type BoardPoint = {
    x: number;
    y: number;
};

type BoardLayer = NonNullable<BoardAssemble["components"]>[number]["layer"];
type BoardPad = NonNullable<BoardAssemble["pads"]>[number];
type BoardPadLayer = BoardPad["layer"];

export type ClearPcbBoardOptions = {
    ignoreToClearNet?: string[];
    clearOnlyNet?: string[];
    preserveBoardOutline?: boolean;
    items?: Array<'tracks' | 'vias' | 'zones'>;
    strict?: boolean;
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
    const groups: Array<[string, 'tracks' | 'vias' | 'zones', { api: PcbPrimitiveCleanupApi, filter?: (id: string) => boolean }]> = [
        ["pour", "zones", { api: eda.pcb_PrimitivePour }],
        ["fill", "zones", { api: eda.pcb_PrimitiveFill }],
        ["region", "zones", { api: eda.pcb_PrimitiveRegion }],
        ["via", "vias", { api: eda.pcb_PrimitiveVia }],
        ["line", "tracks", { api: eda.pcb_PrimitiveLine }],
        ["arc", "tracks", { api: eda.pcb_PrimitiveArc }],
        ["polyline", "tracks", { api: eda.pcb_PrimitivePolyline }],
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

    for (const [name, item, api] of groups) {
        if (options.items?.length && !options.items.includes(item)) continue;
        let ids: string[] = [];

        if (needsPrimitiveRead) {
            if (!api.api.getAll) {
                const message = `PCB cleanup ${name} cannot filter primitives with this EasyEDA API`;
                if (options.strict) throw new Error(message);
                warning(`${message}; skipped`);
                continue;
            }

            let primitives: Awaited<ReturnType<NonNullable<PcbPrimitiveCleanupApi['getAll']>>>;
            try {
                primitives = await withTimeout(
                    api.api.getAll(),
                    PCB_CLEAR_TIMEOUT_MS,
                    `PCB cleanup ${name} get timeout`,
                );
            } catch (error) {
                if (options.strict) throw error;
                warning(`PCB cleanup ${name} get failed: ${(error as Error).message}`);
                primitives = [];
            }

            ids = primitives
                .filter(primitive => shouldClearPrimitive(primitive, options))
                .map(primitive => primitive.getState_PrimitiveId?.())
                .filter((id): id is string => Boolean(id));
        } else {
            try {
                ids = await withTimeout(
                    api.api.getAllPrimitiveId(),
                    PCB_CLEAR_TIMEOUT_MS,
                    `PCB cleanup ${name} get timeout`,
                );
            } catch (error) {
                if (options.strict) throw error;
                warning(`PCB cleanup ${name} get failed: ${(error as Error).message}`);
                ids = [];
            }
        }

        if (!ids.length) continue;
        if (api.filter) ids = ids.filter(api.filter)

        try {
            const removed = await withTimeout(
                api.api.delete(ids),
                PCB_CLEAR_TIMEOUT_MS,
                `PCB cleanup ${name} delete timeout`,
            );
            if (options.strict && removed === false) throw new Error(`PCB cleanup ${name} delete returned false`);
        } catch (error) {
            if (options.strict) throw error;
            warning(`PCB cleanup ${name} delete failed: ${(error as Error).message}`);
        }
        deleted[name] = (deleted[name] ?? 0) + ids.length;

        await yieldToEventLoop();
    }

    return { deleted };
}

async function commitPrimitive<T extends DoneablePrimitive<T>>(primitive: T | undefined, message: string) {
    if (!primitive) throw new Error(message);

    return await Promise.resolve(primitive.done());
}

async function createCommittedPour(args: {
    net: string;
    layer: TPCB_LayersOfCopper;
    polygon: IPCB_Polygon;
    pourFillMethod?: EPCB_PrimitivePourFillMethod;
    preserveSilos?: boolean;
    pourName: string;
    pourPriority: number;
    lineWidth: number;
}) {
    const create = async (pourName: string | undefined, message: string) => {
        const pour = await eda.pcb_PrimitivePour.create(
            args.net,
            args.layer,
            args.polygon,
            args.pourFillMethod ?? EPCB_PrimitivePourFillMethod.SOLID,
            args.preserveSilos,
            pourName,
            args.pourPriority,
            args.lineWidth,
        );
        if (!pour) throw new Error(message);
        return pour;
    };

    try {
        return await create(args.pourName, 'create returned undefined');
    } catch (firstError) {
        eda.sys_Log.add(
            `PCB pour create retry without pourName: ${args.net}: ${(firstError as Error).message}`,
            ESYS_LogType.WARNING,
        );

        try {
            return await create(
                undefined,
                `create returned undefined after retry: ${(firstError as Error).message}`,
            );
        } catch (retryError) {
            throw new Error(
                `PCB pour create failed after retry: ${retryError instanceof Error ? retryError.message : String(retryError)}`,
            );
        }
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

    const polygon = eda.pcb_MathPolygon.createPolygon(polygonSource(board.polygon));
    if (!polygon) {
        warning("PCB board outline skipped: invalid polygon geometry");
        return;
    }

    const oldOutlineLines = await eda.pcb_PrimitiveLine.getAll(undefined, EPCB_LayerId.BOARD_OUTLINE);
    if (oldOutlineLines.length) {
        const deleted = await eda.pcb_PrimitiveLine.delete(oldOutlineLines);
        if (!deleted) throw new Error("Failed to delete existing board outline lines");
    }

    const oldOutlineArcs = await eda.pcb_PrimitiveArc.getAll(undefined, EPCB_LayerId.BOARD_OUTLINE);
    if (oldOutlineArcs.length) {
        const deleted = await eda.pcb_PrimitiveArc.delete(oldOutlineArcs);
        if (!deleted) throw new Error("Failed to delete existing board outline arcs");
    }

    const oldOutlinePolylines = await eda.pcb_PrimitivePolyline.getAll(undefined, EPCB_LayerId.BOARD_OUTLINE);
    if (oldOutlinePolylines.length) {
        const deleted = await eda.pcb_PrimitivePolyline.delete(oldOutlinePolylines);
        if (!deleted) throw new Error("Failed to delete existing board outline polylines");
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
                        VIA_SOLDER_MASK_EXPANSION,
                        false,
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

async function deleteOldBoardPads() {
    const existing = await eda.pcb_PrimitivePad.getAll().catch(error => {
        throw new Error(`Failed to read existing PCB pads: ${(error as Error).message}`);
    });
    const copilotPads = existing.filter(pad => (
        typeof (pad as IPCB_PrimitivePad & {
            getState_ParentComponentPrimitiveId?: () => string;
        }).getState_ParentComponentPrimitiveId !== "function"
        && pad.getState_PadNumber().startsWith(COPILOT_PAD_PREFIX)
    ));

    if (!copilotPads.length) return;

    const deleted = await eda.pcb_PrimitivePad.delete(copilotPads);
    if (!deleted) throw new Error("Failed to delete existing Copilot PCB pads");

    eda.sys_Log.add(`PCB old Copilot pads deleted: ${copilotPads.length}`, ESYS_LogType.INFO);
}

async function drawPads(pads: BoardAssemble["pads"]) {
    if (!pads?.length) return;
    await deleteOldBoardPads();

    for (let i = 0; i < pads.length; i++) {
        const pad = pads[i];
        const name = safePrimitiveName(COPILOT_PAD_PREFIX, pad.name.trim() || `P${i + 1}`);
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

export type RoutingCopperApplication = {
    copperLayerCount?: number;
    clearRouting?: {
        tracks?: 'all' | string[];
        vias?: 'all' | string[];
        zones?: 'all' | string[];
    };
    tracks: Array<{
        id?: string;
        net: string;
        layer: number;
        widthMm: number;
        points: BoardPoint[];
    }>;
    vias: Array<{
        id?: string;
        net: string;
        x: number;
        y: number;
        diameterMm: number;
        drillMm: number;
    }>;
    zones: Array<{
        id?: string;
        net: string;
        layers: number[];
        points: BoardPoint[];
        priority?: number;
        minThicknessMm?: number;
        clearanceMm?: number;
        connection?: 'solid' | 'thermal' | 'none';
        fill?: {
            style: 'solid' | 'hatched';
            hatchThicknessMm?: number;
            hatchGapMm?: number;
            hatchOrientationDeg?: number;
        };
        padConnection?: {
            mode: 'solid' | 'thermal' | 'none';
            thermalGapMm?: number;
            spokeWidthMm?: number;
            spokeCount?: number;
            spokeAngleDeg?: number;
        };
        removeIslandsBelowMm2?: number;
    }>;
};

type SupportedCopperLayerCount = 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20 | 22 | 24 | 26 | 28 | 30 | 32;

function supportedCopperLayerCount(value: number): SupportedCopperLayerCount {
    if (Number.isInteger(value) && value >= 2 && value <= 32 && value % 2 === 0) {
        return value as SupportedCopperLayerCount;
    }
    throw new Error(`Unsupported PCB copper layer count: ${value}. Expected an even number from 2 to 32.`);
}

async function applyRoutingCopperLayerCount(requestedValue?: number) {
    if (requestedValue === undefined) return undefined;

    const requested = supportedCopperLayerCount(requestedValue);
    const previous = await eda.pcb_Layer.getTheNumberOfCopperLayers();
    if (previous === requested) return { requested, previous, actual: previous, changed: false };

    const success = await eda.pcb_Layer.setTheNumberOfCopperLayers(requested);
    if (!success) throw new Error(`EasyEDA rejected PCB copper layer count ${requested}`);
    await yieldToEventLoop();

    const actual = await eda.pcb_Layer.getTheNumberOfCopperLayers();
    if (actual !== requested) {
        throw new Error(`EasyEDA reported ${actual} copper layers after requesting ${requested}`);
    }
    return { requested, previous, actual, changed: true };
}

function routingCopperLayer(value: number): TPCB_LayersOfCopper {
    if (value === Number(EPCB_LayerId.TOP)) return EPCB_LayerId.TOP;
    if (value === Number(EPCB_LayerId.BOTTOM)) return EPCB_LayerId.BOTTOM;
    if (Number.isInteger(value) && value >= Number(EPCB_LayerId.INNER_1) && value <= Number(EPCB_LayerId.INNER_30)) {
        return value as TPCB_LayersOfCopper;
    }
    throw new Error(`Unsupported EasyEDA routing layer: ${value}`);
}

async function drawRoutingTracks(tracks: RoutingCopperApplication['tracks']) {
    for (const track of tracks) {
        const layer = routingCopperLayer(track.layer) as TPCB_LayersOfLine;
        const width = validLengthMmToMil(track.widthMm, DEFAULT_POUR_LINE_WIDTH_MM);
        const points = track.points.map(pointMmToPcbMil);
        for (let index = 0; index < points.length - 1; index++) {
            const start = points[index];
            const end = points[index + 1];
            if (samePoint(start, end)) continue;
            const primitive = await eda.pcb_PrimitiveLine.create(
                track.net,
                layer,
                start.x,
                start.y,
                end.x,
                end.y,
                width,
                false,
            );
            if (!primitive) throw new Error(`Failed to create routed track ${track.id ?? track.net}`);
            await yieldToEventLoop();
        }
    }
}

async function drawRoutingVias(vias: RoutingCopperApplication['vias']) {
    for (const [index, via] of vias.entries()) {
        const drill = validLengthMmToMil(via.drillMm, MIN_COPPER_WIDTH_MM);
        const diameter = Math.max(validLengthMmToMil(via.diameterMm, via.drillMm), drill);
        const label = via.id ?? `${via.net} #${index + 1}`;
        try {
            const primitive = await eda.pcb_PrimitiveVia.create(
                via.net,
                mmToMil(via.x),
                mmToMil(via.y),
                drill,
                diameter,
                EPCB_PrimitiveViaType.VIA,
                null,
                VIA_SOLDER_MASK_EXPANSION,
                false,
            );
            if (!primitive) throw new Error(`Failed to create routed via ${label}`);
        } catch (error) {
            throw new Error(
                `Failed to create routed via ${label}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
        await yieldToEventLoop();
    }
}

async function drawRoutingZones(zones: RoutingCopperApplication['zones']) {
    const pending: Array<{
        pour: IPCB_PrimitivePour;
        zoneLabel: string;
        layerValue: number;
    }> = [];
    for (const zone of zones) {
        const points = normalizePolygonPoints(zone.points);
        for (const layerValue of zone.layers) {
            const zoneLabel = zone.id ?? zone.net;
            try {
                const polygon = eda.pcb_MathPolygon.createPolygon(polygonSource(points));
                if (!polygon) throw new Error('invalid polygon geometry');
                const pour = await createCommittedPour({
                    net: zone.net,
                    layer: routingCopperLayer(layerValue),
                    polygon,
                    pourFillMethod: zone.fill?.style === 'hatched'
                        ? (Math.abs((zone.fill.hatchOrientationDeg ?? 0) % 90 - 45) < 1e-6
                            ? EPCB_PrimitivePourFillMethod.GRID45
                            : EPCB_PrimitivePourFillMethod.GRID)
                        : EPCB_PrimitivePourFillMethod.SOLID,
                    preserveSilos: zone.removeIslandsBelowMm2 === undefined
                        ? undefined
                        : zone.removeIslandsBelowMm2 === 0,
                    pourName: safePrimitiveName('copilot_router', zoneLabel, `L${layerValue}`),
                    pourPriority: zone.priority ?? 0,
                    lineWidth: mmToMil(zone.minThicknessMm ?? DEFAULT_POUR_LINE_WIDTH_MM),
                });
                pending.push({ pour, zoneLabel, layerValue });
            } catch (error) {
                throw new Error(
                    `Failed to apply routing zone ${zoneLabel} on layer ${layerValue}: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
            await yieldToEventLoop();
        }
    }
    return pending;
}

async function rebuildAllRoutingZones() {
    const warnings: string[] = [];
    let rebuilt = 0;
    const pours = await eda.pcb_PrimitivePour.getAll();
    for (const pour of pours) {
        await yieldToEventLoop();
        const primitiveId = pour.getState_PrimitiveId();
        const hydrated = primitiveId
            ? await eda.pcb_PrimitivePour.get(primitiveId).catch(() => undefined)
            : undefined;
        const candidates = hydrated && hydrated !== pour
            ? [hydrated, pour]
            : [hydrated ?? pour];
        let lastError = '';
        let poured: IPCB_PrimitivePoured | undefined;
        for (const candidate of candidates) {
            try {
                poured = await candidate.rebuildCopperRegion();
                if (poured) break;
                lastError = 'rebuild returned an empty region';
            } catch (error) {
                lastError = error instanceof Error ? error.message : String(error);
            }
        }
        if (poured) {
            rebuilt++;
        } else {
            warnings.push(
                `${pour.getState_PourName() || primitiveId || pour.getState_Net()} layer ${pour.getState_Layer()}: ${lastError || 'unknown rebuild error'}`,
            );
        }
    }
    if (warnings.length) {
        warning(
            `PCB pour outlines were created, but ${warnings.length} layer(s) require manual rebuild with Shift+B: ${warnings.join('; ')}`,
        );
    }
    return { rebuilt, pending: warnings.length, warnings };
}

async function routingApplicationStep<T>(stage: string, action: () => Promise<T>) {
    try {
        return await action();
    } catch (error) {
        throw new Error(
            `Routing ${stage} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

/** Apply a validated router result after the caller has created one outer checkpoint. */
export async function applyRoutingCopper(application: RoutingCopperApplication) {
    const copperLayerCount = await routingApplicationStep(
        'copper layer count application',
        () => applyRoutingCopperLayerCount(application.copperLayerCount),
    );
    const activeLayers = new Set((await routingApplicationStep(
        'layer validation',
        getCopperLayers,
    )).map(Number));
    for (const layer of application.tracks.map(item => item.layer).concat(
        application.zones.flatMap(item => item.layers),
    )) {
        if (!activeLayers.has(layer)) throw new Error(`Routing result targets inactive copper layer: ${layer}`);
    }

    const cleared = application.clearRouting ? await routingApplicationStep('copper cleanup', async () => {
        const results: ClearPcbBoardResult[] = [];
        for (const item of ['tracks', 'vias', 'zones'] as const) {
            const nets = application.clearRouting?.[item];
            if (!nets) continue;
            results.push(await clearCurrentPcbBoard({
                preserveBoardOutline: true,
                strict: true,
                items: [item],
                ...(nets === 'all' ? {} : { clearOnlyNet: [...nets] }),
            }));
        }
        return results;
    }) : undefined;
    await routingApplicationStep('track creation', () => drawRoutingTracks(application.tracks));
    await routingApplicationStep('via creation', () => drawRoutingVias(application.vias));
    await routingApplicationStep('zone creation', () => drawRoutingZones(application.zones));
    await routingApplicationStep('ratline refresh', () => refreshPcbState(true));
    const zoneRebuild = await routingApplicationStep('zone rebuild', () => rebuildAllRoutingZones());
    return {
        applied: true,
        copperLayerCount,
        cleared,
        tracks: application.tracks.length,
        vias: application.vias.length,
        zones: application.zones.length,
        zoneRebuild,
    };
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

async function refreshPcbState(strict = false) {
    try {
        const refreshed = await eda.pcb_Document.startCalculatingRatline();
        if (strict && refreshed === false) throw new Error('PCB ratline recalculation returned false');
    } catch (error) {
        if (strict) throw error;
        warning(`PCB ratline recalculation failed: ${(error as Error).message}`);
    }
}

async function assembleBoardTask(board: BoardAssemble) {
    if (VERSION_EDASYEDA[0] < 3) throw new Error(`EasyEda version required >= 3, current ${VERSION_EDASYEDA[0]}`);
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
