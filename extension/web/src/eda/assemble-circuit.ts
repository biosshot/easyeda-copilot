import { CircuitAssembly } from "@copilot/shared/types/circuit";
import "@copilot/shared/types/eda";
import { isEasyEda } from "./utils";
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