import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import * as z from 'zod/v4';
import { Bridge } from "../bridge";
import { textResult } from "../utils/tool-result";
import { postJson } from "../utils/server";
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

export function registerCircuitTools(server: McpServer, bridge: Bridge) {
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
        'extract_circuit_on_current_page',
        {
            title: 'Extract Circuit',
            description: `Post-process circuit changes on the main EasyEDA Copilot server and sends the assembled result to EasyEDA. Every added component must include part_uuid. For circuit modification docs, read the local docs folder: ${SKILL_DOC_PATH}`,
            inputSchema: CircuitModStruct().extend({
                draw_blocks: z.boolean().default(true)
                    .describe('Draw the dashed block rectangles around functional groups. The plugin UI does this by default; through MCP it used to be off with no way to enable it.'),
            }),
        },
        async ({ draw_blocks, ...circuit }) => {
            const missingPartUuid = circuit.add_components
                .filter(component => !component.part_uuid || /^0+$/.test(component.part_uuid))
                .map(component => component.designator);

            if (missingPartUuid.length) {
                return textResult({
                    error: 'All add_components must have part_uuid.',
                    designators: missingPartUuid,
                });
            }

            const resolvedInputCircuit = await bridge.requestEasyEda('get-schematic');
            const result = await postJson('/v1/mcp-tools/extract-circuit', { circuit, inputCircuit: resolvedInputCircuit });

            // Собранная схема приходит с сервера и до сих пор нигде не оседала,
            // поэтому разбирать её дефекты было не на чем. Кладём рядом копию.
            let assemblyPath: string | undefined;
            try {
                await mkdir(TEMP_DIR, { recursive: true });
                assemblyPath = join(TEMP_DIR, `assembly-${crypto.randomUUID().slice(0, 6)}.json`);
                await writeFile(assemblyPath, JSON.stringify(result, null, 2));
            } catch {
                assemblyPath = undefined;
            }

            // Сборка приезжает завёрнутой в ключ circuit, и плагин читает
            // именно его — параметры должны лежать внутри, а не рядом.
            const payload = result as { circuit?: Record<string, unknown> } & Record<string, unknown>;
            const inner = (payload.circuit ?? payload) as Record<string, unknown>;

            const assembly = {
                ...payload,
                circuit: {
                    ...inner,
                    assembly_options: {
                        ...((inner.assembly_options as Record<string, unknown> | undefined) ?? {}),
                        draw_blocks,
                    },
                },
            };

            await bridge.requestEasyEda('assemble-circuit', assembly, 300000);

            return textResult({
                message: 'Circuit sent to EasyEDA for assembly. Run check_schematic_erc to verify it.',
                assembly: assemblyPath,
            });
        },
    );

    server.registerTool(
        'beautify_schematic_on_current_page',
        {
            title: 'Beautify EasyEDA Schematic',
            description: `Reassemble every component on the current EasyEDA schematic page into named functional blocks. The blocks must cover the whole page. A checkpoint is saved before the server request, and assembly failures restore it automatically. For circuit workflow docs, read the local docs folder: ${SKILL_DOC_PATH}`,
            inputSchema: z.object({
                blocks: z.record(
                    z.string().min(1).describe('Block name.'),
                    z.array(z.string().min(1)).min(1).describe('Component designators in the block.'),
                ).describe('All current-page components grouped by block name.'),
            }),
        },
        async ({ blocks }) => {
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

            const response = await postJson('/v1/mcp-tools/extract-circuit', {
                circuit,
                inputCircuit: { components: [] },
            });
            const assembly = serverAssembly(response);
            if (!assembly || !Array.isArray(assembly.components)) {
                throw new Error('Beautify server returned an invalid circuit assembly.');
            }

            const assembledDesignators = new Set(assembly.components.map(component => baseDesignator(component.designator)));
            const absentFromAssembly = [...components.keys()].filter(designator => !assembledDesignators.has(designator));
            if (absentFromAssembly.length) {
                throw new Error(`Beautify server omitted components: ${absentFromAssembly.join(', ')}`);
            }

            assembly.rm_components = [];
            assembly.replace_components = [];
            assembly.rm_net = [];

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
            description: 'Get the current EasyEDA schematic through the connected MCP interface. ' +
                'Set include_positions to also get where each component sits on the sheet — needed to check the layout ' +
                'or to place something next to an existing part.\n' +
                `Format: ${JSON.stringify(ExplainCircuitStruct().toJSONSchema())}`,
            inputSchema: z.object({
                include_positions: z.boolean().default(false)
                    .describe('Include the x/y/rotation of every component. Off by default because it roughly doubles the payload.'),
            }),
        },
        async ({ include_positions }) => {
            const result = await bridge.requestEasyEda('get-schematic') as ExplainCircuit;
            const schematic = include_positions
                ? result
                : { ...result, components: result.components.map(c => ({ ...c, pos: undefined, })) };

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
