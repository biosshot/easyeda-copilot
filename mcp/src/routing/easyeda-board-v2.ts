import ClipperLib from 'clipper-lib';
import type { RoutingBoardV2, RoutingPadV2, RoutingPadShape, PolygonMm, PointMm, FilledPolygons } from 'eda-copilot-backend/types';
import type { RoutingDiagnostic } from 'eda-copilot-router';
import type { RawPcb, RawPcbPolygon } from '@copilot/shared/types/pcb/raw';
import type { PcbDrcBundle } from '@copilot/shared/types/pcb/drc';
import { parsePolygonSource } from '../pcb-preview/parser';
import { importEasyEdaAutorouteJson, tessellateArc } from './easyeda-autoroute-adapter';
import { mergeEasyEdaDrcIntoRoutingRules, readEasyEdaBlindViaSpan, readEasyEdaPourRefillRules } from './easyeda-drc-adapter';

const TOLERANCE_MM = 0.001;
const SCALE = 1_000_000;
const point = (p: PointMm): PointMm => ({ x: p.x, y: p.y === 0 ? 0 : -p.y });
const degrees = (radians: number) => -radians * 180 / Math.PI;
const copperLayer = (layer: string) => layer === 'TOP' || layer === 'BOTTOM' || /^INNER_\d+$/.test(layer);
const layerName = (id: number) => id === 1 ? 'TOP' : id === 2 ? 'BOTTOM' : `INNER_${id - 14}`;

function rings(sources: RawPcbPolygon['sources']) {
    return sources.flatMap(source => {
        const diagnostics: { unknownCommands?: string[] } = {};
        const result = parsePolygonSource(source, diagnostics, TOLERANCE_MM);
        if (diagnostics.unknownCommands?.length) throw new Error(`Unsupported polygon commands: ${diagnostics.unknownCommands.join(', ')}`);
        if (!result.length || result.some(ring => ring.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)))) {
            throw new Error('Empty or invalid native polygon');
        }
        return result.map(ring => ring.map(point));
    });
}

function pathsToPolygons(paths: ClipperLib.Paths, fill = ClipperLib.PolyFillType.pftEvenOdd): PolygonMm[] {
    if (!paths.length) return [];
    const clipper = new ClipperLib.Clipper();
    clipper.StrictlySimple = true;
    clipper.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
    const tree = new ClipperLib.PolyTree();
    if (!clipper.Execute(ClipperLib.ClipType.ctUnion, tree, fill, fill)) throw new Error('Native copper normalization failed');
    const output: PolygonMm[] = [];
    const contour = (node: ClipperLib.PolyNode) => node.Contour().map(p => ({ x: p.X / SCALE, y: p.Y / SCALE }));
    const visit = (node: ClipperLib.PolyNode) => {
        for (const child of node.Childs()) {
            if (!child.IsHole()) output.push({ outer: contour(child), holes: child.Childs().filter(c => c.IsHole()).map(contour) });
            visit(child);
        }
    };
    visit(tree);
    return output;
}

function toPaths(points: readonly (readonly PointMm[])[]): ClipperLib.Paths {
    return points.map(ring => ring.map(p => {
        if (Math.max(Math.abs(p.x), Math.abs(p.y)) * SCALE > Number.MAX_SAFE_INTEGER / 16) throw new Error('Coordinate exceeds the geometry limit');
        return { X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) };
    }));
}

/** Keep every hole and nested island; never apply preview's small-cutout filtering. */
export function nativeCopperPolygons(poly: RawPcbPolygon): PolygonMm[] {
    if (poly.fillMode !== undefined && poly.fillMode !== 0) throw new Error(`Unsupported native Fill mode ${poly.fillMode}`);
    const paths = toPaths(rings(poly.sources));
    if (!Number.isFinite(poly.lineWidth) || poly.lineWidth < 0) throw new Error('Invalid native stroke width');
    const normalized = poly.fill ? pathsToPolygons(paths) : [];
    if (!poly.lineWidth) {
        if (!poly.fill) throw new Error('Unfilled native path has no stroke width');
        return normalized;
    }
    // Same polygon library used by the router. Stroke geometry is never replaced by its centreline.
    const stroke = new ClipperLib.ClipperOffset(2, TOLERANCE_MM * SCALE);
    // Native polygon paths close implicitly, even without a repeated endpoint/Z.
    for (const path of paths) stroke.AddPath(path, ClipperLib.JoinType.jtRound,
        path.length >= 3 ? ClipperLib.EndType.etClosedLine : ClipperLib.EndType.etOpenRound);
    const stroked: ClipperLib.Paths = [];
    stroke.Execute(stroked, poly.lineWidth * SCALE / 2);
    const filled = toPaths(normalized.flatMap(p => [p.outer, ...(p.holes ?? [])]));
    return pathsToPolygons([...filled, ...stroked], ClipperLib.PolyFillType.pftNonZero);
}

function padShape(shape: unknown[] | undefined, localize?: (p: PointMm) => PointMm): RoutingPadShape {
    const [kind, width, height, radius] = shape ?? [];
    const w = Number(width), h = Number(height);
    if (kind === 'POLYGON' && Array.isArray(width)) {
        const polygons = nativeCopperPolygons({ sources: width as RawPcbPolygon['sources'], net: '', layer: 'TOP', fill: true, lineWidth: 0 });
        if (polygons.length !== 1) throw new Error('Pad shape is not a single copper region');
        const polygon = polygons[0];
        return { kind: 'polygon', polygon: localize ? { outer: polygon.outer.map(localize), holes: polygon.holes?.map(r => r.map(localize)) } : polygon };
    }
    if (!(w > 0 && h > 0 && Number.isFinite(w) && Number.isFinite(h))) throw new Error('Invalid pad dimensions');
    if (kind === 'ELLIPSE' && w === h) return { kind: 'circle', diameterMm: w };
    if (kind === 'OVAL') return { kind: 'oval', widthMm: w, heightMm: h };
    if (kind === 'RECT') return Number(radius) > 0
        ? { kind: 'round-rect', widthMm: w, heightMm: h, cornerRadiusMm: Math.min(Number(radius), w / 2, h / 2) }
        : { kind: 'rect', widthMm: w, heightMm: h };
    if (kind === 'ELLIPSE' || kind === 'NGON') {
        const count = kind === 'NGON' ? h : Math.max(8, Math.ceil(Math.PI / Math.acos(1 - Math.min(2 * TOLERANCE_MM / Math.max(w, h), 1))));
        if (!Number.isInteger(count) || count < 3 || count > 16384) throw new Error('Pad exceeds the geometry limit');
        return { kind: 'polygon', polygon: { outer: Array.from({ length: count }, (_, i) => ({
            x: w / 2 * Math.cos(i * 2 * Math.PI / count), y: -(kind === 'NGON' ? w : h) / 2 * Math.sin(i * 2 * Math.PI / count),
        })) } };
    }
    throw new Error(`Unsupported pad shape ${String(kind)}`);
}

function padHole(p: RawPcb['pads'][number]): RoutingPadV2['hole'] {
    if (!p.hole) return undefined;
    if (p.plated === undefined || !['ROUND', 'SLOT'].includes(String(p.hole.data[0]))) throw new Error(`Unsupported hole ${p.id}`);
    const diameterMm = Number(p.hole.data[1]), slotLengthMm = Number(p.hole.data[2]);
    if (!(diameterMm > 0) || p.hole.data[0] === 'SLOT' && !(slotLengthMm > 0)) throw new Error(`Invalid hole dimensions ${p.id}`);
    return { shape: p.hole.data[0] === 'ROUND' ? 'round' : 'slot', diameterMm,
        ...(p.hole.data[0] === 'SLOT' ? { slotLengthMm: Math.max(diameterMm, slotLengthMm) } : {}),
        offset: point({ x: p.hole.offsetX, y: p.hole.offsetY }), rotationDeg: degrees(p.hole.rotation), plated: p.plated };
}

export function importEasyEdaBoardV2(source: Record<string, unknown>, raw: RawPcb, drc: PcbDrcBundle): { board: RoutingBoardV2; diagnostics: RoutingDiagnostic[] } {
    if (!raw.routing?.layers.length) throw new Error('RoutingBoard V2 requires native routing capture. Reload the extension.');
    const layerNames = raw.routing.layers;
    const drillOnly = (p: RawPcb['pads'][number]) => !p.shape && !!p.hole && p.plated === false;
    const outlines = nativeCopperPolygons({ sources: raw.routing.outlines, layer: 'TOP', net: '', fill: true, lineWidth: 0 });
    if (outlines.length !== 1) throw new Error('Board outline is not one connected region');
    // Reuse V1 rule/layer/keepout parsing without its lossy physical-copper/pad conversions.
    const imported = importEasyEdaAutorouteJson({ ...source, components: {}, tracks: [], vias: [], fillRegions: [],
        boardOutline: { path: [...outlines[0].outer, outlines[0].outer[0]].map(p => [p.x, -p.y]) },
    }, { copperLayerIds: layerNames.map(name => name === 'TOP' ? 1 : name === 'BOTTOM' ? 2 : 14 + Number(name.slice(6))) });
    if (!imported.board) throw new Error(imported.diagnostics.map(d => d.message).join('\n'));
    const diagnostics: RoutingDiagnostic[] = [...imported.diagnostics, {
        code: 'EASYEDA_V2_SEQUENTIAL_CAPTURE', severity: 'warning',
        message: 'CAD reads are sequential, not atomic. Do not edit the PCB during export; native pour freshness is unknown.',
    }];
    for (const layer of raw.routing.planeLayers) diagnostics.push({
        code: 'EASYEDA_V2_PLANE_COPPER_UNAVAILABLE', severity: 'warning',
        message: `${layer}: internal electrical-plane copper is not exposed by the captured Pour/Poured/Fill objects. This export is incomplete for plane-dependent analysis.`,
    });
    const filled = (layer: string, parts: RawPcbPolygon[], ids: string[], missing = false): FilledPolygons => {
        if (missing) {
            diagnostics.push({ code: 'EASYEDA_V2_POUR_FILL_MISSING', severity: 'warning', message: `${layer}: no native Poured object for a Pour.` });
            return { layer, source: 'cad', status: 'missing', reason: 'No native Poured object for this Pour', nativePrimitiveIds: ids };
        }
        try {
            if (parts.some(p => p.lineWidth > 0)) diagnostics.push({
                code: 'EASYEDA_V2_STROKE_JOINS_UNVERIFIED', severity: 'warning',
                message: `${ids.join(', ')}: stroke expansion uses round joins/caps; verify against CAD copper in the pilot audit.`,
            });
            const polygons = parts.flatMap(nativeCopperPolygons);
            return { layer, source: 'cad', status: 'available', freshness: 'unknown', nativePrimitiveIds: ids,
                polygons: pathsToPolygons(toPaths(polygons.flatMap(p => [p.outer, ...(p.holes ?? [])])), ClipperLib.PolyFillType.pftNonZero) };
        } catch (error) {
            const reason = String(error);
            diagnostics.push({ code: 'EASYEDA_V2_COPPER_UNSUPPORTED', severity: 'warning', message: `${ids.join(', ')}: ${reason}` });
            return { layer, source: 'cad', status: 'unsupported', reason, nativePrimitiveIds: ids };
        }
    };
    const zones: RoutingBoardV2['copper']['fixed']['zones'][number][] = [];
    for (const pour of raw.routing.pours.filter(p => copperLayer(p.layer))) {
        const polygons = nativeCopperPolygons({ ...pour, lineWidth: 0 });
        if (!pour.id || polygons.length !== 1) throw new Error('Pour must have a stable ID and one outline');
        zones.push({ id: pour.id, kind: 'pour', ...(pour.net ? { net: pour.net } : {}), layers: [pour.layer], outline: polygons[0],
            priority: pour.priority, preserveIslands: pour.preserveIslands,
            filledPolygons: [filled(pour.layer, raw.polygons.filter(p => p.pourId === pour.id), pour.pouredIds, !pour.pouredIds.length)],
            refillRules: readEasyEdaPourRefillRules(drc, pour.net),
        });
    }
    for (const poly of raw.polygons.filter(p => !p.pourId && copperLayer(p.layer))) {
        if (!poly.id) throw new Error('Fill has no native ID');
        const outlines = nativeCopperPolygons({ ...poly, fillMode: undefined, lineWidth: 0 });
        if (outlines.length !== 1) throw new Error(`Fill ${poly.id} has multiple outline regions`);
        zones.push({ id: poly.id, kind: 'fill', ...(poly.net ? { net: poly.net } : {}), layers: [poly.layer], outline: outlines[0],
            filledPolygons: [filled(poly.layer, [poly], [poly.id])] });
    }
    const board: RoutingBoardV2 = {
        ...imported.board, outline: outlines[0].outer, cutouts: outlines[0].holes ?? [],
        layers: layerNames.map((name, index) => ({ name, index, side: name === 'TOP' ? 'top' : name === 'BOTTOM' ? 'bottom' : 'inner' })),
        rules: mergeEasyEdaDrcIntoRoutingRules(drc, imported.board.rules),
        components: raw.components.map(c => ({ id: c.id, designator: c.designator, partUuid: c.partUuid, value: c.value, footprintName: c.footprintName,
            at: point(c), rotationDeg: -c.rotate, side: c.layer === 'BOTTOM' ? 'bottom' : 'top' })),
        holes: raw.pads.filter(drillOnly).map(p => {
            if (!p.id) throw new Error('Independent hole has no native ID');
            const hole = padHole(p)!, at = point(p), offset = hole.offset!, angle = degrees(p.rotation) * Math.PI / 180;
            return { id: p.id, at: { x: at.x + offset.x * Math.cos(angle) - offset.y * Math.sin(angle),
                y: at.y + offset.x * Math.sin(angle) + offset.y * Math.cos(angle) },
                hole: { ...hole, offset: undefined, rotationDeg: degrees(p.rotation) + (hole.rotationDeg ?? 0) } };
        }),
        pads: raw.pads.filter(p => !drillOnly(p) && (copperLayer(p.layer) || p.layer === 'MULTI')).map(p => {
            if (!p.id) throw new Error('Pad has no native ID');
            // EasyEDA can report a phantom drill for single-layer POLYGON pads whose source has hole:null.
            const ignoreHole = !!p.hole && p.shape?.[0] === 'POLYGON' && (p.layer === 'TOP' || p.layer === 'BOTTOM');
            if (ignoreHole) diagnostics.push({
                code: 'EASYEDA_V2_SINGLE_LAYER_POLYGON_HOLE_IGNORED', severity: 'warning',
                message: `${p.component ?? 'standalone'}.${p.padNumber} (${p.id}): ignored API hole on ${p.layer} POLYGON pad (EasyEDA compatibility workaround).`,
            });
            const layers = p.layer === 'MULTI' ? layerNames : [p.layer];
            const at = point(p), angle = -degrees(p.rotation) * Math.PI / 180;
            // Native POLYGON pad commands are absolute, including bottom-side mirroring.
            const localize = (q: PointMm) => ({ x: (q.x - at.x) * Math.cos(angle) - (q.y - at.y) * Math.sin(angle),
                y: (q.x - at.x) * Math.sin(angle) + (q.y - at.y) * Math.cos(angle) });
            const shapesByLayer: Record<string, RoutingPadShape> = {};
            for (const [from, to, shape] of p.specialPad ?? []) {
                const start = layerNames.indexOf(layerName(from)), end = layerNames.indexOf(layerName(to));
                if (start < 0 || end < start) throw new Error(`Unresolved special pad span ${p.id}`);
                for (const layer of layerNames.slice(start, end + 1)) shapesByLayer[layer] = padShape(shape, localize);
            }
            return { id: p.id, component: p.component, number: p.padNumber, ...(p.net ? { net: p.net } : {}), at: point(p), rotationDeg: degrees(p.rotation),
                layers, shape: padShape(p.shape, localize), ...(p.specialPad?.length ? { shapesByLayer: Object.fromEntries(layers.map(l => [l, shapesByLayer[l] ?? padShape(p.shape, localize)])) } : {}),
                ...(p.hole && !ignoreHole ? { hole: padHole(p) } : {}),
            };
        }),
        copper: { editable: { tracks: [], vias: [], zones: [] }, fixed: {
            tracks: [
                ...raw.routing.polylines.flatMap(p => rings(p.sources).map(points => ({ id: p.id, ...(p.net ? { net: p.net } : {}),
                    layer: p.layer, widthMm: p.lineWidth, points: [...points, points[0]] }))),
                ...raw.tracks.filter(t => copperLayer(t.layer)).map(t => ({ id: t.id, ...(t.net ? { net: t.net } : {}), layer: t.layer,
                    widthMm: t.width, points: [point({ x: t.x1, y: t.y1 }), point({ x: t.x2, y: t.y2 })] })),
                ...raw.arcs.filter(t => copperLayer(t.layer)).map(t => {
                    const start = point({ x: t.x1, y: t.y1 }), end = point({ x: t.x2, y: t.y2 });
                    const sampled = tessellateArc(start, end, -t.arcAngle);
                    if (!sampled) throw new Error(`Unsupported copper arc ${t.id}`);
                    return { id: t.id, ...(t.net ? { net: t.net } : {}), layer: t.layer, widthMm: t.width, points: [start, ...sampled] };
                }),
            ],
            vias: raw.vias.map(v => {
                let from = 0, to = layerNames.length - 1;
                if (v.blindViaRule) {
                    const span = readEasyEdaBlindViaSpan(drc, v.blindViaRule, v.net);
                    const start = span ? layerNames.indexOf(layerName(span.startLayer)) : -1;
                    const end = span ? layerNames.indexOf(layerName(span.endLayer)) : -1;
                    if (start < 0 || end < 0 || start === end) throw new Error(`Unresolved via span ${v.id} (rule: ${v.blindViaRule})`);
                    from = Math.min(start, end); to = Math.max(start, end);
                } else if (v.viaType !== 0 && v.viaType !== 2) {
                    throw new Error(`Unresolved via span/type ${v.id} (rule: missing)`);
                }
                return { id: v.id, ...(v.net ? { net: v.net } : {}), at: point(v), diameterMm: v.diameter, drillMm: v.drill,
                    type: from === 0 && to === layerNames.length - 1 ? 'through' : 'blind-buried', fromLayer: layerNames[from], toLayer: layerNames[to] };
            }), zones,
        } },
    };
    const nets = [...new Set([...board.nets.map(n => n.name), ...board.pads.map(p => p.net), ...board.copper.fixed.tracks.map(t => t.net),
        ...board.copper.fixed.vias.map(v => v.net), ...zones.map(z => z.net)].filter((n): n is string => !!n))].sort().map(name => ({ name }));
    return { board: { ...board, nets }, diagnostics };
}
