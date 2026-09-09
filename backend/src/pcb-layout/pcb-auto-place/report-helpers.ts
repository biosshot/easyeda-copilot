import type { Box, PcbBlock, PcbComponent, PcbModule, Placement, PlacementInput, Point, TargetRef } from '#types/pcb/layout-model.ts';
import { isGroundSignalName, isPowerSignalName } from '#utils/signals.ts';
import { boardAnchorPoint, getBox, getPadWorld, round } from './geometry.ts';
export { placementsCanConflict } from './utils.ts';

type ClearanceCache = {
    componentBlock: Map<string, PcbBlock>;
    parentBlock: Map<string, PcbBlock | null>;
    family: Map<string, PcbBlock[]>;
    familyNames: Map<string, Set<string>>;
    componentPair: Map<string, number>;
    blockPair: Map<string, number>;
    blockInternal: Map<string, number>;
};

const clearanceCaches = new WeakMap<PlacementInput, ClearanceCache>();

export function componentPairClearance(input: PlacementInput, a: PcbComponent, b: PcbComponent) {
    if (a.designator === b.designator) return 0;
    const cache = clearanceCache(input);
    const key = pairKey(a.designator, b.designator);
    const cached = cache.componentPair.get(key);
    if (cached !== undefined) return cached;

    const blockA = cache.componentBlock.get(a.designator) ?? null;
    const blockB = cache.componentBlock.get(b.designator) ?? null;
    let clearance = input.board.clearances.component;
    if (blockA && blockB && blocksAreRelated(cache, blockA, blockB)) {
        clearance = Math.min(input.board.clearances.component, ...pairPlacementClearanceValues(cache, blockA, blockB));
    }

    if (!isTightCriticalPowerPair(input, cache, a, b, blockA, blockB)) {
        clearance = Math.max(clearance, denseIcPairClearance(input.board.clearances.component, a, b));
    }

    cache.componentPair.set(key, clearance);
    return clearance;
}

function isTightCriticalPowerPair(
    input: PlacementInput,
    cache: ClearanceCache,
    a: PcbComponent,
    b: PcbComponent,
    blockA: PcbBlock | null,
    blockB: PcbBlock | null,
) {
    if (!blockA || !blockB) return false;
    if (!blocksAreRelated(cache, blockA, blockB)) return false;
    if (!isPowerFamilyPair(cache, blockA, blockB)) return false;
    return input.hints.some((hint) => {
        if (hint.relation !== 'critical_pair') return false;
        if (hint.source.type !== 'pin' || hint.target.type !== 'pin') return false;
        if (!sameDesignatorPair(hint.source.designator, hint.target.designator, a.designator, b.designator)) return false;
        return hint.hard === true || hint.core === true || hint.priority === 'critical';
    });
}

function isPowerFamilyPair(cache: ClearanceCache, a: PcbBlock, b: PcbBlock) {
    return blockFamilyHasRole(cache, a, 'power') || blockFamilyHasRole(cache, b, 'power');
}

function blockFamilyHasRole(cache: ClearanceCache, block: PcbBlock, role: PcbBlock['role']) {
    return (cache.family.get(block.name) ?? [block]).some((item) => item.role === role);
}

function sameDesignatorPair(a1: string, b1: string, a2: string, b2: string) {
    return (a1 === a2 && b1 === b2) || (a1 === b2 && b1 === a2);
}

function denseIcPairClearance(baseClearance: number, a: PcbComponent, b: PcbComponent) {
    const aExtra = denseIcClearanceExtra(a, b);
    const bExtra = denseIcClearanceExtra(b, a);
    const extra = Math.max(aExtra, bExtra);
    return extra > 0 ? baseClearance + extra : 0;
}

function denseIcClearanceExtra(source: PcbComponent, neighbor: PcbComponent) {
    const pinCount = source.pins.length;
    if (source.pcb.role === 'connector') return 0;
    if (pinCount < 12 && source.pcb.role !== 'main_ic') return 0;
    if (pinCount < 16 && !isSignalDenseMainIc(source)) return 0;

    const baseExtra = Math.min(1.5, Math.max(0.35, (pinCount - 8) * 0.035));
    if (neighbor.pcb.role === 'decoupling_cap') return Math.min(0.55, baseExtra * 0.45);
    if (neighbor.pcb.role === 'passive' && isMostlyPowerSupport(neighbor)) return Math.min(0.8, baseExtra * 0.6);
    if (neighbor.pcb.role === 'passive') return Math.min(1.0, baseExtra * 0.75);
    return baseExtra;
}

function isSignalDenseMainIc(component: PcbComponent) {
    if (component.pcb.role !== 'main_ic') return false;
    const signalPins = component.pins.filter((pin) => {
        const net = pin.signal_name;
        return net && !isGroundSignalName(net) && !isPowerSignalName(net);
    });
    return signalPins.length >= 6;
}

function isMostlyPowerSupport(component: PcbComponent) {
    const connected = component.pins.filter((pin) => pin.signal_name && !isGroundSignalName(pin.signal_name));
    return connected.length > 0 && connected.every((pin) => isPowerSignalName(pin.signal_name));
}

function denseIcPackingPadding(component: PcbComponent) {
    const pinCount = component.pins.length;
    if (component.pcb.role === 'connector') return 0;
    if (pinCount < 12 && component.pcb.role !== 'main_ic') return 0;
    if (pinCount < 16 && !isSignalDenseMainIc(component)) return 0;
    return Math.min(1.5, Math.max(0.35, (pinCount - 8) * 0.035));
}

export function blockInternalPlacementClearance(input: PlacementInput, block: PcbBlock) {
    const cache = clearanceCache(input);
    const cached = cache.blockInternal.get(block.name);
    if (cached !== undefined) return cached;

    const clearance = Math.min(input.board.clearances.component, ...blockPlacementClearance(block));
    cache.blockInternal.set(block.name, clearance);
    return clearance;
}

function clearanceCache(input: PlacementInput): ClearanceCache {
    const cached = clearanceCaches.get(input);
    if (cached) return cached;

    const byName = new Map(input.blocks.map((block) => [block.name, block]));
    const componentBlock = new Map<string, PcbBlock>();
    const parentBlock = new Map<string, PcbBlock | null>();
    const family = new Map<string, PcbBlock[]>();
    const familyNames = new Map<string, Set<string>>();

    for (const block of input.blocks) {
        for (const designator of block.component_designators) componentBlock.set(designator, block);
        parentBlock.set(block.name, block.attachTo ? byName.get(block.attachTo) ?? null : null);
    }

    const cache: ClearanceCache = {
        componentBlock,
        parentBlock,
        family,
        familyNames,
        componentPair: new Map(),
        blockPair: new Map(),
        blockInternal: new Map(),
    };
    for (const block of input.blocks) {
        const chain = blockFamily(block, cache);
        family.set(block.name, chain);
        familyNames.set(block.name, new Set(chain.map((item) => item.name)));
    }

    clearanceCaches.set(input, cache);
    return cache;
}

function pairPlacementClearanceValues(cache: ClearanceCache, a: PcbBlock, b: PcbBlock) {
    if (a.name === b.name) return blockPlacementClearance(a);

    if (isAncestor(cache, b, a)) return blockPlacementClearance(a);
    if (isAncestor(cache, a, b)) return blockPlacementClearance(b);
    if (shareParentFamily(cache, a, b)) {
        return [...blockPlacementClearance(a), ...blockPlacementClearance(b)];
    }

    return [];
}

function blockPlacementClearance(block: PcbBlock) {
    return typeof block.placementClearance === 'number' && Number.isFinite(block.placementClearance)
        ? [Math.max(0, block.placementClearance)]
        : [];
}

function isAncestor(cache: ClearanceCache, ancestor: PcbBlock, block: PcbBlock) {
    return (cache.familyNames.get(block.name) ?? new Set()).has(ancestor.name) && ancestor.name !== block.name;
}

function shareParentFamily(cache: ClearanceCache, a: PcbBlock, b: PcbBlock) {
    const aNames = cache.familyNames.get(a.name) ?? new Set<string>();
    return (cache.family.get(b.name) ?? []).slice(1).some((block) => aNames.has(block.name));
}

function blocksAreRelated(cache: ClearanceCache, a: PcbBlock, b: PcbBlock) {
    if (a.name === b.name) return true;
    const aNames = cache.familyNames.get(a.name) ?? new Set<string>();
    return (cache.family.get(b.name) ?? []).some((block) => aNames.has(block.name));
}

function blockFamily(block: PcbBlock, cache: ClearanceCache): PcbBlock[] {
    const chain: PcbBlock[] = [block];
    let current: PcbBlock | null | undefined = block;
    while (current) {
        current = cache.parentBlock.get(current.name);
        if (current) chain.push(current);
    }
    return chain;
}

function pairKey(a: string, b: string) {
    return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function estimateBlockBounds(
    input: PlacementInput,
    block: PcbBlock,
    componentsByDesignator: Map<string, PcbComponent>,
) {
    const components = block.component_designators.flatMap((designator) => {
        const component = componentsByDesignator.get(designator);
        return component ? [component] : [];
    });
    if (components.length === 0) return { width: 0, height: 0, area: 0 };

    const clearance = blockInternalPlacementClearance(input, block);
    const inflated = components.map((component) => ({
        width: component.footprint.width + clearance + denseIcPackingPadding(component),
        height: component.footprint.height + clearance + denseIcPackingPadding(component),
    }));
    const area = inflated.reduce((sum, size) => sum + size.width * size.height, 0);
    const largestWidth = Math.max(...inflated.map((size) => size.width));
    const largestHeight = Math.max(...inflated.map((size) => size.height));
    const aspectRatio = block.role === 'connector' ? 2.2 : block.role === 'mcu' ? 1.2 : 1.45;
    const packingFactor = components.length <= 2 ? 1.35 : components.length <= 5 ? 1.7 : components.length <= 12 ? 2.15 : 2.6;
    const estimatedArea = Math.max(area * packingFactor, largestWidth * largestHeight);
    const width = Math.max(Math.sqrt(estimatedArea * aspectRatio), largestWidth);
    const height = Math.max(Math.sqrt(estimatedArea / aspectRatio), largestHeight);

    return {
        width: round(width),
        height: round(height),
        area: round(width * height),
    };
}

export function blockBboxLimit(input: PlacementInput, block: PcbBlock, componentsByDesignator: Map<string, PcbComponent>) {
    const estimate = estimateBlockBounds(input, block, componentsByDesignator);
    const scaleWidth = block.maxBboxScale ? estimate.width * block.maxBboxScale : null;
    const scaleHeight = block.maxBboxScale ? estimate.height * block.maxBboxScale : null;
    return {
        maxWidth: minDefined(scaleWidth, block.maxBboxWidth),
        maxHeight: minDefined(scaleHeight, block.maxBboxHeight),
    };
}

export function familyBboxLimit(input: PlacementInput, parent: PcbBlock, componentsByDesignator: Map<string, PcbComponent>) {
    const familyDesignators = familyBlockDesignators(input, parent);
    const familyBlock = { ...parent, component_designators: familyDesignators };
    const estimate = estimateBlockBounds(input, familyBlock, componentsByDesignator);
    const scaleWidth = parent.familyMaxBboxScale ? estimate.width * parent.familyMaxBboxScale : null;
    const scaleHeight = parent.familyMaxBboxScale ? estimate.height * parent.familyMaxBboxScale : null;
    return {
        maxWidth: minDefined(scaleWidth, parent.familyMaxWidth),
        maxHeight: minDefined(scaleHeight, parent.familyMaxHeight),
    };
}

export function familyBox(
    input: PlacementInput,
    parent: PcbBlock,
    placements: Map<string, Placement>,
    componentsByDesignator: Map<string, PcbComponent>,
) {
    return designatorsBox(familyBlockDesignators(input, parent), placements, componentsByDesignator);
}

export function familyBlockDesignators(input: PlacementInput, parent: PcbBlock) {
    const designators = new Set(parent.component_designators);
    for (const block of input.blocks) {
        if (block.attachTo !== parent.name) continue;
        for (const designator of block.component_designators) designators.add(designator);
    }
    return [...designators];
}

export function designatorsBox(
    designators: string[],
    placements: Map<string, Placement>,
    componentsByDesignator: Map<string, PcbComponent>,
) {
    const boxes = designators.flatMap((designator) => {
        const component = componentsByDesignator.get(designator);
        const placement = placements.get(designator);
        return component && placement ? [getBox(component, placement)] : [];
    });
    if (boxes.length === 0) return null;
    return {
        left: Math.min(...boxes.map((box) => box.left)),
        right: Math.max(...boxes.map((box) => box.right)),
        top: Math.min(...boxes.map((box) => box.top)),
        bottom: Math.max(...boxes.map((box) => box.bottom)),
    };
}

export function pointToBoxGap(point: Point, box: Box) {
    const dx = point.x < box.left ? box.left - point.x : point.x > box.right ? point.x - box.right : 0;
    const dy = point.y < box.top ? box.top - point.y : point.y > box.bottom ? point.y - box.bottom : 0;
    return Math.hypot(dx, dy);
}

export function resolveTargetPoint(
    input: PlacementInput,
    target: TargetRef | 'all',
    placements: Map<string, Placement>,
    componentsByDesignator: Map<string, PcbComponent>,
    currentComponent?: PcbComponent,
    currentPlacement?: Placement,
): Point | null {
    if (target === 'all') return null;
    if (target.type === 'board_anchor') return boardAnchorPoint(input.board, target.anchor);
    if (target.type === 'component') {
        const placement = target.designator === currentComponent?.designator ? currentPlacement : placements.get(target.designator);
        return placement ? { x: placement.x, y: placement.y } : null;
    }
    if (target.type === 'pin') {
        const component = target.designator === currentComponent?.designator ? currentComponent : componentsByDesignator.get(target.designator);
        const placement = target.designator === currentComponent?.designator ? currentPlacement : placements.get(target.designator);
        return component && placement ? getPadWorld(component, placement, target.pin_number) : null;
    }
    if (target.type === 'block') {
        const box = blockBox(input, target.block_name, placements, componentsByDesignator, currentComponent, currentPlacement);
        return box ? { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 } : null;
    }
    return null;
}

export function resolveTargetBox(
    input: PlacementInput,
    target: TargetRef | 'all',
    placements: Map<string, Placement>,
    componentsByDesignator: Map<string, PcbComponent>,
    currentComponent?: PcbComponent,
    currentPlacement?: Placement,
): Box | null {
    if (target === 'all') return null;
    if (target.type === 'component') {
        const component = target.designator === currentComponent?.designator ? currentComponent : componentsByDesignator.get(target.designator);
        const placement = target.designator === currentComponent?.designator ? currentPlacement : placements.get(target.designator);
        return component && placement ? getBox(component, placement) : null;
    }
    if (target.type === 'block') return blockBox(input, target.block_name, placements, componentsByDesignator, currentComponent, currentPlacement);
    const point = resolveTargetPoint(input, target, placements, componentsByDesignator, currentComponent, currentPlacement);
    return point ? { left: point.x, right: point.x, top: point.y, bottom: point.y } : null;
}

export function resolveBlockAnchorPoint(
    input: PlacementInput,
    block: PcbBlock,
    placements: Map<string, Placement>,
    componentsByDesignator: Map<string, PcbComponent>,
) {
    if (!block.anchor) return null;
    const point = resolveTargetPoint(input, block.anchor, placements, componentsByDesignator);
    if (!point) return null;
    return {
        x: point.x + (block.anchorOffset?.x ?? 0),
        y: point.y + (block.anchorOffset?.y ?? 0),
    };
}

export function blockBox(
    input: PlacementInput,
    blockName: string,
    placements: Map<string, Placement>,
    componentsByDesignator: Map<string, PcbComponent>,
    currentComponent?: PcbComponent,
    currentPlacement?: Placement,
) {
    const block = input.blocks.find((block) => block.name === blockName);
    const boxes = block?.component_designators.flatMap((designator) => {
        const component = designator === currentComponent?.designator ? currentComponent : componentsByDesignator.get(designator);
        const placement = designator === currentComponent?.designator ? currentPlacement : placements.get(designator);
        return component && placement ? [getBox(component, placement)] : [];
    }) ?? [];

    if (boxes.length === 0) return null;
    return {
        left: Math.min(...boxes.map((box) => box.left)),
        right: Math.max(...boxes.map((box) => box.right)),
        top: Math.min(...boxes.map((box) => box.top)),
        bottom: Math.max(...boxes.map((box) => box.bottom)),
    };
}

export function canonicalModuleBlockNames(input: PlacementInput, module: PcbModule) {
    const blockByName = new Map(input.blocks.map((block) => [block.name, block]));
    const moduleBlocks = new Set(module.block_names);
    const roots: string[] = [];
    for (const blockName of module.block_names) {
        const block = blockByName.get(blockName);
        if (!block) continue;
        if (block.attachTo && moduleBlocks.has(block.attachTo)) continue;
        roots.push(blockName);
    }
    return roots;
}

export function canonicalModuleDesignators(input: PlacementInput, module: PcbModule) {
    const blockByName = new Map(input.blocks.map((block) => [block.name, block]));
    const designators = new Set<string>();
    for (const blockName of canonicalModuleBlockNames(input, module)) {
        const block = blockByName.get(blockName);
        if (!block) continue;
        for (const designator of familyBlockDesignators(input, block)) designators.add(designator);
    }
    return designators;
}

export function moduleBboxLimit(input: PlacementInput, module: PcbModule, componentsByDesignator: Map<string, PcbComponent>) {
    const pseudoBlock = modulePseudoBlock(input, module);
    const estimate = estimateBlockBounds(input, pseudoBlock, componentsByDesignator);
    const scaleWidth = module.maxBboxScale ? estimate.width * module.maxBboxScale : null;
    const scaleHeight = module.maxBboxScale ? estimate.height * module.maxBboxScale : null;
    return {
        estimate,
        maxWidth: minDefined(scaleWidth, module.maxWidth),
        maxHeight: minDefined(scaleHeight, module.maxHeight),
    };
}

function modulePseudoBlock(input: PlacementInput, module: PcbModule): PcbBlock {
    return {
        ...module,
        name: module.name,
        description: '',
        component_designators: [...canonicalModuleDesignators(input, module)],
        role: 'generic',
        placement: 'main',
    };
}

function minDefined(...values: Array<number | null | undefined>) {
    const defined = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
    return defined.length > 0 ? Math.min(...defined) : null;
}
