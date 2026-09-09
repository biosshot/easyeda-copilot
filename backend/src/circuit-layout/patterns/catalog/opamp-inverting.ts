import { getDesignatorLabel } from '#utils/component.ts';
import {
    chooseRotation,
    createMacroInstance,
    createPlacement,
    fitPlacements,
    isGroundSignal,
    localizePlacementPin,
    macroId,
    pinForSignal,
    placementPin,
    shortSymbolKindForSignal,
} from '../helpers.ts';
import type { CircuitLayoutPattern, OrthogonalSide, PatternMatch } from '../types.ts';
import { componentBetween, findOpAmpPins, isTwoPinKind } from './common.ts';

const PATTERN_ID = 'opamp-inverting';
const PADDING = 15;
const GAP = 25;

function inward(side: OrthogonalSide): OrthogonalSide {
    if (side === 'NORTH') return 'SOUTH';
    if (side === 'SOUTH') return 'NORTH';
    if (side === 'EAST') return 'WEST';
    return 'EAST';
}

export const opAmpInvertingPattern: CircuitLayoutPattern = {
    id: PATTERN_ID,
    priority: 130,

    findMatches(context) {
        const matches: PatternMatch[] = [];
        for (const [blockName, components] of context.componentsByBlock) {
            const resistors = components.filter(component =>
                isTwoPinKind(component, 'resistor') && context.symbolsByDesignator.has(component.designator));
            for (const opamp of components) {
                if (getDesignatorLabel(opamp.designator) !== 'Микросхемы') continue;
                const symbol = context.symbolsByDesignator.get(opamp.designator);
                if (!symbol) continue;
                const pins = findOpAmpPins(opamp, symbol);
                if (!pins) continue;
                const plus = opamp.pins.find(pin => pin.pin_number == pins.plus);
                const minus = opamp.pins.find(pin => pin.pin_number == pins.minus);
                const output = opamp.pins.find(pin => pin.pin_number == pins.output);
                if (!plus || !minus || !output || minus.signal_name === output.signal_name) continue;
                for (const feedback of resistors.filter(resistor =>
                    componentBetween(resistor, minus.signal_name, output.signal_name))) {
                    for (const input of resistors) {
                        if (input.designator === feedback.designator
                            || !input.pins.some(pin => pin.signal_name === minus.signal_name)) continue;
                        const inputOuter = input.pins.find(pin => pin.signal_name !== minus.signal_name);
                        if (!inputOuter || isGroundSignal(inputOuter.signal_name)) continue;
                        const allowed = new Set([opamp.designator, feedback.designator, input.designator]);
                        const minusEndpoints = context.signalEndpoints.get(minus.signal_name) ?? [];
                        if (minusEndpoints.some(endpoint => !allowed.has(endpoint.designator))) continue;
                        matches.push({
                            patternId: PATTERN_ID,
                            priority: this.priority,
                            blockName,
                            designators: [...allowed],
                            roles: {
                                opamp: opamp.designator,
                                feedback: feedback.designator,
                                input: input.designator,
                                plusPin: String(pins.plus),
                                minusPin: String(pins.minus),
                                outputPin: String(pins.output),
                                plusSignal: plus.signal_name,
                                minusSignal: minus.signal_name,
                                outputSignal: output.signal_name,
                                inputSignal: inputOuter.signal_name,
                            },
                        });
                    }
                }
            }
        }
        return matches;
    },

    instantiate(match, context) {
        const opamp = context.componentsByDesignator.get(match.roles.opamp);
        const feedback = context.componentsByDesignator.get(match.roles.feedback);
        const input = context.componentsByDesignator.get(match.roles.input);
        const opampSymbol = context.symbolsByDesignator.get(match.roles.opamp);
        const feedbackSymbol = context.symbolsByDesignator.get(match.roles.feedback);
        const inputSymbol = context.symbolsByDesignator.get(match.roles.input);
        if (!opamp || !feedback || !input || !opampSymbol || !feedbackSymbol || !inputSymbol) return null;
        const feedbackMinus = pinForSignal(feedback, match.roles.minusSignal);
        const feedbackOutput = pinForSignal(feedback, match.roles.outputSignal);
        const inputMinus = pinForSignal(input, match.roles.minusSignal);
        const inputOuter = pinForSignal(input, match.roles.inputSignal);
        if (!feedbackMinus || !feedbackOutput || !inputMinus || !inputOuter) return null;

        const opampGeometry = chooseRotation(opampSymbol.symbol, new Map([
            [match.roles.plusPin, 'WEST'], [match.roles.minusPin, 'WEST'], [match.roles.outputPin, 'EAST'],
        ]));
        const feedbackGeometry = chooseRotation(feedbackSymbol.symbol, new Map([
            [String(feedbackMinus.pin_number), 'WEST'], [String(feedbackOutput.pin_number), 'EAST'],
        ]));
        const inputGeometry = chooseRotation(inputSymbol.symbol, new Map([
            [String(inputOuter.pin_number), 'WEST'], [String(inputMinus.pin_number), 'EAST'],
        ]));
        const opampPlacement = createPlacement(opampSymbol, opampGeometry, opampGeometry.rotation, 100, 55);
        const minus = placementPin(opampPlacement, match.roles.minusPin);
        const output = placementPin(opampPlacement, match.roles.outputPin);
        const inputMinusGeometry = inputGeometry.pins.find(pin => pin.num == inputMinus.pin_number);
        const feedbackMinusGeometry = feedbackGeometry.pins.find(pin => pin.num == feedbackMinus.pin_number);
        if (!minus || !output || !inputMinusGeometry || !feedbackMinusGeometry) return null;
        const inputPlacement = createPlacement(inputSymbol, inputGeometry, inputGeometry.rotation,
            minus.x - GAP - inputMinusGeometry.x - 50, minus.y - inputMinusGeometry.y);
        const feedbackPlacement = createPlacement(feedbackSymbol, feedbackGeometry, feedbackGeometry.rotation,
            minus.x - feedbackMinusGeometry.x - 40, -50);
        const placements = [opampPlacement, inputPlacement, feedbackPlacement];
        const id = macroId(PATTERN_ID, match.designators);
        const functional = new Set([match.roles.plusPin, match.roles.minusPin, match.roles.outputPin]);
        let ordinal = 0;
        for (const pin of opamp.pins) {
            if (pin.pin_number == match.roles.plusPin && shortSymbolKindForSignal(pin.signal_name)) {
                localizePlacementPin({
                    placements, placement: opampPlacement, pinNumber: pin.pin_number,
                    blockName: match.blockName, scope: id, ordinal: ordinal++, hgap: +10
                });
            } else if (!functional.has(String(pin.pin_number)) && shortSymbolKindForSignal(pin.signal_name)) {
                localizePlacementPin({
                    placements, placement: opampPlacement, pinNumber: pin.pin_number,
                    blockName: match.blockName, scope: id, ordinal: ordinal++
                });
            }
        }
        const fitted = fitPlacements(placements, PADDING);
        const inputPrimary = placementPin(inputPlacement, inputOuter.pin_number);
        const outputPrimary = placementPin(opampPlacement, match.roles.outputPin);
        if (!inputPrimary || !outputPrimary) return null;
        const ports: Parameters<typeof createMacroInstance>[0]['ports'] = [{
            key: 'IN', pinNumber: 'in', signalName: match.roles.inputSignal,
            x: 0, y: inputPrimary.y, side: 'WEST', terminalSide: 'EAST',
            primaryPinId: inputPrimary.id, tailMode: 'straight',
        }, {
            key: 'OUT', pinNumber: 'out', signalName: match.roles.outputSignal,
            x: fitted.width, y: outputPrimary.y, side: 'EAST', terminalSide: 'WEST',
            primaryPinId: outputPrimary.id, tailMode: 'straight',
        }];
        const plusPin = opamp.pins.find(pin => pin.pin_number == match.roles.plusPin);
        if (plusPin && !shortSymbolKindForSignal(plusPin.signal_name)) {
            const primary = placementPin(opampPlacement, plusPin.pin_number);
            if (!primary) return null;
            ports.push({
                key: 'REF', pinNumber: 'ref', signalName: plusPin.signal_name,
                x: 0, y: primary.y, side: 'WEST', terminalSide: 'EAST', primaryPinId: primary.id
            });
        }
        for (const pin of opamp.pins) {
            if (functional.has(String(pin.pin_number)) || shortSymbolKindForSignal(pin.signal_name)) continue;
            const primary = placementPin(opampPlacement, pin.pin_number);
            if (!primary) continue;
            const side: OrthogonalSide = /VCC|VDD|V\+/i.test(pin.name) ? 'NORTH' : primary.side;
            ports.push({
                key: `P${ports.length}`, pinNumber: `p${ports.length}`, signalName: pin.signal_name,
                x: side === 'WEST' ? 0 : side === 'EAST' ? fitted.width : primary.x,
                y: side === 'NORTH' ? 0 : side === 'SOUTH' ? fitted.height : primary.y,
                side, terminalSide: inward(side), primaryPinId: primary.id
            });
        }
        return createMacroInstance({
            id, patternId: PATTERN_ID, blockName: match.blockName,
            absorbedDesignators: match.designators, width: fitted.width, height: fitted.height,
            placements, ports, preferredBlockDirection: 'RIGHT'
        });
    },
};
