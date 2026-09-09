import type {
    MechanicalFaceDirection,
    PcbLayout,
    PlacementError,
    PlacementHint,
    PlacementInput,
    PlacementReport,
} from "#types/pcb/layout-model.ts";
import { PcbToolReportSchema, type PcbToolReport } from "#types/pcb/tool-report.ts";
import { normalizeRotation, rotatePoint } from "#utils/math.ts";
import { ZodError } from "zod";
import type { PlacementPreviewMetadata } from "./placement-input.ts";

export function createPcbLayoutDigest(input: {
    placementInput: PlacementInput;
    placementReport: PlacementReport;
    layout: PcbLayout;
    placementArtifacts: Record<string, string | null>;
}) {
    const scoreByComponent = new Map(input.placementReport.scoreByComponent.map((item) => [item.designator, item.score]));
    const criticalPairs = evaluateCriticalPairs(input.placementInput, input.layout);
    const capClusters = evaluateCapClusters(input.placementInput, input.layout);
    const faceConstraints = evaluateFaceConstraints(input.placementInput, input.layout);
    const errors = createDigestErrors(input.placementReport);
    const diagnostics = [
        ...proceduralGeometryDiagnostics(input.layout),
        ...createDigestDiagnostics(input.placementReport, criticalPairs, capClusters, faceConstraints),
    ].slice(0, 80);

    return {
        schema: "pcb_layout_digest.v1",
        board: {
            units: "mm",
            width: input.layout.board.outline.width,
            height: input.layout.board.outline.height,
            defaultLayer: input.layout.board.defaultLayer,
            allowedLayers: input.layout.board.allowedLayers,
        },
        image: {
            type: "image_url",
            label: "PCB",
            available: true,
        },
        artifacts: {
            saved: hasArtifacts(input.placementArtifacts),
            placement: input.placementArtifacts,
        },
        placement: {
            ok: input.placementReport.ok,
            placed: input.placementReport.placed,
            unplaced: input.placementReport.unplaced,
            overlaps: input.placementReport.overlaps,
            outsideBoard: input.placementReport.outsideBoard,
            boardHoleViolations: input.placementReport.boardHoleViolations,
            constraintRegionViolations: input.placementReport.constraintRegionViolations,
            layerViolations: input.placementReport.layerViolations,
            hintViolations: input.placementReport.hintViolations,
            signalPaths: input.placementReport.signalPaths ?? [],
            oversizedBlocks: input.placementReport.blockReports.filter((block) => block.oversized).map((block) => block.name),
            oversizedModules: input.placementReport.moduleReports.filter((module) => module.oversized).map((module) => module.name),
            graph: {
                ok: input.placementReport.graphReport.ok,
                treeNodes: input.placementReport.graphReport.treeNodes,
                relations: input.placementReport.graphReport.relations,
                islands: input.placementReport.graphReport.islands,
                roots: input.placementReport.graphReport.roots,
                maxDepth: input.placementReport.graphReport.maxDepth,
                diagnostics: input.placementReport.graphReport.diagnostics,
            },
        },
        components: input.layout.components.map((component) => ({
            designator: component.designator,
            value: component.value,
            block: component.block_name,
            x: roundForMessage(component.x),
            y: roundForMessage(component.y),
            rotate: component.rotate,
            layer: component.layer,
            footprint: {
                name: component.footprint.name,
                width: component.footprint.width,
                height: component.footprint.height,
            },
            score: roundForMessage(scoreByComponent.get(component.designator) ?? 0),
        })),
        blocks: input.placementReport.blockReports.map((block) => ({
            name: block.name,
            components: block.components,
            width: roundForMessage(block.width),
            height: roundForMessage(block.height),
            area: roundForMessage(block.area),
            estimatedWidth: roundForMessage(block.estimatedWidth),
            estimatedHeight: roundForMessage(block.estimatedHeight),
            oversized: block.oversized,
            limitViolations: block.limitViolations ?? [],
        })),
        modules: input.placementReport.moduleReports.map((module) => ({
            name: module.name,
            blocks: module.blocks,
            components: module.components,
            width: roundForMessage(module.width),
            height: roundForMessage(module.height),
            area: roundForMessage(module.area),
            oversized: module.oversized,
            locked: module.locked,
            limitViolations: module.limitViolations ?? [],
        })),
        criticalPairs,
        capClusters,
        faceConstraints,
        signalPaths: input.placementReport.signalPaths ?? [],
        errors,
        diagnostics,
    };
}

export type PcbLayoutDigest = ReturnType<typeof createPcbLayoutDigest>;

function normalizePreviewMetadata(preview: PlacementPreviewMetadata | null | undefined) {
    return preview ?? {
        enabled: false,
        placedComponents: [],
        ignoredComponents: [],
        totalComponents: 0,
        warnings: [],
    };
}

export function createPcbToolReport(input: {
    placementReport: PlacementReport;
    placementInput?: PlacementInput | null;
    layout?: PcbLayout | null;
    preview?: PlacementPreviewMetadata | null;
}): PcbToolReport {
    const blockViolations = [
        ...formatBlockViolations(input.placementReport),
    ];
    const graphDiagnostics = formatGraphDiagnostics(input.placementReport);
    const criticalPairViolations = input.placementInput && input.layout
        ? evaluateCriticalPairs(input.placementInput, input.layout)
            .filter((item) => !item.ok)
            .slice(0, 32)
            .map(formatCriticalPairViolation)
        : [];
    const signalPathViolations = (input.placementReport.signalPaths ?? [])
        .filter((path) => !path.resolved || !path.withinConstraints)
        .slice(0, 16)
        .map(formatSignalPathViolation);
    const placement = {
        ok: input.placementReport.ok
            && input.placementReport.overlaps.length === 0
            && input.placementReport.outsideBoard.length === 0
            && input.placementReport.boardHoleViolations.length === 0
            && input.placementReport.constraintRegionViolations.length === 0
            && input.placementReport.layerViolations.length === 0
            && input.placementReport.unplaced.length === 0,
        hardErrors: formatPlacementHardErrors(input.placementReport),
        overlaps: input.placementReport.overlaps.map(formatOverlapSummary),
        outsideBoard: input.placementReport.outsideBoard.map(formatOutsideBoardSummary),
        boardHoleViolations: input.placementReport.boardHoleViolations.map(formatBoardHoleViolationSummary),
        constraintRegionViolations: input.placementReport.constraintRegionViolations.map(formatConstraintRegionViolationSummary),
        layerViolations: input.placementReport.layerViolations.map(formatLayerViolationSummary),
        unplaced: input.placementReport.unplaced,
    };
    const quality = {
        ok: blockViolations.length === 0
            && criticalPairViolations.length === 0
            && signalPathViolations.length === 0
            && graphDiagnostics.every((item) => !item.startsWith("error "))
            && input.placementReport.hintViolations.length === 0,
        warnings: [
            ...(input.layout ? proceduralGeometryDiagnostics(input.layout) : []),
            ...input.placementReport.hintViolations.slice(0, 16).map(formatHintViolationSummary),
            ...signalPathViolations,
            ...createQualityWarnings(input.placementReport),
        ],
        blockViolations,
        criticalPairViolations,
        graphDiagnostics,
    };
    const solver = {
        ok: placement.ok,
        errors: placement.ok ? [] : [
            "Auto-placement ended with hard geometry violations.",
            ...physicalOverlaps(input.placementReport).slice(0, 24).map(formatFatalOverlap),
        ],
        warnings: createSolverWarnings(input.placementReport),
        likelyCauses: inferLikelyCauses(input.placementReport, criticalPairViolations),
        suggestions: suggestPlacementFixes(input.placementReport, criticalPairViolations),
    };
    const hasHardErrors = !placement.ok || solver.errors.length > 0;
    const hasWarnings = !quality.ok || solver.warnings.length > 0;
    const preview = normalizePreviewMetadata(input.preview);

    return PcbToolReportSchema().parse({
        status: hasHardErrors ? "error" : preview.enabled ? "preview" : hasWarnings ? "warning" : "ok",
        preview,
        dsl: {
            ok: true,
            errors: [],
            warnings: preview.warnings,
        },
        placement,
        quality,
        solver,
    });
}

function proceduralGeometryDiagnostics(layout: PcbLayout) {
    return layout.components.flatMap((component) => [
        ...(component.syntheticFootprint?.diagnostics ?? []),
        ...(component.generatedGeometry ?? []).flatMap((geometry) => geometry.diagnostics ?? []),
    ]);
}

export function createPcbDslErrorReport(error: Error): PcbToolReport {
    return PcbToolReportSchema().parse({
        status: "error",
        preview: normalizePreviewMetadata(null),
        dsl: {
            ok: false,
            errors: formatDslErrorMessages(error),
            warnings: [],
        },
        placement: {
            ok: false,
            hardErrors: [],
            overlaps: [],
            outsideBoard: [],
            boardHoleViolations: [],
            constraintRegionViolations: [],
            layerViolations: [],
            unplaced: [],
        },
        quality: {
            ok: false,
            warnings: [],
            blockViolations: [],
            criticalPairViolations: [],
            graphDiagnostics: [],
        },
        solver: {
            ok: false,
            errors: [],
            warnings: [],
            likelyCauses: ["The layout DSL is invalid, so placement did not start."],
            suggestions: [
                "Fix the DSL errors first.",
                "Ensure every circuit component belongs to exactly one block.",
                "Split any block with more than 12 components into smaller physical satellite blocks.",
            ],
        },
    });
}

export function formatPcbToolReportForMessage(report: PcbToolReport) {
    const lines = [
        `status: ${report.status}`,
    ];

    if (report.preview.enabled) {
        lines.push(
            ``,
            `PREVIEW ONLY: true`,
            `placed selected components: ${report.preview.placedComponents.length} / ${report.preview.totalComponents}`,
        );
        appendStringItems(lines, "ignored components", report.preview.ignoredComponents);
        appendStringItems(lines, "preview warnings", report.preview.warnings);
    }

    if (!report.dsl.ok || report.dsl.errors.length > 0 || report.dsl.warnings.length > 0) {
        lines.push(``, `DSL:`, `ok: ${report.dsl.ok}`);
        appendStringItems(lines, "errors", report.dsl.errors);
        appendStringItems(lines, "warnings", report.dsl.warnings);
    }

    lines.push(``, `Placement:`, `ok: ${report.placement.ok}`);
    appendStringItems(lines, "hard errors", report.placement.hardErrors);
    appendStringItems(lines, "unplaced", report.placement.unplaced);
    appendStringItems(lines, "outside board", report.placement.outsideBoard);
    appendStringItems(lines, "overlaps", report.placement.overlaps);
    appendStringItems(lines, "board hole violations", report.placement.boardHoleViolations);
    appendStringItems(lines, "constraint region violations", report.placement.constraintRegionViolations);
    appendStringItems(lines, "layer violations", report.placement.layerViolations);

    lines.push(``, `Quality:`, `ok: ${report.quality.ok}`);
    appendStringItems(lines, "block/module violations", report.quality.blockViolations);
    appendStringItems(lines, "critical pair violations", report.quality.criticalPairViolations);
    appendStringItems(lines, "graph diagnostics", report.quality.graphDiagnostics);
    appendStringItems(lines, "warnings", report.quality.warnings);

    if (!report.solver.ok || report.solver.errors.length > 0 || report.solver.warnings.length > 0) {
        lines.push(``, `Solver:`, `ok: ${report.solver.ok}`);
        appendStringItems(lines, "errors", report.solver.errors);
        appendStringItems(lines, "warnings", report.solver.warnings);
    }
    appendStringItems(lines, "Likely causes", report.solver.likelyCauses);
    appendStringItems(lines, "Suggested DSL fixes", report.solver.suggestions);

    return lines.join("\n");
}

export function formatPcbLayoutDigestForMessage(digest: PcbLayoutDigest) {
    const failedCriticalPairs = digest.criticalPairs.filter((item) => !item.ok);
    const failedCapClusters = digest.capClusters.filter((item) => !item.ok);
    const faceWarnings = digest.faceConstraints.filter((item) => item.warning);
    return [
        `pcb_layout_digest`,
        `schema: ${digest.schema}`,
        `image_url: ${digest.image.available ? `available label=${digest.image.label}` : "missing"}`,
        `components_returned: ${digest.components.length}`,
        `critical_pairs: ${digest.criticalPairs.length}, failed: ${failedCriticalPairs.length}`,
        ...failedCriticalPairs.slice(0, 12).map((item) => `- ${item.source}<->${item.target}: ${item.distanceMm ?? "missing"}mm, expected ${item.minDistanceMm ?? "-"}..${item.maxDistanceMm ?? "-"}mm`),
        `cap_clusters: ${digest.capClusters.length}, failed: ${failedCapClusters.length}`,
        ...failedCapClusters.slice(0, 8).map((item) => `- ${item.capacitors.join(",")}: rows ${item.rows}/${item.maxRows}, rotations [${item.rotations.join(", ")}]`),
        `face_constraints: ${digest.faceConstraints.length}, warnings: ${faceWarnings.length}`,
        ...faceWarnings.slice(0, 8).map((item) => `- ${item.designator}: ${item.warning}`),
        `errors: ${digest.errors.length}`,
        ...digest.errors.slice(0, 24).map((line) => `- ${line}`),
        `diagnostics: ${digest.diagnostics.length}`,
        ...digest.diagnostics.slice(0, 24).map((line) => `- ${line}`),
    ].join("\n");
}

export function formatPlacementSummary(report: PlacementReport, componentCount: number, placementInput: PlacementInput, artifactsSaved: boolean) {
    const oversizedBlocks = report.blockReports.filter((block) => block.oversized);
    const oversizedModules = report.moduleReports.filter((module) => module.oversized);
    return [
        `placement`,
        `components: ${componentCount}`,
        `board: ${placementInput.board.outline.width}mm x ${placementInput.board.outline.height}mm`,
        `ok: ${report.ok}`,
        `overlaps: ${report.overlaps.length}`,
        `outside_board: ${report.outsideBoard.length}`,
        `board_hole_violations: ${report.boardHoleViolations.length}`,
        `constraint_region_violations: ${report.constraintRegionViolations.length}`,
        `hint_violations: ${report.hintViolations.length}`,
        `signal_paths: ${(report.signalPaths ?? []).length}, failed: ${(report.signalPaths ?? []).filter((path) => !path.resolved || !path.withinConstraints).length}`,
        `graph_ok: ${report.graphReport.ok}`,
        `graph_islands: ${report.graphReport.islands}`,
        `graph_diagnostics: ${report.graphReport.diagnostics.length}`,
        `oversized_blocks: ${oversizedBlocks.length}`,
        `oversized_modules: ${oversizedModules.length}`,
        ...formatBlockReportLines(report.blockReports),
        ...formatModuleReportLines(report.moduleReports),
        `artifacts_saved: ${artifactsSaved}`,
    ].join("\n");
}

export function formatPlacementError(error: PlacementError) {
    const report = error.report;
    const lines = [
        `Error: ${error.message}`,
        `PCB auto-placement failed because the generated placement has hard geometry violations.`,
        ``,
        `Summary:`,
        `placed: ${report.placed}`,
        `unplaced: ${report.unplaced.length}`,
        `outside_board: ${report.outsideBoard.length}`,
        `overlaps: ${report.overlaps.length}`,
        `board_hole_violations: ${report.boardHoleViolations.length}`,
        `constraint_region_violations: ${report.constraintRegionViolations.length}`,
        `layer_violations: ${report.layerViolations.length}`,
        `hint_violations: ${report.hintViolations.length}`,
        `graph_ok: ${report.graphReport.ok}`,
        `graph_diagnostics: ${report.graphReport.diagnostics.length}`,
    ];

    appendSection(lines, "Unplaced Components", report.unplaced.slice(0, 20), (designator) => `- ${designator}`);
    appendSection(lines, "Components Outside Board", report.outsideBoard.slice(0, 20), formatOutsideBoard);
    appendSection(lines, "Component Overlaps", report.overlaps.slice(0, 30), formatOverlap);
    appendSection(lines, "Board Hole Violations", report.boardHoleViolations.slice(0, 20), formatBoardHoleViolation);
    appendSection(lines, "Constraint Region Violations", report.constraintRegionViolations.slice(0, 20), formatConstraintRegionViolation);
    appendSection(lines, "Layer Violations", report.layerViolations.slice(0, 20), formatLayerViolation);
    appendSection(lines, "Hint Violations", report.hintViolations.slice(0, 20), formatHintViolation);
    appendSection(lines, "Placement Graph Diagnostics", report.graphReport.diagnostics.slice(0, 30), formatGraphDiagnostic);
    appendSection(lines, "Block Sizes", report.blockReports.slice(0, 20), formatBlockReport);
    appendSection(lines, "Module Sizes", report.moduleReports.slice(0, 20), formatModuleReport);

    lines.push(
        ``,
        `How to fix the next make_pcb_layout call:`,
        `- Prefer board.type="auto" unless the user gave exact board dimensions.`,
        `- Increase board rect width/height or board auto minWidth/minHeight if many components are outside the board or overlaps are widespread.`,
        `- Reduce board.componentClearance only if the requested spacing is intentionally too large for the board.`,
        `- Relax or remove conflicting critical/high placement hints around the listed components.`,
        `- For listed overlaps, add clearance/away_from hints or move those components into different blocks/layers via allowedLayers.`,
        `- For listed outside_board connectors/ports, prefer component("J1").edgeMount(edge, { overhang }) instead of hand-written fixed()+offset+boardOverflow.`,
        `- For other listed outside_board components, prefer edge hints only for connectors and avoid forcing large footprints to board edges.`,
        `- Keep footprint null when part_uuid exists unless you need a manual override; wrong oversized footprints often cause this error.`,
    );

    return lines.join("\n");
}

function hasArtifacts(artifacts: Record<string, string | null>) {
    return Object.values(artifacts).some((value) => typeof value === "string" && value.length > 0);
}

function evaluateCriticalPairs(placementInput: PlacementInput, layout: PcbLayout) {
    return placementInput.hints
        .filter((hint): hint is Extract<PlacementHint, { relation: "critical_pair" }> => hint.relation === "critical_pair")
        .map((hint) => {
            const distance = pinDistance(layout, hint.source, hint.target);
            const minOk = hint.minDistance == null || (distance != null && distance >= hint.minDistance);
            const maxOk = hint.maxDistance == null || (distance != null && distance <= hint.maxDistance);
            return {
                source: formatPinTarget(hint.source),
                target: formatPinTarget(hint.target),
                priority: hint.priority,
                distanceMm: distance == null ? null : roundForMessage(distance),
                minDistanceMm: hint.minDistance ?? null,
                maxDistanceMm: hint.maxDistance ?? null,
                hard: Boolean(hint.hard),
                core: Boolean(hint.core),
                ok: distance != null && minOk && maxOk,
            };
        })
        .sort((a, b) => Number(a.ok) - Number(b.ok) || (b.distanceMm ?? 0) - (a.distanceMm ?? 0));
}

function evaluateCapClusters(placementInput: PlacementInput, layout: PcbLayout) {
    const componentByDesignator = new Map(layout.components.map((component) => [component.designator, component]));
    return placementInput.hints
        .filter((hint): hint is Extract<PlacementHint, { relation: "cap_cluster" }> => hint.relation === "cap_cluster")
        .map((hint) => {
            const components = hint.capacitors.flatMap((designator) => {
                const component = componentByDesignator.get(designator);
                return component ? [component] : [];
            });
            const missing = hint.capacitors.filter((designator) => !componentByDesignator.has(designator));
            const axis = hint.axis ?? "x";
            const rowCoordinate = axis === "x" ? "y" : "x";
            const rows = countCoordinateGroups(components.map((component) => component[rowCoordinate]));
            const rotations = uniqueNumbers(components.map((component) => normalizeRotation(component.rotate)));
            const maxRows = hint.maxRows ?? 2;

            return {
                capacitors: hint.capacitors,
                powerNet: hint.powerNet,
                returnNet: hint.returnNet,
                target: hint.target ? formatPinTarget(hint.target) : null,
                axis,
                topology: hint.topology ?? null,
                rows,
                maxRows,
                rotations,
                sameRotation: rotations.length <= 1,
                missing,
                ok: missing.length === 0 && rows <= maxRows,
            };
        });
}

function evaluateFaceConstraints(placementInput: PlacementInput, layout: PcbLayout) {
    const placementByDesignator = new Map(layout.components.map((component) => [component.designator, component]));
    return placementInput.components.flatMap((component) => {
        if (!component.pcb.faceTo || !component.pcb.mechanicalFaceAt0) return [];
        const placed = placementByDesignator.get(component.designator);
        const actualFace = placed ? rotateFaceDirection(component.pcb.mechanicalFaceAt0, placed.rotate) : null;
        return [{
            designator: component.designator,
            faceAt0: component.pcb.mechanicalFaceAt0,
            source: component.pcb.mechanicalFaceAt0Source ?? null,
            faceTo: component.pcb.faceTo,
            allowedRotations: component.pcb.allowedRotations.map(normalizeRotation),
            actualRotate: placed?.rotate ?? null,
            actualFace,
            ok: actualFace === component.pcb.faceTo,
            warning: component.pcb.faceWarning ?? null,
        }];
    });
}

function createDigestDiagnostics(
    placementReport: PlacementReport,
    criticalPairs: ReturnType<typeof evaluateCriticalPairs>,
    capClusters: ReturnType<typeof evaluateCapClusters>,
    faceConstraints: ReturnType<typeof evaluateFaceConstraints>,
) {
    const lines: string[] = [];
    for (const overlap of placementReport.overlaps.slice(0, 16)) {
        if (overlap.gap < 0) continue;
        lines.push(`overlap ${overlap.a}<->${overlap.b}: gap ${roundForMessage(overlap.gap)}mm required ${roundForMessage(overlap.required)}mm`);
    }
    for (const item of placementReport.outsideBoard.slice(0, 12)) {
        lines.push(`outside_board ${item.designator}: box=${formatBox(item.box)}`);
    }
    for (const item of placementReport.boardHoleViolations.slice(0, 12)) {
        lines.push(`board_hole ${item.designator}<->${item.hole}: gap ${roundForMessage(item.gap)}mm required ${roundForMessage(item.required)}mm`);
    }
    for (const item of placementReport.constraintRegionViolations.slice(0, 12)) {
        lines.push(`constraint_region ${formatConstraintRegionViolationSummary(item)}`);
    }
    for (const item of placementReport.layerViolations.slice(0, 12)) {
        lines.push(`layer_violation ${item.designator}: ${item.layer} not in [${item.allowedLayers.join(", ")}]`);
    }
    for (const item of placementReport.graphReport.diagnostics.slice(0, 16)) {
        lines.push(`placement_graph ${item.severity} ${item.code}: ${item.message}`);
    }
    for (const block of placementReport.blockReports.filter((item) => item.oversized).slice(0, 12)) {
        const limits = block.limitViolations?.length ? ` limits=${block.limitViolations.join("; ")}` : "";
        lines.push(`oversized_block ${block.name}: actual ${roundForMessage(block.width)}x${roundForMessage(block.height)}mm estimated ${roundForMessage(block.estimatedWidth)}x${roundForMessage(block.estimatedHeight)}mm${limits}`);
    }
    for (const module of placementReport.moduleReports.filter((item) => item.oversized).slice(0, 12)) {
        const limits = module.limitViolations?.length ? ` limits=${module.limitViolations.join("; ")}` : "";
        lines.push(`oversized_module ${module.name}: actual ${roundForMessage(module.width)}x${roundForMessage(module.height)}mm blocks=[${module.blocks.join(", ")}]${limits}`);
    }
    for (const pair of criticalPairs.filter((item) => !item.ok).slice(0, 16)) {
        lines.push(`critical_pair ${formatCriticalPairViolation(pair)}`);
    }
    for (const cluster of capClusters.filter((item) => !item.ok).slice(0, 8)) {
        lines.push(`cap_cluster ${cluster.capacitors.join(",")}: rows ${cluster.rows}/${cluster.maxRows}${cluster.missing.length ? ` missing=${cluster.missing.join(",")}` : ""}`);
    }
    for (const face of faceConstraints.slice(0, 16)) {
        if (face.warning) lines.push(`face_warning ${face.warning}`);
        if (!face.ok) lines.push(`face_violation ${face.designator}: actual ${face.actualFace ?? "missing"} expected ${face.faceTo}`);
    }
    return lines.slice(0, 80);
}

function createDigestErrors(placementReport: PlacementReport) {
    const lines: string[] = [];
    for (const overlap of physicalOverlaps(placementReport).slice(0, 24)) {
        lines.push(formatFatalOverlap(overlap));
    }
    for (const item of placementReport.outsideBoard.slice(0, 12)) {
        lines.push(`outside_board ${item.designator}: ${formatOutsideBoardSummary(item)}`);
    }
    for (const item of placementReport.boardHoleViolations.slice(0, 12)) {
        lines.push(`board_hole ${formatBoardHoleViolationSummary(item)}`);
    }
    for (const item of placementReport.constraintRegionViolations.slice(0, 12)) {
        lines.push(`constraint_region ${formatConstraintRegionViolationSummary(item)}`);
    }
    for (const item of placementReport.layerViolations.slice(0, 12)) {
        lines.push(`layer ${formatLayerViolationSummary(item)}`);
    }
    if (placementReport.unplaced.length > 0) {
        lines.push(`unplaced components: ${placementReport.unplaced.join(", ")}`);
    }
    return lines;
}

function countCoordinateGroups(values: number[], tolerance = 0.75) {
    const sorted = values.slice().sort((a, b) => a - b);
    let groups = 0;
    let current: number | null = null;
    for (const value of sorted) {
        if (current == null || Math.abs(value - current) > tolerance) {
            groups += 1;
            current = value;
        }
    }
    return groups;
}

function uniqueNumbers(values: number[]) {
    return [...new Set(values)].sort((a, b) => a - b);
}

function pinDistance(layout: PcbLayout, a: Extract<PlacementHint, { relation: "critical_pair" }>["source"], b: Extract<PlacementHint, { relation: "critical_pair" }>["target"]) {
    const pointA = padPoint(layout, a);
    const pointB = padPoint(layout, b);
    if (!pointA || !pointB) return null;
    return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
}

function padPoint(layout: PcbLayout, target: Extract<PlacementHint, { relation: "critical_pair" }>["source"]) {
    const component = layout.components.find((item) => item.designator === target.designator);
    if (!component) return null;
    const pad = component.footprint.pads.find((item) => String(item.pin_number) === String(target.pin_number));
    if (!pad) return null;
    const mirroredX = component.layer === "bottom" ? -pad.x : pad.x;
    const rotated = rotatePoint({ x: mirroredX, y: pad.y }, component.rotate);
    return {
        x: component.x + rotated.x,
        y: component.y + rotated.y,
    };
}

function formatPinTarget(target: Extract<PlacementHint, { relation: "critical_pair" }>["source"]) {
    return `${target.designator}.${target.pin_number}`;
}

function formatCriticalPairViolation(pair: ReturnType<typeof evaluateCriticalPairs>[number]) {
    return `${pair.source}<->${pair.target}: distance ${pair.distanceMm ?? "missing"}mm expected ${pair.minDistanceMm ?? "-"}..${pair.maxDistanceMm ?? "-"}mm`;
}

function rotateFaceDirection(faceAt0: MechanicalFaceDirection, rotation: number): MechanicalFaceDirection {
    const angle = normalizeRotation(directionAngle(faceAt0) + rotation);
    if (angle === 0) return "right";
    if (angle === 90) return "bottom";
    if (angle === 180) return "left";
    return "top";
}

function directionAngle(direction: MechanicalFaceDirection) {
    if (direction === "right") return 0;
    if (direction === "bottom") return 90;
    if (direction === "left") return 180;
    return 270;
}

function appendSection<T>(lines: string[], title: string, items: T[], format: (item: T) => string) {
    if (items.length === 0) return;
    lines.push(``, `${title}:`, ...items.map(format));
}

function appendStringItems(lines: string[], title: string, items: string[], limit = 24) {
    if (items.length === 0) return;
    lines.push(`${title}: ${items.length}`);
    lines.push(...items.slice(0, limit).map((item) => `- ${item}`));
    if (items.length > limit) lines.push(`- ... ${items.length - limit} more`);
}

function formatOutsideBoard(item: PlacementReport["outsideBoard"][number]) {
    const overflow = {
        left: Math.max(0, item.board.left - item.box.left),
        right: Math.max(0, item.box.right - item.board.right),
        top: Math.max(0, item.board.top - item.box.top),
        bottom: Math.max(0, item.box.bottom - item.board.bottom),
    };

    return `- ${item.designator}: box=${formatBox(item.box)} board=${formatBox(item.board)} overflow=${formatOverflow(overflow)}`;
}

function formatOverlap(item: PlacementReport["overlaps"][number]) {
    return `- ${item.a} <-> ${item.b}: gap ${item.gap}mm, required >= ${item.required}mm`;
}

function formatOverlapSummary(item: PlacementReport["overlaps"][number]) {
    return `${item.a} <-> ${item.b}: gap ${roundForMessage(item.gap)}mm, required ${roundForMessage(item.required)}mm`;
}

function physicalOverlaps(report: PlacementReport) {
    return report.overlaps.filter((overlap) => overlap.gap < 0);
}

function formatFatalOverlap(item: PlacementReport["overlaps"][number]) {
    return `fatal_overlap ${item.a}<->${item.b}: physical intersection ${roundForMessage(Math.abs(item.gap))}mm, required clearance ${roundForMessage(item.required)}mm`;
}

function formatPlacementHardErrors(report: PlacementReport) {
    const errors: string[] = [];
    const fatalOverlaps = physicalOverlaps(report);
    if (report.unplaced.length > 0) errors.push(`${report.unplaced.length} component(s) were not placed.`);
    if (report.outsideBoard.length > 0) errors.push(`${report.outsideBoard.length} component(s) are outside the board.`);
    if (fatalOverlaps.length > 0) {
        errors.push(`${fatalOverlaps.length} physical component overlap(s) have negative gap and must be fixed.`);
        errors.push(...fatalOverlaps.slice(0, 24).map(formatFatalOverlap));
    }
    const clearanceOverlaps = report.overlaps.filter((overlap) => overlap.gap >= 0);
    if (clearanceOverlaps.length > 0) errors.push(`${clearanceOverlaps.length} component clearance violation(s) remain.`);
    if (report.boardHoleViolations.length > 0) errors.push(`${report.boardHoleViolations.length} board hole keepout violation(s) remain.`);
    if (report.constraintRegionViolations.length > 0) errors.push(`${report.constraintRegionViolations.length} constraint region violation(s) remain.`);
    if (report.layerViolations.length > 0) errors.push(`${report.layerViolations.length} component layer violation(s) remain.`);
    return errors;
}

function formatOutsideBoardSummary(item: PlacementReport["outsideBoard"][number]) {
    const overflow = outsideBoardOverflow(item);
    const overflowText = Object.entries(overflow)
        .filter(([, value]) => value > 0)
        .map(([side, value]) => `${side} overflow ${roundForMessage(value)}mm`)
        .join(", ");

    return `${item.designator}${overflowText ? ` ${overflowText}` : " outside board"}`;
}

function formatBlockViolations(report: PlacementReport) {
    const blockViolations = report.blockReports
        .filter((block) => block.oversized || (block.limitViolations?.length ?? 0) > 0)
        .map((block) => {
            const limits = block.limitViolations?.length ? `: ${block.limitViolations.join("; ")}` : "";
            return `${block.name}${limits || `: actual ${roundForMessage(block.width)}x${roundForMessage(block.height)}mm, estimated ${roundForMessage(block.estimatedWidth)}x${roundForMessage(block.estimatedHeight)}mm`}`;
        });
    const moduleViolations = report.moduleReports
        .filter((module) => module.oversized || (module.limitViolations?.length ?? 0) > 0)
        .map((module) => {
            const limits = module.limitViolations?.length ? `: ${module.limitViolations.join("; ")}` : "";
            return `module ${module.name}${limits || `: actual ${roundForMessage(module.width)}x${roundForMessage(module.height)}mm`}`;
        });
    return [...blockViolations, ...moduleViolations];
}

function formatBoardHoleViolationSummary(item: PlacementReport["boardHoleViolations"][number]) {
    return `${item.designator} <-> ${item.hole}: gap ${roundForMessage(item.gap)}mm, required ${roundForMessage(item.required)}mm`;
}

function formatConstraintRegionViolationSummary(item: PlacementReport["constraintRegionViolations"][number]) {
    return `${item.designator} in block ${item.block} intersects region ${item.region} by ${roundForMessage(item.overlap)}mm`;
}

function formatLayerViolationSummary(item: PlacementReport["layerViolations"][number]) {
    return `${item.designator}: placed on ${item.layer}, allowed [${item.allowedLayers.join(", ")}]`;
}

function formatHintViolationSummary(item: PlacementReport["hintViolations"][number]) {
    return `hint ${JSON.stringify(item.hint)}: actual ${item.actual}, expected ${item.expected}`;
}

function formatGraphDiagnostics(report: PlacementReport) {
    return report.graphReport.diagnostics
        .slice(0, 24)
        .map((diagnostic) => `${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}`);
}

function formatBoardHoleViolation(item: PlacementReport["boardHoleViolations"][number]) {
    return `- ${item.designator} <-> ${item.hole}: gap ${item.gap}mm, required >= ${item.required}mm`;
}

function formatConstraintRegionViolation(item: PlacementReport["constraintRegionViolations"][number]) {
    return `- ${formatConstraintRegionViolationSummary(item)}`;
}

function formatLayerViolation(item: PlacementReport["layerViolations"][number]) {
    return `- ${item.designator}: placed on ${item.layer}, allowed [${item.allowedLayers.join(", ")}]`;
}

function formatHintViolation(item: PlacementReport["hintViolations"][number]) {
    return `- ${JSON.stringify(item.hint)}: actual ${item.actual}, expected ${item.expected}`;
}

function formatGraphDiagnostic(item: PlacementReport["graphReport"]["diagnostics"][number]) {
    const node = item.nodeId ? ` node=${item.nodeId}` : "";
    return `- ${item.severity} ${item.code}: ${item.message}${node}`;
}

function formatBlockReportLines(blockReports: PlacementReport["blockReports"]) {
    if (blockReports.length === 0) return [];
    return [
        `blocks:`,
        ...blockReports
            .slice()
            .sort((a, b) => Number(b.oversized) - Number(a.oversized) || b.areaRatio - a.areaRatio)
            .slice(0, 12)
            .map(formatBlockReport),
    ];
}

function formatBlockReport(item: PlacementReport["blockReports"][number]) {
    const marker = item.oversized ? " oversized" : "";
    const limits = item.limitViolations?.length ? `, limits=${item.limitViolations.join("; ")}` : "";
    return `- ${item.name}${marker}: actual=${item.width}x${item.height}mm area=${item.area}mm^2, estimated=${item.estimatedWidth}x${item.estimatedHeight}mm area=${item.estimatedArea}mm^2, ratio=${item.widthRatio}x/${item.heightRatio}x area=${item.areaRatio}x${limits}`;
}

function formatModuleReportLines(moduleReports: PlacementReport["moduleReports"]) {
    if (moduleReports.length === 0) return [];
    return [
        `modules:`,
        ...moduleReports
            .slice()
            .sort((a, b) => Number(b.oversized) - Number(a.oversized) || b.area - a.area)
            .slice(0, 12)
            .map(formatModuleReport),
    ];
}

function formatModuleReport(item: PlacementReport["moduleReports"][number]) {
    const marker = item.oversized ? " oversized" : "";
    const limits = item.limitViolations?.length ? `, limits=${item.limitViolations.join("; ")}` : "";
    return `- ${item.name}${marker}: actual=${item.width}x${item.height}mm area=${item.area}mm^2, blocks=[${item.blocks.join(", ")}], locked=${item.locked}${limits}`;
}

function formatBox(box: PlacementReport["outsideBoard"][number]["box"]) {
    return `{left:${roundForMessage(box.left)}, right:${roundForMessage(box.right)}, top:${roundForMessage(box.top)}, bottom:${roundForMessage(box.bottom)}}`;
}

function formatOverflow(overflow: Record<"left" | "right" | "top" | "bottom", number>) {
    return `{left:${roundForMessage(overflow.left)}mm, right:${roundForMessage(overflow.right)}mm, top:${roundForMessage(overflow.top)}mm, bottom:${roundForMessage(overflow.bottom)}mm}`;
}

function outsideBoardOverflow(item: PlacementReport["outsideBoard"][number]) {
    return {
        left: Math.max(0, item.board.left - item.box.left),
        right: Math.max(0, item.box.right - item.board.right),
        top: Math.max(0, item.board.top - item.box.top),
        bottom: Math.max(0, item.box.bottom - item.board.bottom),
    };
}

function formatDslErrorMessages(error: Error) {
    if (error instanceof ZodError) {
        return error.issues.map((issue) => {
            const path = issue.path.length ? issue.path.join(".") : "root";
            return `${path}: ${issue.message}`;
        });
    }
    return splitErrorMessage(error.message);
}

function splitErrorMessage(message: string) {
    return message
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
}

function createQualityWarnings(report: PlacementReport) {
    const warnings: string[] = [];
    const oversizedBlocks = report.blockReports.filter((block) => block.oversized);
    const oversizedModules = report.moduleReports.filter((module) => module.oversized);
    if (oversizedBlocks.length > 0) warnings.push(`${oversizedBlocks.length} block(s) exceed bbox/compactness limits.`);
    if (oversizedModules.length > 0) warnings.push(`${oversizedModules.length} module(s) exceed bbox/compactness limits.`);
    const graphWarnings = report.graphReport.diagnostics.filter((diagnostic) => diagnostic.severity === "warning");
    if (graphWarnings.length > 0) warnings.push(`${graphWarnings.length} placement graph warning(s).`);
    const unresolvedPaths = (report.signalPaths ?? []).filter((path) => !path.resolved);
    if (unresolvedPaths.length > 0) warnings.push(`${unresolvedPaths.length} signal path(s) have unresolved placement pins.`);
    return warnings;
}

function formatSignalPathViolation(path: PlacementReport["signalPaths"][number]) {
    if (!path.resolved) return `signal_path ${path.id}: one or more endpoint pads are unresolved`;
    const failed = path.segments
        .filter((segment) => !segment.withinConstraints)
        .map((segment) => `${segment.source}<->${segment.target} ${segment.distance ?? "missing"}mm`);
    return `signal_path ${path.id}: placement distance limits failed for ${failed.join(", ")}`;
}

function createSolverWarnings(report: PlacementReport) {
    const warnings: string[] = [];
    if (!report.graphReport.ok) warnings.push("Placement graph has structural diagnostics; solver may be working around invalid hierarchy.");
    if (report.blockReports.some((block) => block.components > 8)) {
        warnings.push("Some blocks are large. Large blocks reduce local solver stability; split physical subgroups when possible.");
    }
    if (report.moduleReports.some((module) => module.oversized)) {
        warnings.push("Some modules are larger than requested limits; current module placement is soft unless geometry overlaps.");
    }
    return warnings;
}

function inferLikelyCauses(report: PlacementReport, criticalPairViolations: string[]) {
    const causes: string[] = [];
    if (report.overlaps.length > 0) {
        causes.push("The local/global legalizer could not find non-overlapping positions for one or more component groups.");
    }
    if (report.outsideBoard.length > 0) {
        causes.push("One or more blocks/modules were placed too close to the board boundary or the board is too small for the requested edge clearance.");
    }
    if (report.blockReports.some((block) => block.oversized)) {
        causes.push("At least one block is stretched beyond its estimated size or explicit bbox limits.");
    }
    if (report.moduleReports.some((module) => module.oversized)) {
        causes.push("At least one module is too large for its requested envelope.");
    }
    if (criticalPairViolations.length > 0) {
        causes.push("Some critical pad-to-pad constraints are longer than requested; the owning block may be too loose or competing with clearance/edge constraints.");
    }
    if (report.graphReport.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
        causes.push("The placement hierarchy contains graph errors, such as ambiguous ownership or invalid parent/satellite relations.");
    }
    return uniqueStrings(causes).slice(0, 8);
}

function suggestPlacementFixes(report: PlacementReport, criticalPairViolations: string[]) {
    const suggestions: string[] = [];
    if (report.unplaced.length > 0) suggestions.push("Check that all listed components have valid footprints, layers, and block ownership.");
    if (report.outsideBoard.length > 0) {
        suggestions.push("Increase board size/density room or relax edge anchors for the outside-board components.");
        suggestions.push("For mechanical connectors, use edgeMount(edge, { overhang }) instead of fixed offsets.");
    }
    if (report.overlaps.length > 0) {
        suggestions.push("Split overlapping large blocks into smaller main/satellite blocks and add blockClearance only where bodies really need separation.");
        suggestions.push("If a dense IC is involved, move support blocks to specific sidePreference values and avoid many satellites on the same side.");
    }
    if (report.blockReports.some((block) => block.oversized)) {
        suggestions.push("Relax too-tight maxBbox/maxAnchorGap limits or split the oversized block into smaller physical islands.");
    }
    if (report.moduleReports.some((module) => module.oversized)) {
        suggestions.push("Keep module definitions to major family roots; do not include both a main block and its satellites unless intentionally grouping separate families.");
    }
    if (criticalPairViolations.length > 0) {
        suggestions.push("For failed critical pairs, put both components into a small coreIsland/corePairs block and avoid competing hard constraints on the same parent pin.");
    }
    if (suggestions.length === 0 && !report.ok) {
        suggestions.push("Inspect placement hard errors and reduce conflicting anchors, fixed placements, or clearance requirements.");
    }
    return uniqueStrings(suggestions).slice(0, 10);
}

function uniqueStrings(values: string[]) {
    return [...new Set(values)];
}

function roundForMessage(value: number) {
    return Number(value.toFixed(3));
}
