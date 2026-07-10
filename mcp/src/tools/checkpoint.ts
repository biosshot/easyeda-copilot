import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import * as z from 'zod/v4';
import { Bridge } from "../bridge";
import { textResult } from "../utils/tool-result";

export function registerCheckpointTools(server: McpServer, bridge: Bridge) {
    server.registerTool(
        'list_checkpoints',
        {
            title: 'List EasyEDA Checkpoints',
            description: 'List checkpoints saved by the EasyEDA Copilot extension.',
            inputSchema: z.object({}),
        },
        async () => {
            const result = await bridge.requestEasyEda('checkpoint-list');
            return textResult(result);
        },
    );

    server.registerTool(
        'save_checkpoint_for_current_page',
        {
            title: 'Save EasyEDA Checkpoint',
            description: 'Save a checkpoint for the current EasyEDA document.',
            inputSchema: z.object({}),
        },
        async () => {
            const result = await bridge.requestEasyEda('checkpoint-save');
            return textResult(result);
        },
    );

    server.registerTool(
        'restore_checkpoint_for_current_page',
        {
            title: 'Restore EasyEDA Checkpoint',
            description: 'Restore one checkpoint by id in EasyEDA.',
            inputSchema: z.object({
                id: z.string().optional(),
            }),
        },
        async ({ id }) => {
            const result = await bridge.requestEasyEda('checkpoint-restore', { checkpointId: id });
            return textResult(result);
        },
    );
}