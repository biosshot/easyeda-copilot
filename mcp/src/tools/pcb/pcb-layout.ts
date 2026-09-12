import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import * as z from 'zod/v4';
import { Bridge } from "../../bridge";
import { textResult } from "../../utils/tool-result";
import { makePcbLayout as generatePcbLayout, getPcbComponentSizes } from "eda-copilot-backend/pcb";
import type { BoardAssemble as BackendBoardAssemble } from "eda-copilot-backend/types";
import { BoardAssemble } from "@copilot/shared/types/pcb/board-assemble";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from 'sharp';
import { SKILL_DOC_PATH } from "../../utils/dirs";
import { operationManager, type OperationContext } from '../../operations/manager';
import type { ExplainCircuit } from '@copilot/shared/types/circuit';

type MakePcbLayoutResponse = {
    content?: string;
    toolReport?: unknown;
    pcb?: BackendBoardAssemble;
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
    pcb: BackendBoardAssemble;
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

const DEFAULT_PCB_LAYOUT_WAIT_MS = 30_000;
const PCB_DOCUMENT_RESOURCE = 'current-pcb-document';

const storedPcbLayouts = new Map<string, StoredPcbLayout>();

const ExistingPlacementSchema = z.object({
    board: z.object({
        polygon: z.array(z.object({
            x: z.number(),
            y: z.number(),
        }).strict()).min(3),
    }).strict(),
    components: z.array(z.object({
        designator: z.string().min(1),
        x: z.number(),
        y: z.number(),
        rotate: z.number(),
        layer: z.enum(['top', 'bottom']),
    }).strict()),
}).strict();

type ExistingPlacement = z.infer<typeof ExistingPlacementSchema>;

function placementForCircuit(value: unknown, circuit: ExplainCircuit): ExistingPlacement | undefined {
    if (value === undefined || value === null) return undefined;
    const placement = ExistingPlacementSchema.parse(value);
    const circuitDesignators = new Map(circuit.components.map(component => [
        component.designator.trim().toUpperCase(),
        component.designator,
    ]));
    const seen = new Set<string>();
    const components = placement.components.flatMap(component => {
        const key = component.designator.trim().toUpperCase();
        const designator = circuitDesignators.get(key);
        if (!designator) return [];
        if (seen.has(key)) throw new Error(`Ambiguous EasyEDA PCB designator: ${designator}`);
        seen.add(key);
        return [{ ...component, designator }];
    });

    return { board: placement.board, components };
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

async function runPcbLayout(
    bridge: Bridge,
    file: string,
    context: OperationContext,
) {
    context.setStage('preparing');
    // Capture placement before schematic extraction changes the active EasyEDA document.
    const [code, rawExistingPlacement] = await Promise.all([
        readFile(file, 'utf8'),
        bridge.requestEasyEda('get-pcb-existing-placement'),
    ]);
    const circuit = await bridge.requestEasyEda(
        'get-multi-page-schematic',
        { extractFootprintUuid: true },
    ) as ExplainCircuit;
    const existingPlacement = placementForCircuit(rawExistingPlacement, circuit);
    context.signal.throwIfAborted();

    context.setStage('placing');
    const result = await generatePcbLayout({
        code, circuit, ...(existingPlacement ? { existingPlacement } : {}),
    }, {
        signal: context.signal,
        onProgress: progress => context.setProgress({
            message: progress.content, details: progress,
        }),
    });
    context.signal.throwIfAborted();
    context.setStage('storing_result');
    const stored = await storeMakePcbLayoutResult(result);
    return {
        status: 'completed' as const,
        operation_id: context.id,
        ...stored,
        content: result.content ?? 'PCB layout finished.',
    };
}

function toEasyEdaBoardAssemble(board: BackendBoardAssemble): BoardAssemble {
    // The extension's existing wire format stores relative hole offsets as x/y.
    return {
        ...board,
        ...(board.pads ? {
            pads: board.pads.map(pad => ({
                ...pad,
                ...(pad.hole ? {
                    hole: { diameter: pad.hole.diameter, ...pad.hole.offset },
                } : {}),
            })),
        } : {}),
    };
}

async function makePcbLayout(bridge: Bridge, file: string, waitMs: number) {
    const operationId = operationManager.start(
        'pcb-layout',
        context => runPcbLayout(bridge, file, context),
        { resource: PCB_DOCUMENT_RESOURCE },
    );
    return operationManager.wait(operationId, waitMs);
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
            }) as ExplainCircuit;
            const result = await getPcbComponentSizes({
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
            description: `Create PCB component placement from a JavaScript DSL file. Open the target PCB first so its outline and component positions are supplied as existingPlacement. Long work returns an operation_id for wait_operation. This tool does not assemble or route the board. For PCB layout docs, read: ${SKILL_DOC_PATH}`,
            inputSchema: z.object({
                file: z.string().min(1).describe('Path to a JavaScript PCB layout DSL code file.'),
                wait_ms: z.number().int().min(1_000).max(55_000).default(DEFAULT_PCB_LAYOUT_WAIT_MS)
                    .describe('Initial synchronous wait before returning a pcb-layout operation_id.'),
            }),
        },
        async ({ file, wait_ms }) => textResult(await makePcbLayout(
            bridge,
            file,
            wait_ms ?? DEFAULT_PCB_LAYOUT_WAIT_MS,
        )),
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
                boardAssemble: toEasyEdaBoardAssemble(layout.pcb),
            }, 300000);

            return textResult({
                content: 'PCB layout sent to EasyEDA for assembly.',
                layoutId,
            });
        },
    );
}
