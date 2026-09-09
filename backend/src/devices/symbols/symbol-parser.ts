import { type Component } from "#types/component.ts";
import { type CircuitWithoutBlocks, type Circuit } from "#types/circuit.ts";
import { type SymbolPin, type SymbolData, type SymbolWithMeta } from "#types/symbol.ts";
import { fetchWithRetry } from "#utils/fetch-with-retry.ts";
import { memoize } from "#utils/memoize.ts";
import masterLogger from "#logger.ts";
import { getPinDirection } from "#circuit-layout/improvement.ts";
import type { EasyEdaProduct } from "#types/easy-eda-api.ts";
import { getEasyEdaDevice, getEasyEdaSymbolInfo } from "../easy-eda.ts";
import { countDiffChars } from "#utils/math.ts";
import { getPartIdFromDesignator } from "#utils/component.ts";

const logger = masterLogger.child({ TAG: "symbol-parser" });

type ParsedSymbolData = {
    doctype?: {
        type: string,
        version: string
    },
    head?: string,
    styles: {
        line: Record<string, string>,
        fonts: Record<string, string>
    },
    parts: {
        id: string,
        bbox: number[]
    }[],
    elements: {
        type: string,
        id: string
        data: (number | string)[],
        partId: string | null;
    }[]
}

function parseSymbolData(rawData: string, maxParts = 999) {
    // Очищаем и разбираем данные
    const lines = rawData
        .split("\n")
        .map(line => {
            try {
                return JSON.parse(line);
            } catch (e) {
                logger.error({ line }, "Error with string parse");
                return null;
            }
        })
        .filter(Boolean);

    // Инициализируем структуру данных
    const result: ParsedSymbolData = {
        doctype: undefined,
        head: undefined,
        styles: {
            line: {},
            fonts: {}
        },
        parts: [],
        elements: []
    };

    let partId: string | null = null;

    // Обрабатываем строки
    for (const line of lines) {

        const tag = line[0];

        switch (tag) {
            case "DOCTYPE":
                result.doctype = {
                    type: line[1],
                    version: line[2]
                };
                break;

            case "HEAD":
                result.head = line[1];
                break;

            case "LINESTYLE":
                result.styles.line[line[1]] = line[2];
                break;

            case "FONTSTYLE":
                result.styles.fonts[line[1]] = line[2];
                break;

            case "PART":
                if (result.parts.length >= maxParts) {
                    return result;
                }

                partId = line[1];
                result.parts.push({
                    id: line[1],
                    bbox: line[2].BBOX
                });

                break;

            default:
                // Обработка элементов (пины, атрибуты и т.д.)
                result.elements.push({
                    type: tag,
                    id: line[1],
                    data: line.slice(2),
                    partId
                });
        }
    };

    return result;
}

function extractPins<T extends boolean = false>(parsedData: ParsedSymbolData, extractExtend: T = false as T):
    T extends true ? { pin_number: number | string, name: string, x: number, y: number, part: string }[] : { pin_number: number | string, name: string }[] {

    const pins: { [key: string]: { pin_number: number | string, name: string, x?: number, y?: number, part?: string } } = {};

    // Сначала находим все пины
    parsedData.elements
        .filter(el => el.type === "PIN")
        .forEach(pin => {
            const x = pin.data[2];
            const y = pin.data[3];

            pins[pin.id] = { name: "", pin_number: -1 };

            if (extractExtend) {
                pins[pin.id].x = Number(x);
                pins[pin.id].y = Number(y);
                pins[pin.id].part = pin.partId ?? undefined;
            }
        });

    // Добавляем атрибуты к пинам
    parsedData.elements
        .filter(el => el.type === "ATTR" && el.data[0] in pins)
        .forEach(attr => {
            const type = attr.data[1];
            const id = attr.data[0];

            if (type === "NUMBER") {
                pins[id].pin_number = attr.data[2];
            }
            else if (type === "NAME") {
                pins[id].name = attr.data[2] as string;
            }
        });

    return Object.values(pins) as never;
}

export const extractPinsFromComponent = (product: EasyEdaProduct) => {
    const symbol_data = product?.device_info?.symbol_info?.dataStr;
    if (!symbol_data) return null;
    const parsedData = parseSymbolData(symbol_data);
    return extractPins(parsedData);
};

export const getSymbol = memoize(async function getSymbol(uuid: string, partId?: number) {
    try {
        const device = await getEasyEdaDevice(uuid);
        const symbol = await getEasyEdaSymbolInfo(device.symbol.uuid);

        const dataStr = symbol.dataStr as string;
        const parsed = parseSymbolData(dataStr);

        // Извлечение rect
        const part = parsed.parts[partId ?? 0];
        if (!part || !part.bbox) {
            logger.warn({ uuid, partIdN: partId, partId: typeof partId, part: part ?? 'None', parts: parsed.parts }, 'rect not found');
            return null;
        }

        const padding = 0;

        const rect = [part.bbox[0] - padding, part.bbox[1] - padding, part.bbox[2] + padding, part.bbox[3] + padding];

        // Извлечение пинов
        let rawPins = extractPins(parsed, true);

        if (partId !== undefined) {
            rawPins = rawPins.filter(p => p.part === part.id);
        }

        const pins: SymbolPin[] = rawPins.map(pin => {
            const x = pin.x;
            const y = pin.y;

            rect[0] = Math.min(rect[0], x - padding);
            rect[2] = Math.max(rect[2], x + padding);
            rect[1] = Math.min(rect[1], y - padding);
            rect[3] = Math.max(rect[3], y + padding);

            return {
                num: pin.pin_number,
                name: pin.name || 'unnamed',
                x: pin.x,
                y: pin.y,
                signal_name: "",
                part: pin.part ?? ''
            }
        });

        return {
            dataStr: dataStr,
            pins,
            rect
        };

    } catch (error) {
        logger.error({ error, uuid });
        return null;
    }
});

// @need-test
function checkPinNames(componentPins: CircuitWithoutBlocks['components'][0]['pins'], symbolPins: SymbolPin[]) {
    for (const componentPin of componentPins) {
        const symbolPin = symbolPins.find(sp => sp.num == componentPin.pin_number);
        if (!symbolPin) {
            const availableNums = symbolPins.map(p => p.num).join(', ');
            throw new Error(
                `Pin number "${componentPin.pin_number}" not found in symbol. ` +
                `Available symbol pins: [${availableNums}]`
            );
        }

        const compName = componentPin.name.trim().toLowerCase();
        const symName = symbolPin.name.trim().toLowerCase();

        if (!compName.startsWith(symName)) {
            throw new Error(
                `Pin name mismatch for pin ${JSON.stringify(componentPin)}. ` +
                `Component has "${componentPin.name}", but this symbol expects "${symbolPin.name}". ` +
                `Symbol pin ${JSON.stringify(symbolPin)}`
            );
        }
    }
}

export const circuitToSymbols = async (sch: { components: CircuitWithoutBlocks['components'] }) => {
    const symbols: SymbolWithMeta[] = [];
    const subParts: { [k: string]: string | undefined } = {};

    for await (const component of sch.components) {
        if (!component.part_uuid) {
            logger.error(component, "Fail get symbol partUuid is null");
            continue;
        }

        const partId = getPartIdFromDesignator(component.designator);

        const sym = await getSymbol(component.part_uuid, partId);

        if (!sym) {
            logger.error(component, "Fail get symbol partUuid");
            continue;
        }

        // checkPinNames(component.pins, sym.pins);

        let [left, top, right, bottom] = sym.rect;
        const PIN_LEN = 10;
        const PADDING = 10;

        left -= PADDING;
        right += PADDING;
        bottom += PADDING;
        top -= PADDING;

        const width = Math.max(right - left, 5);
        const height = Math.max(bottom - top, 5);

        for (const pin of sym.pins) {
            const pin_ = component.pins.find(p => p.pin_number == pin.num);

            if (pin_)
                pin.signal_name = pin_.signal_name;
            else {
                pin.signal_name = crypto.randomUUID().slice(0, 8);
                logger.debug({ component, "pin.num": pin.num }, "Pin not matched");
            }

            pin.x = Math.abs(left - pin.x);
            pin.y = Math.abs(bottom - pin.y);
            const dir = getPinDirection({ height, width }, pin);

            if (dir === 'LEFT') {
                pin.x -= PIN_LEN
            }
            else if (dir === 'RIGHT') {
                pin.x += PIN_LEN
            }
            else if (dir === 'BOTTOM') {
                pin.y += PIN_LEN
            }
            else if (dir === 'TOP') {
                pin.y -= PIN_LEN
            }
        }

        subParts[component.designator] = sym.pins?.[0]?.part;

        symbols.push({
            designator: component.designator,
            symbol: {
                center: {
                    x: Math.abs(left),
                    y: Math.abs(bottom)
                },
                height,
                width,
                pins: sym.pins,
            },
            block_name: component.block_name,
        });
    }

    return { nodes: symbols, subParts };
};

// circuitToSymbols({
//     components: [
//         {
//             "designator": "D1",
//             "value": "SS34",
//             "pins": [
//                 {
//                     "pin_number": "2",
//                     "name": "Anode",
//                     "signal_name": "GND"
//                 },
//                 {
//                     "pin_number": "1",
//                     "name": "K",
//                     "signal_name": "SW"
//                 }
//             ],
//             "block_name": "completionsa35",
//             "search_query": "SS34 Schottky diode SMA",
//             "part_uuid": "75e6b1339f914e0b959d5d9e03fcbdb4"
//         }
//     ]
// })
// await getSymbol('1d0651d49d734df2a4ee2a79153f6435')
// await getSymbol('4d018698282b47d4893c87aca1c32f67')
// await getSymbol('4d018698282b47d4893c87aca1c32f67')
// await getSymbol('4d018698282b47d4893c87aca1c32f67')
// await getSymbol('ad7803f04a89488b91b5b1aaa6ef6d43')
// await getSymbol('ad7803f04a89488b91b5b1aaa6ef6d43')
// await getSymbol('ad7803f04a89488b91b5b1aaa6ef6d43')
// await getSymbol('4d018698282b47d4893c87aca1c32f67', 0)
// await getSymbol('4d018698282b47d4893c87aca1c32f67', 0)
// await getSymbol('4d018698282b47d4893c87aca1c32f67', 0)
// await getSymbol('ad7803f04a89488b91b5b1aaa6ef6d43', 0)
// await getSymbol('ad7803f04a89488b91b5b1aaa6ef6d43', 0)
// await getSymbol('ad7803f04a89488b91b5b1aaa6ef6d43', 0)

// console.log(await getSymbol('ad7803f04a89488b91b5b1aaa6ef6d43', 0))

// console.log(await getSymbol('d3b9102748474b57b60bc076d117c790'))
