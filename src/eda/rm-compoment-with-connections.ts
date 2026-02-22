import { getSchematic } from "./schematic";
import { getPrimitiveComponentPins, searchComponentInSCH } from "./search";

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
    line: number[][]; // [x1, y1, x2, y2, ...]
    net: string;
    primitiveId: string;
}

// Вспомогательная функция для создания уникального ключа точки
const getPointKey = (p: Point): string => `${p.x},${p.y}`;

/**
 * Основная функция для разделения провода на сегменты в местах разветвлений
 */
function splitWireAtJunctions(wireData: EasyEDAWire): EasyEDAWire[] {
    if (!wireData.line || wireData.line.length === 0) return [wireData];

    // 1. Парсим отрезки из формата [x1, y1, x2, y2]
    const segments: Segment[] = wireData.line.map((coords, index) => ({
        start: { x: coords[0], y: coords[1] },
        end: { x: coords[2], y: coords[3] },
        originalIndex: index
    }));

    // 2. Строим карту смежности (какие сегменты подключены к какой точке)
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

    // 3. Определяем критические точки (Junctions и Ends)
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
                path.push([p1.x, p1.y, p2.x, p2.y]);
            } else {
                // Проверяем, нужно ли合并 (merge) с предыдущим отрезком, если они коллинеарны и идут подряд
                const lastSeg = path[path.length - 1];
                const lastX2 = lastSeg[2];
                const lastY2 = lastSeg[3];

                if (lastX2 === p1.x && lastY2 === p1.y) {
                    // Продолжение линии, можно объединить в один массив координат или оставить сегментами
                    // Для простоты оставим как список сегментов внутри одного Wire
                    path.push([p1.x, p1.y, p2.x, p2.y]);
                } else {
                    path.push([p1.x, p1.y, p2.x, p2.y]);
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

// Функция для удаления проводов от компонента до первого узла
async function removeWiresFromComponentToFirstJunction(
    componentPins: ISCH_PrimitiveComponentPin[],
    allWires: EasyEDAWire[]
): Promise<void> {
    for (const pin of componentPins) {
        const pinX = pin.getState_X();
        const pinY = pin.getState_Y();

        // Ищем wire, который содержит позицию пина (сегмент, начинающийся в пине)
        const wireIndex = allWires.findIndex(wire =>
            wire.line.some(segment => (segment[0] === pinX && segment[1] === pinY) || segment[2] === pinX && segment[3] === pinY)
        );

        if (wireIndex === -1) {
            continue;
        }

        const wireWithPin = allWires[wireIndex];

        const newAllWires = allWires.filter((w, i) => i !== wireIndex && w.primitiveId === wireWithPin.primitiveId)

        // Собираем все линии из оставшихся wires
        const mergedLines: number[][] = [];
        for (const wire of newAllWires) {
            mergedLines.push(...wire.line);
        }

        // Передаем объединенные линии в modify для оставшегося провода
        if (newAllWires.length > 0 && mergedLines.length > 0) {
            await eda.sch_PrimitiveWire.modify(wireWithPin.primitiveId, {
                line: mergedLines
            });
        }
        else {
            await eda.sch_PrimitiveWire.delete(wireWithPin.primitiveId)
        }
    }
}

export async function removeComponent(designator: string) {
    const component = await searchComponentInSCH(designator);
    if (!component) throw new Error('Component not found ' + designator);

    const sch = await getSchematic([component.primitiveId]);
    const pins = await getPrimitiveComponentPins(component.primitiveId)

    await eda.sch_PrimitiveComponent.delete(component.primitiveId);

    for (const pin of sch.components[0].pins) {
        const net = pin.signal_name;

        const wire = await eda.sch_PrimitiveWire.getAll(net);

        const result = wire.flatMap(w => splitWireAtJunctions(w as unknown as EasyEDAWire))

        // Вызываем функцию для удаления проводов
        await removeWiresFromComponentToFirstJunction(pins, result);
    }

}