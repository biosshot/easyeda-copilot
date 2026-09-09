import type { CircuitAssembly, Circuit, CircuitComponent } from "#types/circuit.ts";
import { circuitToSymbols, getSymbol } from "#devices/symbols/symbol-parser.ts";
import type { ElkEdgeSection, LayoutOptions, ElkNode, ElkPort, ElkExtendedEdge } from 'elkjs';
import type { SymbolData, SymbolPin, SymbolWithMeta, ShortSymbol } from "#types/symbol.ts";
import { shortSymbolsMap, stableShortSymbolId } from "./short-symbol.ts";
import { readFile, writeFile } from "fs/promises";
import { layout } from "./layout.ts";
import type { BlockHierarchyNode, PositionedSchNode, BlockNode, LayoutImprovements, Hooks } from "#types/auto-place.ts";
import masterLogger from "#logger.ts";
import { getPinDirection, searchLayoutImprovements } from "./improvement.ts";
import { rotatePointClockwise } from "#utils/math.ts";
import { recalculateRootBlock } from '#utils/circuit-merge.ts';
import { SCHEMATIC_SHEET } from '#utils/schematic-packing.ts';
import { splitMultiPartComponent } from "./search-many-part-comp.ts";
import { writeFileSync } from "fs";
import {
    evaluateLayoutQuality,
    layoutCompatibilitySignature,
    safelyImprovesExtremeAspect,
    safelyImprovesLayout,
    type LayoutQuality,
} from './quality.ts';
import { BASELINE_LAYOUT_PROFILE, LOCAL_LAYOUT_PROFILES, WRAPPED_LAYOUT_PROFILE } from './profiles.ts';
import { setSingleLocalBlockDirection, type LayoutDirection } from './local-transforms.ts';
import { createSchematicScene } from './scene.ts';
import { refineSchematicScene } from './refinement/index.ts';
import { singletonPortSignals } from './singleton-ports.ts';
import { hasConnection, isNoConnect } from './signals.ts';
import { circuitLayoutPatterns, refinedCircuitLayoutPatterns } from './patterns/registry.ts';
import { normalizeRotation, rotateSymbolGeometry } from './patterns/helpers.ts';
import { resolveSceneBlocks } from './refinement/scope.ts';
import { labelLocalizedPatternBoundaries } from './patterns/boundary-labels.ts';
import { seriesOrientations, terminalTopologySignature, namedSupplyNets, sharedSupplyNets, localCapacitorBankBlocks } from './graph-order.ts';
import {
    applyPatternMacrosToHierarchy,
    detectPatternMacros,
    expandPatternMacros,
    preparePatternMacros,
    type CircuitLayoutPattern,
    type MacroInstance,
} from './patterns/index.ts';

// Ребилд нужен был из за createComponentElkNode где все завязанно на symbolwithmeta

const logger = masterLogger.child({ TAG: "circuit-auto-placement" });

function buildBlockHierarchy(circuit: Circuit, nodes: SymbolWithMeta[]): BlockHierarchyNode {
    const blockMap: Record<string, BlockHierarchyNode> = {};
    const designatorToNode: Record<string, SymbolWithMeta> = {};

    // Initialize block nodes
    for (const block of circuit.blocks) {
        blockMap[block.name] = {
            // description: '',
            description: block.description,
            name: block.name,
            children: [],
            components: [],
            links: {
                input: circuit.blocks.filter(b => b.next_block_names.includes(block.name)).map(b => b.name),
                output: block.next_block_names
            },
            layoutOptions: {}
        };
    }

    const rootBlock = blockMap.__v_root__ ?? {
        name: '__v_root__',
        description: '',
        children: [],
        components: [],
        links: {
            input: [],
            output: [],
        },
        layoutOptions: {},
    };
    blockMap.__v_root__ = rootBlock;
    rootBlock.layoutOptions['org.eclipse.elk.direction'] ??= 'LEFT';

    // Map components to their nodes
    for (const node of nodes) {
        designatorToNode[node.designator] = node;
    }

    // Assign components to blocks
    for (const component of circuit.components) {
        const node = designatorToNode[component.designator];
        if (node && blockMap[component.block_name]) {
            blockMap[component.block_name].components.push(node);
        }
    }

    // Build block hierarchy
    for (const block of circuit.blocks) {
        if (block.name === '__v_root__') continue;
        const blockNode = blockMap[block.name];
        rootBlock.children.push(blockNode);
    }

    return rootBlock;
}

export function createComponentElkNode(component: SymbolWithMeta, signalMap: Record<string, { nodeId: string; portId: string, blockName: string }[] | undefined>, blockName: string,
    createShortSymbol: (signalName: string, blockName: string, region?: string) => string | null,
    preservedSignalNames: ReadonlySet<string> = new Set()) {

    const faces = new Map(component.symbol.pins.map(pin => [pin.num,
        [['WEST', pin.x], ['EAST', component.symbol.width - pin.x], ['NORTH', pin.y], ['SOUTH', component.symbol.height - pin.y]]
            .sort((a, b) => Number(a[1]) - Number(b[1]))[0][0] as string]));
    const netFaces = new Map<string, Set<string>>();
    const netPinCounts = new Map<string, number>();
    for (const pin of component.symbol.pins) {
        const sides = netFaces.get(pin.signal_name) ?? new Set(); sides.add(faces.get(pin.num)!); netFaces.set(pin.signal_name, sides);
        netPinCounts.set(pin.signal_name, (netPinCounts.get(pin.signal_name) ?? 0) + 1);
    }
    const ports = component.symbol.pins.map((pin): ElkPort => {
        const portId = `${component.designator}_pin_${pin.num}`;
        const signalName = !hasConnection(pin.signal_name) ? '' : preservedSignalNames.has(pin.signal_name)
            ? pin.signal_name
            : createShortSymbol(pin.signal_name, blockName,
                // Split a fan-out, not a simple two-pin strap: another marker
                // on a small enable/supply connection can add unnecessary layers.
                netPinCounts.get(pin.signal_name)! > 2 && netFaces.get(pin.signal_name)!.size > 1 ? faces.get(pin.num) : undefined) ?? pin.signal_name;

        if (signalName) {
            if (!signalMap[signalName]) signalMap[signalName] = [];
            signalMap[signalName].push({ nodeId: component.designator, portId, blockName });
        }

        return {
            id: portId,
            width: 0,
            height: 0,
            x: pin.x,
            y: pin.y
        };
    });

    const nodes: ElkNode = {
        id: component.designator,
        width: component.symbol.width,
        height: component.symbol.height,
        ports,
        layoutOptions: {
            'elk.portConstraints': 'FIXED_POS',
        } as LayoutOptions,
        // @ts-ignore
        center: component.symbol.center,
    };

    if (component.symbol.center) {
        nodes.x = component.symbol.center.x;
        nodes.y = component.symbol.center.y;
        // @ts-ignore

        // nodes.layoutOptions['elk.nodeSize.constraints'] = "[ FIXED_POS ]";

        // nodes.layoutOptions['elk.position'] = '(570, 525)';

        // nodes.layoutOptions['org.eclipse.elk.layered.layering.fixed'] = 'true';
        // nodes.layoutOptions['org.eclipse.elk.position'] = "(570, 525)";

        // nodes.layoutOptions['org.eclipse.elk.stress.fixed'] = 'true';
        // nodes.layoutOptions["org.eclipse.elk.layered.crossingMinimization.forceNodeLayer"] = 'true';

    }

    return { nodes };
}

function createBlockNode(
    block: BlockHierarchyNode,
    signalMap: Record<string, { nodeId: string; portId: string, blockName: string }[] | undefined>,
    preservedSignalNames: ReadonlySet<string> = new Set(),
    localSupplies = false,
    labeledNets: ReadonlySet<string> = new Set(),
    sharedSupplies: ReadonlyMap<string, ReadonlySet<string>> = new Map(),
    inheritedShared: ReadonlySet<string> = new Set(),
): BlockNode {
    const children: BlockNode[] = [];
    const blockName = `block_${block.name}`
    const shared = sharedSupplies.get(block.name) ?? inheritedShared;
    const preserved = new Set([...preservedSignalNames].filter(net => !localSupplies || !labeledNets.has(net) || shared.has(net)));

    const shortSymbols: Record<string, ShortSymbol[] | undefined> = {};

    const maxShortSymbol: Record<string, number | undefined> = {};
    const usedCoutners: Record<string, number | undefined> = {};
    const createdCounters: Record<string, number | undefined> = {};

    for (const name in shortSymbolsMap) {
        maxShortSymbol[name] = Math.round(block.components.filter(c => c.symbol.pins.filter(
            p => shortSymbolsMap[name as keyof typeof shortSymbolsMap].is(p.signal_name)
        )).flat().length / 5);

        maxShortSymbol[name] = Math.max(1, maxShortSymbol[name]);
    }

    const localShorts = new Map<string, ShortSymbol>();
    let currentOwner = '';
    const createShortSymbol = (signalName: string, blockName: string, region?: string) => {
        const name = Object.keys(shortSymbolsMap).find(t => shortSymbolsMap[t as keyof typeof shortSymbolsMap].is(signalName))
            ?? (labeledNets.has(signalName) ? 'NETPORT' : undefined);
        if (!name) return null;

        if (localSupplies && !shared.has(signalName)) {
            // Different faces of a large symbol need independent local flags;
            // one shared flag must not drag a ground loop around the body.
            const scope = `${currentOwner}${region ? `/${region}` : ''}`;
            const key = `${scope}\u0000${signalName}`;
            let local = localShorts.get(key);
            if (!local) {
                local = shortSymbolsMap[name as keyof typeof shortSymbolsMap].create(signalName, blockName,
                    stableShortSymbolId(name, signalName, `${blockName}/${scope}`));
                localShorts.set(key, local);
                (shortSymbols[name] ??= []).push(local);
                signalMap[local.node.id] = [{ nodeId: local.node.id, portId: local.node.ports![0].id, blockName }];
            }
            return local.node.id;
        }

        let symbol: ShortSymbol | undefined;
        const shortSymbol = shortSymbols[name];

        if (shortSymbol && shortSymbol.filter(s => s.component.pins[0].signal_name === signalName).length >= (shared.has(signalName) ? 1 : maxShortSymbol[name] ?? 0)) {
            let min = Infinity;

            for (const s of shortSymbol) {
                if (s.component.pins[0].signal_name !== signalName) continue;
                const count = usedCoutners[s.component.designator] || 0;
                if (count < min) {
                    min = count;
                    symbol = s;
                }
            }
        }

        if (!symbol) {
            const counterKey = `${name}\u0000${signalName}`;
            const ordinal = createdCounters[counterKey] ?? 0;
            createdCounters[counterKey] = ordinal + 1;
            symbol = shortSymbolsMap[name as keyof typeof shortSymbolsMap].create(
                signalName,
                blockName,
                stableShortSymbolId(name, signalName, blockName, ordinal),
            );
            if (shortSymbol) shortSymbol.push(symbol);
            else shortSymbols[name] = [symbol];
        }

        usedCoutners[symbol.component.designator] = (usedCoutners[symbol.component.designator] || 0) + 1;

        signalName = symbol.node.id;

        if (signalName) {
            if (!signalMap[signalName]) signalMap[signalName] = [];
            if (!symbol.node?.ports?.[0]?.id) logger.warn("Port id is null")
            // @ts-ignore
            signalMap[signalName].push({ nodeId: signalName, portId: symbol.node?.ports?.[0]?.id ?? "", blockName });
            return signalName;
        }
        return null;
    }

    for (const comp of block.components) {
        currentOwner = comp.designator;
        const { nodes } = createComponentElkNode(
            comp,
            signalMap,
            blockName,
            createShortSymbol,
            preserved,
        );
        children.push(nodes);
    }

    children.push(...Object.values(shortSymbols).flat().map(s => s?.node as ElkNode));

    for (const childBlock of block.children) {
        const block = createBlockNode(childBlock, signalMap, preservedSignalNames, localSupplies, labeledNets, sharedSupplies, shared);
        children.push(block);
    }

    const node: BlockNode = {
        id: blockName,
        shortSymbols,
        description: block.description,
        children: children,
        layoutOptions: block.layoutOptions,
        allowedImprovements: block.allowedImprovements,
    };

    // if (block.name.startsWith('desc_')) {
    //     node.width = 200;
    //     node.height = 50;
    // }

    return node;
}

const searchNode = (designator: string, nodes: BlockNode[]): BlockNode | null => {
    const node = nodes.find(n => n.id === designator);
    if (node) return node;

    for (const node of nodes) {
        const tNode = searchNode(designator, node.children ?? []);
        if (tNode) return tNode;
    }

    return null;
}

function applyImprovements(elkNodes: BlockNode[], improvements: LayoutImprovements) {
    logger.debug("Apply improvents");

    for (const improvement of improvements.improvements) {

        if (improvement.type === 'rotate') {
            const node = searchNode(improvement.designator, elkNodes);
            if (!node) {
                logger.warn(improvement, "Not found node for improvement")
                continue;
            }

            const rotatedSize = rotatePointClockwise({ x: node.width || 10, y: node.height || 10 }, improvement.rotate);
            const size = { x: Math.abs(rotatedSize.x), y: Math.abs(rotatedSize.y) }

            const ports = (node.ports ?? []).map((p) => {
                const rotated = rotatePointClockwise({ x: (p.x || 0) - (node.width || 10) / 2, y: (p.y || 0) - (node.height || 10) / 2 }, improvement.rotate);
                return { ...p, x: rotated.x + size.x / 2, y: rotated.y + size.y / 2 };
            })

            node.ports = ports;
            node.width = size.x;
            node.height = size.y;
            node.rotate = (node.rotate ?? 0) + improvement.rotate;
        }
        else if (improvement.type === 'block_direction') {
            const node = searchNode(improvement.blockName, elkNodes);
            if (!node) {
                logger.warn(improvement, "Not found block for improvement")
                continue;
            }
            node.layoutOptions = node.layoutOptions || {};
            node.layoutOptions['org.eclipse.elk.direction'] = improvement.direction;
        }
    }
}

type SignalEndpoint = { nodeId: string; portId: string; blockName: string };

type ExternalPortSide = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';
type ElkLayoutDirection = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';

function endpointSide(block: BlockNode, endpoint: SignalEndpoint): ExternalPortSide | null {
    if (endpoint.nodeId === '__virt__') return null;
    const node = searchNode(endpoint.nodeId, block.children ?? []);
    const port = node?.ports?.find(item => item.id === endpoint.portId);
    if (!node || !port) return null;
    const side = getPinDirection(node, { x: port.x ?? 0, y: port.y ?? 0 });
    if (side === 'TOP') return 'NORTH';
    if (side === 'BOTTOM') return 'SOUTH';
    return side === 'LEFT' ? 'WEST' : 'EAST';
}

function layoutSourceSide(direction: ElkLayoutDirection): ExternalPortSide {
    if (direction === 'LEFT') return 'EAST';
    if (direction === 'UP') return 'SOUTH';
    if (direction === 'DOWN') return 'NORTH';
    return 'WEST';
}

function layoutTargetSide(direction: ElkLayoutDirection): ExternalPortSide {
    if (direction === 'LEFT') return 'WEST';
    if (direction === 'UP') return 'NORTH';
    if (direction === 'DOWN') return 'SOUTH';
    return 'EAST';
}

function appendExternalSignalEndpoints(
    target: SignalEndpoint[],
    block: BlockNode,
    netPort: SignalEndpoint,
    localEndpoints: SignalEndpoint[],
    sideAware: boolean,
    passthroughEndpoints: SignalEndpoint[] = [],
) {
    if (!sideAware) {
        target.push(netPort, ...passthroughEndpoints, ...localEndpoints);
        return;
    }
    const sides = new Set(localEndpoints
        .map(endpoint => endpointSide(block, endpoint))
        .filter((side): side is ExternalPortSide => side !== null));
    const direction = (block.layoutOptions?.['org.eclipse.elk.direction'] ?? 'LEFT') as ElkLayoutDirection;
    const side = sides.size === 1 ? [...sides][0] : null;

    // ELK places sources at the beginning of the layout direction and targets at
    // its end. Keep a WEST/NORTH macro input before the component and an
    // EAST/SOUTH output after it instead of making every NETPORT a target.
    if (side === layoutSourceSide(direction)) {
        target.push(...localEndpoints, netPort, ...passthroughEndpoints);
    } else target.push(netPort, ...passthroughEndpoints, ...localEndpoints);
}

function orientInternalPatternSignals(
    root: BlockNode,
    signalMap: Record<string, SignalEndpoint[]>,
    macros: MacroInstance[],
) {
    const blocks = new Map<string, BlockNode>();
    const collectBlocks = (node: BlockNode) => {
        if (node.id.startsWith('block_')) blocks.set(node.id, node);
        for (const child of node.children ?? []) collectBlocks(child);
    };
    collectBlocks(root);

    const portSides = new Map(macros.flatMap(macro => macro.ports.map(port => [
        `${macro.id}\u0000${port.elkPortId}`,
        port.side,
    ] as const)));

    for (const signalName of new Set(macros.flatMap(macro => macro.ports.map(port => port.signalName)))) {
        const endpoints = signalMap[signalName];
        if (!endpoints || endpoints.length < 2) continue;
        const reordered = [...endpoints];

        for (const blockName of new Set(endpoints.map(endpoint => endpoint.blockName))) {
            const indexes = endpoints
                .map((endpoint, index) => endpoint.blockName === blockName ? index : -1)
                .filter(index => index >= 0);
            if (indexes.length < 2) continue;
            const localEndpoints = indexes.map(index => endpoints[index]);
            const macroEndpoint = localEndpoints.find(endpoint =>
                portSides.has(`${endpoint.nodeId}\u0000${endpoint.portId}`));
            if (!macroEndpoint) continue;
            const side = portSides.get(`${macroEndpoint.nodeId}\u0000${macroEndpoint.portId}`)!;
            const block = blocks.get(blockName);
            const direction = (block?.layoutOptions?.['org.eclipse.elk.direction'] ?? 'LEFT') as ElkLayoutDirection;
            const others = localEndpoints.filter(endpoint => endpoint !== macroEndpoint);
            let orderedLocal: SignalEndpoint[] | null = null;
            if (side === layoutSourceSide(direction)) orderedLocal = [macroEndpoint, ...others];
            else if (side === layoutTargetSide(direction)) orderedLocal = [others[0], macroEndpoint, ...others.slice(1)];
            if (!orderedLocal) continue;
            indexes.forEach((index, ordinal) => {
                reordered[index] = orderedLocal[ordinal];
            });
        }
        signalMap[signalName] = reordered;
    }
}

const CLIENT_MANAGED_PORT_MIN_COUNT = 5;

export function denseSingletonSignals(
    signals: [string, SignalEndpoint[]][],
    blockName: string,
): Set<string> {
    const byNode = new Map<string, string[]>();

    for (const [signalName, endpoints] of signals) {
        const local = endpoints.filter(endpoint => endpoint.blockName === blockName);
        if (local.length !== 1 || local[0].nodeId === '__virt__') continue;

        const nodeSignals = byNode.get(local[0].nodeId) ?? [];
        nodeSignals.push(signalName);
        byNode.set(local[0].nodeId, nodeSignals);
    }

    return new Set(
        [...byNode.values()]
            .filter(nodeSignals => nodeSignals.length >= CLIENT_MANAGED_PORT_MIN_COUNT)
            .flat(),
    );
}

function searchExternalSignals(
    elkNode: BlockNode,
    signalMap: Record<string, SignalEndpoint[]>,
    sideAwareSignals: ReadonlySet<string> = new Set(),
    clientManagedLabels: Array<{ pinId: string; signalName: string }> = [],
) {

    if (elkNode.id.startsWith('block_')) {
        const childExternal: Record<string, { portId: string, extName: string, blockName: string }[]> = {};
        const pathToDel: [string, string][] = [];

        const externalSignals = Object.fromEntries(Object.entries(signalMap)
            .filter(([signalName, ends]) => ends.find(e => e.blockName === elkNode.id))
            .filter(([signalName, ends]) => ends.find(e => e.blockName !== elkNode.id)));

        for (const node of elkNode.children ?? []) {
            const r = searchExternalSignals(node, signalMap, sideAwareSignals, clientManagedLabels);

            for (const [name, endPoints] of Object.entries(r.external)) {
                if (!childExternal[name]) childExternal[name] = endPoints
                else childExternal[name].push(...endPoints);
            }

            pathToDel.push(...r.pathToDel)
            // externalSignals = { ...r.externalSignals, ...externalSignals }
        }

        const myExternal: Record<string, { portId: string, extName: string, blockName: string }[]> = {};

        if (elkNode.ports?.length) {
            throw new Error('Port is not null')
        }

        const externalEntries = Object.entries(externalSignals);
        const clientManagedSignals = denseSingletonSignals(externalEntries, elkNode.id);

        // elkNode.ports =
        externalEntries.forEach(([externalSName, externalEndPoints]) => {

            if (clientManagedSignals.has(externalSName) && !sideAwareSignals.has(externalSName)) {
                for (const point of externalEndPoints) {
                    if (point.blockName === elkNode.id) {
                        pathToDel.push([externalSName, point.portId]);
                        clientManagedLabels.push({ pinId: point.portId, signalName: externalSName });
                    }
                }
                return;
            }

            const nePort = shortSymbolsMap['NETPORT'].create(
                externalSName,
                elkNode.id,
                stableShortSymbolId('NETPORT_EXTERNAL', externalSName, elkNode.id),
            );

            elkNode.children?.push?.(nePort.node);
            if (!elkNode.shortSymbols) elkNode.shortSymbols = {}
            if (!elkNode.shortSymbols?.['NETPORT']) elkNode.shortSymbols['NETPORT'] = [];
            elkNode.shortSymbols['NETPORT'].push(nePort);

            const pName = nePort.node?.ports?.[0]?.id;
            const extName = `ext_${elkNode.id}_${externalSName}`;

            if (!signalMap[extName]) signalMap[extName] = [];
            const netPortEndpoint = {
                blockName: elkNode.id,
                nodeId: '__virt__',
                portId: pName ?? '',
            };

            const chilExt = childExternal[externalSName];
            const passthroughEndpoints = (chilExt ?? []).map(ext => ({
                blockName: ext.blockName,
                nodeId: '__virt__',
                portId: ext.portId,
            }));

            const localEndpoints = externalEndPoints.filter(point => point.blockName === elkNode.id);
            for (const point of localEndpoints) pathToDel.push([externalSName, point.portId]);
            appendExternalSignalEndpoints(
                signalMap[extName],
                elkNode,
                netPortEndpoint,
                localEndpoints,
                sideAwareSignals.has(externalSName),
                passthroughEndpoints,
            );
        });

        if (!elkNode.layoutOptions) elkNode.layoutOptions = {};
        elkNode.layoutOptions['org.eclipse.elk.portConstraints'] = 'FIXED_SIDE';
        if (!elkNode.layoutOptions['org.eclipse.elk.direction'])
            elkNode.layoutOptions['org.eclipse.elk.direction'] = 'LEFT';

        return { external: myExternal, pathToDel, externalSignals };
    }

    return { external: {}, pathToDel: [], externalSignals: {} };
}

function addForcedExternalSignals(
    elkNode: BlockNode,
    signalMap: Record<string, SignalEndpoint[]>,
    externalSignals: string[],
    sideAwareSignals: ReadonlySet<string> = new Set(),
) {
    // Collect all block nodes
    const blockNodes: BlockNode[] = [];
    const collectBlocks = (node: BlockNode) => {
        if (node.id.startsWith('block_')) blockNodes.push(node);
        for (const child of node.children ?? []) collectBlocks(child);
    };
    collectBlocks(elkNode);

    const forcedEntries = [...new Set(externalSignals)]
        .map(signalName => [signalName, signalMap[signalName]] as const)
        .filter((entry): entry is [string, SignalEndpoint[]] => Boolean(entry[1]?.length))
        .filter(([signalName]) => !Object.keys(signalMap)
            .some(key => key.startsWith('ext_') && key.endsWith(`_${signalName}`)));
    const clientManagedByBlock = new Map(
        blockNodes.map(blockNode => [
            blockNode.id,
            denseSingletonSignals(forcedEntries, blockNode.id),
        ]),
    );

    for (const sig of externalSignals) {
        const endpoints = signalMap[sig];
        if (!endpoints || endpoints.length === 0) continue;

        // Check if already handled by searchExternalSignals (has ext_ entry for this signal)
        const alreadyExternal = Object.keys(signalMap).some(k => k.startsWith('ext_') && k.endsWith(`_${sig}`));
        if (alreadyExternal) continue;

        // Find which blocks contain this signal
        const sigBlockNames = [...new Set(endpoints.map(e => e.blockName))];

        // Add NETPORT to each block that contains this signal
        const extName = `ext_forced_${sig}`;
        signalMap[extName] = [];

        for (const blockNode of blockNodes) {
            if (!sigBlockNames.includes(blockNode.id)) continue;
            if (clientManagedByBlock.get(blockNode.id)?.has(sig) && !sideAwareSignals.has(sig)) continue;

            const nePort = shortSymbolsMap['NETPORT'].create(
                sig,
                blockNode.id,
                stableShortSymbolId('NETPORT_FORCED', sig, blockNode.id),
            );
            blockNode.children?.push(nePort.node);
            if (!blockNode.shortSymbols) blockNode.shortSymbols = {};
            if (!blockNode.shortSymbols['NETPORT']) blockNode.shortSymbols['NETPORT'] = [];
            blockNode.shortSymbols['NETPORT'].push(nePort);

            const pName = nePort.node?.ports?.[0]?.id ?? '';
            const localEndpoints = endpoints.filter(endpoint => endpoint.blockName === blockNode.id);
            appendExternalSignalEndpoints(signalMap[extName], blockNode, {
                blockName: blockNode.id,
                nodeId: '__virt__',
                portId: pName,
            }, localEndpoints, sideAwareSignals.has(sig));
        }

        if (signalMap[extName].length === 0) delete signalMap[extName];
    }
}

export function computeAbsolutePositions(
    elkNode: BlockNode,
    parentX: number = 0,
    parentY: number = 0,
): PositionedSchNode[] {
    const positioned: PositionedSchNode[] = [];
    const currentX = parentX + (elkNode.x || 0);
    const currentY = parentY + (elkNode.y || 0);

    // Process child nodes
    if (elkNode.children) {
        for (const child of elkNode.children) {
            positioned.push(...computeAbsolutePositions(child, currentX, currentY));
        }
    }
    // Process leaf components
    else {
        // console.log(elkNode.width, elkNode.height, node?.symbol.width, node?.symbol.height)
        const w = elkNode.width || 10;
        const h = elkNode.height || 10;

        const rotate = elkNode.rotate ?? 0;

        // ELK carries rotated bounds but the original library insertion point.
        const swapAxes = normalizeRotation(rotate) % 180 === 90;
        const center = elkNode.center ? rotateSymbolGeometry({
            width: swapAxes ? h : w,
            height: swapAxes ? w : h,
            center: elkNode.center,
            pins: [],
        }, rotate).center : {
            x: w / 2,
            y: h / 2
        };

        positioned.push({
            designator: elkNode.id,
            x: currentX,
            y: currentY,
            center,
            width: w,
            height: h,
            rotate,
        });
    }

    return positioned;
}

type AutoPlaceHierarchyOptions = {
    externalSignals?: string[];
    layoutMode?: 'legacy' | 'quality';
    layoutPatternCatalog?: CircuitLayoutPattern[];
    layoutPatterns?: boolean;
    layoutRefinement?: boolean;
    onLayoutDiagnostics?: (diagnostics: LayoutDiagnostics) => void;
};

type LayoutCandidate = {
    name: string;
    saved: Awaited<ReturnType<typeof layout>>;
    inputNodes: BlockNode;
    quality: LayoutQuality;
    compatibilitySignature: string;
    improvementCount: number;
};

export type LayoutDiagnostics = {
    selected: string | null;
    legacy: string | null;
    candidates: Array<{
        name: string;
        improvementCount: number;
        quality: LayoutQuality;
    }>;
};

export type SchematicLayoutResult = {
    improvementsHistory: LayoutImprovements[];
    addedSymbol: CircuitComponent[];
    positioned: PositionedSchNode[];
    edges: ElkExtendedEdge[];
    width: number;
    height: number;
    layoutedGraph?: ElkNode;
    renderGraph?: ElkNode;
    refinement?: ReturnType<typeof refineSchematicScene>['stats'];
    /** External terminals deliberately left to EasyEDA's dense-pin net labels.
     * Diagnostics only: these labels reserve no geometry on the server. */
    clientManagedLabels?: Array<{ pinId: string; signalName: string }>;
};

export async function autoPlaceCircuitWithHierarchy(sch: Circuit, nodes: SymbolWithMeta[], hooks?: Hooks, options?: AutoPlaceHierarchyOptions): Promise<SchematicLayoutResult> {
    // Patterns and external-boundary aliases must never reinterpret NC as a
    // net. Preserve the physical pins and the caller's original signal metadata.
    sch = { ...sch, components: sch.components.map(c => ({ ...c,
        pins: c.pins.map(p => isNoConnect(p.signal_name) ? { ...p, signal_name: '' } : p) })) };
    nodes = nodes.map(n => ({ ...n, symbol: { ...n.symbol,
        pins: n.symbol.pins.map(p => isNoConnect(p.signal_name) ? { ...p, signal_name: '' } : p) } }));
    const sharedSupplies = options?.layoutRefinement ? sharedSupplyNets(sch.components, nodes) : new Map<string, ReadonlySet<string>>();
    const topLevelBlocks = buildBlockHierarchy(sch, nodes);
    if (options?.layoutRefinement) topLevelBlocks.layoutOptions['org.eclipse.elk.direction'] = 'RIGHT';
    let patternMacros: MacroInstance[] = [];
    let absorbedDesignators = new Set<string>();
    let localSupplyBanks = new Set<string>();

    if (options?.layoutPatterns !== false) {
        const detected = detectPatternMacros(sch, nodes, options?.layoutPatternCatalog
            ?? (options?.layoutRefinement ? refinedCircuitLayoutPatterns : circuitLayoutPatterns));
        const acceptedMacros = options?.layoutRefinement ? detected.macros.filter(macro => !macro.placements.some(p =>
            (p.designator.startsWith('U') || p.pins.length > 4) && ((p.rotate % 360) + 360) % 360 !== 0)) : detected.macros;
        if (options?.layoutRefinement) {
            localSupplyBanks = localCapacitorBankBlocks(acceptedMacros, sch.components, nodes);
            for (const name of localSupplyBanks) sharedSupplies.set(name, new Set());
        }
        // A nested pattern becomes an independent drawing block with boundary
        // flags. Keep it inline when its supply must stay visibly connected.
        patternMacros = await preparePatternMacros(acceptedMacros.map(macro =>
            macro.layoutChildBlock && !localSupplyBanks.has(macro.layoutChildBlock.name)
                && macro.ports.some(p => sharedSupplies.get(macro.blockName)?.has(p.signalName))
                ? { ...macro, layoutChildBlock: undefined } : macro));
        absorbedDesignators = new Set(patternMacros.flatMap(macro => macro.absorbedDesignators));
        applyPatternMacrosToHierarchy(topLevelBlocks, patternMacros);
    }

    const patternBoundarySignals = new Set(
        patternMacros.flatMap(macro => macro.ports.map(port => port.signalName)),
    );
    const signalMap: Record<string, { nodeId: string; portId: string, blockName: string }[]> = {};
    const labeledNets = new Set(options?.layoutRefinement ? namedSupplyNets(sch.components, nodes) : []);
    const elkNodes = createBlockNode(
        topLevelBlocks,
        signalMap,
        patternBoundarySignals,
        options?.layoutRefinement,
        labeledNets,
        sharedSupplies,
    );
    // writeFile('.test-output/signalMap_f.json', JSON.stringify(signalMap, null, 2));

    const clientManagedLabels: Array<{ pinId: string; signalName: string }> = [];
    const { pathToDel } = searchExternalSignals(elkNodes, signalMap, patternBoundarySignals, clientManagedLabels);

    for (const p of pathToDel) {
        signalMap[p[0]] = signalMap[p[0]].filter(s => s.portId !== p[1])
    }

    // Force external signals: add NETPORT for each block where the signal exists
    const danglingPatternBoundarySignals = [...patternBoundarySignals]
        .filter(signalName => signalMap[signalName]?.length === 1);
    const singletonSignals = options?.layoutRefinement ? singletonPortSignals(sch.components, signalMap) : [];
    const forcedExternalSignals = [
        ...danglingPatternBoundarySignals,
        ...singletonSignals,
        ...(options?.externalSignals ?? []),
    ];
    if (forcedExternalSignals.length) {
        addForcedExternalSignals(elkNodes, signalMap, forcedExternalSignals,
            new Set([...patternBoundarySignals, ...singletonSignals]));
    }
    if (options?.layoutRefinement) labelLocalizedPatternBoundaries(elkNodes, signalMap, patternMacros, [...labeledNets,
        ...patternMacros.filter(m => m.layoutChildBlock && localSupplyBanks.has(m.layoutChildBlock.name)).flatMap(m => m.ports.map(p => p.signalName))]);
    orientInternalPatternSignals(elkNodes, signalMap, patternMacros);
    const series = options?.layoutRefinement ? seriesOrientations(sch.components, nodes, absorbedDesignators) : [];
    applyImprovements([elkNodes], { improvements: series });
    const orientedDesignators = new Set([...absorbedDesignators, ...series.flatMap(s => s.type === 'rotate' ? [s.designator] : [])]);

    // writeFile('.test-output/signalMap.json', JSON.stringify(signalMap, null, 2));
    // writeFile('.test-output/elkNodes.json', JSON.stringify(elkNodes, null, 2));

    // elkNodes = await readFile('.test-output/elkNodes.json', 'utf-8').then(JSON.parse) as unknown as BlockNode;
    // return;
    try {
        const bestLayout = {
            improvements: null as LayoutImprovements | null,
            candidate: null as LayoutCandidate | null,
        };

        const improvementsHistory: LayoutImprovements[] = [];
        const baselineCandidates: LayoutCandidate[] = [];
        const workingNodes = structuredClone(elkNodes);

        for (let index = 0; index < 8; index++) {
            logger.debug({ iteration: index }, 'Auto-placement iteration');
            const inputNodes = structuredClone(workingNodes);
            const layouted = await layout([workingNodes], signalMap, hooks, BASELINE_LAYOUT_PROFILE, options?.layoutRefinement);
            const improvements = searchLayoutImprovements(
                sch,
                layouted.layoutedGraph,
                [workingNodes],
                [topLevelBlocks],
                signalMap,
                improvementsHistory,
                orientedDesignators,
            );
            const candidate = {
                name: `baseline:${index}`,
                saved: structuredClone(layouted),
                inputNodes,
                quality: evaluateLayoutQuality(layouted.layoutedGraph),
                compatibilitySignature: (options?.layoutRefinement ? terminalTopologySignature : layoutCompatibilitySignature)(layouted.layoutedGraph),
                improvementCount: improvements.improvements.length,
            };
            baselineCandidates.push(candidate);

            if (bestLayout.improvements === null || improvements.improvements.length < (bestLayout.improvements?.improvements?.length ?? Infinity)) {
                bestLayout.improvements = improvements;
                bestLayout.candidate = candidate;
                logger.debug({ layoutImprovements: improvements.improvements.length }, 'New best layout');
            }

            if (bestLayout.improvements?.improvements?.length === 0)
                break;

            applyImprovements([workingNodes], improvements);

            improvementsHistory.push(improvements);
        }

        const legacyCandidate = bestLayout.candidate;
        let selectedCandidate = legacyCandidate;

        if (legacyCandidate && options?.layoutMode !== 'legacy' && sch.blocks.length === 1) {
            let qualityBaseline = legacyCandidate;
            for (const candidate of baselineCandidates) {
                if (!options?.layoutRefinement && candidate.improvementCount !== legacyCandidate.improvementCount) continue;
                if (candidate.compatibilitySignature !== legacyCandidate.compatibilitySignature) continue;
                if (safelyImprovesLayout(candidate.quality, qualityBaseline.quality)) {
                    qualityBaseline = candidate;
                }
            }
            let qualitySelected = qualityBaseline;

            const runCandidate = async (name: string, inputNodes: BlockNode, profile = LOCAL_LAYOUT_PROFILES[1]) => {
                const saved = await layout([inputNodes], signalMap, hooks, profile, options?.layoutRefinement);
                const improvements = searchLayoutImprovements(
                    sch,
                    saved.layoutedGraph,
                    [inputNodes],
                    [topLevelBlocks],
                    signalMap,
                    improvementsHistory,
                    orientedDesignators,
                );
                const candidate: LayoutCandidate = {
                    name,
                    saved,
                    inputNodes,
                    quality: evaluateLayoutQuality(saved.layoutedGraph),
                    compatibilitySignature: (options?.layoutRefinement ? terminalTopologySignature : layoutCompatibilitySignature)(saved.layoutedGraph),
                    improvementCount: improvements.improvements.length,
                };
                baselineCandidates.push(candidate);
                return candidate;
            };

            const considerCandidate = (candidate: LayoutCandidate, allowExtremeAspectTradeoff = false) => {
                if (!options?.layoutRefinement && candidate.improvementCount > qualitySelected.improvementCount) return false;
                if (candidate.compatibilitySignature !== qualityBaseline.compatibilitySignature) return false;
                const improves = safelyImprovesLayout(candidate.quality, qualitySelected.quality)
                    || (allowExtremeAspectTradeoff
                        && safelyImprovesExtremeAspect(candidate.quality, qualitySelected.quality));
                if (improves) qualitySelected = candidate;
                return improves;
            };

            for (const profile of LOCAL_LAYOUT_PROFILES) {
                try {
                    const inputNodes = structuredClone(qualityBaseline.inputNodes);
                    considerCandidate(await runCandidate(profile.name, inputNodes, profile));
                } catch (error) {
                    logger.warn({ error: String(error), profile: profile.name }, 'Optional layout candidate failed');
                }
            }

            if (legacyCandidate.quality.aspectRatio >= 2.2) {
                try {
                    const inputNodes = structuredClone(qualityBaseline.inputNodes);
                    considerCandidate(await runCandidate(WRAPPED_LAYOUT_PROFILE.name, inputNodes, WRAPPED_LAYOUT_PROFILE));
                } catch (error) {
                    logger.warn({ error: String(error) }, 'Wrapped layout candidate failed');
                }

                const directions: LayoutDirection[] = ['LEFT', 'RIGHT', 'UP', 'DOWN'];
                for (const direction of directions) {
                    try {
                        const inputNodes = setSingleLocalBlockDirection(qualityBaseline.inputNodes, direction);
                        if (!inputNodes) break;
                        const candidate = await runCandidate(`direction-${direction.toLowerCase()}`, inputNodes);
                        considerCandidate(candidate, true);
                    } catch (error) {
                        logger.warn({ direction, error: String(error) }, 'Direction layout candidate failed');
                    }
                }
            }

            selectedCandidate = qualitySelected;
        }

        options?.onLayoutDiagnostics?.({
            selected: selectedCandidate?.name ?? null,
            legacy: legacyCandidate?.name ?? null,
            candidates: baselineCandidates.map(candidate => ({
                name: candidate.name,
                improvementCount: candidate.improvementCount,
                quality: candidate.quality,
            })),
        });

        logger.debug({
            selected: selectedCandidate?.name,
            selectedQuality: selectedCandidate?.quality,
            legacyQuality: legacyCandidate?.quality,
        }, 'Schematic layout candidate selected');

        const { addedSymbol } = selectedCandidate?.saved ?? {};
        let { layoutedGraph } = selectedCandidate?.saved ?? {};

        if (!layoutedGraph)
            return {
                improvementsHistory,
                addedSymbol: [],
                positioned: [],
                edges: [],
                width: 2048,
                height: 2048,
                layoutedGraph: undefined,
                renderGraph: undefined,
                refinement: undefined,
            };

        layoutedGraph = hooks?.elkLayoutFinish?.(layoutedGraph) ?? layoutedGraph;

        const positioned: PositionedSchNode[] = [];

        if (layoutedGraph.children) {
            for (const child of layoutedGraph.children) {
                positioned.push(...computeAbsolutePositions(child, 0, 0));
            }
        }

        const calkOffset = (name: string, root: ElkNode = layoutedGraph): null | { x: number, y: number } => {
            if (Array.isArray(root.children))
                for (const child of root.children) {
                    if (child.id === name && child.x && child.y) {
                        return { x: child.x, y: child.y };
                    }
                    else {
                        const result = calkOffset(name, child);
                        if (result && child.x && child.y)
                            return { x: child.x + result.x, y: child.y + result.y }
                    }
                }

            return null;
        }

        for (const edge of layoutedGraph.edges ?? []) {
            if (!edge.sections) continue;
            const locOffset = calkOffset(edge.container ?? "") ?? { x: 0, y: 0 };

            for (const section of edge.sections) {
                section.startPoint.x = section.startPoint.x + locOffset.x;
                section.startPoint.y = section.startPoint.y + locOffset.y;

                section.endPoint.x = section.endPoint.x + locOffset.x;
                section.endPoint.y = section.endPoint.y + locOffset.y;

                if (section.bendPoints && section.bendPoints.length > 0) {
                    for (const bp of section.bendPoints) {
                        bp.x += locOffset.x;
                        bp.y += locOffset.y;
                    }
                }
            }
        }

        const expanded = expandPatternMacros(
            positioned,
            layoutedGraph?.edges || [],
            patternMacros,
        );

        let finalAdded = [...(addedSymbol ?? []), ...expanded.addedSymbols];
        let renderGraph = createSchematicScene(expanded.positioned, expanded.edges, nodes, finalAdded,
            patternMacros, layoutedGraph.width, layoutedGraph.height);
        const refinement = options?.layoutRefinement
            ? refineSchematicScene(renderGraph, sch.components, finalAdded, nodes, patternMacros) : undefined;
        if (refinement) {
            renderGraph = refinement.scene;
            const geometry = new Map(renderGraph.children!.map(n => [n.id, n]));
            expanded.positioned = expanded.positioned.filter(p => !refinement.removedSymbolIds.has(p.designator)).map(p => {
                const n = geometry.get(p.designator)!;
                return { ...p, x: n.x!, y: n.y!, width: n.width!, height: n.height!, ...refinement.rotations.get(p.designator) };
            });
            expanded.edges = renderGraph.edges!;
            for (const c of refinement.addedSymbols) {
                const n = geometry.get(c.designator)!;
                expanded.positioned.push({ designator: c.designator, x: n.x!, y: n.y!, width: n.width!, height: n.height!,
                    rotate: 0, center: { x: n.width! / 2, y: n.height! / 2 }, ...refinement.rotations.get(c.designator) });
            }
            finalAdded = [...finalAdded.filter(c => !refinement.removedSymbolIds.has(c.designator)), ...refinement.addedSymbols];
        }

        return {
            improvementsHistory,
            addedSymbol: finalAdded,
            positioned: expanded.positioned,
            edges: expanded.edges,
            width: renderGraph.width || 2048,
            height: renderGraph.height || 2048,
            layoutedGraph,
            renderGraph,
            refinement: refinement?.stats,
            clientManagedLabels,
        };
    } catch (err) {
        logger.error(err, 'ELK layout failed');
        throw err;
    }
}

export async function makeAutoPlacement(circuit: Circuit, previewImg?: string, hooks?: Hooks, options?: {
    splitMultiPartComponent?: boolean;
    externalSignals?: string[];
    layoutMode?: 'legacy' | 'quality';
    layoutPatterns?: boolean;
    layoutRefinement?: boolean;
    onLayoutDiagnostics?: (diagnostics: LayoutDiagnostics) => void;
}): Promise<CircuitAssembly> {

    // need-test проверять только целевые
    // const nullComponents = circuit.components.filter(c => !c.part_uuid);
    // if (nullComponents.length > 0)
    //     throw new Error(`Not found component: ${JSON.stringify(nullComponents.map(c => c.designator))}`)

    if (options?.splitMultiPartComponent)
        circuit = await splitMultiPartComponent(circuit);

    const { nodes, subParts } = await circuitToSymbols(circuit);

    // console.log(nodes.map(n => n.symbol.pins))

    const result = await autoPlaceCircuitWithHierarchy(circuit, nodes, hooks, {
        externalSignals: options?.externalSignals,
        layoutMode: options?.layoutMode,
        layoutPatterns: options?.layoutPatterns,
        layoutRefinement: options?.layoutRefinement,
        onLayoutDiagnostics: options?.onLayoutDiagnostics,
    });
    const { addedSymbol, layoutedGraph, improvementsHistory } = result;
    let { positioned, edges } = result;

    const { positioned: updatePosition, edges: updateEdges } = hooks?.autoPlaceFinish?.(positioned, edges) ?? {};

    if (updatePosition) positioned = updatePosition
    if (updateEdges) edges = updateEdges

    // logger.debug(improvementsHistory, "Improvements history")

    // MCP assembles the schematic in the editor; server-only PNG rendering is omitted.

    const components = [...circuit.components, ...addedSymbol].map(component => {
        const pos = positioned.find(p => p.designator === component.designator) as PositionedSchNode;
        return { ...component, pos, sub_part_name: subParts[component.designator] || undefined };
    });

    const createBlocksRect = (root: ElkNode, blocks: CircuitAssembly['blocks_rect'] = [], offset: { x: number, y: number }): CircuitAssembly['blocks_rect'] => {
        if (root.id.startsWith('block_')) {
            if (typeof root.x !== 'number' || typeof root.y !== 'number') {
                logger.error('root.x !== number || root.y !== number');
                return [];
            }

            if (typeof root.width !== 'number' || typeof root.height !== 'number') {
                logger.error('root.height !== number || root.width !== number');
                return [];
            }

            if (root.width > 10 && root.height > 10)
                if (!root.id.startsWith('block_parl') && !root.id.startsWith('block_other'))
                    blocks.push({
                        name: root.id,
                        description: circuit.blocks.find(block => root.id.includes(block.name))?.description ?? "",
                        x: root.x + offset.x,
                        y: root.y + offset.y,
                        width: root.width,
                        height: root.height,
                    });

            offset.x = root.x + offset.x;
            offset.y = root.y + offset.y;
        }

        if (root.children)
            for (const child of root.children) {
                blocks = createBlocksRect(child, blocks, structuredClone(offset));
            }

        return blocks;
    }

    return {
        ...circuit,
        reused_blocks: undefined,
        components,
        edges: edges as never,
        blocks_rect: options?.layoutRefinement ? refinedBlockBounds(circuit, addedSymbol, positioned, edges)
            : layoutedGraph ? createBlocksRect(layoutedGraph, [], { x: 0, y: 0 }) : []
    };
}

export function refinedBlockBounds(circuit: Circuit, added: CircuitComponent[], positioned: PositionedSchNode[], edges: ElkExtendedEdge[]) {
    const padding = SCHEMATIC_SHEET.blockPadding;
    const scopes = resolveSceneBlocks(circuit.components, added, edges);
    const owners = new Map<string, string>([...circuit.components, ...added].flatMap(c => c.pins.map(p => [`${c.designator}_pin_${p.pin_number}`, c.designator] as const)));
    const blocks = circuit.blocks.flatMap(block => {
        const nodes = positioned.filter(p => scopes.get(p.designator) === block.name);
        if (!nodes.length) return [];
        const ids = new Set(nodes.map(n => n.designator));
        const points = edges.filter(e => [...e.sources, ...e.targets].every(p => ids.has(owners.get(p)!)))
            .flatMap(e => (e.sections ?? []).flatMap(s => [s.startPoint, ...(s.bendPoints ?? []), s.endPoint]));
        const x = Math.min(...nodes.map(n => n.x), ...points.map(p => p.x)) - padding, y = Math.min(...nodes.map(n => n.y), ...points.map(p => p.y)) - padding;
        return [{ name: `block_${block.name}`, description: block.description, x, y,
            width: Math.max(...nodes.map(n => n.x + n.width), ...points.map(p => p.x)) + padding - x,
            height: Math.max(...nodes.map(n => n.y + n.height), ...points.map(p => p.y)) + padding - y }];
    });
    return recalculateRootBlock(blocks, positioned.map(pos => ({ pos })), edges);
}

// Example usage
// const circuit = await readFile('.test-output/c_v4.json', 'utf-8').then(JSON.parse) as Circuit;
// const result = await makeAutoPlacement(circuit, ".test-output/сircuit.png", undefined, { splitMultiPartComponent: true });
// writeFile('.test-output/place_circuit.json', JSON.stringify(result, null, 2));
