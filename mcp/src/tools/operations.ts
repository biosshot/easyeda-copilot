import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import * as z from 'zod/v4';
import { OPERATION_ID_PATTERN } from '../operations/id';
import { operationManager } from '../operations/manager';
import { textResult } from '../utils/tool-result';

const operationId = z.string().regex(
    OPERATION_ID_PATTERN,
    'Expected a prefixed operation ID returned by a long-running tool.',
);

export function registerOperationTools(server: McpServer) {
    server.registerTool(
        'wait_operation',
        {
            title: 'Wait Operation',
            description: 'Wait for any running PCB layout or PCB router DSL operation. Running router responses include up to 10 recent log lines and their update time when available.',
            inputSchema: z.object({
                operation_id: operationId,
                wait_ms: z.number().int().min(1_000).max(55_000).default(30_000)
                    .describe('Wait below the common 60-second MCP request timeout.'),
            }),
        },
        async ({ operation_id, wait_ms }) => textResult(
            await operationManager.wait(operation_id, wait_ms),
        ),
    );

    server.registerTool(
        'cancel_operation',
        {
            title: 'Cancel Operation',
            description: 'Cancel any running PCB layout or PCB router DSL operation.',
            inputSchema: z.object({ operation_id: operationId }),
        },
        async ({ operation_id }) => textResult(await operationManager.cancel(operation_id)),
    );

    server.registerTool(
        'apply_operation',
        {
            title: 'Apply Operation',
            description: 'Retry applying a prepared in-memory operation result without running the operation again.',
            inputSchema: z.object({ operation_id: operationId }),
        },
        async ({ operation_id }) => textResult(await operationManager.apply(operation_id)),
    );
}
