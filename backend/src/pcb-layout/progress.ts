export type PcbLayoutProgressStage =
    | 'parse_dsl'
    | 'validate_dsl'
    | 'resolve_footprints'
    | 'build_graph'
    | 'solve_islands'
    | 'solve_blocks'
    | 'solve_modules'
    | 'solve_board'
    | 'render'
    | 'assemble'
    | 'done';

export type PcbLayoutProgress = {
    stage: PcbLayoutProgressStage;
    progress: number;
    content: string;
};

export type PcbLayoutProgressReporter = (progress: PcbLayoutProgress) => void | Promise<void>;

export const PCB_LAYOUT_PROGRESS = {
    parseDsl: 5,
    validateDsl: 10,
    resolveFootprints: 20,
    buildGraph: 30,
    solveIslands: 40,
    solveBlocks: 55,
    solveModules: 70,
    solveBoard: 85,
    render: 95,
    assemble: 98,
    done: 100,
} as const;

export function isPcbLayoutProgress(value: unknown): value is PcbLayoutProgress {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<PcbLayoutProgress>;
    return typeof candidate.stage === 'string'
        && typeof candidate.progress === 'number'
        && Number.isFinite(candidate.progress)
        && typeof candidate.content === 'string';
}

export function emitPcbLayoutProgress(
    reporter: PcbLayoutProgressReporter | undefined,
    progress: PcbLayoutProgress,
) {
    if (!reporter) return;
    try {
        void Promise.resolve(reporter(progress)).catch(() => undefined);
    } catch {
        // Progress reporting must not affect layout generation.
    }
}

export function pcbLayoutProgress(stage: PcbLayoutProgressStage, progress: number, content: string): PcbLayoutProgress {
    return { stage, progress, content };
}
