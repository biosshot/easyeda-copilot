import * as z from "zod";

export const PcbToolReportSchema = () => z.object({
    status: z.enum(["ok", "warning", "error"]),
    placement: z.object({
        ok: z.boolean(),
        overlaps: z.array(z.string()),
        outsideBoard: z.array(z.string()),
        blockViolations: z.array(z.string()),
    }).strict(),
    routing: z.object({
        ok: z.boolean(),
        unroutedNets: z.array(z.string()),
        partiallyRoutedNets: z.array(z.string()),
        errors: z.array(z.string()),
        warnings: z.array(z.string()),
    }).strict(),
}).strict();

export type PcbToolReport = z.infer<ReturnType<typeof PcbToolReportSchema>>;
