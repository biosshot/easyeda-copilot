import os from "node:os";
import { backendResource } from "#runtime/resources.ts";
import workerpool, { type Pool } from "workerpool";
import env from "#utils/env.ts";
import type { PlacementGraph, PlacementInput, PlacementTreeNode } from "#types/pcb/layout-model.ts";
import type { TreeSolveResult, TreeSolverOptions } from "./tree-solver.ts";

type WorkerPoolPromise<T> = Promise<T> & {
    timeout: (delay: number) => Promise<T>;
};

export type PcbSubtreeWorkerTask = {
    input: PlacementInput;
    graph: PlacementGraph;
    node: PlacementTreeNode;
    options?: TreeSolverOptions;
};

type PcbSubtreeWorkerPoolConfig = {
    maxWorkers: number;
    maxQueueSize: number;
    taskTimeoutMs: number;
    workerTerminateTimeoutMs: number;
    minComponents: number;
};

const WORKER_SCRIPT = backendResource('dist', 'tree-subtree.worker.js');
const DEFAULT_TASK_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_WORKER_TERMINATE_TIMEOUT_MS = 5_000;

let pcbSubtreeWorkerPool: Pool | null = null;
let pcbSubtreeWorkerPoolConfig: PcbSubtreeWorkerPoolConfig | null = null;

export async function solvePlacementSubtreeQueued(taskInput: PcbSubtreeWorkerTask): Promise<TreeSolveResult> {
    const pool = getPcbSubtreeWorkerPool();
    const task = pool.exec("solvePlacementSubtreeInWorker", [taskInput]) as WorkerPoolPromise<TreeSolveResult>;
    return task.timeout(getPcbSubtreeWorkerPoolConfig().taskTimeoutMs);
}

export function getPcbSubtreeWorkerPoolConfig() {
    if (!pcbSubtreeWorkerPoolConfig) {
        const defaultWorkers = 0;
        const maxWorkers = envInt("PCB_LAYOUT_SUBTREE_WORKERS", defaultWorkers, 0);
        pcbSubtreeWorkerPoolConfig = {
            maxWorkers: Math.min(maxWorkers, Math.max(os.cpus().length - 1, 0)),
            maxQueueSize: envInt("PCB_LAYOUT_SUBTREE_WORKER_QUEUE_SIZE", Math.max(maxWorkers * 4, 1), 1),
            taskTimeoutMs: envInt("PCB_LAYOUT_SUBTREE_WORKER_TIMEOUT_MS", DEFAULT_TASK_TIMEOUT_MS, 1_000),
            workerTerminateTimeoutMs: envInt("PCB_LAYOUT_SUBTREE_WORKER_TERMINATE_TIMEOUT_MS", DEFAULT_WORKER_TERMINATE_TIMEOUT_MS, 100),
            minComponents: envInt("PCB_LAYOUT_SUBTREE_MIN_COMPONENTS", 8, 1),
        };
    }
    return pcbSubtreeWorkerPoolConfig;
}

export async function terminatePcbSubtreeWorkerPool(force = true) {
    if (!pcbSubtreeWorkerPool) return;
    const pool = pcbSubtreeWorkerPool;
    pcbSubtreeWorkerPool = null;
    await pool.terminate(force, getPcbSubtreeWorkerPoolConfig().workerTerminateTimeoutMs);
}

function getPcbSubtreeWorkerPool() {
    const config = getPcbSubtreeWorkerPoolConfig();
    if (config.maxWorkers <= 0) {
        throw new Error("PCB subtree worker pool is disabled.");
    }
    if (!pcbSubtreeWorkerPool) {
        pcbSubtreeWorkerPool = workerpool.pool(WORKER_SCRIPT, {
            workerType: "thread",
            maxWorkers: config.maxWorkers,
            maxQueueSize: config.maxQueueSize,
            workerTerminateTimeout: config.workerTerminateTimeoutMs,
        });
    }
    return pcbSubtreeWorkerPool;
}

function envInt(name: string, fallback: number, min: number) {
    const value = Number(env[name]);
    if (!Number.isFinite(value)) return fallback;
    return Math.max(min, Math.floor(value));
}
