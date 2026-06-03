import * as z from "zod";

export const BoardAssemblePointSchema = () => z.object({
    x: z.number(),
    y: z.number(),
})

export const BoardAssembleLayerSchema = () => z.enum(["top", "bottom"]);

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
    polygons: z.array(z.object({
        net: z.string(),
        layer: BoardAssembleLayerSchema(),
        points: z.array(BoardAssemblePointSchema()).min(3),
    }).strict()).optional(),
    warnings: z.array(z.string()).optional(),
})

export type BoardAssemble = z.infer<ReturnType<typeof BoardAssembleSchema>>;

