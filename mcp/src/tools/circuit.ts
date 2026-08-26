import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import * as z from 'zod/v4';
import { Bridge } from "../bridge";
import { textResult } from "../utils/tool-result";
import { postJson } from "../utils/server";
import { SKILL_DOC_PATH, TEMP_DIR } from "../utils/dirs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CircuitModStruct, ExplainCircuit, ExplainCircuitStruct } from "@copilot/shared/types/circuit";

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