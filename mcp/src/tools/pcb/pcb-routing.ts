import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import * as z from 'zod/v4';
import { Bridge } from "../../bridge";
import { PcbLayerNameSchema } from "@copilot/shared/types/pcb/shared";
import { textResult } from "../../utils/tool-result";
import { mkdir, writeFile } from "node:fs/promises";
import { runEasyEdaAutoRouter } from "../../autorouter/autorouter";
import { randomUUID } from "node:crypto";
import { TEMP_DIR } from "../../utils/dirs";
import { join } from "node:path";
import { AsyncOperationResponse } from "../../utils/server";
import { isRecord, sleep } from "../../utils/utils";

const DEFAULT_AUTO_ROUTE_WAIT_MS = 60_000;
const AUTO_ROUTE_OPERATION_LABEL = 'run_auto_route_on_current_pcbdoc';

function operationErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : JSON.stringify(error);
}

const LOCAL_OPERATION_LIMIT = 10;

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

type LocalOperation<T = unknown> = AsyncOperationResponse<T> & {
    label: string;
    controller: AbortController;
};

type LocalOperationContext = {
    signal: AbortSignal;
    setProgress: (intermediateResult: unknown) => void;
};

const localOperations = new Map<string, LocalOperation<unknown>>();

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

function parseJsonText(text: string, label: string) {
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`${label} is not valid JSON: ${(error as Error).message}`);
    }
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

function filterAutoRouteInput(inputJson: unknown, ignoredNets: string[], routeLayers?: string[]) {
    const ignored = new Set(ignoredNets.map(net => net.trim()).filter(Boolean));
    const filtered = JSON.parse(JSON.stringify(inputJson));
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

async function runAutoRouteOnCurrentPcbDoc(bridge: Bridge, input: AutoRouteToolInput, context: LocalOperationContext): Promise<AutoRouteToolResult> {
    const { signal, setProgress } = context;

    await mkdir(TEMP_DIR, { recursive: true });
    const runId = randomUUID().slice(0, 6);
    const inputPath = join(TEMP_DIR, `autoroute-input-${runId}.json`);
    const filteredInputPath = join(TEMP_DIR, `autoroute-input-filtered-${runId}.json`);
    const resultPath = join(TEMP_DIR, `autoroute-result-${runId}.json`);

    assertOperationNotCancelled(signal);
    setProgress({ stage: 'exporting' });
    const exported = await bridge.requestEasyEda('export-pcb-autoroute-json', {}, 300000) as { text?: unknown };
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
    const importResult = await bridge.requestEasyEda('import-pcb-autoroute-json', {
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

export function registerPcbRoutingTools(server: McpServer, bridge: Bridge) {
    server.registerTool(
        'run_auto_route_on_current_pcbdoc',
        {
            title: 'Run PCB Auto Router',
            description: 'Export the current EasyEDA PCB autoroute JSON, run the bundled custom router on the MCP side, import the routed result back into EasyEDA, then rebuild GND pours and add GND suture vias. Starts a long-running local operation, waits up to 60 seconds, then returns either the finished result or an operationId for wait_auto_route_on_current_pcbdoc. This tool does not clear existing tracks/vias before routing and does not route nets that are already routed in EasyEDA autoroute export; call clear_routing first when old routing should be replaced. Open the target PCB document first.',
            inputSchema: AutoRouteInputSchema,
        },
        async (input) => {
            const operationId = startLocalOperation<AutoRouteToolResult>(
                AUTO_ROUTE_OPERATION_LABEL,
                context => runAutoRouteOnCurrentPcbDoc(bridge, input, context),
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
            const result = await bridge.requestEasyEda('clear-pcb-routing', {
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
}