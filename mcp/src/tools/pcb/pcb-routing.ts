import { TIMEOUT_POLICY } from '@copilot/shared/timeout-policy';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import * as z from 'zod/v4';
import type { Bridge } from '../../bridge';
import { runPcbRouterDsl } from '../../routing/routing-operation';
import { ROUTER_DSL_DOC_PATH, SKILL_DOC_PATH } from '../../utils/dirs';
import { textResult } from '../../utils/tool-result';
import { targetedToolHandler } from '../handler';

const DEFAULT_ROUTING_WAIT_MS = TIMEOUT_POLICY.mutationWaitMs;

export function registerPcbRoutingTools(server: McpServer, bridge: Bridge) {
    server.registerTool(
        'run_pcb_router_dsl',
        {
            title: 'Run PCB Router DSL',
            description: `Apply DRC, copper-only, or routing intent from an eda-copilot-router DSL file to the currently opened EasyEDA PCB. Long work returns an operation_id for wait_operation. PCB instructions: ${SKILL_DOC_PATH}. Authoritative router DSL declarations: ${ROUTER_DSL_DOC_PATH}`,
            annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
            inputSchema: z.object({
                file: z.string().min(1).describe('Path to a JavaScript PCB routing DSL file.'),
                wait_ms: z.number().int().min(1_000).max(TIMEOUT_POLICY.operationWaitMaxMs).default(DEFAULT_ROUTING_WAIT_MS)
                    .describe('Initial synchronous wait before returning a pcb-dsl operation_id.'),
            }),
        },
        targetedToolHandler(bridge, async ({ file, wait_ms }) => textResult(await runPcbRouterDsl(
            bridge,
            file,
            wait_ms ?? DEFAULT_ROUTING_WAIT_MS,
        ))),
    );
}
