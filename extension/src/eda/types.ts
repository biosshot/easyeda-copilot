import { CircuitAssembly } from "@copilot/shared/types/circuit";
import { ComponentReplacer } from "./replacer";

export const ECHOSYS_LIB = 'f5af0881d090439f925343ec8aedf154';

export const VCC_PORT_COMPONENT = {
    libraryUuid: ECHOSYS_LIB,
    uuid: '4e5977e7f049493cbf5b5f91190144d3',
    rotateToIdle: 1,
};

export const GND_PORT_COMPONENT = {
    libraryUuid: ECHOSYS_LIB,
    uuid: '181f479f152643bbaa46a4b8cd92ed2e',
    rotateToIdle: -1,
};

export const NET_PORT_COMPONENT = {
    libraryUuid: ECHOSYS_LIB,
    uuid: 'b4dd4008fe1a4942b81a1cc59f3de199',
    rotateToIdle: 1
};

export const LEGACY_NET_PORT_UUID = '7523d33c197549a39030c4ac7fddee68';
export const isNetPortUuid = (uuid: string) => uuid === NET_PORT_COMPONENT.uuid || uuid === LEGACY_NET_PORT_UUID;

export const STYLED_NET_PORT_COMPONENTS = {
    in: { ...NET_PORT_COMPONENT, uuid: '889333c0a5324763ac80b7ba72921b60' },
    out: { ...NET_PORT_COMPONENT, uuid: '61f78a1485dc4d2298b7c72139ba0bd0' },
    bi: NET_PORT_COMPONENT,
} as const;

export const shortSymbolsMap = {
    'VCC': {
        name: 'VCC',
        is: (signalName: string) => {
            if (!signalName) return false;
            const s = signalName.toUpperCase();
            if (s.includes('GND')) return false;
            if (s === 'BATTERY') return true;
            if (/^USB_[V\d]/i.test(signalName)) return true;
            if (/^V(?:CC|DD|BAT|IN|OUT|REF|REG|PP|SS|EE|BUS|[0-9])/i.test(signalName)) return true;
            if (/^[AVDG]?V(?:DD|CC)/i.test(signalName)) return true;
            if (/^[+-]?V[+-]?$|^V$/i.test(signalName)) return true;
            if (/^[+-]?\d+(?:\.\d+)?V/i.test(signalName)) return true;
            if (/^\d+V\d+$/i.test(signalName)) return true;
            return false;
        },
        data: VCC_PORT_COMPONENT,
    },
    'GND': {
        name: 'GND',
        is: (signalName: string) => signalName.toLocaleLowerCase().includes('gnd'),
        data: GND_PORT_COMPONENT,
    },
    'NETPORT': {
        name: 'NETPORT',
        is: (signalName: string) => false,
        data: NET_PORT_COMPONENT,
    }
};

export interface Offset {
    x: number | undefined;
    y: number | undefined
}

export interface PlacedComponents {
    [k: string]: {
        primitive_id: string;
        pins: ISCH_PrimitiveComponentPin[];
        designator: string;
    };
}

export interface AddedNet {
    designator: string,
    pin_number: number | string,
    net: string,
    pin_name?: string
}

export interface RmNet {
    designator: string,
    net: string,
    pin_number: number | string,
}

export interface ComponentToReplace {
    component: CircuitAssembly['components'][0],
    replacer: Awaited<ReturnType<typeof ComponentReplacer>>
}
