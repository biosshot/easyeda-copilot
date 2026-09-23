import { writeFile } from 'node:fs/promises';
import { svgToPng } from '../utils/svg-to-png.js';
import type { PreviewOptions, PreviewResult } from './types.js';
import { renderPcbToSvg } from './renderer.js';
import { RawPcb } from '@copilot/shared/types/pcb/raw.js';

export * from './types.js';

export async function renderPcbPreview(data: RawPcb, options: PreviewOptions): Promise<PreviewResult> {
    const svg = renderPcbToSvg(data, options);
    const pngBuffer = await svgToPng(svg.svg, { width: options.widthPx, height: 1600 });

    return {
        svg: svg.svg,
        pngBuffer,
    };
}

export async function savePcbPreview(
    data: RawPcb,
    options: PreviewOptions,
    fileName: string,
): Promise<{ svgPath: string; pngPath: string }> {
    const { svg, pngBuffer } = await renderPcbPreview(data, options);

    const svgPath = `${fileName}.svg`;
    const pngPath = `${fileName}.png`;

    await Promise.all([
        writeFile(svgPath, svg, 'utf8'),
        writeFile(pngPath, pngBuffer),
    ]);

    return { svgPath, pngPath };
}
