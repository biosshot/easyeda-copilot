import type { CircuitAssembly, Circuit, CircuitComponent } from "#types/circuit.ts";
import type { ElkEdgeSection, LayoutOptions, ElkNode, ElkPort } from 'elkjs';
import masterLogger from "#logger.ts";
import type { DeepReadonly } from "#types/utils.ts";
import type { LayoutRecommendation, BlockNode, LayoutImprovements, BlockHierarchyNode, BlockDirLImprovement } from "#types/auto-place.ts";
import { getDesignatorLabel } from "#utils/component.ts";

const logger = masterLogger.child({ TAG: "search-layout-error" });

const Direction = {
    LEFT: 'LEFT',
    RIGHT: 'RIGHT',
    TOP: 'TOP',
    BOTTOM: 'BOTTOM'
} as const;

const DirectionRotateMap = {
    [Direction.LEFT]: {
        [Direction.LEFT]: 0,
        [Direction.RIGHT]: 180,
        [Direction.TOP]: -90,
        [Direction.BOTTOM]: 90,
    },
    [Direction.RIGHT]: {
        [Direction.LEFT]: 180,
        [Direction.RIGHT]: 0,
        [Direction.TOP]: 90,
        [Direction.BOTTOM]: -90,
    },
    [Direction.TOP]: {
        [Direction.LEFT]: 90,
        [Direction.RIGHT]: -90,
        [Direction.TOP]: 0,
        [Direction.BOTTOM]: 180,
    },
    [Direction.BOTTOM]: {
        [Direction.LEFT]: -90,
        [Direction.RIGHT]: 90,
        [Direction.TOP]: 180,
        [Direction.BOTTOM]: 0,
    },
} as const;

const searchEdgesSections = (designator: string, edges: ElkNode['edges']) => {
    const sections: ElkEdgeSection[] = [];

    for (const edge of edges ?? []) {
        for (const section of edge.sections ?? []) {
            if (!section.incomingShape || !section.outgoingShape) continue;
            const [sdesignator, spin] = section.incomingShape.split("_pin_");
            const [tdesignator, tpin] = section.outgoingShape.split("_pin_");

            if ([sdesignator, tdesignator].includes(designator))
                sections.push(section);
        }
    }

    return sections;
}

const sortSection = (designator: string, section: ElkEdgeSection) => {
    if (section.incomingShape?.includes?.(designator)) return section;

    return {
        id: section.id,
        startPoint: section.endPoint,
        endPoint: section.startPoint,
        bendPoints: section.bendPoints,
        incomingShape: section.outgoingShape,
        outgoingShape: section.incomingShape,
    }
}

const findKeyInObject = (obj: Record<string, number>, max = false) => {
    let minKey = '';
    let minValue = Infinity; // Initialize with a very large number

    if (max) {
        minValue = -Infinity;
    }

    for (const key in obj) {
        const value = obj[key];

        if (max) {
            if (value > minValue) {
                minValue = value;
                minKey = key;
            }
        }
        else {
            if (value < minValue) {
                minValue = value;
                minKey = key;
            }
        }
    }

    return minKey;
}

export const getPinDirection = (symbol: { width?: number, height?: number }, pin: { readonly x: number, readonly y: number }): typeof Direction[keyof typeof Direction] => {
    const obj = {
        [Direction.RIGHT]: (symbol.width || 10) - pin.x,
        [Direction.LEFT]: pin.x,
        [Direction.TOP]: pin.y,
        [Direction.BOTTOM]: (symbol.height || 10) - pin.y,
    }

    return findKeyInObject(obj) as typeof Direction[keyof typeof Direction];
}

const getSectionDirection = (section: DeepReadonly<ElkEdgeSection>): typeof Direction[keyof typeof Direction] => {
    const startPoint = section.startPoint;
    const endPoint = section.endPoint;

    const obj = {
        [Direction.RIGHT]: endPoint.x - startPoint.x,
        [Direction.LEFT]: startPoint.x - endPoint.x,
        [Direction.BOTTOM]: endPoint.y - startPoint.y,
        [Direction.TOP]: startPoint.y - endPoint.y,
    }

    return findKeyInObject(obj, true) as typeof Direction[keyof typeof Direction];;
}

const searchPort = (ports: ElkPort[] | undefined, num: number | string) => {
    return (ports ?? []).find(p => num == p.id?.split?.('_pin_')[1]);
}

function checkRotateImprovents(node: BlockNode, component: CircuitComponent, sections: ElkEdgeSection[], topLevelBlocks: BlockHierarchyNode[]): LayoutRecommendation[] | null {
    const searchBlock = (designator: string, topLevelBlocks: BlockHierarchyNode[]): BlockHierarchyNode | null => {
        const node = topLevelBlocks.find(n => n.components.find(c => c.designator === designator));
        if (node) return node;

        for (const node of topLevelBlocks) {
            const tNode = searchBlock(designator, node.children ?? []);
            if (tNode) return tNode;
        }

        return null;
    }

    const block = searchBlock(component.designator, topLevelBlocks);

    if (!block) {
        logger.debug(component, 'not found block for');
        return null;
    }

    const sectionsWithDir = sections.map(section => ({
        section,
        direction: getSectionDirection(section)
    }));

    const countArray = (arr: (string | number)[]) => {
        const obj = {} as { [key: string]: number };
        for (const key of arr) {
            obj[key as string] = (obj[key as string] ?? 0) + 1;
        }
        return obj;
    }

    const rotateToGnd = (component: CircuitComponent): LayoutRecommendation | null => {
        const gndPin = component.pins.find(p => p.signal_name.includes('GND'));
        if (!gndPin) {
            logger.debug({ component }, 'Not found GND pin');
            return null;
        }
        const gndPort = searchPort(node.ports, gndPin.pin_number);
        if (!gndPort) {
            logger.debug({ node, component }, 'Not found GND port');
            return null;
        }
        const directionGnd = getPinDirection(node, { x: gndPort.x || 0, y: gndPort.y || 0 });
        const rotate = DirectionRotateMap[directionGnd][Direction.BOTTOM];
        return {
            type: 'rotate',
            designator: component.designator,
            rotate
        };
    }

    const componentLabel = getDesignatorLabel(component.designator);

    if (block.name.startsWith('parl') || component.pins.length <= 2 || (componentLabel === 'Транзистор' && component.pins.length === 3)) {
        const r = rotateToGnd(component);
        if (r) return [r];
    }
    else if (componentLabel === 'Разъемы') {
        const dirs = (node.ports ?? []).map(p => getPinDirection(node, { x: p.x || 0, y: p.y || 0 }))
        const readRotate = findKeyInObject(countArray(dirs), true) as typeof Direction[keyof typeof Direction];

        const isInputBlock = block.links.input.length < block.links.output.length;
        if (isInputBlock) {
            const rotate = DirectionRotateMap[readRotate][Direction.RIGHT];
            if (rotate === 0) return null;

            return [{
                type: 'rotate',
                designator: component.designator,
                rotate
            }]

        }

        else {
            const rotate = DirectionRotateMap[readRotate][Direction.LEFT];
            if (rotate === 0) return null;

            return [{
                type: 'rotate',
                designator: component.designator,
                rotate
            }]

        }
    }

    let errorDir = 0;
    const bestRotate = [] as number[];

    for (const pin of component.pins) {
        const sections = sectionsWithDir.filter(section => pin.pin_number == section.section.incomingShape?.split?.('_pin_')[1]);

        if (!sections.length) {
            logger.error({ sections, pin, designator: component.designator }, 'Not found sections');
            continue;
        }

        const nodePin = searchPort(node.ports, pin.pin_number);

        if (!nodePin || typeof nodePin.x === 'undefined' || typeof nodePin.y === 'undefined') {
            logger.error({ nodePin, ports: node.ports }, 'Not found nodePin');
            continue;
        }

        const direction = getPinDirection(node, { x: nodePin.x, y: nodePin.y });

        if (!sections.find(section => section.direction === direction)) {
            ++errorDir;
            bestRotate.push(...sections.map(section => DirectionRotateMap[direction][section.direction]));
        }
    }

    if (errorDir / component.pins.length >= 0.6 || (errorDir === 1 && component.pins.length === 2)) {
        const rotate = Number(findKeyInObject(countArray(bestRotate), true));
        logger.debug({
            designator: component.designator,
            rotate,
            "node.rotate": node.rotate
        }, "Maybe change dir");

        return [{
            type: 'rotate',
            designator: component.designator,
            rotate
        }]
    }

    return null;
}

function checkBlockDirectionImprovents(elkNodes: BlockNode[], layoutedGraph: ElkNode, history: LayoutImprovements[]): BlockDirLImprovement[] | null {
    const sequence = ['LEFT', 'RIGHT', 'UP', 'DOWN'] as const;
    const improvementFound: BlockDirLImprovement[] = [];

    // Посчитай абсолютную длинну всех рёбер (для оценки качества компоновки) в каждом отдельном блоке
    const countLen = (elkNodes: DeepReadonly<BlockNode[]>) => {
        for (const block of elkNodes) {
            if (!block.id.startsWith('block_') || block.id.startsWith('block_parl')) continue;
            if (block.allowedImprovements && !block.allowedImprovements.includes('block_direction')) {
                countLen(block.children ?? []);
                continue;
            }

            let totalEdgeLength = 0;
            const blockEdges = layoutedGraph.edges?.filter(e => e.container === block.id);

            if (blockEdges) {
                for (const edge of blockEdges) {
                    if (!edge.sections) continue;
                    for (const section of edge.sections) {
                        const dx = section.endPoint.x - section.startPoint.x;
                        const dy = section.endPoint.y - section.startPoint.y;
                        totalEdgeLength += Math.sqrt(dx * dx + dy * dy);
                    }
                }
            }

            countLen(block.children ?? []);

            let prev: BlockDirLImprovement | undefined;

            history.findLast(h => h.improvements.findLast(i => {
                if (i.type !== 'block_direction') return false;
                if (i.blockName === block.id) {
                    prev = i;
                    return true;
                }
                return false;
            }));

            if (prev?.isFinal) {
                logger.debug({ block: block.id }, "Block direction improvement is final, skip");
                continue;
            }

            let nextDir: typeof sequence[number];

            let isFinal = false;

            if (!prev) {
                nextDir = sequence[0];
            }
            else if (prev.direction === sequence.at(-1)) {
                const prevs = [] as BlockDirLImprovement[];

                for (const i of history) {
                    for (const imp of i.improvements) {
                        if (imp.type !== 'block_direction' || imp.blockName !== block.id) continue;
                        prevs.push(imp);
                    }
                }

                const measurements = prevs.map((improvement, index) => ({
                    direction: index === 0 ? improvement.direction : prevs[index - 1].direction,
                    length: improvement.lengthBefore,
                }));
                measurements.push({ direction: prev.direction, length: totalEdgeLength });
                const bestMeasurement = measurements.reduce((best, current) =>
                    current.length < best.length ? current : best);

                nextDir = bestMeasurement.direction;

                logger.debug({
                    measurements,
                    block: block.id,
                    dir: nextDir,
                    len: bestMeasurement.length,
                }, "Block direction cycle improvement found");

                isFinal = true;
            }
            else {
                nextDir = sequence[(sequence.indexOf(prev.direction) + 1) % sequence.length];
            }

            improvementFound.push({
                blockName: block.id,
                type: 'block_direction',
                // currentDirection: block.layoutOptions?.['org.eclipse.elk.direction'] as 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' || 'RIGHT',
                direction: nextDir,
                lengthBefore: totalEdgeLength,
                isFinal
            })

            logger.debug({
                block: block.id, direction: nextDir, totalEdgeLength, currentDirection: prev?.direction ?? "none",
                layoutOptions: block.layoutOptions
            }, "Block direction improvement found");
        }
    }

    countLen(elkNodes);

    return improvementFound;
}

export function searchLayoutImprovements(
    circuit: Circuit,
    layoutedGraph: ElkNode,
    elkNodes: BlockNode[], topLevelBlocks: BlockHierarchyNode[],
    signalMap: DeepReadonly<Record<string, { nodeId: string; portId: string, blockName: string }[]>>,
    history: LayoutImprovements[],
    excludedDesignators: ReadonlySet<string> = new Set(),
): LayoutImprovements {
    const componentToCheck = circuit.components
        .filter(comp => !excludedDesignators.has(comp.designator))
        .filter(comp => comp.pins.length <= 4 && !comp.designator.startsWith('U'));

    const improvements: LayoutRecommendation[] = [];

    const searchNode = (designator: string, nodes: BlockNode[] = elkNodes): BlockNode | null => {
        const node = nodes.find(n => n.id === designator);
        if (node) return node;

        for (const node of nodes) {
            const tNode = searchNode(designator, node.children ?? []);
            if (tNode) return tNode;
        }

        return null;
    }

    for (const component of componentToCheck) {
        const sections = searchEdgesSections(component.designator, layoutedGraph.edges).map(c => sortSection(component.designator, c));
        const node = searchNode(component.designator)

        if (!node || !node.ports) {
            logger.warn({ designator: component.designator, node }, "Not found node for");
            continue;
        }

        const rotImp = checkRotateImprovents(node, component, sections, topLevelBlocks);
        if (rotImp) improvements.push(...rotImp);

        // const chIndex = checkChangeIndex(node, component, sections, topLevelBlocks, signalMap);

    }

    const dirImp = checkBlockDirectionImprovents(elkNodes, layoutedGraph, history);
    if (dirImp) improvements.push(...dirImp);

    return { improvements };
}
