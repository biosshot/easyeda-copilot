import type { Box, PcbBlock, PcbComponent, PcbModule, Placement, PlacementGraphDiagnostic, PlacementInput, PlacementReport, Point } from '#types/pcb/layout-model.ts';
import { boardBox, boardHoleKeepoutRadius, boxClearanceGap, boxGap, boxPointGap, componentPairCollisionBoxPairs, dist, distanceToEdge, GEOMETRY_EPSILON, getBox, getPadWorld, PLACEMENT_EPSILON, round } from './geometry.ts';
import { componentOutsideBoard } from './fixed.ts';
import { expandHints } from './hints.ts';
import {
    blockBboxLimit,
    blockBox,
    componentPairClearance,
    canonicalModuleDesignators,
    designatorsBox,
    estimateBlockBounds,
    familyBboxLimit,
    familyBox,
    moduleBboxLimit,
    placementsCanConflict,
    pointToBoxGap,
    resolveBlockAnchorPoint,
    resolveTargetBox,
    resolveTargetPoint,
} from './report-helpers.ts';
import { buildPlacementGraph } from './placement-graph.ts';
import { evaluateSignalPathPorts } from '../pcb-auto-place-v2/path-score.ts';
import type { PlacementPathPort } from '../pcb-auto-place-v2/primitives.ts';

export function createPlacementReport(input: PlacementInput, placements: Placement[], solverDiagnostics: PlacementGraphDiagnostic[] = []): PlacementReport {
    const placementByDesignator = new Map(placements.map((placement) => [placement.designator, placement]));
    const board = boardBox(input.board);
    const outsideBoard: PlacementReport['outsideBoard'] = [];
    const overlapsReport: PlacementReport['overlaps'] = [];
    const boardHoleViolations: PlacementReport['boardHoleViolations'] = [];
    const constraintRegionViolations: PlacementReport['constraintRegionViolations'] = [];
    const layerViolations: PlacementReport['layerViolations'] = [];
    const hintViolations = createHintViolationReport(input, placements);
    const signalPaths = createSignalPathReports(input, placements);
    const blockReports = createBlockReports(input, placements);
    const moduleReports = createModuleReports(input, placements);
    const graphReport = buildPlacementGraph(input).report;
    const mergedGraphReport = solverDiagnostics.length > 0
        ? {
            ...graphReport,
            ok: graphReport.ok && !solverDiagnostics.some((diagnostic) => diagnostic.severity === 'error'),
            diagnostics: [...graphReport.diagnostics, ...solverDiagnostics],
        }
        : graphReport;

    for (const component of input.components) {
        const placement = placementByDesignator.get(component.designator);
        if (!placement) continue;
        if (component.pcb.fixedPlacement !== undefined) continue;

        const box = getBox(component, placement);
        if (componentOutsideBoard(input, component, box)) {
            outsideBoard.push({ designator: component.designator, box, board });
        }

        for (const hole of input.boardHoles ?? []) {
            const required = boardHoleKeepoutRadius(hole) + input.board.clearances.component;
            const gap = boxPointGap(box, hole);
            if (gap + PLACEMENT_EPSILON < required) {
                boardHoleViolations.push({
                    designator: component.designator,
                    hole: hole.name,
                    gap: round(gap),
                    required: round(required),
                });
            }
        }

        for (const region of input.constraintRegions ?? []) {
            if (region.allowBlocks.includes(component.block_name)) continue;
            if (!region.layers.includes(placement.layer)) continue;
            const overlap = boxOverlapDepth(box, region.box);
            if (overlap > 0) {
                constraintRegionViolations.push({
                    designator: component.designator,
                    region: region.name,
                    block: component.block_name,
                    overlap: round(overlap),
                });
            }
        }

        const allowedLayers = component.pcb.allowedLayers.length > 0 ? component.pcb.allowedLayers : input.board.allowedLayers;
        if (!allowedLayers.includes(placement.layer) || !input.board.allowedLayers.includes(placement.layer)) {
            layerViolations.push({ designator: component.designator, layer: placement.layer, allowedLayers });
        }
    }

    for (let i = 0; i < input.components.length; i++) {
        const a = input.components[i];
        const aPlacement = placementByDesignator.get(a.designator);
        if (!aPlacement) continue;

        for (let j = i + 1; j < input.components.length; j++) {
            const b = input.components[j];
            const bPlacement = placementByDesignator.get(b.designator);
            if (!bPlacement || !placementsCanConflict(a, aPlacement, b, bPlacement)) continue;

            const boxPairs = componentPairCollisionBoxPairs(a, aPlacement, b, bPlacement);
            if (boxPairs.length === 0) continue;
            const gap = Math.min(...boxPairs.map((pair) => boxClearanceGap(pair.a, pair.b)));
            const required = componentPairClearance(input, a, b);
            if (gap + PLACEMENT_EPSILON < required) {
                overlapsReport.push({ a: a.designator, b: b.designator, gap: round(gap), required });
            }
        }
    }

    const unplaced = input.components
        .filter((component) => !placementByDesignator.has(component.designator))
        .map((component) => component.designator);

    return {
        ok: outsideBoard.length === 0 && overlapsReport.length === 0 && boardHoleViolations.length === 0 && constraintRegionViolations.length === 0 && layerViolations.length === 0 && unplaced.length === 0,
        placed: placements.length,
        unplaced,
        blockReports,
        moduleReports,
        graphReport: mergedGraphReport,
        outsideBoard,
        overlaps: overlapsReport,
        boardHoleViolations,
        constraintRegionViolations,
        layerViolations,
        hintViolations,
        signalPaths,
        scoreByComponent: placements.map((placement) => ({ designator: placement.designator, score: placement.score })),
    };
}

function createSignalPathReports(input: PlacementInput, placements: Placement[]): PlacementReport['signalPaths'] {
    const placementByDesignator = new Map(placements.map((placement) => [placement.designator, placement]));
    const componentByDesignator = new Map(input.components.map((component) => [component.designator, component]));

    return (input.paths ?? []).map((path) => {
        const ports: PlacementPathPort[] = [];
        const segments = path.segments.map((segment) => {
            const source = signalPathPoint(segment.source.designator, segment.source.pin_number);
            const target = signalPathPoint(segment.target.designator, segment.target.pin_number);
            if (source) ports.push({ ...source, pathId: path.id, order: segment.index * 2, ref: formatPathPin(segment.source.designator, segment.source.pin_number), role: segment.index === 0 ? 'source' : 'exit' });
            if (target) ports.push({ ...target, pathId: path.id, order: segment.index * 2 + 1, ref: formatPathPin(segment.target.designator, segment.target.pin_number), role: segment.index === path.segments.length - 1 ? 'target' : 'entry' });
            const distance = source && target ? round(dist(source, target)) : null;
            const withinConstraints = distance !== null
                && (segment.minDistance === undefined || distance + PLACEMENT_EPSILON >= segment.minDistance)
                && (segment.maxDistance === undefined || distance <= segment.maxDistance + PLACEMENT_EPSILON);
            return {
                index: segment.index,
                source: formatPathPin(segment.source.designator, segment.source.pin_number),
                target: formatPathPin(segment.target.designator, segment.target.pin_number),
                resolved: Boolean(source && target),
                distance,
                ...(segment.minDistance === undefined ? {} : { minDistance: segment.minDistance }),
                ...(segment.maxDistance === undefined ? {} : { maxDistance: segment.maxDistance }),
                withinConstraints,
            };
        });
        const topology = evaluateSignalPathPorts(path.id, ports, {
            shape: path.shape,
            priority: path.priority,
            weight: 1,
            preferFacingPads: path.preferFacingPads,
        });
        return {
            id: path.id,
            shape: path.shape,
            priority: path.priority,
            resolved: segments.every((segment) => segment.resolved),
            withinConstraints: segments.every((segment) => segment.withinConstraints),
            directDistance: topology?.directDistance ?? null,
            pathDistance: topology?.pathDistance ?? null,
            detour: topology?.detour ?? null,
            backtrack: topology?.backtrack ?? null,
            turns: topology?.turns ?? null,
            facing: topology?.facing ?? null,
            segments,
        };

        function signalPathPoint(designator: string, pinNumber: string | number): (Point & { normal: Point }) | null {
            const component = componentByDesignator.get(designator);
            const placement = placementByDesignator.get(designator);
            if (!component || !placement) return null;
            const point = getPadWorld(component, placement, pinNumber);
            if (!point) return null;
            const vector = { x: point.x - placement.x, y: point.y - placement.y };
            const length = Math.hypot(vector.x, vector.y);
            return {
                ...point,
                normal: length > 0.000001 ? { x: vector.x / length, y: vector.y / length } : { x: 0, y: 0 },
            };
        }
    });
}

function formatPathPin(designator: string, pinNumber: string | number) {
    return `${designator}.${String(pinNumber)}`;
}

function boxOverlapDepth(a: Box, b: Box) {
    const x = Math.min(a.right - b.left, b.right - a.left);
    const y = Math.min(a.bottom - b.top, b.bottom - a.top);
    return Math.max(0, Math.min(x, y));
}

function createModuleReports(input: PlacementInput, placements: Placement[]): PlacementReport['moduleReports'] {
    const placementByDesignator = new Map(placements.map((placement) => [placement.designator, placement]));
    const componentsByDesignator = new Map(input.components.map((component) => [component.designator, component]));

    return (input.modules ?? []).flatMap((module) => {
        const designators = canonicalModuleDesignators(input, module);
        const box = designatorsBox([...designators], placementByDesignator, componentsByDesignator);
        if (!box) return [];

        const width = box.right - box.left;
        const height = box.bottom - box.top;
        const area = width * height;
        const limitViolations = moduleLimitViolations(input, module, box, componentsByDesignator);

        return [{
            name: module.name,
            blocks: module.block_names,
            components: designators.size,
            box,
            width: round(width),
            height: round(height),
            area: round(area),
            limitViolations,
            oversized: limitViolations.length > 0,
            locked: module.lockInternalAfterPlace !== false,
        }];
    });
}

function createHintViolationReport(input: PlacementInput, placements: Placement[]) {
    const placementByDesignator = new Map(placements.map((placement) => [placement.designator, placement]));
    const componentsByDesignator = new Map(input.components.map((component) => [component.designator, component]));
    const violations: PlacementReport['hintViolations'] = [];

    for (const hint of input.hints) {
        for (const rule of expandHints({ ...input, hints: [hint] })) {
            if (rule.kind === 'distance' && rule.target) {
                const source = resolveTargetPoint(input, rule.source, placementByDesignator, componentsByDesignator);
                const target = resolveTargetPoint(input, rule.target, placementByDesignator, componentsByDesignator);
                if (!source || !target) {
                    violations.push({ hint, actual: 'unresolved', expected: 'both targets resolved' });
                    continue;
                }

                const actual = dist(source, target);
                if (rule.min !== undefined && actual < rule.min) {
                    violations.push({ hint, actual: round(actual), expected: `>= ${rule.min}mm` });
                }
                if (rule.max !== undefined && actual > rule.max) {
                    violations.push({ hint, actual: round(actual), expected: `<= ${rule.max}mm` });
                }
            }

            if (rule.kind === 'clearance' && rule.target && rule.target !== 'all') {
                const source = resolveTargetBox(input, rule.source, placementByDesignator, componentsByDesignator);
                const target = resolveTargetBox(input, rule.target, placementByDesignator, componentsByDesignator);
                if (!source || !target) {
                    violations.push({ hint, actual: 'unresolved', expected: 'both target boxes resolved' });
                    continue;
                }

                const actual = boxClearanceGap(source, target);
                if (rule.min !== undefined && actual + PLACEMENT_EPSILON < rule.min) {
                    violations.push({ hint, actual: round(actual), expected: `>= ${rule.min}mm clearance` });
                }
            }

            if (rule.kind === 'same_side' && rule.source.type === 'component' && rule.target && rule.target !== 'all' && rule.target.type === 'component') {
                const source = placementByDesignator.get(rule.source.designator);
                const target = placementByDesignator.get(rule.target.designator);
                if (source && target && source.layer !== target.layer) {
                    violations.push({ hint, actual: `${source.layer}/${target.layer}`, expected: 'same layer' });
                }
            }

            if (rule.kind === 'edge' && rule.edge && rule.source.type === 'component') {
                const component = componentsByDesignator.get(rule.source.designator);
                const placement = placementByDesignator.get(rule.source.designator);
                if (!component || !placement) {
                    violations.push({ hint, actual: 'unresolved', expected: 'component placed' });
                    continue;
                }

                const actual = distanceToEdge(input.board, component, placement, rule.edge);
                if (rule.max !== undefined && actual > rule.max) {
                    violations.push({ hint, actual: round(actual), expected: `<= ${rule.max}mm from ${rule.edge} edge` });
                }
                if (rule.min !== undefined && actual < rule.min) {
                    violations.push({ hint, actual: round(actual), expected: `>= ${rule.min}mm from ${rule.edge} edge` });
                }
            }

            if (rule.kind === 'prefer_layer' && rule.source.type === 'component' && rule.layer) {
                const placement = placementByDesignator.get(rule.source.designator);
                if (placement && placement.layer !== rule.layer) {
                    violations.push({ hint, actual: placement.layer, expected: rule.layer });
                }
            }
        }
    }

    return violations;
}

function createBlockReports(input: PlacementInput, placements: Placement[]): PlacementReport['blockReports'] {
    const placementByDesignator = new Map(placements.map((placement) => [placement.designator, placement]));
    const componentsByDesignator = new Map(input.components.map((component) => [component.designator, component]));

    return input.blocks.flatMap((block) => {
        const box = blockBox(input, block.name, placementByDesignator, componentsByDesignator);
        if (!box) return [];

        const estimate = estimateBlockBounds(input, block, componentsByDesignator);
        const width = box.right - box.left;
        const height = box.bottom - box.top;
        const area = width * height;
        const widthRatio = estimate.width > 0 ? width / estimate.width : 1;
        const heightRatio = estimate.height > 0 ? height / estimate.height : 1;
        const areaRatio = estimate.area > 0 ? area / estimate.area : 1;
        const limitViolations = blockLimitViolations(input, block, box, placementByDesignator, componentsByDesignator);

        return [{
            name: block.name,
            components: block.component_designators.length,
            box,
            width: round(width),
            height: round(height),
            area: round(area),
            estimatedWidth: estimate.width,
            estimatedHeight: estimate.height,
            estimatedArea: estimate.area,
            widthRatio: round(widthRatio),
            heightRatio: round(heightRatio),
            areaRatio: round(areaRatio),
            oversized: widthRatio > 1.6 || heightRatio > 1.6 || areaRatio > 2.2 || limitViolations.length > 0,
            limitViolations,
        }];
    });
}

function blockLimitViolations(
    input: PlacementInput,
    block: PcbBlock,
    box: Box,
    placements: Map<string, Placement>,
    componentsByDesignator: Map<string, PcbComponent>,
) {
    const violations: string[] = [];
    const width = box.right - box.left;
    const height = box.bottom - box.top;
    const blockLimit = blockBboxLimit(input, block, componentsByDesignator);
    if (blockLimit.maxWidth && width > blockLimit.maxWidth + GEOMETRY_EPSILON) {
        violations.push(`block width ${round(width)}mm > ${round(blockLimit.maxWidth)}mm`);
    }
    if (blockLimit.maxHeight && height > blockLimit.maxHeight + GEOMETRY_EPSILON) {
        violations.push(`block height ${round(height)}mm > ${round(blockLimit.maxHeight)}mm`);
    }

    if (block.anchor && block.maxAnchorGap) {
        const target = resolveBlockAnchorPoint(input, block, placements, componentsByDesignator);
        const gap = target ? pointToBoxGap(target, box) : null;
        if (gap !== null && gap > block.maxAnchorGap + GEOMETRY_EPSILON) {
            violations.push(`anchor gap ${round(gap)}mm > ${round(block.maxAnchorGap)}mm`);
        }
    }

    const familyLimit = familyBboxLimit(input, block, componentsByDesignator);
    const familyBoxValue = familyBox(input, block, placements, componentsByDesignator);
    if (familyBoxValue && (familyLimit.maxWidth || familyLimit.maxHeight)) {
        const familyWidth = familyBoxValue.right - familyBoxValue.left;
        const familyHeight = familyBoxValue.bottom - familyBoxValue.top;
        if (familyLimit.maxWidth && familyWidth > familyLimit.maxWidth + GEOMETRY_EPSILON) {
            violations.push(`family width ${round(familyWidth)}mm > ${round(familyLimit.maxWidth)}mm`);
        }
        if (familyLimit.maxHeight && familyHeight > familyLimit.maxHeight + GEOMETRY_EPSILON) {
            violations.push(`family height ${round(familyHeight)}mm > ${round(familyLimit.maxHeight)}mm`);
        }
    }

    return violations;
}

function moduleLimitViolations(
    input: PlacementInput,
    module: PcbModule,
    box: Box,
    componentsByDesignator: Map<string, PcbComponent>,
) {
    const violations: string[] = [];
    const width = box.right - box.left;
    const height = box.bottom - box.top;
    const limit = moduleBboxLimit(input, module, componentsByDesignator);

    if (limit.maxWidth && width > limit.maxWidth + GEOMETRY_EPSILON) {
        violations.push(`module width ${round(width)}mm > ${round(limit.maxWidth)}mm`);
    }
    if (limit.maxHeight && height > limit.maxHeight + GEOMETRY_EPSILON) {
        violations.push(`module height ${round(height)}mm > ${round(limit.maxHeight)}mm`);
    }

    return violations;
}
