import * as z from "zod";

export const PcbDrcDifferentialPairType = "differentialPair" as const;

export type PcbDrcRuleObject = Record<string, unknown>;

export type PcbDrcBundle = {
    ruleConfiguration: PcbDrcRuleObject;
    netRules: Array<PcbDrcRuleObject | PcbDrcDifferentialPairRule>;
};

export const PcbDrcRuleObjectSchema = () => z.record(z.string(), z.unknown());

export const PcbDrcDifferentialPairSubRuleSchema = () => z.object({
    type: z.literal("net"),
    name: z.string().min(1),
}).catchall(z.unknown());

export const PcbDrcDifferentialPairRuleSchema = () => z.object({
    type: z.literal(PcbDrcDifferentialPairType),
    name: z.string().min(1),
    positiveNet: z.string().min(1),
    negativeNet: z.string().min(1),
    sub: z.array(PcbDrcDifferentialPairSubRuleSchema()).optional(),
}).catchall(z.unknown());

export const PcbDrcNetRuleSchema = () => PcbDrcRuleObjectSchema().superRefine((rule, ctx) => {
    if (rule.type !== PcbDrcDifferentialPairType) return;

    const parsed = PcbDrcDifferentialPairRuleSchema().safeParse(rule);
    if (parsed.success) return;

    ctx.addIssue({
        code: "custom",
        message: 'Invalid differential pair rule. Expected type, name, positiveNet, negativeNet, and optional sub net rules.',
    });
});

export const PcbDrcBundleSchema = () => z.object({
    ruleConfiguration: PcbDrcRuleObjectSchema(),
    netRules: z.array(PcbDrcNetRuleSchema()),
}).strict();

export type PcbDrcDifferentialPairRule = z.infer<ReturnType<typeof PcbDrcDifferentialPairRuleSchema>>;
export type PcbDrcDifferentialPairSubRule = z.infer<ReturnType<typeof PcbDrcDifferentialPairSubRuleSchema>>;
