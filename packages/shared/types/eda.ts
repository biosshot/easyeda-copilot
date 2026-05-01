/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-expect-error
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type _ from '@jlceda/pro-api-types';
import { CircuitAssembly, ExplainCircuit } from './circuit';
import { SimulateResult } from './spice';

declare global {
    interface EDA {
        assembleCircuit?: (circuit: CircuitAssembly) => Promise<void>,
        getSchematic?: (primitiveIds?: string[]) => Promise<ExplainCircuit>,
        getAsmCircuit?: (primitiveIds?: string[]) => Promise<CircuitAssembly>,
        checkpointer?: {
            restore: (id?: string) => Promise<boolean>;
            save: (minor: boolean) => Promise<string | null>;
            hasCheckpoint: () => boolean;
        }
        simulationResult?: SimulateResult
    }
}