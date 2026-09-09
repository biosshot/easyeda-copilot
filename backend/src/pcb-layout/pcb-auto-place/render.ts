import { boardBox, boardHoleKeepoutRadius, boardOutlinePolygon, getBox, getLocalPointWorld, getPadWorld, unionBoxes } from './geometry.ts';
import type { Box, FootprintSpec, PcbComponent, Placement, PlacementInput, Point } from '../../types/pcb/layout-model.ts';
import { allNets, ignoredSignalSet } from './utils.ts';

export interface RenderPlacementSvgOptions {
    bounds?: Box;
    title?: string;
    labels?: boolean;
    viewLayer?: Placement['layer'];
    ratsnest?: boolean;
    signalPaths?: boolean;
}

export function renderPlacementSvg(input: PlacementInput, placements: Placement[], options: RenderPlacementSvgOptions = {}) {
    const placementByDesignator = new Map(placements.map((placement) => [placement.designator, placement]));
    const board = boardBox(input.board);
    const placedComponentBoxes = input.components.flatMap((component) => {
        const placement = placementByDesignator.get(component.designator);
        return placement ? [getBox(component, placement)] : [];
    });
    const viewport = options.bounds ?? inflateBox(unionBoxes([board, ...placedComponentBoxes]), 2);
    const ignoredSignals = ignoredSignalSet(input);
    const scale = 12;
    const width = Math.max(1, (viewport.right - viewport.left) * scale);
    const height = Math.max(1, (viewport.bottom - viewport.top) * scale);
    const px = (value: number) => (value - viewport.left) * scale;
    const py = (value: number) => (value - viewport.top) * scale;
    const padItems: string[] = [];
    const componentItems: string[] = [];
    const holeItems = (input.boardHoles ?? []).filter((hole) => {
        const radius = boardHoleKeepoutRadius(hole);
        return boxesIntersect(
            { left: hole.x - radius, right: hole.x + radius, top: hole.y - radius, bottom: hole.y + radius },
            viewport,
        );
    }).map((hole) => {
        const radius = boardHoleKeepoutRadius(hole);
        return `<g>
  <circle cx="${px(hole.x)}" cy="${py(hole.y)}" r="${radius * scale}" fill="rgba(15,23,42,0.08)" stroke="#475569" stroke-width="1" stroke-dasharray="4 3"><title>${hole.name} keepout</title></circle>
  <circle cx="${px(hole.x)}" cy="${py(hole.y)}" r="${hole.drill * scale / 2}" fill="#f8fafc" stroke="#0f172a" stroke-width="1.5"><title>${hole.name} drill ${hole.drill}mm</title></circle>
</g>`;
    });
    const ratItems: string[] = [];
    const signalPathItems = options.signalPaths === false
        ? []
        : renderSignalPathGuides(input, placementByDesignator, px, py);

    for (const component of input.components) {
        const placement = placementByDesignator.get(component.designator);
        if (!placement) continue;

        const box = getBox(component, placement);
        const colors = componentLayerColors(options.viewLayer ?? placement.layer);
        const componentVisible = options.viewLayer === undefined || options.viewLayer === placement.layer;
        const fallbackBody = !componentVisible || component.footprint.graphics?.length
            ? ''
            : `<rect x="${px(box.left)}" y="${py(box.top)}" width="${(box.right - box.left) * scale}" height="${(box.bottom - box.top) * scale}" rx="3" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1.5"/>`;
        const footprintGraphics = componentVisible
            ? renderFootprintGraphics(component, placement, scale, px, py, colors)
            : '';
        const routingKeepouts = renderGeneratedRoutingKeepouts(component, placement, scale, px, py, options.viewLayer);
        const generatedCopper = renderGeneratedPolygons(component, placement, scale, px, py, options.viewLayer);
        const labels = options.labels === false ? '' : `
  ${fallbackBody}
  ${routingKeepouts}
  ${generatedCopper}
  ${footprintGraphics}
  <text x="${px(placement.x)}" y="${py(placement.y + 0.1)}" font-size="11" font-family="Arial" text-anchor="middle" fill="${colors.text}">${component.designator}</text>
  <text x="${px(placement.x)}" y="${py(placement.y - 1.1)}" font-size="8" font-family="Arial" text-anchor="middle" fill="${colors.textMuted}">r${placement.rotate} ${placement.layer}</text>`;
        componentItems.push(`<g>
  ${options.labels === false ? fallbackBody + routingKeepouts + generatedCopper + footprintGraphics : labels}
</g>`);

        for (const pad of component.footprint.pads) {
            const throughHole = pad.mount === 'through_hole' || (pad.drillDiameter ?? 0) > 0;
            if (options.viewLayer !== undefined && options.viewLayer !== placement.layer && !throughHole) continue;
            padItems.push(renderFootprintPad(component, placement, pad, scale, px, py, colors));
        }
    }

    for (const net of options.ratsnest === false ? [] : allNets(input)) {
        if (ignoredSignals.has(net)) continue;

        const pads = input.components.flatMap((component) => component.pins
            .filter((pin) => pin.signal_name === net)
            .map((pin) => {
                const placement = placementByDesignator.get(component.designator);
                if (!placement) return null;
                const point = getPadWorld(component, placement, pin.pin_number);
                return point ? { point } : null;
            })
            .filter((item): item is { point: Point } => item !== null));

        if (pads.length < 2) continue;
        const sorted = pads.slice().sort((a, b) => a.point.x - b.point.x);
        for (let i = 1; i < sorted.length; i++) {
            ratItems.push(`<line x1="${px(sorted[i - 1].point.x)}" y1="${py(sorted[i - 1].point.y)}" x2="${px(sorted[i].point.x)}" y2="${py(sorted[i].point.y)}" stroke="#ef4444" stroke-width="1" stroke-dasharray="4 3"><title>${net}</title></line>`);
        }
    }

    const boardLayer = options.bounds
        ? `<rect x="0.5" y="0.5" width="${Math.max(0, width - 1)}" height="${Math.max(0, height - 1)}" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>`
        : `<polygon points="${boardOutlinePolygon(input.board).map((point) => `${px(point.x)},${py(point.y)}`).join(' ')}" fill="#ecfccb" stroke="#365314" stroke-width="2"/>`;
    const boardOutlineLayer = options.bounds
        ? ''
        : `<polygon points="${boardOutlinePolygon(input.board).map((point) => `${px(point.x)},${py(point.y)}`).join(' ')}" fill="none" stroke="#14532d" stroke-width="3"/>`;
    const title = options.title
        ? `<text x="8" y="16" font-size="12" font-family="Arial" fill="#0f172a">${escapeXml(options.title)}</text>`
        : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect x="0" y="0" width="${width}" height="${height}" fill="#f8fafc"/>
${boardLayer}
${title}
${ratItems.join('\n')}
${signalPathItems.join('\n')}
${holeItems.join('\n')}
${componentItems.join('\n')}
${padItems.join('\n')}
${boardOutlineLayer}
</svg>`;
}

export function renderPlacementSubsetSvg(
    input: PlacementInput,
    placements: Placement[],
    options: { title?: string; padding?: number; labels?: boolean; viewLayer?: Placement['layer']; ratsnest?: boolean; signalPaths?: boolean } = {},
) {
    const componentByDesignator = new Map(input.components.map((component) => [component.designator, component]));
    const boxes = placements.flatMap((placement) => {
        const component = componentByDesignator.get(placement.designator);
        return component ? [getBox(component, placement)] : [];
    });
    const padding = options.padding ?? 0;
    const box = boxes.length > 0
        ? inflateBox(unionBoxes(boxes), padding)
        : { left: -5, right: 5, top: -5, bottom: 5 };
    return renderPlacementSvg(input, placements, {
        bounds: box,
        title: options.title,
        labels: options.labels,
        viewLayer: options.viewLayer,
        ratsnest: options.ratsnest,
        signalPaths: options.signalPaths,
    });
}

function renderSignalPathGuides(
    input: PlacementInput,
    placements: Map<string, Placement>,
    px: (value: number) => number,
    py: (value: number) => number,
) {
    const components = new Map(input.components.map((component) => [component.designator, component]));
    return (input.paths ?? []).flatMap((path, pathIndex) => {
        const color = signalPathColor(pathIndex);
        const lines: string[] = [];
        for (const segment of path.segments) {
            const source = resolvePathPad(segment.source.designator, segment.source.pin_number);
            const target = resolvePathPad(segment.target.designator, segment.target.pin_number);
            if (!source || !target) continue;
            lines.push(`<line data-signal-path="${escapeXml(path.id)}" data-path-segment="${segment.index}" x1="${px(source.x)}" y1="${py(source.y)}" x2="${px(target.x)}" y2="${py(target.y)}" stroke="${color}" stroke-width="2.4" opacity="0.9"><title>signal path ${escapeXml(path.id)} segment ${segment.index}: ${escapeXml(`${segment.source.designator}.${String(segment.source.pin_number)}`)} to ${escapeXml(`${segment.target.designator}.${String(segment.target.pin_number)}`)}; placement guide only</title></line>`);
        }
        for (let index = 1; index < path.segments.length; index += 1) {
            const entry = path.segments[index - 1].target;
            const exit = path.segments[index].source;
            const source = resolvePathPad(entry.designator, entry.pin_number);
            const target = resolvePathPad(exit.designator, exit.pin_number);
            if (!source || !target) continue;
            lines.push(`<line data-signal-path="${escapeXml(path.id)}" data-path-stage="${escapeXml(entry.designator)}" x1="${px(source.x)}" y1="${py(source.y)}" x2="${px(target.x)}" y2="${py(target.y)}" stroke="${color}" stroke-width="1.5" stroke-dasharray="3 2" opacity="0.65"><title>signal path ${escapeXml(path.id)} pass-through stage ${escapeXml(entry.designator)}; internal transfer, not a PCB trace</title></line>`);
        }
        return lines;

        function resolvePathPad(designator: string, pinNumber: string | number) {
            const component = components.get(designator);
            const placement = placements.get(designator);
            return component && placement ? getPadWorld(component, placement, pinNumber) : null;
        }
    });
}

function signalPathColor(index: number) {
    return ['#7c3aed', '#0891b2', '#c2410c', '#be123c', '#047857'][index % 5];
}

function renderGeneratedRoutingKeepouts(
    component: PcbComponent,
    placement: Placement,
    scale: number,
    px: (value: number) => number,
    py: (value: number) => number,
    viewLayer?: Placement['layer'],
) {
    const geometries = [
        ...(component.pcb.syntheticFootprint ? [component.pcb.syntheticFootprint] : []),
        ...(component.pcb.generatedGeometry ?? []),
    ];
    return geometries.flatMap((geometry) => (geometry.routingKeepouts ?? [])
        .filter((keepout) => viewLayer === undefined || keepout.layers.includes(viewLayer))
        .map((keepout) => {
            const points = keepout.points.map((point) => {
                const world = getLocalPointWorld(placement, point);
                return `${px(world.x)},${py(world.y)}`;
            }).join(' ');
            return `<polygon points="${points}" fill="rgba(124,58,237,0.05)" stroke="#7c3aed" stroke-width="${Math.max(1, 0.12 * scale)}" stroke-dasharray="6 4"><title>${geometry.name} routing keepout</title></polygon>`;
        })).join('\n');
}

function renderGeneratedPolygons(
    component: PcbComponent,
    placement: Placement,
    scale: number,
    px: (value: number) => number,
    py: (value: number) => number,
    viewLayer?: Placement['layer'],
) {
    return (component.pcb.generatedGeometry ?? []).flatMap((geometry) => geometry.polygons
        .map((polygon) => ({
            polygon,
            layer: polygon.layer === 'same'
                ? placement.layer
                : placement.layer === 'top' ? 'bottom' as const : 'top' as const,
        }))
        .filter((item) => viewLayer === undefined || item.layer === viewLayer)
        .map(({ polygon, layer }) => {
            const points = polygon.points.map((point) => {
                const world = getLocalPointWorld(placement, point);
                return `${px(world.x)},${py(world.y)}`;
            }).join(' ');
            const fill = layer === 'top' ? '#dc2626' : '#2563eb';
            return `<polygon points="${points}" fill="${fill}" opacity="0.28" stroke="${fill}" stroke-width="${Math.max(0.8, 0.08 * scale)}"><title>${geometry.name} ${layer} copper polygon</title></polygon>`;
        })).join('\n');
}

function renderFootprintGraphics(
    component: PcbComponent,
    placement: Placement,
    scale: number,
    px: (value: number) => number,
    py: (value: number) => number,
    colors: ReturnType<typeof componentLayerColors>,
) {
    return (component.footprint.graphics ?? []).map((graphic) => {
        const stroke = graphic.layer === 'silk'
            ? '#64748b'
            : graphic.layer === 'body'
                ? colors.body
                : graphic.layer === 'marking'
                    ? colors.text
                    : colors.muted;
        const strokeWidth = Math.max(0.7, graphic.strokeWidth * scale);

        if (graphic.kind === 'circle') {
            const center = getLocalPointWorld(placement, graphic);
            const edge = getLocalPointWorld(placement, { x: graphic.x + graphic.radius, y: graphic.y });
            return `<circle cx="${px(center.x)}" cy="${py(center.y)}" r="${dist(center, edge) * scale}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
        }

        const points = graphic.points.map((point) => {
            const world = getLocalPointWorld(placement, point);
            return `${px(world.x)},${py(world.y)}`;
        }).join(' ');
        const tag = graphic.closed ? 'polygon' : 'polyline';
        return `<${tag} points="${points}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }).join('\n');
}

function renderFootprintPad(
    component: PcbComponent,
    placement: Placement,
    pad: FootprintSpec['pads'][number],
    scale: number,
    px: (value: number) => number,
    py: (value: number) => number,
    colors: ReturnType<typeof componentLayerColors>,
) {
    const center = getLocalPointWorld(placement, pad);
    const roundPad = pad.shape === 'round' && Math.abs(pad.width - pad.height) < 0.001;
    const points = [
        { x: pad.x - pad.width / 2, y: pad.y - pad.height / 2 },
        { x: pad.x + pad.width / 2, y: pad.y - pad.height / 2 },
        { x: pad.x + pad.width / 2, y: pad.y + pad.height / 2 },
        { x: pad.x - pad.width / 2, y: pad.y + pad.height / 2 },
    ].map((point) => {
        const world = getLocalPointWorld(placement, point);
        return `${px(world.x)},${py(world.y)}`;
    }).join(' ');

    const copper = roundPad
        ? `<circle cx="${px(center.x)}" cy="${py(center.y)}" r="${pad.width * scale / 2}" fill="${colors.pad}" opacity="0.9"/>`
        : `<polygon points="${points}" fill="${colors.pad}" opacity="0.9"/>`;
    const drill = (pad.drillDiameter ?? 0) > 0
        ? `<circle cx="${px(center.x)}" cy="${py(center.y)}" r="${pad.drillDiameter! * scale / 2}" fill="#f8fafc" stroke="#334155" stroke-width="0.8"/>`
        : '';
    return `<g>${copper}${drill}<title>${component.designator}.${pad.pin_number} ${placement.layer}</title></g>`;
}

function dist(a: Point, b: Point) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function componentLayerColors(layer: Placement['layer']) {
    const color = layer === 'bottom' ? '#2563eb' : '#dc2626';
    return layer === 'bottom'
        ? {
            fill: 'rgba(37,99,235,0.12)',
            stroke: color,
            body: color,
            muted: color,
            pad: color,
            text: color,
            textMuted: color,
        }
        : {
            fill: 'rgba(220,38,38,0.12)',
            stroke: color,
            body: color,
            muted: color,
            pad: color,
            text: color,
            textMuted: color,
        };
}

function inflateBox(box: Box, value: number): Box {
    return {
        left: box.left - value,
        right: box.right + value,
        top: box.top - value,
        bottom: box.bottom + value,
    };
}

function boxesIntersect(a: Box, b: Box) {
    return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function escapeXml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
