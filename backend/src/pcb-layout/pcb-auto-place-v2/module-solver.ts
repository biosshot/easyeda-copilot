import type { Box, PlacementRelation, PlacementTreeNode } from '#types/pcb/layout-model.ts';
import type { BlockSolverOptions } from './block-solver.ts';
import { solveBlockPrimitives } from './block-solver-engine.ts';
import type { PlacementPrimitive } from './primitives.ts';

export interface ModuleSolverOptions extends BlockSolverOptions {
    targetWidth?: number;
    targetHeight?: number;
    bounds?: Box;
}

export interface ModuleSolveParams {
    node: PlacementTreeNode;
    primitives: PlacementPrimitive[];
    relations: PlacementRelation[];
    options: ModuleSolverOptions;
}

export function solveModulePrimitives(params: ModuleSolveParams): PlacementPrimitive[] {
    return solveBlockPrimitives({
        node: params.node,
        primitives: params.primitives,
        relations: params.relations,
        options: {
            ...params.options,
            clearance: Math.max(params.options.clearance, 1),
            searchWidth: 32
        },
    });
}
