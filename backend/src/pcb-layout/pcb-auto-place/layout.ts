import { PCB_PLACEMENT_ASSUMPTIONS } from '#types/pcb/layout-model.ts';
import type { PcbLayout, Placement, PlacementInput } from '#types/pcb/layout-model.ts';
import { allNets } from './utils.ts';
import { createDefaultRoutingRules } from './routing-rules.ts';

export function createPcbLayout(input: PlacementInput, placements: Placement[]): PcbLayout {
    const placementByDesignator = new Map(placements.map((placement) => [placement.designator, placement]));

    return {
        assumptions: PCB_PLACEMENT_ASSUMPTIONS,
        board: input.board,
        boardHoles: input.boardHoles ?? [],
        silkscreen: input.silkscreen,
        routingRules: createDefaultRoutingRules(input),
        components: input.components.map((component) => {
            const placement = placementByDesignator.get(component.designator);
            if (!placement) throw new Error(`Missing placement for ${component.designator}`);
            return {
                designator: component.designator,
                value: component.value,
                block_name: component.block_name,
                footprint: component.footprint,
                x: placement.x,
                y: placement.y,
                rotate: placement.rotate,
                layer: placement.layer,
                prohibitRoutingUnder: component.pcb.prohibitRoutingUnder,
                prohibitRoutingUnderAllowOwnNets: component.pcb.prohibitRoutingUnderAllowOwnNets,
                designatorText: component.pcb.designatorText,
                syntheticBoardPad: component.pcb.syntheticBoardPad,
                syntheticFootprint: component.pcb.syntheticFootprint,
                generatedGeometry: component.pcb.generatedGeometry,
            };
        }),
        nets: allNets(input).map((signal_name) => ({
            signal_name,
            pins: input.components.flatMap((component) => component.pins
                .filter((pin) => pin.signal_name === signal_name)
                .map((pin) => ({ designator: component.designator, pin_number: pin.pin_number }))),
        })),
    };
}
