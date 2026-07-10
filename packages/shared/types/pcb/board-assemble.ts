import * as z from "zod";

export const BoardAssemblePointSchema = () => z.object({
    x: z.number(),
    y: z.number(),
})

export const BoardAssembleLayerSchema = () => z.enum(["top", "bottom"]);
export const BoardAssemblePadLayerSchema = () => z.enum(["top", "bottom", "multi"]);
export const BoardAssemblePadShapeSchema = () => z.enum(["rect", "oval", "round"]);

export const BoardAssembleSchema = () => z.object({
    board: z.object({
        polygon: z.array(BoardAssemblePointSchema()).min(3),
    }).strict().optional(),
    components: z.array(z.object({
        designator: z.string(),
        x: z.number(),
        y: z.number(),
        rotate: z.number(),
        layer: BoardAssembleLayerSchema(),
        designatorText: z.object({
            x: z.number(),
            y: z.number(),
            rotate: z.number(),
            height: z.number(),
        }).strict().optional(),
    }).strict()).optional(),
    tracks: z.array(z.object({
        net: z.string(),
        layer: BoardAssembleLayerSchema(),
        width: z.number(),
        points: z.array(BoardAssemblePointSchema()).min(2),
    }).strict()).optional(),
    vias: z.array(z.object({
        net: z.string().optional(),
        x: z.number(),
        y: z.number(),
        diameter: z.number(),
        drill: z.number(),
    }).strict()).optional(),
    pads: z.array(z.object({
        name: z.string(),
        net: z.string(),
        x: z.number(),
        y: z.number(),
        layer: BoardAssemblePadLayerSchema(),
        shape: BoardAssemblePadShapeSchema(),
        width: z.number().optional(),
        height: z.number().optional(),
        diameter: z.number().optional(),
        hole: z.object({
            diameter: z.number(),
            x: z.number().optional(),
            y: z.number().optional(),
        }).strict().optional(),
    }).strict()).optional(),
    polygons: z.array(z.object({
        net: z.string(),
        layer: BoardAssembleLayerSchema(),
        points: z.array(BoardAssemblePointSchema()).min(3),
    }).strict()).optional(),
    warnings: z.array(z.string()).optional(),
})

export type BoardAssemble = z.infer<ReturnType<typeof BoardAssembleSchema>>;
