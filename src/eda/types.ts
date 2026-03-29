import { CircuitAssembly } from "../types/circuit";
import { ComponentReplacer } from "./replacer";

export const VCC_PORT_COMPONENT = {
    libraryUuid: 'f5af0881d090439f925343ec8aedf154',
    uuid: '4e5977e7f049493cbf5b5f91190144d3',
};

export const NET_PORT_COMPONENT = {
    libraryUuid: 'f5af0881d090439f925343ec8aedf154',
    uuid: '7523d33c197549a39030c4ac7fddee68',
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

export interface ComponentToReplace {
    component: CircuitAssembly['components'][0],
    replacer: Awaited<ReturnType<typeof ComponentReplacer>>
}