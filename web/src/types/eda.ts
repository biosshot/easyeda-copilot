import { CircuitAssembly, ExplainCircuit } from "./circuit";
import { SimulateResult } from "./spice";

declare global {
    interface EDA {
        assembleCircuit?: (circuit: CircuitAssembly) => Promise<void>,
        getSchematic?: (primitiveIds?: string[]) => Promise<ExplainCircuit>,
        checkpointer?: {
            restore: (id?: string) => Promise<boolean>;
            save: (minor: boolean) => Promise<string | null>;
            hasCheckpoint: () => boolean;
        }
        simulationResult?: SimulateResult
    }
}