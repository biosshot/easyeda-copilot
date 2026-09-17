import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import * as z from 'zod/v4';
import type { Bridge } from '../bridge';
import type { SchematicGroups } from '@copilot/shared/types/schematic-groups';
import { textResult } from '../utils/tool-result';

export function registerSchematicGroupTools(server: McpServer, bridge: Bridge) {
    server.registerTool(
        'get_current_page_schematic_groups',
        {
            title: 'Get EasyEDA Schematic Groups',
            description: 'Read the whole current schematic page. Returns {maybe_blocks: string[], wires: {net: string|null, pins: string}[]}. '
                + 'Block strings contain space-separated designators and are suggestions, not proven functional blocks; singleton/ambiguous components may be omitted. '
                + 'Each wires entry contains space-separated references such as U6.5 C8.1 on one continuous drawn wire island. '
                + 'Equal net names do not join separate islands. Ports/power flags are not components. Use with get_current_page_schematic for values and pin names.',
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        },
        async () => {
            const result = await bridge.requestEasyEda('get-schematic-groups', {}, 120_000) as SchematicGroups;
            // Keep the agreed compact response inline, without pretty-printing or a duplicate payload.
            return textResult(JSON.stringify(result));
        },
    );
}
