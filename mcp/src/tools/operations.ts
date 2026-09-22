import { operationToolResult } from '../operations/tool-result';
import { TIMEOUT_POLICY } from '@copilot/shared/timeout-policy';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import * as z from 'zod/v4';
import { OPERATION_ID_PATTERN } from '../operations/id';
import { operationManager } from '../operations/manager';
import { textResult } from '../utils/tool-result';
import type { Bridge } from '../bridge';
import { toolHandler } from './handler';

const operationId = z.string().regex(
    OPERATION_ID_PATTERN,
    'Expected a prefixed operation ID returned by a long-running tool.',
);

export function registerOperationTools(server: McpServer, bridge: Bridge) {
    server.registerTool('list_operations', {
        title: 'List Operations',
        description: 'Discover active and recently completed operations in this MCP process, including IDs lost when an initial wait was cancelled. Returns compact status, stage and target metadata.',
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, toolHandler(bridge, async () => textResult({ operations: operationManager.list() })));
    server.registerTool(
        'wait_operation',
        {
            title: 'Wait Operation',
            description: 'Wait for a running mutation, PCB layout or PCB router DSL operation. Running router responses include up to 10 recent log lines and their update time when available.',
            annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
            inputSchema: z.object({
                operation_id: operationId,
                wait_ms: z.number().int().min(1_000).max(TIMEOUT_POLICY.operationWaitMaxMs).default(TIMEOUT_POLICY.operationWaitMs)
                    .describe('Wait below the common 60-second MCP request timeout.'),
            }),
        },
        toolHandler(bridge, async ({ operation_id, wait_ms }) => operationToolResult(
            await operationManager.wait(operation_id, wait_ms),
        )),
    );

    server.registerTool(
        'cancel_operation',
        {
            title: 'Cancel Operation',
            description: 'Request cooperative cancellation of a running operation. Cancellation is not rollback.',
            annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
            inputSchema: z.object({ operation_id: operationId }),
        },
        toolHandler(bridge, async ({ operation_id }) => textResult(await operationManager.cancel(operation_id))),
    );

    server.registerTool(
        'apply_operation',
        {
            title: 'Apply Operation',
            description: 'Retry applying a prepared in-memory operation result without running the operation again.',
            annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
            inputSchema: z.object({ operation_id: operationId }),
        },
        toolHandler(bridge, async ({ operation_id }) => textResult(await operationManager.apply(operation_id, TIMEOUT_POLICY.mutationWaitMs))),
    );
}
