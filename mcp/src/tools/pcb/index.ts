import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import * as z from 'zod/v4';
import { Bridge } from "../../bridge";
import { textResult } from "../../utils/tool-result";
import { SKILL_DOC_PATH } from "../../utils/dirs";
import { registerPcbLayoutTools } from "./pcb-layout";
import { registerPcbPreviewTools } from "./pcb-preview";
import { registerPcbRoutingTools } from "./pcb-routing";

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

    registerPcbLayoutTools(server, bridge);
    registerPcbPreviewTools(server, bridge);
    registerPcbRoutingTools(server, bridge);
}