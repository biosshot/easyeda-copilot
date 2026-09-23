import { getSchematicOccupiedRects } from './free-place-searcher';
import { estimateOccupiedSheetSpace, SheetRect } from './schematic-page-geometry';
import { getPageSize } from './utils';

export async function estimateSchematicSheetSpace() {
    const [size, page, occupied] = await Promise.all([
        getPageSize(),
        eda.dmt_Schematic.getCurrentSchematicPageInfo().catch(() => undefined),
        getSchematicOccupiedRects(),
    ]);
    const sheet = { ...size, showTitleBlock: page?.showTitleBlock };
    const rectangles: SheetRect[] = occupied.map(rect => ({
        minX: rect.x,
        minY: rect.y - rect.h,
        maxX: rect.x + rect.w,
        maxY: rect.y,
    }));

    return estimateOccupiedSheetSpace(sheet, rectangles);
}
