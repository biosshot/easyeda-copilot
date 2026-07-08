#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import sharp from 'sharp';
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
import { startBridge, type Bridge } from './bridge/index.js';

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
const PCB_LAYOUT_TASK_PATH = '/v1/mcp-tools/make-pcb-layout';
const DEFAULT_PCB_LAYOUT_WAIT_MS = 60_000;
const DEFAULT_AUTO_ROUTE_WAIT_MS = 60_000;
const LOCAL_OPERATION_LIMIT = 25;
const AUTO_ROUTE_OPERATION_LABEL = 'run_auto_route_on_current_pcbdoc';

function isPcbRoutingLayer(layer: string) {
    return layer === 'TOP' || layer === 'BOTTOM' || /^INNER_(?:[1-9]|[12]\d|30)$/.test(layer);
}

const PcbRoutingLayerSchema = PcbLayerNameSchema().refine(isPcbRoutingLayer, {
    message: 'Expected a copper signal layer: TOP, BOTTOM, or INNER_1..INNER_30.',
});

const NetNameListSchema = z.union([z.string().min(1), z.array(z.string().min(1))]).optional();

const AutoRouteInputSchema = z.object({
    ignore_nets: z.array(z.string().min(1)).default(['GND']).describe('Nets removed from the routing task. Default: ["GND"].'),
    route_layers: z.array(PcbRoutingLayerSchema).min(1).optional().describe('Optional copper signal layers allowed for routing, e.g. ["TOP"], ["BOTTOM"], or ["TOP","BOTTOM","INNER_1"]. Use get_pcb_stack_layers first.'),
    timeout_sec: z.number().min(10).max(1800).default(600).describe('Router timeout in seconds.'),
    router_dir: z.string().min(1).optional().describe('Optional custom-router directory override. Usually leave empty.'),
    pour_gnd: z.boolean().default(true).describe('Create/rebuild full-board GND pours after importing routes.'),
    suture_gnd: z.boolean().default(true).describe('Add GND SUTURE vias after importing routes.'),
    suture_grid_mm: z.number().min(0.5).max(50).default(4).describe('GND suture via grid step in millimeters.'),
    suture_diameter_mm: z.number().min(0.05).max(5).default(0.61).describe('GND suture via outer diameter in millimeters.'),
    suture_drill_mm: z.number().min(0.05).max(5).default(0.305).describe('GND suture via drill diameter in millimeters.'),
    suture_edge_margin_mm: z.number().min(0).max(20).default(1).describe('Minimum distance from board bounding box edge for generated suture via candidates.'),
    suture_max_count: z.number().int().min(0).max(2000).default(500).describe('Safety cap for generated GND suture vias.'),
    wait_ms: z.number().min(30_000).max(180000).default(DEFAULT_AUTO_ROUTE_WAIT_MS).describe('How long this call may wait for completion. Default: 60000ms.'),
});

type AutoRouteToolInput = z.infer<typeof AutoRouteInputSchema>;

const server = new McpServer({
    name: 'easyeda-copilot',
    version: '1.1.4',
});
let bridge: Bridge | undefined;

type MakePcbLayoutResponse = {
    content?: string;
    toolReport?: unknown;
    pcb?: BoardAssemble;
    preview_image_url?: string;
    placement_debug_artifacts?: PlacementDebugArtifactsResponse;
    error?: string;
};

type PlacementDebugArtifactResponse = {
    type?: string;
    name?: string;
    fileName?: string;
    components?: string[];
    svg_url?: string;
    svg?: string;
    path?: string;
};

type PlacementDebugArtifactsResponse = {
    items?: PlacementDebugArtifactResponse[];
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
    previewSvgPath?: string;
    debugArtifactsDir?: string;
    debugArtifacts?: SavedPlacementDebugArtifact[];
    createdAt: number;
};

type SavedPlacementDebugArtifact = {
    type: string;
    name: string;
    components: string[];
    path: string;
};

type SavedPlacementDebugArtifacts = {
    debugArtifactsDir?: string;
    debugArtifactsIndexPath?: string;
    debugArtifacts?: SavedPlacementDebugArtifact[];
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
    routeLayers?: string[];
    routeLayerIds?: number[];
    removedTopLevelNets: number;
    progress?: number;
    routabitity?: number;
    traces: number;
    vias: number;
};

type AutoRouteToolResult = AutoRouteRunSummary & {
    content: string;
    importResult: unknown;
};

const storedPcbLayouts = new Map<string, StoredPcbLayout>();

async function requestEasyEda(event: string, body: Record<string, unknown> = {}, timeoutMs = 120000) {
    if (!bridge) throw new Error('EasyEDA bridge is not initialized yet.');
    return bridge.requestEasyEda(event, body, timeoutMs);
}

const SERVER_AUTHORIZATION = 'Basic Y2lyY3VpdDp4eU9BTE5INHBmb05HNjB2VmtBNTg0MTg=';

type AsyncOperationResponse<T = unknown> = {
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
    result?: T;
    intermediateResult?: unknown;
    error?: string;
    createdAt: string;
    completedAt?: string;
};

async function parseJsonResponse(response: Response) {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

async function postJson(path: string, payload: unknown): Promise<unknown> {
    const response = await fetch(`${COPILOT_SERVER_URL}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': SERVER_AUTHORIZATION
        },
        body: JSON.stringify(payload),
    });

    const data = await parseJsonResponse(response);

    if (!response.ok) {
        const message = typeof data === 'object' && data && 'error' in data
            ? String(data.error)
            : `HTTP ${response.status}`;
        throw new Error(message);
    }

    return data;
}

function asyncProgressText(intermediate: unknown) {
    if (!isRecord(intermediate)) return undefined;
    if (typeof intermediate.stage === 'string' && typeof intermediate.progress === 'number') {
        const percent = Math.max(0, Math.min(100, Math.round(intermediate.progress)));
        const content = typeof intermediate.content === 'string' ? intermediate.content : `PCB layout stage: ${intermediate.stage}`;
        return `${percent}% ${intermediate.stage}: ${content}`;
    }
    if (typeof intermediate.content === 'string') return intermediate.content;
    if (typeof intermediate.action === 'string') return intermediate.action;
    if (typeof intermediate.stage === 'string') return `PCB layout stage: ${intermediate.stage}`;
    return undefined;
}

async function sleep(ms: number) {
    await new Promise(resolve => setTimeout(resolve, ms));
}

type LocalOperation<T = unknown> = AsyncOperationResponse<T> & {
    label: string;
    controller: AbortController;
};

type LocalOperationContext = {
    signal: AbortSignal;
    setProgress: (intermediateResult: unknown) => void;
};

const localOperations = new Map<string, LocalOperation<unknown>>();
let pcbLayoutOperationLock: {
    operationId?: string;
    startedAt: number;
} | undefined;

function operationErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : JSON.stringify(error);
}

function isCancelledError(error: unknown) {
    return /cancel/i.test(operationErrorMessage(error));
}

function assertOperationNotCancelled(signal: AbortSignal) {
    if (signal.aborted) throw new Error('Operation cancelled.');
}

function localOperationResponse<T>(operation: LocalOperation<unknown>): AsyncOperationResponse<T> {
    return {
        status: operation.status,
        result: operation.result as T | undefined,
        intermediateResult: operation.intermediateResult,
        error: operation.error,
        createdAt: operation.createdAt,
        completedAt: operation.completedAt,
    };
}

function trimLocalOperations() {
    if (localOperations.size <= LOCAL_OPERATION_LIMIT) return;

    const finished = [...localOperations.entries()]
        .filter(([, operation]) => operation.status !== 'pending')
        .sort((a, b) => Date.parse(a[1].createdAt) - Date.parse(b[1].createdAt));

    for (const [operationId] of finished) {
        if (localOperations.size <= LOCAL_OPERATION_LIMIT) break;
        localOperations.delete(operationId);
    }
}

function findPendingLocalOperation(label: string) {
    return [...localOperations.entries()].find(([, operation]) =>
        operation.label === label && operation.status === 'pending',
    );
}

function assertNoPendingLocalOperation(label: string, toolName: string, waitToolName: string) {
    const pending = findPendingLocalOperation(label);
    if (!pending) return;

    const [operationId] = pending;
    throw new Error(`${toolName} is already running. Wait for it with ${waitToolName} or cancel it first. operationId: ${operationId}`);
}

function startLocalOperation<T>(
    label: string,
    runner: (context: LocalOperationContext) => Promise<T>,
) {
    const operationId = randomUUID();
    const controller = new AbortController();
    const operation: LocalOperation<T> = {
        label,
        controller,
        status: 'pending',
        createdAt: new Date().toISOString(),
    };

    localOperations.set(operationId, operation as LocalOperation<unknown>);
    trimLocalOperations();

    void (async () => {
        try {
            const result = await runner({
                signal: controller.signal,
                setProgress: intermediateResult => {
                    operation.intermediateResult = intermediateResult;
                },
            });

            if (operation.status === 'pending') {
                operation.status = 'completed';
                operation.result = result;
            }
        } catch (error) {
            if (operation.status === 'pending') {
                operation.status = controller.signal.aborted || isCancelledError(error) ? 'cancelled' : 'failed';
                operation.error = operationErrorMessage(error);
            }
        } finally {
            operation.completedAt ??= new Date().toISOString();
            trimLocalOperations();
        }
    })();

    return operationId;
}

async function assertNoPendingPcbLayoutOperation() {
    if (!pcbLayoutOperationLock) return;

    if (!pcbLayoutOperationLock.operationId) {
        throw new Error('make_pcb_layout is already starting. Wait for it to return an operationId before starting another layout.');
    }

    const operation = await getAsyncTaskStatus<MakePcbLayoutResponse>(PCB_LAYOUT_TASK_PATH, pcbLayoutOperationLock.operationId);
    if (operation.status === 'pending') {
        throw new Error(`make_pcb_layout is already running. Wait for it with wait_pcb_layout or cancel it first. operationId: ${pcbLayoutOperationLock.operationId}`);
    }

    pcbLayoutOperationLock = undefined;
}

function releasePcbLayoutLockIfFinished(operationId: string, operation: AsyncOperationResponse<unknown>) {
    if (pcbLayoutOperationLock?.operationId !== operationId) return;
    if (operation.status === 'pending') return;
    pcbLayoutOperationLock = undefined;
}

async function waitForLocalOperation<T = unknown>(operationId: string, options: {
    pollIntervalMs?: number;
    waitMs?: number;
} = {}) {
    const pollIntervalMs = options.pollIntervalMs ?? 1000;
    const waitMs = options.waitMs ?? 60_000;
    const startedAt = Date.now();

    while (true) {
        const operation = localOperations.get(operationId);
        if (!operation) throw new Error(`Unknown operationId: ${operationId}`);
        if (operation.status !== 'pending') return localOperationResponse<T>(operation);
        if (Date.now() - startedAt >= waitMs) return localOperationResponse<T>(operation);

        await sleep(Math.min(pollIntervalMs, Math.max(0, waitMs - (Date.now() - startedAt))));
    }
}

function cancelLocalOperation(operationId: string) {
    const operation = localOperations.get(operationId);
    if (!operation) throw new Error(`Unknown operationId: ${operationId}`);

    if (operation.status === 'pending') {
        operation.controller.abort();
        operation.intermediateResult = {
            stage: 'cancelling',
            message: 'Cancellation requested. Waiting for the current cancellable stage to stop.',
        };
        return {
            status: 'cancel_requested',
            operationId,
        };
    }

    return {
        status: operation.status,
        operationId,
        error: operation.error,
    };
}

async function startAsyncTask(path: string, payload: unknown) {
    const startResponse = await fetch(`${COPILOT_SERVER_URL}${path}/start`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': SERVER_AUTHORIZATION,
        },
        body: JSON.stringify(payload),
    });

    const startData = await parseJsonResponse(startResponse);
    if (!startResponse.ok) {
        throw new Error(`Failed to start operation: ${startResponse.status} ${JSON.stringify(startData)}`);
    }

    const operationId = isRecord(startData) && typeof startData.operationId === 'string'
        ? startData.operationId
        : undefined;
    if (!operationId) throw new Error('Missing operationId');

    return operationId;
}

async function getAsyncTaskStatus<T = unknown>(path: string, operationId: string) {
    const statusResponse = await fetch(`${COPILOT_SERVER_URL}${path}/status/${encodeURIComponent(operationId)}`, {
        headers: { 'Authorization': SERVER_AUTHORIZATION },
    });
    const operation = await parseJsonResponse(statusResponse) as AsyncOperationResponse<T>;

    if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status} ${JSON.stringify(operation)}`);
    }

    return operation;
}

async function cancelAsyncTask(path: string, operationId: string) {
    const cancelResponse = await fetch(`${COPILOT_SERVER_URL}${path}/cancel/${encodeURIComponent(operationId)}`, {
        headers: { 'Authorization': SERVER_AUTHORIZATION },
    });
    const result = await parseJsonResponse(cancelResponse);

    if (!cancelResponse.ok) {
        throw new Error(`Cancel failed: ${cancelResponse.status} ${JSON.stringify(result)}`);
    }

    return result;
}

async function waitForAsyncTask<T = unknown>(path: string, operationId: string, options: {
    pollIntervalMs?: number;
    waitMs?: number;
} = {}) {
    const pollIntervalMs = options.pollIntervalMs ?? 2000;
    const waitMs = options.waitMs ?? 60_000;
    const startedAt = Date.now();
    let lastProgress = '';

    while (true) {
        const operation = await getAsyncTaskStatus<T>(path, operationId);
        const progress = asyncProgressText(operation.intermediateResult);
        if (progress && progress !== lastProgress) {
            lastProgress = progress;
            console.error(`[make_pcb_layout] ${progress}`);
        }

        if (operation.status !== 'pending') {
            return operation;
        }

        if (Date.now() - startedAt >= waitMs) {
            return operation;
        }

        await sleep(Math.min(pollIntervalMs, Math.max(0, waitMs - (Date.now() - startedAt))));
    }
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

function normalizeNetNameList(value: string | string[] | undefined) {
    return (Array.isArray(value) ? value : value ? [value] : [])
        .map(net => net.trim())
        .filter(Boolean);
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

function autoRouteLayerNameToId(layer: string) {
    if (layer === 'TOP') return 1;
    if (layer === 'BOTTOM') return 2;

    const innerMatch = /^INNER_(\d+)$/.exec(layer);
    if (innerMatch) return 14 + Number(innerMatch[1]);

    return undefined;
}

function replaceAutoRouteRuleLayers(value: unknown, selectedLayerIds: number[]) {
    if (Array.isArray(value)) {
        for (const item of value) replaceAutoRouteRuleLayers(item, selectedLayerIds);
        return;
    }

    if (!isRecord(value)) return;

    for (const [key, child] of Object.entries(value)) {
        if (key === 'layers' && Array.isArray(child) && child.every(item => typeof item === 'number')) {
            const intersection = child.filter(layer => selectedLayerIds.includes(layer));
            value[key] = intersection.length ? intersection : selectedLayerIds;
            continue;
        }

        replaceAutoRouteRuleLayers(child, selectedLayerIds);
    }
}

function filterAutoRouteInput(inputJson: unknown, ignoredNets: string[], routeLayers?: string[]) {
    const ignored = new Set(ignoredNets.map(net => net.trim()).filter(Boolean));
    const filtered = cloneJson(inputJson);
    let removedTopLevelNets = 0;
    const routeLayerIds = routeLayers
        ?.map(layer => autoRouteLayerNameToId(layer))
        .filter((id): id is number => typeof id === 'number');

    if (routeLayers?.length && routeLayerIds?.length !== routeLayers.length) {
        throw new Error(`Auto route layers must be copper signal layers: ${routeLayers.join(', ')}`);
    }

    if (isRecord(filtered) && Array.isArray(filtered.nets)) {
        const nets = filtered.nets as AutoRouteInputNet[];
        filtered.nets = nets.filter(netRule => {
            const netName = typeof netRule?.net === 'string' ? netRule.net : '';
            if (!ignored.has(netName)) return true;
            removedTopLevelNets++;
            return false;
        });
    }

    if (isRecord(filtered) && routeLayerIds?.length) {
        const layers = isRecord(filtered.layers) ? filtered.layers : {};
        const previousRoute = Array.isArray(layers.route) ? layers.route.filter(item => typeof item === 'number') : [];
        layers.route = routeLayerIds;
        layers.notRoute = previousRoute.filter(layer => !routeLayerIds.includes(layer));
        filtered.layers = layers;
        replaceAutoRouteRuleLayers(filtered.rules, routeLayerIds);
        replaceAutoRouteRuleLayers(filtered.classes, routeLayerIds);
    }

    return { filtered, removedTopLevelNets, routeLayerIds };
}

function summarizeAutoRouteResult(result: Record<string, unknown>, paths: {
    inputPath: string;
    filteredInputPath: string;
    resultPath: string;
}, ignoredNets: string[], removedTopLevelNets: number, routeLayers?: string[], routeLayerIds?: number[]): AutoRouteRunSummary {
    return {
        ...paths,
        ignoredNets,
        routeLayers,
        routeLayerIds,
        removedTopLevelNets,
        progress: typeof result.progress === 'number' ? result.progress : undefined,
        routabitity: typeof result.routabitity === 'number' ? result.routabitity : undefined,
        traces: Array.isArray(result.traces) ? result.traces.length : 0,
        vias: Array.isArray(result.vias) ? result.vias.length : 0,
    };
}

function autoRouteProgressText(intermediate: unknown) {
    if (!isRecord(intermediate)) return undefined;
    if (typeof intermediate.message === 'string') return intermediate.message;

    const stage = typeof intermediate.stage === 'string' ? intermediate.stage : undefined;
    const progress = typeof intermediate.progress === 'number' && Number.isFinite(intermediate.progress)
        ? Math.round(intermediate.progress * 100)
        : undefined;

    if (stage && typeof progress === 'number') return `${stage}: ${progress}%`;
    return stage;
}

async function runAutoRouteOnCurrentPcbDoc(input: AutoRouteToolInput, context: LocalOperationContext): Promise<AutoRouteToolResult> {
    const { signal, setProgress } = context;

    await mkdir(TEMP_DIR, { recursive: true });
    const runId = randomUUID().slice(0, 6);
    const inputPath = join(TEMP_DIR, `autoroute-input-${runId}.json`);
    const filteredInputPath = join(TEMP_DIR, `autoroute-input-filtered-${runId}.json`);
    const resultPath = join(TEMP_DIR, `autoroute-result-${runId}.json`);

    assertOperationNotCancelled(signal);
    setProgress({ stage: 'exporting' });
    const exported = await requestEasyEda('export-pcb-autoroute-json', {}, 300000) as { text?: unknown };
    assertOperationNotCancelled(signal);

    const inputText = typeof exported.text === 'string' ? exported.text : '';
    if (!inputText) throw new Error('EasyEDA returned empty autoroute JSON.');

    await writeFile(inputPath, inputText);
    const inputJson = parseJsonText(inputText, 'EasyEDA autoroute input');
    const ignoredNets = input.ignore_nets.map(net => net.trim()).filter(Boolean);
    const { filtered, removedTopLevelNets, routeLayerIds } = filterAutoRouteInput(inputJson, ignoredNets, input.route_layers);
    await writeFile(filteredInputPath, JSON.stringify(filtered, null, 2));

    assertOperationNotCancelled(signal);
    setProgress({ stage: 'routing', progress: 0 });
    let lastProgress = 0;
    const result = await runEasyEdaAutoRouter(filtered, {
        routerDir: input.router_dir,
        timeoutMs: input.timeout_sec * 1000,
        signal,
        onProgress: progress => {
            lastProgress = Math.max(lastProgress, progress);
            setProgress({ stage: 'routing', progress: lastProgress });
        },
    }) as Record<string, unknown>;

    if (Number(result.progress ?? 0) < 1) {
        throw new Error(`Auto router did not finish. Last progress: ${lastProgress}`);
    }

    await writeFile(resultPath, JSON.stringify(result, null, 2));

    assertOperationNotCancelled(signal);
    setProgress({ stage: 'importing' });
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

    return {
        content: 'Auto route imported into EasyEDA.',
        ...summarizeAutoRouteResult(result, { inputPath, filteredInputPath, resultPath }, ignoredNets, removedTopLevelNets, input.route_layers, routeLayerIds),
        importResult,
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

async function writePreviewImageFiles(previewImage: string | undefined, layoutId: string) {
    if (!previewImage) return {};

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

    let svgPath: string | undefined;
    if (isSvgImage(sourceBytes, mimeType)) {
        svgPath = join(previewDir, `${layoutId}.svg`);
        await writeFile(svgPath, sourceBytes);
    }

    const { bytes, extension } = await renderPreviewImage(sourceBytes, mimeType);
    const pngPath = join(previewDir, `${layoutId}${extension}`);
    await writeFile(pngPath, bytes);

    return { pngPath, svgPath };
}

function safeFileSegment(value: string) {
    return value.replace(/[^a-z0-9_.-]+/gi, '_').replace(/^_+|_+$/g, '') || 'unnamed';
}

function decodeSvgPayload(value: string | undefined) {
    if (!value) return undefined;

    const dataUrlMatch = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value);
    if (!dataUrlMatch) {
        return value.trimStart().startsWith('<svg') ? Buffer.from(value, 'utf8') : undefined;
    }

    const isBase64 = Boolean(dataUrlMatch[2]);
    const payload = dataUrlMatch[3] ?? '';
    return isBase64
        ? Buffer.from(payload, 'base64')
        : Buffer.from(decodeURIComponent(payload), 'utf8');
}

async function writePlacementDebugArtifactFiles(artifacts: PlacementDebugArtifactsResponse | undefined, layoutId: string): Promise<SavedPlacementDebugArtifacts> {
    const items = artifacts?.items?.filter(item => item && typeof item.name === 'string' && typeof item.type === 'string') ?? [];
    if (!items.length) return {};

    const debugArtifactsDir = join(tmpdir(), 'easyeda-copilot-mcp', 'pcb-layout-debug', layoutId);
    const saved: SavedPlacementDebugArtifact[] = [];

    for (const item of items) {
        const svgBytes = decodeSvgPayload(item.svg_url ?? item.svg);
        if (!svgBytes) continue;

        const type = safeFileSegment(item.type!);
        const name = safeFileSegment(item.fileName ?? item.name!);
        const dir = join(debugArtifactsDir, type);
        const path = join(dir, `${name}.svg`);
        await mkdir(dir, { recursive: true });
        await writeFile(path, svgBytes);
        saved.push({
            type: item.type!,
            name: item.name!,
            components: Array.isArray(item.components) ? item.components : [],
            path,
        });
    }

    if (!saved.length) return {};

    const indexPath = join(debugArtifactsDir, 'index.json');
    await mkdir(debugArtifactsDir, { recursive: true });
    await writeFile(indexPath, JSON.stringify(saved, null, 2));

    return {
        debugArtifactsDir,
        debugArtifactsIndexPath: indexPath,
        debugArtifacts: saved,
    };
}

function rememberPcbLayout(layoutId: string, layout: StoredPcbLayout) {
    storedPcbLayouts.set(layoutId, layout);

    if (storedPcbLayouts.size <= 25) return;

    const oldest = [...storedPcbLayouts.entries()]
        .sort((a, b) => a[1].createdAt - b[1].createdAt)
        .at(0)?.[0];

    if (oldest) storedPcbLayouts.delete(oldest);
}

async function storeMakePcbLayoutResult(result: MakePcbLayoutResponse) {
    const runId = randomUUID();
    const layoutId = result.pcb ? runId : undefined;
    const { pngPath: previewImagePath, svgPath: previewSvgPath } = await writePreviewImageFiles(result.preview_image_url, runId);
    const debugArtifacts = await writePlacementDebugArtifactFiles(result.placement_debug_artifacts, runId);

    if (result.pcb && layoutId) {
        rememberPcbLayout(layoutId, {
            pcb: result.pcb,
            content: result.content,
            toolReport: result.toolReport,
            previewImagePath,
            previewSvgPath,
            debugArtifactsDir: debugArtifacts.debugArtifactsDir,
            debugArtifacts: debugArtifacts.debugArtifacts,
            createdAt: Date.now(),
        });
    }

    return {
        layoutId,
        previewImagePath,
        previewSvgPath,
        ...debugArtifacts,
    };
}

async function formatPcbLayoutOperationResult(operationId: string, operation: AsyncOperationResponse<MakePcbLayoutResponse>) {
    if (operation.status === 'completed') {
        if (!operation.result) {
            return textResult({
                status: 'error',
                operationId,
                error: 'PCB layout operation completed without result.',
            });
        }

        const report = {
            operationId,
            status: 'completed',
            ...await storeMakePcbLayoutResult(operation.result),
        };

        const lines = [
            operation.result.content ?? operation.result.error ?? 'PCB layout finished.',
            `Run report:\n${JSON.stringify(report, null, 2)}`,
        ];

        return textResult(lines.join('\n\n'));
    }

    if (operation.status === 'failed' || operation.status === 'cancelled') {
        return textResult({
            status: operation.status,
            operationId,
            error: operation.error ?? `PCB layout operation ${operation.status}.`,
        });
    }

    return textResult({
        status: 'pending',
        operationId,
        progress: asyncProgressText(operation.intermediateResult),
        progressDetails: operation.intermediateResult,
        message: 'PCB layout is still running. Call wait_pcb_layout with this operationId.',
        nextTool: 'wait_pcb_layout',
    });
}

function formatAutoRouteOperationResult(operationId: string, operation: AsyncOperationResponse<AutoRouteToolResult>) {
    if (operation.status === 'completed') {
        if (!operation.result) {
            return textResult({
                status: 'error',
                operationId,
                error: 'Auto route operation completed without result.',
            });
        }

        return textResult({
            operationId,
            status: 'completed',
            ...operation.result,
        });
    }

    if (operation.status === 'failed' || operation.status === 'cancelled') {
        return textResult({
            status: operation.status,
            operationId,
            error: operation.error ?? `Auto route operation ${operation.status}.`,
        });
    }

    return textResult({
        status: 'pending',
        operationId,
        progress: autoRouteProgressText(operation.intermediateResult),
        message: 'Auto route is still running. Call wait_auto_route_on_current_pcbdoc with this operationId.',
        nextTool: 'wait_auto_route_on_current_pcbdoc',
    });
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
    'list_easyeda_instances',
    {
        title: 'List EasyEDA Instances',
        description: 'List currently connected EasyEDA Copilot extension instances. Use this when more than one EasyEDA window/project may be open.',
        inputSchema: z.object({}),
    },
    async () => {
        if (!bridge) throw new Error('EasyEDA bridge is not initialized yet.');
        const selected = await bridge.getSelectedEasyEdaInstance();
        return textResult({
            selected,
            instances: await bridge.listEasyEdaInstances(),
        });
    },
);

server.registerTool(
    'select_easyeda_instance',
    {
        title: 'Select EasyEDA Instance',
        description: 'Select which connected EasyEDA project this MCP process should use when multiple EasyEDA instances are connected.',
        inputSchema: z.object({
            instanceId: z.string().min(1).describe('instanceId returned by list_easyeda_instances.'),
        }),
    },
    async ({ instanceId }) => {
        if (!bridge) throw new Error('EasyEDA bridge is not initialized yet.');
        const selected = await bridge.selectEasyEdaInstance(instanceId);
        return textResult({
            selected,
        });
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
        const circuit = await requestEasyEda('get-multi-page-schematic', {
            extractFootprintUuid: true
        });
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
        description: `Create PCB component placement from the current EasyEDA schematic using JavaScript PCB layout DSL code. Starts a long-running server operation, waits up to 60 seconds, then returns either the finished layoutId/preview or an operationId for wait_pcb_layout. Server-side routing is disabled: route the assembled PCB later in EasyEDA/client tools. This tool does not assemble the board. For PCB layout docs, read the local docs folder: ${SKILL_DOC_PATH}`,
        inputSchema: z.object({
            file: z.string().min(1).describe('Path to a JavaScript PCB layout DSL code file.'),
            wait_ms: z.number().min(30_000).max(180000).default(DEFAULT_PCB_LAYOUT_WAIT_MS).describe('How long this call may wait for completion. Default: 60000ms.'),
        }).refine(data => Boolean(data.file), {
            message: 'Fill one: code, file.',
        }),
    },
    async (input) => {
        await assertNoPendingPcbLayoutOperation();
        assertNoPendingLocalOperation(
            AUTO_ROUTE_OPERATION_LABEL,
            'run_auto_route_on_current_pcbdoc',
            'wait_auto_route_on_current_pcbdoc',
        );
        pcbLayoutOperationLock = { startedAt: Date.now() };

        let operationId: string | undefined;
        let operation: AsyncOperationResponse<MakePcbLayoutResponse>;

        try {
            const code = await readLayoutCode(input);
            const circuit = await requestEasyEda('get-multi-page-schematic', {
                extractFootprintUuid: true
            });

            operationId = await startAsyncTask(PCB_LAYOUT_TASK_PATH, {
                code,
                circuit,
            });
            pcbLayoutOperationLock.operationId = operationId;

            operation = await waitForAsyncTask<MakePcbLayoutResponse>(PCB_LAYOUT_TASK_PATH, operationId, {
                pollIntervalMs: 2000,
                waitMs: input.wait_ms ?? DEFAULT_PCB_LAYOUT_WAIT_MS,
            });
            releasePcbLayoutLockIfFinished(operationId, operation);
        } catch (error) {
            if (!operationId) pcbLayoutOperationLock = undefined;
            throw error;
        }

        return await formatPcbLayoutOperationResult(operationId, operation);
    },
);

server.registerTool(
    'wait_pcb_layout',
    {
        title: 'Wait PCB Layout',
        description: 'Wait for a previously started make_pcb_layout operation. Use operationId returned by make_pcb_layout when it says the layout is still running.',
        inputSchema: z.object({
            operationId: z.string().min(1).describe('operationId returned by make_pcb_layout.'),
            wait_ms: z.number().min(30_000).max(180000).default(DEFAULT_PCB_LAYOUT_WAIT_MS).describe('How long this call may wait for completion. Default: 60000ms.'),
        }),
    },
    async ({ operationId, wait_ms }) => {
        const operation = await waitForAsyncTask<MakePcbLayoutResponse>(PCB_LAYOUT_TASK_PATH, operationId, {
            pollIntervalMs: 2000,
            waitMs: wait_ms ?? DEFAULT_PCB_LAYOUT_WAIT_MS,
        });
        releasePcbLayoutLockIfFinished(operationId, operation);

        return await formatPcbLayoutOperationResult(operationId, operation);
    },
);

server.registerTool(
    'cancel_pcb_layout',
    {
        title: 'Cancel PCB Layout',
        description: 'Cancel a previously started make_pcb_layout operation by operationId.',
        inputSchema: z.object({
            operationId: z.string().min(1).describe('operationId returned by make_pcb_layout.'),
        }),
    },
    async ({ operationId }) => {
        const result = await cancelAsyncTask(PCB_LAYOUT_TASK_PATH, operationId);
        await getAsyncTaskStatus<MakePcbLayoutResponse>(PCB_LAYOUT_TASK_PATH, operationId)
            .then(operation => releasePcbLayoutLockIfFinished(operationId, operation))
            .catch(() => undefined);
        return textResult({
            status: 'cancel_requested',
            operationId,
            result,
        });
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
        description: 'Export the current EasyEDA PCB autoroute JSON, run the bundled custom router on the MCP side, import the routed result back into EasyEDA, then rebuild GND pours and add GND suture vias. Starts a long-running local operation, waits up to 60 seconds, then returns either the finished result or an operationId for wait_auto_route_on_current_pcbdoc. This tool does not clear existing tracks/vias before routing and does not route nets that are already routed in EasyEDA autoroute export; call clear_routing first when old routing should be replaced. Open the target PCB document first.',
        inputSchema: AutoRouteInputSchema,
    },
    async (input) => {
        await assertNoPendingPcbLayoutOperation();
        assertNoPendingLocalOperation(
            AUTO_ROUTE_OPERATION_LABEL,
            'run_auto_route_on_current_pcbdoc',
            'wait_auto_route_on_current_pcbdoc',
        );
        const operationId = startLocalOperation<AutoRouteToolResult>(
            AUTO_ROUTE_OPERATION_LABEL,
            context => runAutoRouteOnCurrentPcbDoc(input, context),
        );
        const operation = await waitForLocalOperation<AutoRouteToolResult>(operationId, {
            pollIntervalMs: 1000,
            waitMs: input.wait_ms ?? DEFAULT_AUTO_ROUTE_WAIT_MS,
        });

        return formatAutoRouteOperationResult(operationId, operation);
    },
);

server.registerTool(
    'clear_routing',
    {
        title: 'Clear PCB Routing',
        description: 'Delete existing PCB routing primitives from the currently opened EasyEDA PCB document: tracks, arcs, polylines, pours, fills, regions, and vias. Board outline is preserved. Use before run_auto_route_on_current_pcbdoc when old routing should be replaced.',
        inputSchema: z.object({
            ignoreToClearNet: NetNameListSchema.describe('Net name or net names to preserve while clearing routing, e.g. "GND" or ["GND"].'),
            clearOnlyNet: NetNameListSchema.describe('If set, clear only this net name or these net names. ignoreToClearNet still excludes matching nets.'),
        }),
    },
    async ({ ignoreToClearNet, clearOnlyNet }) => {
        const result = await requestEasyEda('clear-pcb-routing', {
            ignoreToClearNet: normalizeNetNameList(ignoreToClearNet),
            clearOnlyNet: normalizeNetNameList(clearOnlyNet),
        }, 300000);
        return textResult(result);
    },
);

server.registerTool(
    'wait_auto_route_on_current_pcbdoc',
    {
        title: 'Wait PCB Auto Router',
        description: 'Wait for a previously started run_auto_route_on_current_pcbdoc operation. Use operationId returned by run_auto_route_on_current_pcbdoc when it says the auto route is still running.',
        inputSchema: z.object({
            operationId: z.string().min(1).describe('operationId returned by run_auto_route_on_current_pcbdoc.'),
            wait_ms: z.number().min(30_000).max(180000).default(DEFAULT_AUTO_ROUTE_WAIT_MS).describe('How long this call may wait for completion. Default: 60000ms.'),
        }),
    },
    async ({ operationId, wait_ms }) => {
        const operation = await waitForLocalOperation<AutoRouteToolResult>(operationId, {
            pollIntervalMs: 1000,
            waitMs: wait_ms ?? DEFAULT_AUTO_ROUTE_WAIT_MS,
        });

        return formatAutoRouteOperationResult(operationId, operation);
    },
);

server.registerTool(
    'cancel_auto_route_on_current_pcbdoc',
    {
        title: 'Cancel PCB Auto Router',
        description: 'Cancel a previously started run_auto_route_on_current_pcbdoc operation by operationId. Cancellation stops before import if possible; if import already started, the board may still be updated.',
        inputSchema: z.object({
            operationId: z.string().min(1).describe('operationId returned by run_auto_route_on_current_pcbdoc.'),
        }),
    },
    async ({ operationId }) => {
        return textResult(cancelLocalOperation(operationId));
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
    'get_pcb_stack_layers',
    {
        title: 'Get PCB Stack Layers',
        description: 'Return the current PCB copper layer count and active signal routing layers. Open the target PCB document first. Use before choosing route_layers for run_auto_route_on_current_pcbdoc.',
        inputSchema: z.object({}),
    },
    async () => {
        const result = await requestEasyEda('get-pcb-stack-layers');
        return textResult(result);
    },
);

server.registerTool(
    'set_pcb_copper_layer_count',
    {
        title: 'Set PCB Copper Layer Count',
        description: 'Set the number of copper layers in the currently opened PCB document. This changes the PCB stack; use get_pcb_stack_layers afterwards to verify available routing layers.',
        inputSchema: z.object({
            count: z.union([
                z.literal(2),
                z.literal(4),
                z.literal(6),
                z.literal(8),
                z.literal(10),
                z.literal(12),
                z.literal(14),
                z.literal(16),
                z.literal(18),
                z.literal(20),
                z.literal(22),
                z.literal(24),
                z.literal(26),
                z.literal(28),
                z.literal(30),
                z.literal(32),
            ]).describe('Allowed copper layer count. EasyEDA supports even counts from 2 to 32.'),
        }),
    },
    async ({ count }) => {
        const result = await requestEasyEda('set-pcb-copper-layer-count', { count }, 300000);
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
    bridge = await startBridge({
        host: MCP_WS_HOST,
        port: MCP_WS_PORT,
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // console.error(`EasyEDA Copilot MCP Server running on stdio. Server URL: ${COPILOT_SERVER_URL}`);
}

main().catch(() => {
    // console.error('Fatal error in main():', error);
    process.exit(1);
});
