import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import * as z from 'zod/v4';
import { PcbLayerNameSchema } from "@copilot/shared/types/pcb/shared";
import type { PreviewPcbReply } from "@copilot/shared/types/pcb/preview";
import type { RawPcb } from "@copilot/shared/types/pcb/raw";
import { savePcbPreview } from "../../pcb-preview";
import sharp from 'sharp';
import { Bridge } from "../../bridge";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TEMP_DIR } from "../../utils/dirs";
import { textResult } from "../../utils/tool-result";
import { ExplainPCB, ExplainPcbSchema } from "@copilot/shared/types/pcb/explain";

export function registerPcbPreviewTools(server: McpServer, bridge: Bridge) {

    const BboxMmSchema = z.object({
        x: z.number().describe('X coordinate in millimeters.'),
        y: z.number().describe('Y coordinate in millimeters.'),
        width: z.number().positive().describe('Width in millimeters.'),
        height: z.number().positive().describe('Height in millimeters.'),
        unit: z.literal('mm').optional().default('mm').describe('Unit type.'),
    });

    const BboxRelSchema = z.object({
        x: z.number().min(0).max(1).describe('Relative X (0..1) of the board bounding box.'),
        y: z.number().min(0).max(1).describe('Relative Y (0..1) of the board bounding box.'),
        width: z.number().min(0).max(1).describe('Relative width (0..1) of the board bounding box.'),
        height: z.number().min(0).max(1).describe('Relative height (0..1) of the board bounding box.'),
        unit: z.literal('rel').describe('Relative unit marker.'),
    });

    const BboxSchema = z.union([BboxMmSchema, BboxRelSchema]);

    const ZoomTargetSchema = z.discriminatedUnion('mode', [
        z.object({ mode: z.literal('full') }),
        z.object({ mode: z.literal('net'), net: z.string().min(1).describe('Net name to zoom to.') }),
        z.object({ mode: z.literal('component'), designator: z.string().min(1).describe('Component designator to zoom to, e.g. U1.') }),
        z.object({ mode: z.literal('bbox'), bbox: BboxSchema.describe('Bounding box in mm or relative units.') }),
    ]);

    server.registerTool(
        'preview_pcb',
        {
            title: 'Preview PCB',
            description: 'Render a PNG preview of the currently opened PCB document. Requires EasyEDA 3+. Tries the official canvas image API for up to 10 seconds, then falls back to the legacy renderer on error or timeout. Native previews use selection colors, ignoring custom color values, and leave the editor zoomed to the requested area. Returns image_path and notes describing any limitations or fallback. Open the target PCB document first.',
            inputSchema: z.object({
                layers: z.array(PcbLayerNameSchema().or(z.literal('all'))).default(['all']).describe('Layers to render, e.g. ["TOP"], ["BOTTOM"], ["TOP","BOTTOM"], or ["all"]. Use uppercase layer names; only "all" is lowercase.'),
                highlight_net: z.string().optional().describe('Optional net name to highlight.'),
                highlight_component: z.string().optional().describe('Optional component designator to highlight.'),
                highlight_net_colors: z.record(z.string(), z.string()).optional().describe('Optional net-to-color map, e.g. {"BAT+":"#ff0000","GND":"#00ff00"}. Native preview uses the keys with selection colors; the legacy fallback supports individual color values.'),
                highlight_component_colors: z.record(z.string(), z.string()).optional().describe('Optional designator-to-color map, e.g. {"U1":"#ff0000"}. Native preview uses the keys with selection colors; the legacy fallback supports individual color values.'),
                zoom: ZoomTargetSchema.default({ mode: 'full' }).describe('Zoom target: full board, a net, a component, or a bbox.'),
                padding_mm: z.number().min(0).max(100).default(2).describe('Padding around the rendered area in millimeters.'),
            }),
        },
        async (input) => {
            await mkdir(TEMP_DIR, { recursive: true });
            const fileName = join(TEMP_DIR, 'pcbprev-' + crypto.randomUUID().slice(0, 6));
            let nativeError: unknown;
            try {
                const preview = await bridge.requestEasyEda('preview-pcb', input, 10_000) as PreviewPcbReply;
                const pngPath = fileName + '.png';
                await sharp(Buffer.from(preview.base64, 'base64')).png().toFile(pngPath);
                return textResult({ image_path: pngPath, notes: preview.notes });
            } catch (error) {
                nativeError = error;
            }
            const data = await bridge.requestEasyEda('get-pcb-raw') as RawPcb;
            const { pngPath } = await savePcbPreview(data, {
                layers: input.layers,
                highlightNets: input.highlight_net ? [input.highlight_net] : [],
                highlightComponents: input.highlight_component ? [input.highlight_component] : [],
                highlightNetColors: input.highlight_net_colors || {},
                highlightComponentColors: input.highlight_component_colors || {},
                zoom: input.zoom,
                paddingMm: input.padding_mm,
                show: {},
                widthPx: 1024,
            }, fileName);
            return textResult({ image_path: pngPath, notes: [
                `Native PCB preview failed; used the legacy renderer. Reason: ${nativeError instanceof Error ? nativeError.message : String(nativeError)}`,
                'Legacy preview is reconstructed from PCB primitives; it does not verify the actual filled copper. Custom highlight colors are supported.',
            ] });
        },
    );

    server.registerTool(
        'inspect_net',
        {
            title: 'Inspect PCB Net',
            description: 'Inspect a net on the open PCB. Returns one net summary: net, document_uuid, found, units (mm), pads (net membership), layer, length (sum of line and arc lengths), vias (count), width (min/max, or null without tracks), segments (line and arc count), optional bbox of tracks/vias, polygons (source outlines), and drc (violation_count, truncated, violations). MULTI denotes through vias. Read connection failures in native drc.violations; no connections are inferred from geometry. Includes unrouted and via-only nets. Open the target PCB document first.',
            inputSchema: z.object({
                net: z.string().min(1).describe('Net name to inspect.'),
                drc_limit: z.number().int().min(1).max(200).default(24).describe('Maximum returned native DRC details for this net, after net filtering. violation_count uses the full matching result.'),
            }),
        },
        async ({ net, drc_limit }) => {
            const result = await bridge.requestEasyEda('inspect-net', { net, drc_limit }, 300000);
            return textResult(result);
        },
    );

    server.registerTool(
        'inspect_component',
        {
            title: 'Inspect PCB Component',
            description: 'Return a PCB component by designator with a list of nearest neighboring components within the given radius. Open the target PCB document first.',
            inputSchema: z.object({
                designator: z.string().min(1).describe('Component designator to inspect, e.g. R1.'),
                radius: z.number().min(0.1).max(100).default(10).describe('Search radius in millimeters for nearest components.'),
            }),
        },
        async ({ designator, radius }) => {
            const result = await bridge.requestEasyEda('inspect-component', { designator, radius }, 300000);
            return textResult(result);
        },
    );

    server.registerTool(
        'get_current_pcb',
        {
            title: 'Get EasyEDA PCB',
            description: 'Get the current EasyEDA PCB through the connected MCP interface. Open a PCB document first. wires contains copper statistics grouped by net; pads lists net membership. Use native DRC for connectivity and preview_pcb for filled copper.\n' +
                `Format: ${JSON.stringify(ExplainPcbSchema({ forLLM: true }).toJSONSchema())}`,
            inputSchema: z.object({}),
        },
        async () => {
            const result = await bridge.requestEasyEda('get-pcb') as ExplainPCB;

            if (result.components.length > 30 || (result.vias?.length ?? 0) > 50 || (result.polygons?.length ?? 0) > 20 || (result.wires?.length ?? 0) > 50) {
                await mkdir(TEMP_DIR, { recursive: true });

                const savePath = join(TEMP_DIR, `pcb-${crypto.randomUUID().slice(0, 6)}.json`);
                await writeFile(savePath, JSON.stringify(result, null, 2));
                return textResult({
                    "message": "Pcb too big, so it was saved to a file.\n" +
                        `components len: ${result.components.length}\n` +
                        `vias len: ${result.vias?.length}\n` +
                        `polygons len: ${result.polygons?.length}\n` +
                        `wires len: ${result.wires?.length}`,
                    "path": savePath
                });
            }


            return textResult(result);
        },
    );

}
