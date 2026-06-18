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
    delete(primitiveIds: Array<string>): Promise<boolean>;
};

async function clearPrimitiveGroup(name: string, api: PcbPrimitiveCleanupApi) {
    const ids = await withTimeout(
        api.getAllPrimitiveId(),
        PCB_CLEAR_TIMEOUT_MS,
        `PCB cleanup ${name} get timeout`,
    ).catch(error => {
        warning(`PCB cleanup ${name} get failed: ${(error as Error).message}`);
        return [];
    });

    if (!ids.length) return;

    await withTimeout(
        api.delete(ids),
        PCB_CLEAR_TIMEOUT_MS,
        `PCB cleanup ${name} delete timeout`,
    ).catch(error => {
        warning(`PCB cleanup ${name} delete failed: ${(error as Error).message}`);
        return false;
    });

    await yieldToEventLoop();
}

async function clearCurrentPcbBoard() {
    const groups: Array<[string, PcbPrimitiveCleanupApi]> = [
        ["pour", eda.pcb_PrimitivePour],
        ["fill", eda.pcb_PrimitiveFill],
        ["region", eda.pcb_PrimitiveRegion],
        ["via", eda.pcb_PrimitiveVia],
        ["line", eda.pcb_PrimitiveLine],
        ["arc", eda.pcb_PrimitiveArc],
        ["polyline", eda.pcb_PrimitivePolyline],
        // ["string", eda.pcb_PrimitiveString],
        // ["attribute", eda.pcb_PrimitiveAttribute],
        ["pad", eda.pcb_PrimitivePad],
        ["dimension", eda.pcb_PrimitiveDimension],
        ["image", eda.pcb_PrimitiveImage],
        ["object", eda.pcb_PrimitiveObject],
    ];

    for (const [name, api] of groups) {
        await clearPrimitiveGroup(name, api);
    }
}

async function commitPrimitive<T extends DoneablePrimitive<T>>(primitive: T | undefined, message: string) {
    if (!primitive) throw new Error(message);

    return await Promise.resolve(primitive.done());
}

async function commitPourCopperRegion(pour: IPCB_PrimitivePour, net: string) {
    const poured = await pour.rebuildCopperRegion();
    if (!poured) {
        warning(`PCB polygon copper rebuild returned empty region: ${net}`);
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
                    designator,
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

            // await commitPourCopperRegion(pour, DEFAULT_GND_NET);
        } catch (error) {
            warning(`PCB default GND pour failed ${layerName}: ${(error as Error).message}`);
        }

        await yieldToEventLoop();
    }
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
    await runStep("Draw tracks", () => drawTracks(board.tracks));
    await runStep("Draw vias", () => drawVias(board.vias));
    await runStep("Draw copper fills", () => drawPolygons(board.polygons));
    await runStep("Draw default GND pours", () => drawDefaultGroundPours(board.board));
    await runStep("Refresh PCB state", refreshPcbState);
    await runStep("Post-assemble settle", yieldToEventLoop);

    const totalDuration = Date.now() - startTimeTotal;
    eda.sys_Message.showToastMessage("PCB assemble complete.", ESYS_ToastMessageType.SUCCESS);
    eda.sys_Log.add(`PCB assemble complete. Total time: ${totalDuration}ms`, ESYS_LogType.INFO);
}

export function assembleBoard(...args: Parameters<typeof assembleBoardTask>) {
    return assembleBoardQueue.add(() => assembleBoardTask(...args));
}
