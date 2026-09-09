import { type Circuit, type CircuitComponent, type Pin } from "#types/circuit.ts";
import { getSymbol } from "#devices/symbols/symbol-parser.ts";
import masterLogger from "#logger.ts";
import { writeFileSync } from "fs";
import { type SymbolPin } from "#types/symbol.ts";
import { countDiffChars } from "#utils/math.ts";

const logger = masterLogger.child({ TAG: 'searchManyPartComponentAndSplit' });

export async function splitMultiPartComponent(circuit: Circuit) {
    // Iterate over a copy because we'll mutate circuit.components
    const components = [...circuit.components];

    for (const component of components) {
        if (!component.part_uuid) continue;

        let symbol;
        try {
            symbol = await getSymbol(component.part_uuid);
        } catch (err) {
            logger.error({ err, part_uuid: component.part_uuid }, 'getSymbol failed');
            continue;
        }

        if (!symbol || symbol.pins.length === 0) continue;
        // console.log(symbol.pins)

        const parts = [...new Set<string>(symbol.pins.map(p => p.part))];
        if (parts.length <= 1) continue;

        const partToPins: Record<string, SymbolPin[] | undefined> = {};
        for (const p of symbol.pins) {
            const pins = partToPins[p.part] ?? [];
            pins.push(p);
            partToPins[p.part] = pins;
        }

        const mapOtherPinToFirstChanPin: Record<string, { [pin: string]: SymbolPin }> = {};
        const firstChannelPins = partToPins[parts[0]]!;
        let sharedPins: (number | string)[] = component.pins.map(p => p.pin_number);

        for (const part of parts.slice(1)) {
            const pins = partToPins[part];
            if (!pins) continue;
            const pinmap: { [pin: string]: SymbolPin } = {};

            for (const pin of pins) {
                let otherPin: SymbolPin | undefined;

                let min = Infinity;

                for (const pin_ of firstChannelPins) {
                    const diff = countDiffChars(pin_.name, pin.name);

                    if (min > diff && diff <= 2) {
                        otherPin = pin_;
                        min = diff;
                    }
                }

                if (otherPin) {
                    pinmap[pin.num] = otherPin;
                    sharedPins = sharedPins.filter(pn => pn != pin.num && pn != otherPin.num)
                }
            }

            mapOtherPinToFirstChanPin[part] = pinmap;
        }

        const newComponents: CircuitComponent[] = [];
        let idx = 1;
        for (const part of parts) {
            const partPins = partToPins[part];
            if (!partPins) continue;
            const mappedPin = mapOtherPinToFirstChanPin[part];

            const newPins: Pin[] = component.pins
                .filter(pin => partPins.find(p => p.num == pin.pin_number) && pin.signal_name.length && pin.signal_name.toUpperCase() !== 'NC')
                .map(pin => {
                    const mp = pin;
                    // const mp = mappedPin?.[pin.pin_number];
                    // if (!mp) return pin;
                    return { ...pin, name: mp.name, pin_number: mp.pin_number }
                });

            if (!newPins.length) {
                logger.debug({ component }, "New pins is empty split not required")
                continue;
            }

            // for (const sharedNum of sharedPins) {
            //     if (newPins.find(p => p.pin_number == sharedNum)) continue;
            //     const sharedInNew = newComponents[0]?.pins.find(p => p.pin_number == sharedNum)
            //     if (!sharedInNew) continue;

            //     newPins.push(sharedInNew)
            // }

            let ndesignator = `${component.designator}.${idx}`;

            if (component.designator.indexOf('.') !== -1) ndesignator = component.designator;

            newComponents.push({
                ...component,
                designator: ndesignator,
                pins: newPins
            })

            idx++;
        }

        const origIndex = circuit.components.findIndex(c => c.designator === component.designator);
        if (origIndex === -1) {
            circuit.components = circuit.components.filter(c => c.designator !== component.designator);
            circuit.components.push(...newComponents);
        } else {
            circuit.components.splice(origIndex, 1, ...newComponents);
        }
    }

    return circuit
}

// console.log(await getSymbol('50a68d56924049f8ba698a03698c50ca'))

// @ts-ignore
// searchManyPartComponentAndSplit({
//     "components": [
//         {
//             "designator": "U1",
//             "value": "LM393",
//             "pins": [
//                 {
//                     "pin_number": 1,
//                     "name": "1OUT1",
//                     "signal_name": "OUT_3V"
//                 },
//                 {
//                     "pin_number": 2,
//                     "name": "1IN-",
//                     "signal_name": "VIN_TEST"
//                 },
//                 {
//                     "pin_number": 3,
//                     "name": "1IN+",
//                     "signal_name": "VREF_3V"
//                 },
//                 {
//                     "pin_number": 4,
//                     "name": "VEE",
//                     "signal_name": "GND"
//                 },
//                 {
//                     "pin_number": 5,
//                     "name": "2IN+",
//                     "signal_name": "VREF_5V"
//                 },
//                 {
//                     "pin_number": 6,
//                     "name": "2IN-",
//                     "signal_name": "VIN_TEST"
//                 },
//                 {
//                     "pin_number": 7,
//                     "name": "2OUT",
//                     "signal_name": "OUT_5V"
//                 },
//                 {
//                     "pin_number": 8,
//                     "name": "VCC",
//                     "signal_name": "+12V"
//                 }
//             ],
//             "block_name": "Comparators_LM393",
//             "search_query": "LM393",
//             "part_uuid": "50a68d56924049f8ba698a03698c50ca"
//         },
//     ]
// }).then(d => writeFileSync('.test-output/splitted-circuit.json', JSON.stringify(d, null, 2)))
