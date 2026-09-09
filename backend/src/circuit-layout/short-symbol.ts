import { type ShortSymbol } from "#types/symbol.ts";
import { isGroundSignal } from './ground.ts';

const DEFAULT_LAYOUT_OPTIONS = {
    'elk.portConstraints': 'FIXED_POS',
    'org.eclipse.elk.spacing.individual': 'spacing.nodeNode: 5',
};

const SHORT_SYMBOL_MIN_WIDTH = 8;
const SHORT_SYMBOL_MAX_WIDTH = 40;
const SHORT_SYMBOL_HEIGHT = 40;
const SHORT_SYMBOL_CHAR_WIDTH = 3.5;
const SHORT_SYMBOL_HORIZONTAL_PADDING = 5;

const crateID = (signalName: string) => signalName + '|' + crypto.randomUUID().slice(0, 4);

export function stableShortSymbolId(kind: string, signalName: string, blockName: string, ordinal = 0) {
    const source = `${kind}\u0000${signalName}\u0000${blockName}\u0000${ordinal}`;
    let hash = 0x811c9dc5;
    for (let index = 0; index < source.length; index++) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `${signalName}|${(hash >>> 0).toString(16).padStart(8, '0').slice(-4)}`;
}

const getShortSymbolWidth = (signalName: string) => Math.min(
    SHORT_SYMBOL_MAX_WIDTH,
    Math.max(SHORT_SYMBOL_MIN_WIDTH, signalName.length * SHORT_SYMBOL_CHAR_WIDTH + SHORT_SYMBOL_HORIZONTAL_PADDING),
);

function baseCreate(id: string, signalName: string, blockName: string, adding?: { node?: Partial<ShortSymbol['node']>, component?: Partial<ShortSymbol['component']> }): ShortSymbol {
    const width = getShortSymbolWidth(signalName);

    return {
        component: {
            block_name: blockName,
            designator: id,
            part_uuid: 'GND',
            search_query: "",
            value: signalName,
            pins: [{
                name: '1',
                pin_number: 1,
                signal_name: signalName
            }],
            ...adding?.component,
        },
        node: {
            id: id,
            width,
            height: SHORT_SYMBOL_HEIGHT,
            ports: [
                {
                    id: `${id}_pin_1`,
                    width: 0,
                    height: 0,
                    x: width / 2,
                    y: 0,
                }
            ],
            layoutOptions: DEFAULT_LAYOUT_OPTIONS,
            ...adding?.node,
        }
    }
}

const createGround = (signalName: string, blockName: string, stableId?: string): ShortSymbol => {
    const id = stableId ?? crateID(signalName);
    const width = getShortSymbolWidth(signalName);

    return baseCreate(id, signalName, blockName, {
        component: {
            part_uuid: 'GND'
        },
        node: {
            ports: [
                {
                    id: `${id}_pin_1`,
                    width: 0,
                    height: 0,
                    x: width / 2,
                    y: 0,
                }
            ],
        }
    });
}

const createVcc = (signalName: string, blockName: string, stableId?: string): ShortSymbol => {
    const id = stableId ?? crateID(signalName);
    const width = getShortSymbolWidth(signalName);

    return baseCreate(id, signalName, blockName, {
        component: {
            part_uuid: 'VCC'
        },
        node: {
            ports: [
                {
                    id: `${id}_pin_1`,
                    width: 0,
                    height: 0,
                    x: width / 2,
                    y: SHORT_SYMBOL_HEIGHT
                }
            ],
        }
    });
}

const createNetPort = (signalName: string, blockName: string, stableId?: string): ShortSymbol => {
    const id = stableId ?? crateID(signalName);
    const width = getShortSymbolWidth(signalName);

    return baseCreate(id, signalName, blockName, {
        component: {
            part_uuid: '7523d33c197549a39030c4ac7fddee68'
        },
        node: {
            ports: [
                {
                    id: `${id}_pin_1`,
                    width: 0,
                    height: 0,
                    x: width / 2,
                    y: SHORT_SYMBOL_HEIGHT
                }
            ],
        }
    });


}

export const shortSymbolsMap = {
    'VCC': {
        name: 'VCC',
        create: createVcc,
        is: (signalName: string) => {
            if (!signalName) return false;
            const s = signalName.toUpperCase();
            if (isGroundSignal(s)) return false;
            if (s === 'BATTERY') return true;
            if (/^USB_[V\d]/i.test(signalName)) return true;
            if (/^V(?:CC|DD|BAT|IN|OUT|REF|REG|PP|SS|EE|BUS|[0-9])/i.test(signalName)) return true;
            if (/^[AVDG]?V(?:DD|CC)/i.test(signalName)) return true;
            if (/^[+-]?V[+-]?$|^V$/i.test(signalName)) return true;
            if (/^[+-]?\d+(?:\.\d+)?V/i.test(signalName)) return true;
            if (/^\d+V\d+$/i.test(signalName)) return true;
            return false;
        },
        partUuid: 'VCC',
    },
    'GND': {
        name: 'GND',
        create: createGround,
        is: isGroundSignal,
        partUuid: 'GND',
    },
    'NETPORT': {
        name: 'NETPORT',
        create: createNetPort,
        is: (signalName: string) => false,
        partUuid: '7523d33c197549a39030c4ac7fddee68',
    }
};
