#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import sharp from 'sharp';
import { WebSocketServer, type WebSocket } from 'ws';
import * as z from 'zod/v4';
import { CircuitModStruct, type ExplainCircuit } from '@copilot/shared/types/circuit';
import type { BoardAssemble } from '@copilot/shared/types/pcb/board-assemble';
import type { ExplainPCB } from '@copilot/shared/types/pcb/explain';

const apiUrl = true ? 'http://localhost:5120' : 'https://circuit.tech.ru.net';
const COPILOT_SERVER_URL = (process.env.EASYEDA_COPILOT_SERVER_URL || apiUrl).replace(/\/$/, '');
const MCP_WS_PORT = Number(process.env.EASYEDA_COPILOT_MCP_WS_PORT || 8787);
const MCP_WS_HOST = process.env.EASYEDA_COPILOT_MCP_WS_HOST || '127.0.0.1';
const DOCS_CACHE_DIR = resolve(process.env.EASYEDA_COPILOT_MCP_DOCS_DIR || join(
    process.env.LOCALAPPDATA || join(homedir(), '.cache'),
    'easyeda-copilot-mcp',
    'docs',
));
const DOCS_MANIFEST_FILE = join(DOCS_CACHE_DIR, 'manifest.json');
const SKILL_DOC_PATH = join(DOCS_CACHE_DIR, 'SKILL.md');
const SKILL_DOC_URI = 'easyeda-copilot-mcp://local-docs/SKILL.md';
const CIRCUIT_DOCS_DIR = join(DOCS_CACHE_DIR, 'circuit-maker');
const PCB_LAYOUT_DOCS_DIR = join(DOCS_CACHE_DIR, 'pcb-layout');

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

type McpDocManifestEntry = {
    id: string;
    path: string;
    sha256: string;
    bytes: number;
    url: string;
};

type McpDocsManifest = {
    version: string;
    docs: McpDocManifestEntry[];
};

const wsClients = new Set<WebSocket>();
const pendingRequests = new Map<string, PendingRequest>();
const storedPcbLayouts = new Map<string, StoredPcbLayout>();
let wsServerReady = false;
let docsSyncError: string | undefined;

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

async function getJson<T>(path: string): Promise<T> {
    return JSON.parse(await getText(path)) as T;
}

function sha256Text(text: string) {
    return createHash('sha256').update(text, 'utf8').digest('hex');
}

function resolveDocCachePath(docPath: string) {
    const root = resolve(DOCS_CACHE_DIR);
    const target = resolve(root, docPath);
    const rel = relative(root, target);

    if (rel.startsWith('..') || isAbsolute(rel)) {
        throw new Error(`Unsafe MCP doc path: ${docPath}`);
    }

    return target;
}

function normalizeDocApiPath(path: string) {
    if (path.startsWith('/v1/')) return path;
    if (path.startsWith('/mcp-tools/')) return `/v1${path}`;
    return path;
}

async function syncLocalDocsFromServer() {
    const manifest = await getJson<McpDocsManifest>('/v1/mcp-tools/docs/manifest');
    await mkdir(DOCS_CACHE_DIR, { recursive: true });

    for (const doc of manifest.docs) {
        const filePath = resolveDocCachePath(doc.path);
        let currentText: string | undefined;

        try {
            currentText = await readFile(filePath, 'utf8');
        } catch {
            currentText = undefined;
        }

        if (currentText && sha256Text(currentText) === doc.sha256) {
            continue;
        }

        const text = await getText(normalizeDocApiPath(doc.url));
        const actualSha = sha256Text(text);
        if (actualSha !== doc.sha256) {
            throw new Error(`MCP doc checksum mismatch for ${doc.id}. Expected ${doc.sha256}, got ${actualSha}.`);
        }

        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, text, 'utf8');
    }

    await writeFile(DOCS_MANIFEST_FILE, JSON.stringify({
        ...manifest,
        source: COPILOT_SERVER_URL,
        cachedAt: new Date().toISOString(),
    }, null, 2), 'utf8');
}

function localSkillDocText() {
    return [
        'EasyEDA Copilot MCP documentation is cached locally.',
        '',
        `Skill file: ${SKILL_DOC_PATH}`,
        `Docs directory: ${DOCS_CACHE_DIR}`,
        '',
        'Read SKILL.md first. It points to the rest of the local docs.',
        docsSyncError ? `Last startup docs sync error: ${docsSyncError}` : undefined,
    ].filter(Boolean).join('\n');
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
    if (mimeType === 'image/svg+xml') return '.png';
    if (mimeType === 'image/png') return '.png';
    if (mimeType === 'image/jpeg') return '.jpg';
    if (mimeType === 'image/webp') return '.webp';
    return '.svg';
}

function isSvgImage(bytes: Buffer, mimeType: string | undefined) {
    if (mimeType === 'image/svg+xml') return true;
    return bytes.subarray(0, 512).toString('utf8').trimStart().startsWith('<svg');
}

async function renderPreviewImage(bytes: Buffer, mimeType: string | undefined) {
    if (!isSvgImage(bytes, mimeType)) {
        return {
            bytes,
            extension: previewImageExtension(mimeType),
        };
    }

    return {
        bytes: await sharp(bytes).png().toBuffer(),
        extension: '.png',
    };
}

async function writePreviewImageFile(previewImage: string | undefined, layoutId: string) {
    if (!previewImage) return undefined;

    const dataUrlMatch = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(previewImage);
    const mimeType = dataUrlMatch?.[1];
    const isBase64 = Boolean(dataUrlMatch?.[2]);
    const payload = dataUrlMatch?.[3] ?? previewImage;
    const sourceBytes = dataUrlMatch
        ? isBase64
            ? Buffer.from(payload, 'base64')
            : Buffer.from(decodeURIComponent(payload), 'utf8')
        : previewImage.trimStart().startsWith('<svg')
            ? Buffer.from(previewImage, 'utf8')
            : Buffer.from(previewImage, 'base64');

    const previewDir = join(tmpdir(), 'easyeda-copilot-mcp', 'pcb-previews');
    await mkdir(previewDir, { recursive: true });

    const { bytes, extension } = await renderPreviewImage(sourceBytes, mimeType);
    const filePath = join(previewDir, `${layoutId}${extension}`);
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
    'easyeda_copilot_mcp_skill',
    SKILL_DOC_URI,
    {
        title: 'EasyEDA Copilot MCP Skill',
        description: 'Path to the locally cached EasyEDA Copilot MCP SKILL.md.',
        mimeType: 'text/plain',
    },
    async (uri) => ({
        contents: [{
            uri: uri.toString(),
            mimeType: 'text/plain',
            text: localSkillDocText(),
        }],
    }),
);

server.registerPrompt(
    'easyeda_copilot_mcp_skill',
    {
        title: 'EasyEDA Copilot MCP Skill',
        description: 'Use the locally cached EasyEDA Copilot MCP SKILL.md.',
    },
    async () => ({
        description: 'Local EasyEDA Copilot MCP skill documentation.',
        messages: [{
            role: 'user',
            content: {
                type: 'text',
                text: localSkillDocText(),
            },
        }],
    }),
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
        description: `Search pre-assembled EasyEDA Copilot reused blocks that can be recalculated and inserted into a circuit. For circuit workflow docs, read the local docs folder: ${CIRCUIT_DOCS_DIR}`,
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
        description: `Return resolved PCB footprint sizes in millimeters for selected current schematic components. Use before choosing compact board dimensions. For PCB layout docs, read the local docs folder: ${PCB_LAYOUT_DOCS_DIR}`,
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
        description: `Create PCB placement and optional routing from the current EasyEDA schematic using JavaScript PCB layout DSL code. Returns reports, previewImagePath, and a layoutId for later assembly. This tool does not assemble the board. For PCB layout docs, read the local docs folder: ${PCB_LAYOUT_DOCS_DIR}`,
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
        description: `Send a previously generated make_pcb_layout board assembly payload to the currently opened EasyEDA PCB document. Before using this tool, call get_current_project_info, verify the schematic belongs to a BOARD item with a PCB document, and call open_document for that PCB uuid. For PCB assembly docs, read the local docs folder: ${PCB_LAYOUT_DOCS_DIR}`,
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
        description: `Post-process circuit changes on the main EasyEDA Copilot server and sends the assembled result to EasyEDA. Every added component must include part_uuid. For circuit modification docs, read the local docs folder: ${CIRCUIT_DOCS_DIR}`,
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
    'get_current_pcb',
    {
        title: 'Get EasyEDA PCB',
        description: 'Get the current EasyEDA PCB through the connected MCP interface. Open a PCB document first.',
        inputSchema: z.object({}),
    },
    async () => {
        const result = await requestEasyEda('get-pcb') as ExplainPCB;
        return textResult(result);
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
    'check_pcb_drc',
    {
        title: 'Check PCB DRC',
        description: 'Run EasyEDA PCB DRC check on the currently opened PCB document. Returns simplified DRC violations grouped by category, with a per-group limit to avoid huge responses. Open the target PCB document first.',
        inputSchema: z.object({
            limit: z.number().min(1).max(200).default(24).describe('Maximum number of violations per group to return.'),
        }),
    },
    async ({ limit }) => {
        const result = await requestEasyEda('check-pcb-drc', { limit }, 300000);
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
    'sync_current_document',
    {
        title: 'Sync Current EasyEDA Document',
        description: 'Force EasyEDA to synchronize the current schematic or PCB document by saving it, closing the current editor tab, waiting briefly, and reopening the same document.',
        inputSchema: z.object({
            settle_ms: z.number().min(0).max(10000).default(500).describe('Delay in milliseconds between close and reopen.'),
        }),
    },
    async ({ settle_ms }) => {
        const result = await requestEasyEda('sync-current-document', {
            settleMs: settle_ms,
        }, 300000);
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
            schematic_name: z.string().min(1).describe('New schematic short name. Use UPPERCASE or PascalCase'),
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
            schematic_page_name: z.string().min(1).describe('New schematic page short name. Use UPPERCASE or PascalCase'),
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
    'create_board',
    {
        title: 'Create EasyEDA Board',
        description: 'Create a board in the current EasyEDA project, optionally linking an existing schematic UUID and PCB UUID. Use get_current_project_info to inspect available document UUIDs first.',
        inputSchema: z.object({
            schematic_uuid: z.string().min(1).optional().describe('Optional schematic UUID to link to the new board.'),
            pcb_uuid: z.string().min(1).optional().describe('Optional PCB UUID to link to the new board.'),
        }),
    },
    async ({ schematic_uuid, pcb_uuid }) => {
        const result = await requestEasyEda('create-board', {
            schematicUuid: schematic_uuid,
            pcbUuid: pcb_uuid,
        });
        return textResult(result);
    },
);

server.registerTool(
    'delete_board',
    {
        title: 'Delete EasyEDA Board',
        description: 'Delete a board from the current EasyEDA project by board name. This is destructive; use get_current_project_info first to verify the exact board name.',
        inputSchema: z.object({
            board_name: z.string().min(1).describe('Board name to delete.'),
        }),
    },
    async ({ board_name }) => {
        const result = await requestEasyEda('delete-board', {
            boardName: board_name,
        });
        return textResult(result);
    },
);

server.registerTool(
    'create_pcb',
    {
        title: 'Create EasyEDA PCB',
        description: 'Create a PCB in the current EasyEDA project. If board_name is omitted, EasyEDA creates a free PCB.',
        inputSchema: z.object({
            board_name: z.string().min(1).optional().describe('Optional parent board name.'),
        }),
    },
    async ({ board_name }) => {
        const result = await requestEasyEda('create-pcb', {
            boardName: board_name,
        });
        return textResult(result);
    },
);

server.registerTool(
    'modify_pcb_name',
    {
        title: 'Rename EasyEDA PCB',
        description: 'Modify an EasyEDA PCB name.',
        inputSchema: z.object({
            pcb_uuid: z.string().min(1).describe('PCB UUID.'),
            pcb_name: z.string().min(1).describe('New PCB short name. Use UPPERCASE or PascalCase.'),
        }),
    },
    async ({ pcb_uuid, pcb_name }) => {
        const result = await requestEasyEda('modify-pcb-name', {
            pcbUuid: pcb_uuid,
            pcbName: pcb_name,
        });
        return textResult(result);
    },
);

server.registerTool(
    'import_pcb_changes',
    {
        title: 'Import PCB Changes',
        description: `Import schematic changes into the currently opened PCB document. If schematic_uuid is omitted, EasyEDA uses the schematic linked to the same board. Open the target PCB document first. For PCB docs, read the local docs folder: ${PCB_LAYOUT_DOCS_DIR}`,
        inputSchema: z.object({
            schematic_uuid: z.string().min(1).optional().describe('Optional schematic UUID to import changes from.'),
        }),
    },
    async ({ schematic_uuid }) => {
        const result = await requestEasyEda('import-pcb-changes', {
            schematicUuid: schematic_uuid,
        }, 300000);
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
    try {
        await syncLocalDocsFromServer();
    } catch (error) {
        docsSyncError = (error as Error).message;
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);
    // console.error(`EasyEDA Copilot MCP Server running on stdio. Server URL: ${COPILOT_SERVER_URL}`);
}

main().catch(() => {
    // console.error('Fatal error in main():', error);
    process.exit(1);
});
