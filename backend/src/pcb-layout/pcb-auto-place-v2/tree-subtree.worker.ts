import workerpool from "workerpool";
import { solvePlacementSubtreeSync } from "./tree-solver.ts";
import type { PcbSubtreeWorkerTask } from "./tree-subtree-pool.ts";

function solvePlacementSubtreeInWorker(task: PcbSubtreeWorkerTask) {
    return solvePlacementSubtreeSync(task);
}

workerpool.worker({
    solvePlacementSubtreeInWorker,
});
