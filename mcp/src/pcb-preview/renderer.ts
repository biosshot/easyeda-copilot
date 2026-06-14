import { LAYER_COLORS, LAYER_ORDER } from './colors.js';
import { boxFromPoints, cleanPolygonRings, expandBox, pointInRing, ringBounds, svgY, type Box, type Island } from './geometry.js';
import { polygonRings, type PolygonDiagnostics } from './parser.js';
import type { LayerKey, PcbArc, PcbComponent, PcbData, PcbPad, PcbPolygon, PcbTrack, PcbVia, PreviewOptions, ZoomTarget } from './types.js';

export { LAYER_ORDER };

function escapeXml(str: string): string {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function pointsToPath(points: Array<{ 0: number; 1: number }>): string {
    if (!points || points.length < 2) return '';
    return `M ${points.map(p => `${p[0].toFixed(4)} ${svgY(p[1]).toFixed(4)}`).join(' L ')} Z`;
}

function pointsToOpenPath(points: Array<{ 0: number; 1: number }>): string {
    if (!points || points.length < 2) return '';
    return `M ${points.map(p => `${p[0].toFixed(4)} ${svgY(p[1]).toFixed(4)}`).join(' L ')}`;
}

function isLayerSelected(layer: string, selected: string[]): boolean {
    if (!selected || selected.includes('all')) return true;
    return selected.includes(layer);
}

function isCopperLayer(layer: string): boolean {
    return layer === 'top' || layer === 'bottom' || layer === 'multi';
}

function uniqueLayers(layers: LayerKey[]): LayerKey[] {
    const seen = new Set<string>();
    return layers.filter(l => {
        if (seen.has(l)) return false;
        seen.add(l);
        return true;
    });
}

function normalizeRenderOrder(options: PreviewOptions): LayerKey[] {
    const selected = options.layers;
    let ordered: LayerKey[];

    if (selected.includes('all')) {
        // LAYER_ORDER is the physical bottom-to-top render order.
        ordered = [...LAYER_ORDER];
    } else {
        // User-facing order: the first layer is the topmost one.
        // SVG paints elements in document order, so we reverse before rendering.
        ordered = uniqueLayers(selected).reverse();
    }

    // Multi-layer pads and vias are implicit whenever any copper layer is shown.
    // If the caller didn't explicitly place the 'multi' pseudo-layer, render it
    // on top so vias/pads stay visible.
    if (!ordered.includes('multi') && (shouldRenderMultiPads(options) || shouldRenderVias(options))) {
        ordered.push('multi');
    }

    return ordered;
}

function shouldRenderVias(options: PreviewOptions): boolean {
    if (options.show.vias === false) return false;
    return options.layers.includes('all') || options.layers.some(isCopperLayer);
}

function shouldRenderMultiPads(options: PreviewOptions): boolean {
    if (options.show.pads === false) return false;
    return options.layers.includes('all') || options.layers.some(isCopperLayer);
}

function netHighlightColor(net: string | undefined, options: PreviewOptions): string | undefined {
    if (!net) return undefined;
    const custom = options.highlightNetColors?.[net];
    if (custom) return custom;
    if (options.highlightNets.includes(net)) return LAYER_COLORS.highlight;
    return undefined;
}

function componentHighlightColor(designator: string | undefined, options: PreviewOptions): string | undefined {
    if (!designator) return undefined;
    const custom = options.highlightComponentColors?.[designator];
    if (custom) return custom;
    if (options.highlightComponents.includes(designator)) return LAYER_COLORS.highlight;
    return undefined;
}

const LABEL_MIN_FONT_MM = 0.1;
const TRACK_LABEL_FONT_RATIO = 0.8;
const TRACK_LABEL_CHAR_RATIO = 0.6;
const POLYGON_LABEL_FONT_RATIO = 0.25;

function netLabelsEnabled(options: PreviewOptions): boolean {
    return options.show.netLabels !== false;
}

function renderTrackLabel(track: PcbTrack, options: PreviewOptions): string {
    if (!netLabelsEnabled(options)) return '';
    if (!track.net) return '';
    if (options.show.tracks === false) return '';
    if (!isLayerSelected(track.layer, options.layers)) return '';

    const fontSize = track.width * TRACK_LABEL_FONT_RATIO;
    if (fontSize < LABEL_MIN_FONT_MM) return '';

    const dx = track.x2 - track.x1;
    const dy = track.y2 - track.y1;
    const length = Math.hypot(dx, dy);
    const textWidth = track.net.length * fontSize * TRACK_LABEL_CHAR_RATIO;
    if (length < textWidth * 1.1) return '';

    const midX = (track.x1 + track.x2) / 2;
    const midY = (track.y1 + track.y2) / 2;
    const svgMidY = svgY(midY);
    let angle = Math.atan2(-dy, dx) * (180 / Math.PI);
    if (angle > 90) angle -= 180;
    else if (angle < -90) angle += 180;

    const strokeWidth = fontSize * 0.08;
    return `<text x="${midX.toFixed(4)}" y="${svgMidY.toFixed(4)}" font-size="${fontSize.toFixed(3)}" font-family="sans-serif" font-weight="bold" fill="${LAYER_COLORS.netLabel}" stroke="#ffffff" stroke-width="${strokeWidth.toFixed(4)}" stroke-opacity="0.8" paint-order="stroke" text-anchor="middle" dominant-baseline="middle" transform="rotate(${angle.toFixed(2)} ${midX.toFixed(4)} ${svgMidY.toFixed(4)})">${escapeXml(track.net)}</text>`;
}

function polygonContainsPoint(pt: [number, number], island: Island): boolean {
    if (!pointInRing(pt, island.outer)) return false;
    for (const cutout of island.cutouts) {
        if (pointInRing(pt, cutout)) return false;
    }
    return true;
}

function polygonContainsRect(x: number, y: number, halfW: number, halfH: number, island: Island): boolean {
    const corners: [number, number][] = [
        [x - halfW, y - halfH],
        [x + halfW, y - halfH],
        [x + halfW, y + halfH],
        [x - halfW, y + halfH],
    ];
    for (const c of corners) {
        if (!polygonContainsPoint(c, island)) return false;
    }
    return true;
}

function renderPolygonLabels(poly: PcbPolygon, options: PreviewOptions): string {
    if (!netLabelsEnabled(options)) return '';
    if (!poly.net) return '';
    if (options.show.polygons === false) return '';
    if (!isLayerSelected(poly.layer, options.layers)) return '';
    if (poly.layer.endsWith('_soldermask') || poly.layer.endsWith('_paste')) return '';

    const step = options.polygonLabelStepMm ?? 6;
    if (step <= 0) return '';

    const rings = polygonRings(poly);
    if (!rings.length) return '';

    const islands = cleanPolygonRings(rings);
    if (!islands.length) return '';

    const fontSize = step * POLYGON_LABEL_FONT_RATIO;
    const textWidth = poly.net.length * fontSize * TRACK_LABEL_CHAR_RATIO;
    const halfW = textWidth / 2;
    const halfH = fontSize / 2;
    const strokeWidth = fontSize * 0.08;

    let svg = '';
    for (const island of islands) {
        const bbox = ringBounds(island.outer);
        const startX = Math.floor(bbox.minX / step) * step;
        const startY = Math.floor(bbox.minY / step) * step;
        for (let x = startX; x <= bbox.maxX; x += step) {
            for (let y = startY; y <= bbox.maxY; y += step) {
                if (!polygonContainsRect(x, y, halfW, halfH, island)) continue;
                svg += `<text x="${x.toFixed(4)}" y="${svgY(y).toFixed(4)}" font-size="${fontSize.toFixed(3)}" font-family="sans-serif" font-weight="bold" fill="${LAYER_COLORS.netLabel}" stroke="#ffffff" stroke-width="${strokeWidth.toFixed(4)}" stroke-opacity="0.8" paint-order="stroke" text-anchor="middle" dominant-baseline="middle">${escapeXml(poly.net)}</text>`;
            }
        }
    }
    return svg;
}

function renderPolygon(poly: PcbPolygon, options: PreviewOptions, diagnostics?: { polygons: PolygonDiagnostics[] }): string {
    if (!isLayerSelected(poly.layer, options.layers)) return '';
    if (options.show.polygons === false) return '';
    if (poly.layer.endsWith('_soldermask')) return '';

    const polyDiag: PolygonDiagnostics = { net: poly.net, layer: poly.layer };
    const rings = polygonRings(poly, polyDiag);
    if (!rings.length) return '';

    if (diagnostics) {
        if (polyDiag.commandsSeen) polyDiag.commandsSeen = [...new Set(polyDiag.commandsSeen)];
        diagnostics.polygons.push(polyDiag);
    }

    const closedRings = rings.filter(r => r.length >= 3);
    const openSegments = rings.filter(r => r.length === 2);

    const baseColor = LAYER_COLORS[poly.layer] || '#cccccc';
    const highlightColor = netHighlightColor(poly.net, options);
    const highlighted = !!highlightColor;
    const color = highlightColor || baseColor;
    const strokeWidth = poly.lineWidth > 0 ? poly.lineWidth : 0;

    let svg = '';

    if (closedRings.length) {
        const islands = cleanPolygonRings(closedRings);
        const d = islands
            .map((island: Island) => [island.outer, ...island.cutouts].map(pointsToPath).join(' '))
            .join(' ');
        if (d) {
            const fill = poly.fill ? color : 'none';
            const fillOpacity = poly.fill ? (highlighted ? 0.6 : 0.7) : 0;
            const stroke = poly.lineWidth > 0 ? color : 'none';
            svg += `<path d="${d}" fill="${fill}" fill-opacity="${fillOpacity}" fill-rule="evenodd" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
        }
    }

    if (openSegments.length && strokeWidth > 0) {
        for (const seg of openSegments) {
            const [a, b] = seg;
            svg += `<line x1="${a[0]}" y1="${svgY(a[1])}" x2="${b[0]}" y2="${svgY(b[1])}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" />`;
        }
    }

    return svg;
}

function renderTrack(track: PcbTrack, options: PreviewOptions): string {
    if (!isLayerSelected(track.layer, options.layers)) return '';
    if (options.show.tracks === false) return '';

    const highlightColor = netHighlightColor(track.net, options);
    const highlighted = !!highlightColor;
    const color = highlightColor || (LAYER_COLORS[track.layer] || '#cccccc');
    const width = highlighted ? Math.max(track.width * 1.5, track.width + 0.1) : track.width;
    const opacity = highlighted ? 1 : 0.95;

    return `<line x1="${track.x1}" y1="${svgY(track.y1)}" x2="${track.x2}" y2="${svgY(track.y2)}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}" />`;
}

function renderArc(arc: PcbArc, options: PreviewOptions): string {
    if (!isLayerSelected(arc.layer, options.layers)) return '';
    if (options.show.tracks === false) return '';

    const highlightColor = netHighlightColor(arc.net, options);
    const highlighted = !!highlightColor;
    const color = highlightColor || (LAYER_COLORS[arc.layer] || '#cccccc');
    const width = highlighted ? Math.max(arc.width * 1.5, arc.width + 0.1) : arc.width;

    // Approximate the arc with a polyline so it gets round caps naturally.
    const pts = arcPointsFromArc(arc);
    if (pts.length < 2) return '';
    const d = pointsToOpenPath(pts);
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" />`;
}

function arcPointsFromArc(arc: PcbArc): Array<[number, number]> {
    // startX startY ARC arcAngle endX endY
    const start: [number, number] = [arc.x1, arc.y1];
    const end: [number, number] = [arc.x2, arc.y2];
    const angleDeg = arc.arcAngle;
    const angleRad = angleDeg * Math.PI / 180;
    const absAngle = Math.abs(angleRad);

    if (absAngle < 1e-9 || (Math.abs(start[0] - end[0]) < 1e-9 && Math.abs(start[1] - end[1]) < 1e-9)) {
        return [start, end];
    }

    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const chord = Math.hypot(dx, dy);
    const radius = chord / (2 * Math.sin(absAngle / 2));
    const h = radius * Math.cos(absAngle / 2);

    const mx = (start[0] + end[0]) / 2;
    const my = (start[1] + end[1]) / 2;

    const nx = -dy / chord;
    const ny = dx / chord;

    const sign = angleRad >= 0 ? 1 : -1;
    const cx = mx + sign * nx * h;
    const cy = my + sign * ny * h;

    const startAngle = Math.atan2(start[1] - cy, start[0] - cx);
    const endAngle = startAngle + angleRad;

    const pts: Array<[number, number]> = [];
    const count = Math.max(4, Math.min(64, Math.ceil(Math.abs(angleDeg) / 3)));
    for (let i = 0; i <= count; i++) {
        const t = i / count;
        const a = startAngle + (endAngle - startAngle) * t;
        pts.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
    }
    return pts;
}

function renderVia(via: PcbVia, options: PreviewOptions): string {
    if (options.show.vias === false) return '';
    const highlightColor = netHighlightColor(via.net, options);
    const highlighted = !!highlightColor;
    const color = highlightColor || LAYER_COLORS.multi;
    const r = via.diameter / 2;
    const holeR = via.drill / 2;
    const strokeWidth = highlighted ? 0.15 : 0.08;

    return [
        `<circle cx="${via.x}" cy="${svgY(via.y)}" r="${r}" fill="${color}" stroke="${LAYER_COLORS.drill}" stroke-width="${strokeWidth}" />`,
        `<circle cx="${via.x}" cy="${svgY(via.y)}" r="${holeR}" fill="${LAYER_COLORS.drill}" />`,
    ].join('');
}

function renderPad(pad: PcbPad, options: PreviewOptions): string {
    if (options.show.pads === false) return '';

    const highlightColor = netHighlightColor(pad.net, options);
    const highlighted = !!highlightColor;
    const color = highlightColor || (LAYER_COLORS[pad.layer] || LAYER_COLORS.multi);
    const w = pad.width || 0.5;
    const h = pad.height || 0.5;
    // EasyEDA pad rotation is stored in radians; convert to degrees for SVG.
    const rot = -(pad.rotation || 0) * (180 / Math.PI);
    const shape = pad.shapeType;

    const stroke = `stroke="${LAYER_COLORS.drill}" stroke-width="0.05"`;
    let shapeSvg = '';
    if (shape === 'OVAL') {
        const r = Math.min(w, h) / 2;
        shapeSvg = `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${color}" ${stroke} />`;
    } else if (shape === 'RECT') {
        shapeSvg = `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="${color}" ${stroke} />`;
    } else if (shape === 'ELLIPSE' || shape === 'OBLONG' || shape === 'REGULAR_POLYGON') {
        shapeSvg = `<ellipse cx="0" cy="0" rx="${w / 2}" ry="${h / 2}" fill="${color}" ${stroke} />`;
    } else {
        shapeSvg = `<ellipse cx="0" cy="0" rx="${w / 2}" ry="${h / 2}" fill="${color}" ${stroke} />`;
    }

    return `<g transform="translate(${pad.x} ${svgY(pad.y)}) rotate(${rot})">${shapeSvg}</g>`;
}

function renderComponent(comp: PcbComponent, options: PreviewOptions): string {
    if (options.show.components === false) return '';
    const highlightColor = componentHighlightColor(comp.designator, options);
    const highlighted = !!highlightColor;
    const color = highlightColor || LAYER_COLORS.component;
    const size = 0.5;
    const y = svgY(comp.y);
    return [
        `<g transform="translate(${comp.x} ${y})">`,
        `<line x1="${-size}" y1="0" x2="${size}" y2="0" stroke="${color}" stroke-width="0.1" />`,
        `<line x1="0" y1="${-size}" x2="0" y2="${size}" stroke="${color}" stroke-width="0.1" />`,
        `<circle cx="0" cy="0" r="${size / 4}" fill="${color}" />`,
        `<text x="${size + 0.2}" y="${-size - 0.2}" fill="${color}" font-size="1.2" font-family="sans-serif">${escapeXml(comp.designator)}</text>`,
        '</g>',
    ].join('');
}

function collectAllPoints(data: PcbData): Array<[number, number]> {
    const points: Array<[number, number]> = [];
    if (data.boardPolygon) points.push(...data.boardPolygon);
    data.components?.forEach(c => points.push([c.x, c.y]));
    data.pads?.forEach(p => points.push([p.x, p.y]));
    data.vias?.forEach(v => points.push([v.x, v.y]));
    data.tracks?.forEach(t => points.push([t.x1, t.y1], [t.x2, t.y2]));
    data.arcs?.forEach(a => points.push([a.x1, a.y1], [a.x2, a.y2]));
    data.polygons?.forEach(p => polygonRings(p).forEach(r => points.push(...r)));
    return points;
}

function boardBox(data: PcbData): Box {
    if (data.boardPolygon && data.boardPolygon.length) {
        return boxFromPoints(data.boardPolygon);
    }
    const points = collectAllPoints(data);
    return boxFromPoints(points);
}

function componentBox(data: PcbData, designator: string): Box | undefined {
    const component = data.components?.find(c => c.designator === designator);
    if (!component) return undefined;

    const points: Array<[number, number]> = [[component.x, component.y]];
    data.pads?.forEach(p => {
        if (p.designator === designator) points.push([p.x, p.y]);
    });

    const box = boxFromPoints(points);
    // If the component has no pads, expand a tiny placeholder so it is visible.
    const hasGeometry = points.length > 1;
    return hasGeometry ? box : expandBox(box, 5);
}

function netBox(data: PcbData, net: string): Box | undefined {
    const points: Array<[number, number]> = [];
    data.tracks?.forEach(t => {
        if (t.net === net) points.push([t.x1, t.y1], [t.x2, t.y2]);
    });
    data.arcs?.forEach(a => {
        if (a.net === net) points.push([a.x1, a.y1], [a.x2, a.y2]);
    });
    data.pads?.forEach(p => {
        if (p.net === net) points.push([p.x, p.y]);
    });
    data.vias?.forEach(v => {
        if (v.net === net) points.push([v.x, v.y]);
    });
    data.polygons?.forEach(p => {
        if (p.net === net) {
            polygonRings(p).forEach(r => points.push(...r));
        }
    });

    if (!points.length) return undefined;
    return boxFromPoints(points);
}

function resolveRelativeBbox(data: PcbData, bbox: { x: number; y: number; width: number; height: number }): Box {
    const base = boardBox(data);
    const baseW = base.maxX - base.minX;
    const baseH = base.maxY - base.minY;
    const x = base.minX + bbox.x * baseW;
    const y = base.minY + bbox.y * baseH;
    return {
        minX: x,
        minY: y,
        maxX: x + bbox.width * baseW,
        maxY: y + bbox.height * baseH,
    };
}

function resolveZoomBox(data: PcbData, zoom: ZoomTarget): Box {
    if (zoom.mode === 'bbox') {
        if (zoom.bbox.unit === 'rel') {
            return resolveRelativeBbox(data, zoom.bbox);
        }
        return {
            minX: zoom.bbox.x,
            minY: zoom.bbox.y,
            maxX: zoom.bbox.x + zoom.bbox.width,
            maxY: zoom.bbox.y + zoom.bbox.height,
        };
    }

    if (zoom.mode === 'net') {
        const box = netBox(data, zoom.net);
        if (box) return box;
    }

    if (zoom.mode === 'component') {
        const box = componentBox(data, zoom.designator);
        if (box) return box;
    }

    return boardBox(data);
}

export function computeViewBox(data: PcbData, options: PreviewOptions): Box {
    const rawBox = expandBox(resolveZoomBox(data, options.zoom), options.paddingMm);
    return {
        minX: rawBox.minX,
        minY: -rawBox.maxY,
        maxX: rawBox.maxX,
        maxY: -rawBox.minY,
    };
}

export function renderPcbToSvg(data: PcbData, options: PreviewOptions): string {
    const viewBox = computeViewBox(data, options);
    const vbWidth = viewBox.maxX - viewBox.minX;
    const vbHeight = viewBox.maxY - viewBox.minY;

    const diagnostics = options.debug ? { polygons: [] as PolygonDiagnostics[] } : undefined;

    const boardClipId = 'board-clip';
    const boardPath = data.boardPolygon && data.boardPolygon.length
        ? pointsToPath(data.boardPolygon)
        : '';

    const parts: string[] = [];

    if (boardPath) {
        parts.push(`<defs><clipPath id="${boardClipId}"><path d="${boardPath}" /></clipPath></defs>`);
        parts.push(`<g clip-path="url(#${boardClipId})">`);
        parts.push(`<rect x="${viewBox.minX}" y="${viewBox.minY}" width="${vbWidth}" height="${vbHeight}" fill="${LAYER_COLORS.board}" />`);
    } else {
        parts.push(`<rect x="${viewBox.minX}" y="${viewBox.minY}" width="${vbWidth}" height="${vbHeight}" fill="#222" />`);
        parts.push('<g>');
    }

    const orderedLayers = normalizeRenderOrder(options);

    for (const layer of orderedLayers) {
        const layerGroup: string[] = [];

        for (const poly of data.polygons || []) {
            if (poly.layer === layer) {
                layerGroup.push(renderPolygon(poly, options, diagnostics));
                layerGroup.push(renderPolygonLabels(poly, options));
            }
        }

        for (const track of data.tracks || []) {
            if (track.layer === layer) {
                layerGroup.push(renderTrack(track, options));
                layerGroup.push(renderTrackLabel(track, options));
            }
        }
        for (const arc of data.arcs || []) {
            if (arc.layer === layer) layerGroup.push(renderArc(arc, options));
        }

        for (const pad of data.pads || []) {
            if (pad.layer === layer && layer !== 'multi') {
                layerGroup.push(renderPad(pad, options));
            }
        }

        if (layer === 'multi') {
            if (shouldRenderMultiPads(options)) {
                for (const pad of data.pads || []) {
                    if (pad.layer === 'multi') {
                        layerGroup.push(renderPad(pad, options));
                    }
                }
            }
            if (shouldRenderVias(options)) {
                for (const via of data.vias || []) {
                    layerGroup.push(renderVia(via, options));
                }
            }
        }

        if (layerGroup.length) {
            parts.push(`<g data-layer="${layer}">${layerGroup.join('')}</g>`);
        }
    }

    for (const comp of data.components || []) {
        parts.push(renderComponent(comp, options));
    }

    if (boardPath) {
        parts.push(`<path d="${boardPath}" fill="none" stroke="${LAYER_COLORS.board_edge}" stroke-width="0.15" />`);
    }

    parts.push('</g>');

    const heightPx = Math.round(options.widthPx * (vbHeight / vbWidth));

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.minX.toFixed(4)} ${viewBox.minY.toFixed(4)} ${vbWidth.toFixed(4)} ${vbHeight.toFixed(4)}" width="${options.widthPx}" height="${heightPx}">`,
        parts.join('\n'),
        '</svg>',
    ].join('\n');
}

export function renderDiagnostics(diagnostics: { polygons: PolygonDiagnostics[] } | undefined): Record<string, unknown> | undefined {
    if (!diagnostics) return undefined;
    const cmdStats: Record<string, number> = {};
    for (const p of diagnostics.polygons) {
        for (const c of p.commandsSeen || []) {
            cmdStats[c] = (cmdStats[c] || 0) + 1;
        }
    }
    return {
        polygonCount: diagnostics.polygons.length,
        commandStats: cmdStats,
    };
}
