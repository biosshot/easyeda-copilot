import * as z from "zod";
import { PcbPointSchema, PcbLayerNameSchema } from "./shared";

interface ExplainPcbOptions {
    forLLM: boolean
}

export const ExplainPcbBoxSchema = () => z.object({
    left: z.number(),
    right: z.number(),
    top: z.number(),
    bottom: z.number(),
}).strict();

// export const ExplainPcbPadRefSchema = () => z.object({
//     designator: z.string(),
//     pad: z.string(),
// }).strict();

export const ExplainPcbPadRefSchema = () => z.string();

export const ExplainPcbBoardSchema = () => z.object({
    polygon: z.array(PcbPointSchema()).min(3),
}).strict();

export const ExplainPcbComponentSchema = (opts?: ExplainPcbOptions) => z.object({
    designator: z.string(),
    value: z.string().optional(),
    footprint: z.string().optional(),
    x: z.number(),
    y: z.number(),
    rotate: z.number().optional(),
    layer: opts?.forLLM ? z.string() : PcbLayerNameSchema(),
    pads: z.array(z.object({
        pad: z.string(),
        net: z.string().optional(),
    }).strict()),
    nearest_components: z.array(z.object({
        designator: z.string(),
        distance: z.number(),
        x: z.number(),
        y: z.number(),
        layer: opts?.forLLM ? z.string() : PcbLayerNameSchema(),
    }).strict()).optional(),
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

export const ExplainPcbWireSchema = (opts?: ExplainPcbOptions) => z.object({
    net: z.string(),
    layer: z.array(opts?.forLLM ? z.string() : PcbLayerNameSchema()),
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

export const ExplainPcbPolygonSchema = (opts?: ExplainPcbOptions) => z.object({
    net: z.string(),
    layer: opts?.forLLM ? z.string() : PcbLayerNameSchema(),
    // points: z.array(PcbPointSchema()).min(3),
    cutouts: z.array(z.array(PcbPointSchema()).min(3)).optional(),
    area: z.number(),
    bbox: ExplainPcbBoxSchema(),
    connects: z.array(ExplainPcbPadRefSchema()),
    minWidth: z.number().optional(),
    narrowNecks: z.array(z.object({
        at: PcbPointSchema(),
        width: z.number(),
    }).strict()).optional(),
}).strict();

export const ExplainPcbLayer = (opts?: ExplainPcbOptions) => z.object({
    layer: opts?.forLLM ? z.string() : PcbLayerNameSchema(),
    type: z.string()
}).strict();

export const ExplainPcbSchema = (opts?: ExplainPcbOptions) => z.object({
    layers: z.array(ExplainPcbLayer(opts)).optional(),
    board: ExplainPcbBoardSchema().optional(),
    components: z.array(ExplainPcbComponentSchema(opts)),
    wires: z.array(ExplainPcbWireSchema(opts)).optional(),
    vias: z.array(ExplainPcbViaSchema()).optional(),
    polygons: z.array(ExplainPcbPolygonSchema(opts)).optional(),
}).strict();

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
