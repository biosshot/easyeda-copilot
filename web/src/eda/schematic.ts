import { ExplainCircuit } from "@copilot/shared/types/circuit";
import "@copilot/shared/types/eda";
import { isEasyEda, showToastMessage } from "./utils";

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
        // fix for easy eda pro v2.2.47
        return await eda.sch_PrimitiveComponent.getAllPrimitiveId().then(r => [...r]);
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

export const getAllDesignators = async () => {
    if (isEasyEda()) {
        // @ts-ignore
        const components = await eda.sch_PrimitiveComponent.getAll(ESCH_PrimitiveComponentType.COMPONENT);
        return components.map(c => c.getState_Designator()!).filter(Boolean);
    }
    else {
        throw new Error('Fail getAllDesignators');
    }
}