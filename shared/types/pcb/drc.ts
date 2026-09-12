import * as z from "zod";

export const PcbDrcDifferentialPairType = "differentialPair" as const;

export type PcbDrcRuleObject = Record<string, unknown>;
export type PcbDrcPresetName = string | null;

export type PcbDrcRuleAssignments = {
    Track?: PcbDrcPresetName;
    "Safe Spacing"?: PcbDrcPresetName;
    "Copper Safe Spacing"?: PcbDrcPresetName;
    "Plane Safe Spacing"?: PcbDrcPresetName;
    "Via Size"?: PcbDrcPresetName;
    "Differential Pair"?: PcbDrcPresetName;
    "Net Length Range"?: PcbDrcPresetName;
    "Net Length Tolerance"?: PcbDrcPresetName;
    "Blind/Buried Via"?: PcbDrcPresetName;
    "Plane Zone"?: PcbDrcPresetName;
    "Copper Zone"?: PcbDrcPresetName;
    "Solder Mask Expansion"?: PcbDrcPresetName;
    "Paste Mask Expansion"?: PcbDrcPresetName;
    "Creepage Distance"?: PcbDrcPresetName;
    targetNet?: string | null;
    [key: string]: unknown;
};

export type PcbDrcNetRule = PcbDrcRuleAssignments & {
    type: "net";
    name: string;
};

export type PcbDrcNetClassRule = PcbDrcRuleAssignments & {
    type: "netClass";
    name: string;
    sub: PcbDrcNetRule[];
};

export type PcbDrcEqualLengthGroupRule = PcbDrcRuleAssignments & {
    type: "equalLengthGroup";
    name: string;
    sub: PcbDrcNetRule[];
};

export type PcbDrcDifferentialPairRule = PcbDrcRuleAssignments & {
    type: typeof PcbDrcDifferentialPairType;
    name: string;
    positiveNet: string;
    negativeNet: string;
    sub: PcbDrcNetRule[];
};

export type PcbDrcNetRuleEntry =
    | PcbDrcNetRule
    | PcbDrcNetClassRule
    | PcbDrcEqualLengthGroupRule
    | PcbDrcDifferentialPairRule;

export type PcbDrcBundle = {
    ruleConfiguration: PcbDrcRuleObject;
    netRules: PcbDrcNetRuleEntry[];
};

export const PcbDrcRuleObjectSchema = () => z.record(z.string(), z.unknown());

const PcbDrcRuleAssignmentsSchema = {
    Track: z.string().nullable().optional(),
    "Safe Spacing": z.string().nullable().optional(),
    "Copper Safe Spacing": z.string().nullable().optional(),
    "Plane Safe Spacing": z.string().nullable().optional(),
    "Via Size": z.string().nullable().optional(),
    "Differential Pair": z.string().nullable().optional(),
    "Net Length Range": z.string().nullable().optional(),
    "Net Length Tolerance": z.string().nullable().optional(),
    "Blind/Buried Via": z.string().nullable().optional(),
    "Plane Zone": z.string().nullable().optional(),
    "Copper Zone": z.string().nullable().optional(),
    "Solder Mask Expansion": z.string().nullable().optional(),
    "Paste Mask Expansion": z.string().nullable().optional(),
    "Creepage Distance": z.string().nullable().optional(),
    targetNet: z.string().nullable().optional(),
};

export const PcbDrcNetRuleSchema = () => z.object({
    type: z.literal("net"),
    name: z.string().min(1),
    ...PcbDrcRuleAssignmentsSchema,
}).catchall(z.unknown());

export const PcbDrcNetClassRuleSchema = () => z.object({
    type: z.literal("netClass"),
    name: z.string().min(1),
    sub: z.array(PcbDrcNetRuleSchema()),
    ...PcbDrcRuleAssignmentsSchema,
}).catchall(z.unknown());

export const PcbDrcEqualLengthGroupRuleSchema = () => z.object({
    type: z.literal("equalLengthGroup"),
    name: z.string().min(1),
    sub: z.array(PcbDrcNetRuleSchema()),
    ...PcbDrcRuleAssignmentsSchema,
}).catchall(z.unknown());

export const PcbDrcDifferentialPairRuleSchema = () => z.object({
    type: z.literal(PcbDrcDifferentialPairType),
    name: z.string().min(1),
    positiveNet: z.string().min(1),
    negativeNet: z.string().min(1),
    sub: z.array(PcbDrcNetRuleSchema()),
    ...PcbDrcRuleAssignmentsSchema,
}).catchall(z.unknown());

export const PcbDrcNetRuleEntrySchema = () => z.union([
    PcbDrcNetRuleSchema(),
    PcbDrcNetClassRuleSchema(),
    PcbDrcEqualLengthGroupRuleSchema(),
    PcbDrcDifferentialPairRuleSchema(),
]);

export const PcbDrcBundleSchema = () => z.object({
    ruleConfiguration: PcbDrcRuleObjectSchema(),
    netRules: z.array(PcbDrcNetRuleEntrySchema()),
}).passthrough();
