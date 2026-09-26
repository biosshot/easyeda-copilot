import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import * as z from 'zod/v4';
import { Bridge } from "../bridge";
import { textResult } from "../utils/tool-result";
import { componentSearch, libraryList, searchReusedBlock } from "eda-copilot-backend/components";
import type { Component } from "eda-copilot-backend/components";
import { extractCircuit } from "eda-copilot-backend/schematic";
import { SKILL_DOC_PATH } from "../utils/dirs";
import { readFile } from "node:fs/promises";
import { CircuitAssembly, CircuitMod, CircuitModStruct, ExplainCircuit } from "@copilot/shared/types/circuit";
import { managedMutationHandler, toolHandler } from './handler';
import { isMissingPartUuid, PartUuidStruct } from '@copilot/shared/types/lcsc';
import { createComponentPreview, needsSymbolPreview } from '../utils/component-preview';
import { readOtherPageSignals } from '../utils/other-page-signals';

type SchematicBlocks = Record<string, string[]>;

function baseDesignator(value: string) {
    return value.trim().replace(/\.\d+$/, '');
}

function selectedBlocks(blocks: SchematicBlocks) {
    const selected = new Map<string, string>();

    for (const [rawBlockName, designators] of Object.entries(blocks)) {
        const blockName = rawBlockName.trim();
        if (!blockName) throw new Error('Block name must not be empty.');
        if (!designators.length) throw new Error(`Block has no components: ${blockName}`);

        for (const rawDesignator of designators) {
            const designator = baseDesignator(rawDesignator);
            if (!designator) throw new Error(`Empty component designator in block: ${blockName}`);
            if (selected.has(designator)) {
                throw new Error(`Component appears in multiple blocks: ${designator}`);
            }
            selected.set(designator, blockName);
        }
    }

    if (!selected.size) throw new Error('Blocks must contain at least one component.');
    return selected;
}

function serverAssembly(response: unknown) {
    const record = typeof response === 'object' && response !== null
        ? response as Record<string, unknown>
        : undefined;
    return (record?.circuit || response) as CircuitAssembly;
}

function sheetSpaceNotice(response: unknown) {
    const record = typeof response === 'object' && response !== null
        ? response as Record<string, unknown>
        : undefined;
    const sheetSpace = typeof record?.sheetSpace === 'object' && record.sheetSpace !== null
        ? record.sheetSpace as Record<string, unknown>
        : undefined;
    const freePercent = sheetSpace?.freePercent;
    if (typeof freePercent !== 'number' || !Number.isFinite(freePercent)) return undefined;
    if (sheetSpace?.fitsWithinPage === false) {
        return {
            freePercent,
            fitsWithinPage: false,
            level: 'warning',
            message: 'The schematic overlaps the drawing frame or title block; increase the sheet size or adjust the layout.',
        };
    }
    const low = freePercent < 10;
    return {
        freePercent,
        level: low ? 'warning' : 'info',
        message: low
            ? `${freePercent}% of the current schematic sheet remains available. Consider continuing on another sheet.`
            : `${freePercent}% of the current schematic sheet remains available.`,
    };
}

export function registerCircuitTools(server: McpServer, bridge: Bridge) {
    server.registerTool(
        'library_list',
        {
            title: 'List EasyEDA Component Libraries',
            description: 'List component libraries supported by the backend. Explicit public library UUIDs are also accepted by component_search.',
            annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
            inputSchema: z.object({}),
        },
        toolHandler(bridge, async () => textResult(libraryList())),
    );

    server.registerTool(
        'component_search',
        {
            title: 'Search EasyEDA Component',
            description: 'Search EasyEDA devices. library_uuid defaults to lcsc; use library_list to discover aliases. Search results include a ready-to-use part_uuid. Components with any ambiguous pin name may have preview_recommended and a local preview_image_path. Skip preview for one-pin parts, ordinary two-pin resistors, simple inductors and fuses, and parts with clear pin names. Capacitors are not exempt. Inspect only the selected uncertain candidate; do not review every result or repeat a completed review. Rendering failures leave the component in the result with preview_error.',
            annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
            inputSchema: z.object({
                part_uuid: PartUuidStruct().nullable().optional(),
                MPN: z.string().nullable().optional(),
                library_uuid: z.string().min(1).default('lcsc')
                    .describe('Library alias or explicit public library UUID. Defaults to lcsc.'),
            }),
        },
        toolHandler(bridge, async ({ part_uuid, MPN, library_uuid }) => {
            if (!part_uuid && !MPN) {
                return textResult('Fill one: part_uuid or MPN');
            }

            const result = await componentSearch({ part_uuid, MPN, library_uuid });
            const annotate = async (component: Component) => {
                const preview_recommended = needsSymbolPreview(component);
                if (!preview_recommended) return component;
                try {
                    const preview = await createComponentPreview(component.part_uuid);
                    return { ...component, preview_recommended, preview_image_path: preview.image_path };
                } catch (error) {
                    return {
                        ...component,
                        preview_recommended,
                        preview_error: error instanceof Error ? error.message : String(error),
                    };
                }
            };
            const components = 'components' in result
                ? await Promise.all((result.components as Component[]).map(annotate))
                : undefined;
            const bestComponent = result.bestComponent ? await annotate(result.bestComponent) : result.bestComponent;
            return textResult({
                ...result,
                ...(components ? { components } : {}),
                bestComponent,
            });
        }),
    );

    server.registerTool(
        'preview_component',
        {
            title: 'Preview EasyEDA Component Symbol',
            description: 'Render every section of an EasyEDA library schematic symbol with visible pin numbers. Returns only image_path for the generated PNG; no image is attached.',
            annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
            inputSchema: z.object({
                part_uuid: PartUuidStruct().describe('Ready-to-use part_uuid from component_search.'),
            }),
        },
        toolHandler(bridge, async ({ part_uuid }) => {
            const preview = await createComponentPreview(part_uuid);
            return textResult({ image_path: preview.image_path });
        }),
    );

    // server.registerTool(
    //     'search_reused_block',
    //     {
    //         title: 'Search Reused Block',
    //         description: `Search pre-assembled reusable circuit blocks. For circuit workflow docs, read: ${SKILL_DOC_PATH}`,
    //         inputSchema: z.object({
    //             query: z.string().describe('Query example: "3.3V power regulator"'),
    //             page: z.number().min(1).default(1).describe('Current results page.'),
    //             limit: z.number().min(1).max(25).default(10).describe('Number of results per page.'),
    //         }),
    //     },
    //     async ({ query, page, limit }) => {
    //         const result = await searchReusedBlock({ query, page, limit });
    //         return textResult(result);
    //     },
    // );


    server.registerTool(
        'extract_circuit_on_current_page',
        {
            title: 'Extract Circuit',
            description: `Apply circuit changes to the current EasyEDA page. Every added component must include part_uuid. The result reports remaining current-sheet space and warns below 10%. Runs as a managed operation, waits up to 50 seconds, and always returns operation_id. For circuit modification docs, read: ${SKILL_DOC_PATH}`,
            annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
            inputSchema: CircuitModStruct().extend({
                file_path: z.string().min(1).optional()
                    .describe('Path to a UTF-8 JSON file containing CircuitMod. Provide either file_path or inline circuit fields.'),
            }),
        },
        managedMutationHandler(bridge, 'extract_circuit_on_current_page', async ({ file_path, ...inlineCircuit }) => {
            const hasInlineChanges = inlineCircuit.add_components.length > 0
                || inlineCircuit.add_reused_blocks.length > 0
                || inlineCircuit.rm_components !== null
                || inlineCircuit.external_rm_connect !== null
                || inlineCircuit.external_connect !== null;
            if (file_path !== undefined && hasInlineChanges) {
                throw new Error('Provide either file_path or inline circuit fields, not both.');
            }
            const circuit = CircuitModStruct().parse(file_path !== undefined
                ? JSON.parse(await readFile(file_path, 'utf8'))
                : inlineCircuit);
            const missingPartUuid = circuit.add_components
                .filter(component => isMissingPartUuid(component.part_uuid))
                .map(component => component.designator);

            if (missingPartUuid.length) {
                return textResult({
                    error: 'All add_components must have part_uuid.',
                    designators: missingPartUuid,
                });
            }

            const resolvedInputCircuit = await bridge.requestEasyEda('get-schematic') as ExplainCircuit;
            const otherPageSignals = await readOtherPageSignals(() => bridge.requestEasyEda('get-other-page-signals'));
            const result = await extractCircuit({ circuit, inputCircuit: resolvedInputCircuit,
                assemblyOptions: { otherPageSignals } });
            const assembled = await bridge.requestEasyEda('assemble-circuit', result as Record<string, unknown>);
            const sheetSpace = sheetSpaceNotice(assembled);
            return textResult({
                message: 'Circuit sent to EasyEDA for assembly.',
                checkpointId: (assembled as { checkpointId?: string }).checkpointId,
                ...(sheetSpace ? { sheetSpace } : {}),
            });
        }),
    );

    server.registerTool(
        'beautify_schematic_on_current_page',
        {
            title: 'Beautify EasyEDA Schematic',
            description: `Reassemble every component on the current EasyEDA schematic page into named functional blocks. The blocks must cover the whole page. A checkpoint is saved before replacement, and failures restore it automatically. Runs as a managed operation, waits up to 50 seconds, and always returns operation_id. For circuit workflow docs, read: ${SKILL_DOC_PATH}`,
            annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
            inputSchema: z.object({
                blocks: z.record(
                    z.string().min(1).describe('Block name.'),
                    z.array(z.string().min(1)).min(1).describe('Component designators in the block.'),
                ).describe('All current-page components grouped by block name.'),
                draw_block_box: z.boolean().default(false)
                    .describe('Draw Copilot-managed boxes and labels around functional blocks.'),
                auto_resize_page: z.boolean().default(true)
                    .describe('Grow the schematic drawing sheet when the layout does not fit inside its frame and title block.'),
            }),
        },
        managedMutationHandler(bridge, 'beautify_schematic_on_current_page', async ({ blocks, draw_block_box, auto_resize_page }) => {
            const inputCircuit = await bridge.requestEasyEda('get-schematic', { includePortStyles: true }) as ExplainCircuit;
            const otherPageSignals = await readOtherPageSignals(() => bridge.requestEasyEda('get-other-page-signals'));
            if (!inputCircuit.components.length) throw new Error('The current schematic page has no components.');

            const requested = selectedBlocks(blocks);
            const components = new Map(inputCircuit.components.map(component => [
                baseDesignator(component.designator),
                component,
            ]));
            const unknown = [...requested.keys()].filter(designator => !components.has(designator));
            const missing = [...components.keys()].filter(designator => !requested.has(designator));

            if (unknown.length) throw new Error(`Components not found on the current page: ${unknown.join(', ')}`);
            if (missing.length) throw new Error(`Blocks do not cover the whole current page. Missing: ${missing.join(', ')}`);

            const missingPartUuid = [...components]
                .filter(([, component]) => isMissingPartUuid(component.part_uuid))
                .map(([designator]) => designator);
            if (missingPartUuid.length) {
                throw new Error(`Components have no part_uuid: ${missingPartUuid.join(', ')}`);
            }

            const checkpointResult = await bridge.requestEasyEda('checkpoint-save', { name: 'Before schematic beautification' }) as { checkpointId?: unknown };
            const checkpointId = checkpointResult?.checkpointId;
            if (typeof checkpointId !== 'string' || !checkpointId) {
                throw new Error('Failed to save a checkpoint before beautify.');
            }

            const circuit: CircuitMod = {
                add_components: [...requested].map(([designator, blockName]) => {
                    const component = components.get(designator)!;
                    return {
                        designator,
                        value: component.value,
                        pins: component.pins,
                        block_name: blockName,
                        search_query: component.value,
                        part_uuid: component.part_uuid!,
                    };
                }),
                add_reused_blocks: [],
                rm_components: null,
                external_rm_connect: null,
                external_connect: null,
            };

            const response = await extractCircuit({
                circuit,
                inputCircuit: { components: [] },
                assemblyOptions: { otherPageSignals },
            });
            const assembly = serverAssembly(response);
            if (!assembly || !Array.isArray(assembly.components)) {
                throw new Error('Beautify returned an invalid circuit assembly.');
            }

            const assembledDesignators = new Set(assembly.components.map(component => baseDesignator(component.designator)));
            const absentFromAssembly = [...components.keys()].filter(designator => !assembledDesignators.has(designator));
            if (absentFromAssembly.length) {
                throw new Error(`Beautify omitted components: ${absentFromAssembly.join(', ')}`);
            }

            assembly.rm_components = [];
            assembly.replace_components = [];
            assembly.rm_net = [];
            assembly.assembly_options = {
                ...assembly.assembly_options,
                draw_blocks: draw_block_box,
                auto_resize_page,
            };

            const assembled = await bridge.requestEasyEda('beautify-current-page', {
                circuit: assembly,
                checkpointId,
                expectedDesignators: [...components.keys()],
            });
            const sheetSpace = sheetSpaceNotice(assembled);

            return textResult({
                message: 'Current EasyEDA schematic page beautified.',
                checkpointId,
                ...(sheetSpace ? { sheetSpace } : {}),
            });
        }),
    );

    server.registerTool(
        'get_schematic',
        {
            title: 'Get Schematic',
            description: 'Get the current EasyEDA schematic page, or all pages with get_full_schematic. Responses over 8 KiB are saved to a file.',
            annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
            inputSchema: z.object({
                get_full_schematic: z.boolean().default(false)
                    .describe('Get Full Schematic: retrieve the schematic from all pages.'),
            }),
        },
        toolHandler(bridge, async ({ get_full_schematic }) => {
            const result = await bridge.requestEasyEda(get_full_schematic
                ? 'get-multi-page-schematic' : 'get-schematic') as ExplainCircuit;
            const schematic = { ...result, components: result.components.map(c => ({ ...c, pos: undefined, })) };

            return textResult(schematic);
        }),
    );
}
