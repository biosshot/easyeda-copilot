import * as z from "zod";

export const ExplainPcbPointSchema = () => z.object({
    x: z.number(),
    y: z.number(),
}).strict();

export const ExplainPcbBoxSchema = () => z.object({
    left: z.number(),
    right: z.number(),
    top: z.number(),
    bottom: z.number(),
}).strict();

export const ExplainPcbPadRefSchema = () => z.object({
    designator: z.string(),
    pad_number: z.string(),
}).strict();

export const ExplainPcbLayerSchema = () => z.enum(["top", "bottom"]);
export const ExplainPcbWireLayerSchema = () => z.enum(["top", "bottom", "mixed"]);

export const ExplainPcbBoardSchema = () => z.object({
    polygon: z.array(ExplainPcbPointSchema()).min(3),
}).strict();

export const ExplainPcbComponentSchema = () => z.object({
    designator: z.string(),
    part_uuid: z.string().optional(),
    value: z.string().optional(),
    footprint: z.string().optional(),
    x: z.number(),
    y: z.number(),
    rotate: z.number(),
    layer: ExplainPcbLayerSchema(),
    pads: z.array(z.object({
        pad_number: z.string(),
        signal_name: z.string().optional(),
    }).strict()),
}).strict();

export const SimplifiedDrcViolationSchema = () => z.object({
    errorType: z.string(),
    obj1: z.string().optional(),
    obj2: z.string().optional(),
    message: z.string(),
}).strict();

export const SimplifiedDrcCategorySchema = () => z.object({
    name: z.string(),
    list: z.array(z.object({
        name: z.string(),
        list: z.array(SimplifiedDrcViolationSchema()),
    }).strict()),
}).strict();

export const ExplainPcbWireSchema = () => z.object({
    net: z.string(),
    layer: ExplainPcbWireLayerSchema(),
    connected_pads: z.array(ExplainPcbPadRefSchema()),
    length: z.number(),
    direct_distance: z.number().optional(),
    detour_ratio: z.number().optional(),
    vias: z.number(),
    width: z.object({
        min: z.number(),
        max: z.number(),
    }).strict(),
    segments: z.number(),
    bbox: ExplainPcbBoxSchema(),
    drc_violations: z.array(SimplifiedDrcViolationSchema()).optional(),
}).strict();

export const ExplainPcbViaSchema = () => z.object({
    net: z.string().optional(),
    x: z.number(),
    y: z.number(),
    diameter: z.number(),
    drill: z.number(),
}).strict();

export const ExplainPcbPolygonSchema = () => z.object({
    net: z.string(),
    layer: ExplainPcbLayerSchema(),
    points: z.array(ExplainPcbPointSchema()).min(3),
    cutouts: z.array(z.array(ExplainPcbPointSchema()).min(3)).optional(),
    area: z.number(),
    bbox: ExplainPcbBoxSchema(),
    connects: z.array(ExplainPcbPadRefSchema()),
    minWidth: z.number().optional(),
    narrowNecks: z.array(z.object({
        at: ExplainPcbPointSchema(),
        width: z.number(),
    }).strict()).optional(),
}).strict();

export const ExplainPcbSchema = () => z.object({
    board: ExplainPcbBoardSchema().optional(),
    components: z.array(ExplainPcbComponentSchema()),
    wires: z.array(ExplainPcbWireSchema()).optional(),
    vias: z.array(ExplainPcbViaSchema()).optional(),
    polygons: z.array(ExplainPcbPolygonSchema()).optional(),
}).strict();

export type ExplainPcbPoint = z.infer<ReturnType<typeof ExplainPcbPointSchema>>;
export type ExplainPcbBox = z.infer<ReturnType<typeof ExplainPcbBoxSchema>>;
export type ExplainPcbPadRef = z.infer<ReturnType<typeof ExplainPcbPadRefSchema>>;
export type ExplainPcbBoard = z.infer<ReturnType<typeof ExplainPcbBoardSchema>>;
export type ExplainPcbComponent = z.infer<ReturnType<typeof ExplainPcbComponentSchema>>;
export type ExplainPcbWire = z.infer<ReturnType<typeof ExplainPcbWireSchema>>;
export type SimplifiedDrcViolation = z.infer<ReturnType<typeof SimplifiedDrcViolationSchema>>;
export type ExplainPcbVia = z.infer<ReturnType<typeof ExplainPcbViaSchema>>;
export type ExplainPcbPolygon = z.infer<ReturnType<typeof ExplainPcbPolygonSchema>>;
export type ExplainPCB = z.infer<ReturnType<typeof ExplainPcbSchema>>;
export type SimplifiedDrcCategory = z.infer<ReturnType<typeof SimplifiedDrcCategorySchema>>;
export type SimplifiedDrcResult = SimplifiedDrcCategory[];
