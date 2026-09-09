import type { Box, PcbComponent, Placement, PlacementInput } from '#types/pcb/layout-model.ts';
import { isConnectedSignalName } from '#utils/signals.ts';
import { boardBox, getBox, getPadWorld } from '../../pcb-auto-place/geometry.ts';
import { expandHints } from '../../pcb-auto-place/hints.ts';
import {
    resolveTargetBox,
    resolveTargetPoint,
} from '../../pcb-auto-place/report-helpers.ts';
import {
    NATIVE_POST_PLACE_SCORE_CONTRACT_VERSION,
    type NativePathPort,
    type NativePostPlaceScoreProblemV1,
} from './contract.ts';

const EPSILON = 0.001;

export function encodeNativePostPlaceScoreProblem(
    input: PlacementInput,
    placements: Placement[],
): NativePostPlaceScoreProblemV1 {
    const placementByDesignator = new Map(placements.map((placement) => [placement.designator, placement]));
    const componentByDesignator = new Map(input.components.map((component) => [component.designator, component]));
    const ignored = new Set(input.solverOptions.ignoredRatsnestSignals.map((signal) => signal.toUpperCase()));
    const pointsByNet = new Map<string, Array<{ x: number; y: number }>>();
    for (const component of input.components) {
        const placement = placementByDesignator.get(component.designator);
        if (!placement) continue;
        for (const pin of component.pins) {
            if (!isConnectedSignalName(pin.signal_name) || ignored.has(pin.signal_name.toUpperCase())) continue;
            const point = getPadWorld(component, placement, pin.pin_number);
            if (!point) continue;
            const points = pointsByNet.get(pin.signal_name) ?? [];
            points.push(point);
            pointsByNet.set(pin.signal_name, points);
        }
    }

    const result: NativePostPlaceScoreProblemV1 = {
        version: NATIVE_POST_PLACE_SCORE_CONTRACT_VERSION,
        nets: [...pointsByNet.entries()].map(([name, points]) => ({ name, points, weight: netSignalWeight(name) })),
        distances: [],
        clearances: [],
        fixedPenalties: [],
        edges: [],
        paths: [],
    };

    for (const rule of expandHints(input)) {
        const weight = Math.max(1, rule.weight);
        if (rule.kind === 'distance' && rule.target && rule.target !== 'all') {
            const source = resolveTargetPoint(input, rule.source, placementByDesignator, componentByDesignator);
            const target = resolveTargetPoint(input, rule.target, placementByDesignator, componentByDesignator);
            if (source && target) result.distances.push({ source, target, weight, min: rule.min, max: rule.max });
        }
        if (rule.kind === 'clearance' && rule.target && rule.min !== undefined) {
            const source = resolveTargetBox(input, rule.source, placementByDesignator, componentByDesignator);
            if (!source) continue;
            if (rule.target === 'all') {
                for (const component of input.components) {
                    if (targetContainsDesignator(rule.source, component.designator)) continue;
                    const placement = placementByDesignator.get(component.designator);
                    if (placement) result.clearances.push({ source, target: getBox(component, placement), minimum: rule.min, weight });
                }
            } else {
                const target = resolveTargetBox(input, rule.target, placementByDesignator, componentByDesignator);
                if (target) result.clearances.push({ source, target, minimum: rule.min, weight });
            }
        }
        if (rule.kind === 'same_side' && rule.target && rule.target !== 'all'
            && rule.source.type === 'component' && rule.target.type === 'component') {
            const source = placementByDesignator.get(rule.source.designator);
            const target = placementByDesignator.get(rule.target.designator);
            if (source && target && source.layer !== target.layer) result.fixedPenalties.push(weight * 20);
        }
        if (rule.kind === 'prefer_layer' && rule.source.type === 'component' && rule.layer) {
            const placement = placementByDesignator.get(rule.source.designator);
            if (placement && placement.layer !== rule.layer) result.fixedPenalties.push(weight * 10);
        }
        if (rule.kind === 'edge' && rule.edge) {
            const source = resolveTargetBox(input, rule.source, placementByDesignator, componentByDesignator);
            if (source) result.edges.push({ source, board: boardBox(input.board), edge: rule.edge, weight });
        }
    }

    for (const path of input.paths ?? []) {
        const ports: NativePathPort[] = [];
        for (const segment of path.segments) {
            const source = pathPort(componentByDesignator, placementByDesignator, path.id, segment.index * 2, segment.source, segment.index === 0 ? 'source' : 'exit');
            const target = pathPort(componentByDesignator, placementByDesignator, path.id, segment.index * 2 + 1, segment.target, segment.index === path.segments.length - 1 ? 'target' : 'entry');
            if (source) ports.push(source);
            if (target) ports.push(target);
        }
        result.paths.push({
            pathId: path.id,
            ports,
            shape: path.shape,
            priority: path.priority,
            weight: 1,
            preferFacingPads: path.preferFacingPads,
        });
    }
    return result;
}

function pathPort(
    components: Map<string, PcbComponent>,
    placements: Map<string, Placement>,
    pathId: string,
    order: number,
    target: { designator: string; pin_number: string | number },
    role: NativePathPort['role'],
): NativePathPort | null {
    const component = components.get(target.designator);
    const placement = placements.get(target.designator);
    if (!component || !placement) return null;
    const point = getPadWorld(component, placement, target.pin_number);
    if (!point) return null;
    const vector = { x: point.x - placement.x, y: point.y - placement.y };
    const length = Math.hypot(vector.x, vector.y);
    return {
        ...point,
        pathId,
        order,
        ref: `${target.designator}.${String(target.pin_number)}`,
        role,
        normal: length > EPSILON ? { x: vector.x / length, y: vector.y / length } : { x: 0, y: 0 },
    };
}

function netSignalWeight(net: string) {
    return /^(?:VBUS|VCC|VDD|VIN|BAT|AVDD|DVDD|IOVDD|ADC_AVDD|VREG|[+]\w+)/i.test(net) ? 0.25 : 1;
}

function targetContainsDesignator(target: { type: string; designator?: string }, designator: string) {
    return (target.type === 'component' || target.type === 'pin') && target.designator === designator;
}
