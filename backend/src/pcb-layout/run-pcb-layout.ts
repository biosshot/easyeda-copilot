import { autoPlacePcbWithReportAsync, renderPlacementSvg } from "#pcb-layout/pcb-auto-place/auto-place.ts";
import { PCB_LAYOUT_DSL_SPEC, runPcbLayoutDsl } from "#pcb-layout/pcb-layout-dsl/spec.ts";
import type { ExplainCircuit } from "#types/circuit.ts";
import type { ExistingPlacement, FootprintSpec } from "#types/pcb/layout-model.ts";
import { LayoutRulesSchema } from "#types/pcb/layout-rules.ts";
import { writeFile } from "node:fs/promises";
import { createPlacementDebugArtifacts, writePlacementArtifacts } from "./artifacts.ts";
import { createBoardAssemble } from "./board-assemble.ts";
import { applyPlacementPreviewFilter, buildPlacementInput, validatePlacementRulesForCircuit } from "./placement-input.ts";
import { buildPlacementGraph } from "./pcb-auto-place/placement-graph.ts";
import { createPcbLayoutDigest, createPcbToolReport } from "./report.ts";
import path from "node:path";
import { terminatePcbSubtreeWorkerPool } from "./pcb-auto-place-v2/tree-subtree-pool.ts";
import {
    emitPcbLayoutProgress,
    pcbLayoutProgress,
    PCB_LAYOUT_PROGRESS,
    type PcbLayoutProgressReporter,
} from "./progress.ts";
import { applyExistingBoard, applyExistingComponentPlacements, ensurePreservedComponentBlocks, resolvePreservedComponentDesignators } from "./existing-placement.ts";

export { PCB_LAYOUT_DSL_SPEC };

export type RunPcbLayoutOptions = {
    code: string;
    circuit: ExplainCircuit;
    existingPlacement?: ExistingPlacement;
    footprints?: Record<string, FootprintSpec>;
    outputDir?: string | null;
    onProgress?: PcbLayoutProgressReporter;
};

export async function runPcbLayout(options: RunPcbLayoutOptions) {
    const emitProgress = (stage: Parameters<typeof pcbLayoutProgress>[0], progress: number, content: string) => {
        const event = pcbLayoutProgress(stage, progress, content);
        if (options.outputDir) console.error(`[pcb-layout] ${event.progress}% ${event.stage}: ${event.content}`);
        emitPcbLayoutProgress(options.onProgress, event);
    };

    try {
        emitProgress('parse_dsl', PCB_LAYOUT_PROGRESS.parseDsl, 'Parsing PCB layout DSL.');
        const parsedRules = ensurePreservedComponentBlocks(
            options.circuit,
            applyExistingBoard(
                LayoutRulesSchema().parse(runPcbLayoutDsl(options.code)),
                options.existingPlacement,
            ),
            options.existingPlacement,
        );
        const { circuit, rules, preview } = applyPlacementPreviewFilter(options.circuit, parsedRules);

        emitProgress('validate_dsl', PCB_LAYOUT_PROGRESS.validateDsl, 'Validating PCB layout DSL against the circuit.');
        validatePlacementRulesForCircuit(circuit, rules);

        emitProgress('resolve_footprints', PCB_LAYOUT_PROGRESS.resolveFootprints, 'Resolving PCB footprints and component geometry.');
        const placementInput = applyExistingComponentPlacements(
            await buildPlacementInput(circuit, rules, options.footprints),
            rules.preserve,
            options.existingPlacement,
        );

        emitProgress('build_graph', PCB_LAYOUT_PROGRESS.buildGraph, 'Building placement ownership graph.');
        const placementGraph = buildPlacementGraph(placementInput);

        const { placements, report, layout, stages } = await autoPlacePcbWithReportAsync(placementInput, {
            onProgress: options.onProgress,
            logProgress: Boolean(options.outputDir),
        });

        emitProgress('render', PCB_LAYOUT_PROGRESS.render, 'Rendering PCB placement preview and debug artifacts.');
        const placementSvg = renderPlacementSvg(placementInput, placements);
        const placementDebugArtifacts = createPlacementDebugArtifacts(placementInput, placements);
        const placementArtifacts = options.outputDir
            ? writePlacementArtifacts(options.outputDir, placementInput, placements, report, layout, stages, placementSvg, placementDebugArtifacts)
            : {};

        emitProgress('assemble', PCB_LAYOUT_PROGRESS.assemble, 'Creating PCB board assembly payload.');
        const imageSvg = placementSvg;
        const boardAssemble = createBoardAssemble(layout, {
            preserveBoard: rules.preserve?.board === true,
            preservedComponents: resolvePreservedComponentDesignators(rules.preserve, options.existingPlacement),
        });
        const digest = createPcbLayoutDigest({
            placementInput,
            placementReport: report,
            layout,
            placementArtifacts,
        });
        const toolReport = createPcbToolReport({
            placementReport: report,
            placementInput,
            layout,
            preview,
        });

        if (options.outputDir)
            await writeFile(path.join(options.outputDir, 'board.assemble.json'), JSON.stringify(boardAssemble, null, 2)).catch(_ => _)
        if (options.outputDir)
            await writeFile(path.join(options.outputDir, 'placement.graph.json'), JSON.stringify(placementGraph, null, 2)).catch(_ => _)

        emitProgress('done', PCB_LAYOUT_PROGRESS.done, 'PCB layout finished.');

        return {
            rules,
            placementInput,
            placementGraph,
            placements,
            placementReport: report,
            placementStatus: report.ok ? "ok" as const : "failed_with_layout" as const,
            failedWithLayout: !report.ok,
            layout,
            stages,
            placementSvg,
            placementArtifacts,
            placementDebugArtifacts,
            boardAssemble,
            imageSvg,
            digest,
            toolReport,
            artifactsSaved: Boolean(options.outputDir),
        };
    } finally {
        await terminatePcbSubtreeWorkerPool(false).catch(() => undefined);
    }
}

export type PcbLayoutRunResult = Awaited<ReturnType<typeof runPcbLayout>>;
