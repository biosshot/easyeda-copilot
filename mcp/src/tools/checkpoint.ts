import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import * as z from 'zod/v4';
import { Bridge } from "../bridge";
import { textResult } from "../utils/tool-result";

export function registerCheckpointTools(server: McpServer, bridge: Bridge) {
    server.registerTool(
        'list_checkpoints',
        {
            title: 'List EasyEDA Checkpoints',
            description: 'List saved checkpoints with names, newest first. Defaults to 16; use limit to include older checkpoints.',
            inputSchema: z.object({
                limit: z.number().int().min(1).max(512).optional(),
            }),
        },
        async ({ limit }) => {
            const result = await bridge.requestEasyEda('checkpoint-list', { limit });
            return textResult(result);
        },
    );

    server.registerTool(
        'save_checkpoint_for_current_page',
        {
            title: 'Save EasyEDA Checkpoint',
            description: 'Save a checkpoint for the current EasyEDA document. Give it a short descriptive name for recovery; only describe checks as passed after verification. Restore by the returned ID, even when names match.',
            inputSchema: z.object({
                name: z.string().trim().max(200).optional(),
            }),
        },
        async ({ name }) => {
            const result = await bridge.requestEasyEda('checkpoint-save', { name });
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
