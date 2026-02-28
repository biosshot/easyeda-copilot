import { CircuitAssembly, ExplainCircuit } from "../types/circuit";
import { isEasyEda } from "./utils";
// @ts-ignore
import type _ from '@jlceda/pro-api-types';

declare global {
    interface EDA {
        assembleCircuit?: (circuit: CircuitAssembly) => Promise<void>,
        getSchematic?: (primitiveIds?: string[]) => Promise<ExplainCircuit>,
    }
}

export const getSchematic = async (primitiveIds?: string[]) => {
    if (isEasyEda() && typeof eda.getSchematic === 'function') {
        return await eda.getSchematic(primitiveIds) as ExplainCircuit;
    }
    else {
        throw new Error('Fail get circuit');
    }
}

export const getAllPrimitiveId = async () => {
    if (isEasyEda()) {
        return await eda.sch_PrimitiveComponent.getAllPrimitiveId();
    }
    else {
        throw new Error('Fail getAllPrimitiveId');
    }
}
