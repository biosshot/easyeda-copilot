import type { PlacementInput } from '#types/pcb/layout-model.ts';
import { componentPairClearance } from './report-helpers.ts';

export type ClearanceResolver = (aDesignator: string, bDesignator: string) => number;

export function createClearanceResolver(input: PlacementInput): ClearanceResolver {
    return (aDesignator: string, bDesignator: string) => {
        if (aDesignator === bDesignator) return 0;
        const a = input.components.find((component) => component.designator === aDesignator);
        const b = input.components.find((component) => component.designator === bDesignator);
        if (!a || !b) return input.board.clearances.component;
        return componentPairClearance(input, a, b);
    };
}
