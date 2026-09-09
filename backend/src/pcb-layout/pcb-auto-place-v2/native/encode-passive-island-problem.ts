import type { PcbComponent, PlacementTreeNode } from '#types/pcb/layout-model.ts';
import { isGroundSignalName } from '#utils/signals.ts';
import {
    componentBox,
    componentCollisionBoxes,
    getLocalPointOffset,
} from '../../pcb-auto-place/geometry.ts';
import { placementsCanConflict } from '../../pcb-auto-place/utils.ts';
import type { PassiveNetIslandOptions } from '../passive-net-island.ts';
import {
    NATIVE_PASSIVE_ISLAND_CONTRACT_VERSION,
    type NativePassiveIslandProblemV1,
} from './contract.ts';

export interface PassiveNetIslandSolveParams {
    node: PlacementTreeNode;
    components: PcbComponent[];
    options: PassiveNetIslandOptions;
    mainNet: string;
}

export function encodeNativePassiveIslandProblem(params: PassiveNetIslandSolveParams): NativePassiveIslandProblemV1 {
    const netIds = new Map<string, number>();
    const netNames: string[] = [];
    for (const component of params.components) {
        for (const pin of component.pins) {
            if (!pin.signal_name || netIds.has(pin.signal_name)) continue;
            netIds.set(pin.signal_name, netIds.size);
            netNames.push(pin.signal_name);
        }
    }
    const mainNetId = netIds.get(params.mainNet);
    if (mainNetId === undefined) throw new Error(`Passive island main net ${params.mainNet} is missing`);

    const components = params.components.map((component, id) => {
        const layer = component.pcb.allowedLayers[0] ?? 'top';
        const pins = component.pins.filter((pin) => Boolean(pin.signal_name));
        const padByPin = new Map(component.footprint.pads.map((pad) => [String(pad.pin_number), pad]));
        return {
            id,
            designator: component.designator,
            layer,
            pinNetIds: pins.map((pin) => netIds.get(pin.signal_name)!),
            orientations: normalizedRotations(component).map((rotation) => {
                const placement = { designator: component.designator, x: 0, y: 0, rotate: rotation, layer, score: 0 };
                const bodyBox = componentBox(component, placement);
                const oppositeLayer = layer === 'top' ? 'bottom' : 'top';
                return {
                    rotation,
                    width: bodyBox.right - bodyBox.left,
                    height: bodyBox.bottom - bodyBox.top,
                    bodyBox,
                    throughHoleBoxes: componentCollisionBoxes(component, placement, oppositeLayer),
                    pinPoints: pins.map((pin) => {
                        const pad = padByPin.get(String(pin.pin_number));
                        return pad ? getLocalPointOffset(pad, rotation, layer) : null;
                    }),
                };
            }),
        };
    });

    const count = components.length;
    const componentPairClearance = new Array<number>(count * count);
    const componentConflict = new Array<number>(count * count);
    for (let a = 0; a < count; a += 1) {
        for (let b = 0; b < count; b += 1) {
            const index = a * count + b;
            componentPairClearance[index] = a === b
                ? 0
                : params.options.clearanceResolver?.(params.components[a].designator, params.components[b].designator)
                    ?? params.options.clearance;
            const aPlacement = { designator: params.components[a].designator, x: 0, y: 0, rotate: 0, layer: components[a].layer, score: 0 };
            const bPlacement = { designator: params.components[b].designator, x: 0, y: 0, rotate: 0, layer: components[b].layer, score: 0 };
            componentConflict[index] = placementsCanConflict(params.components[a], aPlacement, params.components[b], bPlacement) ? 1 : 0;
        }
    }

    return {
        version: NATIVE_PASSIVE_ISLAND_CONTRACT_VERSION,
        grid: params.options.grid,
        clearance: params.options.clearance,
        mainNetId,
        netNames,
        netGround: netNames.map(isGroundSignalName),
        components,
        componentPairClearance,
        componentConflict,
    };
}

function normalizedRotations(component: PcbComponent) {
    const rotations = component.pcb.allowedRotations.length
        ? component.pcb.allowedRotations
        : [0, 90, 180, 270];
    return [...new Set(rotations.map((rotation) => ((rotation % 360) + 360) % 360))];
}
