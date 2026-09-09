import * as z from "zod";

export const PcbToolReportSchema = () => z.object({
    status: z.enum(["ok", "warning", "error", "preview"]),
    preview: z.object({
        enabled: z.boolean(),
        placedComponents: z.array(z.string()),
        ignoredComponents: z.array(z.string()),
        totalComponents: z.number(),
        warnings: z.array(z.string()),
    }).strict(),
    dsl: z.object({
        ok: z.boolean(),
        errors: z.array(z.string()),
        warnings: z.array(z.string()),
    }).strict(),
    placement: z.object({
        ok: z.boolean(),
        hardErrors: z.array(z.string()),
        overlaps: z.array(z.string()),
        outsideBoard: z.array(z.string()),
        boardHoleViolations: z.array(z.string()),
        constraintRegionViolations: z.array(z.string()),
        layerViolations: z.array(z.string()),
        unplaced: z.array(z.string()),
    }).strict(),
    quality: z.object({
        ok: z.boolean(),
        warnings: z.array(z.string()),
        blockViolations: z.array(z.string()),
        criticalPairViolations: z.array(z.string()),
        graphDiagnostics: z.array(z.string()),
    }).strict(),
    solver: z.object({
        ok: z.boolean(),
        errors: z.array(z.string()),
        warnings: z.array(z.string()),
        likelyCauses: z.array(z.string()),
        suggestions: z.array(z.string()),
    }).strict(),
}).strict();

export type PcbToolReport = z.infer<ReturnType<typeof PcbToolReportSchema>>;
