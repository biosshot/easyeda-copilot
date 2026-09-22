import type { CircuitAssembly } from "@copilot/shared/types/circuit";
import { GND_PORT_COMPONENT, NET_PORT_COMPONENT, VCC_PORT_COMPONENT } from "./types";
import { getPartUuid, getPartUuidKey } from '@copilot/shared/types/lcsc';

type AssemblyComponent = CircuitAssembly["components"][number];

export const getNetFlagKind = (component: AssemblyComponent) => {
    const partUuid = component.part_uuid ? getPartUuid(component.part_uuid) : '';
    if (partUuid === 'GND' || partUuid === GND_PORT_COMPONENT.uuid) {
        const signal_name = component.pins?.[0]?.signal_name?.toUpperCase() ?? '';

        if (signal_name.includes('PGND')) return 'ProtectGround';
        else if (signal_name.includes('AGND')) return 'AnalogGround';
        return 'Ground';
    }
    else if (partUuid === 'VCC' || partUuid === VCC_PORT_COMPONENT.uuid) {
        return 'Power';
    }

    return undefined;
};

export const getSpecialSignalName = (component: AssemblyComponent) =>
    component.pins?.[0]?.signal_name || (getNetFlagKind(component)?.includes('Ground') ? 'GND' : 'VCC');

export const getNetPortStyle = (component: AssemblyComponent) =>
    component.part_uuid && getPartUuid(component.part_uuid) === NET_PORT_COMPONENT.uuid
        ? component.pins?.[0]?.port_style
        : undefined;

export const getComponentTemplateKey = (component: AssemblyComponent) => {
    const style = getNetPortStyle(component);
    return JSON.stringify({
        partUuid: component.part_uuid ? getPartUuidKey(component.part_uuid) : null,
        netFlagKind: getNetFlagKind(component),
        subPartName: component.sub_part_name ?? '',
        kind: component.part_uuid && getPartUuid(component.part_uuid) === 'GND'
            ? 'GND'
            : component.part_uuid && getPartUuid(component.part_uuid) === 'VCC'
                ? 'VCC'
                : component.value === 'unknown_shortsym'
                    ? 'UNKNOWN_SHORT'
                    : component.designator.includes('|')
                        ? 'ECOSYSTEM_SHORT'
                        : 'DEVICE',
        ...(style ? { portStyle: style, portMode: eda.sys_Environment.isOnlineMode() ? 'library' : 'native' } : {}),
    });
};
