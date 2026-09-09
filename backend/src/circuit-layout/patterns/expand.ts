import type { ElkEdgeSection, ElkExtendedEdge } from 'elkjs';
import type { PositionedSchNode } from '#types/auto-place.ts';
import type { MacroInstance, MacroRoutedPath, PatternExpansionResult } from './types.ts';

type Point = { x: number; y: number };

function simplifyOrthogonalPoints(points: Point[]) {
    const unique = points.filter((point, index) => index === 0
        || point.x !== points[index - 1].x
        || point.y !== points[index - 1].y);
    const result: Point[] = [];
    for (const point of unique) {
        const previous = result.at(-1);
        const beforePrevious = result.at(-2);
        if (previous && beforePrevious
            && ((beforePrevious.x === previous.x && previous.x === point.x)
                || (beforePrevious.y === previous.y && previous.y === point.y))) {
            result[result.length - 1] = point;
        } else result.push(point);
    }
    return result;
}

function sectionPoints(section: ElkEdgeSection) {
    return [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
}

function applyPoints(section: ElkEdgeSection, points: Point[]) {
    const simplified = simplifyOrthogonalPoints(points);
    section.startPoint = structuredClone(simplified[0]);
    section.endPoint = structuredClone(simplified.at(-1)!);
    section.bendPoints = simplified.length > 2
        ? simplified.slice(1, -1).map(point => structuredClone(point))
        : undefined;
}

function absolutePath(path: MacroRoutedPath, macroPosition: PositionedSchNode) {
    return path.points.map(point => ({
        x: point.x + macroPosition.x,
        y: point.y + macroPosition.y,
    }));
}

function replaceRef(ref: string, from: string, to: string) {
    return ref === from ? to : ref;
}

function stitchMacroPort(
    edge: ElkExtendedEdge,
    macroPortId: string,
    primaryPinId: string,
    tail: Point[],
) {
    const sourceHasPort = edge.sources.includes(macroPortId);
    const targetHasPort = edge.targets.includes(macroPortId);
    edge.sources = edge.sources.map(ref => replaceRef(ref, macroPortId, primaryPinId));
    edge.targets = edge.targets.map(ref => replaceRef(ref, macroPortId, primaryPinId));

    for (const section of edge.sections ?? []) {
        if (section.incomingShape === macroPortId) {
            applyPoints(section, [...tail].reverse().concat(sectionPoints(section).slice(1)));
            section.incomingShape = primaryPinId;
            continue;
        }
        if (section.outgoingShape === macroPortId) {
            applyPoints(section, sectionPoints(section).concat(tail.slice(1)));
            section.outgoingShape = primaryPinId;
            continue;
        }
    }

    if (!(edge.sections ?? []).some(section =>
        section.incomingShape === primaryPinId || section.outgoingShape === primaryPinId)) {
        const section = edge.sections?.[0];
        if (section && sourceHasPort) {
            applyPoints(section, [...tail].reverse().concat(sectionPoints(section).slice(1)));
            section.incomingShape = primaryPinId;
        } else if (section && targetHasPort) {
            applyPoints(section, sectionPoints(section).concat(tail.slice(1)));
            section.outgoingShape = primaryPinId;
        }
    }
}

function internalEdge(path: MacroRoutedPath, macro: MacroInstance, macroPosition: PositionedSchNode): ElkExtendedEdge {
    const points = absolutePath(path, macroPosition);
    return {
        id: path.id,
        sources: [path.sourcePinId],
        targets: [path.targetPinId],
        container: `block_${macro.layoutChildBlock?.name ?? macro.blockName}`,
        sections: [{
            id: `${path.id}_s0`,
            startPoint: points[0],
            endPoint: points.at(-1)!,
            bendPoints: points.length > 2 ? points.slice(1, -1) : undefined,
            incomingShape: path.sourcePinId,
            outgoingShape: path.targetPinId,
        }],
    };
}

export function expandPatternMacros(
    positionedInput: PositionedSchNode[],
    edgesInput: ElkExtendedEdge[],
    macros: MacroInstance[],
): PatternExpansionResult {
    const macroIds = new Set(macros.map(macro => macro.id));
    const positioned = positionedInput.filter(node => !macroIds.has(node.designator));
    const edges = structuredClone(edgesInput);
    const addedSymbols = macros.flatMap(macro => macro.placements
        .flatMap(placement => placement.generatedComponent ? [structuredClone(placement.generatedComponent)] : []));

    for (const macro of macros) {
        const macroPosition = positionedInput.find(node => node.designator === macro.id);
        if (!macroPosition) throw new Error(`Pattern macro ${macro.id} was not positioned by ELK`);

        positioned.push(...macro.placements.map(placement => ({
            designator: placement.designator,
            x: macroPosition.x + placement.x,
            y: macroPosition.y + placement.y,
            rotate: placement.rotate,
            center: structuredClone(placement.center),
            width: placement.width,
            height: placement.height,
        })));

        for (const path of macro.routedPaths) {
            if (path.kind === 'internal') edges.push(internalEdge(path, macro, macroPosition));
        }

        for (const port of macro.ports) {
            const tailPath = macro.routedPaths.find(path =>
                path.kind === 'port-tail' && path.macroPortId === port.elkPortId);
            if (!tailPath) continue;
            const tail = absolutePath(tailPath, macroPosition);
            for (const edge of edges) {
                const referencesPort = edge.sources.includes(port.elkPortId)
                    || edge.targets.includes(port.elkPortId)
                    || (edge.sections ?? []).some(section =>
                        section.incomingShape === port.elkPortId
                        || section.outgoingShape === port.elkPortId);
                if (referencesPort) stitchMacroPort(edge, port.elkPortId, port.primaryPinId, tail);
            }
        }
    }

    const macroReferences = new Set(macros.flatMap(macro => [
        macro.id,
        ...macro.ports.map(port => port.elkPortId),
    ]));
    for (const edge of edges) {
        const refs = [
            ...edge.sources,
            ...edge.targets,
            ...(edge.sections ?? []).flatMap(section => [section.incomingShape, section.outgoingShape]),
        ].filter((ref): ref is string => typeof ref === 'string');
        if (refs.some(ref => macroReferences.has(ref))) {
            throw new Error(`Pattern macro reference leaked into expanded edge ${edge.id}`);
        }
    }

    return { positioned, edges, addedSymbols };
}
