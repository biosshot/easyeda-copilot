import { CircuitAssembly } from "@copilot/shared/types/circuit";
import { ComponentReplacer } from "./replacer";

export const VCC_PORT_COMPONENT = {
    libraryUuid: 'f5af0881d090439f925343ec8aedf154',
    uuid: '4e5977e7f049493cbf5b5f91190144d3',
    rotateToIdle: 1,
};

export const GND_PORT_COMPONENT = {
    libraryUuid: 'f5af0881d090439f925343ec8aedf154',
    uuid: '181f479f152643bbaa46a4b8cd92ed2e',
    rotateToIdle: -1,
};

export const NET_PORT_COMPONENT = {
    libraryUuid: 'f5af0881d090439f925343ec8aedf154',
    uuid: '7523d33c197549a39030c4ac7fddee68',
    rotateToIdle: 1
};

export const shortSymbolsMap = {
    'VCC': {
        name: 'VCC',
        is: (signalName: string) => /^(?:[+-]?\d+(?:\.\d+)?V|V(?:CC|DD|BAT|IN|OUT|REF|REG|\+?|-?)|AVDD|DVDD|VBUS|V[0-9]+)$/i.test(signalName),
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