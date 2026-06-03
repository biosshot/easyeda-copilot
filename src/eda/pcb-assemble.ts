import { BoardAssemble } from "@copilot/shared/types/pcb/board-assemble";
import PQueue from "p-queue";
import { yieldToEventLoop } from "./utils";

const assembleBoardQueue = new PQueue({ concurrency: 1 });
const MM_TO_MIL = 1000 / 25.4;
const BOARD_OUTLINE_WIDTH_MM = 0.1;
const DEFAULT_POUR_LINE_WIDTH_MM = 0.15;
const MIN_COPPER_WIDTH_MM = 0.01;
const SAME_POINT_EPS = 1e-9;

type BoardPoint = {
    x: number;
    y: number;
};

type BoardLayer = NonNullable<BoardAssemble["components"]>[number]["layer"];

type DoneablePrimitive<T> = {
    isAsync(): boolean;
    done(): Promise<T>;
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

function polygonSource(points: BoardPoint[]): TPCB_PolygonSourceArray {
    const normalized = trimClosingPoint(points).map(pointMmToPcbMil);
    const [first, ...rest] = normalized;

    return [
        first.x,
        first.y,
        "L",
        ...rest.flatMap(point => [point.x, point.y]),
    ] as TPCB_PolygonSourceArray;
}

function safeNetName(net: string | undefined) {
    return net?.trim() ?? "";
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

async function commitPrimitive<T extends DoneablePrimitive<T>>(primitive: T | undefined, message: string) {
    if (!primitive) throw new Error(message);

    return primitive.isAsync() ? await primitive.done() : primitive;
}

async function drawBoardOutline(board: BoardAssemble["board"]) {
    if (!board) return;

    const points = trimClosingPoint(board.polygon).map(pointMmToPcbMil);
    if (points.length < 3) {
        warning("PCB board outline skipped: polygon must contain at least 3 points");
        return;
    }

    const oldOutline = await eda.pcb_PrimitiveLine.getAll(undefined, EPCB_LayerId.BOARD_OUTLINE).catch(() => []);
    if (oldOutline.length) {
        await eda.pcb_PrimitiveLine.delete(oldOutline).catch(error => {
            warning(`PCB board outline cleanup failed: ${(error as Error).message}`);
            return false;
        });
    }

    for (let i = 0; i < points.length; i++) {
        const start = points[i];
        const end = points[(i + 1) % points.length];
        if (samePoint(start, end)) continue;

        await commitPrimitive(
            await eda.pcb_PrimitiveLine.create(
                "",
                EPCB_LayerId.BOARD_OUTLINE,
                start.x,
                start.y,
                end.x,
                end.y,
                mmToMil(BOARD_OUTLINE_WIDTH_MM),
            ),
            `Failed to create board outline segment ${i + 1}`,
        );
        await yieldToEventLoop();
    }

    eda.sys_Log.add(`PCB board outline created: ${points.length} points`, ESYS_LogType.INFO);
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
        const points = trimClosingPoint(item.points);
        if (points.length < 3) continue;

        const net = safeNetName(item.net);
        if (!net) {
            warning("PCB polygon skipped: net is empty");
            continue;
        }

        try {
            const polygon = eda.pcb_MathPolygon.createPolygon(polygonSource(points));
            if (!polygon) throw new Error("invalid polygon geometry");

            const pour = await commitPrimitive(
                await eda.pcb_PrimitivePour.create(
                    net,
                    layerToCopper(item.layer),
                    polygon,
                    EPCB_PrimitivePourFillMethod.SOLID,
                    true,
                    `COPPER_${net}_${i + 1}`,
                    undefined,
                    mmToMil(DEFAULT_POUR_LINE_WIDTH_MM),
                ),
                "create returned undefined",
            );

            const poured = await pour.rebuildCopperRegion();
            if (!poured) {
                warning(`PCB polygon copper rebuild returned empty region: ${net}`);
            } else if (poured.isAsync()) {
                await Promise.resolve(poured.done());
            }
        } catch (error) {
            warning(`PCB polygon failed ${net}: ${(error as Error).message}`);
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

    await runStep("Draw board outline", () => drawBoardOutline(board.board));
    await runStep("Place components", () => placeComponents(board.components));
    await runStep("Draw tracks", () => drawTracks(board.tracks));
    await runStep("Draw vias", () => drawVias(board.vias));
    await runStep("Draw copper polygons", () => drawPolygons(board.polygons));
    await runStep("Refresh PCB state", refreshPcbState);
    await runStep("Post-assemble settle", yieldToEventLoop);

    const totalDuration = Date.now() - startTimeTotal;
    eda.sys_Message.showToastMessage("PCB assemble complete.", ESYS_ToastMessageType.SUCCESS);
    eda.sys_Log.add(`PCB assemble complete. Total time: ${totalDuration}ms`, ESYS_LogType.INFO);
}

export function assembleBoard(...args: Parameters<typeof assembleBoardTask>) {
    return assembleBoardQueue.add(() => assembleBoardTask(...args));
}
