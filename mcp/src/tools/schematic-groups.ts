import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import * as z from 'zod/v4';
import type { Bridge } from '../bridge';
import type { SchematicGroups } from '@copilot/shared/types/schematic-groups';
import { textResult } from '../utils/tool-result';
import { toolHandler } from './handler';

export function registerSchematicGroupTools(server: McpServer, bridge: Bridge) {
    server.registerTool(
        'get_schematic_groups',
        {
            title: 'Get EasyEDA Schematic Groups',
            description: 'Read the current schematic page and return heuristic component groups plus direct non-ground wire islands. '
                + 'Set get_full_schematic_groups to concatenate page-local results from every schematic page. '
                + 'maybe_blocks and wires[].pins contain space-separated references; groups may omit singleton or ambiguous components. '
                + 'errors contains non-fatal diagnostics when the result is partial. Use get_schematic for values, pin names and the electrical netlist.',
            inputSchema: z.object({
                get_full_schematic_groups: z.boolean().default(false)
                    .describe('Read and concatenate schematic groups from every page in the current schematic.'),
            }),
            annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        },
        toolHandler(bridge, async ({ get_full_schematic_groups }) => {
            const result = await bridge.requestEasyEda('get-schematic-groups', { get_full_schematic_groups }) as SchematicGroups;
            return textResult(result);
        }),
    );
}
