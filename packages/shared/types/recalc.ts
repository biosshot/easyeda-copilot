import { CircuitAssemblyStruct, ComponentAsmSchema } from "./circuit.ts";
import { z } from "zod";

// Формула пересчёта для конкретного компонента
const ComponentRecalcSchema = () => z.object({
    formula: z.string(),
    unit: z.string(),
    lcsc_query_template: z.string().optional()
});

export const RecalParameters = () => z.record(z.string(), z.object({
    min: z.number().nullish(),
    nominal: z.number(),
    max: z.number().nullish(),
    allow_recalc: z.boolean().optional()
}))

// Глобальные параметры и ограничения
const RecalculationMetaSchema = () => z.object({
    parameters: RecalParameters(),
    constraints: z.array(z.string()),
    ports: z.array(z.object({
        port_number: z.string(),
        description: z.string(),
        related_parameter: z.string().optional()
    }))
});

// Обновлённая схема сборки
export const CircuitAssemblyStructWithRecalc = () => CircuitAssemblyStruct().omit({ metadata: true }).extend({
    recalculation_meta: RecalculationMetaSchema(),
    components: z.array(ComponentAsmSchema().extend({
        recalc: ComponentRecalcSchema().optional()
    }))
});

export type CircuitAssemblyWithRecalc = z.infer<ReturnType<typeof CircuitAssemblyStructWithRecalc>>;
