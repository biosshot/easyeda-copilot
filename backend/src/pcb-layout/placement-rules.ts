import type {
    BoardEdge,
    FootprintSpec,
    MechanicalFaceDirection,
    PcbComponent,
    PcbEdgeMountOptions,
    PcbEdgePlaceOptions,
    PlacementInput,
} from "#types/pcb/layout-model.ts";
import type { ComponentRule, EdgeMount, EdgePlace, FaceDirection } from "#types/pcb/layout-rules.ts";
import { normalizeRotation } from "#utils/math.ts";

export function applyEdgeMountPlacement(
    component: PcbComponent,
    rule: ComponentRule | undefined,
    board: PlacementInput["board"],
): PcbComponent {
    const edgeMount = component.pcb.edgeMount;
    if (!edgeMount) return component;
    if (rule?.fixedPlacement && edgeMount.slide !== true) {
        throw new Error(`${component.designator}: use either edgeMount(...) or fixed(...), not both. edgeMount already computes fixed placement.`);
    }

    const boardOverflow = mergeBoardOverflowAllowance(
        component.pcb.boardOverflow,
        boardOverflowAllowanceForEdge(edgeMount.edge, Math.max(0, edgeMount.overhang ?? 0)),
    );
    if (edgeMount.slide === true) {
        return {
            ...component,
            pcb: {
                ...component.pcb,
                boardOverflow,
                edgeMount,
            },
        };
    }

    const rotate = normalizeRotation(component.pcb.allowedRotations[0] ?? 0);
    const halfSize = rotatedHalfSize(component.footprint, rotate);
    const boardBounds = boardBoundsBox(board);
    const overhang = Math.max(0, edgeMount.overhang ?? 0);
    const crossOffset = edgeMount.offset ?? 0;
    const fixedPlacement = edgeMount.edge === "left" || edgeMount.edge === "right"
        ? {
            x: edgeMount.edge === "left"
                ? boardBounds.left - overhang + halfSize.width
                : boardBounds.right + overhang - halfSize.width,
            y: (edgeMount.y ?? alignedCrossCoordinate(edgeMount.edge, edgeMount.align ?? "center", boardBounds, halfSize, board.clearances.edge)) + crossOffset,
            rotate,
            layer: edgeMount.layer ?? component.pcb.allowedLayers[0] ?? board.defaultLayer,
        }
        : {
            x: (edgeMount.x ?? alignedCrossCoordinate(edgeMount.edge, edgeMount.align ?? "center", boardBounds, halfSize, board.clearances.edge)) + crossOffset,
            y: edgeMount.edge === "top"
                ? boardBounds.top - overhang + halfSize.height
                : boardBounds.bottom + overhang - halfSize.height,
            rotate,
            layer: edgeMount.layer ?? component.pcb.allowedLayers[0] ?? board.defaultLayer,
        };

    return {
        ...component,
        pcb: {
            ...component.pcb,
            fixedPlacement,
            boardOverflow,
            edgeMount,
        },
    };
}

export function applyEdgePlacePlacement(
    component: PcbComponent,
    rule: ComponentRule | undefined,
    board: PlacementInput["board"],
): PcbComponent {
    const edgePlace = component.pcb.edgePlace;
    if (!edgePlace || edgePlace.edges.length !== 1) return component;
    const edge = edgePlace.edges[0];
    const hasExactCross = edge === "left" || edge === "right"
        ? typeof edgePlace.y === "number"
        : typeof edgePlace.x === "number";
    if (!hasExactCross) return component;
    if (rule?.fixedPlacement) {
        throw new Error(`${component.designator}: use either edgePlace(...) with exact x/y or fixed(...), not both. edgePlace already computes fixed placement.`);
    }

    const rotate = normalizeRotation(component.pcb.allowedRotations[0] ?? 0);
    const halfSize = rotatedHalfSize(component.footprint, rotate);
    const boardBounds = boardBoundsBox(board);
    const inset = Math.max(0, edgePlace.inset ?? 0);
    const crossOffset = edgePlace.offset ?? 0;
    const fixedPlacement = edge === "left" || edge === "right"
        ? {
            x: edge === "left"
                ? boardBounds.left + inset + halfSize.width
                : boardBounds.right - inset - halfSize.width,
            y: (edgePlace.y ?? 0) + crossOffset,
            rotate,
            layer: edgePlace.layer ?? component.pcb.allowedLayers[0] ?? board.defaultLayer,
        }
        : {
            x: (edgePlace.x ?? 0) + crossOffset,
            y: edge === "top"
                ? boardBounds.top + inset + halfSize.height
                : boardBounds.bottom - inset - halfSize.height,
            rotate,
            layer: edgePlace.layer ?? component.pcb.allowedLayers[0] ?? board.defaultLayer,
        };

    return {
        ...component,
        pcb: {
            ...component.pcb,
            fixedPlacement,
            edgePlace,
        },
    };
}

export function normalizeEdgeMountRule(edgeMount: EdgeMount | null | undefined): PcbEdgeMountOptions | undefined {
    if (!edgeMount) return undefined;
    return {
        edge: edgeMount.edge,
        overhang: edgeMount.overhang ?? undefined,
        face: edgeMount.face ?? undefined,
        align: edgeMount.align ?? undefined,
        x: edgeMount.x ?? undefined,
        y: edgeMount.y ?? undefined,
        offset: edgeMount.offset ?? undefined,
        layer: edgeMount.layer ?? undefined,
        slide: edgeMount.slide ?? undefined,
    };
}

export function normalizeEdgePlaceRule(edgePlace: EdgePlace | null | undefined): PcbEdgePlaceOptions | undefined {
    if (!edgePlace) return undefined;
    return {
        edges: [...new Set(edgePlace.edges)],
        inset: edgePlace.inset ?? undefined,
        face: edgePlace.face ?? undefined,
        align: edgePlace.align ?? undefined,
        x: edgePlace.x ?? undefined,
        y: edgePlace.y ?? undefined,
        offset: edgePlace.offset ?? undefined,
        layer: edgePlace.layer ?? undefined,
    };
}

export function applyFaceToRotationConstraint(input: {
    designator: string;
    footprint: FootprintSpec;
    allowedRotations: number[];
    faceAt0?: MechanicalFaceDirection | null;
    faceTo?: MechanicalFaceDirection | null;
    fixedRotate?: number;
}) {
    const allowedRotations = normalizeAllowedRotations(input.allowedRotations);
    const faceTo = input.faceTo ?? undefined;
    if (!faceTo) {
        return { allowedRotations };
    }

    const explicitFaceAt0 = input.faceAt0 ?? undefined;
    const faceAt0 = explicitFaceAt0 ?? detectFaceAt0ByPads(input.footprint);
    const source = explicitFaceAt0 ? "explicit" as const : "auto_pads" as const;
    const targetRotation = rotationToFace(faceAt0, faceTo);
    const effectiveAllowedRotations = allowedRotations.filter((rotation) => normalizeRotation(rotation) === targetRotation);
    const warning = source === "auto_pads"
        ? `${input.designator}: faceAt0 auto-detected from footprint pads as ${faceAt0}; verify connector/mechanical opening direction.`
        : undefined;

    if (typeof input.fixedRotate === "number" && normalizeRotation(input.fixedRotate) !== targetRotation) {
        throw new Error(`faceTo conflict for ${input.designator}: faceAt0=${faceAt0}, faceTo=${faceTo} requires rotate ${targetRotation}, but fixed rotate is ${input.fixedRotate}.`);
    }
    if (effectiveAllowedRotations.length === 0) {
        throw new Error(`faceTo conflict for ${input.designator}: faceAt0=${faceAt0}, faceTo=${faceTo} requires rotate ${targetRotation}, but allowed rotations are [${allowedRotations.join(", ")}].`);
    }

    return {
        allowedRotations: effectiveAllowedRotations,
        faceAt0,
        source,
        faceTo,
        warning,
    };
}

export function normalizeFaceDirection(value: FaceDirection | null | undefined): MechanicalFaceDirection | undefined {
    if (value === "board.left") return "left";
    if (value === "board.right") return "right";
    if (value === "board.top") return "top";
    if (value === "board.bottom") return "bottom";
    return value ?? undefined;
}

function rotatedHalfSize(footprint: FootprintSpec, rotate: number) {
    const radians = rotate * Math.PI / 180;
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    return {
        width: (footprint.width * cos + footprint.height * sin) / 2,
        height: (footprint.width * sin + footprint.height * cos) / 2,
    };
}

function boardBoundsBox(board: PlacementInput["board"]) {
    return {
        left: -board.outline.width / 2,
        right: board.outline.width / 2,
        top: -board.outline.height / 2,
        bottom: board.outline.height / 2,
    };
}

function alignedCrossCoordinate(
    edge: BoardEdge,
    align: NonNullable<PcbEdgeMountOptions["align"]>,
    boardBounds: ReturnType<typeof boardBoundsBox>,
    halfSize: ReturnType<typeof rotatedHalfSize>,
    edgeClearance: number,
) {
    if (align === "center") return 0;
    if (edge === "top" || edge === "bottom") {
        return align === "start"
            ? boardBounds.left + halfSize.width + edgeClearance
            : boardBounds.right - halfSize.width - edgeClearance;
    }
    return align === "start"
        ? boardBounds.top + halfSize.height + edgeClearance
        : boardBounds.bottom - halfSize.height - edgeClearance;
}

function mergeBoardOverflowAllowance(
    current: PcbComponent["pcb"]["boardOverflow"] | undefined,
    next: PcbComponent["pcb"]["boardOverflow"],
) {
    return {
        left: Math.max(current?.left ?? 0, next?.left ?? 0),
        right: Math.max(current?.right ?? 0, next?.right ?? 0),
        top: Math.max(current?.top ?? 0, next?.top ?? 0),
        bottom: Math.max(current?.bottom ?? 0, next?.bottom ?? 0),
    };
}

function boardOverflowAllowanceForEdge(edge: BoardEdge, value: number): PcbComponent["pcb"]["boardOverflow"] {
    return {
        left: edge === "left" ? value : 0,
        right: edge === "right" ? value : 0,
        top: edge === "top" ? value : 0,
        bottom: edge === "bottom" ? value : 0,
    };
}

function normalizeAllowedRotations(rotations: number[]) {
    const normalized = [...new Map(rotations.map((rotation) => [normalizeRotation(rotation), rotation])).values()];
    return normalized.length > 0 ? normalized : [0];
}

function rotationToFace(faceAt0: MechanicalFaceDirection, faceTo: MechanicalFaceDirection) {
    return normalizeRotation(directionAngle(faceTo) - directionAngle(faceAt0));
}

function directionAngle(direction: MechanicalFaceDirection) {
    if (direction === "right") return 0;
    if (direction === "bottom") return 90;
    if (direction === "left") return 180;
    return 270;
}

function detectFaceAt0ByPads(footprint: FootprintSpec): MechanicalFaceDirection {
    if (footprint.pads.length === 0) return "right";

    const avg = footprint.pads.reduce((sum, pad) => ({
        x: sum.x + pad.x,
        y: sum.y + pad.y,
    }), { x: 0, y: 0 });
    const avgX = avg.x / footprint.pads.length;
    const avgY = avg.y / footprint.pads.length;
    if (Math.abs(avgX) >= Math.abs(avgY) && Math.abs(avgX) > 0.05) {
        return avgX > 0 ? "left" : "right";
    }
    if (Math.abs(avgY) > 0.05) {
        return avgY > 0 ? "top" : "bottom";
    }

    const padBox = footprint.pads.reduce((box, pad) => ({
        left: Math.min(box.left, pad.x - pad.width / 2),
        right: Math.max(box.right, pad.x + pad.width / 2),
        top: Math.min(box.top, pad.y - pad.height / 2),
        bottom: Math.max(box.bottom, pad.y + pad.height / 2),
    }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
    const body = {
        left: -footprint.width / 2,
        right: footprint.width / 2,
        top: -footprint.height / 2,
        bottom: footprint.height / 2,
    };
    const margins: Array<{ direction: MechanicalFaceDirection; value: number }> = [
        { direction: "left", value: padBox.left - body.left },
        { direction: "right", value: body.right - padBox.right },
        { direction: "top", value: padBox.top - body.top },
        { direction: "bottom", value: body.bottom - padBox.bottom },
    ];
    return margins.sort((a, b) => b.value - a.value)[0]?.direction ?? "right";
}
