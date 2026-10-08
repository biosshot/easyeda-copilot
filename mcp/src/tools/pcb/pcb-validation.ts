import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { join } from 'node:path';
import * as z from 'zod/v4';
import { validatePcbLayoutIntent, type PcbSchematicGroups } from 'eda-copilot-backend/pcb';
import type { Bridge } from '../../bridge';
import { targetedToolHandler } from '../handler';
import { readPcbLayoutInput } from './pcb-layout-input';
import { textResult } from '../../utils/tool-result';
import { DOCS_DIR } from '../../utils/dirs';
import type { SchematicGroups } from '@copilot/shared/types/schematic-groups';
import { currentSignal } from '../../operations/cancellation';
import { toPcbSchematicGroups } from './pcb-schematic-groups';

export function registerPcbValidationTools(server: McpServer, bridge: Bridge) {
    server.registerTool(
        'validate_pcb_dsl',
        {
            title: 'Validate PCB DSL',
            description: `Validate a JavaScript PCB placement DSL file against the current linked schematic. Open the target PCB first, as for make_pcb_layout; the tool reads schematic connectivity, suggested schematic groups, board outline and component positions from EasyEDA automatically. Return backend error/warning/info diagnostics with English messages and optional component/source context; grouping differences are info only. No AutoPlace or placement is applied. For guidance, read ${join(DOCS_DIR, 'pcb-layout', 'intent-validation.md')}.`,
            annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
            inputSchema: z.object({
                file: z.string().min(1).describe('Path to a JavaScript PCB layout DSL code file, as for make_pcb_layout.'),
            }),
        },
        targetedToolHandler(bridge, async ({ file }: { file: string }) => {
            const input = await readPcbLayoutInput(bridge, file);
            // Groups are editor context, not an LLM argument. A partial read remains advisory.
            let groups: PcbSchematicGroups;
            try {
                const source = await bridge.requestEasyEda('get-schematic-groups', { get_full_schematic_groups: true }) as SchematicGroups;
                groups = toPcbSchematicGroups(source, input.circuit);
            } catch {
                currentSignal()?.throwIfAborted();
                groups = { groups: [], incomplete: true };
            }
            return textResult(validatePcbLayoutIntent(input, groups));
        }),
    );
}
