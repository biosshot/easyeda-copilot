import * as z from "zod";
import { ExplainPcbBoardSchema, ExplainPcbBoxSchema, ExplainPcbViaSchema } from "./explain";
import { PcbLayerNameSchema } from "./shared";
import { PartUuidStruct } from "../lcsc";

export const RawPcbBoardSchema = ExplainPcbBoardSchema;
export const RawPcbViaSchema = ExplainPcbViaSchema;
export const RawPcbBoxSchema = ExplainPcbBoxSchema;

export const RawPcbComponentSchema = () => z.object({
    id: z.string().optional(),
    value: z.string().optional(),
    partUuid: PartUuidStruct().optional(),
    footprintName: z.string().optional(),
    designator: z.string(),
    x: z.number(),
    y: z.number(),
    rotate: z.number(),
    layer: PcbLayerNameSchema(),
    bbox: RawPcbBoxSchema().optional()
});

export const RawPcbPadSchema = () => z.object({
    plated: z.boolean().optional(),
    specialPad: z.array(z.tuple([z.number(), z.number(), z.array(z.unknown())])).optional(),
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
    id: z.string().optional(),
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
    width: z.number(),
    layer: PcbLayerNameSchema(),
    net: z.string(),
});

export const RawPcbArcSchema = () => z.object({
    id: z.string().optional(),
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
    id: z.string().optional(),
    pourId: z.string().optional(),
    fillMode: z.number().optional(),
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
    vias: z.array(RawPcbViaSchema().extend({
        id: z.string().optional(),
        viaType: z.number().optional(),
        blindViaRule: z.string().nullable().optional(),
    })),
    polygons: z.array(RawPcbPolygonSchema()),
    /** Additional native evidence requested only by RoutingBoard V2 export. */
    routing: z.object({
        layers: z.array(z.string()),
        planeLayers: z.array(z.string()),
        polylines: z.array(RawPcbPolygonSchema()),
        outlines: z.array(z.array(z.union([z.number(), z.string()]))),
        pours: z.array(RawPcbPolygonSchema().extend({
            priority: z.number(),
            preserveIslands: z.boolean(),
            pouredIds: z.array(z.string()),
        })),
    }).optional(),
});

export type RawPcb = z.infer<ReturnType<typeof RawPcbSchema>>;
export type RawPcbPolygon = z.infer<ReturnType<typeof RawPcbPolygonSchema>>;
export type RawPcbArc = z.infer<ReturnType<typeof RawPcbArcSchema>>;
export type RawPcbTrack = z.infer<ReturnType<typeof RawPcbTrackSchema>>;
export type RawPcbPad = z.infer<ReturnType<typeof RawPcbPadSchema>>;
export type RawPcbComponent = z.infer<ReturnType<typeof RawPcbComponentSchema>>;
export type RawPcbVia = z.infer<ReturnType<typeof RawPcbViaSchema>>;
export type RawPcbBoard = z.infer<ReturnType<typeof RawPcbBoardSchema>>;
