import type { ShortSymbol, SymbolWithMeta } from "./symbol.ts";
import type { ElkExtendedEdge, ElkNode } from 'elkjs';

export interface PositionedSchNode {
    designator: string;
    x: number;
    y: number;
    rotate: number;
    center: {
        x: number;
        y: number;
    };
    width: number;
    height: number;
}

export interface BlockHierarchyNode {
    name: string;
    children: BlockHierarchyNode[];
    components: SymbolWithMeta[];
    description: string,
    links: {
        input: string[];
        output: string[];
    },
    layoutOptions: Record<string, string>,
    allowedImprovements?: ImprovementsTypes[],
}

export type ImprovementsTypes = 'rotate' | 'block_direction';

export interface BlockNode extends ElkNode {
    children?: BlockNode[];
    shortSymbols?: Record<string, ShortSymbol[] | undefined>;
    description?: string;
    rotate?: number;
    allowedImprovements?: ImprovementsTypes[],
    externalSignals?: Record<string, boolean>;
    center?: {
        x: number;
        y: number;
    }
}

interface BaseLayoutImprovement {
    type: ImprovementsTypes;
}

export interface RotateLImprovement extends BaseLayoutImprovement {
    type: 'rotate';
    designator: string;
    rotate: number;
}

export interface BlockDirLImprovement extends BaseLayoutImprovement {
    type: 'block_direction';
    blockName: string;
    direction: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';
    lengthBefore: number;
    isFinal: boolean;
}

export type LayoutRecommendation = RotateLImprovement | BlockDirLImprovement;

export interface LayoutImprovements {
    improvements: LayoutRecommendation[];
};

export interface Hooks {

    autoPlaceFinish?: (a: PositionedSchNode[], b: ElkExtendedEdge[]) => { positioned?: PositionedSchNode[], edges?: ElkExtendedEdge[] }
    elkLayoutFinish?: (a: ElkNode) => ElkNode

}
