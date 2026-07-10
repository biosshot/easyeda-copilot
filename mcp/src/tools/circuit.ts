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

            const resolvedInputCircuit = await bridge.requestEasyEda('get-schematic');
            const result = await postJson('/v1/mcp-tools/extract-circuit', { circuit, inputCircuit: resolvedInputCircuit });
            await bridge.requestEasyEda('assemble-circuit', result as Record<string, unknown>, 300000);
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