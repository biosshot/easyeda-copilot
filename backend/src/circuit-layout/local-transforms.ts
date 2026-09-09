import type { BlockNode } from '#types/auto-place.ts';

export type LayoutDirection = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';

export function setSingleLocalBlockDirection(input: BlockNode, direction: LayoutDirection) {
    const root = structuredClone(input);
    const virtualRoot = root.id === 'block___v_root__'
        ? root
        : root.children?.find(node => node.id === 'block___v_root__');
    const localBlocks = virtualRoot?.children?.filter(node => node.id.startsWith('block_')) ?? [];
    if (localBlocks.length !== 1) return null;

    localBlocks[0].layoutOptions = {
        ...localBlocks[0].layoutOptions,
        'org.eclipse.elk.direction': direction,
    };
    return root;
}
