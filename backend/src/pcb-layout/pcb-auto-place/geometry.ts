import { rotatePoint } from '#utils/math.ts';
import type { BoardAnchor, BoardEdge, BoardHole, Box, CenteredRectBoard, FootprintPad, FootprintSpec, Layer, PcbComponent, Placement, Point } from '../../types/pcb/layout-model.ts';

export const GEOMETRY_EPSILON = 1e-6;

// Placement coordinates are rounded to the grid (typically 0.5 mm) and then to 3 decimals.
// Use a slightly larger epsilon for overlap/clearance checks so that tiny floating-point
// rounding differences do not create false positives when the gap equals the required clearance.
export const PLACEMENT_EPSILON = 0.005;

export function getPadWorld(component: PcbComponent, placement: Placement, pin: string | number) {
    const pad = component.footprint.pads.find((pad) => String(pad.pin_number) === String(pin));
    return pad ? getLocalPointWorld(placement, pad) : null;
}

export function getPadOffset(component: PcbComponent, pin: string | number, rotate: number, layer: Layer = 'top') {
    const pad = component.footprint.pads.find((pad) => String(pad.pin_number) === String(pin));
    return pad ? getLocalPointOffset(pad, rotate, layer) : null;
}

export function getLocalPointWorld(placement: Placement, point: Point) {
    const offset = getLocalPointOffset(point, placement.rotate, placement.layer);
    return {
        x: placement.x + offset.x,
        y: placement.y + offset.y,
    };
}

export function getLocalPointOffset(point: Point, rotate: number, layer: Layer = 'top') {
    const local = layer === 'bottom'
        ? { x: -point.x, y: point.y }
        : point;
    return rotatePoint(local, rotate);
}

export function getBox(component: PcbComponent, placement: Placement): Box {
    const footprint = component.footprint;
    const radians = placement.rotate * Math.PI / 180;
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    const halfWidth = (footprint.width * cos + footprint.height * sin) / 2;
    const halfHeight = (footprint.width * sin + footprint.height * cos) / 2;

    return {
        left: placement.x - halfWidth,
        right: placement.x + halfWidth,
        top: placement.y - halfHeight,
        bottom: placement.y + halfHeight,
    };
}

export function boardBox(board: CenteredRectBoard): Box {
    return {
        left: -board.outline.width / 2,
        right: board.outline.width / 2,
        top: -board.outline.height / 2,
        bottom: board.outline.height / 2,
    };
}

export function rectBoardPolygon(width: number, height: number): Point[] {
    return [
        { x: -width / 2, y: -height / 2 },
        { x: width / 2, y: -height / 2 },
        { x: width / 2, y: height / 2 },
        { x: -width / 2, y: height / 2 },
    ];
}

export function boardOutlinePolygon(board: CenteredRectBoard): Point[] {
    return board.outline.type === 'polygon'
        ? board.outline.points
        : rectBoardPolygon(board.outline.width, board.outline.height);
}

export function pointsBox(points: Point[]): Box {
    if (points.length === 0) return { left: 0, right: 0, top: 0, bottom: 0 };
    let left = points[0].x;
    let right = points[0].x;
    let top = points[0].y;
    let bottom = points[0].y;
    for (let index = 1; index < points.length; index += 1) {
        const point = points[index];
        if (point.x < left) left = point.x;
        if (point.x > right) right = point.x;
        if (point.y < top) top = point.y;
        if (point.y > bottom) bottom = point.y;
    }
    return { left, right, top, bottom };
}

export function pointInBoard(board: CenteredRectBoard, point: Point, edgeClearance = 0) {
    const box = boardBox(board);
    if (
        point.x < box.left + edgeClearance - GEOMETRY_EPSILON
        || point.x > box.right - edgeClearance + GEOMETRY_EPSILON
        || point.y < box.top + edgeClearance - GEOMETRY_EPSILON
        || point.y > box.bottom - edgeClearance + GEOMETRY_EPSILON
    ) {
        return false;
    }

    if (board.outline.type !== 'polygon') return true;
    if (!pointInPolygon(point, board.outline.points)) return false;
    return edgeClearance <= 0 || pointToPolygonDistance(point, board.outline.points) + GEOMETRY_EPSILON >= edgeClearance;
}

export function boxInsideBoard(board: CenteredRectBoard, box: Box, edgeClearance = 0) {
    const corners = [
        { x: box.left, y: box.top },
        { x: box.right, y: box.top },
        { x: box.right, y: box.bottom },
        { x: box.left, y: box.bottom },
    ];
    if (!corners.every((corner) => pointInBoard(board, corner, edgeClearance))) return false;
    if (board.outline.type !== 'polygon') return true;

    const boxEdges = corners.map((corner, index) => [corner, corners[(index + 1) % corners.length]] as const);
    const outline = board.outline.points;
    return boxEdges.every(([a, b]) => outline.every((point, index) =>
        segmentIntersection(a, b, point, outline[(index + 1) % outline.length]) === null));
}

export function pointInPolygon(point: Point, polygon: Point[]) {
    if (polygon.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i];
        const b = polygon[j];
        if (pointOnSegment(point, a, b)) return true;
        const intersects = ((a.y > point.y) !== (b.y > point.y))
            && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
        if (intersects) inside = !inside;
    }
    return inside;
}

export function pointToPolygonDistance(point: Point, polygon: Point[]) {
    if (polygon.length === 0) return Infinity;
    let min = Infinity;
    for (let index = 0; index < polygon.length; index += 1) {
        const a = polygon[index];
        const b = polygon[(index + 1) % polygon.length];
        const distance = pointToSegmentDistance(point, a, b);
        if (distance < min) min = distance;
    }
    return min;
}

export function pointToSegmentDistance(point: Point, a: Point, b: Point) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared < GEOMETRY_EPSILON) return dist(point, a);
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
    const projectionX = a.x + t * dx;
    const projectionY = a.y + t * dy;
    const projectionDx = point.x - projectionX;
    const projectionDy = point.y - projectionY;
    return Math.sqrt(projectionDx * projectionDx + projectionDy * projectionDy);
}

export function outlineInsetPointFromCorner(board: CenteredRectBoard, corner: Exclude<BoardAnchor, 'board.center' | 'board.left' | 'board.right' | 'board.top' | 'board.bottom'>, inset: number) {
    const boxCorner = boardAnchorPoint(board, corner);
    if (board.outline.type !== 'polygon') {
        return {
            x: boxCorner.x + (corner.includes('left') ? inset : -inset),
            y: boxCorner.y + (corner.includes('top') ? inset : -inset),
        };
    }
    const directionLength = Math.hypot(boxCorner.x, boxCorner.y);
    if (directionLength < GEOMETRY_EPSILON) return boxCorner;
    const direction = { x: -boxCorner.x / directionLength, y: -boxCorner.y / directionLength };
    const center = { x: 0, y: 0 };
    const polygon = boardOutlinePolygon(board);
    const intersections = polygon
        .map((point, index) => segmentIntersection(boxCorner, center, point, polygon[(index + 1) % polygon.length]))
        .filter((point): point is Point => point !== null)
        .sort((a, b) => dist(boxCorner, a) - dist(boxCorner, b));
    const edgePoint = intersections[0] ?? boxCorner;
    return {
        x: edgePoint.x + direction.x * inset,
        y: edgePoint.y + direction.y * inset,
    };
}

export function boardAnchorPoint(board: CenteredRectBoard, anchorValue: BoardAnchor): Point {
    const box = boardBox(board);
    const center = { x: 0, y: 0 };
    const map: Record<BoardAnchor, Point> = {
        'board.center': center,
        'board.left': { x: box.left, y: 0 },
        'board.right': { x: box.right, y: 0 },
        'board.top': { x: 0, y: box.top },
        'board.bottom': { x: 0, y: box.bottom },
        'board.top_left': { x: box.left, y: box.top },
        'board.top_right': { x: box.right, y: box.top },
        'board.bottom_left': { x: box.left, y: box.bottom },
        'board.bottom_right': { x: box.right, y: box.bottom },
    };
    return map[anchorValue];
}

export function distanceToEdge(board: CenteredRectBoard, component: PcbComponent, placement: Placement, edge: BoardEdge) {
    const box = boardBox(board);
    const componentBox = getBox(component, placement);
    if (edge === 'left') return Math.abs(componentBox.left - box.left);
    if (edge === 'right') return Math.abs(box.right - componentBox.right);
    if (edge === 'top') return Math.abs(componentBox.top - box.top);
    return Math.abs(box.bottom - componentBox.bottom);
}

export function rotatedSize(footprint: FootprintSpec, rotate: number) {
    return Math.abs(rotate % 180) === 90
        ? { width: footprint.height, height: footprint.width }
        : { width: footprint.width, height: footprint.height };
}

export function overlaps(a: Box, b: Box, clearance: number) {
    return !(
        a.right + clearance - PLACEMENT_EPSILON < b.left ||
        a.left - clearance + PLACEMENT_EPSILON > b.right ||
        a.bottom + clearance - PLACEMENT_EPSILON < b.top ||
        a.top - clearance + PLACEMENT_EPSILON > b.bottom
    );
}

export function boxGap(a: Box, b: Box) {
    const xGap = Math.max(0, Math.max(b.left - a.right, a.left - b.right));
    const yGap = Math.max(0, Math.max(b.top - a.bottom, a.top - b.bottom));
    return Math.sqrt(xGap * xGap + yGap * yGap);
}

/**
 * Separation distance for axis-aligned clearance checks.
 * Two boxes are safely separated iff the result is >= required clearance.
 * A negative value means they overlap (or are closer than touching).
 */
export function boxClearanceGap(a: Box, b: Box): number {
    const xSep = Math.max(b.left - a.right, a.left - b.right);
    const ySep = Math.max(b.top - a.bottom, a.top - b.bottom);
    return Math.max(xSep, ySep);
}

export function boxPointGap(box: Box, point: Point) {
    const xGap = Math.max(box.left - point.x, 0, point.x - box.right);
    const yGap = Math.max(box.top - point.y, 0, point.y - box.bottom);
    return Math.sqrt(xGap * xGap + yGap * yGap);
}

export function boardHoleKeepoutRadius(hole: BoardHole) {
    return Math.max(hole.keepout, hole.diameter / 2, hole.drill / 2);
}

export function overlapsBoardHole(box: Box, hole: BoardHole, clearance = 0) {
    return boxPointGap(box, hole) + GEOMETRY_EPSILON < boardHoleKeepoutRadius(hole) + clearance;
}

export function polar(radius: number, angle: number) {
    const radians = angle * Math.PI / 180;
    return { x: Math.cos(radians) * radius, y: Math.sin(radians) * radius };
}

function pointOnSegment(point: Point, a: Point, b: Point) {
    return Math.abs((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)) < GEOMETRY_EPSILON
        && point.x <= Math.max(a.x, b.x) + GEOMETRY_EPSILON
        && point.x >= Math.min(a.x, b.x) - GEOMETRY_EPSILON
        && point.y <= Math.max(a.y, b.y) + GEOMETRY_EPSILON
        && point.y >= Math.min(a.y, b.y) - GEOMETRY_EPSILON;
}

function segmentIntersection(a: Point, b: Point, c: Point, d: Point): Point | null {
    const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
    if (Math.abs(denominator) < GEOMETRY_EPSILON) return null;
    const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denominator;
    const u = -((a.x - b.x) * (a.y - c.y) - (a.y - b.y) * (a.x - c.x)) / denominator;
    if (t < -GEOMETRY_EPSILON || t > 1 + GEOMETRY_EPSILON || u < -GEOMETRY_EPSILON || u > 1 + GEOMETRY_EPSILON) return null;
    return {
        x: a.x + t * (b.x - a.x),
        y: a.y + t * (b.y - a.y),
    };
}

export function dist(a: Point, b: Point) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

export function round(value: number) {
    return Math.round(value * 100) / 100;
}

export function roundPlacement(value: number) {
    return Math.round(value * 1000) / 1000;
}

export function componentBox(component: PcbComponent, placement: Placement): Box {
    const size = rotatedSize(component.footprint, placement.rotate);
    return {
        left: placement.x - size.width / 2,
        right: placement.x + size.width / 2,
        top: placement.y - size.height / 2,
        bottom: placement.y + size.height / 2,
    };
}

export function componentCollisionBoxes(component: PcbComponent, placement: Placement, layer: Layer): Box[] {
    if (placement.layer === layer) return [componentBox(component, placement)];
    const throughHolePads = component.footprint.pads
        .filter(isThroughHolePad)
        .map((pad) => componentPadBox(placement, pad));
    const oppositeLayerPolygons = (component.pcb.generatedGeometry ?? [])
        .flatMap((geometry) => geometry.polygons)
        .filter((polygon) => polygon.layer === 'opposite')
        .map((polygon) => pointsBox(polygon.points.map((point) => getLocalPointWorld(placement, point))));
    return [...throughHolePads, ...oppositeLayerPolygons];
}

export function componentPairCollisionBoxPairs(
    a: PcbComponent,
    aPlacement: Placement,
    b: PcbComponent,
    bPlacement: Placement,
): Array<{ a: Box; b: Box }> {
    const layers = aPlacement.layer === bPlacement.layer
        ? [aPlacement.layer]
        : [aPlacement.layer, bPlacement.layer];
    const pairs: Array<{ a: Box; b: Box }> = [];
    for (const layer of layers) {
        const aBoxes = componentCollisionBoxes(a, aPlacement, layer);
        if (aBoxes.length === 0) continue;
        const bBoxes = componentCollisionBoxes(b, bPlacement, layer);
        if (bBoxes.length === 0) continue;
        for (const aBox of aBoxes) {
            for (const bBox of bBoxes) pairs.push({ a: aBox, b: bBox });
        }
    }
    return pairs;
}

export function componentPadBox(placement: Placement, pad: FootprintPad): Box {
    const width = Math.max(pad.width, pad.drillDiameter ?? 0);
    const height = Math.max(pad.height, pad.drillDiameter ?? 0);
    const corners = [
        { x: pad.x - width / 2, y: pad.y - height / 2 },
        { x: pad.x + width / 2, y: pad.y - height / 2 },
        { x: pad.x + width / 2, y: pad.y + height / 2 },
        { x: pad.x - width / 2, y: pad.y + height / 2 },
    ].map((corner) => getLocalPointWorld(placement, corner));
    return pointsBox(corners);
}

export function isThroughHolePad(pad: FootprintPad) {
    return pad.mount === 'through_hole' || (pad.drillDiameter ?? 0) > 0;
}

export function translateBox(box: Box, dx: number, dy: number): Box {
    return {
        left: roundPlacement(box.left + dx),
        right: roundPlacement(box.right + dx),
        top: roundPlacement(box.top + dy),
        bottom: roundPlacement(box.bottom + dy),
    };
}

export function rotatePointAround(point: Point, origin: Point, angle: number): Point {
    const radians = angle * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    return {
        x: roundPlacement(origin.x + dx * cos - dy * sin),
        y: roundPlacement(origin.y + dx * sin + dy * cos),
    };
}

export function rotateBox(box: Box, origin: Point, angle: number): Box {
    const radians = angle * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    const visit = (x: number, y: number) => {
        const dx = x - origin.x;
        const dy = y - origin.y;
        const rotatedX = roundPlacement(origin.x + dx * cos - dy * sin);
        const rotatedY = roundPlacement(origin.y + dx * sin + dy * cos);
        if (rotatedX < left) left = rotatedX;
        if (rotatedX > right) right = rotatedX;
        if (rotatedY < top) top = rotatedY;
        if (rotatedY > bottom) bottom = rotatedY;
    };
    visit(box.left, box.top);
    visit(box.right, box.top);
    visit(box.right, box.bottom);
    visit(box.left, box.bottom);
    return { left, right, top, bottom };
}

export function boxCenter(box: Box): Point {
    return { x: roundPlacement((box.left + box.right) / 2), y: roundPlacement((box.top + box.bottom) / 2) };
}

export function unionBoxes(boxes: Box[]): Box {
    if (boxes.length === 0) return { left: 0, right: 0, top: 0, bottom: 0 };
    let left = boxes[0].left;
    let right = boxes[0].right;
    let top = boxes[0].top;
    let bottom = boxes[0].bottom;
    for (let index = 1; index < boxes.length; index += 1) {
        const box = boxes[index];
        if (box.left < left) left = box.left;
        if (box.right > right) right = box.right;
        if (box.top < top) top = box.top;
        if (box.bottom > bottom) bottom = box.bottom;
    }
    return { left, right, top, bottom };
}

export function normalizeRotation(value: number) {
    return ((Math.round(value) % 360) + 360) % 360;
}
