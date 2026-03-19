import { CircuitAssembly, ExplainCircuit } from "../types/circuit";
import { isEasyEda } from "./utils";
// @ts-ignore
import type _ from '@jlceda/pro-api-types';
import "../types/eda";

export const assembleCircuit = async (circuit: CircuitAssembly) => {
    if (isEasyEda() && typeof eda.assembleCircuit === 'function') {
        await eda.assembleCircuit(circuit);
    }
    else {
        throw new Error('Fail assemble circuit')
    }
}