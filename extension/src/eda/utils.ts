import { sch_PrimitiveWireSnap } from "./wire-snap";

export const to2 = (x: number) => {
    return Math.round(x / 5) * 5;
};

export const getPageSize = async () => {
    try {
        const page = await eda.dmt_Schematic.getCurrentSchematicPageInfo();
        if (!page) return { width: 1200, height: 800 };
        const width = Object.entries(page.titleBlockData).find(([key]) => key.toLowerCase() === 'width');
        const height = Object.entries(page.titleBlockData).find(([key]) => key.toLowerCase() === 'height');
        return { width: Number(width?.[1]?.value ?? 1200), height: Number(height?.[1]?.value ?? 800) };
    } catch (error) {
        return { width: 1200, height: 800 };
    }
}

export function chunkArray(arr: unknown[], size: number) {
    const chunkedArr = [];
    for (let i = 0; i < arr.length; i += size) {
        chunkedArr.push(arr.slice(i, i + size));
    }
    return chunkedArr;
}

export function withTimeout<T>(
    promise: T,
    timeout_ms: number,
    errorMessage = 'Operation timeout'
): Promise<T> {
    let timeoutId: number;

    const timeoutPromise = new Promise<never>((_, reject) => {
        // @ts-ignore
        timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeout_ms);
    });

    // @ts-ignore
    const safePromise = promise.then((result) => {
        if (timeoutId) clearTimeout(timeoutId);
        return result;

        // @ts-ignore
    }).catch((err) => {
        if (timeoutId) clearTimeout(timeoutId);
        throw err;
    });

    return Promise.race([safePromise, timeoutPromise]);
}

export async function getBBox(components: (ISCH_PrimitiveComponent | ISCH_PrimitiveComponent$1)[]): Promise<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
} | null> {
    if (!components || components.length === 0) return null;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const comp of components) {
        try {
            const primitiveId = comp.getState_PrimitiveId();
            const pins = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(primitiveId).catch(e => undefined);

            if (pins && pins.length > 0) {
                for (const pin of pins) {
                    const x = pin.getState_X();
                    const y = pin.getState_Y();
                    if (typeof x === 'number' && typeof y === 'number') {
                        minX = Math.min(minX, x);
                        maxX = Math.max(maxX, x);
                        minY = Math.min(minY, y);
                        maxY = Math.max(maxY, y);
                    }
                }
            } else {
                // Фоллбэк: если нет пинов, используем центр компонента
                const x = comp.getState_X();
                const y = comp.getState_Y();
                const padding = 50;
                minX = Math.min(minX, x - padding);
                maxX = Math.max(maxX, x + padding);
                minY = Math.min(minY, y - padding);
                maxY = Math.max(maxY, y + padding);
            }
        } catch (error) {
            // skip
        }
    }

    if (minX === Infinity) return null;

    return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY
    };
}

export const rmPartFromDesignator = (designator: string) => {
    designator = designator.trim();
    const lastDotIndex = designator.lastIndexOf('.');

    if (lastDotIndex !== -1) {
        const number = designator.substring(lastDotIndex + 1);
        if (/^\d+$/.test(number))
            designator = designator.substring(0, lastDotIndex);
    }

    return designator;
}

export function getPrimitiveById(primitiveId: string): Promise<ISCH_PrimitiveComponent | ISCH_PrimitiveComponent$1 | undefined>;
export function getPrimitiveById(primitiveId: string[]): Promise<(ISCH_PrimitiveComponent | ISCH_PrimitiveComponent$1)[]>;

export function getPrimitiveById(primitiveId: string | string[]) {
    if (Array.isArray(primitiveId))
        return eda.sch_PrimitiveComponent.get(primitiveId).then(r => Array.isArray(r) ? r : (r ? [r] : []));
    else
        return eda.sch_PrimitiveComponent.get(primitiveId).then(r => Array.isArray(r) ? r[0] : r);
}

export async function yieldToEventLoop() {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
}

export const VERSION_EDASYEDA = eda.sys_Environment.getEditorCurrentVersion().split('.').map(Number);

export function normWireY(y: number) {
    if (VERSION_EDASYEDA[0] >= 3) return y;
    return -y
}

/**
 * Нормализует line провода в массив сегментов [[x1,y1,x2,y2], ...].
 * Учитывает версию EasyEDA:
 * - v2: line уже массив сегментов или один сегмент [x1,y1,x2,y2]
 * - v3: line — плоский массив сегментов [x1,y1,x2,y2,x3,y3,x4,y4,...]
 */
export function normalizeWireLine(line: number[] | number[][]): number[][] {
    if (!line || line.length === 0) return [];

    // v2: массив сегментов [[x1,y1,x2,y2], ...]
    if (Array.isArray(line[0])) {
        return (line as number[][]).filter(seg => seg.length >= 4);
    }

    const flat = line as number[];

    // v3: плоский массив сегментов [x1,y1,x2,y2,x3,y3,x4,y4,...]
    if (VERSION_EDASYEDA[0] >= 3) {
        if (flat.length >= 4 && flat.length % 4 === 0) {
            const segments: number[][] = [];
            for (let i = 0; i < flat.length; i += 4) {
                segments.push([flat[i], flat[i + 1], flat[i + 2], flat[i + 3]]);
            }
            return segments;
        }
        return [];
    }

    // v2 fallback: один сегмент [x1,y1,x2,y2]
    if (flat.length === 4) {
        return [flat];
    }

    return [];
}

export async function getAllWiresByNet(net: string) {
    if (VERSION_EDASYEDA[0] < 3) return await sch_PrimitiveWireSnap.getAll(net).catch(e => [] as ISCH_PrimitiveWire[]);
    const allWires = await sch_PrimitiveWireSnap.getAll().catch(e => [] as ISCH_PrimitiveWire[]);
    return allWires.filter(w => w.getState_Net() === net);
}

export function round(value: number, ROUND_DIGITS: number = 10000) {
    return Math.round(value * ROUND_DIGITS) / ROUND_DIGITS;
}

export function milToMm(value: number) {
    const MIL_TO_MM = 25.4 / 1000;
    return round(value * MIL_TO_MM);
}

export function mmToMil(value: number) {
    const MIL_TO_MM = 25.4 / 1000;
    return round(value / MIL_TO_MM);
}

export function safeString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}