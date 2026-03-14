import { z } from 'zod';
import { BaseComponentSchema } from './circuit';

export const SimComponentSchema = () => BaseComponentSchema().omit({ block_name: true, part_uuid: true, search_query: true })

export const InputSignalSchema = () => z.object({
    signal_name: z.string(),
    name: z.string().describe('must not contain spaces must be short'),

    type: z.enum(['DC', 'SIN', 'PULSE', 'SAW', 'RSAW']),
    value: z.number().describe('half-wave amplitude for AC signals and voltage for DC'),
    fill: z.number().nullish().describe('fill percentage from 0 to 100 for pulse'),
    frequency: z.number().nullish().describe('frequency for an alternating signal'),
    offset: z.number().nullish().describe('offset from zero for ac'),
});

export const SimulateOptionsSchema = () => z.object({
    // Error Tolerances
    abstol: z.number().default(1e-12),
    reltol: z.number().default(0.01),
    vntol: z.number().default(1e-6),
    chgtol: z.number().default(1e-14),
    trtol: z.number().default(1.0),
    pivrel: z.number().default(1e-3),
    pivtol: z.number().default(1e-13),

    // Iteration Limits
    itl1: z.number().int().default(500),
    itl2: z.number().int().default(200),
    itl4: z.number().int().default(100),
    itl5: z.number().int().default(10),
    itl6: z.number().int().default(5),

    // Analysis Methods
    method: z.string().default('gear'),
    gmin: z.number().default(1e-12),
    gminsteps: z.number().int().default(100),
    sourcesteps: z.number().int().default(10),

    // Temperature
    temp: z.number().default(25.0),
    tnom: z.number().default(25.0),

    // Stability (Shunts)
    rshunt: z.number().nullish(),
    cshunt: z.number().nullish(),
});

// =============================================================================
// Опции анализа (с discriminator)
// =============================================================================

export const TranAnalysisOptionsSchema = () => z.object({
    type: z.literal('transient').default('transient'),
    step_time_ns: z.number().default(100),
    end_time_ns: z.number().default(60_000),
});

export const ACAnalysisOptionsSchema = () => z.object({
    type: z.literal('ac').default('ac'),
    start_freq: z.number().default(10),
    end_freq: z.number().default(1e6),
    points_per_decade: z.number().int().default(100),
    sweep_type: z.enum(['dec', 'oct', 'lin']).default('dec'),
});

export const DCAnalysisOptionsSchema = () => z.object({
    type: z.literal('dc').default('dc'),
    source_name: z.string(),
    start_value: z.number().default(0),
    end_value: z.number().default(5),
    step_value: z.number().default(0.1),
});

export const OPAnalysisOptionsSchema = () => z.object({
    type: z.literal('op').default('op'),
});

export const AnalysisOptionsSchema = () => z.discriminatedUnion('type', [
    TranAnalysisOptionsSchema(),
    ACAnalysisOptionsSchema(),
    DCAnalysisOptionsSchema(),
    OPAnalysisOptionsSchema(),
]);

// =============================================================================
// Схема цепи для симуляции
// =============================================================================

export const CircuitToSimulateSchema = () => z.object({
    components: (z.array(SimComponentSchema())),
    input_signals: (z.array(InputSignalSchema())),
    output_signals: (z.array(z.string().describe('signal_name'))),

    // Новый подход: тип анализа и опции
    analysis_type: z.enum(['transient', 'ac', 'dc', 'op']).default('transient'),
    analysis_options: AnalysisOptionsSchema().nullish(),

    // Обратная совместимость — старые поля остаются
    step_time_ns: z.number().default(100),
    end_time_ns: z.number().default(60_000),
    options: SimulateOptionsSchema().nullish(),
});

// =============================================================================
// Выходные сигналы для разных типов анализа
// =============================================================================

export const OutputSignalSchema = () => z.object({
    signal_name: z.string(),
    voltages: z.array(z.number()),
});

export const ACOutputSignalSchema = () => z.object({
    signal_name: z.string(),
    magnitude: z.array(z.number()),
    phase: z.array(z.number()),
});

export const DCOutputSignalSchema = () => z.object({
    signal_name: z.string(),
    voltages: z.array(z.number()),
});

export const OPOutputSignalSchema = () => z.object({
    signal_name: z.string(),
    voltage: z.number(),
});

// =============================================================================
// Результаты анализа (с discriminator)
// =============================================================================

export const TranOutputSchema = () => z.object({
    type: z.literal('transient').default('transient'),
    time: z.array(z.number()),
    output_signals: z.array(OutputSignalSchema()),
});

export const ACOutputSchema = () => z.object({
    type: z.literal('ac').default('ac'),
    frequencies: z.array(z.number()),
    output_signals: z.array(ACOutputSignalSchema()),
});

export const DCOutputSchema = () => z.object({
    type: z.literal('dc').default('dc'),
    sweep_values: z.array(z.number()),
    output_signals: z.array(DCOutputSignalSchema()),
});

export const OPOutputSchema = () => z.object({
    type: z.literal('op').default('op'),
    output_signals: z.array(OPOutputSignalSchema()),
});

export const AnalysisResultSchema = () => z.discriminatedUnion('type', [
    TranOutputSchema(),
    ACOutputSchema(),
    DCOutputSchema(),
    OPOutputSchema(),
]);

// =============================================================================
// Вспомогательные схемы
// =============================================================================

export const ComponentMapSchema = () => z.object({
    name: z.string(),
    spice_model_name: z.string(),
});

export const SimulateWarnSchema = () => z.object({
    wtype: z.string().optional(),
    text: z.string(),
});

// =============================================================================
// Основная схема результата симуляции
// =============================================================================

export const SimulateResultSchema = () => z.object({
    analysis_type: z.string().default('transient'),

    // Новый унифицированный подход (для всех типов анализа)
    result: AnalysisResultSchema(),

    component_map: z.array(ComponentMapSchema()).default([]),
    warns: z.array(SimulateWarnSchema()).default([]),
});

// =============================================================================
// Типы TypeScript
// =============================================================================

export type SimulateResult = z.infer<ReturnType<typeof SimulateResultSchema>>;
export type SimulateOptions = z.infer<ReturnType<typeof SimulateOptionsSchema>>;
export type CircuitToSimulate = z.infer<ReturnType<typeof CircuitToSimulateSchema>>;
export type AnalysisOptions = z.infer<ReturnType<typeof AnalysisOptionsSchema>>;
export type AnalysisResult = z.infer<ReturnType<typeof AnalysisResultSchema>>;
