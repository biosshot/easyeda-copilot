export const to2 = (x: number) => { x = Math.round(x); return x - (x % 5); }

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

export async function getBBox(components: (ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2)[]): Promise<{
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
            const pins = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(primitiveId);

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
        designator = designator.substring(0, lastDotIndex);
    }

    return designator;
}
