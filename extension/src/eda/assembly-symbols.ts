import type { CircuitAssembly } from "@copilot/shared/types/circuit";
import { GND_PORT_COMPONENT, VCC_PORT_COMPONENT } from "./types";

type AssemblyComponent = CircuitAssembly["components"][number];

export const getNetFlagKind = (component: AssemblyComponent) => {
    if (component.part_uuid === 'GND' || component.part_uuid === GND_PORT_COMPONENT.uuid) {
        const signal_name = component.pins?.[0]?.signal_name?.toUpperCase() ?? '';

        if (signal_name.includes('PGND')) return 'ProtectGround';
        else if (signal_name.includes('AGND')) return 'AnalogGround';
        return 'Ground';
    }
    else if (component.part_uuid === 'VCC' || component.part_uuid === VCC_PORT_COMPONENT.uuid) {
        return 'Power';
    }

    return undefined;
};

export const getSpecialSignalName = (component: AssemblyComponent) =>
    component.pins?.[0]?.signal_name || (getNetFlagKind(component)?.includes('Ground') ? 'GND' : 'VCC');

export const getComponentTemplateKey = (component: AssemblyComponent) => JSON.stringify({
    partUuid: component.part_uuid,
    netFlagKind: getNetFlagKind(component),
    subPartName: component.sub_part_name ?? '',
    kind: component.part_uuid === 'GND'
        ? 'GND'
        : component.part_uuid === 'VCC'
            ? 'VCC'
            : component.value === 'unknown_shortsym'
                ? 'UNKNOWN_SHORT'
                : component.designator.includes('|')
                    ? 'ECOSYSTEM_SHORT'
                    : 'DEVICE',
});
