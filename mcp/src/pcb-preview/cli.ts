#!/usr/bin/env node
// Offline test renderer for pcb-data.json -> SVG/PNG preview.
// Usage: node dist/pcb-preview/cli.js [options-json|@options.json] [data-json]
//   node dist/pcb-preview/cli.js '{"layers":["top"],"zoom":{"mode":"net","net":"VOUT_5V"}}' pcb-data-rp2040.json
//   node dist/pcb-preview/cli.js @options.json pcb-data-rp2040.json

import fs from 'node:fs';
import path from 'node:path';
import { savePcbPreview } from './index.js';
import type { PreviewOptions, ZoomTarget } from './types.js';
import { PcbLayerName } from '@copilot/shared/types/pcb/shared.js';

function loadRawOptions(arg: string | undefined): Record<string, unknown> {
    if (!arg) return {};
    if (arg.startsWith('@')) {
        const filePath = path.resolve(arg.slice(1));
        return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
    }
    if (arg.endsWith('.json') && fs.existsSync(path.resolve(arg))) {
        return JSON.parse(fs.readFileSync(path.resolve(arg), 'utf-8')) as Record<string, unknown>;
    }
    return JSON.parse(arg) as Record<string, unknown>;
}

const rawOptions = loadRawOptions(process.argv[2]);
const dataPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.resolve('pcb-data-rp2040.json');

function toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String);
    return [];
}

function normalizeZoom(zoom: unknown): ZoomTarget {
    if (zoom && typeof zoom === 'object') {
        const mode = (zoom as Record<string, unknown>).mode;
        if (mode === 'net' && typeof (zoom as Record<string, unknown>).net === 'string') {
            return { mode: 'net', net: String((zoom as Record<string, unknown>).net) };
        }
        if (mode === 'component' && typeof (zoom as Record<string, unknown>).designator === 'string') {
            return { mode: 'component', designator: String((zoom as Record<string, unknown>).designator) };
        }
        if (mode === 'bbox') {
            const bbox = (zoom as Record<string, unknown>).bbox as Record<string, unknown>;
            if (bbox && typeof bbox.x === 'number' && typeof bbox.y === 'number' && typeof bbox.width === 'number' && typeof bbox.height === 'number') {
                const unit = bbox.unit === 'rel' ? 'rel' : 'mm';
                return {
                    mode: 'bbox',
                    bbox: {
                        x: bbox.x,
                        y: bbox.y,
                        width: bbox.width,
                        height: bbox.height,
                        unit,
                    } as ZoomTarget extends { mode: 'bbox'; bbox: infer B } ? B : never,
                };
            }
        }
    }
    return { mode: 'full' };
}

function normalizeShow(show: unknown): PreviewOptions['show'] {
    if (!show || typeof show !== 'object') return {
        tracks: true,
        pads: true,
        vias: true,
        polygons: true,
        components: true,
        netLabels: true
    };
    return {
        tracks: (show as Record<string, unknown>).tracks as boolean | undefined,
        pads: (show as Record<string, unknown>).pads as boolean | undefined,
        vias: (show as Record<string, unknown>).vias as boolean | undefined,
        polygons: (show as Record<string, unknown>).polygons as boolean | undefined,
        components: (show as Record<string, unknown>).components as boolean | undefined,
        netLabels: (show as Record<string, unknown>).net_labels as boolean | undefined,
    };
}

function normalizeColorMap(map: unknown): Record<string, string> {
    if (!map || typeof map !== 'object') return {};
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(map as Record<string, unknown>)) {
        if (typeof value === 'string') result[key] = value;
    }
    return result;
}

const show = normalizeShow(rawOptions.show);
if (typeof rawOptions.show_net_labels === 'boolean') {
    show.netLabels = rawOptions.show_net_labels;
}

const options: PreviewOptions = {
    layers: (rawOptions.layers as PcbLayerName[]) || ['all'],
    highlightNets: toStringArray(rawOptions.highlight_nets),
    highlightComponents: toStringArray(rawOptions.highlight_components),
    highlightNetColors: normalizeColorMap(rawOptions.highlight_net_colors),
    highlightComponentColors: normalizeColorMap(rawOptions.highlight_component_colors),
    zoom: normalizeZoom(rawOptions.zoom),
    paddingMm: typeof rawOptions.padding_mm === 'number' ? rawOptions.padding_mm : 2,
    show,
    widthPx: typeof rawOptions.width_px === 'number' ? rawOptions.width_px : 1600,
    polygonLabelStepMm: typeof rawOptions.polygon_label_step_mm === 'number' ? rawOptions.polygon_label_step_mm : undefined,
    debug: !!rawOptions.debug,
};

const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

const { pngPath, svgPath } = await savePcbPreview(data, options);

console.log('Rendered PNG:', pngPath);
console.log('Rendered SVG:', svgPath);
