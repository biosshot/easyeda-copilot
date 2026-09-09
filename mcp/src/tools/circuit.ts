import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import * as z from 'zod/v4';
import { Bridge } from "../bridge";
import { textResult } from "../utils/tool-result";
import { componentSearch, searchReusedBlock } from "eda-copilot-backend/components";
import { extractCircuit } from "eda-copilot-backend/schematic";
import { SKILL_DOC_PATH, TEMP_DIR } from "../utils/dirs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CircuitAssembly, CircuitMod, CircuitModStruct, ExplainCircuit, ExplainCircuitStruct } from "@copilot/shared/types/circuit";

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
        'component_search',
        {
            title: 'Search EasyEDA Component',
            description: 'Search components. Prefer an exact part_uuid or manufacturer MPN; use a short part description only to discover candidates when the exact MPN is unknown.',
            inputSchema: z.object({
                part_uuid: z.string().nullable().optional(),
                MPN: z.string().nullable().optional(),
            }),
        },
        async ({ part_uuid, MPN }) => {
            if (!part_uuid && !MPN) {
                return textResult('Fill one: part_uuid or MPN');
            }

            const result = await componentSearch({ part_uuid, MPN });
            return textResult(result);
        },
    );

    server.registerTool(
        'search_reused_block',
        {
            title: 'Search Reused Block',
            description: `Search pre-assembled reusable circuit blocks. For circuit workflow docs, read: ${SKILL_DOC_PATH}`,
            inputSchema: z.object({
                query: z.string().describe('Query example: "3.3V power regulator"'),
                page: z.number().min(1).default(1).describe('Current results page.'),
                limit: z.number().min(1).max(25).default(10).describe('Number of results per page.'),
            }),
        },
        async ({ query, page, limit }) => {
            const result = await searchReusedBlock({ query, page, limit });
            return textResult(result);
        },
    );


    server.registerTool(
        'extract_circuit_on_current_page',
        {
            title: 'Extract Circuit',
            description: `Apply circuit changes to the current EasyEDA page. Every added component must include part_uuid. The result reports remaining current-sheet space and warns below 10%. For circuit modification docs, read: ${SKILL_DOC_PATH}`,
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

            const resolvedInputCircuit = await bridge.requestEasyEda('get-schematic') as ExplainCircuit;
            const result = await extractCircuit({ circuit, inputCircuit: resolvedInputCircuit });
            const assembled = await bridge.requestEasyEda('assemble-circuit', result as Record<string, unknown>, 300000);
            const sheetSpace = sheetSpaceNotice(assembled);
            return textResult({
                message: 'Circuit sent to EasyEDA for assembly.',
                ...(sheetSpace ? { sheetSpace } : {}),
            });
        },
    );

    server.registerTool(
        'beautify_schematic_on_current_page',
        {
            title: 'Beautify EasyEDA Schematic',
            description: `Reassemble every component on the current EasyEDA schematic page into named functional blocks. The blocks must cover the whole page. A checkpoint is saved before replacement, and failures restore it automatically. For circuit workflow docs, read: ${SKILL_DOC_PATH}`,
            inputSchema: z.object({
                blocks: z.record(
                    z.string().min(1).describe('Block name.'),
                    z.array(z.string().min(1)).min(1).describe('Component designators in the block.'),
                ).describe('All current-page components grouped by block name.'),
                draw_block_box: z.boolean().default(false)
                    .describe('Draw Copilot-managed boxes and labels around functional blocks.'),
            }),
        },
        async ({ blocks, draw_block_box }) => {
            const inputCircuit = await bridge.requestEasyEda('get-schematic') as ExplainCircuit;
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
                .filter(([, component]) => !component.part_uuid || /^0+$/.test(component.part_uuid))
                .map(([designator]) => designator);
            if (missingPartUuid.length) {
                throw new Error(`Components have no part_uuid: ${missingPartUuid.join(', ')}`);
            }

            const checkpointResult = await bridge.requestEasyEda('checkpoint-save') as { checkpointId?: unknown };
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
            };

            await bridge.requestEasyEda('beautify-current-page', {
                circuit: assembly,
                checkpointId,
                expectedDesignators: [...components.keys()],
            }, 300000);

            return textResult({
                message: 'Current EasyEDA schematic page beautified.',
                checkpointId,
            });
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
            const result = await bridge.requestEasyEda('get-schematic') as ExplainCircuit;
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
}
