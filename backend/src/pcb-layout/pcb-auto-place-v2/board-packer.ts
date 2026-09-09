import type {
    Box,
    CenteredRectBoard,
    PcbComponent,
    PcbConstraintRegion,
    PlacementRelation,
    PlacementTreeNode,
} from '#types/pcb/layout-model.ts';
import type { PlacementPrimitive } from './primitives.ts';

/** Input contract for the Rust board packer. Search and scoring live in the native crate. */
export interface BoardPackerOptions {
    grid: number;
    clearance: number;
    componentByDesignator?: Map<string, PcbComponent>;
    clearanceResolver?: (a: string, b: string) => number;
    board?: CenteredRectBoard;
    edgeClearance?: number;
    bounds: Box;
    obstacles?: Box[];
    constraintRegions?: PcbConstraintRegion[];
    searchWidth?: number;
    compactness?: 'normal' | 'high';
}

export interface BoardPackParams {
    node: PlacementTreeNode;
    primitives: PlacementPrimitive[];
    relations: PlacementRelation[];
    options: BoardPackerOptions;
}
