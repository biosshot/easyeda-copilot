import type {
    BoardAnchor,
    HintPriority,
    PcbComponent,
    PlacementGraph,
    PlacementGraphDiagnostic,
    PlacementGraphReport,
    PlacementIslandKind,
    PlacementRelation,
    PlacementRelationKind,
    PlacementTreeNode,
    PlacementHint,
    PlacementInput,
    TargetRef,
} from '#types/pcb/layout-model.ts';
import { priorityWeight } from './hints.ts';
import { isFixedComponent } from './utils.ts';

type GraphBuilderState = {
    nodes: InternalGraphNode[];
    edges: InternalGraphEdge[];
    islands: InternalIsland[];
    diagnostics: PlacementGraphDiagnostic[];
    nodeIds: Set<string>;
    edgeIds: Set<string>;
};

type InternalGraphNodeKind = 'board' | 'anchor' | 'component' | 'pad' | 'net' | 'block' | 'module' | 'island';
type InternalGraphEdgeKind =
    | 'owns_pad'
    | 'connects_net'
    | 'block_contains'
    | 'component_in_block'
    | 'module_contains'
    | 'attached_to'
    | 'hint'
    | 'island_contains'
    | 'island_target'
    | 'mechanical';

type InternalGraphNode = {
    id: string;
    kind: InternalGraphNodeKind;
    label: string;
    data?: Record<string, unknown>;
};

type InternalGraphEdge = {
    id: string;
    kind: InternalGraphEdgeKind;
    from: string;
    to: string;
    relation?: PlacementHint['relation'];
    priority?: HintPriority;
    hard?: boolean;
    weight?: number;
    data?: Record<string, unknown>;
};

type InternalIsland = {
    id: string;
    kind: PlacementIslandKind;
    components: string[];
    target?: TargetRef;
    priority: HintPriority;
    hard: boolean;
    sourceHintIndexes: number[];
    data?: Record<string, unknown>;
};

type RelationScopeContext = {
    componentToBlock: Map<string, string>;
    blockToModule: Map<string, string>;
    blockParent: Map<string, string>;
    netScopes: Map<string, string>;
    islandScopes: Map<string, string>;
};

export function buildPlacementGraph(input: PlacementInput): PlacementGraph {
    const state: GraphBuilderState = {
        nodes: [],
        edges: [],
        islands: [],
        diagnostics: [],
        nodeIds: new Set(),
        edgeIds: new Set(),
    };
    const componentsByDesignator = new Map<string, PcbComponent>();

    addNode(state, { id: 'board', kind: 'board', label: 'board', data: { outline: input.board.outline } });
    addBoardAnchorNodes(state);

    for (const component of input.components) {
        if (componentsByDesignator.has(component.designator)) {
            addDiagnostic(state, 'error', 'duplicate_component', `Duplicate component designator ${component.designator}`, componentNodeId(component.designator));
            continue;
        }
        componentsByDesignator.set(component.designator, component);
        addComponentNodes(state, component);
    }

    addNetNodes(state, input, componentsByDesignator);
    addBlockNodes(state, input, componentsByDesignator);
    addModuleNodes(state, input);
    addHintEdgesAndIslands(state, input, componentsByDesignator);

    const { root, hierarchyDiagnostics, orphanComponents, unparentedBlocks, relationScopeContext } = buildPlacementTree(input, state);
    const relations = buildPlacementRelations(state, relationScopeContext);
    const report = createGraphReport(state, root, relations, hierarchyDiagnostics, orphanComponents, unparentedBlocks);
    return { root, relations, paths: input.paths ?? [], report };
}

export function formatPlacementGraphDiagnostics(report: PlacementGraphReport) {
    return report.diagnostics.map((diagnostic) => `${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}`);
}

function addComponentNodes(state: GraphBuilderState, component: PcbComponent) {
    const componentId = componentNodeId(component.designator);
    addNode(state, {
        id: componentId,
        kind: 'component',
        label: component.designator,
        data: {
            role: component.pcb.role,
            block: component.block_name,
            fixed: isFixedComponent(component),
            edgeMount: Boolean(component.pcb.edgeMount),
            edgePlace: Boolean(component.pcb.edgePlace),
            footprint: component.footprint.name,
            width: component.footprint.width,
            height: component.footprint.height,
        },
    });

    if (isFixedComponent(component) || component.pcb.edgeMount || component.pcb.edgePlace) {
        addEdge(state, 'mechanical', componentId, 'board', {
            hard: Boolean(isFixedComponent(component) || component.pcb.edgeMount),
            data: {
                fixed: Boolean(component.pcb.fixedPlacement),
                edgeMount: component.pcb.edgeMount ?? null,
                edgePlace: component.pcb.edgePlace ?? null,
            },
        });
    }

    const seenPins = new Set<string>();
    for (const pin of component.pins) {
        const pinKey = String(pin.pin_number);
        const padId = padNodeId(component.designator, pin.pin_number);
        if (seenPins.has(pinKey)) {
            addDiagnostic(state, 'warning', 'duplicate_pin', `${component.designator} has duplicate pin ${pinKey}`, componentId);
            continue;
        }
        seenPins.add(pinKey);
        addNode(state, {
            id: padId,
            kind: 'pad',
            label: `${component.designator}.${pinKey}`,
            data: {
                designator: component.designator,
                pin_number: pin.pin_number,
                name: pin.name,
                net: pin.signal_name,
            },
        });
        addEdge(state, 'owns_pad', componentId, padId);
    }
}

function addBoardAnchorNodes(state: GraphBuilderState) {
    const anchors: BoardAnchor[] = [
        'board.center',
        'board.left',
        'board.right',
        'board.top',
        'board.bottom',
        'board.top_left',
        'board.top_right',
        'board.bottom_left',
        'board.bottom_right',
    ];
    for (const anchor of anchors) {
        const id = anchorNodeId(anchor);
        addNode(state, { id, kind: 'anchor', label: anchor });
        addEdge(state, 'mechanical', 'board', id);
    }
}

function addNetNodes(
    state: GraphBuilderState,
    input: PlacementInput,
    componentsByDesignator: Map<string, PcbComponent>,
) {
    const nets = new Map<string, Array<{ designator: string; pin_number: string | number }>>();
    for (const component of input.components) {
        for (const pin of component.pins) {
            if (!pin.signal_name) continue;
            const entries = nets.get(pin.signal_name) ?? [];
            entries.push({ designator: component.designator, pin_number: pin.pin_number });
            nets.set(pin.signal_name, entries);
        }
    }

    for (const [net, pins] of nets) {
        const netId = netNodeId(net);
        addNode(state, { id: netId, kind: 'net', label: net, data: { pins: pins.length } });
        for (const pin of pins) {
            if (!componentsByDesignator.has(pin.designator)) continue;
            addEdge(state, 'connects_net', padNodeId(pin.designator, pin.pin_number), netId);
        }
    }
}

function addBlockNodes(
    state: GraphBuilderState,
    input: PlacementInput,
    componentsByDesignator: Map<string, PcbComponent>,
) {
    const blocksByName = new Map(input.blocks.map((block) => [block.name, block]));
    const designatorOwners = new Map<string, string[]>();

    for (const block of input.blocks) {
        const blockId = blockNodeId(block.name);
        addNode(state, {
            id: blockId,
            kind: 'block',
            label: block.name,
            data: {
                role: block.role,
                placement: block.placement ?? 'main',
                attachTo: block.attachTo ?? null,
                anchor: block.anchor ?? null,
                components: block.component_designators.length,
            },
        });

        if ((block.placement ?? 'main') === 'satellite' && !block.attachTo) {
            addDiagnostic(state, 'error', 'satellite_without_parent', `Satellite block ${block.name} must attachTo a parent main block`, blockId);
        }
        if (block.attachTo && block.component_designators.some((designator) => {
            const component = componentsByDesignator.get(designator);
            return component && (isFixedComponent(component) || component.pcb.edgeMount || component.pcb.edgePlace);
        })) {
            addDiagnostic(
                state,
                'error',
                'mechanical_satellite_block',
                `Block ${block.name} attaches to ${block.attachTo} but contains fixed/edge components. Mechanical blocks must be board-level blocks; use near()/criticalPair() for electrical intent.`,
                blockId,
            );
        }

        if (block.attachTo) {
            const parentId = blockNodeId(block.attachTo);
            const parentBlock = blocksByName.get(block.attachTo);
            if (parentBlock) {
                addEdge(state, 'attached_to', blockId, parentId, { hard: true });
                if (block.anchor) {
                    const priority: HintPriority = block.hardAnchor ? 'critical' : 'high';
                    addEdge(state, 'hint', blockId, targetNodeId(block.anchor), {
                        relation: 'near',
                        priority,
                        hard: block.hardAnchor ?? false,
                        weight: priorityWeight(priority) * 2,
                        data: {
                            satelliteAnchor: true,
                            maxDistance: block.maxAnchorGap ?? null,
                            sidePreference: block.sidePreference ?? null,
                            anchorOffset: block.anchorOffset ?? null,
                        },
                    });
                }
                if ((block.placement ?? 'main') === 'satellite' && (parentBlock.placement ?? 'main') === 'satellite') {
                    addDiagnostic(state, 'error', 'satellite_attaches_to_satellite', `Satellite block ${block.name} attaches to satellite block ${block.attachTo}; flatten it into one satellite block and use islands/clusters for internal structure`, blockId);
                }
            } else {
                addDiagnostic(state, 'error', 'missing_parent_block', `Block ${block.name} attaches to missing block ${block.attachTo}`, blockId);
            }
        }

        for (const designator of block.component_designators) {
            const component = componentsByDesignator.get(designator);
            if (!component) {
                addDiagnostic(state, 'error', 'block_unknown_component', `Block ${block.name} references missing component ${designator}`, blockId);
                continue;
            }
            const owners = designatorOwners.get(designator) ?? [];
            owners.push(block.name);
            designatorOwners.set(designator, owners);
            addEdge(state, 'block_contains', blockId, componentNodeId(designator), { hard: true });
            addEdge(state, 'component_in_block', componentNodeId(designator), blockId, { hard: true });
            if (component.block_name !== block.name) {
                addDiagnostic(state, 'warning', 'component_block_mismatch', `${designator} has block_name=${component.block_name}, but block ${block.name} owns it`, componentNodeId(designator));
            }
        }
        if (block.component_designators.length === 0) {
            addDiagnostic(state, 'warning', 'empty_block', `Block ${block.name} has no components`, blockId);
        }
    }

    for (const component of input.components) {
        const owners = designatorOwners.get(component.designator) ?? [];
        if (owners.length === 0) {
            addDiagnostic(state, 'error', 'component_without_block', `Component ${component.designator} is not owned by any block`, componentNodeId(component.designator));
        }
        if (owners.length > 1) {
            addDiagnostic(state, 'error', 'component_multi_block', `Component ${component.designator} is owned by multiple blocks: ${owners.join(', ')}`, componentNodeId(component.designator));
        }
    }
}

function addModuleNodes(state: GraphBuilderState, input: PlacementInput) {
    const blocksByName = new Map(input.blocks.map((block) => [block.name, block]));
    for (const module of input.modules ?? []) {
        const moduleId = moduleNodeId(module.name);
        addNode(state, {
            id: moduleId,
            kind: 'module',
            label: module.name,
            data: {
                blocks: module.block_names,
                anchor: module.anchor ?? null,
                maxWidth: module.maxWidth ?? null,
                maxHeight: module.maxHeight ?? null,
            },
        });
        let validBlocks = 0;
        const moduleBlocks = new Set(module.block_names);
        for (const blockName of module.block_names) {
            const block = blocksByName.get(blockName);
            if (!block) {
                addDiagnostic(state, 'error', 'module_unknown_block', `Module ${module.name} references missing block ${blockName}`, moduleId);
                continue;
            }
            validBlocks += 1;
            addEdge(state, 'module_contains', moduleId, blockNodeId(blockName), { hard: true });
            if (block.attachTo && moduleBlocks.has(block.attachTo)) {
                addDiagnostic(
                    state,
                    'warning',
                    'module_redundant_satellite',
                    `Module ${module.name} includes satellite ${block.name}, but parent ${block.attachTo} already owns it; reports and legalizer use the canonical parent family`,
                    moduleId,
                );
            }
            if ((block.placement ?? 'main') === 'satellite' && block.attachTo && !moduleBlocks.has(block.attachTo)) {
                addDiagnostic(state, 'error', 'module_missing_satellite_parent', `Module ${module.name} includes satellite ${block.name} but not its parent ${block.attachTo}`, moduleId);
            }
        }
        if (validBlocks === 0) {
            addDiagnostic(state, 'warning', 'empty_module', `Module ${module.name} has no valid blocks`, moduleId);
        }
    }
}

function addHintEdgesAndIslands(
    state: GraphBuilderState,
    input: PlacementInput,
    componentsByDesignator: Map<string, PcbComponent>,
) {
    const corePairGroups = new Map<string, Array<{ hint: Extract<PlacementHint, { relation: 'critical_pair' }>; index: number }>>();

    input.hints.forEach((hint, index) => {
        validateHintTargets(state, hint, componentsByDesignator, input);
        addHintEdges(state, hint, index);

        if (hint.relation === 'line') {
            addIsland(state, input, 'line', `line:${index}`, hint.components, hint.priority, false, [index], {
                axis: hint.axis,
                gap: hint.gap ?? null,
                rotate: hint.rotate ?? null,
            });
        }
        if (hint.relation === 'bypass') {
            addIsland(state, input, 'bypass', `bypass:${index}`, hint.capacitors, hint.priority, hint.priority === 'critical', [index], {
                target: hint.target,
                axis: hint.axis ?? null,
                gap: hint.gap ?? null,
                rotate: hint.rotate ?? null,
            }, hint.target);
        }
        if (hint.relation === 'cap_cluster') {
            addIsland(state, input, 'cap_cluster', `cap_cluster:${index}`, hint.capacitors, hint.priority, hint.priority === 'critical', [index], {
                powerNet: hint.powerNet,
                returnNet: hint.returnNet,
                target: hint.target ?? null,
                axis: hint.axis ?? null,
                maxRows: hint.maxRows ?? null,
                maxPerRow: hint.maxPerRow ?? null,
                topology: hint.topology ?? null,
                gap: hint.gap ?? null,
                rowGap: hint.rowGap ?? null,
            }, hint.target);
        }
        if (hint.relation === 'critical_pair' && hint.core) {
            const key = hint.block ?? `core:${index}`;
            const items = corePairGroups.get(key) ?? [];
            items.push({ hint, index });
            corePairGroups.set(key, items);
        }
    });

    for (const [key, items] of corePairGroups) {
        const components = unique(items.flatMap((item) => [item.hint.source.designator, item.hint.target.designator]));
        addIsland(state, input, 'core_pairs', `core_pairs:${key}`, components, maxPriority(items.map((item) => item.hint.priority)), items.some((item) => item.hint.hard ?? true), items.map((item) => item.index), {
            pairs: items.map((item) => [formatPinRef(item.hint.source), formatPinRef(item.hint.target)]),
            maxDistance: minNumber(items.map((item) => item.hint.maxDistance)),
            block: key,
        });
    }
}

function addHintEdges(state: GraphBuilderState, hint: PlacementHint, index: number) {
    const edgeBase = {
        relation: hint.relation,
        priority: hint.priority,
        weight: hintRelationWeight(hint),
        hard: isHardHint(hint),
        data: hintRelationData(hint, index),
    };
    if ('source' in hint && 'target' in hint) {
        const source = targetNodeId(hint.source);
        const target = hint.target === 'all' ? 'board' : targetNodeId(hint.target);
        addEdge(state, 'hint', source, target, edgeBase);
    }
    if (hint.relation === 'edge' || hint.relation === 'prefer_layer') {
        addEdge(state, 'hint', targetNodeId(hint.source), 'board', edgeBase);
    }
    if (hint.relation === 'line') {
        addSequenceHintEdges(state, hint.components, edgeBase);
    }
    if (hint.relation === 'bypass') {
        for (const capacitor of hint.capacitors) addEdge(state, 'hint', componentNodeId(capacitor), targetNodeId(hint.target), edgeBase);
    }
    if (hint.relation === 'cap_cluster') {
        for (const capacitor of hint.capacitors) {
            addEdge(state, 'hint', componentNodeId(capacitor), hint.target ? targetNodeId(hint.target) : netNodeId(hint.powerNet), edgeBase);
        }
    }
}

function hintRelationWeight(hint: PlacementHint) {
    if (hint.relation === 'critical_pair') {
        return priorityWeight(hint.priority) * (hint.weightMultiplier ?? (hint.core ? 2.4 : 1.8));
    }
    return priorityWeight(hint.priority);
}

function hintRelationData(hint: PlacementHint, index: number): Record<string, unknown> {
    const data: Record<string, unknown> = { hintIndex: index };
    if (hint.relation === 'critical_pair') {
        data.maxDistance = hint.maxDistance ?? null;
        data.minDistance = hint.minDistance ?? null;
        data.preferFacingPads = hint.preferFacingPads ?? false;
        data.crossingPenalty = hint.crossingPenalty ?? 0;
        if (hint.path) {
            data.pathId = hint.path.id;
            data.pathSegmentIndex = hint.path.segmentIndex;
            data.pathSegmentCount = hint.path.segmentCount;
            data.pathShape = hint.path.shape;
        }
    }
    return data;
}

function addSequenceHintEdges(state: GraphBuilderState, components: string[], edgeBase: Partial<InternalGraphEdge>) {
    for (let index = 1; index < components.length; index += 1) {
        addEdge(state, 'hint', componentNodeId(components[index - 1]), componentNodeId(components[index]), edgeBase);
    }
}

function addIsland(
    state: GraphBuilderState,
    input: PlacementInput,
    kind: InternalIsland['kind'],
    rawId: string,
    components: string[],
    priority: HintPriority,
    hard: boolean,
    sourceHintIndexes: number[],
    data: Record<string, unknown>,
    target?: TargetRef,
) {
    const id = islandNodeId(rawId);
    const uniqueComponents = unique(components);
    const island: InternalIsland = { id, kind, components: uniqueComponents, target, priority, hard, sourceHintIndexes, data };
    state.islands.push(island);
    addNode(state, { id, kind: 'island', label: rawId, data: { kind, priority, hard, components: uniqueComponents.length, ...data } });

    for (const designator of uniqueComponents) {
        addEdge(state, 'island_contains', id, componentNodeId(designator), { priority, hard });
        if (!input.components.some((component) => component.designator === designator)) {
            addDiagnostic(state, 'error', 'island_unknown_component', `Island ${rawId} references missing component ${designator}`, id);
        }
    }
    if (target) addEdge(state, 'island_target', id, targetNodeId(target), { priority, hard });
}

function validateHintTargets(
    state: GraphBuilderState,
    hint: PlacementHint,
    componentsByDesignator: Map<string, PcbComponent>,
    input: PlacementInput,
) {
    const targets: TargetRef[] = [];
    if ('source' in hint) targets.push(hint.source);
    if ('target' in hint && hint.target && hint.target !== 'all') targets.push(hint.target);
    if (hint.relation === 'bypass') targets.push(hint.target);
    if (hint.relation === 'cap_cluster' && hint.target) targets.push(hint.target);
    for (const target of targets) validateTarget(state, target, componentsByDesignator, input);

    const designators = hintDesignators(hint);
    for (const designator of designators) {
        if (!componentsByDesignator.has(designator)) {
            addDiagnostic(state, 'error', 'hint_unknown_component', `Hint ${hint.relation} references missing component ${designator}`);
        }
    }
}

function validateTarget(
    state: GraphBuilderState,
    target: TargetRef,
    componentsByDesignator: Map<string, PcbComponent>,
    input: PlacementInput,
) {
    if (target.type === 'component') {
        if (!componentsByDesignator.has(target.designator)) {
            addDiagnostic(state, 'error', 'target_unknown_component', `Target references missing component ${target.designator}`, componentNodeId(target.designator));
        }
    }
    if (target.type === 'pin') {
        const component = componentsByDesignator.get(target.designator);
        if (!component) {
            addDiagnostic(state, 'error', 'target_unknown_component', `Pin target references missing component ${target.designator}`, componentNodeId(target.designator));
            return;
        }
        if (!component.pins.some((pin) => String(pin.pin_number) === String(target.pin_number))) {
            addDiagnostic(state, 'error', 'target_unknown_pin', `Pin target references missing pad ${target.designator}.${String(target.pin_number)}`, componentNodeId(target.designator));
        }
    }
    if (target.type === 'block' && !input.blocks.some((block) => block.name === target.block_name)) {
        addDiagnostic(state, 'error', 'target_unknown_block', `Target references missing block ${target.block_name}`, blockNodeId(target.block_name));
    }
}

function hintDesignators(hint: PlacementHint) {
    if (hint.relation === 'line') return hint.components;
    if (hint.relation === 'bypass') return hint.capacitors;
    if (hint.relation === 'cap_cluster') return hint.capacitors;
    return [];
}

function createGraphReport(
    state: GraphBuilderState,
    root: PlacementTreeNode,
    relations: PlacementRelation[],
    hierarchyDiagnostics: PlacementGraphDiagnostic[],
    orphanComponents: string[],
    unparentedBlocks: string[],
): PlacementGraphReport {
    const islandKinds: PlacementGraphReport['islandKinds'] = {};
    for (const island of state.islands) islandKinds[island.kind] = (islandKinds[island.kind] ?? 0) + 1;
    const nodeCount = (kind: InternalGraphNode['kind']) => state.nodes.filter((node) => node.kind === kind).length;
    const diagnostics = [...state.diagnostics, ...hierarchyDiagnostics];
    return {
        ok: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
        treeNodes: countTreeNodes(root),
        relations: relations.length,
        roots: root.children.length,
        maxDepth: treeDepth(root),
        components: nodeCount('component'),
        pads: nodeCount('pad'),
        nets: nodeCount('net'),
        blocks: nodeCount('block'),
        modules: nodeCount('module'),
        islands: state.islands.length,
        islandKinds,
        orphanComponents,
        unparentedBlocks,
        diagnostics,
    };
}

function buildPlacementRelations(state: GraphBuilderState, context: RelationScopeContext): PlacementRelation[] {
    return state.edges
        .map((edge) => toPlacementRelation(edge, context))
        .filter((relation): relation is PlacementRelation => Boolean(relation));
}

function toPlacementRelation(edge: InternalGraphEdge, context: RelationScopeContext): PlacementRelation | null {
    if (
        edge.kind === 'owns_pad'
        || edge.kind === 'block_contains'
        || edge.kind === 'component_in_block'
        || edge.kind === 'module_contains'
        || edge.kind === 'island_contains'
        || edge.kind === 'attached_to'
    ) {
        return null;
    }
    return {
        id: edge.id,
        kind: relationKind(edge),
        from: edge.from,
        to: edge.to,
        relation: edge.relation,
        priority: edge.priority,
        hard: edge.hard,
        weight: edge.weight,
        scope: relationScope(edge, context),
        effect: relationEffect(edge),
        data: edge.data,
    };
}

function relationKind(edge: InternalGraphEdge): PlacementRelationKind {
    if (edge.kind === 'connects_net') return 'net';
    if (edge.kind === 'island_target') return 'island_target';
    if (edge.kind === 'mechanical') return edge.from === 'board' || edge.to.startsWith('anchor:') ? 'anchor' : 'mechanical';
    if (edge.relation === 'critical_pair') return 'critical_pair';
    if (edge.relation === 'clearance') return 'clearance';
    if (edge.relation === 'edge') return 'edge';
    if (edge.relation === 'prefer_layer') return 'prefer_layer';
    return 'hint';
}

function relationEffect(edge: InternalGraphEdge): PlacementRelation['effect'] {
    if (edge.kind === 'mechanical') {
        return edge.data?.edgePlace && !edge.data?.fixed && !edge.data?.edgeMount ? 'move_from' : 'lock';
    }
    if (edge.kind === 'connects_net') return 'score_only';
    if (edge.relation === 'line' || edge.relation === 'same_side' || edge.relation === 'cluster_with') {
        return 'move_both';
    }
    if (edge.relation === 'clearance' || edge.relation === 'away_from') return 'score_only';
    return 'move_from';
}

function relationScope(edge: InternalGraphEdge, context: RelationScopeContext): string {
    if (edge.from.startsWith('anchor:') || edge.to.startsWith('anchor:')) return 'board';
    if (edge.kind === 'connects_net') {
        const net = edge.to.startsWith('net:') ? edge.to.slice('net:'.length) : null;
        return net ? context.netScopes.get(net) ?? 'board' : 'board';
    }
    if (edge.kind === 'island_target') return context.islandScopes.get(edge.from) ?? commonEndpointScope(edge.from, edge.to, context);
    if (edge.kind === 'mechanical') return 'board';
    return commonEndpointScope(edge.from, edge.to, context);
}

function commonEndpointScope(from: string, to: string, context: RelationScopeContext): string {
    const fromBlock = endpointBlock(from, context);
    const toBlock = endpointBlock(to, context);
    if (fromBlock && toBlock) return commonBlockScope([fromBlock, toBlock], context.blockParent, context.blockToModule);
    if (fromBlock) return blockScope(fromBlock);
    if (toBlock) return blockScope(toBlock);
    return 'board';
}

function endpointBlock(endpoint: string, context: RelationScopeContext): string | null {
    if (endpoint.startsWith('component:')) return context.componentToBlock.get(endpoint.slice('component:'.length)) ?? null;
    if (endpoint.startsWith('pad:')) {
        const designator = endpoint.slice('pad:'.length).split('.')[0];
        return context.componentToBlock.get(designator) ?? null;
    }
    if (endpoint.startsWith('block:')) return endpoint.slice('block:'.length);
    if (endpoint.startsWith('island:')) {
        const scope = context.islandScopes.get(endpoint);
        return scope?.startsWith('tree:block:') ? scope.slice('tree:block:'.length) : null;
    }
    return null;
}

function commonBlockScope(blocks: string[], blockParent: Map<string, string>, blockToModule: Map<string, string>) {
    const commonBlock = commonBlockAncestor(blocks, blockParent);
    if (commonBlock) return blockScope(commonBlock);
    const modules = unique(blocks.map((blockName) => blockToModule.get(blockName)).filter((item): item is string => Boolean(item)));
    if (modules.length === 1 && blocks.every((blockName) => blockToModule.get(blockName) === modules[0])) return treeModuleId(modules[0]);
    return 'board';
}

function blockScope(blockName: string) {
    return treeBlockId(blockName);
}

function buildPlacementTree(input: PlacementInput, state: GraphBuilderState) {
    const diagnostics: PlacementGraphDiagnostic[] = [];
    const root = treeNode('board', 'board', 'board', 'board', {
        outline: input.board.outline,
    });
    const blocksByName = new Map(input.blocks.map((block) => [block.name, block]));
    const componentsByDesignator = new Map(input.components.map((component) => [component.designator, component]));
    const componentToBlock = new Map<string, string>();
    const blockToModule = new Map<string, string>();
    const blockParent = new Map<string, string>();
    const moduleNodes = new Map<string, PlacementTreeNode>();
    const renderedBlocks = new Set<string>();
    const islandScopes = new Map<string, string>();

    for (const block of input.blocks) {
        for (const designator of block.component_designators) {
            if (!componentToBlock.has(designator)) componentToBlock.set(designator, block.name);
        }
    }

    for (const module of input.modules ?? []) {
        const moduleNode = treeNode(
            treeModuleId(module.name),
            'module',
            module.name,
            moduleNodeId(module.name),
            {
                anchor: module.anchor ?? null,
                maxWidth: module.maxWidth ?? null,
                maxHeight: module.maxHeight ?? null,
            },
        );
        moduleNodes.set(module.name, moduleNode);
        root.children.push(moduleNode);
        for (const blockName of module.block_names) {
            const owner = blockToModule.get(blockName);
            if (owner && owner !== module.name) {
                diagnostics.push({
                    severity: 'warning',
                    code: 'hierarchy_block_in_multiple_modules',
                    message: `Block ${blockName} is listed in both module ${owner} and module ${module.name}`,
                    nodeId: blockNodeId(blockName),
                });
                continue;
            }
            blockToModule.set(blockName, module.name);
        }
    }

    const childBlocksByParent = new Map<string, string[]>();
    for (const block of input.blocks) {
        if (!block.attachTo || !blocksByName.has(block.attachTo)) continue;
        blockParent.set(block.name, block.attachTo);
        const children = childBlocksByParent.get(block.attachTo) ?? [];
        children.push(block.name);
        childBlocksByParent.set(block.attachTo, children);
    }

    const islandsByParent = groupIslandsByHierarchyParent(state.islands, componentToBlock, blockToModule, blockParent, diagnostics);
    for (const [scope, islands] of islandsByParent) {
        for (const island of islands) islandScopes.set(island.id, scope);
    }
    const renderBlock = (blockName: string, stack: string[] = []): PlacementTreeNode | null => {
        const block = blocksByName.get(blockName);
        if (!block) return null;
        if (stack.includes(blockName)) {
            diagnostics.push({
                severity: 'error',
                code: 'hierarchy_block_attach_cycle',
                message: `Block attachTo cycle: ${[...stack, blockName].join(' -> ')}`,
                nodeId: blockNodeId(blockName),
            });
            return null;
        }
        if (renderedBlocks.has(blockName)) {
            return treeNode(
                `tree:block-ref:${blockName}`,
                'block',
                blockName,
                blockNodeId(blockName),
                { ref: true },
            );
        }
        renderedBlocks.add(blockName);

        const blockNode = treeNode(
            treeBlockId(blockName),
            'block',
            blockName,
            blockNodeId(blockName),
            {
                role: block.role,
                placement: block.placement ?? 'main',
                attachTo: block.attachTo ?? null,
                anchor: block.anchor ?? null,
                anchorOffset: block.anchorOffset ?? null,
                sidePreference: block.sidePreference ?? null,
                maxBboxScale: block.maxBboxScale ?? null,
                maxBboxWidth: block.maxBboxWidth ?? null,
                maxBboxHeight: block.maxBboxHeight ?? null,
                hardBbox: block.hardBbox ?? false,
                maxAnchorGap: block.maxAnchorGap ?? null,
                hardAnchor: block.hardAnchor ?? false,
                familyMaxBboxScale: block.familyMaxBboxScale ?? null,
                familyMaxWidth: block.familyMaxWidth ?? null,
                familyMaxHeight: block.familyMaxHeight ?? null,
                familyHard: block.familyHard ?? false,
                placementClearance: block.placementClearance ?? null,
            },
        );

        for (const island of islandsByParent.get(treeBlockId(blockName)) ?? []) {
            blockNode.children.push(renderIslandNode(island));
        }
        for (const childBlock of childBlocksByParent.get(blockName) ?? []) {
            const childNode = renderBlock(childBlock, [...stack, blockName]);
            if (childNode) blockNode.children.push(childNode);
        }
        for (const designator of block.component_designators) {
            const component = componentsByDesignator.get(designator);
            if (!component) continue;
            blockNode.children.push(renderComponentNode(component));
        }
        return blockNode;
    };

    for (const [moduleName, moduleNode] of moduleNodes) {
        const module = input.modules?.find((item) => item.name === moduleName);
        if (!module) continue;
        for (const island of islandsByParent.get(treeModuleId(moduleName)) ?? []) {
            moduleNode.children.push(renderIslandNode(island));
        }
        for (const blockName of module.block_names) {
            const block = blocksByName.get(blockName);
            if (!block) continue;
            const parentModule = block.attachTo ? blockToModule.get(block.attachTo) : null;
            if (block.attachTo && parentModule === moduleName) continue;
            const blockNode = renderBlock(blockName);
            if (blockNode) moduleNode.children.push(blockNode);
        }
    }

    for (const island of islandsByParent.get(root.id) ?? []) {
        root.children.push(renderIslandNode(island));
    }
    for (const block of input.blocks) {
        if (renderedBlocks.has(block.name)) continue;
        if (blockToModule.has(block.name)) continue;
        if (block.attachTo && blocksByName.has(block.attachTo)) continue;
        const blockNode = renderBlock(block.name);
        if (blockNode) root.children.push(blockNode);
    }

    const orphanComponents = input.components
        .filter((component) => !componentToBlock.has(component.designator))
        .map((component) => component.designator);
    for (const component of orphanComponents.map((designator) => componentsByDesignator.get(designator)).filter((item): item is PcbComponent => Boolean(item))) {
        root.children.push(renderComponentNode(component));
    }

    const unparentedBlocks = input.blocks
        .filter((block) => !blockToModule.has(block.name) && (!block.attachTo || !blocksByName.has(block.attachTo)))
        .map((block) => block.name);
    const relationScopeContext: RelationScopeContext = {
        componentToBlock,
        blockToModule,
        blockParent,
        netScopes: buildNetScopes(input, componentToBlock, blockParent, blockToModule),
        islandScopes,
    };
    return { root, hierarchyDiagnostics: diagnostics, orphanComponents, unparentedBlocks, relationScopeContext };
}

function groupIslandsByHierarchyParent(
    islands: InternalIsland[],
    componentToBlock: Map<string, string>,
    blockToModule: Map<string, string>,
    blockParent: Map<string, string>,
    diagnostics: PlacementGraphDiagnostic[],
) {
    const byParent = new Map<string, InternalIsland[]>();
    for (const island of islands) {
        const blocks = unique(island.components.map((designator) => componentToBlock.get(designator)).filter((item): item is string => Boolean(item)));
        let parentId = 'board';
        if (blocks.length === 1) {
                parentId = treeBlockId(blocks[0]);
        } else if (blocks.length > 1) {
            const commonBlock = commonBlockAncestor(blocks, blockParent);
            const modules = unique(blocks.map((blockName) => blockToModule.get(blockName)).filter((item): item is string => Boolean(item)));
            if (commonBlock) {
                parentId = treeBlockId(commonBlock);
            } else if (modules.length === 1 && blocks.every((blockName) => blockToModule.get(blockName) === modules[0])) {
                parentId = treeModuleId(modules[0]);
            } else {
                diagnostics.push({
                    severity: 'warning',
                    code: 'island_crosses_unrelated_blocks',
                    message: `Island ${island.id} spans unrelated blocks: ${blocks.join(', ')}`,
                    nodeId: island.id,
                });
            }
        }
        const items = byParent.get(parentId) ?? [];
        items.push(island);
        byParent.set(parentId, items);
    }
    return byParent;
}

function buildNetScopes(
    input: PlacementInput,
    componentToBlock: Map<string, string>,
    blockParent: Map<string, string>,
    blockToModule: Map<string, string>,
) {
    const netBlocks = new Map<string, string[]>();
    for (const component of input.components) {
        const block = componentToBlock.get(component.designator);
        if (!block) continue;
        for (const pin of component.pins) {
            if (!pin.signal_name) continue;
            const blocks = netBlocks.get(pin.signal_name) ?? [];
            blocks.push(block);
            netBlocks.set(pin.signal_name, blocks);
        }
    }
    const scopes = new Map<string, string>();
    for (const [net, blocks] of netBlocks) {
        scopes.set(net, commonBlockScope(unique(blocks), blockParent, blockToModule));
    }
    return scopes;
}

function commonBlockAncestor(blocks: string[], blockParent: Map<string, string>) {
    if (blocks.length === 0) return null;
    const [first, ...rest] = blocks;
    const firstAncestors = blockAncestors(first, blockParent);
    const restAncestorSets = rest.map((block) => new Set(blockAncestors(block, blockParent)));
    return firstAncestors.find((ancestor) => restAncestorSets.every((ancestors) => ancestors.has(ancestor))) ?? null;
}

function blockAncestors(block: string, blockParent: Map<string, string>) {
    const ancestors = [block];
    const seen = new Set<string>(ancestors);
    let current = block;
    while (blockParent.has(current)) {
        const parent = blockParent.get(current);
        if (!parent || seen.has(parent)) break;
        ancestors.push(parent);
        seen.add(parent);
        current = parent;
    }
    return ancestors;
}

function renderIslandNode(island: InternalIsland): PlacementTreeNode {
    return treeNode(
        `tree:${island.id}`,
        'island',
        island.id.replace(/^island:/, ''),
        island.id,
        {
            kind: island.kind,
            components: island.components,
            target: island.target ?? null,
            priority: island.priority,
            hard: island.hard,
            sourceHintIndexes: island.sourceHintIndexes,
            ...(island.data ?? {}),
        },
    );
}

function renderComponentNode(component: PcbComponent): PlacementTreeNode {
    return treeNode(
        treeComponentId(component.designator),
        'component',
        component.designator,
        componentNodeId(component.designator),
        {
            role: component.pcb.role,
            block: component.block_name,
            fixed: isFixedComponent(component),
            edgeMount: Boolean(component.pcb.edgeMount),
            edgePlace: Boolean(component.pcb.edgePlace),
            footprint: component.footprint.name,
            width: component.footprint.width,
            height: component.footprint.height,
        },
        component.pins.map((pin) => treeNode(
            treePadId(component.designator, pin.pin_number),
            'pad',
            `${component.designator}.${String(pin.pin_number)}`,
            padNodeId(component.designator, pin.pin_number),
            {
                pin_number: pin.pin_number,
                name: pin.name,
                net: pin.signal_name,
            },
        )),
    );
}

function treeNode(
    id: string,
    kind: PlacementTreeNode['kind'],
    label: string,
    ref?: string,
    data?: Record<string, unknown>,
    children: PlacementTreeNode[] = [],
): PlacementTreeNode {
    return { id, kind, label, ref, data, children };
}

function treeDepth(node: PlacementTreeNode): number {
    if (node.children.length === 0) return 1;
    return 1 + Math.max(...node.children.map(treeDepth));
}

function countTreeNodes(node: PlacementTreeNode): number {
    return 1 + node.children.reduce((sum, child) => sum + countTreeNodes(child), 0);
}

function treeModuleId(name: string) {
    return `tree:module:${name}`;
}

function treeBlockId(name: string) {
    return `tree:block:${name}`;
}

function treeComponentId(designator: string) {
    return `tree:component:${designator}`;
}

function treePadId(designator: string, pin: string | number) {
    return `tree:pad:${designator}.${String(pin)}`;
}

function addNode(state: GraphBuilderState, node: InternalGraphNode) {
    if (state.nodeIds.has(node.id)) {
        addDiagnostic(state, 'error', 'duplicate_graph_node', `Duplicate graph node ${node.id}`, node.id);
        return;
    }
    state.nodeIds.add(node.id);
    state.nodes.push(node);
}

function addEdge(state: GraphBuilderState, kind: InternalGraphEdgeKind, from: string, to: string, options: Partial<InternalGraphEdge> = {}) {
    const baseId = `${kind}:${from}->${to}:${options.relation ?? ''}:${options.data?.hintIndex ?? ''}`;
    const id = uniqueEdgeId(state, baseId);
    const edge: InternalGraphEdge = {
        id,
        kind,
        from,
        to,
        relation: options.relation,
        priority: options.priority,
        hard: options.hard,
        weight: options.weight,
        data: options.data,
    };
    state.edges.push(edge);
}

function uniqueEdgeId(state: GraphBuilderState, baseId: string) {
    let id = baseId;
    let suffix = 1;
    while (state.edgeIds.has(id)) {
        suffix += 1;
        id = `${baseId}#${suffix}`;
    }
    state.edgeIds.add(id);
    return id;
}

function addDiagnostic(
    state: GraphBuilderState,
    severity: PlacementGraphDiagnostic['severity'],
    code: string,
    message: string,
    nodeId?: string,
) {
    state.diagnostics.push({ severity, code, message, nodeId });
}

function isHardHint(hint: PlacementHint) {
    if (hint.relation === 'critical_pair') return hint.hard ?? (hint.path ? false : hint.priority === 'critical');
    return hint.priority === 'critical';
}

function targetNodeId(target: TargetRef) {
    if (target.type === 'component') return componentNodeId(target.designator);
    if (target.type === 'pin') return padNodeId(target.designator, target.pin_number);
    if (target.type === 'block') return blockNodeId(target.block_name);
    return anchorNodeId(target.anchor);
}

function componentNodeId(designator: string) {
    return `component:${designator}`;
}

function padNodeId(designator: string, pin: string | number) {
    return `pad:${designator}.${String(pin)}`;
}

function netNodeId(net: string) {
    return `net:${net}`;
}

function blockNodeId(name: string) {
    return `block:${name}`;
}

function moduleNodeId(name: string) {
    return `module:${name}`;
}

function anchorNodeId(anchor: BoardAnchor) {
    return `anchor:${anchor}`;
}

function islandNodeId(name: string) {
    return `island:${name}`;
}

function unique<T>(items: T[]) {
    return [...new Set(items)];
}

function maxPriority(priorities: HintPriority[]) {
    return priorities.slice().sort((a, b) => priorityRank(b) - priorityRank(a))[0] ?? 'normal';
}

function priorityRank(priority: HintPriority) {
    if (priority === 'critical') return 4;
    if (priority === 'high') return 3;
    if (priority === 'normal') return 2;
    return 1;
}

function minNumber(values: Array<number | undefined>) {
    const numbers = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    return numbers.length > 0 ? Math.min(...numbers) : null;
}

function formatPinRef(target: Extract<TargetRef, { type: 'pin' }>) {
    return `${target.designator}.${String(target.pin_number)}`;
}
