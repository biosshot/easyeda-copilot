import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import * as z from 'zod/v4';
import { PcbDrcBundleSchema, type PcbDrcBundle } from '@copilot/shared/types/pcb/drc.js';
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { Bridge } from "../bridge";
import { SKILL_DOC_PATH, TEMP_DIR } from "../utils/dirs";
import { textResult } from "../utils/tool-result";

async function readJsonFile(file: string) {
    const text = await readFile(file, 'utf8');
    return JSON.parse(text);
}

export function registerDrcTools(server: McpServer, bridge: Bridge) {

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
            const result = PcbDrcBundleSchema().parse(await bridge.requestEasyEda('export-pcb-drc-rules')) as PcbDrcBundle;
            const savePath = file?.trim() ? file : join(TEMP_DIR, `pcb-drc-${randomUUID().slice(0, 6)}.json`);

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
            const result = await bridge.requestEasyEda('apply-pcb-drc-rules', { bundle }, 300000);
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
            const result = await bridge.requestEasyEda('check-pcb-drc', { limit }, 300000);
            return textResult(result);
        },
    );
}