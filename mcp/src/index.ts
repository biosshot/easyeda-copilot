#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import * as z from 'zod/v4';
import { CircuitModStruct, type ExplainCircuit } from '@copilot/shared/types/circuit';

const COPILOT_SERVER_URL = (process.env.EASYEDA_COPILOT_SERVER_URL || 'https://circuit.tech.ru.net').replace(/\/$/, '');
const MCP_WS_PORT = Number(process.env.EASYEDA_COPILOT_MCP_WS_PORT || 8787);
const MCP_WS_HOST = process.env.EASYEDA_COPILOT_MCP_WS_HOST || '127.0.0.1';

const server = new McpServer({
    name: 'easyeda-copilot',
    version: '1.0.0',
});

type WsMessage = {
    event: string;
    body: string;
};

type PendingRequest = {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timer: ReturnType<typeof setTimeout>;
};

const wsClients = new Set<WebSocket>();
const pendingRequests = new Map<string, PendingRequest>();

function handleWsMessage(message: WsMessage) {
    const parsedBody = message.body ? JSON.parse(message.body) : {};
    const id = parsedBody?.id;
    if (!id || typeof id !== 'string') return;

    const pending = pendingRequests.get(id);
    if (!pending) return;

    clearTimeout(pending.timer);
    pendingRequests.delete(id);

    if (parsedBody.ok === false) {
        pending.reject(new Error(parsedBody.error || `EasyEDA event failed: ${message.event}`));
        return;
    }

    pending.resolve(parsedBody.result);
}

function sendWs(socket: WebSocket, message: WsMessage) {
    socket.send(JSON.stringify(message));
}

async function requestEasyEda(event: string, body: Record<string, unknown> = {}, timeoutMs = 120000) {
    const client = [...wsClients].at(-1);
    if (!client) {
        throw new Error(`EasyEDA MCP interface is not connected.
1. Open EasyEda Pro
2. Open any schematic
3. Copilot -> MCP
4. Ensure the connection is successful`);
    }

    const id = randomUUID();
    const response = new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
            pendingRequests.delete(id);
            reject(new Error(`Timeout waiting EasyEDA event: ${event}`));
        }, timeoutMs);

        pendingRequests.set(id, { resolve, reject, timer });
    });

    sendWs(client, {
        event,
        body: JSON.stringify({ ...body, id }),
    });

    return response;
}

function startWsServer() {
    const wsServer = new WebSocketServer({
        host: MCP_WS_HOST,
        port: MCP_WS_PORT,
    });

    wsServer.on('connection', socket => {
        wsClients.add(socket);
        sendWs(socket, {
            event: 'connected',
            body: JSON.stringify({ ok: true }),
        });

        socket.on('message', data => {
            const raw = typeof data === 'string' ? data : data.toString();
            handleWsMessage(JSON.parse(raw) as WsMessage);
        });

        socket.on('close', () => wsClients.delete(socket));
        socket.on('error', () => wsClients.delete(socket));
    });

    wsServer.on('listening', () => {
        // console.error(`EasyEDA Copilot MCP WebSocket listening on ws://${MCP_WS_HOST}:${MCP_WS_PORT}`);
    });
}

async function postJson(path: string, payload: unknown): Promise<unknown> {
    const response = await fetch(`${COPILOT_SERVER_URL}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic Y2lyY3VpdDp4eU9BTE5INHBmb05HNjB2VmtBNTg0MTg='
        },
        body: JSON.stringify(payload),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
        const message = typeof data === 'object' && data && 'error' in data
            ? String(data.error)
            : `HTTP ${response.status}`;
        throw new Error(message);
    }

    return data;
}

async function getText(path: string): Promise<string> {
    const response = await fetch(`${COPILOT_SERVER_URL}${path}`, {
        headers: {
            'Authorization': 'Basic Y2lyY3VpdDp4eU9BTE5INHBmb05HNjB2VmtBNTg0MTg='
        }
    });
    const text = await response.text();

    if (!response.ok) {
        throw new Error(text || `HTTP ${response.status}`);
    }

    return text;
}

function textResult(value: unknown) {
    return {
        content: [{
            type: 'text' as const,
            text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
        }],
    };
}

server.registerResource(
    'skill_agent_prompt',
    `${COPILOT_SERVER_URL}/v1/mcp-tools/prompts/skill-agent`,
    {
        title: 'Skill Agent Prompt',
        description: 'System prompt used by the EasyEDA Copilot skill agent.',
        mimeType: 'text/plain',
    },
    async (uri) => ({
        contents: [{
            uri: uri.toString(),
            mimeType: 'text/plain',
            text: await getText('/v1/mcp-tools/prompts/skill-agent'),
        }],
    }),
);

server.registerResource(
    'circuit_maker_prompt',
    `${COPILOT_SERVER_URL}/v1/mcp-tools/prompts/circuit-maker`,
    {
        title: 'Circuit Maker Prompt',
        description: 'Circuit maker skill instructions and output expectations.',
        mimeType: 'text/plain',
    },
    async (uri) => ({
        contents: [{
            uri: uri.toString(),
            mimeType: 'text/plain',
            text: await getText('/v1/mcp-tools/prompts/circuit-maker'),
        }],
    }),
);

server.registerPrompt(
    'skill_agent_prompt',
    {
        title: 'Skill Agent Prompt',
        description: 'Load the EasyEDA Copilot skill-agent system prompt.',
    },
    async () => ({
        description: 'System prompt used by the EasyEDA Copilot skill agent.',
        messages: [{
            role: 'user',
            content: {
                type: 'text',
                text: await getText('/v1/mcp-tools/prompts/skill-agent'),
            },
        }],
    }),
);

server.registerPrompt(
    'circuit_maker_prompt',
    {
        title: 'Circuit Maker Prompt',
        description: 'Load the EasyEDA Copilot circuit-maker instructions and output expectations.',
    },
    async () => ({
        description: 'Circuit maker skill instructions and output expectations.',
        messages: [{
            role: 'user',
            content: {
                type: 'text',
                text: await getText('/v1/mcp-tools/prompts/circuit-maker'),
            },
        }],
    }),
);

server.registerPrompt(
    'easyeda_circuit_agent_prompt',
    {
        title: 'EasyEDA Circuit Agent Prompt',
        description: 'Load both EasyEDA Copilot skill-agent and circuit-maker prompts.',
    },
    async () => ({
        description: 'Combined EasyEDA Copilot agent prompt for circuit creation workflows.',
        messages: [{
            role: 'user',
            content: {
                type: 'text',
                text: [
                    '# Skill Agent Prompt',
                    await getText('/v1/mcp-tools/prompts/skill-agent'),
                    '',
                    '# Circuit Maker Prompt',
                    await getText('/v1/mcp-tools/prompts/circuit-maker'),
                ].join('\n'),
            },
        }],
    }),
);

server.registerTool(
    'read_prompt',
    {
        title: 'Read EasyEDA Copilot Prompt',
        description: 'Read EasyEDA Copilot prompts explicitly when the MCP client does not inject prompt/resource contents automatically.',
        inputSchema: z.object({
            name: z.enum(['skill_agent', 'circuit_maker', 'combined']).describe('Prompt to read.'),
        }),
    },
    async ({ name }) => {
        if (name === 'skill_agent') {
            return textResult(await getText('/v1/mcp-tools/prompts/skill-agent'));
        }

        if (name === 'circuit_maker') {
            return textResult(await getText('/v1/mcp-tools/prompts/circuit-maker'));
        }

        return textResult([
            '# Skill Agent Prompt',
            await getText('/v1/mcp-tools/prompts/skill-agent'),
            '',
            '# Circuit Maker Prompt',
            await getText('/v1/mcp-tools/prompts/circuit-maker'),
        ].join('\n'));
    },
);

server.registerTool(
    'component_search',
    {
        title: 'Search EasyEDA Component',
        description: 'Search a component on the main EasyEDA Copilot server by exact part_uuid or MPN only.',
        inputSchema: z.object({
            part_uuid: z.string().nullable().optional(),
            MPN: z.string().nullable().optional(),
        }),
    },
    async ({ part_uuid, MPN }) => {
        if (!part_uuid && !MPN) {
            return textResult('Fill one: part_uuid or MPN');
        }

        const result = await postJson('/v1/mcp-tools/component-search', { part_uuid, MPN });
        return textResult(result);
    },
);

server.registerTool(
    'search_reused_block',
    {
        title: 'Search Reused Block',
        description: 'Search pre-assembled EasyEDA Copilot reused blocks that can be recalculated and inserted into a circuit.',
        inputSchema: z.object({
            query: z.string().describe('Query example: "3.3V power regulator"'),
            page: z.number().min(1).default(1).describe('Current results page.'),
            limit: z.number().min(1).max(25).default(10).describe('Number of results per page.'),
        }),
    },
    async ({ query, page, limit }) => {
        const result = await postJson('/v1/mcp-tools/search-reused-block', { query, page, limit });
        return textResult(result);
    },
);

server.registerTool(
    'extract_circuit_on_current_page',
    {
        title: 'Extract Circuit',
        description: 'Post-process circuit changes on the main EasyEDA Copilot server and sends the assembled result to EasyEDA. Every added component must include part_uuid.',
        inputSchema: CircuitModStruct(),
    },
    async (circuit) => {
        const missingPartUuid = circuit.add_components
            .filter(component => !component.part_uuid || /^0+$/.test(component.part_uuid))
            .map(component => component.designator);

        if (missingPartUuid.length) {
            return textResult({
                error: 'All add_components must have part_uuid.',
                designators: missingPartUuid,
            });
        }

        const resolvedInputCircuit = await requestEasyEda('get-schematic');
        const result = await postJson('/v1/mcp-tools/extract-circuit', { circuit, inputCircuit: resolvedInputCircuit });
        await requestEasyEda('assemble-circuit', result as Record<string, unknown>, 300000);
        return textResult('Circuit sent to EasyEDA for assembly.');
    },
);

server.registerTool(
    'get_current_page_schematic',
    {
        title: 'Get EasyEDA Schematic',
        description: 'Get the current EasyEDA schematic through the connected MCP interface.',
        inputSchema: z.object({}),
    },
    async () => {
        const result = await requestEasyEda('get-schematic') as ExplainCircuit;
        return textResult({ ...result, components: result.components.map(c => ({ ...c, pos: undefined, })) });
    },
);

server.registerTool(
    'get_current_project_info',
    {
        title: 'Get Current EasyEDA Project Info',
        description: 'Read the current EasyEDA project tree and document metadata through the connected extension.',
        inputSchema: z.object({}),
    },
    async () => {
        const result = await requestEasyEda('get-current-project-info');
        return textResult(result);
    },
);

server.registerTool(
    'open_document',
    {
        title: 'Open EasyEDA Project Document',
        description: 'Open a schematic, schematic page, PCB, or panel document from the current EasyEDA project by document UUID.',
        inputSchema: z.object({
            document_uuid: z.string().min(1).describe('Document UUID from get_current_project_info.'),
        }),
    },
    async ({ document_uuid }) => {
        const result = await requestEasyEda('open-document', {
            documentUuid: document_uuid,
        });
        return textResult(result);
    },
);

server.registerTool(
    'create_schematic',
    {
        title: 'Create EasyEDA Schematic',
        description: 'Create a schematic in the current EasyEDA project. If board_name is omitted, EasyEDA creates a free schematic. Return schematic first page uuid',
        inputSchema: z.object({
            parent_board_name: z.string().min(1).optional().describe('Optional parent board name.'),
        }),
    },
    async ({ parent_board_name }) => {
        const result = await requestEasyEda('create-schematic', {
            boardName: parent_board_name,
        });
        return textResult(result);
    },
);

server.registerTool(
    'create_schematic_page',
    {
        title: 'Create EasyEDA Schematic Page',
        description: 'Create a schematic page under an existing EasyEDA schematic.',
        inputSchema: z.object({
            schematic_uuid: z.string().min(1).describe('Parent schematic UUID.'),
        }),
    },
    async ({ schematic_uuid }) => {
        const result = await requestEasyEda('create-schematic-page', {
            schematicUuid: schematic_uuid,
        });
        return textResult(result);
    },
);

server.registerTool(
    'modify_schematic_name',
    {
        title: 'Rename EasyEDA Schematic',
        description: 'Modify an EasyEDA schematic name.',
        inputSchema: z.object({
            schematic_uuid: z.string().min(1).describe('Schematic UUID.'),
            schematic_name: z.string().min(1).describe('New schematic name.'),
        }),
    },
    async ({ schematic_uuid, schematic_name }) => {
        const result = await requestEasyEda('modify-schematic-name', {
            schematicUuid: schematic_uuid,
            schematicName: schematic_name,
        });
        return textResult(result);
    },
);

server.registerTool(
    'modify_schematic_page_name',
    {
        title: 'Rename EasyEDA Schematic Page',
        description: 'Modify an EasyEDA schematic page name.',
        inputSchema: z.object({
            schematic_page_uuid: z.string().min(1).describe('Schematic page UUID.'),
            schematic_page_name: z.string().min(1).describe('New schematic page name.'),
        }),
    },
    async ({ schematic_page_uuid, schematic_page_name }) => {
        const result = await requestEasyEda('modify-schematic-page-name', {
            schematicPageUuid: schematic_page_uuid,
            schematicPageName: schematic_page_name,
        });
        return textResult(result);
    },
);

server.registerTool(
    'list_checkpoints',
    {
        title: 'List EasyEDA Checkpoints',
        description: 'List checkpoints saved by the EasyEDA Copilot extension.',
        inputSchema: z.object({}),
    },
    async () => {
        const result = await requestEasyEda('checkpoint-list');
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
        const result = await requestEasyEda('checkpoint-save');
        return textResult(result);
    },
);

server.registerTool(
    'read_checkpoint',
    {
        title: 'Read EasyEDA Checkpoint',
        description: 'Read one checkpoint by id.',
        inputSchema: z.object({
            id: z.string(),
        }),
    },
    async ({ id }) => {
        const result = await requestEasyEda('checkpoint-read', { checkpointId: id });
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
        const result = await requestEasyEda('checkpoint-restore', { checkpointId: id });
        return textResult(result);
    },
);

async function main() {
    startWsServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // console.error(`EasyEDA Copilot MCP Server running on stdio. Server URL: ${COPILOT_SERVER_URL}`);
}

main().catch(() => {
    // console.error('Fatal error in main():', error);
    process.exit(1);
});
