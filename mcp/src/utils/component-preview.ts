import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { componentSymbol } from 'eda-copilot-backend/components';
import type { Component } from 'eda-copilot-backend/components';
import { renderComponentSymbol } from '../component-symbol-preview';
import { TEMP_DIR } from './dirs';
import { svgToPng } from './svg-to-png';

export function needsSymbolPreview(component: Component) {
    if (component.pins.length <= 1) return false;
    // Only ordinary two-terminal parts have interchangeable connections.
    // Never exempt capacitors: their polarity is not reliably available here.
    if (component.pins.length === 2 && /^(?:R|L|FB|F|FU)\?$/i.test(component.designatorPattern ?? '')
        && !/potentiometer|variable|array|network|coupled|transformer/i.test(component.description)) return false;
    return component.pins.some(pin => {
        const name = pin.name.trim();
        return !name || name === String(pin.pin_number).trim() || /^\d+$/.test(name);
    });
}

export async function createComponentPreview(partUuid: Component['part_uuid']) {
    const { dataStr } = await componentSymbol(partUuid);
    const preview = renderComponentSymbol(dataStr);
    const png = await svgToPng(preview.svg, { width: 1024, height: 1200, withoutEnlargement: true });
    const directory = join(TEMP_DIR, 'component-previews');
    await mkdir(directory, { recursive: true });
    const base = join(directory, randomUUID());
    const svgPath = `${base}.svg`;
    const pngPath = `${base}.png`;
    await Promise.all([
        writeFile(svgPath, preview.svg, 'utf8'),
        writeFile(pngPath, png),
    ]);
    return {
        part_uuid: partUuid,
        image_path: pngPath,
        svg_path: svgPath,
        sections: preview.sections,
        warnings: preview.warnings,
        note: 'This is the library schematic symbol. Confirm physical pin functions and relay contact state against the exact part datasheet before wiring.',
    };
}
