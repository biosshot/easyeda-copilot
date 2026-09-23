import sharp from 'sharp';

/** Shared rasterization for MCP previews sent to vision-capable agents. */
export async function svgToPng(svg: string | Buffer, size?: { width?: number; height?: number; withoutEnlargement?: boolean }) {
    const pipeline = sharp(Buffer.isBuffer(svg) ? svg : Buffer.from(svg));
    if (size?.width || size?.height) {
        pipeline.resize({ width: size.width, height: size.height, fit: 'inside', withoutEnlargement: size.withoutEnlargement });
    }
    return pipeline.png().toBuffer();
}
