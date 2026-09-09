import { getDesignatorLabel } from '#utils/component.ts';
import {
    chooseRotation,
    createMacroInstance,
    createPlacement,
    createShortSymbolPlacement,
    isGroundSignal,
    macroBounds,
    macroId,
    pinForSignal,
    placementPin,
    setPinRoutingSignal,
    shortSymbolKindForSignal,
    sharedSignals,
    translatePlacements,
} from '../helpers.ts';
import type { CircuitComponent } from '#types/circuit.ts';
import type { SymbolWithMeta } from '#types/symbol.ts';
import type { CircuitLayoutPattern, OrthogonalSide, PatternMatch } from '../types.ts';

const PATTERN_ID = 'opamp-noninverting';
const OPAMP_PATTERN_PADDING = 25;
const RESISTOR_GAP = 15;
const OPAMP_HORIZONTAL_GAP = 50;
const OPAMP_VERTICAL_GAP = 60;
const LOCAL_SHORT_GAP = 15;

type OpAmpPins = {
    plus: string | number;
    minus: string | number;
    output: string | number;
};

function normalizePinName(name: string) {
    return name.toUpperCase()
        .replace(/[−–—]/g, '-')
        .replace(/[^A-Z0-9+-]/g, '');
}

function findOpAmpPins(component: CircuitComponent, symbol: SymbolWithMeta): OpAmpPins | null {
    const names = new Map<string, string[]>();
    for (const pin of component.pins) {
        names.set(String(pin.pin_number), [normalizePinName(pin.name)]);
    }
    for (const pin of symbol.symbol.pins) {
        const values = names.get(String(pin.num)) ?? [];
        values.push(normalizePinName(pin.name));
        names.set(String(pin.num), values);
    }

    let plus: string | number | undefined;
    let minus: string | number | undefined;
    let output: string | number | undefined;
    for (const pin of component.pins) {
        const variants = names.get(String(pin.pin_number)) ?? [];
        if (variants.some(name => name === '+'
            || name.includes('IN+')
            || name.includes('+IN')
            || /^IN[A-Z0-9]*\+$/.test(name)
            || (name.includes('INPUT') && name.endsWith('+'))
            || name.includes('NONINVERT'))) {
            plus = pin.pin_number;
            continue;
        }
        if (variants.some(name => name === '-'
            || name.includes('IN-')
            || name.includes('-IN')
            || /^IN[A-Z0-9]*-$/.test(name)
            || (name.includes('INPUT') && name.endsWith('-'))
            || (/INV/.test(name) && !/NONINV/.test(name)))) {
            minus = pin.pin_number;
            continue;
        }
        if (variants.some(name => name.includes('OUT'))) output = pin.pin_number;
    }
    return plus !== undefined && minus !== undefined && output !== undefined
        ? { plus, minus, output }
        : null;
}

function resistorBetween(component: CircuitComponent, leftSignal: string, rightSignal: string) {
    if (component.pins.length !== 2) return false;
    const signals = new Set(component.pins.map(pin => pin.signal_name));
    return signals.size === 2 && signals.has(leftSignal) && signals.has(rightSignal);
}

function inwardSide(side: OrthogonalSide): OrthogonalSide {
    if (side === 'NORTH') return 'SOUTH';
    if (side === 'SOUTH') return 'NORTH';
    if (side === 'EAST') return 'WEST';
    return 'EAST';
}

export const opAmpNonInvertingPattern: CircuitLayoutPattern = {
    id: PATTERN_ID,
    priority: 100,

    findMatches(context) {
        const matches: PatternMatch[] = [];

        for (const [blockName, components] of context.componentsByBlock) {
            const resistors = components.filter(component =>
                getDesignatorLabel(component.designator) === 'Резисторы'
                && component.pins.length === 2
                && context.symbolsByDesignator.has(component.designator));

            for (const opamp of components) {
                if (getDesignatorLabel(opamp.designator) !== 'Микросхемы') continue;
                const symbol = context.symbolsByDesignator.get(opamp.designator);
                if (!symbol) continue;
                const pins = findOpAmpPins(opamp, symbol);
                if (!pins) continue;

                const plusPin = opamp.pins.find(pin => pin.pin_number == pins.plus);
                const minusPin = opamp.pins.find(pin => pin.pin_number == pins.minus);
                const outputPin = opamp.pins.find(pin => pin.pin_number == pins.output);
                if (!plusPin || !minusPin || !outputPin) continue;
                if (!plusPin.signal_name || !minusPin.signal_name || !outputPin.signal_name) continue;

                for (const feedback of resistors) {
                    if (!resistorBetween(feedback, outputPin.signal_name, minusPin.signal_name)) continue;
                    for (const groundLeg of resistors) {
                        if (groundLeg.designator === feedback.designator) continue;
                        const shared = sharedSignals(groundLeg, feedback);
                        if (shared.length !== 1 || shared[0] !== minusPin.signal_name) continue;
                        const groundPin = groundLeg.pins.find(pin => pin.signal_name !== minusPin.signal_name);
                        if (!groundPin || !isGroundSignal(groundPin.signal_name)) continue;

                        const designators = [opamp.designator, feedback.designator, groundLeg.designator];
                        const allowed = new Set(designators);
                        const minusEndpoints = context.signalEndpoints.get(minusPin.signal_name) ?? [];
                        if (minusEndpoints.some(endpoint => !allowed.has(endpoint.designator))) continue;

                        matches.push({
                            patternId: PATTERN_ID,
                            priority: this.priority,
                            blockName,
                            designators,
                            roles: {
                                opamp: opamp.designator,
                                feedback: feedback.designator,
                                groundLeg: groundLeg.designator,
                                plusPin: String(pins.plus),
                                minusPin: String(pins.minus),
                                outputPin: String(pins.output),
                                minusSignal: minusPin.signal_name,
                            },
                        });
                    }
                }
            }
        }

        return matches;
    },

    instantiate(match, context) {
        const opampComponent = context.componentsByDesignator.get(match.roles.opamp);
        const feedbackComponent = context.componentsByDesignator.get(match.roles.feedback);
        const groundComponent = context.componentsByDesignator.get(match.roles.groundLeg);
        const opampSymbol = context.symbolsByDesignator.get(match.roles.opamp);
        const feedbackSymbol = context.symbolsByDesignator.get(match.roles.feedback);
        const groundSymbol = context.symbolsByDesignator.get(match.roles.groundLeg);
        if (!opampComponent || !feedbackComponent || !groundComponent
            || !opampSymbol || !feedbackSymbol || !groundSymbol) return null;

        const plusPinNumber = match.roles.plusPin;
        const minusPinNumber = match.roles.minusPin;
        const outputPinNumber = match.roles.outputPin;
        const minusSignal = match.roles.minusSignal;
        const outputSignal = opampComponent.pins.find(pin => pin.pin_number == outputPinNumber)?.signal_name;
        if (!outputSignal) return null;

        const feedbackMinusPin = pinForSignal(feedbackComponent, minusSignal);
        const feedbackOutputPin = pinForSignal(feedbackComponent, outputSignal);
        const groundMinusPin = pinForSignal(groundComponent, minusSignal);
        const groundOuterPin = groundComponent.pins.find(pin => pin.signal_name !== minusSignal);
        if (!feedbackMinusPin || !feedbackOutputPin || !groundMinusPin || !groundOuterPin) return null;

        const id = macroId(PATTERN_ID, match.designators);
        const opampGeometry = chooseRotation(opampSymbol.symbol, new Map([
            [String(plusPinNumber), 'WEST'],
            [String(minusPinNumber), 'WEST'],
            [String(outputPinNumber), 'EAST'],
        ]));
        const feedbackGeometry = chooseRotation(feedbackSymbol.symbol, new Map([
            [String(feedbackMinusPin.pin_number), 'WEST'],
            [String(feedbackOutputPin.pin_number), 'EAST'],
        ]));
        const groundGeometry = chooseRotation(groundSymbol.symbol, new Map([
            [String(groundOuterPin.pin_number), 'WEST'],
            [String(groundMinusPin.pin_number), 'EAST'],
        ]));

        const opampMinusGeometryPin = opampGeometry.pins.find(pin => pin.num == minusPinNumber);
        const feedbackMinusGeometryPin = feedbackGeometry.pins.find(pin => pin.num == feedbackMinusPin.pin_number);
        const groundMinusGeometryPin = groundGeometry.pins.find(pin => pin.num == groundMinusPin.pin_number);
        if (!opampMinusGeometryPin || !feedbackMinusGeometryPin || !groundMinusGeometryPin) return null;

        const resistorPinY = OPAMP_PATTERN_PADDING + groundGeometry.height / 2;
        const groundPlacementX = OPAMP_PATTERN_PADDING;
        const resistorJunctionX = groundPlacementX + groundMinusGeometryPin.x + RESISTOR_GAP;
        const opampMinusX = resistorJunctionX + OPAMP_HORIZONTAL_GAP;
        const opampMinusY = resistorPinY
            + groundGeometry.height / 2
            + OPAMP_VERTICAL_GAP
            + opampMinusGeometryPin.y;
        const opampPlacement = createPlacement(
            opampSymbol,
            opampGeometry,
            opampGeometry.rotation,
            opampMinusX - opampMinusGeometryPin.x,
            opampMinusY - opampMinusGeometryPin.y,
        );
        const opampMinus = placementPin(opampPlacement, minusPinNumber);
        const opampOutput = placementPin(opampPlacement, outputPinNumber);
        if (!opampMinus || !opampOutput) return null;

        const feedbackPlacement = createPlacement(
            feedbackSymbol,
            feedbackGeometry,
            feedbackGeometry.rotation,
            resistorJunctionX + RESISTOR_GAP - feedbackMinusGeometryPin.x,
            resistorPinY - feedbackMinusGeometryPin.y,
        );
        const groundPlacement = createPlacement(
            groundSymbol,
            groundGeometry,
            groundGeometry.rotation,
            groundPlacementX,
            resistorPinY - groundMinusGeometryPin.y,
        );
        const groundOuter = placementPin(groundPlacement, groundOuterPin.pin_number);
        if (!groundOuter) return null;

        const generatedPlacements = [] as typeof opampPlacement[];
        const localizedSignals = new Set<string>();
        const ordinals = { GND: 0, VCC: 0 };
        const addLocalShort = (
            placement: typeof opampPlacement,
            pinNumber: string | number,
            signalName: string,
            kind: 'GND' | 'VCC',
            x: number,
            y: number,
        ) => {
            const shortPlacement = createShortSymbolPlacement({
                kind,
                signalName,
                blockName: match.blockName,
                scope: id,
                ordinal: ordinals[kind]++,
                x,
                y,
            });
            setPinRoutingSignal(placement, pinNumber, shortPlacement.designator);
            generatedPlacements.push(shortPlacement);
            localizedSignals.add(signalName);
            return shortPlacement;
        };

        const groundShort = addLocalShort(
            groundPlacement,
            groundOuterPin.pin_number,
            groundOuterPin.signal_name,
            'GND',
            groundOuter.x,
            resistorPinY + Math.max(LOCAL_SHORT_GAP, groundGeometry.height / 2 + 5),
        );
        groundShort.x = (groundOuter.x - groundShort.width / 2) - 5;

        const functionalPins = new Set([String(plusPinNumber), String(minusPinNumber), String(outputPinNumber)]);
        for (const pin of opampPlacement.pins) {
            if (functionalPins.has(String(pin.num)) || !pin.signal_name) continue;
            const kind = shortSymbolKindForSignal(pin.signal_name);
            if (!kind) continue;
            const absolute = placementPin(opampPlacement, pin.num);
            if (!absolute) continue;
            const shortPlacement = addLocalShort(
                opampPlacement,
                pin.num,
                pin.signal_name,
                kind,
                absolute.x,
                absolute.y,
            );
            const centeredX = absolute.x - shortPlacement.width / 2;
            shortPlacement.x = kind === 'VCC'
                ? Math.max(
                    centeredX,
                    feedbackPlacement.x + feedbackPlacement.width + LOCAL_SHORT_GAP,
                )
                : centeredX;
            shortPlacement.y = kind === 'VCC'
                ? absolute.y - shortPlacement.height - LOCAL_SHORT_GAP
                : absolute.y + LOCAL_SHORT_GAP;
        }

        const placements = [opampPlacement, feedbackPlacement, groundPlacement, ...generatedPlacements];
        const bounds = macroBounds(placements);
        translatePlacements(placements, OPAMP_PATTERN_PADDING - bounds.minX, OPAMP_PATTERN_PADDING - bounds.minY);
        const width = bounds.maxX - bounds.minX + OPAMP_PATTERN_PADDING * 2;
        const height = bounds.maxY - bounds.minY + OPAMP_PATTERN_PADDING * 2;

        const allPins = placements.flatMap(placement => placement.pins.map(pin => ({
            placement,
            pin,
            x: placement.x + pin.x,
            y: placement.y + pin.y,
        })));
        const signalPins = new Map<string, typeof allPins>();
        for (const pin of allPins) {
            if (!pin.pin.signal_name) continue;
            const pins = signalPins.get(pin.pin.signal_name) ?? [];
            pins.push(pin);
            signalPins.set(pin.pin.signal_name, pins);
        }

        const plusSignal = opampComponent.pins.find(pin => pin.pin_number == plusPinNumber)?.signal_name;
        const ports = [] as Parameters<typeof createMacroInstance>[0]['ports'];
        let ordinal = 0;
        for (const [signalName, pins] of signalPins) {
            if (signalName === minusSignal || localizedSignals.has(signalName)
                || !signalName || /^NC$/i.test(signalName)) continue;

            let primary = pins[0];
            let side: OrthogonalSide = primary.pin.side;
            if (signalName === plusSignal) {
                primary = pins.find(pin => pin.placement.designator === opampComponent.designator
                    && pin.pin.num == plusPinNumber) ?? primary;
                side = 'WEST';
            } else if (signalName === outputSignal) {
                primary = pins.find(pin => pin.placement.designator === opampComponent.designator
                    && pin.pin.num == outputPinNumber) ?? primary;
                side = 'EAST';
            } else if (/VCC|VDD|V\+|AVDD|DVDD/i.test(signalName)) {
                side = 'NORTH';
            } else if (/VEE|VSS|V-|AVSS|DVSS/i.test(signalName)) {
                side = 'SOUTH';
            }

            const x = side === 'WEST' ? 0 : side === 'EAST' ? width : primary.x;
            const y = side === 'NORTH' ? 0 : side === 'SOUTH' ? height : primary.y;
            const key = `P${ordinal++}`;
            ports.push({
                key,
                pinNumber: key.toLowerCase(),
                signalName,
                x,
                y,
                side,
                terminalSide: inwardSide(side),
                primaryPinId: primary.pin.id,
            });
        }

        if (!ports.some(port => port.signalName === plusSignal)
            || !ports.some(port => port.signalName === outputSignal)) return null;

        return createMacroInstance({
            id,
            patternId: PATTERN_ID,
            blockName: match.blockName,
            absorbedDesignators: match.designators,
            width,
            height,
            placements,
            ports,
            preferredBlockDirection: 'RIGHT',
        });
    },
};
