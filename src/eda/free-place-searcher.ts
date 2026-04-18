import { getBBox } from "./utils";

interface Offset {
    x: number | undefined;
    y: number | undefined
}

export async function searchFreePlaceV2(targetPoint: { x: number, y: number }, tagetSize: { w: number, h: number }, ignoreDisgnators?: string[]): Promise<Offset> {
    let componentsOnSch = (await eda.sch_PrimitiveComponent.getAll().catch(e => []))
        .filter(c => c.getState_ComponentType() === ESCH_PrimitiveComponentType.COMPONENT ||
            c.getState_ComponentType() === ESCH_PrimitiveComponentType.NET_PORT || c.getState_ComponentType() === ESCH_PrimitiveComponentType.NET_FLAG)

    if (ignoreDisgnators?.length)
        componentsOnSch = componentsOnSch.filter(c => !ignoreDisgnators.includes(c.getState_Designator?.() ?? ''));

    const PADDING = 40;

    const busyRects = await Promise.all(componentsOnSch.map(async comp => {
        const bbox = await getBBox([comp]).catch(e => undefined);
        if (!bbox)
            return {
                x: comp.getState_X() - 50,
                y: comp.getState_Y() - 50,
                w: 100,
                h: 100
            }

        return {
            x: bbox.minX - PADDING,
            y: (-bbox.minY) + PADDING,
            w: bbox.width + PADDING * 2,
            h: bbox.height + PADDING * 2
        }
    }));
    // eda.sys_Log.add(`busyRects[0]: ${JSON.stringify(busyRects[0])}`);

    const wires = await eda.sch_PrimitiveWire.getAll().catch(e => []);

    for (const wire of wires) {
        const line_ = wire.getState_Line();
        const line = (Array.isArray(line_[0]) ? line_ : [line_]) as number[][];

        for (const segment of line) {
            if (segment.length !== 4) {
                eda.sys_Log.add(`Not allowed wire segmemt: ${JSON.stringify(segment)}`);
                continue;
            }
            const rect = {
                h: Math.abs((-segment[1]) - (-segment[3])) + PADDING * 2,
                w: Math.abs(segment[0] - segment[2]) + PADDING * 2,
                y: Math.max(-segment[1], -segment[3]) + PADDING,
                x: Math.min(segment[0], segment[2]) - PADDING,
            };
            busyRects.push(rect);

            // eda.sys_Log.add(`Add busy wire segmemt: ${JSON.stringify(rect)}`);
        }
    }

    const STEP = 80;
    eda.sys_Log.add(`${JSON.stringify(busyRects)}`)
    eda.sys_Log.add(`${JSON.stringify(targetPoint)}`)
    eda.sys_Log.add(`${JSON.stringify(tagetSize)}`)

    // Функция проверки пересечения двух прямоугольников
    function isOverlap(rect1: { x: number, y: number, w: number, h: number }, rect2: { x: number, y: number, w: number, h: number }): boolean {
        return rect2.x < rect1.x + rect1.w &&
            rect2.x + rect2.w > rect1.x &&
            rect2.y > rect1.y - rect1.h &&
            rect2.y - rect2.h < rect1.y;
    }

    // Проверяет, свободно ли место для прямоугольника с центром в (cx, cy)
    function isFree(cx: number, cy: number): boolean {
        const targetRect = {
            x: cx,
            y: cy,
            w: tagetSize.w,
            h: tagetSize.h
        };
        return !busyRects.some(rect => isOverlap(targetRect, rect));
    }

    // Если начальная точка свободна — возвращаем её
    if (isFree(targetPoint.x, targetPoint.y)) {
        return targetPoint;
    }

    // Поиск по расширяющемуся квадрату
    const MAX_RADIUS = 10000; // ограничение на максимальный радиус (в шагах)
    for (let radius = STEP; radius <= MAX_RADIUS; radius += STEP) {
        // Перебираем все точки на границе квадрата от -radius до +radius
        for (let dx = -radius; dx <= radius; dx += STEP) {
            for (let dy = -radius; dy <= radius; dy += STEP) {
                // Проверяем, что точка находится именно на границе текущего радиуса,
                // чтобы не дублировать проверки с меньшими радиусами
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) {
                    continue;
                }
                const candidateX = targetPoint.x + dx;
                const candidateY = targetPoint.y + dy;
                if (isFree(candidateX, candidateY)) {
                    return { x: candidateX, y: candidateY };
                }
            }
        }
    }

    // Если свободное место не найдено
    // return null;
    throw new Error('Sch is full not found free place')
}