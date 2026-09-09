import type { Box, Layer, PcbComponent, Placement, PlacementInput } from '#types/pcb/layout-model.ts';
import { boardAnchorPoint, boardBox, boxInsideBoard, GEOMETRY_EPSILON } from './geometry.ts';
import { isFixedComponent } from './utils.ts';

export function createFixedPlacement(input: PlacementInput, component: PcbComponent): Placement | null {
    const fixed = component.pcb.fixedPlacement;
    if (!fixed) return null;

    const anchorPoint = fixed.anchor ? boardAnchorPoint(input.board, fixed.anchor.anchor) : null;
    const offset = fixed.offset ?? {};
    const x = typeof fixed.x === 'number'
        ? fixed.x
        : anchorPoint
            ? anchorPoint.x
            : null;
    const y = typeof fixed.y === 'number'
        ? fixed.y
        : anchorPoint
            ? anchorPoint.y
            : null;
    if (x === null || y === null) {
        throw new Error(`Fixed placement for ${component.designator} requires either x/y or anchor`);
    }

    const allowedLayers = allowedPlacementLayers(input, component);
    const layer = fixed.layer && allowedLayers.includes(fixed.layer)
        ? fixed.layer
        : fixed.layer ?? allowedLayers[0] ?? input.board.defaultLayer;
    const rotate = typeof fixed.rotate === 'number'
        ? fixed.rotate
        : component.pcb.allowedRotations[0] ?? 0;

    return {
        designator: component.designator,
        x: x + (offset.x ?? 0),
        y: y + (offset.y ?? 0),
        rotate,
        layer,
        score: 0,
    };
}

export function fixedDesignatorSet(input: PlacementInput) {
    return new Set(input.components
        .filter(isFixedComponent)
        .map((component) => component.designator));
}

export function isFixedDesignator(input: PlacementInput, designator: string) {
    return fixedDesignatorSet(input).has(designator);
}

export function sameFixedPlacement(candidate: Placement, fixedPlacement: Placement) {
    return candidate.layer === fixedPlacement.layer
        && candidate.rotate === fixedPlacement.rotate
        && Math.abs(candidate.x - fixedPlacement.x) < 0.001
        && Math.abs(candidate.y - fixedPlacement.y) < 0.001;
}

export function componentOutsideBoard(input: PlacementInput, component: PcbComponent, box: Box) {
    const board = boardBox(input.board);
    const edge = input.board.clearances.edge;
    const overflow = component.pcb.boardOverflow ?? {};
    const hasOverflow = (overflow.left ?? 0) > 0 || (overflow.right ?? 0) > 0 || (overflow.top ?? 0) > 0 || (overflow.bottom ?? 0) > 0;
    const tolerance = 0.01 + GEOMETRY_EPSILON;
    if (input.board.outline.type === 'polygon' && !hasOverflow) {
        return !boxInsideBoard(input.board, box, Math.max(0, edge - tolerance));
    }
    const leftLimit = (overflow.left ?? 0) > 0 ? board.left - (overflow.left ?? 0) : board.left + edge;
    const rightLimit = (overflow.right ?? 0) > 0 ? board.right + (overflow.right ?? 0) : board.right - edge;
    const topLimit = (overflow.top ?? 0) > 0 ? board.top - (overflow.top ?? 0) : board.top + edge;
    const bottomLimit = (overflow.bottom ?? 0) > 0 ? board.bottom + (overflow.bottom ?? 0) : board.bottom - edge;
    return box.left < leftLimit - tolerance
        || box.right > rightLimit + tolerance
        || box.top < topLimit - tolerance
        || box.bottom > bottomLimit + tolerance;
}

export function allowedPlacementLayers(input: PlacementInput, component: PcbComponent): Layer[] {
    const componentLayers = component.pcb.allowedLayers.length > 0 ? component.pcb.allowedLayers : input.board.allowedLayers;
    const layers = [...new Set(componentLayers.filter((layer) => input.board.allowedLayers.includes(layer)))];
    if (layers.length > 0) return layers;
    if (input.board.allowedLayers.includes(input.board.defaultLayer)) return [input.board.defaultLayer];
    return input.board.allowedLayers[0] ? [input.board.allowedLayers[0]] : ['top'];
}
