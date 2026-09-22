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
            description: 'Return the current PCB copper layer count and active signal routing layers. Open the target PCB document first and inspect this before writing router DSL layer constraints.',
            inputSchema: z.object({}),
        },
        async () => {
            const result = await bridge.requestEasyEda('get-pcb-stack-layers');
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
            });
            return textResult(result);
        },
    );

    registerPcbLayoutTools(server, bridge);
    registerPcbPreviewTools(server, bridge);
    registerPcbRoutingTools(server, bridge);
}
