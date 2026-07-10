import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import * as z from 'zod/v4';
import { Bridge } from "../../bridge";
import { textResult } from "../../utils/tool-result";
import { AsyncOperationResponse, asyncProgressText, cancelAsyncTask, getAsyncTaskStatus, postJson, startAsyncTask, waitForAsyncTask } from "../../utils/server";
import { BoardAssemble } from "@copilot/shared/types/pcb/board-assemble";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from 'sharp';
import { SKILL_DOC_PATH } from "../../utils/dirs";

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
    // type: string;
    name: string;
    // components: string[];
    path: string;
};

type SavedPlacementDebugArtifacts = {
    debugArtifactsDir?: string;
    debugArtifactsIndexPath?: string;
    debugArtifacts?: SavedPlacementDebugArtifact[];
};

const PCB_LAYOUT_TASK_PATH = '/v1/mcp-tools/make-pcb-layout';
const DEFAULT_PCB_LAYOUT_WAIT_MS = 60_000;

const storedPcbLayouts = new Map<string, StoredPcbLayout>();

let pcbLayoutOperationLock: {
    operationId?: string;
    startedAt: number;
} | undefined;


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

        const stored = await storeMakePcbLayoutResult(operation.result);

        const report = {
            operationId,
            status: 'completed',
            ...stored,
            debugArtifactsDir: undefined,
            debugArtifactsIndexPath: undefined
        };

        const lines = [
            operation.result.content ?? operation.result.error ?? 'PCB layout finished.',
            `Run report:\n${JSON.stringify(report)}`,
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
            // type: item.type!,
            name: item.name!,
            // components: Array.isArray(item.components) ? item.components : [],
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

export function registerPcbLayoutTools(server: McpServer, bridge: Bridge) {

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
            const circuit = await bridge.requestEasyEda('get-multi-page-schematic', {
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
            pcbLayoutOperationLock = { startedAt: Date.now() };

            let operationId: string | undefined;
            let operation: AsyncOperationResponse<MakePcbLayoutResponse>;

            try {
                const code = await readFile(input.file, 'utf8');
                const circuit = await bridge.requestEasyEda('get-multi-page-schematic', {
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

            await bridge.requestEasyEda('assemble-board', {
                boardAssemble: layout.pcb,
            }, 300000);

            return textResult({
                content: 'PCB layout sent to EasyEDA for assembly.',
                layoutId,
            });
        },
    );
}