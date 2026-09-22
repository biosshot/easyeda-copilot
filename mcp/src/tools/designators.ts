import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import * as z from 'zod/v4';
import { Bridge } from '../bridge';
import { textResult } from '../utils/tool-result';
import { managedMutationHandler } from './handler';

export function registerDesignatorTools(server: McpServer, bridge: Bridge) {
    server.registerTool(
        'annotate_designators',
        {
            title: 'Annotate Schematic Designators',
            description: 'Annotate component designators across every page of the current EasyEDA schematic. Prefixes are preserved exactly; only trailing numbers are assigned. Multi-part component sections are renamed together. Runs as a managed operation, waits up to 50 seconds, and always returns operation_id.',
            annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
            inputSchema: z.object({
                mode: z.enum(['preserve', 'resequence']).default('preserve').describe(
                    'preserve changes only duplicate or unnumbered designators; resequence recalculates every trailing number in page and position order.',
                ),
            }),
        },
        managedMutationHandler(bridge, 'annotate_designators', async ({ mode }) => textResult(await bridge.requestEasyEda(
            'annotate-designators',
            { mode },
        ))),
    );
}
