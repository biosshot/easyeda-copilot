import { getDesignatorLabel } from '#utils/component.ts';
import {
    chooseRotation,
    createMacroInstance,
    createPlacement,
    createShortSymbolPlacement,
    fitPlacements,
    localizePlacementPin,
    macroId,
    placementPin,
    setPinRoutingSignal,
    shortSymbolKindForSignal,
} from '../helpers.ts';
import type { CircuitLayoutPattern, MacroPort, OrthogonalSide, PatternMatch } from '../types.ts';
import { branchToGround, findOpAmpPins, isTwoPinKind } from './common.ts';

const PATTERN_ID = 'opamp-voltage-follower';
const PADDING = 15;
const OPAMP_X_WITH_SHUNTS = 80;
const OPAMP_Y_WITH_SHUNTS = 20;
const INPUT_SHUNT_LEFT_OFFSET = 20;
const INPUT_SHUNT_BOTTOM_GAP = 65;
const OUTPUT_SHUNT_RIGHT_OFFSET = 25;
const OUTPUT_SHUNT_TOP_GAP = 40;
const GROUND_GAP = 15;

function inward(side: OrthogonalSide): OrthogonalSide {
    if (side === 'NORTH') return 'SOUTH';
    if (side === 'SOUTH') return 'NORTH';
    if (side === 'EAST') return 'WEST';
    return 'EAST';
}

export const opAmpVoltageFollowerPattern: CircuitLayoutPattern = {
    id: PATTERN_ID,
    priority: 140,

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
                if (!plus || !minus || !output || minus.signal_name !== output.signal_name) continue;
                const uniqueGroundBranch = (signalName: string) => {
                    const candidates = resistors.filter(resistor => branchToGround(resistor, signalName));
                    return candidates.length === 1 ? candidates[0] : undefined;
                };
                const inputShunt = uniqueGroundBranch(plus.signal_name);
                const outputShunt = uniqueGroundBranch(output.signal_name);
                const designators = [opamp.designator];
                if (inputShunt) designators.push(inputShunt.designator);
                if (outputShunt && outputShunt.designator !== inputShunt?.designator) {
                    designators.push(outputShunt.designator);
                }
                matches.push({
                    patternId: PATTERN_ID,
                    priority: this.priority,
                    blockName,
                    designators,
                    roles: {
                        opamp: opamp.designator,
                        inputShunt: inputShunt?.designator ?? '',
                        outputShunt: outputShunt?.designator ?? '',
                        plusPin: String(pins.plus),
                        minusPin: String(pins.minus),
                        outputPin: String(pins.output),
                        plusSignal: plus.signal_name,
                        outputSignal: output.signal_name,
                    },
                });
            }
        }
        return matches;
    },

    instantiate(match, context) {
        const component = context.componentsByDesignator.get(match.roles.opamp);
        const symbol = context.symbolsByDesignator.get(match.roles.opamp);
        if (!component || !symbol) return null;
        const inputShuntComponent = match.roles.inputShunt
            ? context.componentsByDesignator.get(match.roles.inputShunt)
            : undefined;
        const outputShuntComponent = match.roles.outputShunt
            ? context.componentsByDesignator.get(match.roles.outputShunt)
            : undefined;
        const inputShuntSymbol = inputShuntComponent
            ? context.symbolsByDesignator.get(inputShuntComponent.designator)
            : undefined;
        const outputShuntSymbol = outputShuntComponent
            ? context.symbolsByDesignator.get(outputShuntComponent.designator)
            : undefined;
        if ((inputShuntComponent && !inputShuntSymbol) || (outputShuntComponent && !outputShuntSymbol)) return null;
        const geometry = chooseRotation(symbol.symbol, new Map([
            [match.roles.plusPin, 'WEST'],
            [match.roles.minusPin, 'WEST'],
            [match.roles.outputPin, 'EAST'],
        ]));
        const hasShunts = Boolean(inputShuntComponent || outputShuntComponent);
        const placement = createPlacement(symbol, geometry, geometry.rotation,
            hasShunts ? OPAMP_X_WITH_SHUNTS : 0,
            hasShunts ? OPAMP_Y_WITH_SHUNTS : 0);
        const placements = [placement];
        const id = macroId(PATTERN_ID, match.designators);
        const plus = placementPin(placement, match.roles.plusPin);
        const output = placementPin(placement, match.roles.outputPin);
        if (!plus || !output) return null;

        let inputShuntPlacement: ReturnType<typeof createPlacement> | undefined;
        let inputGroundPin: string | number | undefined;
        if (inputShuntComponent && inputShuntSymbol) {
            const branch = branchToGround(inputShuntComponent, match.roles.plusSignal);
            if (!branch) return null;
            const shuntGeometry = chooseRotation(inputShuntSymbol.symbol, new Map([
                [String(branch.signalPin.pin_number), 'WEST'],
                [String(branch.groundPin.pin_number), 'EAST'],
            ]));
            const signalPin = shuntGeometry.pins.find(pin => pin.num == branch.signalPin.pin_number);
            if (!signalPin) return null;
            inputShuntPlacement = createPlacement(inputShuntSymbol, shuntGeometry, shuntGeometry.rotation,
                plus.x - INPUT_SHUNT_LEFT_OFFSET - signalPin.x,
                placement.y + placement.height + INPUT_SHUNT_BOTTOM_GAP - signalPin.y);
            inputGroundPin = branch.groundPin.pin_number;
            placements.push(inputShuntPlacement);
        }

        let outputShuntPlacement: ReturnType<typeof createPlacement> | undefined;
        let outputGroundPin: string | number | undefined;
        if (outputShuntComponent && outputShuntSymbol) {
            const branch = branchToGround(outputShuntComponent, match.roles.outputSignal);
            if (!branch) return null;
            const shuntGeometry = chooseRotation(outputShuntSymbol.symbol, new Map([
                [String(branch.signalPin.pin_number), 'NORTH'],
                [String(branch.groundPin.pin_number), 'SOUTH'],
            ]));
            const signalPin = shuntGeometry.pins.find(pin => pin.num == branch.signalPin.pin_number);
            if (!signalPin) return null;
            outputShuntPlacement = createPlacement(outputShuntSymbol, shuntGeometry, shuntGeometry.rotation,
                output.x + OUTPUT_SHUNT_RIGHT_OFFSET - signalPin.x,
                output.y + OUTPUT_SHUNT_TOP_GAP - signalPin.y);
            outputGroundPin = branch.groundPin.pin_number;
            placements.push(outputShuntPlacement);
        }

        const shuntGroundPins = [
            inputShuntPlacement && inputGroundPin !== undefined
                ? { placement: inputShuntPlacement, pinNumber: inputGroundPin }
                : null,
            outputShuntPlacement && outputGroundPin !== undefined
                ? { placement: outputShuntPlacement, pinNumber: outputGroundPin }
                : null,
        ].filter(item => item !== null);
        if (shuntGroundPins.length) {
            const anchor = placementPin(
                outputShuntPlacement ?? inputShuntPlacement!,
                outputGroundPin ?? inputGroundPin!,
            );
            if (!anchor) return null;
            const ground = createShortSymbolPlacement({
                kind: 'GND', signalName: anchor.signal_name, blockName: match.blockName,
                scope: id, ordinal: 0, x: 0, y: 0,
            });
            ground.x = anchor.x - ground.width / 2;
            ground.y = anchor.y + GROUND_GAP;
            ground.pins[0].side = 'WEST';
            placements.splice(1, 0, ground);
            for (const shuntPin of shuntGroundPins) {
                setPinRoutingSignal(shuntPin.placement, shuntPin.pinNumber, ground.designator);
            }
        }

        const functional = new Set([match.roles.plusPin, match.roles.minusPin, match.roles.outputPin]);
        let ordinal = shuntGroundPins.length ? 1 : 0;
        for (const pin of component.pins) {
            if (functional.has(String(pin.pin_number)) || !shortSymbolKindForSignal(pin.signal_name)) continue;
            localizePlacementPin({ placements, placement, pinNumber: pin.pin_number,
                blockName: match.blockName, scope: id, ordinal: ordinal++ });
        }
        const fitted = fitPlacements(placements, PADDING);
        const fittedPlus = placementPin(placement, match.roles.plusPin);
        const fittedOutput = placementPin(placement, match.roles.outputPin);
        if (!fittedPlus || !fittedOutput) return null;
        const ports: Omit<MacroPort, 'elkPortId'>[] = [{
            key: 'IN', pinNumber: 'in', signalName: match.roles.plusSignal,
            x: 0, y: fittedPlus.y, side: 'WEST' as const, terminalSide: 'EAST' as const,
            primaryPinId: fittedPlus.id, tailMode: 'straight' as const,
        }, {
            key: 'OUT', pinNumber: 'out', signalName: match.roles.outputSignal,
            x: fitted.width, y: fittedOutput.y, side: 'EAST' as const, terminalSide: 'WEST' as const,
            primaryPinId: fittedOutput.id, tailMode: 'straight' as const,
        }];
        for (const pin of component.pins) {
            if (functional.has(String(pin.pin_number)) || shortSymbolKindForSignal(pin.signal_name)) continue;
            const primary = placementPin(placement, pin.pin_number);
            if (!primary || !pin.signal_name) continue;
            const side: OrthogonalSide = /VCC|VDD|V\+/i.test(pin.name) ? 'NORTH' : primary.side;
            ports.push({
                key: `P${ports.length}`, pinNumber: `p${ports.length}`, signalName: pin.signal_name,
                x: side === 'WEST' ? 0 : side === 'EAST' ? fitted.width : primary.x,
                y: side === 'NORTH' ? 0 : side === 'SOUTH' ? fitted.height : primary.y,
                side, terminalSide: inward(side), primaryPinId: primary.id,
                tailMode: 'straight',
            });
        }
        return createMacroInstance({
            id, patternId: PATTERN_ID, blockName: match.blockName,
            absorbedDesignators: match.designators, width: fitted.width, height: fitted.height,
            placements, ports, preferredBlockDirection: 'RIGHT',
        });
    },
};
