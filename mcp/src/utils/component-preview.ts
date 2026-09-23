import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { componentSymbol } from 'eda-copilot-backend/components';
import type { Component } from 'eda-copilot-backend/components';
import { renderComponentSymbol } from '../component-symbol-preview';
import { TEMP_DIR } from './dirs';
import { svgToPng } from './svg-to-png';

export function needsSymbolPreview(component: Component) {
    return component.pins.length > 0 && component.pins.every(pin =>
        !pin.name.trim() || /^\d+$/.test(pin.name.trim()),
    );
}

export async function createComponentPreview(partUuid: Component['part_uuid']) {
    const { dataStr } = await componentSymbol(partUuid);
    const preview = renderComponentSymbol(dataStr);
    const png = await svgToPng(preview.svg, { width: 1800, height: 3000 });
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
        png,
        metadata: {
            part_uuid: partUuid,
            image_path: pngPath,
            svg_path: svgPath,
            sections: preview.sections,
            warnings: preview.warnings,
            note: 'This is the library schematic symbol. Confirm physical pin functions and relay contact state against the exact part datasheet before wiring.',
        },
    };
}
