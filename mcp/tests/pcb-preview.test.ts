import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { parsePolygonSource } from '../src/pcb-preview/parser';
import { cleanPolygonRings, polygonArea } from '../src/pcb-preview/geometry';
import { renderPcbToSvg } from '../src/pcb-preview/renderer';
import type { RawPcb, RawPcbPad } from '@copilot/shared/types/pcb/raw';
import type { PreviewOptions } from '../src/pcb-preview/types';

const options: PreviewOptions = { layers: ['TOP'], highlightNets: [], highlightComponents: [],
    zoom: { mode: 'full' }, paddingMm: 2, show: { netLabels: false, components: false }, widthPx: 480 };
const ring = (x: number, y: number, size: number) => [{ x, y }, { x: x + size, y }, { x: x + size, y: y + size }, { x, y: y + size }];
const board = (): RawPcb => ({ board: { polygon: ring(0, 0, 20) }, components: [], pads: [], vias: [], tracks: [], arcs: [], polygons: [] });
const pad = (): RawPcbPad => ({ x: 10, y: 10, rotation: 0, net: 'GND', padNumber: '1', layer: 'TOP', shape: ['ELLIPSE', 4, 4],
    hole: { data: ['ROUND', 1], offsetX: 0, offsetY: 0, rotation: 0 } });
async function pixels(data: RawPcb, opts = options) {
    const rendered = renderPcbToSvg(data, opts);
    const { data: rgba, info } = await sharp(Buffer.from(rendered.svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return (x: number, y: number) => {
        const px = Math.floor((x - rendered.viewBox.minX) * info.width / rendered.vbWidth);
        const py = Math.floor((-y - rendered.viewBox.minY) * info.height / rendered.vbHeight);
        return [...rgba.subarray((py * info.width + px) * 4, (py * info.width + px) * 4 + 4)];
    };
}

test('native rotated rounded R preserves position and area in preview', () => {
    const points = parsePolygonSource(['R', 10, 20, 4, 2, 90, 0.5])[0];
    assert.ok(points.length > 10);
    assert.ok(points.every(p => p.x >= 10 - 1e-8 && p.x <= 12 + 1e-8 && p.y >= 20 - 1e-8 && p.y <= 24 + 1e-8));
    assert.ok(Math.abs(polygonArea(points) - (8 - (4 - Math.PI) * 0.25)) < 0.03);
});

test('Q and repeated ARC commands end at the native coordinates', () => {
    assert.deepEqual(parsePolygonSource([0, 0, 'Q', 1, 3, 4, 2])[0].at(-1), { x: 4, y: 2 });
    const arc = parsePolygonSource([1, 0, 'ARC', 90, 0, 1, 90, -1, 0])[0];
    assert.ok(Math.abs(arc.at(-1)!.x + 1) < 1e-8 && Math.abs(arc.at(-1)!.y) < 1e-8);
    assert.ok(arc.every(p => Math.abs(Math.hypot(p.x, p.y) - 1) < 1e-8));
});

test('centered round and slotted drills remain visible inside pad copper', async () => {
    for (const hole of [['ROUND', 1], ['SLOT', 1, 2]]) {
        const data = board(); const p = pad(); p.hole!.data = hole; data.pads.push(p);
        const at = await pixels(data);
        assert.deepEqual(at(10, 10), [0, 0, 0, 255]);
        assert.deepEqual(at(11.5, 10), [255, 171, 145, 255]);
    }
});

test('absolute polygon pads keep offset drill in the rotated pad-local frame', async () => {
    const data = board(); const p = pad();
    p.shape = ['POLYGON', [[8, 8, 'L', 12, 8, 12, 12, 8, 12, 'Z']]];
    p.rotation = Math.PI / 2; p.hole!.offsetX = 1; data.pads.push(p);
    const at = await pixels(data, { ...options, show: { ...options.show, polygons: false } });
    assert.deepEqual(at(10, 11), [0, 0, 0, 255]);
    assert.ok(at(10, 10)[0] > 0);
});

test('drill-only pads render without invalid dimensions', async () => {
    const data = board(); const p = pad(); delete p.shape; data.pads.push(p);
    assert.doesNotMatch(renderPcbToSvg(data, options).svg, /NaN|Infinity/);
    assert.deepEqual((await pixels(data))(10, 10), [0, 0, 0, 255]);
});

test('inner-layer previews include through polygon pads and vias once per layer', () => {
    const data = board(); delete data.board;
    data.pads.push({ ...pad(), layer: 'MULTI', shape: ['POLYGON', [[8, 8, 'L', 12, 8, 12, 12, 8, 12, 'Z']]] });
    data.vias.push({ x: 4, y: 4, diameter: 1, drill: 0.5 });
    const svg = renderPcbToSvg(data, { ...options, layers: ['INNER_2'] }).svg;
    assert.match(svg, /data-layer="MULTI"/);
    assert.match(svg, /M 8.0000 -8.0000/);
    assert.equal((svg.match(/<circle cx="4"/g) ?? []).length, 2);
    assert.equal((svg.match(/<circle cx="0" cy="0" r="0.5"/g) ?? []).length, 1);
});

test('polygon width is preserved, including a zero-width fill', () => {
    const data = board();
    data.polygons.push({ layer: 'TOP', net: '', fill: true, lineWidth: 0, sources: [[2, 2, 'L', 4, 2, 4, 4, 2, 4, 'Z']] });
    assert.match(renderPcbToSvg(data, options).svg, /fill-rule="evenodd" stroke="none" stroke-width="0"/);
    data.polygons[0].lineWidth = 0.8;
    assert.match(renderPcbToSvg(data, options).svg, /fill-rule="evenodd" stroke="[^"]+" stroke-width="0.8"/);
});

test('small cutouts and holes in nested islands are retained', () => {
    const islands = cleanPolygonRings([ring(0, 0, 20), ring(2, 2, 10), ring(4, 4, 6), ring(5, 5, 0.1)]);
    assert.equal(islands.length, 2);
    assert.deepEqual(islands.map(i => i.cutouts.length), [1, 1]);
});

test('rounded rectangle and regular polygon pads keep their native shape', () => {
    const data = board(); const p = pad(); delete p.hole; data.pads.push(p);
    p.shape = ['RECT', 4, 2, 0.4];
    assert.match(renderPcbToSvg(data, options).svg, /width="4" height="2" rx="0.4" ry="0.4"/);
    p.shape = ['NGON', 4, 6];
    const svg = renderPcbToSvg(data, options).svg;
    assert.match(svg, /M 2.0000 0.0000 L 1.0000 -1.7321/);
    assert.doesNotMatch(svg, /<ellipse/);
});
