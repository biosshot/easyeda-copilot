import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import * as z from 'zod/v4';
import { Bridge } from "../../bridge";
import { textResult } from "../../utils/tool-result";
import { SKILL_DOC_PATH } from "../../utils/dirs";
import { registerPcbLayoutTools } from "./pcb-layout";
import { registerPcbPreviewTools } from "./pcb-preview";
import { registerPcbRoutingTools } from "./pcb-routing";
import { registerPcbSilkscreenTools } from "./pcb-silkscreen";

export function registerPcbTools(server: McpServer, bridge: Bridge) {
    server.registerTool(
        'get_pcb_stack_layers',
        {
            title: 'Get PCB Stack Layers',
            description: 'Return the current PCB copper layer count and active signal routing layers. Open the target PCB document first. Use before choosing route_layers for run_auto_route_on_current_pcbdoc.',
            inputSchema: z.object({}),
        },
        async () => {
            const result = await bridge.requestEasyEda('get-pcb-stack-layers');
            return textResult(result);
        },
    );

    server.registerTool(
        'set_pcb_copper_layer_count',
        {
            title: 'Set PCB Copper Layer Count',
            description: 'Set the number of copper layers in the currently opened PCB document. This changes the PCB stack; use get_pcb_stack_layers afterwards to verify available routing layers.',
            inputSchema: z.object({
                count: z.union([
                    z.literal(2),
                    z.literal(4),
                    z.literal(6),
                    z.literal(8),
                    z.literal(10),
                    z.literal(12),
                    z.literal(14),
                    z.literal(16),
                    z.literal(18),
                    z.literal(20),
                    z.literal(22),
                    z.literal(24),
                    z.literal(26),
                    z.literal(28),
                    z.literal(30),
                    z.literal(32),
                ]).describe('Allowed copper layer count. EasyEDA supports even counts from 2 to 32.'),
            }),
        },
        async ({ count }) => {
            const result = await bridge.requestEasyEda('set-pcb-copper-layer-count', { count }, 300000);
            return textResult(result);
        },
    );

    server.registerTool(
        'import_pcb_changes',
        {
            title: 'Import PCB Changes',
            description: `Import schematic changes into the currently opened PCB document. If schematic_uuid is omitted, EasyEDA uses the schematic linked to the same board. Open the target PCB document first. For PCB docs, read the local docs folder: ${SKILL_DOC_PATH}`,
            inputSchema: z.object({
                schematic_uuid: z.string().min(1).optional().describe('Optional schematic UUID to import changes from.'),
            }),
        },
        async ({ schematic_uuid }) => {
            const result = await bridge.requestEasyEda('import-pcb-changes', {
                schematicUuid: schematic_uuid,
            }, 300000);
            return textResult(result);
        },
    );

    server.registerTool(
        'find_pcb_free_space',
        {
            title: 'Find PCB Free Space',
            description: 'Find an empty rectangle of a given size on the currently opened PCB, in mm. ' +
                'Use it before add_pcb_silkscreen_text or add_pcb_silkscreen_image instead of eyeballing coordinates: ' +
                'occupancy is taken from the editor\'s own bounding boxes, so mounting tabs and other overhangs count, ' +
                'not just the component body. Through-hole parts block both sides. ' +
                'Returns the centre of the free area closest to the anchor.',
            inputSchema: z.object({
                width: z.number().min(0.1).describe('Required width in mm.'),
                height: z.number().min(0.1).describe('Required height in mm.'),
                layer: z.enum(['top', 'bottom']).default('top').describe('Which side to search.'),
                near_designator: z.string().optional().describe('Prefer a spot close to this component.'),
                near_x: z.number().optional().describe('Prefer a spot close to this point (with near_y).'),
                near_y: z.number().optional().describe('Prefer a spot close to this point (with near_x).'),
                clearance: z.number().min(0).max(10).default(0.3).describe('Gap to the nearest obstacle in mm.'),
                edge_margin: z.number().min(0).max(20).default(0.5).describe('Keep-out from the board edge in mm.'),
            }),
        },
        async (args) => {
            const result = await bridge.requestEasyEda('find-pcb-free-space', args, 120000);
            return textResult(result);
        },
    );

    server.registerTool(
        'add_pcb_keepout_region',
        {
            title: 'Add PCB Keepout Region',
            description: 'Create a rectangular keepout on the currently opened PCB that copper actually respects, in mm. ' +
                'The placement DSL\'s constraintRegion only keeps other components out; it does not stop the GND pour, ' +
                'so a module antenna still ends up sitting over copper. Use this for antenna clearance zones, ' +
                'mounting-hole exclusions and anywhere a pour must not reach. ' +
                'Re-pour with pour_ground_and_suture_vias afterwards so the existing copper is rebuilt around it.',
            inputSchema: z.object({
                x: z.number().describe('X of the rectangle centre in mm.'),
                y: z.number().describe('Y of the rectangle centre in mm.'),
                width: z.number().min(0.1).describe('Width in mm.'),
                height: z.number().min(0.1).describe('Height in mm.'),
                layers: z.array(z.enum(['top', 'bottom', 'multi'])).optional()
                    .describe('Layers to apply to. Defaults to both copper layers.'),
                rules: z.array(z.enum(['no_pours', 'no_vias', 'no_wires', 'no_fills', 'no_components', 'no_inner_layers'])).optional()
                    .describe('What the region forbids. Defaults to no_pours plus no_vias.'),
                name: z.string().optional().describe('Region name shown in EasyEDA.'),
            }),
        },
        async (args) => {
            const result = await bridge.requestEasyEda('add-pcb-keepout-region', args, 120000);
            return textResult(result);
        },
    );

    server.registerTool(
        'delete_pcb_keepout_regions',
        {
            title: 'Delete PCB Keepout Regions',
            description: 'Remove keepout regions from the currently opened PCB by primitive id.',
            inputSchema: z.object({
                primitive_ids: z.array(z.string()).min(1).describe('Primitive ids returned by add_pcb_keepout_region.'),
            }),
        },
        async (args) => {
            const result = await bridge.requestEasyEda('delete-pcb-keepout-regions', args);
            return textResult(result);
        },
    );

    server.registerTool(
        'pour_ground_and_suture_vias',
        {
            title: 'Pour Ground And Suture Vias',
            description: 'Re-pour the GND copper on every layer of the currently opened PCB and re-place the stitching vias, without touching the routed tracks. ' +
                'Previously this only happened as a side effect of run_auto_route_on_current_pcbdoc, so changing the stitching grid meant clearing and routing the whole board again. ' +
                'The old pours and stitching vias are removed first, so repeated calls do not stack. ' +
                'Vias that would violate clearance are dropped automatically. Run check_pcb_drc afterwards.',
            inputSchema: z.object({
                pour_ground: z.boolean().default(true).describe('Re-pour the GND polygons.'),
                suture_ground: z.boolean().default(true).describe('Re-place the GND stitching vias.'),
                grid_mm: z.number().min(0.5).max(20).optional()
                    .describe('Stitching grid in mm. Default 4. Smaller means many more vias: 2.5mm on a 900mm2 board gave 114.'),
                diameter_mm: z.number().min(0.1).max(3).optional().describe('Via diameter in mm. Default 0.61.'),
                drill_mm: z.number().min(0.1).max(3).optional().describe('Via drill in mm. Default 0.305.'),
                edge_margin_mm: z.number().min(0).max(20).optional().describe('Keep-out from the board edge in mm. Default 1.'),
                max_count: z.number().min(0).max(5000).optional().describe('Upper bound on stitching vias. Default 500.'),
            }),
        },
        async ({ pour_ground, suture_ground, grid_mm, diameter_mm, drill_mm, edge_margin_mm, max_count }) => {
            const result = await bridge.requestEasyEda('pour-ground-and-suture', {
                pourGround: pour_ground,
                sutureGround: suture_ground,
                suture: {
                    gridMm: grid_mm,
                    diameterMm: diameter_mm,
                    drillMm: drill_mm,
                    edgeMarginMm: edge_margin_mm,
                    maxCount: max_count,
                },
            }, 600000);
            return textResult(result);
        },
    );

    registerPcbLayoutTools(server, bridge);
    registerPcbPreviewTools(server, bridge);
    registerPcbRoutingTools(server, bridge);
    registerPcbSilkscreenTools(server, bridge);
}