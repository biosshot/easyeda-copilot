import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { TIMEOUT_POLICY } from '@copilot/shared/timeout-policy';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { analysisDslDocumentation, renderAnalysisReport, runAnalysisDsl, type AnalysisImage } from 'eda-copilot-backend/analyze';
import * as z from 'zod/v4';
import type { Bridge } from '../../bridge';
import { operationManager } from '../../operations/manager';
import { operationToolResult } from '../../operations/tool-result';
import { requestRoutingBoardV2, parseRoutingBoardV2 } from '../../routing/board-v2-capture';
import { TEMP_DIR } from '../../utils/dirs';
import { svgToPng } from '../../utils/svg-to-png';
import { textResult } from '../../utils/tool-result';
import { targetedToolHandler } from '../handler';

const ANALYSIS_TIMEOUT_MS = 75 * 60_000;
const MAX_ANALYSIS_OUTPUT_BYTES = 128 * 1024 * 1024;

export function registerPcbAnalysisTools(server: McpServer, bridge: Bridge) {
    server.registerTool('get_pcb_analysis_docs', {
        title: 'Get PCB Analysis DSL Reference',
        description: 'Return the analysis DSL declarations from the installed backend. Large text is saved to a local file.',
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        inputSchema: z.object({}),
    }, async () => textResult(analysisDslDocumentation()));

    server.registerTool('run_pcb_analysis', {
        title: 'Run PCB Analysis',
        description: 'Analyze the current PCB from a local JavaScript analysis DSL file. Captures a read-only RoutingBoardV2 snapshot of the selected PCB. Returns operation_id for wait_operation or cancel_operation. The completed result contains analysis status and paths to JSON and PNG artifacts. Use get_pcb_analysis_docs for the DSL.',
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
        inputSchema: z.object({
            file: z.string().min(1).describe('Path to a trusted local JavaScript analysis DSL file.'),
            wait_ms: z.number().int().min(1000).max(TIMEOUT_POLICY.operationWaitMaxMs).default(TIMEOUT_POLICY.mutationWaitMs)
                .describe('Initial wait for a reply. The analysis continues in the background if this wait expires.'),
        }),
    }, targetedToolHandler(bridge, async ({ file, wait_ms }) => {
        const path = resolve(file);
        const code = await readFile(path, 'utf8');
        if (!code.trim()) throw new Error('The PCB analysis DSL file is empty.');
        const operationId = operationManager.start('pcb-analysis', async ({ id, signal, setStage }) => {
            const { board, diagnostics: captureDiagnostics } = parseRoutingBoardV2(await requestRoutingBoardV2(bridge));
            setStage('analyzing');
            const result = await runAnalysisDsl({ code, board }, {
                signal, filename: basename(path), timeoutMs: ANALYSIS_TIMEOUT_MS, maxOutputBytes: MAX_ANALYSIS_OUTPUT_BYTES,
            });
            signal.throwIfAborted();

            setStage('rendering');
            const report = renderAnalysisReport(result, board);
            await mkdir(TEMP_DIR, { recursive: true });
            const directory = await mkdtemp(join(TEMP_DIR, 'pcb-analysis-'));
            try {
                const resultPath = join(directory, 'result.json');
                const summaryPath = join(directory, 'summary.json');
                const images: (Omit<AnalysisImage, 'svg'> & { image_path: string })[] = [];
                const renderErrors: { name: string; message: string }[] = [];
                await writeFile(resultPath, JSON.stringify(result), { encoding: 'utf8', signal });
                for (const { svg, ...image } of report.images) {
                    signal.throwIfAborted();
                    const imagePath = join(directory, image.name + '.png');
                    try {
                        const bytes = await svgToPng(svg, { width: 1024, height: 1600, withoutEnlargement: true });
                        await writeFile(imagePath, bytes, { signal });
                        images.push({ ...image, image_path: imagePath });
                    } catch (error) {
                        signal.throwIfAborted();
                        renderErrors.push({ name: image.name, message: error instanceof Error ? error.message : String(error) });
                    }
                }
                await writeFile(summaryPath, JSON.stringify({
                    ...report.summary, capture_diagnostics: captureDiagnostics, images, render_errors: renderErrors,
                }, null, 2), { encoding: 'utf8', signal });
                const diagnosticCodes = new Set([
                    ...captureDiagnostics.map(item => item.code),
                    ...report.summary.diagnostics.map(item => item.code),
                    ...report.summary.calculations.flatMap(item => item.diagnostics.map(diagnostic => diagnostic.code)),
                    ...(result.error ? [result.error.code, ...result.error.diagnostics.map(item => item.code)] : []),
                ]);
                const response = await textResult({
                    status: result.status,
                    physical_accuracy: report.summary.physicalAccuracy,
                    calculations: report.summary.calculations.map(({ analysis, status, validity }) => ({ analysis, status, validity })),
                    checks: report.summary.checks,
                    diagnostic_codes: [...diagnosticCodes],
                    ...(result.error && { error: { code: result.error.code, message: result.error.message } }),
                    artifacts_directory: directory,
                    result_path: resultPath,
                    summary_path: summaryPath,
                    images,
                    ...(renderErrors.length > 0 && { render_errors: renderErrors }),
                });
                signal.throwIfAborted();
                return { operation_id: id, tool_result: { ...response, ...(result.status === 'failed' && { isError: true }) } };
            } catch (error) {
                await rm(directory, { recursive: true, force: true }).catch(() => {});
                throw error;
            }
        }, { tool: 'run_pcb_analysis', initialStage: 'capturing' });
        return operationToolResult(await operationManager.wait(operationId, wait_ms ?? TIMEOUT_POLICY.mutationWaitMs));
    }));
}
