import { z } from 'zod';
import { ExplainCircuitStruct } from './types/circuit.ts';
import { ExistingPlacementSchema, FootprintSpecSchema, PlacementError } from './types/pcb/layout-model.ts';
import { formatComponentSizeReport, getComponentSizeReport } from './pcb-layout/component-size-report.ts';
import { svgToDataUrl } from './pcb-layout/artifacts.ts';
import { createPcbDslErrorReport, createPcbToolReport, formatPcbToolReportForMessage, formatPlacementError } from './pcb-layout/report.ts';
import { runPcbLayoutQueued, terminatePcbLayoutWorkerPool, type RunPcbLayoutQueuedOptions } from './pcb-layout/run-pcb-layout-pool.ts';

const layoutSchema = z.object({
  code: z.string().min(1),
  circuit: ExplainCircuitStruct(),
  existingPlacement: ExistingPlacementSchema().optional(),
  footprints: z.record(z.string(), FootprintSpecSchema()).optional(),
});
const sizesSchema = z.object({
  circuit: ExplainCircuitStruct(),
  footprints: z.record(z.string(), FootprintSpecSchema()).optional(),
  designators: z.array(z.string()).nullish(),
  includeAll: z.boolean().nullish(),
});

export type MakePcbLayoutInput = z.input<typeof layoutSchema>;
export type GetPcbComponentSizesInput = z.input<typeof sizesSchema>;

export async function getPcbComponentSizes(input: GetPcbComponentSizesInput) {
  const data = sizesSchema.parse(input);
  try {
    const report = await getComponentSizeReport(data.circuit, data, data.footprints);
    return { content: formatComponentSizeReport(report), report };
  } catch (error) {
    return { error: `Error: ${(error as Error).message}` };
  }
}

export async function makePcbLayout(input: MakePcbLayoutInput, options: RunPcbLayoutQueuedOptions = {}) {
  options.signal?.throwIfAborted();
  const data = layoutSchema.parse(input);
  try {
    const run = await runPcbLayoutQueued(data, options);
    options.signal?.throwIfAborted();
    return {
      content: formatPcbToolReportForMessage(run.toolReport),
      toolReport: run.toolReport,
      pcb: run.boardAssemble,
      preview_image_url: svgToDataUrl(run.imageSvg),
      placement_debug_artifacts: {
        items: run.placementDebugArtifacts.items.map(item => ({
          type: item.type, name: item.name, fileName: item.fileName,
          components: item.components, svg_url: svgToDataUrl(item.svg),
        })),
      },
    };
  } catch (error) {
    options.signal?.throwIfAborted();
    if (error instanceof PlacementError) {
      const toolReport = createPcbToolReport({ placementReport: error.report });
      return { content: formatPcbToolReportForMessage(toolReport) + '\n\n' + formatPlacementError(error), toolReport };
    }
    const toolReport = createPcbDslErrorReport(error as Error);
    return { content: formatPcbToolReportForMessage(toolReport), toolReport };
  }
}

export const disposeBackend = () => terminatePcbLayoutWorkerPool(true);
export type { PcbLayoutProgress, PcbLayoutProgressReporter } from './pcb-layout/progress.ts';
export type { RunPcbLayoutQueuedOptions as PcbLayoutOptions } from './pcb-layout/run-pcb-layout-pool.ts';
