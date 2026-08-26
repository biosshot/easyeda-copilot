import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { fitOutline, parseSvgOutline, parseSvgPath, ringToPolygonSource } from './svg-path.ts';

const bboxOf = (rings: { x: number, y: number }[][]) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const ring of rings) {
        for (const point of ring) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }
    }

    return { minX, minY, maxX, maxY };
};

const near = (actual: number, expected: number, tolerance = 0.05) =>
    assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} (+-${tolerance})`);

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

test('closes a subpath and keeps absolute line coordinates', () => {
    const rings = parseSvgPath('M0,0 L10,0 L10,10 L0,10 Z');

    assert.equal(rings.length, 1);
    assert.deepEqual(bboxOf(rings), { minX: 0, minY: 0, maxX: 10, maxY: 10 });
});

test('handles relative commands and H/V shorthands', () => {
    const rings = parseSvgPath('M5,5 h10 v10 h-10 z');

    assert.equal(rings.length, 1);
    assert.deepEqual(bboxOf(rings), { minX: 5, minY: 5, maxX: 15, maxY: 15 });
});

test('splits a path with two subpaths into two rings', () => {
    const rings = parseSvgPath('M0,0 L10,0 L10,10 Z M20,20 L30,20 L30,30 Z');
    assert.equal(rings.length, 2);
});

test('flattens an arc into a half circle of the right size', () => {
    // Полуокружность радиуса 5 из (0,0) в (10,0). sweep=1 — это направление
    // возрастания угла, а при оси Y вниз оно даёт выпуклость в минус по Y.
    const bbox = bboxOf(parseSvgPath('M0,0 A5,5 0 0 1 10,0 Z', 0.05));

    near(bbox.minX, 0);
    near(bbox.maxX, 10);
    near(bbox.minY, -5, 0.2);
    near(bbox.maxY, 0);
});

test('the sweep flag picks the opposite side of the chord', () => {
    const bbox = bboxOf(parseSvgPath('M0,0 A5,5 0 0 0 10,0 Z', 0.05));

    near(bbox.minY, 0);
    near(bbox.maxY, 5, 0.2);
});

test('an arc with too small radii is scaled up to reach the endpoint', () => {
    // Спецификация требует увеличить радиусы, а не бросать ошибку.
    const bbox = bboxOf(parseSvgPath('M0,0 A1,1 0 0 1 10,0 Z', 0.05));

    near(bbox.minX, 0);
    near(bbox.maxX, 10);
});

test('reads circle, rect, ellipse and polygon, not just path', () => {
    const outline = parseSvgOutline(svg(`
        <circle cx="10" cy="10" r="5"/>
        <rect x="20" y="0" width="10" height="4"/>
        <ellipse cx="40" cy="10" rx="5" ry="2"/>
        <polygon points="50,0 60,0 55,10"/>
    `));

    assert.equal(outline.rings.length, 4);
    near(outline.bbox.minX, 5);
    near(outline.bbox.maxX, 60);
});

test('rounded rect stays inside its own box', () => {
    const outline = parseSvgOutline(svg('<rect x="0" y="0" width="20" height="10" rx="3"/>'), 0.05);

    near(outline.bbox.minX, 0);
    near(outline.bbox.minY, 0);
    near(outline.bbox.maxX, 20);
    near(outline.bbox.maxY, 10);
});

test('applies transform on the shape', () => {
    const outline = parseSvgOutline(svg('<rect x="0" y="0" width="10" height="10" transform="translate(100,50)"/>'));

    assert.deepEqual(outline.bbox, { minX: 100, minY: 50, maxX: 110, maxY: 60 });
});

test('inherits transform from the enclosing group', () => {
    const outline = parseSvgOutline(svg('<g transform="scale(2)"><rect x="0" y="0" width="10" height="10"/></g>'));

    assert.deepEqual(outline.bbox, { minX: 0, minY: 0, maxX: 20, maxY: 20 });
});

test('composes nested group transforms', () => {
    const outline = parseSvgOutline(
        svg('<g transform="translate(10,0)"><g transform="translate(0,5)"><rect x="0" y="0" width="2" height="2"/></g></g>'),
    );

    assert.deepEqual(outline.bbox, { minX: 10, minY: 5, maxX: 12, maxY: 7 });
});

test('rotate around a point lands where SVG says', () => {
    const outline = parseSvgOutline(svg('<rect x="0" y="0" width="10" height="10" transform="rotate(90,0,0)"/>'));

    near(outline.bbox.minX, -10);
    near(outline.bbox.maxX, 0);
    near(outline.bbox.minY, 0);
    near(outline.bbox.maxY, 10);
});

test('a group transform does not leak to the next sibling', () => {
    const outline = parseSvgOutline(svg(`
        <g transform="translate(1000,1000)"><rect x="0" y="0" width="1" height="1"/></g>
        <rect x="0" y="0" width="2" height="2"/>
    `));

    assert.equal(outline.bbox.minX, 0, 'sibling must stay at the origin');
    assert.equal(outline.bbox.maxX, 1001);
});

test('ignores shapes inside defs and clipPath', () => {
    const outline = parseSvgOutline(svg(`
        <defs><rect x="0" y="0" width="500" height="500"/></defs>
        <clipPath id="c"><circle cx="900" cy="900" r="50"/></clipPath>
        <rect x="0" y="0" width="10" height="10"/>
    `));

    assert.equal(outline.rings.length, 1);
    assert.equal(outline.bbox.maxX, 10);
});

test('a style block with braces does not break parsing', () => {
    const outline = parseSvgOutline(svg(`
        <defs><style>.cls-1{fill-rule:evenodd;}</style></defs>
        <path class="cls-1" d="M0,0 L10,0 L10,10 Z"/>
    `));

    assert.equal(outline.rings.length, 1);
});

test('explains itself when there is nothing drawable', () => {
    assert.throws(() => parseSvgOutline(svg('<text x="0" y="0">hi</text>')), /Supported: path, rect/);
});

test('fitOutline keeps aspect ratio and flips Y for the board', () => {
    // Прямоугольник 100x50: в SVG ось Y вниз, на плате вверх.
    const outline = parseSvgOutline(svg('<rect x="0" y="0" width="100" height="50"/>'));
    const fitted = fitOutline(outline, undefined, 10);
    const bbox = bboxOf(fitted);

    near(bbox.maxY - bbox.minY, 10);
    near(bbox.maxX - bbox.minX, 20, 0.001);
    near((bbox.minX + bbox.maxX) / 2, 0, 0.001);
    near((bbox.minY + bbox.maxY) / 2, 0, 0.001);
});

test('fitOutline fits inside the box when both sides are given', () => {
    const outline = parseSvgOutline(svg('<rect x="0" y="0" width="100" height="50"/>'));
    const bbox = bboxOf(fitOutline(outline, 10, 10));

    near(bbox.maxX - bbox.minX, 10);
    near(bbox.maxY - bbox.minY, 5);
});

test('fitOutline refuses without a target size', () => {
    const outline = parseSvgOutline(svg('<rect x="0" y="0" width="10" height="10"/>'));
    assert.throws(() => fitOutline(outline), /width or height/);
});

test('ring serialises to the EasyEDA polygon token format', () => {
    const source = ringToPolygonSource(
        [{ x: 1.234567, y: 2 }, { x: 3, y: 4 }],
        value => Math.round(value * 100) / 100,
    );

    assert.deepEqual(source, [1.23, 2, 'L', 3, 4]);
});
