#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import sharp from 'sharp';
import { WebSocketServer, type WebSocket } from 'ws';
import * as z from 'zod/v4';
import { CircuitModStruct, ExplainCircuitStruct, type ExplainCircuit } from '@copilot/shared/types/circuit';
import type { BoardAssemble } from '@copilot/shared/types/pcb/board-assemble';
import { ExplainPcbSchema, type ExplainPCB } from '@copilot/shared/types/pcb/explain';
import { savePcbPreview, type PreviewOptions } from './pcb-preview/index.js';
import { PcbLayerNameSchema } from '@copilot/shared/types/pcb/shared.js';
import { RawPcb } from '@copilot/shared/types/pcb/raw.js';
import { PcbDrcBundleSchema, type PcbDrcBundle } from '@copilot/shared/types/pcb/drc.js';
import findUp from 'find-up';
import { fileURLToPath } from 'node:url';
import { runEasyEdaAutoRouter } from './autorouter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// eslint-disable-next-line no-constant-condition
const apiUrl = true ? 'http://localhost:5120' : 'https://circuit.tech.ru.net';
const COPILOT_SERVER_URL = (process.env.EASYEDA_COPILOT_SERVER_URL || apiUrl).replace(/\/$/, '');
const MCP_WS_PORT = Number(process.env.EASYEDA_COPILOT_MCP_WS_PORT || 8787);
const MCP_WS_HOST = process.env.EASYEDA_COPILOT_MCP_WS_HOST || '127.0.0.1';

const DOCS_DIR = join(dirname(findUp.sync('package.json', {
    cwd: __dirname
})!), 'docs');
const SKILL_DOC_PATH = join(DOCS_DIR, 'SKILL.md');
const SKILL_DOC_URI = 'easyeda-copilot-mcp://local-docs/SKILL.md';
const TEMP_DIR = join(tmpdir(), 'easyeda-copilot-mcp');

const server = new McpServer({
    name: 'easyeda-copilot',
    version: '1.1.4',
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

type AutoRouteInputNet = {
    net?: unknown;
    routing?: unknown;
    [key: string]: unknown;
};

type AutoRouteRunSummary = {
    inputPath: string;
    filteredInputPath: string;
    resultPath: string;
    ignoredNets: string[];
    removedTopLevelNets: number;
    progress?: number;
    routabitity?: number;
    traces: number;
    vias: number;
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

function localSkillDocText() {
    return [
        'EasyEDA Copilot MCP documentation is cached locally.',
        `Skill file: ${SKILL_DOC_PATH}`,
        `Docs directory: ${DOCS_DIR}`,
        'Read SKILL.md first. It points to the rest of the local docs.'
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

async function readJsonFile(file: string) {
    const text = await readFile(resolveInputFilePath(file), 'utf8');
    return JSON.parse(text);
}

function parseJsonText(text: string, label: string) {
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`${label} is not valid JSON: ${(error as Error).message}`);
    }
}

function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getBoardPolygonFromAutoRouteInput(inputJson: unknown) {
    if (!isRecord(inputJson)) return undefined;
    const boardOutline = inputJson.boardOutline;
    if (!isRecord(boardOutline) || !Array.isArray(boardOutline.path)) return undefined;

    const polygon = boardOutline.path
        .filter((point): point is [number, number] =>
            Array.isArray(point) &&
            point.length >= 2 &&
            typeof point[0] === 'number' &&
            typeof point[1] === 'number' &&
            Number.isFinite(point[0]) &&
            Number.isFinite(point[1]),
        )
        .map(([x, y]) => ({ x, y }));

    return polygon.length >= 3 ? polygon : undefined;
}

function filterAutoRouteInput(inputJson: unknown, ignoredNets: string[]) {
    const ignored = new Set(ignoredNets.map(net => net.trim()).filter(Boolean));
    const filtered = cloneJson(inputJson);
    let removedTopLevelNets = 0;

    if (isRecord(filtered) && Array.isArray(filtered.nets)) {
        const nets = filtered.nets as AutoRouteInputNet[];
        filtered.nets = nets.filter(netRule => {
            const netName = typeof netRule?.net === 'string' ? netRule.net : '';
            if (!ignored.has(netName)) return true;
            removedTopLevelNets++;
            return false;
        });
    }

    return { filtered, removedTopLevelNets };
}

function summarizeAutoRouteResult(result: Record<string, unknown>, paths: {
    inputPath: string;
    filteredInputPath: string;
    resultPath: string;
}, ignoredNets: string[], removedTopLevelNets: number): AutoRouteRunSummary {
    return {
        ...paths,
        ignoredNets,
        removedTopLevelNets,
        progress: typeof result.progress === 'number' ? result.progress : undefined,
        routabitity: typeof result.routabitity === 'number' ? result.routabitity : undefined,
        traces: Array.isArray(result.traces) ? result.traces.length : 0,
        vias: Array.isArray(result.vias) ? result.vias.length : 0,
    };
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
        description: `Search pre-assembled EasyEDA Copilot reused blocks that can be recalculated and inserted into a circuit. For circuit workflow docs, read the local docs folder: ${SKILL_DOC_PATH}`,
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
        description: `Return resolved PCB footprint sizes in millimeters for selected current schematic components. Use before choosing compact board dimensions. For PCB layout docs, read the local docs folder: ${SKILL_DOC_PATH}`,
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
        description: `Create PCB component placement from the current EasyEDA schematic using JavaScript PCB layout DSL code. Server-side routing is disabled: route the assembled PCB later in EasyEDA/client tools. Returns placement report, previewImagePath, and a layoutId for later assembly. This tool does not assemble the board. For PCB layout docs, read the local docs folder: ${SKILL_DOC_PATH}`,
        inputSchema: z.object({
            file: z.string().min(1).describe('PREFER! Path to a JavaScript PCB layout DSL code file.'),
        }).refine(data => Boolean(data.file), {
            message: 'Fill one: code, file.',
        }),
    },
    async (input) => {
        const code = await readLayoutCode(input);
        const circuit = await requestEasyEda('get-multi-page-schematic');
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
        description: `Send a previously generated make_pcb_layout board assembly payload to the currently opened EasyEDA PCB document. Before using this tool, call get_current_project_info, verify the schematic belongs to a BOARD item with a PCB document, and call open_document for that PCB uuid. For PCB assembly docs, read the local docs folder: ${SKILL_DOC_PATH}`,
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
    'run_auto_route_on_current_pcbdoc',
    {
        title: 'Run PCB Auto Router',
        description: 'Export the current EasyEDA PCB autoroute JSON, run the bundled custom router on the MCP side, import the routed result back into EasyEDA, then rebuild GND pours and add GND suture vias. Open the target PCB document first.',
        inputSchema: z.object({
            ignore_nets: z.array(z.string().min(1)).default(['GND']).describe('Nets removed from the routing task. Default: ["GND"].'),
            timeout_sec: z.number().min(10).max(1800).default(600).describe('Router timeout in seconds.'),
            router_dir: z.string().min(1).optional().describe('Optional custom-router directory override. Usually leave empty.'),
            pour_gnd: z.boolean().default(true).describe('Create/rebuild full-board GND pours after importing routes.'),
            suture_gnd: z.boolean().default(true).describe('Add GND SUTURE vias after importing routes.'),
            suture_grid_mm: z.number().min(0.5).max(50).default(4).describe('GND suture via grid step in millimeters.'),
            suture_diameter_mm: z.number().min(0.05).max(5).default(0.61).describe('GND suture via outer diameter in millimeters.'),
            suture_drill_mm: z.number().min(0.05).max(5).default(0.305).describe('GND suture via drill diameter in millimeters.'),
            suture_edge_margin_mm: z.number().min(0).max(20).default(1).describe('Minimum distance from board bounding box edge for generated suture via candidates.'),
            suture_max_count: z.number().int().min(0).max(2000).default(500).describe('Safety cap for generated GND suture vias.'),
        }),
    },
    async (input) => {
        await mkdir(TEMP_DIR, { recursive: true });
        const runId = randomUUID().slice(0, 6);
        const inputPath = join(TEMP_DIR, `autoroute-input-${runId}.json`);
        const filteredInputPath = join(TEMP_DIR, `autoroute-input-filtered-${runId}.json`);
        const resultPath = join(TEMP_DIR, `autoroute-result-${runId}.json`);

        const exported = await requestEasyEda('export-pcb-autoroute-json', {}, 300000) as { text?: unknown };
        const inputText = typeof exported.text === 'string' ? exported.text : '';
        if (!inputText) throw new Error('EasyEDA returned empty autoroute JSON.');

        await writeFile(inputPath, inputText);
        const inputJson = parseJsonText(inputText, 'EasyEDA autoroute input');
        const ignoredNets = input.ignore_nets.map(net => net.trim()).filter(Boolean);
        const { filtered, removedTopLevelNets } = filterAutoRouteInput(inputJson, ignoredNets);
        await writeFile(filteredInputPath, JSON.stringify(filtered, null, 2));

        let lastProgress = 0;
        const result = await runEasyEdaAutoRouter(filtered, {
            routerDir: input.router_dir,
            timeoutMs: input.timeout_sec * 1000,
            onProgress: progress => {
                lastProgress = Math.max(lastProgress, progress);
            },
        }) as Record<string, unknown>;

        if (Number(result.progress ?? 0) < 1) {
            throw new Error(`Auto router did not finish. Last progress: ${lastProgress}`);
        }

        await writeFile(resultPath, JSON.stringify(result, null, 2));

        const boardPolygon = getBoardPolygonFromAutoRouteInput(inputJson);
        const importResult = await requestEasyEda('import-pcb-autoroute-json', {
            text: JSON.stringify(result),
            boardPolygon,
            pourGround: input.pour_gnd,
            sutureGround: input.suture_gnd,
            suture: {
                gridMm: input.suture_grid_mm,
                diameterMm: input.suture_diameter_mm,
                drillMm: input.suture_drill_mm,
                edgeMarginMm: input.suture_edge_margin_mm,
                maxCount: input.suture_max_count,
            },
        }, 300000);

        return textResult({
            content: 'Auto route imported into EasyEDA.',
            ...summarizeAutoRouteResult(result, { inputPath, filteredInputPath, resultPath }, ignoredNets, removedTopLevelNets),
            importResult,
        });
    },
);

server.registerTool(
    'extract_circuit_on_current_page',
    {
        title: 'Extract Circuit',
        description: `Post-process circuit changes on the main EasyEDA Copilot server and sends the assembled result to EasyEDA. Every added component must include part_uuid. For circuit modification docs, read the local docs folder: ${SKILL_DOC_PATH}`,
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
        description: 'Get the current EasyEDA schematic through the connected MCP interface.\n' +
            `Format: ${JSON.stringify(ExplainCircuitStruct().toJSONSchema())}`,
        inputSchema: z.object({}),
    },
    async () => {
        const result = await requestEasyEda('get-schematic') as ExplainCircuit;
        const schematic = { ...result, components: result.components.map(c => ({ ...c, pos: undefined, })) };

        if (schematic.components.length > 40) {
            await mkdir(TEMP_DIR, { recursive: true });

            const savePath = join(TEMP_DIR, `sch-${crypto.randomUUID().slice(0, 6)}.json`);
            await writeFile(savePath, JSON.stringify(schematic, null, 2));
            return textResult({
                "message": "Schematic too big, so it was saved to a file. components len: " + schematic.components.length,
                "path": savePath
            });
        }

        return textResult(schematic);
    },
);

server.registerTool(
    'get_current_pcb',
    {
        title: 'Get EasyEDA PCB',
        description: 'Get the current EasyEDA PCB through the connected MCP interface. Open a PCB document first.\n' +
            `Format: ${JSON.stringify(ExplainPcbSchema({ forLLM: true }).toJSONSchema())}`,
        inputSchema: z.object({}),
    },
    async () => {
        const result = await requestEasyEda('get-pcb') as ExplainPCB;

        if (result.components.length > 30 || result.vias?.length || 0 > 50 || result.polygons?.length || 0 > 20 || result.wires?.length || 0 > 50) {
            await mkdir(TEMP_DIR, { recursive: true });

            const savePath = join(TEMP_DIR, `pcb-${crypto.randomUUID().slice(0, 6)}.json`);
            await writeFile(savePath, JSON.stringify(result, null, 2));
            return textResult({
                "message": "Pcb too big, so it was saved to a file.\n" +
                    `components len: ${result.components.length}\n` +
                    `vias len: ${result.vias?.length}\n` +
                    `polygons len: ${result.polygons?.length}\n` +
                    `wires len: ${result.wires?.length}`,
                "path": savePath
            });
        }


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
    'export_pcb_drc_rules',
    {
        title: 'Export PCB DRC Rules',
        description: 'Export the full current PCB DRC bundle to a JSON file. The bundle contains ruleConfiguration and netRules; differential pairs are injected into netRules as synthetic entries with type "differentialPair". Open the target PCB document first.',
        inputSchema: z.object({
            file: z.string().min(1).optional().describe('Optional output JSON file path. Defaults to a temp file.'),
        }),
    },
    async ({ file }) => {
        const result = PcbDrcBundleSchema().parse(await requestEasyEda('export-pcb-drc-rules')) as PcbDrcBundle;
        const savePath = file?.trim()
            ? resolveInputFilePath(file)
            : join(TEMP_DIR, `pcb-drc-${randomUUID().slice(0, 6)}.json`);

        await mkdir(dirname(savePath), { recursive: true });
        await writeFile(savePath, JSON.stringify(result, null, 2));

        return textResult({
            path: savePath,
            ruleConfigurationName: typeof result.ruleConfiguration.name === 'string' ? result.ruleConfiguration.name : undefined,
            netRules: result.netRules.length,
            differentialPairs: result.netRules.filter(rule => rule.type === 'differentialPair').length,
        });
    },
);

server.registerTool(
    'apply_pcb_drc_rules',
    {
        title: 'Apply PCB DRC Rules',
        description: `Apply a PCB DRC bundle JSON file exported by export_pcb_drc_rules. Synthetic netRules entries with type "differentialPair" are reconciled through EasyEDA differential-pair APIs before regular netRules are overwritten. Open the target PCB document first. First read doc ${SKILL_DOC_PATH}`,
        inputSchema: z.object({
            file: z.string().min(1).describe('Path to the edited PCB DRC bundle JSON file.'),
        }),
    },
    async ({ file }) => {
        const bundle = PcbDrcBundleSchema().parse(await readJsonFile(file)) as PcbDrcBundle;
        const result = await requestEasyEda('apply-pcb-drc-rules', { bundle }, 300000);
        return textResult(result);
    },
);

server.registerTool(
    'check_pcb_drc',
    {
        title: 'Check PCB DRC',
        description: 'Run EasyEDA PCB DRC check on the currently opened PCB document. Returns simplified DRC violations grouped by category. The limit is split evenly across rule groups within each category to avoid huge responses. Open the target PCB document first.',
        inputSchema: z.object({
            limit: z.number().min(1).max(200).default(24).describe('Maximum number of violations to return per category, split across rule groups.'),
        }),
    },
    async ({ limit }) => {
        const result = await requestEasyEda('check-pcb-drc', { limit }, 300000);
        return textResult(result);
    },
);

server.registerTool(
    'inspect_net',
    {
        title: 'Inspect PCB Net',
        description: 'Analyze a specific net on the currently opened PCB document: length, width, vias, layers, connected/unconnected pads, polygons, and DRC violations. Open the target PCB document first.',
        inputSchema: z.object({
            net: z.string().min(1).describe('Net name to inspect.'),
            drc_limit: z.number().min(1).max(200).default(24).describe('Maximum DRC violations per group to fetch for this net.'),
        }),
    },
    async ({ net, drc_limit }) => {
        const result = await requestEasyEda('inspect-net', { net, drc_limit }, 300000);
        return textResult(result);
    },
);

server.registerTool(
    'inspect_component',
    {
        title: 'Inspect PCB Component',
        description: 'Return a PCB component by designator with a list of nearest neighboring components within the given radius. Open the target PCB document first.',
        inputSchema: z.object({
            designator: z.string().min(1).describe('Component designator to inspect, e.g. R1.'),
            radius: z.number().min(0.1).max(100).default(10).describe('Search radius in millimeters for nearest components.'),
        }),
    },
    async ({ designator, radius }) => {
        const result = await requestEasyEda('inspect-component', { designator, radius }, 300000);
        return textResult(result);
    },
);

const BboxMmSchema = z.object({
    x: z.number().describe('X coordinate in millimeters.'),
    y: z.number().describe('Y coordinate in millimeters.'),
    width: z.number().positive().describe('Width in millimeters.'),
    height: z.number().positive().describe('Height in millimeters.'),
    unit: z.literal('mm').optional().default('mm').describe('Unit type.'),
});

const BboxRelSchema = z.object({
    x: z.number().min(0).max(1).describe('Relative X (0..1) of the board bounding box.'),
    y: z.number().min(0).max(1).describe('Relative Y (0..1) of the board bounding box.'),
    width: z.number().min(0).max(1).describe('Relative width (0..1) of the board bounding box.'),
    height: z.number().min(0).max(1).describe('Relative height (0..1) of the board bounding box.'),
    unit: z.literal('rel').describe('Relative unit marker.'),
});

const BboxSchema = z.union([BboxMmSchema, BboxRelSchema]);

const ZoomTargetSchema = z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('full') }),
    z.object({ mode: z.literal('net'), net: z.string().min(1).describe('Net name to zoom to.') }),
    z.object({ mode: z.literal('component'), designator: z.string().min(1).describe('Component designator to zoom to, e.g. U1.') }),
    z.object({ mode: z.literal('bbox'), bbox: BboxSchema.describe('Bounding box in mm or relative units.') }),
]);

server.registerTool(
    'preview_pcb',
    {
        title: 'Preview PCB',
        description: 'Render a PNG preview of the currently opened PCB document. Supports layer selection, net/component highlighting, and zoom to a net, component, or bounding box. Open the target PCB document first.',
        inputSchema: z.object({
            layers: z.array(PcbLayerNameSchema().or(z.literal('all'))).default(['all']).describe('Layers to render, e.g. ["top"], ["bottom"], ["top","bottom"], or ["all"].'),
            highlight_net: z.string().optional().describe('Optional net name to highlight.'),
            highlight_component: z.string().optional().describe('Optional component designator to highlight.'),
            highlight_net_colors: z.record(z.string(), z.string()).optional().describe('Optional per-net highlight colors, e.g. {"BAT+":"#ff0000","GND":"#00ff00"}.'),
            highlight_component_colors: z.record(z.string(), z.string()).optional().describe('Optional per-component highlight colors, e.g. {"U1":"#ff0000"}.'),
            zoom: ZoomTargetSchema.default({ mode: 'full' }).describe('Zoom target: full board, a net, a component, or a bbox.'),
            padding_mm: z.number().min(0).max(100).default(2).describe('Padding around the rendered area in millimeters.'),
        }),
    },
    async (input) => {
        const data = await requestEasyEda('get-pcb-raw') as RawPcb;

        const options: PreviewOptions = {
            layers: input.layers,
            highlightNets: input.highlight_net ? [input.highlight_net] : [],
            highlightComponents: input.highlight_component ? [input.highlight_component] : [],
            highlightNetColors: input.highlight_net_colors || {},
            highlightComponentColors: input.highlight_component_colors || {},
            zoom: input.zoom,
            paddingMm: input.padding_mm,
            show: {},
            widthPx: 1024,
        };

        await mkdir(TEMP_DIR, { recursive: true });
        const { pngPath } = await savePcbPreview(data, options, join(TEMP_DIR, 'pcbprev-' + crypto.randomUUID().slice(0, 6)));

        return textResult({ image_path: pngPath });
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

const DOC_QUERY = z.object({
    uuid: z.string().min(1).describe('Schematic, Schematic page or PCB UUID.'),
}).or(z.object({
    board_name: z.string().min(1)
}))

server.registerTool(
    'modify_name',
    {
        title: 'Rename EasyEDA: Schematic, Schematic page, PCB',
        description: 'Modify the name of an EasyEDA Schematic, Schematic page, PCB',
        inputSchema: z.object({
            doc: DOC_QUERY,
            name: z.string().min(1).describe('New short name. Use UPPERCASE or PascalCase'),
        }),
    },
    async ({ name, doc }) => {
        const result = await requestEasyEda('modify-name', { name, ...doc });
        return textResult(result);
    },
);

server.registerTool(
    'create_doc',
    {
        title: 'Create EasyEDA Doc',
        description: 'Create a doc in the current EasyEDA project',
        inputSchema: z.object({
            doc: z.union([
                z.object({
                    doc_type: z.literal('board'),
                    schematic_uuid: z.string().min(1).optional().describe('Optional schematic UUID to link to the new board.'),
                    pcb_uuid: z.string().min(1).optional().describe('Optional PCB UUID to link to the new board.'),
                }),
                z.object({
                    doc_type: z.literal('schematic'),
                    board_name: z.string().min(1).optional().describe('Optional parent board name.'),
                }),
                z.object({
                    doc_type: z.literal('schematic_page'),
                    schematic_uuid: z.string().min(1).describe('Parent schematic UUID.'),
                }),
                z.object({
                    doc_type: z.literal('pcb'),
                    board_name: z.string().min(1).optional().describe('Optional parent board name.'),
                }),
            ]),
        })
    },
    async ({ doc }) => {
        switch (doc.doc_type) {
            case 'schematic': {
                const result = await requestEasyEda('create-schematic', {
                    boardName: doc.board_name,
                });
                return textResult(result);
            }
            case 'schematic_page': {
                const result = await requestEasyEda('create-schematic-page', {
                    schematicUuid: doc.schematic_uuid,
                });
                return textResult(result);
            }
            case 'board': {
                const result = await requestEasyEda('create-board', {
                    schematicUuid: doc.schematic_uuid,
                    pcbUuid: doc.pcb_uuid,
                });
                return textResult(result);
            }
            case 'pcb': {
                const result = await requestEasyEda('create-pcb', {
                    boardName: doc.board_name,
                });
                return textResult(result);
            }
            default:
                throw new Error(`Unsupported create_doc doc_type`);
        }
    },
);

server.registerTool(
    'delete_doc',
    {
        title: 'Delete EasyEDA Doc',
        description: 'Delete a doc from the current EasyEDA project. This is destructive!',
        inputSchema: z.object({
            doc: DOC_QUERY,
        }),
    },
    async ({ doc }) => {
        const result = await requestEasyEda('delete-doc', { ...doc });
        return textResult(result);
    },
);

server.registerTool(
    'import_pcb_changes',
    {
        title: 'Import PCB Changes',
        description: `Import schematic changes into the currently opened PCB document. If schematic_uuid is omitted, EasyEDA uses the schematic linked to the same board. Open the target PCB document first. For PCB docs, read the local docs folder: ${SKILL_DOC_PATH}`,
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
