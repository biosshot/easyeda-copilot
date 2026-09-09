import workerpool from "workerpool";
import { runPcbLayout, type PcbLayoutRunResult, type RunPcbLayoutOptions } from "#pcb-layout/run-pcb-layout.ts";
import {
    serializePcbLayoutWorkerError,
    type PcbLayoutWorkerResult,
} from "#pcb-layout/run-pcb-layout-worker-error.ts";

async function runPcbLayoutInWorker(
    options: RunPcbLayoutOptions,
): Promise<PcbLayoutWorkerResult<PcbLayoutRunResult>> {
    try {
        return {
            ok: true,
            run: await runPcbLayout({
                ...options,
                onProgress: (progress) => workerpool.workerEmit(progress),
            }),
        };
    } catch (error) {
        return {
            ok: false,
            error: serializePcbLayoutWorkerError(error),
        };
    }
}

workerpool.worker({
    runPcbLayoutInWorker,
}, {
    abortListenerTimeout: workerTimeoutFromEnv("PCB_LAYOUT_WORKER_TERMINATE_TIMEOUT_MS", 10_000),
});

function workerTimeoutFromEnv(name: string, fallback: number) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
