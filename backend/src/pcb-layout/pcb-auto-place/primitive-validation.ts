import type { Box, PcbComponent, Placement, PlacementInput, Point } from '#types/pcb/layout-model.ts';
import { componentBox, componentPairCollisionBoxPairs, overlaps } from './geometry.ts';
import type { ClearanceResolver } from './clearance-resolver.ts';
import { createClearanceResolver } from './clearance-resolver.ts';
import { createFixedPlacement, sameFixedPlacement } from './fixed.ts';
import { placementsCanConflict } from './utils.ts';
import type { PlacementPrimitive } from '../pcb-auto-place-v2/primitives.ts';

export interface PrimitiveValidationOptions {
    bounds?: Box;
    edgeClearance?: number;
    checkHoles?: boolean;
    checkFixed?: boolean;
    clearanceResolver?: ClearanceResolver;
}

export interface PrimitiveViolation {
    type: 'overlap' | 'outside_bounds' | 'hole' | 'fixed_mismatch';
    designators: string[];
    message: string;
}

export interface PrimitiveValidationResult {
    ok: boolean;
    violations: PrimitiveViolation[];
}

export function validatePrimitive(
    input: PlacementInput,
    primitive: PlacementPrimitive,
    options: PrimitiveValidationOptions = {},
): PrimitiveValidationResult {
    const violations: PrimitiveViolation[] = [];
    const resolver = options.clearanceResolver ?? createClearanceResolver(input);
    const componentByDesignator = new Map(input.components.map((component) => [component.designator, component]));

    const placements = primitive.placements;
    const placementBoxes = placements.map((placement) => {
        const component = componentByDesignator.get(placement.designator);
        return component ? { placement, component, box: componentBox(component, placement) } : null;
    }).filter((item): item is { placement: Placement; component: PcbComponent; box: Box } => Boolean(item));

    for (let i = 0; i < placementBoxes.length; i += 1) {
        for (let j = i + 1; j < placementBoxes.length; j += 1) {
            const a = placementBoxes[i];
            const b = placementBoxes[j];
            if (!placementsCanConflict(a.component, a.placement, b.component, b.placement)) continue;
            const clearance = resolver(a.component.designator, b.component.designator);
            const boxPairs = componentPairCollisionBoxPairs(a.component, a.placement, b.component, b.placement);
            if (boxPairs.some((pair) => overlaps(pair.a, pair.b, clearance))) {
                violations.push({
                    type: 'overlap',
                    designators: [a.component.designator, b.component.designator],
                    message: `Overlap between ${a.component.designator} and ${b.component.designator} (clearance ${clearance})`,
                });
            }
        }
    }

    if (options.bounds) {
        const edgeClearance = options.edgeClearance ?? 0;
        for (const { placement, component, box } of placementBoxes) {
            if (
                box.left + edgeClearance < options.bounds.left - 1e-6
                || box.right - edgeClearance > options.bounds.right + 1e-6
                || box.top + edgeClearance < options.bounds.top - 1e-6
                || box.bottom - edgeClearance > options.bounds.bottom + 1e-6
            ) {
                violations.push({
                    type: 'outside_bounds',
                    designators: [component.designator],
                    message: `${component.designator} is outside bounds`,
                });
            }
        }
    }

    if (options.checkFixed) {
        for (const { placement, component } of placementBoxes) {
            const fixed = createFixedPlacement(input, component);
            if (fixed && !sameFixedPlacement(placement, fixed)) {
                violations.push({
                    type: 'fixed_mismatch',
                    designators: [component.designator],
                    message: `${component.designator} fixed placement mismatch`,
                });
            }
        }
    }

    if (options.checkHoles) {
        for (const hole of input.boardHoles ?? []) {
            const radius = Math.max(hole.keepout, hole.diameter / 2, hole.drill / 2);
            const holeBox = boxAroundPoint(hole, radius);
            for (const { placement, component, box } of placementBoxes) {
                if (overlaps(box, holeBox, 0)) {
                    violations.push({
                        type: 'hole',
                        designators: [component.designator],
                        message: `${component.designator} overlaps board hole ${hole.name}`,
                    });
                }
            }
        }
    }

    return { ok: violations.length === 0, violations };
}

function boxAroundPoint(point: Point, radius: number): Box {
    return {
        left: point.x - radius,
        right: point.x + radius,
        top: point.y - radius,
        bottom: point.y + radius,
    };
}
