#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import * as z from 'zod/v4';
import { CircuitModStruct, type ExplainCircuit } from '@copilot/shared/types/circuit';
import type { BoardAssemble } from '@copilot/shared/types/pcb/board-assemble';

const apiUrl = true ? 'http://localhost:5120' : 'https://circuit.tech.ru.net';
const COPILOT_SERVER_URL = (process.env.EASYEDA_COPILOT_SERVER_URL || apiUrl).replace(/\/$/, '');
const MCP_WS_PORT = Number(process.env.EASYEDA_COPILOT_MCP_WS_PORT || 8787);
const MCP_WS_HOST = process.env.EASYEDA_COPILOT_MCP_WS_HOST || '127.0.0.1';

const server = new McpServer({
    name: 'easyeda-copilot',
    version: '1.0.0',
});

const PCB_LAYOUT_MCP_GUIDANCE = [
    '<MCP_PCB_ASSEMBLY_WORKFLOW>',
    'make_pcb_layout is iterative. Use it repeatedly to inspect placement/routing reports and previewImagePath. Do not assemble the PCB during intermediate attempts.',
    'Final PCB assembly is allowed only after verifying the EasyEDA project structure:',
    '1. Call get_current_project_info.',
    '2. Confirm the schematic used for PCB layout belongs to a BOARD item and that the same BOARD item has a PCB document.',
    '3. Before assembly, call open_document with that BOARD item PCB uuid. The PCB document must be opened first.',
    '4. Only after open_document succeeds, call assemble_pcb_layout_on_current_pcbdoc with the final layoutId.',
    'Do not call assemble_pcb_layout_on_current_pcbdoc for a standalone schematic, an unrelated PCB document, or an ambiguous project structure. Ask the user to select/create the correct board/PCB document instead.',
    '</MCP_PCB_ASSEMBLY_WORKFLOW>',
].join('\n');

type WsMessage = {
    event: string;
    body: string;
};

type PendingRequest = {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timer: ReturnType<typeof setTimeout>;
};

type MakePcbLayoutResponse = {
    content?: string;
    toolReport?: unknown;
    pcb?: BoardAssemble;
    preview_image_url?: string;
    error?: string;
};

type PcbComponentSizesResponse = {
    content?: string;
    report?: unknown;
    error?: string;
};

type StoredPcbLayout = {
    pcb: BoardAssemble;
    content?: string;
    toolReport?: unknown;
    previewImagePath?: string;
    createdAt: number;
};

const wsClients = new Set<WebSocket>();
const pendingRequests = new Map<string, PendingRequest>();
const storedPcbLayouts = new Map<string, StoredPcbLayout>();
let wsServerReady = false;

function handleWsMessage(message: WsMessage) {
    if (message.event === 'ping') {
        return;
    }

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
    if (!wsServerReady) {
        throw new Error(`EasyEDA MCP WebSocket server is not available on ${MCP_WS_HOST}:${MCP_WS_PORT}.
Another easyeda-copilot-mcp process may already be using this port.`);
    }

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
            const message = JSON.parse(raw) as WsMessage;

            if (message.event === 'ping') {
                sendWs(socket, {
                    event: 'pong',
                    body: message.body || JSON.stringify({ ok: true }),
                });
                return;
            }

            handleWsMessage(message);
        });

        socket.on('close', () => wsClients.delete(socket));
        socket.on('error', () => wsClients.delete(socket));
    });

    wsServer.on('listening', () => {
        wsServerReady = true;
        // console.error(`EasyEDA Copilot MCP WebSocket listening on ws://${MCP_WS_HOST}:${MCP_WS_PORT}`);
    });

    wsServer.on('error', (error: NodeJS.ErrnoException) => {
        wsServerReady = false;
        if (error.code === 'EADDRINUSE') {
            // Keep the MCP stdio server alive. Only the EasyEDA bridge is unavailable for this process.
            return;
        }

        throw error;
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

async function getPcbLayoutPromptText() {
    return [
        await getText('/v1/mcp-tools/prompts/pcb-layout'),
        '',
        PCB_LAYOUT_MCP_GUIDANCE,
    ].join('\n');
}

async function getCombinedPromptText() {
    return [
        await getText('/v1/mcp-tools/prompts/combined'),
        '',
        PCB_LAYOUT_MCP_GUIDANCE,
    ].join('\n');
}

function textResult(value: unknown) {
    return {
        content: [{
            type: 'text' as const,
            text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
        }],
    };
}

function resolveInputFilePath(filePath: string) {
    return isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);
}

async function readLayoutCode(input: { file: string; }) {
    const filePath = input.file;
    if (!filePath?.trim()) {
        throw new Error('Fill one: file.');
    }

    return await readFile(resolveInputFilePath(filePath), 'utf8');
}

function previewImageExtension(mimeType: string | undefined) {
    if (mimeType === 'image/svg+xml') return '.svg';
    if (mimeType === 'image/png') return '.png';
    if (mimeType === 'image/jpeg') return '.jpg';
    if (mimeType === 'image/webp') return '.webp';
    return '.svg';
}

async function writePreviewImageFile(previewImage: string | undefined, layoutId: string) {
    if (!previewImage) return undefined;

    const dataUrlMatch = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(previewImage);
    const mimeType = dataUrlMatch?.[1];
    const isBase64 = Boolean(dataUrlMatch?.[2]);
    const payload = dataUrlMatch?.[3] ?? previewImage;
    const bytes = dataUrlMatch
        ? isBase64
            ? Buffer.from(payload, 'base64')
            : Buffer.from(decodeURIComponent(payload), 'utf8')
        : Buffer.from(previewImage, 'base64');

    const previewDir = join(tmpdir(), 'easyeda-copilot-mcp', 'pcb-previews');
    await mkdir(previewDir, { recursive: true });

    const filePath = join(previewDir, `${layoutId}${previewImageExtension(mimeType)}`);
    await writeFile(filePath, bytes);
    return filePath;
}

function rememberPcbLayout(layoutId: string, layout: StoredPcbLayout) {
    storedPcbLayouts.set(layoutId, layout);

    if (storedPcbLayouts.size <= 25) return;

    const oldest = [...storedPcbLayouts.entries()]
        .sort((a, b) => a[1].createdAt - b[1].createdAt)
        .at(0)?.[0];

    if (oldest) storedPcbLayouts.delete(oldest);
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

server.registerResource(
    'pcb_layout_prompt',
    `${COPILOT_SERVER_URL}/v1/mcp-tools/prompts/pcb-layout`,
    {
        title: 'PCB Layout Prompt',
        description: 'PCB layout skill instructions, JavaScript DSL spec, and output expectations.',
        mimeType: 'text/plain',
    },
    async (uri) => ({
        contents: [{
            uri: uri.toString(),
            mimeType: 'text/plain',
            text: await getPcbLayoutPromptText(),
        }],
    }),
);

server.registerResource(
    'combined_prompt',
    `${COPILOT_SERVER_URL}/v1/mcp-tools/prompts/combined`,
    {
        title: 'Combined EasyEDA Copilot Prompt',
        description: 'Combined EasyEDA Copilot prompt from the main server.',
        mimeType: 'text/plain',
    },
    async (uri) => ({
        contents: [{
            uri: uri.toString(),
            mimeType: 'text/plain',
            text: await getCombinedPromptText(),
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
    'pcb_layout_prompt',
    {
        title: 'PCB Layout Prompt',
        description: 'Load the EasyEDA Copilot PCB layout instructions, JavaScript DSL spec, and output expectations.',
    },
    async () => ({
        description: 'PCB layout skill instructions, JavaScript DSL spec, and output expectations.',
        messages: [{
            role: 'user',
            content: {
                type: 'text',
                text: await getPcbLayoutPromptText(),
            },
        }],
    }),
);

server.registerPrompt(
    'easyeda_circuit_agent_prompt',
    {
        title: 'EasyEDA Circuit Agent Prompt',
        description: 'Load the combined EasyEDA Copilot prompt.',
    },
    async () => ({
        description: 'Combined EasyEDA Copilot prompt for circuit and PCB workflows.',
        messages: [{
            role: 'user',
            content: {
                type: 'text',
                text: await getCombinedPromptText(),
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
            name: z.enum(['skill_agent', 'circuit_maker', 'pcb_layout', 'combined']).describe('Prompt to read.'),
        }),
    },
    async ({ name }) => {
        if (name === 'skill_agent') {
            return textResult(await getText('/v1/mcp-tools/prompts/skill-agent'));
        }

        if (name === 'circuit_maker') {
            return textResult(await getText('/v1/mcp-tools/prompts/circuit-maker'));
        }

        if (name === 'pcb_layout') {
            return textResult(await getPcbLayoutPromptText());
        }

        return textResult(await getCombinedPromptText());
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
    'get_pcb_component_sizes',
    {
        title: 'Get PCB Component Sizes',
        description: 'Return resolved PCB footprint sizes in millimeters for selected current schematic components. Use before choosing compact board dimensions.',
        inputSchema: z.object({
            designators: z.array(z.string()).nullable().optional(),
            includeAll: z.boolean().nullable().optional(),
        }),
    },
    async ({ designators, includeAll }) => {
        const circuit = await requestEasyEda('get-schematic');
        const result = await postJson('/v1/mcp-tools/get-pcb-component-sizes', {
            circuit,
            designators,
            includeAll,
        }) as PcbComponentSizesResponse;

        return textResult(result.content ?? result.error ?? result);
    },
);

server.registerTool(
    'make_pcb_layout',
    {
        title: 'Make PCB Layout',
        description: 'Create PCB placement and optional routing from the current EasyEDA schematic using JavaScript PCB layout DSL code. Returns reports, previewImagePath, and a layoutId for later assembly. This tool does not assemble the board.',
        inputSchema: z.object({
            file: z.string().min(1).describe('PREFER! Path to a JavaScript PCB layout DSL code file.'),
        }).refine(data => Boolean(data.file), {
            message: 'Fill one: code, file.',
        }),
    },
    async (input) => {
        const code = await readLayoutCode(input);
        const circuit = await requestEasyEda('get-schematic');
        const result = await postJson('/v1/mcp-tools/make-pcb-layout', {
            code,
            circuit,
        }) as MakePcbLayoutResponse;

        const runId = randomUUID();
        const layoutId = result.pcb ? runId : undefined;
        const previewImagePath = await writePreviewImageFile(result.preview_image_url, runId);

        if (result.pcb && layoutId) {
            rememberPcbLayout(layoutId, {
                pcb: result.pcb,
                content: result.content,
                toolReport: result.toolReport,
                previewImagePath,
                createdAt: Date.now(),
            });
        }

        const report = {
            layoutId,
            previewImagePath,
        };

        const lines = [
            result.content ?? result.error ?? 'PCB layout finished.',
            `Run report:\n${JSON.stringify(report, null, 2)}`,
        ];

        return textResult(lines.join('\n\n'));
    },
);

server.registerTool(
    'assemble_pcb_layout_on_current_pcbdoc',
    {
        title: 'Assemble PCB Layout',
        description: 'Send a previously generated make_pcb_layout board assembly payload to the currently opened EasyEDA PCB document. Before using this tool, call get_current_project_info, verify the schematic belongs to a BOARD item with a PCB document, and call open_document for that PCB uuid.',
        inputSchema: z.object({
            layoutId: z.string().min(1).describe('layoutId returned by make_pcb_layout.'),
        }),
    },
    async ({ layoutId }) => {
        const layout = storedPcbLayouts.get(layoutId);
        if (!layout) {
            return textResult({
                error: 'PCB layout not found. Run make_pcb_layout again and use the returned layoutId.',
                layoutId,
            });
        }

        await requestEasyEda('assemble-board', {
            boardAssemble: layout.pcb,
        }, 300000);

        return textResult({
            content: 'PCB layout sent to EasyEDA for assembly.',
            layoutId,
        });
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
        description: 'Read the current EasyEDA project tree and document metadata through the connected extension. BOARD items show the linked schematic and PCB document; use this before PCB assembly.',
        inputSchema: z.object({}),
    },
    async () => {
        const result = await requestEasyEda('get-current-project-info');
        return textResult(result);
    },
);

server.registerTool(
    'get_current_drc_rules',
    {
        title: 'Get Current PCB DRC Rules',
        description: 'Return the current EasyEDA PCB DRC rule configuration as JSON. Open the target PCB document first.',
        inputSchema: z.object({}),
    },
    async () => {
        const result = await requestEasyEda('get-current-drc-rules');
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
