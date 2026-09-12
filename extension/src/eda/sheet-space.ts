import { getSchematicOccupiedRects } from "./free-place-searcher";
import { getPageSize } from "./utils";

type Rect = { minX: number; minY: number; maxX: number; maxY: number };

function clipped(rect: Rect, width: number, height: number): Rect | undefined {
    const result = {
        minX: Math.max(0, rect.minX),
        minY: Math.max(0, rect.minY),
        maxX: Math.min(width, rect.maxX),
        maxY: Math.min(height, rect.maxY),
    };
    return result.maxX > result.minX && result.maxY > result.minY ? result : undefined;
}

function unionArea(rectangles: Rect[]) {
    const xs = [...new Set(rectangles.flatMap(rect => [rect.minX, rect.maxX]))].sort((a, b) => a - b);
    let area = 0;

    for (let i = 0; i + 1 < xs.length; i++) {
        const left = xs[i];
        const right = xs[i + 1];
        const intervals = rectangles
            .filter(rect => rect.minX < right && rect.maxX > left)
            .map(rect => [rect.minY, rect.maxY] as const)
            .sort((a, b) => a[0] - b[0]);
        if (!intervals.length) continue;

        let start = intervals[0][0];
        let end = intervals[0][1];
        let coveredY = 0;
        for (const [nextStart, nextEnd] of intervals.slice(1)) {
            if (nextStart > end) {
                coveredY += end - start;
                start = nextStart;
                end = nextEnd;
            } else {
                end = Math.max(end, nextEnd);
            }
        }
        coveredY += end - start;
        area += (right - left) * coveredY;
    }

    return area;
}

export async function estimateSchematicSheetSpace() {
    const [page, occupied] = await Promise.all([
        getPageSize(),
        getSchematicOccupiedRects(),
    ]);
    const rectangles: Rect[] = occupied.map(rect => ({
        minX: rect.x,
        minY: rect.y - rect.h,
        maxX: rect.x + rect.w,
        maxY: rect.y,
    }));

    const usable = rectangles.flatMap(rect => {
        const value = clipped(rect, page.width, page.height);
        return value ? [value] : [];
    });
    const pageArea = page.width * page.height;
    const occupiedArea = unionArea(usable);
    const freePercent = pageArea > 0
        ? Math.max(0, Math.min(100, (1 - occupiedArea / pageArea) * 100))
        : 0;

    return { freePercent: Number(freePercent.toFixed(1)) };
}
