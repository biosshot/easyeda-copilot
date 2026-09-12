import * as z from "zod";
import { ExplainPcbBoardSchema, ExplainPcbBoxSchema, ExplainPcbViaSchema } from "./explain";
import { PcbLayerNameSchema } from "./shared";

export const RawPcbBoardSchema = ExplainPcbBoardSchema;
export const RawPcbViaSchema = ExplainPcbViaSchema;
export const RawPcbBoxSchema = ExplainPcbBoxSchema;

export const RawPcbComponentSchema = () => z.object({
    designator: z.string(),
    x: z.number(),
    y: z.number(),
    rotate: z.number(),
    layer: PcbLayerNameSchema(),
    bbox: RawPcbBoxSchema().optional()
});

export const RawPcbPadSchema = () => z.object({
    /** Stable editor primitive id when the source format exposes one. */
    id: z.string().optional(),
    /** Owning component designator, e.g. U1. Optional for backwards compatibility. */
    component: z.string().optional(),
    x: z.number(),
    y: z.number(),
    net: z.string(),
    padNumber: z.string(),
    layer: PcbLayerNameSchema(),
    shape: z.array(z.union([
        z.number(),
        z.string(),
        z.array(z.union([z.number(), z.string()])),
        z.array(z.array(z.union([z.number(), z.string()])))
    ])).optional(),
    /** Native EasyEDA pad rotation in radians. */
    rotation: z.number(),
    hole: z.object({
        data: z.array(z.string().or(z.number())),
        /** Pad-local hole offset, normalized to millimetres. */
        offsetX: z.number(),
        offsetY: z.number(),
        /** Native EasyEDA hole rotation relative to the pad, in radians. */
        rotation: z.number(),
    }).optional()
});

export const RawPcbTrackSchema = () => z.object({
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
    width: z.number(),
    layer: PcbLayerNameSchema(),
    net: z.string(),
});

export const RawPcbArcSchema = () => z.object({
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
    arcAngle: z.number(),
    width: z.number(),
    layer: PcbLayerNameSchema(),
    net: z.string(),
});

export const RawPcbPolygonSchema = () => z.object({
    net: z.string(),
    layer: PcbLayerNameSchema(),
    fill: z.boolean(),
    lineWidth: z.number(),
    sources: z.array(z.array(z.union([z.number(), z.string()])))
});

export const RawPcbSchema = () => z.object({
    board: RawPcbBoardSchema().optional(),
    components: z.array(RawPcbComponentSchema()),
    pads: z.array(RawPcbPadSchema()),
    tracks: z.array(RawPcbTrackSchema()),
    arcs: z.array(RawPcbArcSchema()),
    vias: z.array(RawPcbViaSchema()),
    polygons: z.array(RawPcbPolygonSchema()),
});

export type RawPcb = z.infer<ReturnType<typeof RawPcbSchema>>;
export type RawPcbPolygon = z.infer<ReturnType<typeof RawPcbPolygonSchema>>;
export type RawPcbArc = z.infer<ReturnType<typeof RawPcbArcSchema>>;
export type RawPcbTrack = z.infer<ReturnType<typeof RawPcbTrackSchema>>;
export type RawPcbPad = z.infer<ReturnType<typeof RawPcbPadSchema>>;
export type RawPcbComponent = z.infer<ReturnType<typeof RawPcbComponentSchema>>;
export type RawPcbVia = z.infer<ReturnType<typeof RawPcbViaSchema>>;
export type RawPcbBoard = z.infer<ReturnType<typeof RawPcbBoardSchema>>;
