import { isEasyEda } from "./utils";
// @ts-ignore
import type _ from '@jlceda/pro-api-types';

export const assembleCircuit = async (circuit: any) => {
    if (isEasyEda() && 'assembleCircuit' in eda && typeof eda.assembleCircuit === 'function') {
        await eda.assembleCircuit(circuit);
    }
    else {
        throw new Error('Fail assemble circuit')
    }
}