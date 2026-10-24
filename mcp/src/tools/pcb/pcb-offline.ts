import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import * as z from 'zod/v4';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ROOT_DIR, TEMP_DIR } from '../../utils/dirs';
import { textResult } from '../../utils/tool-result';

/** Deliberately has no Bridge argument: offline tools cannot touch an editor. */
export async function runOfflinePcb(action: string, input: string, options: unknown, signal: AbortSignal) {
    const packed = join(ROOT_DIR, 'dist/lib/python/easyeda_copilot/pcb_offline.py');
    const worker = existsSync(packed) ? packed : join(ROOT_DIR, 'python/easyeda_copilot/pcb_offline.py');
    const parent = join(TEMP_DIR, 'pcb-offline');
    await mkdir(parent, { recursive: true });
    const output = join(parent, randomUUID());
    signal.throwIfAborted();
    const result = await new Promise<any>((resolve, reject) => {
        const child = spawn(process.env.EASYEDA_PCB_PYTHON || 'python', [worker], {
            windowsHide: true, shell: false, signal,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stdout = '', stderr = '', overflow = false;
        const timer = setTimeout(() => { child.kill(); reject(new Error('Offline PCB worker exceeded 120-second budget')); }, 120_000);
        child.stdout.on('data', data => {
            stdout += data;
            if (stdout.length > 16 * 1024 * 1024) { overflow = true; child.kill(); }
        });
        child.stderr.on('data', data => { stderr = (stderr + data).slice(-16000); });
        child.on('error', error => { clearTimeout(timer); reject(error); });
        child.on('close', code => {
            clearTimeout(timer);
            if (overflow) return reject(new Error('Offline PCB response exceeded 16 MiB'));
            if (code !== 0) return reject(new Error(`Offline PCB worker failed: ${stderr}. Set EASYEDA_PCB_PYTHON to Python with numpy and gerbonara installed.`));
            try { resolve(JSON.parse(stdout)); } catch { reject(new Error('Invalid offline PCB worker response')); }
        });
        child.stdin.on('error', () => { /* process error/close carries the diagnostic */ });
        child.stdin.end(JSON.stringify({ action, input, output, options }));
    });
    signal.throwIfAborted();
    if (action === 'gerber') {
        result.png = {};
        for (const side of ['top', 'bottom']) {
            signal.throwIfAborted();
            const path = join(output, `${side}.png`);
            await sharp(result.svg[side]).resize({ width:1600 }).png().toFile(path);
            result.png[side] = path;
        }
        await writeFile(result.report_path, JSON.stringify(result, null, 2));
    }
    return result;
}

export function registerOfflinePcbTools(server: McpServer) {
    const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
    const file = z.string().min(1).describe('Absolute path to a saved pcb-offline/v1 JSON snapshot; see docs/pcb-offline.md.');
    server.registerTool('plan_ground_plane_escapes', {
        title: 'Plan Ground Plane Escapes (Offline)',
        description: 'Bounded obstacle-aware outer-layer ground escapes to through vias. Saves a reviewable plan; never applies it. Requires explicit normalized geometry and obstacle coverage. Plane connectivity remains conditional until native refill and DRC.',
        annotations,
        inputSchema: z.object({ file, net: z.string().default('GND'), pad_ids: z.array(z.string()).max(500).optional(),
            step_mm: z.number().min(.01).max(.5).default(.05), radius_mm: z.number().positive().max(10).default(4),
            width_mm: z.number().positive().default(.2), clearance_mm: z.number().positive().default(.155),
            via_diameter_mm: z.number().positive().default(.6), via_drill_mm: z.number().positive().default(.3),
            edge_clearance_mm: z.number().positive().default(.25), drill_clearance_mm: z.number().positive().default(.25) }),
    }, async ({ file, ...options }, extra) => textResult(await runOfflinePcb('ground', file, options, extra.signal)));
    server.registerTool('preview_fabrication_gerbers', {
        title: 'Preview Fabrication Gerbers (Offline)',
        description: 'Render top and underside SVGs from a saved Gerber ZIP, with explicit layer/drill mappings, NPTH, parser diagnostics, and duplicate drill-hit detection. Does not rewrite archive or contact EasyEDA.',
        annotations,
        inputSchema: z.object({ file: z.string().min(1),
            layers: z.record(z.string(), z.string()).describe('Map roles such as top copper, bottom silk, mechanical outline to exact ZIP member names.'),
            drills: z.array(z.object({ file: z.string(), plated: z.boolean() })).min(1) }),
    }, async ({ file, ...options }, extra) => textResult(await runOfflinePcb('gerber', file, options, extra.signal)));
    server.registerTool('export_pcb_mechanical_interface', {
        title: 'Export PCB Mechanical Interface (Offline)',
        description: 'Export mm/Y-up outline, NPTH, component poses, native world pads, explicit height provenance, and optional pad-derived optical datums. Unknown heights remain null. Saved snapshot only; no live editor access.',
        annotations,
        inputSchema: z.object({ file, optical_datums: z.array(z.object({ name: z.string(), from_pad: z.string(), toward_pad: z.string(),
            offset_from_midpoint_mm: z.number(), source: z.string().min(1) })).default([]) }),
    }, async ({ file, ...options }, extra) => textResult(await runOfflinePcb('mechanical', file, options, extra.signal)));
}
