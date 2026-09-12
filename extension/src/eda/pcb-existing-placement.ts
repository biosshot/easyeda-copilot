export type PlacementPoint = {
    x: number;
    y: number;
};

export function easyEdaPointToPlacement(point: PlacementPoint, origin: PlacementPoint): PlacementPoint {
    return {
        x: point.x - origin.x,
        y: origin.y - point.y,
    };
}

export function easyEdaRotationToPlacement(rotation: number, layer: "top" | "bottom") {
    const angle = layer === "bottom" ? -rotation : 180 - rotation;
    return ((angle % 360) + 360) % 360;
}
