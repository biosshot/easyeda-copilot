import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import * as z from 'zod/v4';
import { Bridge } from '../bridge';
import { textResult } from '../utils/tool-result';
import { toolHandler } from './handler';

export async function getAllProjects(bridge: Bridge) {
    return bridge.requestEasyEda('get-all-projects');
}

export function registerProjectTools(server: McpServer, bridge: Bridge) {
    server.registerTool(
        'get_all_projects',
        {
            title: 'Get All EasyEDA Projects',
            description: 'Read all directly accessible EasyEDA teams, folders, and projects as a nested project tree.',
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        },
        toolHandler(bridge, async () => textResult(await getAllProjects(bridge))),
    );
}
