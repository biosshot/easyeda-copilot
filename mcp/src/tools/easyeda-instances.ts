import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import * as z from 'zod/v4';
import { Bridge } from "../bridge";
import { textResult } from "../utils/tool-result";

export function registerEasyEdaInstancesTools(server: McpServer, bridge: Bridge) {
    server.registerTool(
        'list_easyeda_instances',
        {
            title: 'List EasyEDA Instances',
            description: 'List currently connected EasyEDA Copilot extension instances. Use this when more than one EasyEDA window/project may be open.',
            inputSchema: z.object({}),
        },
        async () => {
            if (!bridge) throw new Error('EasyEDA bridge is not initialized yet.');
            const selected = await bridge.getSelectedEasyEdaInstance();
            return textResult({
                selected,
                instances: await bridge.listEasyEdaInstances(),
            });
        },
    );

    server.registerTool(
        'select_easyeda_instance',
        {
            title: 'Select EasyEDA Instance',
            description: 'Select which connected EasyEDA project this MCP process should use when multiple EasyEDA instances are connected.',
            inputSchema: z.object({
                instanceId: z.string().min(1).describe('instanceId returned by list_easyeda_instances.'),
            }),
        },
        async ({ instanceId }) => {
            if (!bridge) throw new Error('EasyEDA bridge is not initialized yet.');
            const selected = await bridge.selectEasyEdaInstance(instanceId);
            return textResult({
                selected,
            });
        },
    );
}