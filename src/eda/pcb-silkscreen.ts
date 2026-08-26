import {
    SilkscreenAlign,
    SilkscreenDeleteReport,
    SilkscreenDeleteRequest,
    SilkscreenImageEntry,
    SilkscreenImageReport,
    SilkscreenImageRequest,
    SilkscreenLayer,
    SilkscreenTextEntry,
    SilkscreenTextReport,
    SilkscreenTextRequest,
} from "@copilot/shared/types/pcb/silkscreen";
import { assertPcbDocument, readBoardPolygon } from "./pcb";
import { milToMm, mmToMil, round } from "./utils";

/** Высота символа по умолчанию, мм. Ниже ~0.8 мм большинство заводов не печатает надёжно. */
const DEFAULT_HEIGHT_MM = 1.0;
/** Толщина штриха по умолчанию, мм. */
const DEFAULT_LINE_WIDTH_MM = 0.15;

const ALIGN_MODE: Record<SilkscreenAlign, EPCB_PrimitiveStringAlignMode> = {
    left_top: EPCB_PrimitiveStringAlignMode.LEFT_TOP,
    left_middle: EPCB_PrimitiveStringAlignMode.LEFT_MIDDLE,
    left_bottom: EPCB_PrimitiveStringAlignMode.LEFT_BOTTOM,
    center_top: EPCB_PrimitiveStringAlignMode.CENTER_TOP,
    center: EPCB_PrimitiveStringAlignMode.CENTER,
    center_bottom: EPCB_PrimitiveStringAlignMode.CENTER_BOTTOM,
    right_top: EPCB_PrimitiveStringAlignMode.RIGHT_TOP,
    right_middle: EPCB_PrimitiveStringAlignMode.RIGHT_MIDDLE,
    right_bottom: EPCB_PrimitiveStringAlignMode.RIGHT_BOTTOM,
};

function layerToSilkscreen(layer: SilkscreenLayer = 'top') {
    return layer === 'bottom' ? EPCB_LayerId.BOTTOM_SILKSCREEN : EPCB_LayerId.TOP_SILKSCREEN;
}

function silkscreenToLayer(layerId: TPCB_LayersOfImage): SilkscreenLayer | undefined {
    if (layerId === EPCB_LayerId.TOP_SILKSCREEN) return 'top';
    if (layerId === EPCB_LayerId.BOTTOM_SILKSCREEN) return 'bottom';
    return undefined;
}

/**
 * Шрифт должен быть заранее импортирован в EasyEDA — API его не создаёт.
 * Если список шрифтов пуст, пробрасываем запрошенный как есть: проверить
 * нечем, а отказ был бы хуже попытки.
 */
async function resolveFontFamily(requested?: string) {
    const fonts = await eda.sys_FontManager.getFontsList().catch(() => [] as string[]);

    if (requested) {
        if (!fonts.length || fonts.includes(requested)) return requested;
        throw new Error(`Font "${requested}" is not imported into EasyEDA. Available: ${fonts.join(', ')}`);
    }

    if (!fonts.length) {
        throw new Error('EasyEDA reports no available fonts; import a font or pass font_family explicitly.');
    }

    return fonts[0];
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

/** Допуск совпадения позиции, мм. Повторный вызов даёт те же координаты. */
const SAME_POSITION_EPS_MM = 0.05;

/** Кэш существующего текста по слою: getAll заметно дороже одного create. */
function createExistingLookup() {
    const cache = new Map<TPCB_LayersOfImage, IPCB_PrimitiveString[]>();

    return async (layerId: TPCB_LayersOfImage, text: string, x: number, y: number) => {
        let onLayer = cache.get(layerId);

        if (!onLayer) {
            onLayer = await eda.pcb_PrimitiveString.getAll(layerId).catch(() => [] as IPCB_PrimitiveString[]);
            cache.set(layerId, onLayer);
        }

        // Совпадением считается текст на том же месте, а не просто тот же текст:
        // одинаковые подписи в разных точках (GND у двух разных разъёмов, 5V у
        // светодиода и у выхода) обязаны сосуществовать. Иначе вторая молча
        // переезжала бы на место первой, и на плате оставалась бы одна.
        return onLayer.find(primitive =>
            primitive.getState_Text() === text &&
            Math.abs(milToMm(primitive.getState_X()) - x) <= SAME_POSITION_EPS_MM &&
            Math.abs(milToMm(primitive.getState_Y()) - y) <= SAME_POSITION_EPS_MM);
    };
}

export async function addSilkscreenText(request: SilkscreenTextRequest): Promise<SilkscreenTextReport> {
    const items = request?.items ?? [];
    if (!items.length) throw new Error('No silkscreen text items provided');

    await assertPcbDocument('addSilkscreenText');

    const fontFamily = await resolveFontFamily(request.font_family);
    const replaceExisting = request.replace_existing ?? true;
    const findExisting = createExistingLookup();

    // Контур нужен только для предупреждения, поэтому его отсутствие не мешает.
    const boardPolygon = await readBoardPolygon().catch(() => undefined);

    const report: SilkscreenTextReport = {
        added: 0,
        updated: 0,
        failed: [],
        outside_board: [],
        font_family: fontFamily,
    };

    for (const item of items) {
        try {
            if (!item.text?.trim()) throw new Error('Empty text');

            const layer = item.layer ?? 'top';
            const layerId = layerToSilkscreen(layer);
            const height = item.height ?? DEFAULT_HEIGHT_MM;
            const lineWidth = item.line_width ?? DEFAULT_LINE_WIDTH_MM;
            const rotation = item.rotation ?? 0;
            // Не зеркалим: EasyEDA сама отражает нижний слой при отрисовке,
            // и mirror здесь давал бы второе отражение. Проверено на плате.
            const mirror = item.mirror ?? false;
            const alignMode = ALIGN_MODE[item.align ?? 'center'];

            if (boardPolygon && boardPolygon.length >= 3 && !pointInPolygon(item, boardPolygon)) {
                report.outside_board.push(item.text);
            }

            const existing = replaceExisting ? await findExisting(layerId, item.text, item.x, item.y) : undefined;

            if (existing) {
                const updated = await eda.pcb_PrimitiveString.modify(existing, {
                    x: mmToMil(item.x),
                    y: mmToMil(item.y),
                    fontSize: mmToMil(height),
                    lineWidth: mmToMil(lineWidth),
                    alignMode,
                    rotation,
                    mirror,
                });

                if (!updated) throw new Error('EasyEDA rejected the text update');
                report.updated += 1;
            }
            else {
                const created = await eda.pcb_PrimitiveString.create(
                    layerId,
                    mmToMil(item.x),
                    mmToMil(item.y),
                    item.text,
                    fontFamily,
                    mmToMil(height),
                    mmToMil(lineWidth),
                    alignMode,
                    rotation,
                    false,
                    0,
                    mirror,
                    false,
                );

                if (!created) throw new Error('EasyEDA returned no primitive');
                report.added += 1;
            }

            eda.sys_Log.add(
                `Silkscreen text "${item.text}" at ${item.x}mm ${item.y}mm layer: ${layer} height: ${height}mm`,
                ESYS_LogType.INFO,
            );
        } catch (error) {
            const reason = (error as Error).message;
            report.failed.push({ text: item.text, reason });
            eda.sys_Log.add(`Silkscreen text failed "${item.text}": ${reason}`, ESYS_LogType.ERROR);
        }
    }

    const summary = `Silkscreen: ${report.added} added, ${report.updated} updated` +
        (report.failed.length ? `, ${report.failed.length} failed` : '') +
        (report.outside_board.length ? `, ${report.outside_board.length} outside the board` : '');

    eda.sys_Message.showToastMessage(
        summary,
        report.failed.length ? ESYS_ToastMessageType.WARNING : ESYS_ToastMessageType.SUCCESS,
    );

    return report;
}

/**
 * Наносит векторный контур (обычно логотип из SVG) на слой шелкографии.
 *
 * Кольца приходят уже линеаризованными и в мм — разбор SVG живёт в
 * MCP-сервере, где его можно проверить без EasyEDA.
 */
export async function addSilkscreenImage(request: SilkscreenImageRequest): Promise<SilkscreenImageReport> {
    await assertPcbDocument('addSilkscreenImage');

    const rings = request?.rings ?? [];
    if (!rings.length) throw new Error('No outline rings provided');

    const layer = request.layer ?? 'bottom';
    const layerId = layerToSilkscreen(layer);
    // См. комментарий про mirror в addSilkscreenText: нижний слой EasyEDA
    // отражает сама, дополнительное зеркалирование его переворачивает обратно.
    const mirror = request.mirror ?? false;

    const validRings = rings.filter(ring => ring.length >= 3);
    if (!validRings.length) throw new Error('All outline rings are degenerate');

    const sources = validRings.map(ring => {
        const at = (point: { x: number, y: number }) => [mmToMil(point.x), mmToMil(point.y)];
        const source: (string | number)[] = [...at(ring[0]), 'L'];

        for (let i = 1; i < ring.length; i++) {
            source.push(...at(ring[i]));
        }

        return source as TPCB_PolygonSourceArray;
    });

    // Замерено на плате: положение задаётся только аргументами create, а
    // координаты колец дают лишь форму. Точка (x, y) становится ПРАВЫМ ВЕРХНИМ
    // углом габарита, поэтому для центрирования её сдвигаем на половину размера.
    let outlineMinX = Infinity, outlineMaxX = -Infinity;
    let outlineMinY = Infinity, outlineMaxY = -Infinity;

    for (const ring of validRings) {
        for (const point of ring) {
            outlineMinX = Math.min(outlineMinX, point.x);
            outlineMaxX = Math.max(outlineMaxX, point.x);
            outlineMinY = Math.min(outlineMinY, point.y);
            outlineMaxY = Math.max(outlineMaxY, point.y);
        }
    }

    const outlineWidth = outlineMaxX - outlineMinX;
    const outlineHeight = outlineMaxY - outlineMinY;

    const place = async (anchorX: number, anchorY: number) => {
        const primitive = await eda.pcb_PrimitiveImage.create(
            mmToMil(anchorX),
            mmToMil(anchorY),
            sources,
            layerId,
            request.width === undefined ? undefined : mmToMil(request.width),
            request.height === undefined ? undefined : mmToMil(request.height),
            request.rotation ?? 0,
            mirror,
            false,
        );

        if (!primitive) throw new Error('EasyEDA returned no image primitive');
        return primitive;
    };

    /** Фактические границы отрисованной фигуры — в отличие от x/y, они не врут. */
    const measure = async (primitive: IPCB_PrimitiveImage) => {
        const box = await eda.pcb_Primitive
            .getPrimitivesBBox([primitive.getState_PrimitiveId()])
            .catch(() => undefined);

        if (!box) return undefined;

        return {
            left: round(milToMm(box.minX)),
            right: round(milToMm(box.maxX)),
            bottom: round(milToMm(box.minY)),
            top: round(milToMm(box.maxY)),
        };
    };

    // Якорь по выведенному правилу, а следом контрольный замер: если EasyEDA
    // когда-нибудь поменяет соглашение, разница будет поймана и скомпенсирована,
    // а не превратится в молча съехавший логотип.
    let anchorX = request.x + outlineWidth / 2;
    let anchorY = request.y + outlineHeight / 2;

    let created = await place(anchorX, anchorY);
    let bbox = await measure(created);
    const correction = { x: 0, y: 0 };

    if (bbox) {
        const deltaX = request.x - (bbox.left + bbox.right) / 2;
        const deltaY = request.y - (bbox.top + bbox.bottom) / 2;

        if (Math.abs(deltaX) > 0.01 || Math.abs(deltaY) > 0.01) {
            await eda.pcb_PrimitiveImage.delete(created.getState_PrimitiveId()).catch(() => undefined);

            correction.x = round(deltaX);
            correction.y = round(deltaY);
            anchorX += deltaX;
            anchorY += deltaY;

            created = await place(anchorX, anchorY);
            bbox = await measure(created);
        }
    }

    const boardPolygon = await readBoardPolygon().catch(() => undefined);
    const outsideBoard = Boolean(boardPolygon && boardPolygon.length >= 3 &&
        !pointInPolygon({ x: request.x, y: request.y }, boardPolygon));

    const placedLayer = silkscreenToLayer(created.getState_Layer()) ?? layer;

    const report: SilkscreenImageReport = {
        placed: {
            primitive_id: created.getState_PrimitiveId(),
            // Центр по фактическому габариту; поля x/y примитива хранят якорь,
            // который на отрисовку не влияет.
            x: bbox ? round((bbox.left + bbox.right) / 2) : round(request.x),
            y: bbox ? round((bbox.top + bbox.bottom) / 2) : round(request.y),
            layer: placedLayer,
            width: round(milToMm(created.getState_Width())),
            height: round(milToMm(created.getState_Height())),
            rotation: created.getState_Rotation(),
            mirror: created.getState_HorizonMirror(),
            bbox,
        },
        outside_board: outsideBoard,
        rings: validRings.length,
        points: validRings.reduce((total, ring) => total + ring.length, 0),
        correction,
    };

    eda.sys_Log.add(`Silkscreen image placed on ${placedLayer} at ${request.x}mm ${request.y}mm`, ESYS_LogType.INFO);
    eda.sys_Message.showToastMessage(
        `Silkscreen image placed on ${placedLayer}` + (outsideBoard ? ' (outside the board)' : ''),
        outsideBoard ? ESYS_ToastMessageType.WARNING : ESYS_ToastMessageType.SUCCESS,
    );

    return report;
}

export async function getSilkscreenImages(layer?: SilkscreenLayer): Promise<SilkscreenImageEntry[]> {
    await assertPcbDocument('getSilkscreenImages');

    const layerIds: TPCB_LayersOfImage[] = layer
        ? [layerToSilkscreen(layer)]
        : [EPCB_LayerId.TOP_SILKSCREEN, EPCB_LayerId.BOTTOM_SILKSCREEN];

    const entries: SilkscreenImageEntry[] = [];

    for (const layerId of layerIds) {
        const primitives = await eda.pcb_PrimitiveImage.getAll(layerId).catch(() => [] as IPCB_PrimitiveImage[]);

        for (const primitive of primitives) {
            const primitiveLayer = silkscreenToLayer(primitive.getState_Layer());
            if (!primitiveLayer) continue;

            const box = await eda.pcb_Primitive
                .getPrimitivesBBox([primitive.getState_PrimitiveId()])
                .catch(() => undefined);

            const bbox = box ? {
                left: round(milToMm(box.minX)),
                right: round(milToMm(box.maxX)),
                bottom: round(milToMm(box.minY)),
                top: round(milToMm(box.maxY)),
            } : undefined;

            entries.push({
                primitive_id: primitive.getState_PrimitiveId(),
                // Центр по габариту: getState_X/Y хранят якорь, не положение.
                x: bbox ? round((bbox.left + bbox.right) / 2) : round(milToMm(primitive.getState_X())),
                y: bbox ? round((bbox.top + bbox.bottom) / 2) : round(milToMm(primitive.getState_Y())),
                layer: primitiveLayer,
                width: round(milToMm(primitive.getState_Width())),
                height: round(milToMm(primitive.getState_Height())),
                rotation: primitive.getState_Rotation(),
                mirror: primitive.getState_HorizonMirror(),
                bbox,
            });
        }
    }

    return entries;
}

export async function deleteSilkscreenImages(primitiveIds: string[]): Promise<{ deleted: number }> {
    await assertPcbDocument('deleteSilkscreenImages');

    if (!primitiveIds?.length) throw new Error('Pass primitive_ids to delete');

    const deleted = await eda.pcb_PrimitiveImage.delete(primitiveIds);
    if (!deleted) throw new Error('EasyEDA rejected the image delete');

    return { deleted: primitiveIds.length };
}

export async function getSilkscreenText(layer?: SilkscreenLayer): Promise<SilkscreenTextEntry[]> {
    await assertPcbDocument('getSilkscreenText');

    const layerIds: TPCB_LayersOfImage[] = layer
        ? [layerToSilkscreen(layer)]
        : [EPCB_LayerId.TOP_SILKSCREEN, EPCB_LayerId.BOTTOM_SILKSCREEN];

    const entries: SilkscreenTextEntry[] = [];

    for (const layerId of layerIds) {
        const primitives = await eda.pcb_PrimitiveString.getAll(layerId).catch(() => [] as IPCB_PrimitiveString[]);

        for (const primitive of primitives) {
            const primitiveLayer = silkscreenToLayer(primitive.getState_Layer());
            if (!primitiveLayer) continue;

            entries.push({
                primitive_id: primitive.getState_PrimitiveId(),
                text: primitive.getState_Text(),
                x: round(milToMm(primitive.getState_X())),
                y: round(milToMm(primitive.getState_Y())),
                layer: primitiveLayer,
                height: round(milToMm(primitive.getState_FontSize())),
                line_width: round(milToMm(primitive.getState_LineWidth())),
                rotation: primitive.getState_Rotation(),
                mirror: primitive.getState_Mirror(),
            });
        }
    }

    return entries;
}

export async function deleteSilkscreenText(request: SilkscreenDeleteRequest): Promise<SilkscreenDeleteReport> {
    const byId = request?.primitive_ids ?? [];
    const byText = request?.texts ?? [];

    if (!byId.length && !byText.length) {
        throw new Error('Pass primitive_ids or texts to delete');
    }

    const existing = await getSilkscreenText(request.layer);
    const targets = new Set<string>();
    const notFound: string[] = [];

    for (const id of byId) {
        if (existing.some(entry => entry.primitive_id === id)) targets.add(id);
        else notFound.push(id);
    }

    for (const text of byText) {
        const matches = existing.filter(entry => entry.text === text);
        if (!matches.length) notFound.push(text);
        matches.forEach(entry => targets.add(entry.primitive_id));
    }

    if (!targets.size) return { deleted: 0, not_found: notFound };

    const deleted = await eda.pcb_PrimitiveString.delete([...targets]);
    if (!deleted) throw new Error('EasyEDA rejected the silkscreen delete');

    return { deleted: targets.size, not_found: notFound };
}
