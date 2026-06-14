import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import type { PcbData, PreviewOptions, PreviewResult } from './types.js';
import { computeViewBox, renderPcbToSvg } from './renderer.js';

export * from './types.js';
export { renderPcbToSvg, computeViewBox, renderDiagnostics } from './renderer.js';

export async function renderPcbPreview(data: PcbData, options: PreviewOptions): Promise<PreviewResult> {
    const svg = renderPcbToSvg(data, options);
    const pngBuffer = await sharp(Buffer.from(svg))
        .resize(options.widthPx, null, { withoutEnlargement: false })
        .png()
        .toBuffer();

    return {
        svg,
        pngBuffer,
        viewBox: computeViewBox(data, options),
    };
}

export async function savePcbPreview(
    data: PcbData,
    options: PreviewOptions,
    fileName?: string,
): Promise<{ svgPath: string; pngPath: string }> {
    const { svg, pngBuffer } = await renderPcbPreview(data, options);
    const previewDir = join(tmpdir(), 'easyeda-copilot-mcp', 'pcb-previews');
    await mkdir(previewDir, { recursive: true });

    const baseName = fileName ?? `pcb-preview-${Date.now()}`;
    const svgPath = join(previewDir, `${baseName}.svg`);
    const pngPath = join(previewDir, `${baseName}.png`);

    await Promise.all([
        writeFile(svgPath, svg, 'utf8'),
        writeFile(pngPath, pngBuffer),
    ]);

    return { svgPath, pngPath };
}
