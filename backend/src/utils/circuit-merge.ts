import type { CircuitAssembly } from "#types/circuit.ts";
import type { ElkExtendedEdge } from 'elkjs';
import { packSchematicRectangles, SCHEMATIC_SHEET, type PackingNet } from './schematic-packing.ts';
import { shortSymbolsMap } from '#circuit-layout/short-symbol.ts';
import { hasConnection } from '#circuit-layout/signals.ts';

/**
 * Parses a designator string into prefix and number.
 * e.g. "R12.1" -> { prefix: "R", number: 12 }
 */
export function parseDesignator(des: string): { prefix: string; number: number } {
    const match = des.match(/^([A-Za-z]+)(\d+)(?:\.\d+)?$/);
    if (!match) return { prefix: des, number: 0 };
    return {
        prefix: match[1],
        number: parseInt(match[2], 10)
    };
}

/**
 * Builds per-circuit rename maps to resolve designator conflicts
 * when merging multiple assemblies into a main one.
 */
export function buildDesignatorMaps(mainCircuit: CircuitAssembly, otherCircuits: CircuitAssembly[]): Map<string, string>[] {
    const maxByPrefix = new Map<string, number>();
    const takenDesignators = new Set<string>();

    for (const comp of mainCircuit.components) {
        takenDesignators.add(comp.designator);
        const { prefix, number } = parseDesignator(comp.designator);
        const current = maxByPrefix.get(prefix) ?? 0;
        if (number > current) maxByPrefix.set(prefix, number);
    }

    const renameMaps: Map<string, string>[] = [];

    for (const circuit of otherCircuits) {
        const localRenameMap = new Map<string, string>();

        for (const comp of circuit.components) {
            const { prefix, number: _num } = parseDesignator(comp.designator);

            if (takenDesignators.has(comp.designator) || localRenameMap.has(comp.designator)) {
                const currentMax = maxByPrefix.get(prefix) ?? 0;
                const newNumber = currentMax + 1;
                const newDesignator = `${prefix}${newNumber}`;
                maxByPrefix.set(prefix, newNumber);
                localRenameMap.set(comp.designator, newDesignator);
                takenDesignators.add(newDesignator);
            } else {
                const currentMax = maxByPrefix.get(prefix) ?? 0;
                if (_num > currentMax) maxByPrefix.set(prefix, _num);
                takenDesignators.add(comp.designator);
            }
        }

        renameMaps.push(localRenameMap);
    }

    return renameMaps;
}

/**
 * Replaces designator in a pin reference string like "U1_pin_3".
 */
export function replaceDesignatorInPinRef(pinRef: string, renameMap: Map<string, string>): string {
    if (!renameMap.size) return pinRef;

    const pinIndex = pinRef.indexOf('_pin_');
    if (pinIndex === -1) return renameMap.get(pinRef) ?? pinRef;

    const designator = pinRef.substring(0, pinIndex);
    const rest = pinRef.substring(pinIndex);

    const newDesignator = renameMap.get(designator);
    return newDesignator ? newDesignator + rest : pinRef;
}

/**
 * Replaces designators in edges using a rename map.
 */
export function replaceDesignatorInEdges(edges: CircuitAssembly['edges'], renameMap: Map<string, string>): CircuitAssembly['edges'] {
    if (!renameMap.size) return edges;

    return edges.map(edge => ({
        ...edge,
        sources: edge.sources.map(s => replaceDesignatorInPinRef(s, renameMap)),
        targets: edge.targets.map(t => replaceDesignatorInPinRef(t, renameMap)),
        sections: edge.sections.map(sec => ({
            ...sec,
            incomingShape: sec.incomingShape ? replaceDesignatorInPinRef(sec.incomingShape, renameMap) : sec.incomingShape,
            outgoingShape: sec.outgoingShape ? replaceDesignatorInPinRef(sec.outgoingShape, renameMap) : sec.outgoingShape,
        })),
    }));
}

/**
 * Replaces designators in net arrays using a rename map.
 */
export function replaceDesignatorInNets(nets: CircuitAssembly['added_net'], renameMap: Map<string, string>): CircuitAssembly['added_net'] {
    if (!nets || !renameMap.size) return nets;
    return nets.map(n => ({
        ...n,
        designator: renameMap.get(n.designator) ?? n.designator,
    }));
}

const OFFSET_GAP = 80 + SCHEMATIC_SHEET.extraBlockGap;

/**
 * Gets the bounding box of a circuit assembly.
 */
export function getBoundingBox(circuit: CircuitAssembly): { maxX: number; maxY: number } {
    let maxX = 0;
    let maxY = 0;

    for (const comp of circuit.components) {
        const right = (comp.pos?.x ?? 0) + (comp.pos?.width ?? 0);
        const bottom = (comp.pos?.y ?? 0) + (comp.pos?.height ?? 0);
        if (right > maxX) maxX = right;
        if (bottom > maxY) maxY = bottom;
    }

    for (const br of (circuit.blocks_rect ?? [])) {
        const right = br.x + br.width;
        const bottom = br.y + br.height;
        if (right > maxX) maxX = right;
        if (bottom > maxY) maxY = bottom;
    }

    return { maxX, maxY };
}

/** Reused assemblies use the same landscape packing policy as drawing islands.
 * Preserve the main assembly's coordinates; translate each other drawing rigidly. */
function buildBalancedLayout(circuits: CircuitAssembly[]) {
    const boxes = circuits.map((c, i) => ({
        ...(recalculateRootBlock(c.blocks_rect ?? [], c.components, c.edges).find(b => b.name.includes('__v_root__'))
            ?? { x: 0, y: 0, width: 0, height: 0 }), id: String(i),
    }));
    const byNet = new Map<string, PackingNet>();
    for (const [index, c] of circuits.entries()) {
        const box = boxes[index], positions = new Map<string, { x: number; y: number }>();
        for (const edge of c.edges) for (const section of edge.sections) {
            if (section.incomingShape ?? edge.sources[0]) positions.set(section.incomingShape ?? edge.sources[0], section.startPoint);
            if (section.outgoingShape ?? edge.targets[0]) positions.set(section.outgoingShape ?? edge.targets[0], section.endPoint);
        }
        for (const part of c.components) for (const pin of part.pins) {
            if (!part.pos || !hasConnection(pin.signal_name) || shortSymbolsMap.GND.is(pin.signal_name)) continue;
            const net = byNet.get(pin.signal_name) ?? { weight: shortSymbolsMap.VCC.is(pin.signal_name) ? 0.5 : 1, terminals: [] };
            let terminal = net.terminals.find(t => t.id === box.id);
            if (!terminal) { terminal = { id: box.id, points: [], anchor: false }; net.terminals.push(terminal); }
            // Routed pins have exact coordinates. An unwired client label has
            // only its owning symbol's position available in serialized ASM.
            const p = positions.get(`${part.designator}_pin_${pin.pin_number}`)
                ?? { x: part.pos.x + part.pos.width / 2, y: part.pos.y + part.pos.height / 2 };
            terminal.points.push({ x: p.x - box.x, y: p.y - box.y });
            terminal.anchor ||= /^U/i.test(part.designator) || part.pins.length > 2;
            byNet.set(pin.signal_name, net);
        }
    }
    const { positions } = packSchematicRectangles(boxes, OFFSET_GAP, [...byNet.values()].filter(n => n.terminals.length > 1), 0);
    const main = positions.get('0')!;
    return boxes.slice(1).map(box => ({ dx: positions.get(box.id)!.x - main.x + boxes[0].x - box.x,
        dy: positions.get(box.id)!.y - main.y + boxes[0].y - box.y }));
}

function offsetPoint(p: { x: number; y: number }, dx: number, dy: number) {
    return { x: p.x + dx, y: p.y + dy };
}

/**
 * Offsets all component positions by dx, dy.
 */
export function offsetComponents(components: CircuitAssembly['components'], dx: number, dy: number): CircuitAssembly['components'] {
    return components.map(comp => ({
        ...comp,
        pos: {
            ...comp.pos,
            x: comp.pos.x + dx,
            y: comp.pos.y + dy,
            center: comp.pos.center,
        },
    }));
}

/**
 * Offsets all edge points by dx, dy.
 */
export function offsetEdges(edges: CircuitAssembly['edges'], dx: number, dy: number): CircuitAssembly['edges'] {
    const applyForPoint = (p: { x: number; y: number }) => offsetPoint(p, dx, dy);

    return edges.map(edge => ({
        ...edge,
        sections: edge.sections.map(sec => ({
            ...sec,
            startPoint: applyForPoint(sec.startPoint),
            endPoint: applyForPoint(sec.endPoint),
            bendPoints: sec.bendPoints?.map(applyForPoint),
        })),
    }));
}

const ROOT_BLOCK_PADDING = SCHEMATIC_SHEET.rootPadding;

/**
 * Recalculates the root from final geometry, including wire excursions.
 * The previous root is excluded so repeated recalculation can also shrink it.
 */
export function recalculateRootBlock(
    blocksRect: NonNullable<CircuitAssembly['blocks_rect']>,
    components: readonly Pick<CircuitAssembly['components'][number], 'pos'>[],
    edges: readonly Pick<ElkExtendedEdge, 'sections'>[] = [],
): NonNullable<CircuitAssembly['blocks_rect']> {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const comp of components) {
        if (!comp.pos) continue;
        const left = comp.pos.x;
        const top = comp.pos.y;
        const right = left + comp.pos.width;
        const bottom = top + comp.pos.height;
        if (left < minX) minX = left;
        if (top < minY) minY = top;
        if (right > maxX) maxX = right;
        if (bottom > maxY) maxY = bottom;
    }

    for (const br of blocksRect) {
        if (br.name.includes('__v_root__')) continue;
        const right = br.x + br.width;
        const bottom = br.y + br.height;
        if (br.x < minX) minX = br.x;
        if (br.y < minY) minY = br.y;
        if (right > maxX) maxX = right;
        if (bottom > maxY) maxY = bottom;
    }

    for (const edge of edges) for (const section of edge.sections ?? []) {
        for (const point of [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]) {
            minX = Math.min(minX, point.x); minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y);
        }
    }

    if (minX === Infinity) return blocksRect;

    const rootRect = blocksRect.find(br => br.name.includes('__v_root__'));
    const newRootRect = {
        name: rootRect?.name ?? '__v_root__',
        description: rootRect?.description ?? '',
        x: minX - ROOT_BLOCK_PADDING,
        y: minY - ROOT_BLOCK_PADDING,
        width: maxX - minX + ROOT_BLOCK_PADDING * 2,
        height: maxY - minY + ROOT_BLOCK_PADDING * 2,
    };

    if (rootRect) {
        return blocksRect.map(br => br.name.includes('__v_root__') ? newRootRect : br);
    }

    return [...blocksRect, newRootRect];
}

/**
 * Merges multiple circuit assemblies into a main one,
 * resolving designator conflicts and offsetting positions.
 */
export function mergeAmsCircuit(mainCircuit: CircuitAssembly, otherCircuit: CircuitAssembly[]): CircuitAssembly {
    if (!otherCircuit.length) return mainCircuit;

    const renameMaps = buildDesignatorMaps(mainCircuit, otherCircuit);

    const allComponents = [...mainCircuit.components];
    const allEdges = [...mainCircuit.edges];
    const mainBlockNames = new Set(mainCircuit.blocks.map(b => b.name));
    const allBlocks = [...mainCircuit.blocks];
    const allReusedBlocks = [...(mainCircuit.reused_blocks ?? [])];
    const allBlocksRect = [...(mainCircuit.blocks_rect ?? [])];
    const mainRectNames = new Set((mainCircuit.blocks_rect ?? []).map(b => b.name));
    const allAddedNet = [...(mainCircuit.added_net ?? [])];
    const allRmNet = [...(mainCircuit.rm_net ?? [])];
    const allRmComponents = [...(mainCircuit.rm_components ?? [])];
    const allReplaceComponents = [...(mainCircuit.replace_components ?? [])];
    const placements = buildBalancedLayout([mainCircuit, ...otherCircuit]);

    for (let i = 0; i < otherCircuit.length; i++) {
        const circuit = otherCircuit[i];
        const renameMap = renameMaps[i];
        const { dx, dy } = placements[i];

        // Components: rename + offset
        const renamedComponents = circuit.components.map(comp => ({
            ...comp,
            designator: renameMap.get(comp.designator) ?? comp.designator,
        }));
        allComponents.push(...offsetComponents(renamedComponents, dx, dy));

        // Edges: rename + offset
        const renamedEdges = replaceDesignatorInEdges(circuit.edges, renameMap);
        allEdges.push(...offsetEdges(renamedEdges, dx, dy));

        // Blocks: deduplicate by name
        for (const block of circuit.blocks) {
            if (!mainBlockNames.has(block.name)) {
                allBlocks.push(block);
                mainBlockNames.add(block.name);
            }
        }

        // Blocks_rect: deduplicate by name + offset
        for (const br of (circuit.blocks_rect ?? [])) {
            if (!mainRectNames.has(br.name)) {
                allBlocksRect.push({ ...br, x: br.x + dx, y: br.y + dy });
                mainRectNames.add(br.name);
            }
        }

        // Nets: rename only (no offset needed for net references)
        allAddedNet.push(...replaceDesignatorInNets(circuit.added_net ?? [], renameMap)!);
        allRmNet.push(...replaceDesignatorInNets(circuit.rm_net ?? [], renameMap)!);

        allReusedBlocks.push(...(circuit.reused_blocks ?? []));

        // rm/replace components: rename
        if (circuit.rm_components) {
            allRmComponents.push(...circuit.rm_components.map(d => renameMap.get(d) ?? d));
        }
        if (circuit.replace_components) {
            allReplaceComponents.push(...circuit.replace_components.map(d => renameMap.get(d) ?? d));
        }
    }

    const finalBlocksRect = recalculateRootBlock(allBlocksRect, allComponents, allEdges);

    return {
        metadata: mainCircuit.metadata,
        components: allComponents,
        edges: allEdges,
        blocks: allBlocks,
        blocks_rect: finalBlocksRect,
        assembly_options: mainCircuit.assembly_options,
        added_net: allAddedNet.length ? allAddedNet : undefined,
        rm_net: allRmNet.length ? allRmNet : undefined,
        rm_components: allRmComponents.length ? allRmComponents : undefined,
        replace_components: allReplaceComponents.length ? allReplaceComponents : undefined,
        reused_blocks:allReusedBlocks
    };
}
