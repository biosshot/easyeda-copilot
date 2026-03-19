import { CircuitAssembly, ExplainCircuit } from "../types/circuit";
import { isEasyEda, showToastMessage } from "./utils";
// @ts-ignore
import type _ from '@jlceda/pro-api-types';
import "../types/eda";

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

let activeWirePromise: Promise<string | undefined> | undefined = undefined;

export const waitForWireSelect = (signal?: AbortSignal) => {
    if (activeWirePromise) {
        return activeWirePromise;
    }

    activeWirePromise = new Promise<string | undefined>((resolve, reject) => {
        eda.sch_SelectControl.clearSelected()

        const i = setInterval(async () => {
            if (signal?.aborted) {
                clearInterval(i);
                activeWirePromise = undefined;
                return reject(new Error('Aborted'));
            }

            const primitives = await Promise.race([
                eda.sch_SelectControl.getSelectedPrimitives(),
                new Promise((resolve, reject) => setTimeout(() => resolve(undefined), 150))
            ]);

            if (!primitives || !Array.isArray(primitives)) return;

            for (const primitive of primitives) {
                if (primitive.primitiveType === "Wire" && primitive.param.net) {
                    clearInterval(i);
                    activeWirePromise = undefined;
                    resolve(primitive.param.net);
                }
            }
        }, 200);
    });

    return activeWirePromise;
}