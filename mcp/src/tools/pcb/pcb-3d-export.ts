import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { Bridge } from '../../bridge';
import * as z from 'zod/v4';
import { executeJs } from '../execute-js';
import { managedMutationHandler } from '../handler';

export const Pcb3dExportSchema = z.object({
    document_uuid: z.string().min(1).describe('Expected currently open PCB UUID from get_current_project_info.'),
    format: z.enum(['step', 'obj']).default('step'),
    name: z.string().min(1).max(128).default('populated-board'),
    include_details: z.boolean().default(true).describe('Include vias, silkscreen and signal-layer wires.'),
    auto_generate_models: z.boolean().default(true).describe('Allow EasyEDA to generate missing models from component heights; generated geometry is not vendor-verified.'),
});

export function pcb3dExportCode(input: z.input<typeof Pcb3dExportSchema>): string {
    const config = Pcb3dExportSchema.parse(input);
    return `const config = ${JSON.stringify(config)};
const doc = await eda.dmt_SelectControl.getCurrentDocumentInfo();
if (doc.uuid !== config.document_uuid) throw new Error('Active document differs from requested PCB');
const elements = config.include_details
    ? ['Component Model', 'Via', 'Silkscreen', 'Wire In Signal Layer'] : ['Component Model'];
const file = await eda.pcb_ManufactureData.get3DFile(config.name, config.format,
    elements, 'Outfit', config.auto_generate_models);
if (!file || file.size === 0) throw new Error('EasyEDA returned an empty 3D export');
return new Blob([file], {type: config.format === 'step' ? 'model/step' : 'application/zip'});`;
}

export function registerPcb3dExportTools(server: McpServer, bridge: Bridge) {
    server.registerTool('export_populated_pcb_3d', {
        title: 'Export Populated PCB 3D Model',
        description: 'Export the open PCB through native EasyEDA STEP or OBJ-with-materials ZIP. Prefer this over rebuilding component bodies from placement data. Requires the expected PCB UUID. Returns local artifact paths and operation_id; use wait_operation if running. Creates a checkpoint but does not edit layout or model bindings. STEP includes STEP-backed models; missing models may be generated from heights. Export does not prove model coverage or mechanical fit. Uses the existing 60-second execution budget; timeout does not cancel native work and must not trigger an automatic retry.',
        inputSchema: Pcb3dExportSchema,
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, managedMutationHandler(bridge, 'export_populated_pcb_3d', input => executeJs(bridge, { code: pcb3dExportCode(input) })));
}
