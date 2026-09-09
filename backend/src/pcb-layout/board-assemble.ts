import {
    boardOutlinePolygon as layoutBoardOutlinePolygon,
    boxInsideBoard,
    overlaps,
    overlapsBoardHole,
} from "#pcb-layout/pcb-auto-place/geometry.ts";
import { BoardAssembleSchema, type BoardAssemble } from "#types/pcb/board-assemble.ts";
import type { Box, Layer, PcbDesignatorTextOptions, PcbLayout, Point } from "#types/pcb/layout-model.ts";
import { normalizeRotation, rotatePoint } from "#utils/math.ts";
import { roundForMessage } from "./common.ts";

type DesignatorTextPlacement = {
    x: number;
    y: number;
    rotate: number;
    height: number;
};

type PlacedDesignatorText = {
    layer: Layer;
    box: Box;
    placement: DesignatorTextPlacement;
};

const DEFAULT_DESIGNATOR_TEXT = {
    enabled: true,
    height: 1.1,
    rotations: [0, 90],
    margin: 0.5,
} as const;

export type BoardAssembleOptions = {
    preserveBoard?: boolean;
    preservedComponents?: ReadonlySet<string>;
};

export function createBoardAssemble(layout: PcbLayout, options: BoardAssembleOptions = {}): BoardAssemble {
    const board = options.preserveBoard ? undefined : boardOutlinePolygon(layout);
    const designatorTexts = createDesignatorTextPlacements(layout);
    const components = layout.components
        .filter((component) => (
            !component.syntheticBoardPad
            && !component.syntheticFootprint
            && !options.preservedComponents?.has(component.designator)
        ))
        .map((component) =>
        boardAssembleComponentPlacement(component, designatorTexts.get(component.designator)));
    const pads = [
        ...layout.components.flatMap(boardAssembleSyntheticPads),
        ...layout.components.flatMap(boardAssembleGeneratedPads),
    ];
    const tracks = layout.components.flatMap(boardAssembleGeneratedTracks);
    const generatedVias = layout.components.flatMap(boardAssembleGeneratedVias);
    const polygons = layout.components.flatMap(boardAssembleGeneratedPolygons);

    const boardHoleVias = layout.boardHoles.map((hole) => ({
        x: roundForMessage(hole.x),
        y: roundForMessage(toEasyEdaY(hole.y)),
        diameter: roundForMessage(hole.diameter),
        drill: roundForMessage(hole.drill),
    }));

    return BoardAssembleSchema().parse(dropEmpty({
        board,
        components,
        tracks,
        vias: [...boardHoleVias, ...generatedVias],
        pads,
        polygons,
    }));
}

function boardAssembleGeneratedPads(component: PcbLayout["components"][number]): NonNullable<BoardAssemble["pads"]> {
    return componentGeneratedGeometries(component).flatMap((geometry) => geometry.pads.map((pad) => {
        const point = componentLocalToWorld(component, pad);
        return {
            name: `${geometry.name}.${pad.name}`,
            net: pad.net,
            x: roundForMessage(point.x),
            y: roundForMessage(toEasyEdaY(point.y)),
            layer: generatedLayer(component, pad.layer),
            shape: pad.shape,
            ...(pad.shape === "round"
                ? { diameter: roundForMessage(pad.diameter ?? pad.width ?? pad.height ?? 0) }
                : { width: roundForMessage(pad.width ?? pad.diameter ?? 0), height: roundForMessage(pad.height ?? pad.diameter ?? 0) }),
        };
    }));
}

function boardAssembleGeneratedTracks(component: PcbLayout["components"][number]): NonNullable<BoardAssemble["tracks"]> {
    return componentGeneratedGeometries(component).flatMap((geometry) => geometry.tracks
        .filter((track) => track.points.length >= 2)
        .map((track) => ({
            net: track.net,
            layer: generatedLayer(component, track.layer),
            width: roundForMessage(track.width),
            points: track.points.map((point) => {
                const world = componentLocalToWorld(component, point);
                return { x: roundForMessage(world.x), y: roundForMessage(toEasyEdaY(world.y)) };
            }),
        })));
}

function boardAssembleGeneratedVias(component: PcbLayout["components"][number]): NonNullable<BoardAssemble["vias"]> {
    return componentGeneratedGeometries(component).flatMap((geometry) => geometry.vias.map((via) => {
        const point = componentLocalToWorld(component, via);
        return {
            net: via.net,
            x: roundForMessage(point.x),
            y: roundForMessage(toEasyEdaY(point.y)),
            diameter: roundForMessage(via.diameter),
            drill: roundForMessage(via.drill),
        };
    }));
}

function boardAssembleGeneratedPolygons(component: PcbLayout["components"][number]): NonNullable<BoardAssemble["polygons"]> {
    return componentGeneratedGeometries(component).flatMap((geometry) => geometry.polygons
        .filter((polygon) => polygon.points.length >= 3)
        .map((polygon) => ({
            net: polygon.net,
            layer: generatedLayer(component, polygon.layer),
            points: polygon.points.map((point) => {
                const world = componentLocalToWorld(component, point);
                return { x: roundForMessage(world.x), y: roundForMessage(toEasyEdaY(world.y)) };
            }),
        })));
}

function componentGeneratedGeometries(component: PcbLayout["components"][number]) {
    return [
        ...(component.syntheticFootprint ? [component.syntheticFootprint] : []),
        ...(component.generatedGeometry ?? []),
    ];
}

function generatedLayer(
    component: PcbLayout["components"][number],
    layer: "same" | "opposite",
): Layer {
    if (layer === "same") return component.layer;
    return component.layer === "top" ? "bottom" : "top";
}

function boardAssembleComponentPlacement(
    component: PcbLayout["components"][number],
    designatorText?: DesignatorTextPlacement,
): NonNullable<BoardAssemble["components"]>[number] {
    const sourceOrigin = component.footprint.sourceOriginOffset
        ? componentLocalToWorld(component, component.footprint.sourceOriginOffset)
        : { x: component.x, y: component.y };
    return {
        designator: component.designator,
        x: roundForMessage(sourceOrigin.x),
        y: roundForMessage(toEasyEdaY(sourceOrigin.y)),
        rotate: boardAssembleComponentRotation(component),
        layer: component.layer,
        ...(designatorText ? {
            designatorText: {
                x: roundForMessage(designatorText.x),
                y: roundForMessage(toEasyEdaY(designatorText.y)),
                rotate: normalizeRotation(designatorText.rotate),
                height: roundForMessage(designatorText.height),
            },
        } : {}),
    };
}

function boardAssembleSyntheticPads(component: PcbLayout["components"][number]): NonNullable<BoardAssemble["pads"]> {
    const synthetic = component.syntheticBoardPad;
    if (!synthetic) return [];
    return synthetic.pads.map((pad) => {
        const point = componentLocalToWorld(component, pad);
        return {
            name: `${component.designator}.${pad.name}`,
            net: pad.net,
            x: roundForMessage(point.x),
            y: roundForMessage(toEasyEdaY(point.y)),
            layer: synthetic.layer,
            shape: pad.shape,
            ...(pad.shape === "round"
                ? { diameter: roundForMessage(pad.diameter ?? 0) }
                : { width: roundForMessage(pad.width ?? 0), height: roundForMessage(pad.height ?? 0) }),
            ...(pad.hole && pad.hole.diameter > 0 ? {
                hole: {
                    diameter: roundForMessage(pad.hole.diameter),
                    ...(pad.hole.offset ? {
                        offset: {
                            ...(pad.hole.offset.x === undefined ? {} : { x: roundForMessage(pad.hole.offset.x) }),
                            ...(pad.hole.offset.y === undefined ? {} : { y: roundForMessage(pad.hole.offset.y) }),
                        },
                    } : {}),
                },
            } : {}),
        };
    });
}

function createDesignatorTextPlacements(layout: PcbLayout) {
    const placed: PlacedDesignatorText[] = [];
    const result = new Map<string, DesignatorTextPlacement>();

    for (const component of layout.components) {
        const options = mergedDesignatorTextOptions(layout, component);
        if (!options) continue;
        const candidate = chooseDesignatorTextPlacement(layout, component, options, placed);
        if (!candidate) continue;
        placed.push(candidate);
        result.set(component.designator, candidate.placement);
    }

    return result;
}

function mergedDesignatorTextOptions(
    layout: PcbLayout,
    component: PcbLayout["components"][number],
): Required<PcbDesignatorTextOptions> | null {
    const global = layout.silkscreen?.designators ?? {};
    const local = component.designatorText ?? {};
    const enabled = local.enabled ?? global.enabled ?? DEFAULT_DESIGNATOR_TEXT.enabled;
    if (!enabled) return null;
    const height = local.height ?? global.height ?? DEFAULT_DESIGNATOR_TEXT.height;
    if (!Number.isFinite(height) || height <= 0) return null;
    const rotations = local.rotations?.length
        ? local.rotations
        : global.rotations?.length ? global.rotations : [...DEFAULT_DESIGNATOR_TEXT.rotations];
    const margin = local.margin ?? global.margin ?? DEFAULT_DESIGNATOR_TEXT.margin;
    return {
        enabled,
        height,
        rotations,
        margin,
    };
}

function chooseDesignatorTextPlacement(
    layout: PcbLayout,
    component: PcbLayout["components"][number],
    options: Required<PcbDesignatorTextOptions>,
    placedTexts: PlacedDesignatorText[],
): PlacedDesignatorText | null {
    const componentBox = componentPlacementBox(component);
    const componentObstacles = layout.components
        .filter((item) => item.layer === component.layer)
        .map(componentPlacementBox);

    for (const rotate of options.rotations.map(normalizeRotation)) {
        for (const center of textCandidateCenters(componentBox, textBoxSize(component.designator, options.height, rotate), options.margin)) {
            const box = textPlacementBox(center, component.designator, options.height, rotate);
            if (!boxInsideBoard(layout.board, box, 0)) continue;
            if (componentObstacles.some((obstacle) => overlaps(box, obstacle, options.margin))) continue;
            if (layout.boardHoles.some((hole) => overlapsBoardHole(box, hole, options.margin))) continue;
            if (placedTexts.some((item) => item.layer === component.layer && overlaps(box, item.box, options.margin))) continue;
            return {
                layer: component.layer,
                box,
                placement: {
                    x: center.x,
                    y: center.y,
                    rotate,
                    height: options.height,
                },
            };
        }
    }

    return null;
}

function textCandidateCenters(box: Box, size: { width: number; height: number }, margin: number): Point[] {
    const centerX = (box.left + box.right) / 2;
    const centerY = (box.top + box.bottom) / 2;
    return [
        { x: box.left + size.width / 2, y: box.top - margin - size.height / 2 },
        { x: box.left - margin - size.width / 2, y: box.top + size.height / 2 },
        { x: centerX, y: box.top - margin - size.height / 2 },
        { x: box.right + margin + size.width / 2, y: box.top + size.height / 2 },
        { x: box.left + size.width / 2, y: box.bottom + margin + size.height / 2 },
        { x: box.left - margin - size.width / 2, y: centerY },
        { x: box.right + margin + size.width / 2, y: centerY },
        { x: centerX, y: box.bottom + margin + size.height / 2 },
        { x: box.right - size.width / 2, y: box.top - margin - size.height / 2 },
        { x: box.right - size.width / 2, y: box.bottom + margin + size.height / 2 },
    ];
}

function textPlacementBox(center: Point, text: string, height: number, rotate: number): Box {
    const size = textBoxSize(text, height, rotate);
    return {
        left: center.x - size.width / 2,
        right: center.x + size.width / 2,
        top: center.y - size.height / 2,
        bottom: center.y + size.height / 2,
    };
}

function textBoxSize(text: string, height: number, rotate: number) {
    const width = Math.max(height * 1.2, text.length * height * 0.62);
    const radians = normalizeRotation(rotate) * Math.PI / 180;
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    return {
        width: width * cos + height * sin,
        height: width * sin + height * cos,
    };
}

function componentPlacementBox(component: PcbLayout["components"][number]): Box {
    const radians = component.rotate * Math.PI / 180;
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    const halfWidth = (component.footprint.width * cos + component.footprint.height * sin) / 2;
    const halfHeight = (component.footprint.width * sin + component.footprint.height * cos) / 2;
    return {
        left: component.x - halfWidth,
        right: component.x + halfWidth,
        top: component.y - halfHeight,
        bottom: component.y + halfHeight,
    };
}

function boardAssembleComponentRotation(component: PcbLayout["components"][number]) {
    return component.layer === "bottom"
        ? normalizeRotation(-component.rotate)
        : normalizeRotation(180 - component.rotate);
}

function componentLocalToWorld(component: PcbLayout["components"][number], point: Point): Point {
    const local = component.layer === "bottom"
        ? { x: -point.x, y: point.y }
        : { x: point.x, y: point.y };
    const rotated = rotatePoint(local, component.rotate);
    return {
        x: component.x + rotated.x,
        y: component.y + rotated.y,
    };
}

function boardOutlinePolygon(layout: PcbLayout): NonNullable<BoardAssemble["board"]> {
    return {
        polygon: layoutBoardOutlinePolygon(layout.board).map(toEasyEdaPoint).reverse(),
    };
}

function toEasyEdaPoint(point: Point): Point {
    return {
        x: roundForMessage(point.x),
        y: roundForMessage(toEasyEdaY(point.y)),
    };
}

function toEasyEdaY(y: number) {
    return -y;
}

function dropEmpty(assemble: {
    board: BoardAssemble["board"];
    components: NonNullable<BoardAssemble["components"]>;
    tracks: NonNullable<BoardAssemble["tracks"]>;
    vias: NonNullable<BoardAssemble["vias"]>;
    pads: NonNullable<BoardAssemble["pads"]>;
    polygons: NonNullable<BoardAssemble["polygons"]>;
}): BoardAssemble {
    return {
        ...(assemble.board ? { board: assemble.board } : {}),
        ...(assemble.components.length > 0 ? { components: assemble.components } : {}),
        ...(assemble.tracks.length > 0 ? { tracks: assemble.tracks } : {}),
        ...(assemble.vias.length > 0 ? { vias: assemble.vias } : {}),
        ...(assemble.pads.length > 0 ? { pads: assemble.pads } : {}),
        ...(assemble.polygons.length > 0 ? { polygons: assemble.polygons } : {}),
    };
}
