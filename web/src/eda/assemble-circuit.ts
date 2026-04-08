import { CircuitAssembly, ExplainCircuit } from "../types/circuit";
import { isEasyEda } from "./utils";
// @ts-ignore
import type _ from '@jlceda/pro-api-types';
import "../types/eda";
import { useSettingsStore } from "../stores/settings-store";

export const assembleCircuit = async (circuit: CircuitAssembly) => {
    if (isEasyEda() && typeof eda.assembleCircuit === 'function') {
        const settings = useSettingsStore();

        await eda.assembleCircuit({
            ...circuit,
            assembly_options: {
                draw_blocks: Boolean(settings.getSetting('assembleDrawRects') ?? true)
            }
        });
    }
    else {
        throw new Error('Fail assemble circuit')
    }
}