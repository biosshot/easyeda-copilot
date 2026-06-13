import { ExplainCircuit } from "@copilot/shared/types/circuit";
import { getSchematic } from "./schematic";
import { findPin, getAllPrimitivePins, getPrimitiveComponentPins, searchComponentInSCH } from "./search";
import { AddedNet } from "./types";
import { getAllWiresByNet, getPrimitiveById, normWireY, normalizeWireLine, rmPartFromDesignator, to2 } from "./utils";

// Типы данных, соответствующие вашему JSON
interface Point {
    x: number;
    y: number;
}

interface Segment {
    start: Point;
    end: Point;
    originalIndex: number;
}

interface EasyEDAWire {
    async: boolean;
    primitiveType: string;
    line: number[] | number[][]; // [x1, y1, x2, y2, ...] или [[x1,y1,x2,y2], ...]
    net: string;
    primitiveId: string;
}

// Вспомогательная функция для создания уникального ключа точки
const getPointKey = (p: Point): string => `${to2(p.x)},${to2(p.y)}`;

// Проверка равенства двух точек
function pointsEqual(p1: Point, p2: Point): boolean {
    return to2(p1.x) === to2(p2.x) && to2(p1.y) === to2(p2.y);
}

// Проверка, лежит ли точка на сегменте (коллинеарна и в bounding box)
export function isPointOnSegment(point: Point, segment: Segment): boolean {
    const { start, end } = segment;

    // Проверяем коллинеарность через векторное произведение
    const crossProduct = (to2(point.y) - to2(start.y)) * (to2(end.x) - to2(start.x)) - (to2(point.x) - to2(start.x)) * (to2(end.y) - to2(start.y));
    if (crossProduct !== 0) return false;

    // Проверяем, находится ли точка в bounding box сегмента
    const minX = Math.min(to2(start.x), to2(end.x));
    const maxX = Math.max(to2(start.x), to2(end.x));
    const minY = Math.min(to2(start.y), to2(end.y));
    const maxY = Math.max(to2(start.y), to2(end.y));

    return to2(point.x) >= to2(minX) && to2(point.x) <= to2(maxX) && to2(point.y) >= to2(minY) && to2(point.y) <= to2(maxY);
}

/**
 * Основная функция для разделения провода на сегменты в местах разветвлений
 */
function splitWireAtJunctions(
    wireData: EasyEDAWire,
    options?: { pins?: Point[] }
): EasyEDAWire[] {
    if (!wireData.line || wireData.line.length === 0) return [wireData];

    const pins = options?.pins ?? [];

    // 1. Парсим отрезки из любого формата line (плоский массив или массив сегментов)
    const lineSegments = normalizeWireLine(wireData.line);
    const segments: Segment[] = lineSegments.map((coords, index) => ({
        start: { x: to2(coords[0]), y: to2(coords[1]) },
        end: { x: to2(coords[2]), y: to2(coords[3]) },
        originalIndex: index
    }));

    // 2. Разделяем сегменты в точках пинов (если пин лежит внутри сегмента)
    const pinPoints = new Set<string>();
    // eda.sys_Log.add(`All pins ${pins.length}`)

    for (const pin of pins) {
        // eda.sys_Log.add(`V0 Check in seq pin ${pin.x} ${pin.y}; seg: ${segments.length}`)

        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];

            // Пропускаем, если пин уже на конце сегмента
            if (pointsEqual(pin, seg.start) || pointsEqual(pin, seg.end)) {
                pinPoints.add(getPointKey(pin));
                continue;
            }
            // eda.sys_Log.add(`Check in seq pin ${pin.x} ${pin.y}; seg: ${JSON.stringify(seg)}`)

            // Если пин внутри сегмента — разделяем его на два
            if (isPointOnSegment(pin, seg)) {
                eda.sys_Log.add(`Pin in seq ${pin.x} ${pin.y}`)
                const pinKey = getPointKey(pin);
                pinPoints.add(pinKey);

                const newSeg1: Segment = {
                    start: seg.start,
                    end: pin,
                    originalIndex: seg.originalIndex
                };
                const newSeg2: Segment = {
                    start: pin,
                    end: seg.end,
                    originalIndex: seg.originalIndex
                };

                segments.splice(i, 1, newSeg1, newSeg2);
                i++; // Пропускаем следующий индекс, т.к. добавили новый сегмент
            }
        }
    }

    // 3. Строим карту смежности (какие сегменты подключены к какой точке)
    // Map<"x,y", Set<segmentIndex>>
    const adjacencyMap = new Map<string, Set<number>>();

    const addToMap = (point: Point, segmentIndex: number) => {
        const key = getPointKey(point);
        if (!adjacencyMap.has(key)) {
            adjacencyMap.set(key, new Set());
        }
        adjacencyMap.get(key)!.add(segmentIndex);
    };

    segments.forEach((seg, idx) => {
        addToMap(seg.start, idx);
        addToMap(seg.end, idx);
    });

    // 4. Определяем критические точки (Junctions и Ends)
    // Junction: степень узла > 2 (Т-образное пересечение или крест)
    // End: степень узла == 1 (Конец провода)
    // Обычная точка: степень узла == 2 (Просто изгиб или продолжение)
    const junctions = new Set<string>();
    const ends = new Set<string>();

    adjacencyMap.forEach((segmentIndices, pointKey) => {
        const degree = segmentIndices.size;
        if (degree > 2) {
            junctions.add(pointKey);
        } else if (degree === 1) {
            ends.add(pointKey);
        }
    });

    // Добавляем пины как junctions (даже если степень = 2, пин всё равно узел)
    pinPoints.forEach(pointKey => junctions.add(pointKey));

    // 4. Собираем новые цепи
    // Нам нужно пройти по графу от каждого End или Junction до следующего End/Junction
    const visitedSegments = new Set<number>();
    const newWires: number[][][] = [];

    // Функция поиска пути
    const traverse = (startPointKey: string, startSegmentIndex: number, directionIsForward: boolean) => {
        const path: number[][] = [];
        let currentSegIndex = startSegmentIndex;
        let currentPointKey = startPointKey;

        // Пока не упремся в другую критическую точку
        while (currentSegIndex !== -1 && !visitedSegments.has(currentSegIndex)) {
            visitedSegments.add(currentSegIndex);
            const seg = segments[currentSegIndex];

            // Добавляем координаты отрезка в путь
            // Важно: нужно добавлять координаты в правильном порядке (от start к end)
            // Но так как мы идем по цепочке, нам нужно знать, с какой стороны мы зашли
            const isForward = getPointKey(seg.start) === currentPointKey;

            const p1 = isForward ? seg.start : seg.end;
            const p2 = isForward ? seg.end : seg.start;

            // Если это первый отрезок в пути, добавляем обе точки.
            // Если продолжение, добавляем только вторую (чтобы не дублировать узел соединения)
            if (path.length === 0) {
                path.push([to2(p1.x), to2(p1.y), to2(p2.x), to2(p2.y)]);
            } else {
                // Проверяем, нужно ли (merge) с предыдущим отрезком, если они коллинеарны и идут подряд
                const lastSeg = path[path.length - 1];
                const lastX2 = lastSeg[2];
                const lastY2 = lastSeg[3];

                if (to2(lastX2) === to2(p1.x) && to2(lastY2) === to2(p1.y)) {
                    // Продолжение линии, можно объединить в один массив координат или оставить сегментами
                    // Для простоты оставим как список сегментов внутри одного Wire
                    path.push([to2(p1.x), to2(p1.y), to2(p2.x), to2(p2.y)]);
                } else {
                    path.push([to2(p1.x), to2(p1.y), to2(p2.x), to2(p2.y)]);
                }
            }

            // Определяем следующую точку
            const nextPointKey = isForward ? getPointKey(seg.end) : getPointKey(seg.start);
            currentPointKey = nextPointKey;

            // Ищем следующий сегмент
            const connectedSegments = adjacencyMap.get(nextPointKey);
            let nextSegIndex = -1;

            if (connectedSegments) {
                for (const idx of connectedSegments) {
                    if (idx !== currentSegIndex && !visitedSegments.has(idx)) {
                        nextSegIndex = idx;
                        break;
                    }
                }
            }

            // Если следующая точка - это Junction или End, мы останавливаем эту цепь здесь
            // (Следующий сегмент начнется в новом цикле поиска)
            if (junctions.has(nextPointKey) || ends.has(nextPointKey)) {
                break;
            }

            currentSegIndex = nextSegIndex;
        }

        if (path.length > 0) {
            newWires.push(path);
        }
    };

    // Запускаем обход от всех критических точек
    // 1. От всех концов (Ends)
    ends.forEach(pointKey => {
        const connected = adjacencyMap.get(pointKey);
        if (connected) {
            connected.forEach(segIndex => {
                if (!visitedSegments.has(segIndex)) {
                    traverse(pointKey, segIndex, true);
                }
            });
        }
    });

    // 2. От всех пересечений (Junctions) - на случай замкнутых контуров без явных концов
    junctions.forEach(pointKey => {
        const connected = adjacencyMap.get(pointKey);
        if (connected) {
            connected.forEach(segIndex => {
                if (!visitedSegments.has(segIndex)) {
                    traverse(pointKey, segIndex, true);
                }
            });
        }
    });

    // 5. Формируем итоговые объекты JSON
    return newWires.map((pathSegments, index) => {
        return {
            ...wireData,
            line: pathSegments // Массив массивов координат
        };
    });
}

function countPoints(mergedLines: number[][]): Record<string, number> {
    const counts: Record<string, number> = {};

    mergedLines.forEach(([x1, y1, x2, y2]) => {
        const p1 = `${x1},${y1}`;
        const p2 = `${x2},${y2}`;

        counts[p1] = (counts[p1] || 0) + 1;
        counts[p2] = (counts[p2] || 0) + 1;
    });

    return counts;
}

// Функция для удаления проводов от компонента до первого узла
async function removeWiresFromComponentToFirstJunction(
    componentPins: ISCH_PrimitiveComponentPin[],
    allWires: EasyEDAWire[]
) {
    const rmIndxs: number[] = [];
    eda.sys_Log.add(`allWires ${JSON.stringify(allWires)}`)
    eda.sys_Log.add(`componentPins ${componentPins.length}`)

    for (const pin of componentPins) {
        const pinX = pin.getState_X();
        const pinY = pin.getState_Y();
        eda.sys_Log.add(`PINCOORDS ${to2(pinX)}, ${to2(pinY)}`)

        // Ищем wire, который содержит позицию пина (сегмент, начинающийся в пине)
        const wireIndex = allWires.findIndex(wire =>
            normalizeWireLine(wire.line).some(segment =>
                (to2(segment[0]) === to2(pinX) && to2(segment[1]) === to2(pinY)) ||
                (to2(segment[2]) === to2(pinX) && to2(segment[3]) === to2(pinY))
            )
        );

        if (wireIndex === -1) {
            continue;
        }
        eda.sys_Log.add(`wireIndex ${wireIndex}`)

        const wireWithPin = allWires[wireIndex];

        const newAllWires = allWires.filter((w, i) => i !== wireIndex && w.primitiveId === wireWithPin.primitiveId)

        // Собираем все линии из оставшихся wires
        const mergedLines: number[][] = [];
        for (const wire of newAllWires) {
            mergedLines.push(...normalizeWireLine(wire.line));
        }

        rmIndxs.push(wireIndex);

        // Передаем объединенные линии в modify для оставшегося провода
        if (newAllWires.length > 0 && mergedLines.length > 0) {
            if (!Object.values(countPoints(mergedLines)).find(x => x >= 4)) {
                eda.sys_Log.add(`modify wire`)

                await eda.sch_PrimitiveWire.modify(wireWithPin.primitiveId, {
                    line: mergedLines,
                });

                await new Promise<void>((resolve, reject) => setTimeout(resolve, 100));

                await eda.sch_PrimitiveWire.modify(wireWithPin.primitiveId, {
                    net: wireWithPin.net
                });
            }
            else {
                eda.sys_Log.add(`rmIsDirect false`)
                await eda.sch_PrimitiveWire.delete(wireWithPin.primitiveId)
                await new Promise<void>((resolve, reject) => setTimeout(resolve, 100));

                for (const line of mergedLines) {
                    eda.sys_Log.add(`create wire: ${JSON.stringify(line)}, ${wireWithPin.net}`)
                    const wire = await eda.sch_PrimitiveWire.create(line, wireWithPin.net).catch(e => undefined);
                    await wire?.done().catch(e => undefined);
                }

                await new Promise<void>((resolve, reject) => setTimeout(resolve, 100));

                return { end: false, allWires, rmIsDirect: false };
            }
        }
        else {
            eda.sys_Log.add(`rmIsDirect`)
            await eda.sch_PrimitiveWire.delete(wireWithPin.primitiveId);
            await new Promise<void>((resolve, reject) => setTimeout(resolve, 100));
            return { end: false, allWires, rmIsDirect: true, wireWithPin, pin };
        }
    }

    allWires.filter((_, index) => !rmIndxs.includes(index));
    return { end: true, allWires, rmIsDirect: false };
}

export async function getShortSymPos(primitive: string | ISCH_PrimitiveComponent | ISCH_PrimitiveComponent$1) {
    let pinX;
    let pinY;
    let primitiveId: string | undefined;
    let shortSymbol: ISCH_PrimitiveComponent | ISCH_PrimitiveComponent$1 | undefined;

    if (typeof primitive === 'string') {
        primitiveId = primitive;
    }
    else {
        shortSymbol = primitive;
    }

    try {
        if (!primitiveId) throw new Error('Not prim id');

        const pins = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(primitiveId).catch(e => undefined);

        if (pins?.length !== 1) return undefined;

        pinX = pins[0].getState_X();
        pinY = pins[0].getState_Y();
    }
    catch (error) {
        if (!shortSymbol && primitiveId) shortSymbol = await getPrimitiveById(primitiveId).catch(e => undefined);
        if (!shortSymbol) return undefined;

        pinX = shortSymbol.getState_X();
        // компоненты инвертируют y
        pinY = normWireY(shortSymbol.getState_Y());
    }

    return { pinX, pinY }
}

async function rmUnunsedShortSym(allWires: EasyEDAWire[], net: string) {
    // Проблемма в api при получении за раз
    const shortSymbolsIds = [
        // @ts-ignore
        ...await eda.sch_PrimitiveComponent.getAllPrimitiveId(ESCH_PrimitiveComponentType.NET_FLAG).catch(e => []),
        // @ts-ignore
        ...await eda.sch_PrimitiveComponent.getAllPrimitiveId(ESCH_PrimitiveComponentType.NET_PORT).catch(e => [])
    ]

    const shortSymbols = await getPrimitiveById(shortSymbolsIds).catch(e => []);

    for (let idx = 0; idx < shortSymbolsIds.length; idx++) {
        if (shortSymbols[idx].getState_Net() !== net
            && shortSymbols[idx].getState_OtherProperty()?.['Global Net Name'] !== net) continue;

        const pos = await getShortSymPos(shortSymbolsIds[idx]);

        if (!pos) continue;

        const wireIndex = allWires.findIndex(wire =>
            normalizeWireLine(wire.line).some(segment =>
                (to2(segment[0]) === to2(pos.pinX) && to2(segment[1]) === to2(pos.pinY)) ||
                (to2(segment[2]) === to2(pos.pinX) && to2(segment[3]) === to2(pos.pinY))
            )
        );

        if (wireIndex === -1) {
            await eda.sch_PrimitiveComponent.delete(shortSymbolsIds[idx]).catch(e => undefined);
        }
    }
}

const getAllPinsPos = async () => (await getAllPrimitivePins().catch(e => []))
    .map(item => item.pins.map(p => ({ x: p.getState_X(), y: p.getState_Y(), primitiveId: item.primitiveId, pin: p }))).flat()

type AllPinPos = Awaited<ReturnType<typeof getAllPinsPos>>

async function processRmWire(pins: ISCH_PrimitiveComponentPin[], net: string, allPinsPos: AllPinPos, designator: string) {
    let allWires;
    let end = false;
    const addedNet: AddedNet[] = [];

    do {
        const wire = await getAllWiresByNet(net);
        eda.sys_Log.add(`Wire ${JSON.stringify(wire)}`)
        // Передаём координаты всех пинов компонента для обработки узлов на проводах
        allWires = wire.flatMap(w => splitWireAtJunctions(w as unknown as EasyEDAWire, {
            pins: allPinsPos
        }))
        eda.sys_Log.add(`allWires ${JSON.stringify(allWires)}`)

        const { allWires: allWires__, end: end__, rmIsDirect, wireWithPin, pin: targetPin } = await removeWiresFromComponentToFirstJunction(pins, allWires);

        end = end__;
        allWires = allWires__;

        if (rmIsDirect && wireWithPin) {
            const pinNumber = targetPin.getState_PinNumber();

            eda.sys_Log.add(`Rm net ${designator} ${pinNumber} ${net}; ${rmIsDirect} ${allWires.length}`);
            const trgX = targetPin.getState_X();
            const trgY = targetPin.getState_Y();

            // wireWithPin.line
            const antagonistPin = allPinsPos.find(p =>
                !(to2(p.x) === to2(trgX) && to2(p.y) === to2(trgY)) &&
                normalizeWireLine(wireWithPin.line).some(segment =>
                ((to2(segment[0]) === to2(p.x) && to2(segment[1]) === to2(p.y)) ||
                    (to2(segment[2]) === to2(p.x) && to2(segment[3]) === to2(p.y)))
                )
            )

            if (antagonistPin) {
                const primitive = await getPrimitiveById(antagonistPin.primitiveId).catch(e => undefined);
                const designator = primitive?.getState_Designator?.();

                if (!primitive || !designator || primitive.getState_ComponentType() !== ESCH_PrimitiveComponentType.COMPONENT) {
                    eda.sys_Log.add(`Rm net ${designator} ${pinNumber} ${net} ${JSON.stringify(antagonistPin)}; Not found antagonist pin primitive`);
                }
                else {

                    const added: AddedNet = {
                        designator: designator,
                        net,
                        pin_number: antagonistPin.pin.getState_PinNumber(),
                        pin_name: antagonistPin.pin.getState_PinName(),
                    }

                    eda.sys_Log.add(`Rm net ${designator} ${pinNumber} ${net}; found antagonist pin ${JSON.stringify(added)}`);

                    addedNet.push(added)
                }
            }
            else {
                eda.sys_Log.add(`Rm net ${designator} ${pinNumber} ${net}; Not found antagonist pin`);
            }
        }

    } while (!end);

    await rmUnunsedShortSym(allWires, net).catch(e => {
        eda.sys_Message.showToastMessage(`Fail rm unused short sym. ${(e as Error).message}`, ESYS_ToastMessageType.WARNING);
    });

    return addedNet;
}

export async function rmWireFromComponentPin(designator: string, pinNumber: string | number, net: string) {
    const pin = await findPin(designator, { num: pinNumber }, {});
    if (!pin) throw new Error('Component not found ' + designator);

    const allPinsPos = await getAllPinsPos();

    return await processRmWire([pin.pin], net, allPinsPos, designator);
}

export async function removeComponent(designator: string, circuit?: ExplainCircuit) {
    designator = rmPartFromDesignator(designator);
    const component = await searchComponentInSCH(designator);
    if (!component) throw new Error('Component not found ' + designator);

    const primitiveIds = component.map(c => c.primitiveId);
    if (!circuit) circuit = await getSchematic(primitiveIds);
    const pins = (await Promise.all(component.map(component => getPrimitiveComponentPins(component.primitiveId)))).flat();

    const allPinsPos = await getAllPinsPos();
    await eda.sch_PrimitiveComponent.delete(primitiveIds).catch(e => undefined);

    const componentCircuit = circuit.components.find(c => c.designator === designator);

    if (!componentCircuit) throw new Error(`Not found component in sch ${designator}`)

    const addedNet: AddedNet[] = [];

    for (const pin of componentCircuit.pins) {
        const net = pin.signal_name;
        if (!net) continue

        addedNet.push(... (await processRmWire(pins, net, allPinsPos, componentCircuit.designator)));
    }

    return addedNet;
}