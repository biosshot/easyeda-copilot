import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import * as z from 'zod/v4';
import { Bridge } from "../../bridge";
import { textResult } from "../../utils/tool-result";
import { readFile } from "node:fs/promises";
import { fitOutline, parseSvgOutline } from "../../utils/svg-path";

const SilkscreenLayer = () => z.enum(['top', 'bottom']);

const SilkscreenAlign = () => z.enum([
    'left_top', 'left_middle', 'left_bottom',
    'center_top', 'center', 'center_bottom',
    'right_top', 'right_middle', 'right_bottom',
]);

const SilkscreenTextItem = () => z.object({
    text: z.string().min(1).describe('Text to place. Keep it short — silkscreen is coarse and long strings collide with parts.'),
    x: z.number().describe('X of the anchor point in mm, same origin as component coordinates from get_current_pcb.'),
    y: z.number().describe('Y of the anchor point in mm.'),
    layer: SilkscreenLayer().default('top').describe('Silkscreen layer.'),
    height: z.number().min(0.5).max(10).default(1)
        .describe('Character height in mm. Most fabs cannot reliably print below 0.8 mm.'),
    line_width: z.number().min(0.08).max(1).default(0.15)
        .describe('Stroke width in mm. Below 0.15 mm the fab may drop the text.'),
    rotation: z.number().default(0).describe('Rotation in degrees.'),
    align: SilkscreenAlign().default('center').describe('Which point of the text sits exactly at (x, y).'),
    mirror: z.boolean().optional()
        .describe('Mirror the glyphs. Off by default: EasyEDA already flips the bottom layer when rendering, so mirroring here would flip it back. Verified on a real board.'),
});

export function registerPcbSilkscreenTools(server: McpServer, bridge: Bridge) {
    server.registerTool(
        'get_pcb_component_geometry',
        {
            title: 'Get PCB Component Geometry',
            description: 'Return exact geometry of components on the currently opened PCB: bounding box and the position of every pad, in mm. ' +
                'get_current_pcb lists pad names and nets but no pad coordinates, so use this whenever placement must be precise — ' +
                'labelling individual connector pins, or finding free space next to a part without overlapping it. ' +
                'Pad order in the footprint is data here, not a guess: read pad "1" to see which end of a header it actually sits on.',
            inputSchema: z.object({
                designators: z.array(z.string()).optional()
                    .describe('Limit to these designators. Omit for every component on the board.'),
                include_pads: z.boolean().default(true)
                    .describe('Include per-pad coordinates. Set false when only bounding boxes are needed.'),
            }),
        },
        async (args) => {
            const result = await bridge.requestEasyEda('get-pcb-component-geometry', args, 120000);
            return textResult(result);
        },
    );

    server.registerTool(
        'add_pcb_silkscreen_text',
        {
            title: 'Add PCB Silkscreen Text',
            description: 'Place free-form text on the silkscreen of the currently opened PCB document — connector pinouts, board name, revision, polarity marks. ' +
                'Reference designators are handled by the layout assembler and are not affected. ' +
                'Coordinates and sizes are in mm. Open the target PCB document first, and call get_current_pcb to get component positions to place labels against. ' +
                'Re-running the same call updates the text already at that spot instead of stacking duplicates, so the call is safe to repeat. ' +
                'Matching is by text AND position, so the same wording may appear in several places (a GND label at two connectors). ' +
                'To move a label, delete it and add it at the new spot — placing the same text elsewhere creates a second one.',
            inputSchema: z.object({
                items: z.array(SilkscreenTextItem()).min(1).describe('Text items to place.'),
                replace_existing: z.boolean().default(true)
                    .describe('Update text with identical content on the same layer instead of adding a duplicate.'),
                font_family: z.string().optional()
                    .describe('Font name. Must already be imported into EasyEDA; defaults to the first available font.'),
            }),
        },
        async (args) => {
            const result = await bridge.requestEasyEda('add-pcb-silkscreen-text', args, 120000);
            return textResult(result);
        },
    );

    server.registerTool(
        'add_pcb_silkscreen_image',
        {
            title: 'Add PCB Silkscreen Image',
            description: 'Place a vector outline from an SVG file onto the silkscreen of the currently opened PCB — a logo or an icon. ' +
                'The SVG must consist of <path> elements; convert shapes and text to paths first. Curves and arcs are flattened automatically, ' +
                'and inner subpaths become holes, so an icon with a cut-out renders correctly. ' +
                'Aspect ratio is always preserved: give width or height, not both. ' +
                'Mirroring is off by default on both layers: EasyEDA already flips the bottom layer when rendering.',
            inputSchema: z.object({
                svg_path: z.string().min(1).describe('Absolute path to the .svg file on disk.'),
                x: z.number().describe('X of the image centre in mm.'),
                y: z.number().describe('Y of the image centre in mm.'),
                layer: SilkscreenLayer().default('bottom').describe('Silkscreen layer.'),
                width: z.number().min(0.5).max(300).optional().describe('Target width in mm. Omit to size by height.'),
                height: z.number().min(0.5).max(300).optional().describe('Target height in mm. Omit to size by width.'),
                rotation: z.number().default(0).describe('Rotation in degrees.'),
                mirror: z.boolean().optional().describe('Override mirroring. Off by default; EasyEDA already flips the bottom layer itself.'),
                tolerance: z.number().min(0.05).max(5).default(0.4)
                    .describe('Curve flattening tolerance in SVG units. Lower means smoother outlines and more points.'),
            }),
        },
        async ({ svg_path, x, y, layer, width, height, rotation, mirror, tolerance }) => {
            if (!width && !height) {
                return textResult({ error: 'Pass width or height in mm.' });
            }

            let svg: string;
            try {
                svg = await readFile(svg_path, 'utf8');
            } catch (error) {
                return textResult({ error: `Cannot read SVG: ${(error as Error).message}` });
            }

            let rings;
            try {
                const outline = parseSvgOutline(svg, tolerance);
                rings = fitOutline(outline, width, height);
            } catch (error) {
                return textResult({ error: `Cannot convert SVG: ${(error as Error).message}` });
            }

            const result = await bridge.requestEasyEda('add-pcb-silkscreen-image', {
                rings, x, y, layer, rotation, mirror, width, height,
            }, 120000);

            return textResult(result);
        },
    );

    server.registerTool(
        'get_pcb_silkscreen_images',
        {
            title: 'Get PCB Silkscreen Images',
            description: 'List vector images placed on the silkscreen of the currently opened PCB, with primitive ids, centres and sizes in mm. ' +
                'Use it to verify placement or to find ids for delete_pcb_silkscreen_images.',
            inputSchema: z.object({
                layer: SilkscreenLayer().optional().describe('Restrict to one layer. Omit for both.'),
            }),
        },
        async ({ layer }) => {
            const result = await bridge.requestEasyEda('get-pcb-silkscreen-images', { layer });
            return textResult(result);
        },
    );

    server.registerTool(
        'delete_pcb_silkscreen_images',
        {
            title: 'Delete PCB Silkscreen Images',
            description: 'Remove silkscreen images from the currently opened PCB by primitive id.',
            inputSchema: z.object({
                primitive_ids: z.array(z.string()).min(1).describe('Primitive ids from get_pcb_silkscreen_images.'),
            }),
        },
        async (args) => {
            const result = await bridge.requestEasyEda('delete-pcb-silkscreen-images', args);
            return textResult(result);
        },
    );

    server.registerTool(
        'get_pcb_silkscreen_text',
        {
            title: 'Get PCB Silkscreen Text',
            description: 'List free-form silkscreen text on the currently opened PCB document, with primitive ids and positions in mm. ' +
                'Use it to verify placement after add_pcb_silkscreen_text or to find ids for delete_pcb_silkscreen_text.',
            inputSchema: z.object({
                layer: SilkscreenLayer().optional().describe('Restrict to one layer. Omit for both.'),
            }),
        },
        async ({ layer }) => {
            const result = await bridge.requestEasyEda('get-pcb-silkscreen-text', { layer });
            return textResult(result);
        },
    );

    server.registerTool(
        'delete_pcb_silkscreen_text',
        {
            title: 'Delete PCB Silkscreen Text',
            description: 'Remove free-form silkscreen text from the currently opened PCB document, by primitive id or by exact text content.',
            inputSchema: z.object({
                primitive_ids: z.array(z.string()).optional().describe('Primitive ids from get_pcb_silkscreen_text.'),
                texts: z.array(z.string()).optional().describe('Delete every text whose content matches exactly.'),
                layer: SilkscreenLayer().optional().describe('Restrict deletion to one layer.'),
            }),
        },
        async (args) => {
            const result = await bridge.requestEasyEda('delete-pcb-silkscreen-text', args);
            return textResult(result);
        },
    );
}
