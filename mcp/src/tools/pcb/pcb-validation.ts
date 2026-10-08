import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { join } from 'node:path';
import * as z from 'zod/v4';
import { validatePcbLayoutIntent } from 'eda-copilot-backend/pcb';
import type { Bridge } from '../../bridge';
import { targetedToolHandler } from '../handler';
import { readPcbLayoutInput } from './pcb-layout-input';
import { textResult } from '../../utils/tool-result';
import { DOCS_DIR } from '../../utils/dirs';

export function registerPcbValidationTools(server: McpServer, bridge: Bridge) {
    server.registerTool(
        'validate_pcb_dsl',
        {
            title: 'Validate PCB DSL',
            description: `Validate a JavaScript PCB placement DSL file against the current linked schematic. Open the target PCB first, as for make_pcb_layout; the tool reads schematic connectivity, board outline and component positions from EasyEDA automatically. Return backend error/warning/info diagnostics with English messages and optional component/source context, without running AutoPlace or applying placement. For guidance, read ${join(DOCS_DIR, 'pcb-layout', 'intent-validation.md')}.`,
            annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
            inputSchema: z.object({
                file: z.string().min(1).describe('Path to a JavaScript PCB layout DSL code file, as for make_pcb_layout.'),
            }),
        },
        targetedToolHandler(bridge, async ({ file }: { file: string }) =>
            textResult(validatePcbLayoutIntent(await readPcbLayoutInput(bridge, file)))),
    );
}
