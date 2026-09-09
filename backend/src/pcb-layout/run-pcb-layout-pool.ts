
import { backendResource } from "#runtime/resources.ts";
import workerpool, { type Pool } from "workerpool";
import env from "#utils/env.ts";
import type { PcbLayoutRunResult, RunPcbLayoutOptions } from "#pcb-layout/run-pcb-layout.ts";
import {
    deserializePcbLayoutWorkerError,
    type PcbLayoutWorkerResult,
} from "#pcb-layout/run-pcb-layout-worker-error.ts";
import { isPcbLayoutProgress, type PcbLayoutProgressReporter } from "./progress.ts";

type WorkerPoolPromise<T> = Promise<T> & {
    cancel: () => WorkerPoolPromise<T>;
    timeout: (delay: number) => Promise<T>;
};

type PcbLayoutWorkerPoolConfig = {
    maxWorkers: number;
    maxQueueSize: number;
    taskTimeoutMs: number;
    workerTerminateTimeoutMs: number;
};

export type RunPcbLayoutQueuedOptions = {
    onProgress?: PcbLayoutProgressReporter;
    signal?: AbortSignal;
};

const WORKER_SCRIPT = backendResource('dist', 'run-pcb-layout.worker.js');
const DEFAULT_TASK_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_WORKER_TERMINATE_TIMEOUT_MS = 10_000;

let pcbLayoutWorkerPool: Pool | null = null;
let pcbLayoutWorkerPoolConfig: PcbLayoutWorkerPoolConfig | null = null;


export async function runPcbLayoutQueued(
    options: RunPcbLayoutOptions,
    queuedOptions: RunPcbLayoutQueuedOptions = {},
): Promise<PcbLayoutRunResult> {
    queuedOptions.signal?.throwIfAborted();
    const pool = getPcbLayoutWorkerPool();
    let task: WorkerPoolPromise<PcbLayoutWorkerResult<PcbLayoutRunResult>>;
    const workerOptions: RunPcbLayoutOptions = { ...options, onProgress: undefined };

    try {
        task = pool.exec("runPcbLayoutInWorker", [workerOptions], {
            on: (payload) => {
                if (!isPcbLayoutProgress(payload)) return;
                void Promise.resolve(queuedOptions.onProgress?.(payload)).catch(() => undefined);
            },
        }) as WorkerPoolPromise<PcbLayoutWorkerResult<PcbLayoutRunResult>>;
    } catch (error) {
        throw new Error(`PCB layout worker queue rejected task: ${(error as Error).message}`);
    }

    // Convert workerpool's custom thenable before cancellation, so Node tracks its rejection.
    const taskResult = Promise.resolve(task);
    void taskResult.catch(() => undefined);

    const abortTask = () => {
        try {
            task.cancel();
        } catch {
            // workerpool may synchronously surface its cancellation rejection from an event listener.
        }
    };
    if (queuedOptions.signal?.aborted) {
        abortTask();
    } else {
        queuedOptions.signal?.addEventListener("abort", abortTask, { once: true });
    }

    try {
        task.timeout(getPcbLayoutWorkerPoolConfig().taskTimeoutMs);
        const result = await taskResult;
        if (result.ok) return result.run;
        throw deserializePcbLayoutWorkerError(result.error);
    } catch (error) {
        throw normalizeWorkerPoolError(error);
    } finally {
        queuedOptions.signal?.removeEventListener("abort", abortTask);
    }
}

export function getPcbLayoutWorkerPoolStats() {
    return pcbLayoutWorkerPool?.stats() ?? null;
}

export async function terminatePcbLayoutWorkerPool(force = true) {
    if (!pcbLayoutWorkerPool) return;
    const pool = pcbLayoutWorkerPool;
    pcbLayoutWorkerPool = null;
    await pool.terminate(force, getPcbLayoutWorkerPoolConfig().workerTerminateTimeoutMs);
}

function getPcbLayoutWorkerPool() {
    if (!pcbLayoutWorkerPool) {
        const config = getPcbLayoutWorkerPoolConfig();
        pcbLayoutWorkerPool = workerpool.pool(WORKER_SCRIPT, {
            workerType: "process",
            maxWorkers: config.maxWorkers,
            maxQueueSize: config.maxQueueSize,
            workerTerminateTimeout: config.workerTerminateTimeoutMs,
        });
    }

    return pcbLayoutWorkerPool;
}

function getPcbLayoutWorkerPoolConfig() {
    if (!pcbLayoutWorkerPoolConfig) {
        const maxWorkers = envInt("PCB_LAYOUT_WORKERS", 1, 1);
        pcbLayoutWorkerPoolConfig = {
            maxWorkers,
            maxQueueSize: envInt("PCB_LAYOUT_WORKER_QUEUE_SIZE", maxWorkers * 4, 1),
            taskTimeoutMs: envInt("PCB_LAYOUT_WORKER_TIMEOUT_MS", DEFAULT_TASK_TIMEOUT_MS, 1_000),
            workerTerminateTimeoutMs: envInt("PCB_LAYOUT_WORKER_TERMINATE_TIMEOUT_MS", DEFAULT_WORKER_TERMINATE_TIMEOUT_MS, 100),
        };
    }

    return pcbLayoutWorkerPoolConfig;
}

function envInt(name: string, fallback: number, min: number) {
    const value = Number(env[name]);
    if (!Number.isFinite(value)) return fallback;
    return Math.max(min, Math.floor(value));
}

function normalizeWorkerPoolError(error: unknown) {
    if (error instanceof Error && error.name === "CancellationError") {
        return new Error("PCB layout worker was cancelled.");
    }
    if (error instanceof Error && error.name === "TimeoutError") {
        const timeoutMs = getPcbLayoutWorkerPoolConfig().taskTimeoutMs;
        return new Error(`PCB layout worker timed out after ${timeoutMs}ms.`);
    }
    if (error instanceof Error) return error;
    return new Error(String(error));
}
