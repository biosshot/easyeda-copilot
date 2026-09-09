import type { Box, PcbComponent, Placement, PlacementTreeNode } from '#types/pcb/layout-model.ts';
import {
    componentBox,
    getLocalPointOffset,
    roundPlacement,
    unionBoxes,
} from '../pcb-auto-place/geometry.ts';
import type { ClearanceResolver } from '../pcb-auto-place/clearance-resolver.ts';
import type { PlacementConnectionPoint, PlacementPrimitive } from './primitives.ts';

export interface PassiveNetIslandOptions {
    grid: number;
    clearance: number;
    clearanceResolver?: ClearanceResolver;
}

const PASSIVE_ROLES = new Set(['passive', 'decoupling_cap', 'indicator']);
const IGNORED_MAIN_NETS = new Set(['GND', 'GNDA', 'PGND', 'AGND', 'DGND']);
type CandidatePlacement = Placement & { component: PcbComponent; box: Box };

export function canSolvePassiveNetIsland(components: PcbComponent[]) {
    if (components.length < 2 || components.length > 12) return false;
    if (!components.every((component) => PASSIVE_ROLES.has(component.pcb.role))) return false;
    return Boolean(selectPassiveNetMainNet(components));
}

/** Builds the shared PlacementPrimitive shape from placements solved by Rust. */
export function createPassiveNetIslandPrimitive(
    node: PlacementTreeNode,
    components: PcbComponent[],
    mainNet: string,
    placements: Placement[],
): PlacementPrimitive {
    const componentByDesignator = new Map(components.map((component) => [component.designator, component]));
    const positioned = placements.map((placement) => {
        const component = componentByDesignator.get(placement.designator);
        if (!component) throw new Error(`Missing passive island component ${placement.designator}`);
        return candidatePlacement(component, placement.x, placement.y, placement.rotate);
    });
    const collisionBoxes = positioned.map((placement) => placement.box);
    const bbox = unionBoxes(collisionBoxes);
    return {
        id: `primitive:${node.id}:passive-net:${mainNet}`,
        kind: 'island',
        label: `passive_net:${mainNet}`,
        sourceNodeId: `${node.id}:passive-net:${mainNet}`,
        canRotate: true,
        bbox,
        collisionBoxes,
        width: roundPlacement(bbox.right - bbox.left),
        height: roundPlacement(bbox.bottom - bbox.top),
        placements: positioned.map(({ designator, x, y, rotate, layer, score }) => ({ designator, x, y, rotate, layer, score })),
        connectionPoints: connectionPointsForPlacements(components, positioned),
        children: [],
    };
}

function candidatePlacement(component: PcbComponent, x: number, y: number, rotate: number): CandidatePlacement {
    const layer = component.pcb.allowedLayers[0] ?? 'top';
    const placement: Placement = { designator: component.designator, x, y, rotate, layer, score: 0 };
    return { ...placement, component, box: componentBox(component, placement) };
}

export function selectPassiveNetMainNet(components: PcbComponent[]) {
    const counts = new Map<string, number>();
    for (const component of components) {
        for (const pin of component.pins) {
            const net = pin.signal_name;
            if (!net || IGNORED_MAIN_NETS.has(net.toUpperCase())) continue;
            counts.set(net, (counts.get(net) ?? 0) + 1);
        }
    }
    return [...counts.entries()]
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}

function connectionPointsForPlacements(
    components: PcbComponent[],
    placements: Placement[],
): PlacementConnectionPoint[] {
    const componentByDesignator = new Map(components.map((component) => [component.designator, component]));
    const result: PlacementConnectionPoint[] = [];
    for (const placement of placements) {
        const component = componentByDesignator.get(placement.designator);
        if (!component) continue;
        const padByPin = new Map(component.footprint.pads.map((pad) => [String(pad.pin_number), pad]));
        for (const pin of component.pins) {
            const pad = padByPin.get(String(pin.pin_number));
            if (!pad) continue;
            const offset = getLocalPointOffset(pad, placement.rotate, placement.layer);
            result.push({
                ref: `${component.designator}.${String(pin.pin_number)}`,
                net: pin.signal_name,
                x: roundPlacement(placement.x + offset.x),
                y: roundPlacement(placement.y + offset.y),
            });
        }
    }
    return result;
}
