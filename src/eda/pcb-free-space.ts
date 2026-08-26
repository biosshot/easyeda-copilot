import { FreeSpaceRequest, FreeSpaceResult } from "@copilot/shared/types/pcb/free-space";
import { assertPcbDocument, readBoardPolygon } from "./pcb";
import { milToMm, round } from "./utils";

interface Rect {
    left: number;
    right: number;
    bottom: number;
    top: number;
}

const mm = (value: number) => milToMm(value);

function rectsOverlap(a: Rect, b: Rect) {
    return a.left < b.right && a.right > b.left && a.bottom < b.top && a.top > b.bottom;
}

function inflate(rect: Rect, by: number): Rect {
    return {
        left: rect.left - by,
        right: rect.right + by,
        bottom: rect.bottom - by,
        top: rect.top + by,
    };
}

function pointInPolygon(point: { x: number, y: number }, polygon: { x: number, y: number }[]) {
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

async function bboxOf(primitiveId: string): Promise<Rect | undefined> {
    const box = await eda.pcb_Primitive.getPrimitivesBBox([primitiveId]).catch(() => undefined);
    if (!box) return undefined;

    return { left: mm(box.minX), right: mm(box.maxX), bottom: mm(box.minY), top: mm(box.maxY) };
}

/**
 * Всё, что нельзя перекрывать. Габариты берём у самого редактора, а не считаем
 * по корпусу: только так учитываются крепёжные пятаки и прочие выступы.
 */
async function collectObstacles(layer: 'top' | 'bottom') {
    const obstacles: Rect[] = [];
    const layerId = layer === 'bottom' ? EPCB_LayerId.BOTTOM : EPCB_LayerId.TOP;
    const silkLayerId = layer === 'bottom' ? EPCB_LayerId.BOTTOM_SILKSCREEN : EPCB_LayerId.TOP_SILKSCREEN;

    const components = await eda.pcb_PrimitiveComponent.getAll().catch(() => [] as IPCB_PrimitiveComponent[]);
    for (const component of components) {
        // Сквозные детали мешают на обоих слоях, поэтому по слою не отсеиваем:
        // выводы всё равно вылезут на другую сторону.
        const box = await bboxOf(component.getState_PrimitiveId());
        if (box) obstacles.push(box);
    }

    const strings = await eda.pcb_PrimitiveString.getAll(silkLayerId).catch(() => [] as IPCB_PrimitiveString[]);
    for (const primitive of strings) {
        const box = await bboxOf(primitive.getState_PrimitiveId());
        if (box) obstacles.push(box);
    }

    const images = await eda.pcb_PrimitiveImage.getAll(silkLayerId).catch(() => [] as IPCB_PrimitiveImage[]);
    for (const primitive of images) {
        const box = await bboxOf(primitive.getState_PrimitiveId());
        if (box) obstacles.push(box);
    }

    const vias = await eda.pcb_PrimitiveVia.getAll().catch(() => [] as IPCB_PrimitiveVia[]);
    for (const via of vias) {
        const x = mm(via.getState_X());
        const y = mm(via.getState_Y());
        const radius = mm(via.getState_Diameter()) / 2;
        obstacles.push({ left: x - radius, right: x + radius, bottom: y - radius, top: y + radius });
    }

    void layerId;
    return obstacles;
}

export async function findPcbFreeSpace(request: FreeSpaceRequest): Promise<FreeSpaceResult> {
    await assertPcbDocument('findPcbFreeSpace');

    const width = request?.width;
    const height = request?.height;
    if (!(width > 0) || !(height > 0)) throw new Error('width and height must be positive');

    const layer = request.layer ?? 'top';
    const clearance = Math.max(0, request.clearance ?? 0.3);
    const edgeMargin = Math.max(0, request.edge_margin ?? 0.5);

    const boardPolygon = await readBoardPolygon().catch(() => undefined);
    if (!boardPolygon || boardPolygon.length < 3) {
        return { found: false, obstacles: 0, reason: 'Board outline is missing' };
    }

    const obstacles = (await collectObstacles(layer)).map(rect => inflate(rect, clearance));

    let anchor = { x: 0, y: 0 };

    if (request.near_designator) {
        const components = await eda.pcb_PrimitiveComponent.getAll().catch(() => [] as IPCB_PrimitiveComponent[]);
        const target = components.find(c => c.getState_Designator() === request.near_designator);

        if (!target) {
            return { found: false, obstacles: obstacles.length, reason: `Component not found: ${request.near_designator}` };
        }

        anchor = { x: mm(target.getState_X()), y: mm(target.getState_Y()) };
    }
    else if (Number.isFinite(request.near_x) && Number.isFinite(request.near_y)) {
        anchor = { x: request.near_x!, y: request.near_y! };
    }
    else {
        const xs = boardPolygon.map(p => p.x);
        const ys = boardPolygon.map(p => p.y);
        anchor = {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2,
        };
    }

    const xs = boardPolygon.map(p => p.x);
    const ys = boardPolygon.map(p => p.y);
    const bounds = {
        left: Math.min(...xs) + edgeMargin,
        right: Math.max(...xs) - edgeMargin,
        bottom: Math.min(...ys) + edgeMargin,
        top: Math.max(...ys) - edgeMargin,
    };

    const halfW = width / 2;
    const halfH = height / 2;

    const fits = (cx: number, cy: number) => {
        const rect: Rect = { left: cx - halfW, right: cx + halfW, bottom: cy - halfH, top: cy + halfH };

        if (rect.left < bounds.left || rect.right > bounds.right ||
            rect.bottom < bounds.bottom || rect.top > bounds.top) return false;

        // Площадка должна целиком лежать внутри контура, а не только центром.
        for (const corner of [
            { x: rect.left, y: rect.bottom }, { x: rect.right, y: rect.bottom },
            { x: rect.right, y: rect.top }, { x: rect.left, y: rect.top },
        ]) {
            if (!pointInPolygon(corner, boardPolygon)) return false;
        }

        return !obstacles.some(obstacle => rectsOverlap(rect, obstacle));
    };

    const step = 0.5;
    let best: { x: number, y: number, distance: number } | undefined;

    for (let cx = bounds.left + halfW; cx <= bounds.right - halfW; cx += step) {
        for (let cy = bounds.bottom + halfH; cy <= bounds.top - halfH; cy += step) {
            if (!fits(cx, cy)) continue;

            const distance = Math.hypot(cx - anchor.x, cy - anchor.y);
            if (!best || distance < best.distance) best = { x: cx, y: cy, distance };
        }
    }

    if (!best) {
        return {
            found: false,
            obstacles: obstacles.length,
            reason: `No free ${width}x${height}mm area on the ${layer} side with ${clearance}mm clearance`,
        };
    }

    return {
        found: true,
        x: round(best.x),
        y: round(best.y),
        distance: round(best.distance),
        obstacles: obstacles.length,
    };
}
