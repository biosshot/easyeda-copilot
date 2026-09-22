import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import * as z from 'zod/v4';
import { Bridge } from '../bridge';
import { textResult } from '../utils/tool-result';

export function registerDesignatorTools(server: McpServer, bridge: Bridge) {
    server.registerTool(
        'annotate_designators',
        {
            title: 'Annotate Schematic Designators',
            description: 'Annotate component designators across every page of the current EasyEDA schematic. Prefixes are preserved exactly; only trailing numbers are assigned. Multi-part component sections are renamed together.',
            inputSchema: z.object({
                mode: z.enum(['preserve', 'resequence']).default('preserve').describe(
                    'preserve changes only duplicate or unnumbered designators; resequence recalculates every trailing number in page and position order.',
                ),
            }),
        },
        async ({ mode }) => textResult(await bridge.requestEasyEda(
            'annotate-designators',
            { mode },
        )),
    );
}
