import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import type { PreviewOptions, PreviewResult } from './types.js';
import { computeViewBox, renderPcbToSvg } from './renderer.js';
import { RawPcb } from '@copilot/shared/types/pcb/raw.js';

export * from './types.js';

export async function renderPcbPreview(data: RawPcb, options: PreviewOptions): Promise<PreviewResult> {
    const svg = renderPcbToSvg(data, options);
    const pngBuffer = await sharp(Buffer.from(svg.svg))
        .resize({
            width: options.widthPx,
            height: 1600,
            fit: 'inside'
        })
        .png()
        .toBuffer();

    return {
        svg: svg.svg,
        pngBuffer,
        viewBox: computeViewBox(data, options),
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
