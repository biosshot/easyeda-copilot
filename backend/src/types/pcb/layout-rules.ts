import { zodWrapNullable } from "#utils/zod.ts";
import * as z from "zod";

const nullableSchema = <T extends z.ZodTypeAny>(schema: T) => zodWrapNullable(schema.nullable());

export const PCB_LAYERS = ["top", "bottom"] as const;
export const PCB_BOARD_PAD_LAYERS = ["top", "bottom", "multi"] as const;
export const PCB_BOARD_PAD_SHAPES = ["rect", "oval", "round"] as const;
export const PCB_BOARD_EDGES = ["left", "right", "top", "bottom"] as const;
export const PCB_MECHANICAL_FACE_DIRECTIONS = ["left", "right", "top", "bottom"] as const;
export const PCB_BOARD_FACE_DIRECTIONS = ["board.left", "board.right", "board.top", "board.bottom"] as const;
export const PCB_EDGE_MOUNT_FACES = ["outward", "inward", "any"] as const;
export const PCB_EDGE_MOUNT_ALIGNS = ["center", "start", "end"] as const;
export const PCB_RULE_LEVELS = ["low", "normal", "high", "critical"] as const;
export const PCB_PLACEMENT_COMPACTNESS = ["normal", "high"] as const;
export const PCB_COMPONENT_ROLES = ["connector", "main_ic", "decoupling_cap", "crystal", "passive", "indicator"] as const;
export const PCB_BLOCK_ROLES = ["power", "mcu", "analog", "rf", "connector", "sensor", "generic"] as const;
export const PCB_BLOCK_PLACEMENTS = ["main", "satellite"] as const;
export const PCB_CAP_CLUSTER_TOPOLOGIES = ["edge_bus", "center_power_bus"] as const;
export const PCB_TRACE_STYLES = ["orthogonal", "fortyfive", "free_angle"] as const;
export const PCB_ROUTE_MODES = ["route", "ignore"] as const;
export const PCB_BOARD_CORNERS = ["top_left", "top_right", "bottom_right", "bottom_left"] as const;
export const PCB_BOARD_NOTCH_SIDES = ["left", "right", "top", "bottom"] as const;

const LayerSchema = () => z.enum(PCB_LAYERS);
const MechanicalFaceDirectionSchema = () => z.enum(PCB_MECHANICAL_FACE_DIRECTIONS);
const BoardFaceDirectionSchema = () => z.enum(PCB_BOARD_FACE_DIRECTIONS);
const FaceDirectionSchema = () => z.union([MechanicalFaceDirectionSchema(), BoardFaceDirectionSchema()]);
const RuleLevelSchema = () => z.enum(PCB_RULE_LEVELS);

const FootprintPadSchema = () => z.object({
    pin_number: z.union([z.string(), z.number()]),
    name: nullableSchema(z.string()),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    shape: nullableSchema(z.enum(PCB_BOARD_PAD_SHAPES)),
    mount: nullableSchema(z.enum(["smd", "through_hole"])),
    drillDiameter: nullableSchema(z.number()),
});

const FootprintSchema = () => z.object({
    name: z.string(),
    width: z.number(),
    height: z.number(),
    pads: z.array(FootprintPadSchema()),
});

const BoardAnchorSchema = () => z.enum([
    "board.center",
    "board.left",
    "board.right",
    "board.top",
    "board.bottom",
    "board.top_left",
    "board.top_right",
    "board.bottom_left",
    "board.bottom_right",
]);
const BoardAnchorTargetRefSchema = () => z.object({
    type: z.literal("board_anchor"),
    anchor: BoardAnchorSchema(),
});
const PointOffsetSchema = () => z.object({
    x: nullableSchema(z.number()),
    y: nullableSchema(z.number()),
});
const FixedPlacementSchema = () => z.object({
    x: nullableSchema(z.number()),
    y: nullableSchema(z.number()),
    anchor: nullableSchema(BoardAnchorTargetRefSchema()),
    offset: nullableSchema(z.object({
        x: nullableSchema(z.number()),
        y: nullableSchema(z.number()),
    })),
    rotate: nullableSchema(z.number()),
    layer: nullableSchema(LayerSchema()),
});
const BoardHoleSchema = () => z.object({
    name: z.string(),
    at: BoardAnchorTargetRefSchema(),
    outlineCorner: nullableSchema(z.enum(PCB_BOARD_CORNERS)),
    inset: nullableSchema(z.number()),
    offset: nullableSchema(z.object({
        x: nullableSchema(z.number()),
        y: nullableSchema(z.number()),
    })),
    drill: z.number(),
    diameter: nullableSchema(z.number()),
    keepout: nullableSchema(z.number()),
});
const BoardOverflowAllowanceSchema = () => z.object({
    left: nullableSchema(z.number()),
    right: nullableSchema(z.number()),
    top: nullableSchema(z.number()),
    bottom: nullableSchema(z.number()),
});
const EdgeMountSchema = () => z.object({
    edge: z.enum(PCB_BOARD_EDGES),
    overhang: nullableSchema(z.number()),
    face: nullableSchema(z.union([z.enum(PCB_EDGE_MOUNT_FACES), MechanicalFaceDirectionSchema()])),
    align: nullableSchema(z.enum(PCB_EDGE_MOUNT_ALIGNS)),
    x: nullableSchema(z.number()),
    y: nullableSchema(z.number()),
    offset: nullableSchema(z.number()),
    layer: nullableSchema(LayerSchema()),
    slide: nullableSchema(z.boolean()),
});

const EdgePlaceSchema = () => z.object({
    edges: z.array(z.enum(PCB_BOARD_EDGES)).min(1),
    inset: nullableSchema(z.number()),
    face: nullableSchema(z.union([z.enum(PCB_EDGE_MOUNT_FACES), MechanicalFaceDirectionSchema()])),
    align: nullableSchema(z.enum(PCB_EDGE_MOUNT_ALIGNS)),
    x: nullableSchema(z.number()),
    y: nullableSchema(z.number()),
    offset: nullableSchema(z.number()),
    layer: nullableSchema(LayerSchema()),
});

const ConstraintRegionRectShapeSchema = () => z.object({
    type: z.literal("rect"),
    anchor: BoardAnchorTargetRefSchema(),
    width: z.number(),
    height: z.number(),
    offset: nullableSchema(z.object({
        x: nullableSchema(z.number()),
        y: nullableSchema(z.number()),
    })),
});

const ConstraintRegionSchema = () => z.object({
    name: z.string(),
    shape: ConstraintRegionRectShapeSchema(),
    layers: z.array(LayerSchema()).default([...PCB_LAYERS]),
    allow: z.object({
        blocks: z.array(z.string()).default([]),
    }).default({ blocks: [] }),
});

const BoardPadHoleSchema = () => z.object({
    diameter: z.number(),
    offset: nullableSchema(PointOffsetSchema()),
});

const BoardPadCellSchema = () => z.discriminatedUnion("shape", [
    z.object({
        name: z.string(),
        net: z.string(),
        shape: z.literal("round"),
        diameter: z.number(),
        hole: nullableSchema(BoardPadHoleSchema()).default(null),
    }),
    z.object({
        name: z.string(),
        net: z.string(),
        shape: z.enum(["rect", "oval"]),
        width: z.number(),
        height: z.number(),
        hole: nullableSchema(BoardPadHoleSchema()).default(null),
    }),
]);

const BoardPadSchema = () => z.object({
    name: z.string(),
    at: BoardAnchorTargetRefSchema(),
    offset: nullableSchema(PointOffsetSchema()),
    pitch: z.number(),
    rowPitch: z.number(),
    layer: z.enum(PCB_BOARD_PAD_LAYERS),
    block: nullableSchema(z.string()),
    pads: z.array(z.array(BoardPadCellSchema()).min(1)).min(1),
});

const ProceduralSizeLimitSchema = () => z.object({
    width: z.number(),
    height: z.number(),
});

const SolderJumperRuleSchema = () => z.object({
    kind: z.literal("solder_jumper"),
    name: z.string(),
    nets: z.array(z.string()).min(2).max(3),
    usage: z.enum(["configuration", "power"]),
    current: nullableSchema(z.number()),
    layer: LayerSchema(),
    block: nullableSchema(z.string()),
    at: nullableSchema(BoardAnchorTargetRefSchema()),
    offset: nullableSchema(PointOffsetSchema()),
});

const ThermalPadRuleSchema = () => z.object({
    kind: z.literal("thermal_pad"),
    name: z.string(),
    at: z.object({
        type: z.literal("pin"),
        designator: z.string(),
        pin_number: z.union([z.string(), z.number()]),
    }),
    dissipation: z.number(),
    maxTemperatureRise: z.number(),
    thetaJC: nullableSchema(z.number()),
    maxSize: nullableSchema(ProceduralSizeLimitSchema()),
});

const AntennaRuleSchema = () => z.object({
    kind: z.literal("antenna"),
    name: z.string(),
    net: z.string(),
    centerFrequency: z.number(),
    minBandwidth: nullableSchema(z.number()),
    impedance: z.number(),
    strategy: z.enum(["efficient", "balanced", "compact"]),
    topology: z.enum(["auto", "monopole", "meandered_monopole", "open_stub"]),
    maxSize: nullableSchema(ProceduralSizeLimitSchema()),
    layer: LayerSchema(),
    block: nullableSchema(z.string()),
});

const ProceduralFeatureRuleSchema = () => z.discriminatedUnion("kind", [
    SolderJumperRuleSchema(),
    ThermalPadRuleSchema(),
    AntennaRuleSchema(),
]);

const DesignatorTextOptionsSchema = () => z.object({
    enabled: nullableSchema(z.boolean()).default(null),
    height: nullableSchema(z.number()).default(null),
    rotations: nullableSchema(z.array(z.number())).default(null),
    margin: nullableSchema(z.number()).default(null),
});

const ComponentRuleSchema = () => z.object({
    designator: z.string(),
    block_name: nullableSchema(z.string()),
    role: nullableSchema(z.enum(PCB_COMPONENT_ROLES)),
    footprint: nullableSchema(FootprintSchema()),
    allowedLayers: nullableSchema(z.array(LayerSchema())),
    allowedRotations: nullableSchema(z.array(z.number())),
    fixedPlacement: nullableSchema(FixedPlacementSchema()),
    boardOverflow: nullableSchema(BoardOverflowAllowanceSchema()),
    edgeMount: nullableSchema(EdgeMountSchema()),
    edgePlace: nullableSchema(EdgePlaceSchema()),
    mechanicalFaceAt0: nullableSchema(FaceDirectionSchema()),
    faceTo: nullableSchema(FaceDirectionSchema()),
    designatorText: nullableSchema(DesignatorTextOptionsSchema()).default(null),
});

const TargetRefSchema = () => z.union([
    z.object({ type: z.literal("component"), designator: z.string() }),
    z.object({ type: z.literal("pin"), designator: z.string(), pin_number: z.union([z.string(), z.number()]) }),
    z.object({ type: z.literal("block"), block_name: z.string() }),
    BoardAnchorTargetRefSchema(),
]);
const PinTargetRefSchema = () => z.object({ type: z.literal("pin"), designator: z.string(), pin_number: z.union([z.string(), z.number()]) });

const SignalPathRelationMetadataSchema = () => z.object({
    id: z.string(),
    segmentIndex: z.number().int().nonnegative(),
    segmentCount: z.number().int().positive(),
    shape: z.enum(["flexible", "straight"]),
});

const SignalPathSegmentSchema = () => z.object({
    source: PinTargetRefSchema(),
    target: PinTargetRefSchema(),
    priority: RuleLevelSchema(),
    maxDistance: nullableSchema(z.number()),
    minDistance: nullableSchema(z.number()),
    weightMultiplier: nullableSchema(z.number()),
    hard: nullableSchema(z.boolean()),
    crossingPenalty: nullableSchema(z.number()),
    preferFacingPads: nullableSchema(z.boolean()),
});

const SignalPathSchema = () => z.object({
    id: z.string(),
    priority: RuleLevelSchema(),
    shape: z.enum(["flexible", "straight"]),
    preferFacingPads: z.boolean(),
    segments: z.array(SignalPathSegmentSchema()).min(1),
});

const RefineGroupSchema = () => z.object({
    name: z.string(),
    component_designators: z.array(z.string()).min(1),
    swap: z.boolean(),
    rotateBy: z.array(z.number()),
});

const BlockSchema = () => z.object({
    name: z.string(),
    description: nullableSchema(z.string()),
    component_designators: z.array(z.string()),
    role: nullableSchema(z.enum(PCB_BLOCK_ROLES)),
    placement: nullableSchema(z.enum(PCB_BLOCK_PLACEMENTS)),
    attachTo: nullableSchema(z.string()),
    anchor: nullableSchema(TargetRefSchema()),
    anchorOffset: nullableSchema(PointOffsetSchema()),
    sidePreference: nullableSchema(z.enum(PCB_BOARD_EDGES)),
    maxBboxScale: nullableSchema(z.number()),
    maxBboxWidth: nullableSchema(z.number()),
    maxBboxHeight: nullableSchema(z.number()),
    hardBbox: nullableSchema(z.boolean()),
    maxAnchorGap: nullableSchema(z.number()),
    hardAnchor: nullableSchema(z.boolean()),
    familyMaxBboxScale: nullableSchema(z.number()),
    familyMaxWidth: nullableSchema(z.number()),
    familyMaxHeight: nullableSchema(z.number()),
    familyHard: nullableSchema(z.boolean()),
    placementClearance: nullableSchema(z.number()),
    allowDisconnected: nullableSchema(z.boolean()).default(null),
});

const ModuleSchema = () => z.object({
    name: z.string(),
    block_names: z.array(z.string()),
    anchor: nullableSchema(TargetRefSchema()),
    sidePreference: nullableSchema(z.enum(PCB_BOARD_EDGES)),
    maxBboxScale: nullableSchema(z.number()),
    maxWidth: nullableSchema(z.number()),
    maxHeight: nullableSchema(z.number()),
    hardBbox: nullableSchema(z.boolean()),
    lockInternalAfterPlace: nullableSchema(z.boolean()),
    allowInternalRefine: nullableSchema(z.union([z.literal(false), z.literal("satellitesOnly"), z.literal("all")])),
    placementPriority: nullableSchema(RuleLevelSchema()),
});

const PlacementHintSchema = () => z.union([
    z.object({
        relation: z.enum(["very_near", "near", "away_from", "same_side", "cluster_with"]),
        source: TargetRefSchema(),
        target: TargetRefSchema(),
        priority: RuleLevelSchema(),
    }),
    z.object({
        relation: z.literal("clearance"),
        source: TargetRefSchema(),
        target: z.union([TargetRefSchema(), z.literal("all")]),
        min: z.number(),
        priority: RuleLevelSchema(),
    }),
    z.object({
        relation: z.literal("edge"),
        source: z.union([
            z.object({ type: z.literal("component"), designator: z.string() }),
            z.object({ type: z.literal("block"), block_name: z.string() }),
        ]),
        edge: z.enum(PCB_BOARD_EDGES),
        orientation: nullableSchema(z.enum(PCB_EDGE_MOUNT_FACES)),
        priority: RuleLevelSchema(),
    }),
    z.object({
        relation: z.literal("prefer_layer"),
        source: z.union([
            z.object({ type: z.literal("component"), designator: z.string() }),
            z.object({ type: z.literal("block"), block_name: z.string() }),
        ]),
        layer: LayerSchema(),
        priority: RuleLevelSchema(),
    }),
    z.object({
        relation: z.literal("line"),
        components: z.array(z.string()),
        axis: z.enum(["x", "y"]),
        gap: nullableSchema(z.number()),
        rotate: nullableSchema(z.number()),
        priority: RuleLevelSchema(),
    }),
    z.object({
        relation: z.literal("bypass"),
        capacitors: z.array(z.string()),
        target: PinTargetRefSchema(),
        axis: nullableSchema(z.enum(["x", "y"])),
        gap: nullableSchema(z.number()),
        rotate: nullableSchema(z.number()),
        priority: RuleLevelSchema(),
    }),
    z.object({
        relation: z.literal("cap_cluster"),
        capacitors: z.array(z.string()).min(2),
        powerNet: z.string(),
        returnNet: z.string(),
        target: nullableSchema(PinTargetRefSchema()),
        axis: nullableSchema(z.enum(["x", "y"])),
        maxRows: nullableSchema(z.union([z.literal(1), z.literal(2)])),
        maxPerRow: nullableSchema(z.number()),
        gap: nullableSchema(z.number()),
        rowGap: nullableSchema(z.number()),
        topology: nullableSchema(z.enum(PCB_CAP_CLUSTER_TOPOLOGIES)),
        priority: RuleLevelSchema(),
    }),
    z.object({
        relation: z.literal("critical_pair"),
        source: PinTargetRefSchema(),
        target: PinTargetRefSchema(),
        priority: RuleLevelSchema(),
        maxDistance: nullableSchema(z.number()),
        minDistance: nullableSchema(z.number()),
        weightMultiplier: nullableSchema(z.number()),
        hard: nullableSchema(z.boolean()),
        crossingPenalty: nullableSchema(z.number()),
        preferFacingPads: nullableSchema(z.boolean()),
        core: nullableSchema(z.boolean()),
        block: nullableSchema(z.string()),
        path: nullableSchema(SignalPathRelationMetadataSchema()),
    }),
]);

const BoardSchema = () => {
    const BoardCommonSchema = {
        componentClearance: nullableSchema(z.number()),
        edgeClearance: nullableSchema(z.number()),
        allowedLayers: nullableSchema(z.array(LayerSchema())),
        defaultLayer: nullableSchema(LayerSchema()),
    };
    const PointSchema = z.object({ x: z.number(), y: z.number() });
    return z.discriminatedUnion("type", [
        z.object({
            type: z.literal("auto"),
            aspectRatio: nullableSchema(z.number()),
            componentDensity: nullableSchema(z.number()),
            minWidth: nullableSchema(z.number()),
            minHeight: nullableSchema(z.number()),
            maxWidth: nullableSchema(z.number()),
            maxHeight: nullableSchema(z.number()),
            ...BoardCommonSchema,
        }),
        z.object({
            type: z.literal("rect"),
            width: z.number(),
            height: z.number(),
            ...BoardCommonSchema,
        }),
        z.object({
            type: z.literal("polygon"),
            points: z.array(PointSchema).min(3),
            ...BoardCommonSchema,
        }),
        z.object({
            type: z.literal("roundedRect"),
            width: z.number(),
            height: z.number(),
            radius: nullableSchema(z.number()),
            segments: nullableSchema(z.number()),
            ...BoardCommonSchema,
        }),
        z.object({
            type: z.literal("chamferedRect"),
            width: z.number(),
            height: z.number(),
            chamfer: nullableSchema(z.number()),
            ...BoardCommonSchema,
        }),
        z.object({
            type: z.literal("notchedRect"),
            width: z.number(),
            height: z.number(),
            side: nullableSchema(z.enum(PCB_BOARD_NOTCH_SIDES)),
            notchWidth: z.number(),
            notchDepth: z.number(),
            offset: nullableSchema(z.number()),
            ...BoardCommonSchema,
        }),
        z.object({
            type: z.literal("circle"),
            diameter: z.number(),
            segments: nullableSchema(z.number()),
            ...BoardCommonSchema,
        }),
        z.object({
            type: z.literal("oval"),
            width: z.number(),
            height: z.number(),
            segments: nullableSchema(z.number()),
            ...BoardCommonSchema,
        }),
        z.object({
            type: z.literal("L"),
            width: z.number(),
            height: z.number(),
            cutoutWidth: z.number(),
            cutoutHeight: z.number(),
            corner: nullableSchema(z.enum(PCB_BOARD_CORNERS)),
            ...BoardCommonSchema,
        }),
        z.object({
            type: z.literal("inverseL"),
            width: z.number(),
            height: z.number(),
            legWidth: z.number(),
            legHeight: z.number(),
            corner: nullableSchema(z.enum(PCB_BOARD_CORNERS)),
            ...BoardCommonSchema,
        }),
    ]);
}

export const SolverOptionsSchema = () => z.object({
    candidateRadii: nullableSchema(z.array(z.number())),
    candidateAngles: nullableSchema(z.array(z.number())),
    fallbackGridStep: nullableSchema(z.number()),
    placementGridStep: nullableSchema(z.number()),
    ignoredRatsnestSignals: nullableSchema(z.array(z.string())),
    localImproveIterations: nullableSchema(z.number()),
    localImproveMinDelta: nullableSchema(z.number()),
    hierarchicalBlocks: nullableSchema(z.boolean()),
    compactness: nullableSchema(z.enum(PCB_PLACEMENT_COMPACTNESS)),
    preview: nullableSchema(z.boolean()),
    placeOnlyComponents: nullableSchema(z.array(z.string())),
    ignoreComponents: nullableSchema(z.array(z.string())),
});

const PreserveSchema = () => z.object({
    board: z.boolean().optional(),
    components: z.union([
        z.literal('all'),
        z.array(z.string()),
    ]).optional(),
});

export const PlacementRulesSchema = () => z.object({
    board: BoardSchema(),
    preserve: PreserveSchema().optional(),
    boardHoles: z.array(BoardHoleSchema()).default([]),
    boardPads: z.array(BoardPadSchema()).default([]),
    proceduralFeatures: z.array(ProceduralFeatureRuleSchema()).default([]),
    constraintRegions: z.array(ConstraintRegionSchema()).default([]),
    silkscreen: nullableSchema(z.object({
        designators: nullableSchema(DesignatorTextOptionsSchema()).default(null),
    })).default(null),
    blocks: z.array(BlockSchema()),
    modules: z.array(ModuleSchema()).default([]),
    component_rules: z.array(ComponentRuleSchema()),
    hints: z.array(PlacementHintSchema()),
    paths: z.array(SignalPathSchema()).default([]),
    refineGroups: z.array(RefineGroupSchema()).default([]),
    solverOptions: nullableSchema(SolverOptionsSchema()),
});

const RoutingStitchOptionsSchema = () => z.object({
    grid: nullableSchema(z.number()),
    diameter: nullableSchema(z.number()),
    drill: nullableSchema(z.number()),
    clearance: nullableSchema(z.number()),
    edge: nullableSchema(z.number()),
    maxCount: nullableSchema(z.number()),
});

const RoutingPolygonRuleSchema = () => z.object({
    net: z.string(),
    kind: z.enum(["polygon", "power_polygon"]),
    around: nullableSchema(TargetRefSchema()),
    margin: nullableSchema(z.number()),
    connect: z.array(PinTargetRefSchema()).default([]),
    expansion: nullableSchema(z.number()),
    clearance: nullableSchema(z.number()),
    minWidth: nullableSchema(z.number()),
    minArea: nullableSchema(z.number()),
    minPadConnections: nullableSchema(z.number()),
    style: nullableSchema(z.enum(["compact", "smooth", "orthogonal45"])),
    cleanup: nullableSchema(z.enum(["none", "normal", "strong"])),
    stitch: nullableSchema(RoutingStitchOptionsSchema()),
});

const RoutingIntentSchema = () => z.object({
    profile: RuleLevelSchema(),
    preferredTraceStyle: nullableSchema(z.enum(PCB_TRACE_STYLES)),
    completionPriority: nullableSchema(RuleLevelSchema()),
    compactnessPriority: nullableSchema(RuleLevelSchema()),
    viaAvoidance: nullableSchema(RuleLevelSchema()),
    cleanupLevel: nullableSchema(RuleLevelSchema()),
    defaultTraceWidthMm: nullableSchema(z.number()),
    defaultClearanceMm: nullableSchema(z.number()),
    defaultViaDiameterMm: nullableSchema(z.number()),
    defaultViaDrillMm: nullableSchema(z.number()),
    stitchRules: z.array(z.object({
        net: z.string(),
        grid: nullableSchema(z.number()),
        diameter: nullableSchema(z.number()),
        drill: nullableSchema(z.number()),
        clearance: nullableSchema(z.number()),
        edge: nullableSchema(z.number()),
        maxCount: nullableSchema(z.number()),
        around: nullableSchema(TargetRefSchema()),
        margin: nullableSchema(z.number()),
    })).default([]),
    polygonRules: z.array(RoutingPolygonRuleSchema()).default([]),
    netClasses: z.array(z.object({
        name: z.string(),
        signals: z.array(z.string()),
        traceWidthMm: nullableSchema(z.number()),
        clearanceMm: nullableSchema(z.number()),
        viaAvoidance: nullableSchema(RuleLevelSchema()),
        zIndex: nullableSchema(z.number()),
        routeMode: nullableSchema(z.enum(PCB_ROUTE_MODES)),
    })),
});

export const RoutingRulesSchema = () => z.object({
    routingIntent: nullableSchema(RoutingIntentSchema()),
    runRouter: z.boolean(),
    designName: nullableSchema(z.string()),
});

export const LayoutRulesSchema = () => PlacementRulesSchema().extend({
});

export type PlacementRules = z.infer<ReturnType<typeof PlacementRulesSchema>>
export type RoutingRules = z.infer<ReturnType<typeof RoutingRulesSchema>>
export type SolverOptions = z.infer<ReturnType<typeof SolverOptionsSchema>>
export type Preserve = z.infer<ReturnType<typeof PreserveSchema>>
export type EdgeMount = z.infer<ReturnType<typeof EdgeMountSchema>>
export type EdgePlace = z.infer<ReturnType<typeof EdgePlaceSchema>>
export type FaceDirection = z.infer<ReturnType<typeof FaceDirectionSchema>>
export type BoardHoleRule = z.infer<ReturnType<typeof BoardHoleSchema>>
export type BoardPadRule = z.infer<ReturnType<typeof BoardPadSchema>>
export type ProceduralFeatureRule = z.infer<ReturnType<typeof ProceduralFeatureRuleSchema>>
export type SolderJumperRule = z.infer<ReturnType<typeof SolderJumperRuleSchema>>
export type ThermalPadRule = z.infer<ReturnType<typeof ThermalPadRuleSchema>>
export type AntennaRule = z.infer<ReturnType<typeof AntennaRuleSchema>>
export type ConstraintRegionRule = z.infer<ReturnType<typeof ConstraintRegionSchema>>
export type DesignatorTextOptions = z.infer<ReturnType<typeof DesignatorTextOptionsSchema>>

export type ComponentRule = z.infer<ReturnType<typeof ComponentRuleSchema>>
export type Footprint = z.infer<ReturnType<typeof FootprintSchema>>
export type FixedPlacement = z.infer<ReturnType<typeof FixedPlacementSchema>>
export type BoardOverflowAllowance = z.infer<ReturnType<typeof BoardOverflowAllowanceSchema>>
export type Board = z.infer<ReturnType<typeof BoardSchema>>
export type Block = z.infer<ReturnType<typeof BlockSchema>>
export type Module = z.infer<ReturnType<typeof ModuleSchema>>
export type SignalPathRule = z.infer<ReturnType<typeof SignalPathSchema>>
export type RefineGroupRule = z.infer<ReturnType<typeof RefineGroupSchema>>
