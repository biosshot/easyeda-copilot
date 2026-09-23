import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAWING_SHEETS, estimateOccupiedSheetSpace, findSheetPlacement, rectFitsSheet, selectDrawingSheet } from '../src/eda/schematic-page-geometry';

const a4 = DRAWING_SHEETS[0];
const a3 = DRAWING_SHEETS[1];

test('keeps the current sheet when its title block and border remain clear', () => {
    const selected = selectDrawingSheet(a4, 400, 300);
    assert.equal(selected?.resized, false);
    assert.equal(selected?.sheet.width, a4.width);
    const position = selected!.placement;
    assert.equal(rectFitsSheet({
        minX: position.x - 40,
        minY: position.y - 40,
        maxX: position.x + 440,
        maxY: position.y + 340,
    }, a4), true);
});

test('grows an AdcClock-sized layout from A4 to A3 because of the title block', () => {
    assert.equal(findSheetPlacement(a4, 1030, 685), undefined);
    const selected = selectDrawingSheet(a4, 1030, 685);
    assert.equal(selected?.resized, true);
    assert.equal(selected?.sheet.width, a3.width);
    assert.ok(selected?.placement);
    assert.equal(rectFitsSheet({
        minX: selected!.placement.x - 40,
        minY: selected!.placement.y - 40,
        maxX: selected!.placement.x + 1070,
        maxY: selected!.placement.y + 725,
    }, a3), true);
});

test('uses an already large sheet and respects hidden title blocks', () => {
    assert.equal(selectDrawingSheet(a3, 1030, 685)?.resized, false);
    assert.equal(selectDrawingSheet({ ...a4, showTitleBlock: false }, 1030, 685)?.resized, false);
});

test('never shrinks a custom sheet and reports an impossible layout', () => {
    const custom = { width: 2000, height: 1400 };
    assert.equal(selectDrawingSheet(custom, 2100, 1200)?.sheet.width, DRAWING_SHEETS[2].width);
    assert.equal(selectDrawingSheet(a4, 5000, 3500), undefined);
});

test('free-space estimate uses the enclosing circuit rectangle and rejects title-block collisions', () => {
    const left = { minX: 300, minY: 255, maxX: 400, maxY: 400 };
    const right = { minX: 1200, minY: 700, maxX: 1330, maxY: 940 };
    const a3Space = estimateOccupiedSheetSpace(a3, [left, right]);
    assert.equal(a3Space.fitsWithinPage, true);
    assert.ok(a3Space.freePercent < 70);
    const a4Space = estimateOccupiedSheetSpace(a4, [
        { minX: 300, minY: 255, maxX: 400, maxY: 400 },
        { minX: 950, minY: 80, maxX: 1090, maxY: 180 },
    ]);
    assert.equal(a4Space.fitsWithinPage, false);
    assert.equal(a4Space.freePercent, 0);
});
