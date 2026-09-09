import type {
    Box,
    BoardEdge,
    BlockRole,
    Layer,
    PcbComponent,
    Placement,
    PlacementGraph,
    PlacementInput,
    PlacementRelation,
    PlacementTreeNode,
    Point,
    TargetRef,
} from '#types/pcb/layout-model.ts';
import { componentBox, roundPlacement, rotatedSize } from '../pcb-auto-place/geometry.ts';
import { createFixedPlacement } from '../pcb-auto-place/fixed.ts';
import { createClearanceResolver, type ClearanceResolver } from '../pcb-auto-place/clearance-resolver.ts';
import { validatePrimitive } from '../pcb-auto-place/primitive-validation.ts';
import { solveBoardPrimitives } from './board-solver.ts';
import { solveBlockPrimitives } from './block-solver-engine.ts';
import { solvePlacementIslands } from './island-solver.ts';
import { solveModulePrimitives } from './module-solver.ts';
import { canSolvePassiveNetIsland } from './passive-net-island.ts';
import { solvePassiveNetIslandPrimitive } from './passive-net-island-engine.ts';
import {
    type PlacementConnectionPoint,
    type PlacementPathPort,
    type PlacementPrimitive,
    type PrimitiveSolveDiagnostic,
    translatePrimitive,
    unionPrimitive,
} from './primitives.ts';
import { getPcbSubtreeWorkerPoolConfig, solvePlacementSubtreeQueued } from './tree-subtree-pool.ts';
import {
    emitPcbLayoutProgress,
    pcbLayoutProgress,
    PCB_LAYOUT_PROGRESS,
    type PcbLayoutProgressReporter,
    type PcbLayoutProgressStage,
} from '../progress.ts';

export interface TreeSolverOptions {
    grid?: number;
    clearance?: number;
    compactness?: 'normal' | 'high';
    onProgress?: PcbLayoutProgressReporter;
    logProgress?: boolean;
}

export interface TreeSolveResult {
    root: PlacementPrimitive;
    primitives: PlacementPrimitive[];
    diagnostics: PrimitiveSolveDiagnostic[];
}

export function solvePlacementTreeBottomUp(
    input: PlacementInput,
    graph: PlacementGraph,
    options: TreeSolverOptions = {},
): TreeSolveResult {
    const context = createTreeSolveContext(input, graph, options);
    const root = solveNode(context, graph.root);
    return { root, primitives: context.primitives, diagnostics: context.diagnostics };
}

export async function solvePlacementTreeBottomUpAsync(
    input: PlacementInput,
    graph: PlacementGraph,
    options: TreeSolverOptions = {},
): Promise<TreeSolveResult> {
    const context = createTreeSolveContext(input, graph, options);
    const root = await solveNodeAsync(context, graph.root);
    return { root, primitives: context.primitives, diagnostics: context.diagnostics };
}

export function solvePlacementSubtreeSync(params: {
    input: PlacementInput;
    graph: PlacementGraph;
    node: PlacementTreeNode;
    options?: TreeSolverOptions;
}): TreeSolveResult {
    const context = createTreeSolveContext(params.input, params.graph, params.options ?? {});
    const root = solveNode(context, params.node);
    return { root, primitives: context.primitives, diagnostics: context.diagnostics };
}

type TreeSolveContext = {
    input: PlacementInput;
    graph: PlacementGraph;
    componentByDesignator: Map<string, PcbComponent>;
    blockRoleByName: Map<string, BlockRole>;
    treeNodes: PlacementTreeNode[];
    grid: number;
    clearance: number;
    clearanceResolver: ClearanceResolver;
    compactness: 'normal' | 'high';
    onProgress?: PcbLayoutProgressReporter;
    logProgress: boolean;
    emittedProgressStages: Set<PcbLayoutProgressStage>;
    primitives: PlacementPrimitive[];
    diagnostics: PrimitiveSolveDiagnostic[];
};

function createTreeSolveContext(
    input: PlacementInput,
    graph: PlacementGraph,
    options: TreeSolverOptions,
): TreeSolveContext {
    return {
        input,
        graph,
        componentByDesignator: new Map(input.components.map((component) => [component.designator, component])),
        blockRoleByName: new Map(input.blocks.map((block) => [block.name, block.role])),
        treeNodes: allTreeNodes(graph.root),
        grid: options.grid ?? input.solverOptions.placementGridStep ?? 0.5,
        clearance: options.clearance ?? input.board.clearances.component ?? 0.8,
        clearanceResolver: createClearanceResolver(input),
        compactness: options.compactness ?? input.solverOptions.compactness ?? 'normal',
        onProgress: options.onProgress,
        logProgress: Boolean(options.logProgress),
        emittedProgressStages: new Set(),
        primitives: [],
        diagnostics: [],
    };
}

function solveNode(
    context: TreeSolveContext,
    node: PlacementTreeNode,
    clearance = context.clearance,
    parent?: PlacementTreeNode,
): PlacementPrimitive {
    if (node.kind === 'component') {
        return rememberPrimitive(context, componentPrimitive(context, node, parent));
    }
    if (node.kind === 'pad') {
        return emptyPrimitive(node);
    }

    const effectiveClearance = node.kind === 'block'
        ? numeric(node.data?.placementClearance) ?? clearance
        : clearance;
    const childPrimitives: PlacementPrimitive[] = [];
    const coveredComponents = new Set<string>();
    const deferredRelations: string[] = [];
    const directComponents = new Set(node.children
        .filter((child) => child.kind === 'component')
        .map((child) => child.label));

    for (const child of sortedIslandChildren(node)) {
        const islandComponents = islandComponentLabels(child);
        if (!isSubset(islandComponents, directComponents)) {
            deferredRelations.push(child.id);
            context.diagnostics.push({
                severity: 'warning',
                nodeId: child.id,
                message: `Deferred parent-level island ${child.label}; it references child primitives outside direct node components`,
            });
            continue;
        }
        if (setsIntersect(islandComponents, coveredComponents)) {
            deferredRelations.push(child.id);
            context.diagnostics.push({
                severity: 'warning',
                nodeId: child.id,
                message: `Deferred overlapping island ${child.label}; lower-level primitive already owns one of its components`,
            });
            continue;
        }
        const primitive = islandPrimitive(context, child, effectiveClearance);
        childPrimitives.push(primitive);
        for (const designator of islandComponents) coveredComponents.add(designator);
    }

    const passivePrimitive = passiveNetIslandPrimitive(context, node, coveredComponents, effectiveClearance);
    if (passivePrimitive) {
        childPrimitives.push(passivePrimitive);
        for (const placement of passivePrimitive.placements) coveredComponents.add(placement.designator);
    }

    for (const child of node.children) {
        if (child.kind === 'island') continue;
        if (child.kind === 'component' && coveredComponents.has(child.label)) continue;
        childPrimitives.push(solveNode(context, child, effectiveClearance, node));
    }

    const arranged = node.kind === 'board'
        ? solveBoardPrimitives({
            input: context.input,
            graph: context.graph,
            node,
            childPrimitives,
            grid: context.grid,
            clearance: context.clearance,
            componentByDesignator: context.componentByDesignator,
            blockRoleByName: context.blockRoleByName,
            clearanceResolver: context.clearanceResolver,
            compactness: context.compactness,
            diagnostics: context.diagnostics,
        })
        : node.kind === 'block'
        ? solveBlockNode(context, node, childPrimitives, effectiveClearance)
        : node.kind === 'module'
            ? solveModuleNode(context, node, childPrimitives, effectiveClearance)
        : packPrimitives(childPrimitives, context.grid, effectiveClearance);
    const primitive = unionPrimitive(
        primitiveId(node),
        node.kind === 'board' ? 'board' : node.kind === 'module' ? 'module' : node.kind === 'block' ? 'block' : 'island',
        node.label,
        node.id,
        arranged,
        deferredRelations,
    );
    const validation = validatePrimitive(context.input, primitive, {
        clearanceResolver: context.clearanceResolver,
        bounds: node.kind === 'board' ? boardBounds(context.input) : undefined,
        edgeClearance: node.kind === 'board' ? context.input.board.clearances.edge : undefined,
        checkHoles: node.kind === 'board',
        checkFixed: node.kind === 'board',
    });
    for (const violation of validation.violations) {
        context.diagnostics.push({ severity: 'error', nodeId: node.id, message: violation.message });
    }
    return rememberPrimitive(context, primitive);
}

async function solveNodeAsync(
    context: TreeSolveContext,
    node: PlacementTreeNode,
    clearance = context.clearance,
    parent?: PlacementTreeNode,
): Promise<PlacementPrimitive> {
    if (node.kind === 'component' || node.kind === 'pad') return solveNode(context, node, clearance, parent);
    emitTreeProgressOnce(context, 'solve_islands', PCB_LAYOUT_PROGRESS.solveIslands, 'Solving placement islands and local primitives.');

    const effectiveClearance = node.kind === 'block'
        ? numeric(node.data?.placementClearance) ?? clearance
        : clearance;
    const childPrimitives: PlacementPrimitive[] = [];
    const coveredComponents = new Set<string>();
    const deferredRelations: string[] = [];
    const directComponents = new Set(node.children
        .filter((child) => child.kind === 'component')
        .map((child) => child.label));

    for (const child of sortedIslandChildren(node)) {
        const islandComponents = islandComponentLabels(child);
        if (!isSubset(islandComponents, directComponents)) {
            deferredRelations.push(child.id);
            context.diagnostics.push({
                severity: 'warning',
                nodeId: child.id,
                message: `Deferred parent-level island ${child.label}; it references child primitives outside direct node components`,
            });
            continue;
        }
        if (setsIntersect(islandComponents, coveredComponents)) {
            deferredRelations.push(child.id);
            context.diagnostics.push({
                severity: 'warning',
                nodeId: child.id,
                message: `Deferred overlapping island ${child.label}; lower-level primitive already owns one of its components`,
            });
            continue;
        }
        const primitive = islandPrimitive(context, child, effectiveClearance);
        childPrimitives.push(primitive);
        for (const designator of islandComponents) coveredComponents.add(designator);
    }

    const passivePrimitive = passiveNetIslandPrimitive(context, node, coveredComponents, effectiveClearance);
    if (passivePrimitive) {
        childPrimitives.push(passivePrimitive);
        for (const placement of passivePrimitive.placements) coveredComponents.add(placement.designator);
    }

    const childTasks = node.children
        .filter((child) => child.kind !== 'island')
        .filter((child) => child.kind !== 'component' || !coveredComponents.has(child.label))
        .map(async (child) => solveChildNodeAsync(context, node, child, effectiveClearance));
    childPrimitives.push(...await Promise.all(childTasks));

    let arranged: PlacementPrimitive[];
    if (node.kind === 'board') {
        emitTreeProgressOnce(context, 'solve_blocks', PCB_LAYOUT_PROGRESS.solveBlocks, 'Solving placement blocks.');
        emitTreeProgressOnce(context, 'solve_modules', PCB_LAYOUT_PROGRESS.solveModules, 'Solving placement modules.');
        emitTreeProgressOnce(context, 'solve_board', PCB_LAYOUT_PROGRESS.solveBoard, 'Solving board-level placement.');
        arranged = solveBoardPrimitives({
            input: context.input,
            graph: context.graph,
            node,
            childPrimitives,
            grid: context.grid,
            clearance: context.clearance,
            componentByDesignator: context.componentByDesignator,
            blockRoleByName: context.blockRoleByName,
            clearanceResolver: context.clearanceResolver,
            compactness: context.compactness,
            diagnostics: context.diagnostics,
        });
    } else if (node.kind === 'block') {
        arranged = solveBlockNode(context, node, childPrimitives, effectiveClearance);
    } else if (node.kind === 'module') {
        emitTreeProgressOnce(context, 'solve_blocks', PCB_LAYOUT_PROGRESS.solveBlocks, 'Solving placement blocks.');
        arranged = solveModuleNode(context, node, childPrimitives, effectiveClearance);
    } else {
        arranged = packPrimitives(childPrimitives, context.grid, effectiveClearance);
    }
    const primitive = unionPrimitive(
        primitiveId(node),
        node.kind === 'board' ? 'board' : node.kind === 'module' ? 'module' : node.kind === 'block' ? 'block' : 'island',
        node.label,
        node.id,
        arranged,
        deferredRelations,
    );
    const validation = validatePrimitive(context.input, primitive, {
        clearanceResolver: context.clearanceResolver,
        bounds: node.kind === 'board' ? boardBounds(context.input) : undefined,
        edgeClearance: node.kind === 'board' ? context.input.board.clearances.edge : undefined,
        checkHoles: node.kind === 'board',
        checkFixed: node.kind === 'board',
    });
    for (const violation of validation.violations) {
        context.diagnostics.push({ severity: 'error', nodeId: node.id, message: violation.message });
    }
    return rememberPrimitive(context, primitive);
}

function emitTreeProgressOnce(
    context: TreeSolveContext,
    stage: PcbLayoutProgressStage,
    progress: number,
    content: string,
) {
    if (context.emittedProgressStages.has(stage)) return;
    context.emittedProgressStages.add(stage);
    const event = pcbLayoutProgress(stage, progress, content);
    if (context.logProgress) console.error(`[pcb-layout] ${event.progress}% ${event.stage}: ${event.content}`);
    emitPcbLayoutProgress(context.onProgress, event);
}

async function solveChildNodeAsync(
    context: TreeSolveContext,
    parent: PlacementTreeNode,
    child: PlacementTreeNode,
    clearance: number,
) {
    if (!shouldSolveChildInWorker(parent, child)) return solveNode(context, child, clearance, parent);
    try {
        const result = await solvePlacementSubtreeQueued({
            input: context.input,
            graph: context.graph,
            node: child,
            options: {
                grid: context.grid,
                clearance,
                compactness: context.compactness,
            },
        });
        context.primitives.push(...result.primitives);
        context.diagnostics.push(...result.diagnostics);
        return result.root;
    } catch (error) {
        context.diagnostics.push({
            severity: 'warning',
            nodeId: child.id,
            message: `Subtree worker failed for ${child.label}; solved synchronously instead: ${(error as Error).message}`,
        });
        return solveNode(context, child, clearance, parent);
    }
}

function shouldSolveChildInWorker(parent: PlacementTreeNode, child: PlacementTreeNode) {
    if (parent.kind !== 'board') return false;
    if (child.kind !== 'module' && child.kind !== 'block') return false;
    const config = getPcbSubtreeWorkerPoolConfig();
    if (config.maxWorkers <= 0) return false;
    if (hasFixedOrEdgeDescendant(child)) return false;
    return countComponentDescendants(child) >= config.minComponents;
}

function hasFixedOrEdgeDescendant(node: PlacementTreeNode): boolean {
    if (node.data?.fixed === true || node.data?.edgeMount === true || node.data?.edgePlace === true) return true;
    return node.children.some(hasFixedOrEdgeDescendant);
}

function countComponentDescendants(node: PlacementTreeNode): number {
    const own = node.kind === 'component' ? 1 : 0;
    return own + node.children.reduce((sum, child) => sum + countComponentDescendants(child), 0);
}

function solveBlockNode(
    context: TreeSolveContext,
    node: PlacementTreeNode,
    childPrimitives: PlacementPrimitive[],
    clearance = context.clearance,
) {
    const hasLockedChild = childPrimitives.some((primitive) => primitive.locked);
    return solveBlockPrimitives({
        node,
        primitives: childPrimitives,
        relations: relationsForPrimitives(context.graph.relations, node.id, childPrimitives),
        options: {
            grid: context.grid,
            clearance: numeric(node.data?.placementClearance) ?? clearance,
            componentByDesignator: context.componentByDesignator,
            blockRoleByName: context.blockRoleByName,
            clearanceResolver: context.clearanceResolver,
            compactness: context.compactness,
            targetWidth: numeric(node.data?.maxBboxWidth),
            targetHeight: numeric(node.data?.maxBboxHeight),
            bounds: hasLockedChild ? boardBounds(context.input) : undefined,
            obstacles: hasLockedChild ? boardHoleBoxes(context.input) : undefined,
        },
    });
}

function solveModuleNode(
    context: TreeSolveContext,
    node: PlacementTreeNode,
    childPrimitives: PlacementPrimitive[],
    clearance = context.clearance,
) {
    const hasLockedChild = childPrimitives.some((primitive) => primitive.locked);
    return solveModulePrimitives({
        node,
        primitives: childPrimitives,
        relations: relationsForPrimitives(context.graph.relations, node.id, childPrimitives),
        options: {
            grid: context.grid,
            clearance: clearance,
            componentByDesignator: context.componentByDesignator,
            blockRoleByName: context.blockRoleByName,
            clearanceResolver: context.clearanceResolver,
            compactness: context.compactness,
            targetWidth: numeric(node.data?.maxWidth),
            targetHeight: numeric(node.data?.maxHeight),
            bounds: hasLockedChild ? boardBounds(context.input) : undefined,
            obstacles: hasLockedChild ? boardHoleBoxes(context.input) : undefined,
        },
    });
}

function boardHoleBoxes(input: PlacementInput): Box[] {
    return (input.boardHoles ?? []).map((hole) => {
        const radius = Math.max(hole.keepout, hole.diameter / 2, hole.drill / 2);
        return {
            left: hole.x - radius,
            right: hole.x + radius,
            top: hole.y - radius,
            bottom: hole.y + radius,
        };
    });
}

function islandPrimitive(context: TreeSolveContext, node: PlacementTreeNode, clearance = context.clearance): PlacementPrimitive {
    const result = solvePlacementIslands(context.input, { ...context.graph, root: node }, {
        grid: context.grid,
        clearance,
    })[0];
    if (!result) return emptyPrimitive(node);
    const components = result.placements
        .map((placement) => context.componentByDesignator.get(placement.designator))
        .filter((component): component is PcbComponent => Boolean(component));
    const connectionPoints = connectionPointsForPlacements(components, result.placements);
    return rememberPrimitive(context, {
        id: primitiveId(node),
        kind: 'island',
        label: node.label,
        sourceNodeId: node.id,
        canRotate: true,
        allowedOrientations: allowedOrientationsForPlacements(context, result.placements),
        bbox: result.bbox,
        collisionBoxes: result.placements.map((placement) => {
            const component = components.find((item) => item.designator === placement.designator);
            return component ? componentBox(component, placement) : null;
        }).filter((box): box is Box => Boolean(box)),
        width: result.width,
        height: result.height,
        placements: result.placements,
        connectionPoints,
        pathPorts: pathPortsForPlacements(context, result.placements, connectionPoints),
        children: [],
    });
}

function componentPrimitive(context: TreeSolveContext, node: PlacementTreeNode, parent?: PlacementTreeNode): PlacementPrimitive {
    const component = context.componentByDesignator.get(node.label);
    if (!component) return emptyPrimitive(node);
    const fixed = createFixedPlacement(context.input, component);
    const layer = fixed?.layer ?? component.pcb.allowedLayers[0] ?? 'top';
    const rotate = fixed?.rotate ?? chooseInitialComponentRotation(context, component, layer, parent);
    const placement = fixed ?? { designator: component.designator, x: 0, y: 0, rotate, layer, score: 0 };
    const bbox = componentBox(component, placement);
    const connectionPoints = connectionPointsForPlacements([component], [placement]);
    return {
        id: primitiveId(node),
        kind: 'component',
        label: node.label,
        sourceNodeId: node.id,
        locked: Boolean(fixed),
        canRotate: !fixed,
        allowedOrientations: fixed ? [0] : allowedOrientationsForComponent(component, rotate),
        bbox,
        collisionBoxes: [bbox],
        width: roundPlacement(bbox.right - bbox.left),
        height: roundPlacement(bbox.bottom - bbox.top),
        placements: [placement],
        connectionPoints,
        pathPorts: pathPortsForPlacements(context, [placement], connectionPoints),
        children: [],
    };
}

function chooseInitialComponentRotation(
    context: TreeSolveContext,
    component: PcbComponent,
    layer: Layer,
    parent?: PlacementTreeNode,
) {
    const rotations = normalizedAllowedRotations(component);
    if (component.pcb.role !== 'main_ic' || rotations.length <= 1) return rotations[0] ?? 0;

    const sideTargets = localSideAnchorTargets(context, component, parent);
    const targets = fixedExternalNetTargets(context, component);
    if (sideTargets.length === 0 && targets.length === 0) return rotations[0] ?? 0;

    let bestRotation = rotations[0] ?? 0;
    let bestScore = Infinity;
    for (const rotate of rotations) {
        let score = 0;
        for (const pin of component.pins) {
            const pad = component.footprint.pads.find((item) => String(item.pin_number) === String(pin.pin_number));
            if (!pad) continue;
            const sourceVector = padOffset(pad, rotate, layer);
            const sourceDirection = normalizeVector(sourceVector);
            if (!sourceDirection) continue;

            for (const target of sideTargets) {
                if (String(target.pin) !== String(pin.pin_number)) continue;
                score += (1 - dot(sourceDirection, target.direction)) * target.weight;
            }

            if (ignoredNet(context, pin.signal_name)) continue;
            for (const target of targets) {
                if (target.net !== pin.signal_name) continue;
                const targetDirection = normalizeVector(target.point);
                if (!targetDirection) continue;
                const alignment = dot(sourceDirection, targetDirection);
                score += (1 - alignment) * target.weight;
            }
        }
        if (score < bestScore - 0.0001) {
            bestScore = score;
            bestRotation = rotate;
        }
    }

    return bestRotation;
}

function fixedExternalNetTargets(context: TreeSolveContext, source: PcbComponent) {
    const targets: Array<{ net: string; point: Point; weight: number }> = [];
    for (const component of context.input.components) {
        if (component.designator === source.designator) continue;
        const fixed = createFixedPlacement(context.input, component);
        if (!fixed) continue;
        const roleWeight = component.pcb.role === 'connector' ? 2.5 : component.pcb.role === 'main_ic' ? 1.3 : 1;
        for (const pin of component.pins) {
            if (ignoredNet(context, pin.signal_name)) continue;
            const point = padWorld(component, fixed, pin.pin_number);
            if (!point) continue;
            targets.push({
                net: pin.signal_name,
                point,
                weight: roleWeight * netSignalWeight(pin.signal_name),
            });
        }
    }
    return targets;
}

function localSideAnchorTargets(context: TreeSolveContext, component: PcbComponent, parent?: PlacementTreeNode) {
    if (!parent) return [];
    const targets: Array<{ pin: string | number; direction: Point; weight: number }> = [];
    for (const node of context.treeNodes) {
        if (node.kind !== 'block') continue;
        const attachedToParent = node.data?.attachTo === parent.label;
        const directChild = parent.children.includes(node);
        if (!attachedToParent && !directChild) continue;
        const target = sideAnchorTargetForBlock(component, node);
        if (target) targets.push(target);
    }
    return targets;
}

function sideAnchorTargetForBlock(component: PcbComponent, node: PlacementTreeNode) {
    const side = boardEdge(node.data?.sidePreference);
    const anchor = pinAnchor(node.data?.anchor);
    if (!side || !anchor || anchor.designator !== component.designator) return null;

    const hardWeight = node.data?.hardAnchor === true ? 2 : 1;
    const gap = numeric(node.data?.maxAnchorGap);
    const gapWeight = gap !== undefined && gap <= 5 ? 1.4 : 1;
    return {
        pin: anchor.pin,
        direction: sideDirection(side),
        weight: 80 * hardWeight * gapWeight,
    };
}

function allTreeNodes(root: PlacementTreeNode): PlacementTreeNode[] {
    const nodes = [root];
    for (const child of root.children) nodes.push(...allTreeNodes(child));
    return nodes;
}

function pinAnchor(value: unknown) {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as { type?: unknown; designator?: unknown; pin_number?: unknown };
    if (candidate.type !== 'pin') return null;
    if (typeof candidate.designator !== 'string') return null;
    if (typeof candidate.pin_number !== 'string' && typeof candidate.pin_number !== 'number') return null;
    return { designator: candidate.designator, pin: candidate.pin_number };
}

function boardEdge(value: unknown): BoardEdge | null {
    return value === 'left' || value === 'right' || value === 'top' || value === 'bottom' ? value : null;
}

function sideDirection(side: BoardEdge): Point {
    if (side === 'left') return { x: -1, y: 0 };
    if (side === 'right') return { x: 1, y: 0 };
    if (side === 'top') return { x: 0, y: -1 };
    return { x: 0, y: 1 };
}

function passiveNetIslandPrimitive(
    context: TreeSolveContext,
    node: PlacementTreeNode,
    coveredComponents: Set<string>,
    clearance = context.clearance,
): PlacementPrimitive | null {
    if (node.kind !== 'block') return null;
    if (node.children.some((child) => child.kind === 'block' || child.kind === 'module')) return null;
    const components = node.children
        .filter((child) => child.kind === 'component' && !coveredComponents.has(child.label))
        .map((child) => context.componentByDesignator.get(child.label))
        .filter((component): component is PcbComponent => Boolean(component));
    const pathDesignators = new Set(context.graph.paths.flatMap((path) => path.segments.flatMap((segment) => [
        segment.source.designator,
        segment.target.designator,
    ])));
    if (components.some((component) => pathDesignators.has(component.designator))) return null;
    if (!canSolvePassiveNetIsland(components)) return null;
    const primitive = solvePassiveNetIslandPrimitive(node, components, {
        grid: context.grid,
        clearance: numeric(node.data?.placementClearance) ?? clearance,
        clearanceResolver: context.clearanceResolver,
    });
    return primitive ? rememberPrimitive(context, {
        ...primitive,
        canRotate: true,
        allowedOrientations: allowedOrientationsForPlacements(context, primitive.placements),
        pathPorts: pathPortsForPlacements(context, primitive.placements, primitive.connectionPoints),
    }) : null;
}

function packPrimitives(primitives: PlacementPrimitive[], grid: number, clearance: number): PlacementPrimitive[] {
    if (primitives.length <= 1) return primitives;
    const sorted = primitives.slice().sort((a, b) => b.height - a.height || b.width - a.width);
    const totalWidth = sorted.reduce((sum, primitive) => sum + primitive.width, 0) + clearance * (sorted.length - 1);
    let cursor = -totalWidth / 2;
    return sorted.map((primitive) => {
        const dx = snap(cursor + primitive.width / 2 - (primitive.bbox.left + primitive.bbox.right) / 2, grid);
        const dy = snap(-(primitive.bbox.top + primitive.bbox.bottom) / 2, grid);
        cursor += primitive.width + clearance;
        return translatePrimitive(primitive, dx, dy);
    });
}

function connectionPointsForPlacements(components: PcbComponent[], placements: Placement[]): PlacementConnectionPoint[] {
    const points: PlacementConnectionPoint[] = [];
    for (const placement of placements) {
        const component = components.find((item) => item.designator === placement.designator);
        if (!component) continue;
        for (const pin of component.pins) {
            const point = padWorld(component, placement, pin.pin_number);
            if (!point) continue;
            points.push({
                ref: `${component.designator}.${String(pin.pin_number)}`,
                net: pin.signal_name,
                x: point.x,
                y: point.y,
            });
        }
    }
    return points;
}

function pathPortsForPlacements(
    context: TreeSolveContext,
    placements: Placement[],
    connectionPoints: PlacementConnectionPoint[],
): PlacementPathPort[] {
    if ((context.graph.paths?.length ?? 0) === 0) return [];
    const placementByDesignator = new Map(placements.map((placement) => [placement.designator, placement]));
    const pointByRef = new Map(connectionPoints.map((point) => [point.ref, point]));
    const ports: PlacementPathPort[] = [];
    for (const path of context.graph.paths) {
        for (const segment of path.segments) {
            addPathPort(segment.source, segment.index * 2, segment.index === 0 ? 'source' : 'exit');
            addPathPort(segment.target, segment.index * 2 + 1, segment.index === path.segments.length - 1 ? 'target' : 'entry');
        }

        function addPathPort(
            target: Extract<TargetRef, { type: 'pin' }>,
            order: number,
            role: PlacementPathPort['role'],
        ) {
            const placement = placementByDesignator.get(target.designator);
            const ref = `${target.designator}.${String(target.pin_number)}`;
            const point = pointByRef.get(ref);
            if (!placement || !point) return;
            const normal = normalizeVector({ x: point.x - placement.x, y: point.y - placement.y }) ?? { x: 0, y: 0 };
            ports.push({
                pathId: path.id,
                order,
                ref,
                role,
                x: point.x,
                y: point.y,
                normal,
            });
        }
    }
    return ports;
}

function islandComponentLabels(node: PlacementTreeNode): Set<string> {
    const components = Array.isArray(node.data?.components) ? node.data.components : [];
    return new Set(components.filter((item): item is string => typeof item === 'string'));
}

function sortedIslandChildren(node: PlacementTreeNode) {
    return node.children
        .filter((child) => child.kind === 'island')
        .sort((a, b) => islandSolveRank(a) - islandSolveRank(b));
}

function islandSolveRank(node: PlacementTreeNode) {
    const kind = node.data?.kind;
    if (kind === 'cap_cluster' || kind === 'line' || kind === 'bypass') return 1;
    if (kind === 'core_pairs') return 2;
    return 3;
}

function isSubset(items: Set<string>, allowed: Set<string>) {
    for (const item of items) {
        if (!allowed.has(item)) return false;
    }
    return true;
}

function setsIntersect(a: Set<string>, b: Set<string>) {
    for (const item of a) {
        if (b.has(item)) return true;
    }
    return false;
}

function relationsForPrimitives(relations: PlacementRelation[], scope: string, primitives: PlacementPrimitive[]) {
    return relations.filter((relation) => relation.scope === scope || relationTouchesPrimitives(relation, primitives));
}

function relationTouchesPrimitives(relation: PlacementRelation, primitives: PlacementPrimitive[]) {
    if (relation.kind === 'net' || relation.effect === 'lock') return false;
    return endpointTouchesPrimitives(relation.from, primitives) || endpointTouchesPrimitives(relation.to, primitives);
}

function endpointTouchesPrimitives(endpoint: string, primitives: PlacementPrimitive[]) {
    const designator = endpointDesignator(endpoint);
    if (!designator) return false;
    return primitives.some((primitive) => primitive.placements.some((placement) => placement.designator === designator));
}

function endpointDesignator(endpoint: string) {
    if (endpoint.startsWith('pad:')) return endpoint.slice('pad:'.length).split('.')[0] ?? null;
    if (endpoint.startsWith('component:')) return endpoint.slice('component:'.length);
    return null;
}

function numeric(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function boardBounds(input: PlacementInput): Box {
    const edge = input.board.clearances.edge ?? 0;
    return {
        left: -input.board.outline.width / 2 + edge,
        right: input.board.outline.width / 2 - edge,
        top: -input.board.outline.height / 2 + edge,
        bottom: input.board.outline.height / 2 - edge,
    };
}

function rememberPrimitive(context: TreeSolveContext, primitive: PlacementPrimitive): PlacementPrimitive {
    context.primitives.push(primitive);
    return primitive;
}

function emptyPrimitive(node: PlacementTreeNode): PlacementPrimitive {
    return {
        id: primitiveId(node),
        kind: node.kind === 'board' ? 'board' : node.kind === 'module' ? 'module' : node.kind === 'block' ? 'block' : node.kind === 'island' ? 'island' : 'component',
        label: node.label,
        sourceNodeId: node.id,
        locked: false,
        canRotate: false,
        allowedOrientations: [0],
        bbox: { left: 0, right: 0, top: 0, bottom: 0 },
        collisionBoxes: [],
        width: 0,
        height: 0,
        placements: [],
        connectionPoints: [],
        children: [],
    };
}

function primitiveId(node: PlacementTreeNode) {
    return `primitive:${node.id}`;
}





function padWorld(component: PcbComponent, placement: Placement, pin: string | number) {
    const pad = component.footprint.pads.find((item) => String(item.pin_number) === String(pin));
    if (!pad) return null;
    const offset = padOffset(pad, placement.rotate, placement.layer);
    return { x: roundPlacement(placement.x + offset.x), y: roundPlacement(placement.y + offset.y) };
}

function padOffset(point: Point, rotate: number, layer: Layer) {
    const local = layer === 'bottom' ? { x: -point.x, y: point.y } : point;
    const radians = rotate * Math.PI / 180;
    return {
        x: local.x * Math.cos(radians) - local.y * Math.sin(radians),
        y: local.x * Math.sin(radians) + local.y * Math.cos(radians),
    };
}

function normalizedAllowedRotations(component: PcbComponent) {
    const rotations = component.pcb.allowedRotations.length ? component.pcb.allowedRotations : [0, 90, 180, 270];
    return [...new Set(rotations.map((rotation) => normalizeRotation(rotation)))];
}

function allowedOrientationsForPlacements(context: TreeSolveContext, placements: Placement[]) {
    let common: number[] | null = null;
    for (const placement of placements) {
        const component = context.componentByDesignator.get(placement.designator);
        if (!component) continue;
        const orientations = allowedOrientationsForComponent(component, placement.rotate);
        common = common === null
            ? orientations
            : common.filter((orientation) => orientations.includes(orientation));
    }
    return common?.length ? common : [0];
}

function allowedOrientationsForComponent(component: PcbComponent, currentRotation: number) {
    const allowed = new Set(normalizedAllowedRotations(component));
    const orientations = [0, 90, 180, 270]
        .map(normalizeRotation)
        .filter((orientation) => allowed.has(normalizeRotation(currentRotation + orientation)));
    return orientations.length ? orientations : [0];
}

function normalizeRotation(value: number) {
    return ((Math.round(value) % 360) + 360) % 360;
}

function ignoredNet(context: TreeSolveContext, net: string) {
    if (!net) return true;
    if ((context.input.solverOptions.ignoredRatsnestSignals ?? []).includes(net)) return true;
    return /^GND(?:$|[_-])/i.test(net) || /(?:^|[_-])GND$/i.test(net);
}

function netSignalWeight(net: string) {
    if (/^(?:VBUS|VCC|VDD|VIN|BAT|AVDD|DVDD|IOVDD|ADC_AVDD|VREG|[+]\w+)/i.test(net)) return 0.25;
    return 1;
}

function normalizeVector(point: Point): Point | null {
    const length = Math.hypot(point.x, point.y);
    if (length < 0.000001) return null;
    return { x: point.x / length, y: point.y / length };
}

function dot(a: Point, b: Point) {
    return a.x * b.x + a.y * b.y;
}

function snap(value: number, grid: number) {
    if (grid <= 0) return value;
    return Math.round(value / grid) * grid;
}
