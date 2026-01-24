import { ExplainCircuit } from "../types/circuit";
import { isEasyEda } from "./utils";
// @ts-ignore
import type _ from '@jlceda/pro-api-types';

export const getSchematic = async (circuit: any) => {
    if (isEasyEda() && 'getSchematic' in eda && typeof eda.getSchematic === 'function') {
        return await eda.getSchematic(circuit) as ExplainCircuit;
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
