export interface SheetSize {
    width: number;
    height: number;
    showTitleBlock?: boolean;
}

export interface SheetRect {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

export const DRAWING_SHEETS = [
    { name: 'A4', width: 1170, height: 825, deviceUuid: '754952feec9e48d6afd574513e1ca00b' },
    { name: 'A3', width: 1655, height: 1170, deviceUuid: '673bbc47c78a4daf8dbb58210a32226a' },
    { name: 'A2', width: 2338, height: 1652, deviceUuid: '877d8889cad043caa60988f1d4249a07' },
    { name: 'A1', width: 3304, height: 2338, deviceUuid: 'a129f5eb54e848cc9dcf817dcebdd8bd' },
    { name: 'A0', width: 4676, height: 3304, deviceUuid: '8533bc44e6b341fdbc0684c2828a4c85' },
] as const;

export const DRAWING_LIBRARY_UUID = '0819f05c4eef4c71ace90d822a990e87';
const BORDER_MARGIN = 20;
const CONTENT_PADDING = 40;
const TITLE_BLOCK_WIDTH = 710;
const TITLE_BLOCK_HEIGHT = 190;

export function sheetUsableArea(sheet: SheetSize): { bounds: SheetRect; titleBlock?: SheetRect; area: number } {
    const bounds = {
        minX: BORDER_MARGIN,
        minY: BORDER_MARGIN,
        maxX: sheet.width - BORDER_MARGIN,
        maxY: sheet.height - BORDER_MARGIN,
    };
    const titleBlock = sheet.showTitleBlock === false ? undefined : {
        minX: sheet.width - TITLE_BLOCK_WIDTH,
        minY: 0,
        maxX: sheet.width,
        maxY: TITLE_BLOCK_HEIGHT,
    };
    const fullArea = Math.max(0, bounds.maxX - bounds.minX) * Math.max(0, bounds.maxY - bounds.minY);
    const blockedWidth = titleBlock ? Math.max(0, bounds.maxX - Math.max(bounds.minX, titleBlock.minX)) : 0;
    const blockedHeight = titleBlock ? Math.max(0, Math.min(bounds.maxY, titleBlock.maxY) - bounds.minY) : 0;
    return { bounds, titleBlock, area: Math.max(0, fullArea - blockedWidth * blockedHeight) };
}

export function rectsOverlap(a: SheetRect, b: SheetRect): boolean {
    return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

export function rectFitsSheet(rect: SheetRect, sheet: SheetSize): boolean {
    const { bounds, titleBlock } = sheetUsableArea(sheet);
    return rect.minX >= bounds.minX && rect.maxX <= bounds.maxX &&
        rect.minY >= bounds.minY && rect.maxY <= bounds.maxY &&
        (!titleBlock || !rectsOverlap(rect, titleBlock));
}

export function boundsOfRects(rects: SheetRect[]): SheetRect | undefined {
    if (!rects.length) return undefined;
    return {
        minX: Math.min(...rects.map(rect => rect.minX)),
        minY: Math.min(...rects.map(rect => rect.minY)),
        maxX: Math.max(...rects.map(rect => rect.maxX)),
        maxY: Math.max(...rects.map(rect => rect.maxY)),
    };
}

export function estimateOccupiedSheetSpace(sheet: SheetSize, rectangles: SheetRect[]) {
    const contentBounds = boundsOfRects(rectangles);
    const fitsWithinPage = rectangles.every(rect => rectFitsSheet(rect, sheet)) &&
        (!contentBounds || rectFitsSheet(contentBounds, sheet));
    const usableArea = sheetUsableArea(sheet).area;
    const occupiedArea = contentBounds
        ? (contentBounds.maxX - contentBounds.minX) * (contentBounds.maxY - contentBounds.minY)
        : 0;
    const freePercent = usableArea > 0 && fitsWithinPage
        ? Math.max(0, Math.min(100, (1 - occupiedArea / usableArea) * 100))
        : 0;
    return {
        freePercent: Number(freePercent.toFixed(1)),
        fitsWithinPage,
        ...(contentBounds ? { contentBounds } : {}),
    };
}

export function findSheetPlacement(sheet: SheetSize, width: number, height: number): { x: number; y: number } | undefined {
    if (!(width > 0 && height > 0)) return undefined;
    const paddedWidth = width + CONTENT_PADDING * 2;
    const paddedHeight = height + CONTENT_PADDING * 2;
    const { bounds, titleBlock } = sheetUsableArea(sheet);
    const regions: SheetRect[] = [bounds];
    if (titleBlock) {
        regions.push({ ...bounds, minY: Math.max(bounds.minY, titleBlock.maxY) });
        regions.push({ ...bounds, maxX: Math.min(bounds.maxX, titleBlock.minX) });
    }

    for (const region of regions) {
        if (paddedWidth > region.maxX - region.minX || paddedHeight > region.maxY - region.minY) continue;
        const x = (region.minX + region.maxX - paddedWidth) / 2;
        const y = (region.minY + region.maxY - paddedHeight) / 2;
        const padded = { minX: x, minY: y, maxX: x + paddedWidth, maxY: y + paddedHeight };
        if (rectFitsSheet(padded, sheet)) return { x: x + CONTENT_PADDING, y: y + CONTENT_PADDING };
    }
    return undefined;
}

type SelectedSheet =
    | { sheet: SheetSize; placement: { x: number; y: number }; resized: false }
    | { sheet: (typeof DRAWING_SHEETS)[number]; placement: { x: number; y: number }; resized: true };

export function selectDrawingSheet(current: SheetSize, width: number, height: number): SelectedSheet | undefined {
    const placement = findSheetPlacement(current, width, height);
    if (placement) return { sheet: current, placement, resized: false };
    for (const sheet of DRAWING_SHEETS) {
        if (sheet.width < current.width || sheet.height < current.height) continue;
        const candidate = { ...sheet, showTitleBlock: current.showTitleBlock };
        const nextPlacement = findSheetPlacement(candidate, width, height);
        if (nextPlacement) return { sheet, placement: nextPlacement, resized: true };
    }
    return undefined;
}
