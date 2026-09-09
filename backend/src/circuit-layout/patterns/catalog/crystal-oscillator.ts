import { getDesignatorLabel } from '#utils/component.ts';
import {
    chooseRotation,
    createMacroInstance,
    createPlacement,
    createShortSymbolPlacement,
    fitPlacements,
    isGroundSignal,
    localizePlacementPin,
    macroId,
    pinForSignal,
    placementPin,
    setPinRoutingSignal,
} from '../helpers.ts';
import type { CircuitLayoutPattern, PatternMatch } from '../types.ts';
import { branchToGround, componentBetween, isTwoPinKind } from './common.ts';

const PATTERN_ID = 'crystal-oscillator';
const PADDING = 10;
const GAP = 15;
const CAP_VERTICAL_GAP = 0;
const SERIES_HORIZONTAL_GAP = 55;
const LEFT_GROUND_HORIZONTAL_GAP = 35 + GAP;

export const crystalOscillatorPattern: CircuitLayoutPattern = {
    id: PATTERN_ID,
    priority: 120,

    findMatches(context) {
        const matches: PatternMatch[] = [];
        for (const [blockName, components] of context.componentsByBlock) {
            const capacitors = components.filter(component =>
                isTwoPinKind(component, 'capacitor') && context.symbolsByDesignator.has(component.designator));
            const resistors = components.filter(component =>
                isTwoPinKind(component, 'resistor') && context.symbolsByDesignator.has(component.designator));

            for (const crystal of components) {
                const symbol = context.symbolsByDesignator.get(crystal.designator);
                if (!symbol || crystal.pins.length !== 4) continue;
                const looksLikeCrystal = getDesignatorLabel(crystal.designator) === 'Кварцевые резонаторы'
                    || /(?:XTAL|CRYSTAL|\d+(?:\.\d+)?\s*[KM]HZ)/i.test(`${crystal.value} ${crystal.search_query}`);
                if (!looksLikeCrystal) continue;
                const signalPins = crystal.pins.filter(pin => !isGroundSignal(pin.signal_name));
                const groundPins = crystal.pins.filter(pin => isGroundSignal(pin.signal_name));
                if (signalPins.length !== 2 || groundPins.length !== 2
                    || signalPins[0].signal_name === signalPins[1].signal_name) continue;

                let leftPin = signalPins.find(pin => /XIN|OSCIN/i.test(pin.signal_name)) ?? signalPins[0];
                let rightPin = signalPins.find(pin => /XOUT|OSCOUT/i.test(pin.signal_name)) ?? signalPins[1];
                if (leftPin.pin_number == rightPin.pin_number) [leftPin, rightPin] = signalPins;

                const leftCaps = capacitors.filter(cap => branchToGround(cap, leftPin.signal_name));
                const rightCaps = capacitors.filter(cap => branchToGround(cap, rightPin.signal_name));
                for (const leftCap of leftCaps) {
                    for (const rightCap of rightCaps) {
                        if (leftCap.designator === rightCap.designator) continue;
                        const series = resistors.find(resistor => resistor.pins.some(pin =>
                            pin.signal_name === rightPin.signal_name)
                            && resistor.pins.some(pin => pin.signal_name !== rightPin.signal_name
                                && !isGroundSignal(pin.signal_name)));
                        const designators = [crystal.designator, leftCap.designator, rightCap.designator];
                        if (series) designators.push(series.designator);
                        matches.push({
                            patternId: PATTERN_ID,
                            priority: this.priority,
                            blockName,
                            designators,
                            roles: {
                                crystal: crystal.designator,
                                leftCap: leftCap.designator,
                                rightCap: rightCap.designator,
                                series: series?.designator ?? '',
                                leftSignal: leftPin.signal_name,
                                rightSignal: rightPin.signal_name,
                            },
                        });
                    }
                }
            }
        }
        return matches;
    },

    instantiate(match, context) {
        const crystalComponent = context.componentsByDesignator.get(match.roles.crystal);
        const leftCapComponent = context.componentsByDesignator.get(match.roles.leftCap);
        const rightCapComponent = context.componentsByDesignator.get(match.roles.rightCap);
        const seriesComponent = match.roles.series
            ? context.componentsByDesignator.get(match.roles.series)
            : undefined;
        const crystalSymbol = context.symbolsByDesignator.get(match.roles.crystal);
        const leftCapSymbol = context.symbolsByDesignator.get(match.roles.leftCap);
        const rightCapSymbol = context.symbolsByDesignator.get(match.roles.rightCap);
        const seriesSymbol = seriesComponent
            ? context.symbolsByDesignator.get(seriesComponent.designator)
            : undefined;
        if (!crystalComponent || !leftCapComponent || !rightCapComponent
            || !crystalSymbol || !leftCapSymbol || !rightCapSymbol
            || (seriesComponent && !seriesSymbol)) return null;

        const leftCrystalPin = pinForSignal(crystalComponent, match.roles.leftSignal);
        const rightCrystalPin = pinForSignal(crystalComponent, match.roles.rightSignal);
        const leftBranch = branchToGround(leftCapComponent, match.roles.leftSignal);
        const rightBranch = branchToGround(rightCapComponent, match.roles.rightSignal);
        if (!leftCrystalPin || !rightCrystalPin || !leftBranch || !rightBranch) return null;

        const crystalGeometry = chooseRotation(crystalSymbol.symbol, new Map([
            [String(leftCrystalPin.pin_number), 'WEST'],
            [String(rightCrystalPin.pin_number), 'EAST'],
        ]));
        const leftCapGeometry = chooseRotation(leftCapSymbol.symbol, new Map([
            [String(leftBranch.signalPin.pin_number), 'NORTH'],
            [String(leftBranch.groundPin.pin_number), 'SOUTH'],
        ]));
        const rightCapGeometry = chooseRotation(rightCapSymbol.symbol, new Map([
            [String(rightBranch.signalPin.pin_number), 'NORTH'],
            [String(rightBranch.groundPin.pin_number), 'SOUTH'],
        ]));
        const crystalPlacement = createPlacement(crystalSymbol, crystalGeometry, crystalGeometry.rotation, 0, 0);
        const crystalLeft = placementPin(crystalPlacement, leftCrystalPin.pin_number);
        const crystalRight = placementPin(crystalPlacement, rightCrystalPin.pin_number);
        const leftCapSignalPin = leftCapGeometry.pins.find(pin => pin.num == leftBranch.signalPin.pin_number);
        const rightCapSignalPin = rightCapGeometry.pins.find(pin => pin.num == rightBranch.signalPin.pin_number);
        if (!crystalLeft || !crystalRight || !leftCapSignalPin || !rightCapSignalPin) return null;

        const capY = crystalPlacement.height + CAP_VERTICAL_GAP;
        const leftCapPlacement = createPlacement(leftCapSymbol, leftCapGeometry, leftCapGeometry.rotation,
            crystalLeft.x - leftCapSignalPin.x - 5, capY - leftCapSignalPin.y);
        const rightCapPlacement = createPlacement(rightCapSymbol, rightCapGeometry, rightCapGeometry.rotation,
            crystalRight.x - rightCapSignalPin.x + 40, capY - rightCapSignalPin.y);
        const placements = [crystalPlacement, leftCapPlacement, rightCapPlacement];

        let outputPlacement = crystalPlacement;
        let outputPinNumber = rightCrystalPin.pin_number;
        let outputSignal = match.roles.rightSignal;
        if (seriesComponent && seriesSymbol) {
            const seriesInner = pinForSignal(seriesComponent, match.roles.rightSignal);
            const seriesOuter = seriesComponent.pins.find(pin => pin.signal_name !== match.roles.rightSignal);
            if (!seriesInner || !seriesOuter
                || !componentBetween(seriesComponent, match.roles.rightSignal, seriesOuter.signal_name)) return null;
            const geometry = chooseRotation(seriesSymbol.symbol, new Map([
                [String(seriesInner.pin_number), 'WEST'],
                [String(seriesOuter.pin_number), 'EAST'],
            ]));
            const innerGeometryPin = geometry.pins.find(pin => pin.num == seriesInner.pin_number);
            if (!innerGeometryPin) return null;
            const placement = createPlacement(seriesSymbol, geometry, geometry.rotation,
                crystalRight.x + SERIES_HORIZONTAL_GAP - innerGeometryPin.x,
                crystalRight.y - innerGeometryPin.y);
            placements.push(placement);
            outputPlacement = placement;
            outputPinNumber = seriesOuter.pin_number;
            outputSignal = seriesOuter.signal_name;
        }

        const id = macroId(PATTERN_ID, match.designators);
        let ordinal = 0;
        for (const [placement, pinNumber] of [
            [leftCapPlacement, leftBranch.groundPin.pin_number],
            [rightCapPlacement, rightBranch.groundPin.pin_number],
        ] as const) {
            if (!localizePlacementPin({
                placements, placement, pinNumber, blockName: match.blockName,
                scope: id, ordinal: ordinal++
            })) return null;
        }
        const crystalGroundPins = crystalComponent.pins.filter(pin => isGroundSignal(pin.signal_name));
        if (crystalGroundPins.length !== 2) return null;
        for (const pin of crystalGroundPins) {
            const placedPin = placementPin(crystalPlacement, pin.pin_number);
            if (!placedPin || (placedPin.side !== 'WEST' && placedPin.side !== 'EAST')) return null;
            const direction = placedPin.side === 'WEST' ? -1 : 1;
            const short = createShortSymbolPlacement({
                kind: 'GND',
                signalName: pin.signal_name,
                blockName: match.blockName,
                scope: id,
                ordinal: ordinal++,
                x: 0,
                y: 0,
            });
            const horizontalGap = direction < 0 ? LEFT_GROUND_HORIZONTAL_GAP : GAP;
            short.x = placedPin.x + direction * horizontalGap - short.width / 2;
            short.y = placedPin.y + GAP;
            setPinRoutingSignal(crystalPlacement, pin.pin_number, short.designator);
            placements.push(short);
        }

        const fitted = fitPlacements(placements, PADDING);
        const leftPrimary = placementPin(crystalPlacement, leftCrystalPin.pin_number);
        const rightPrimary = placementPin(outputPlacement, outputPinNumber);
        if (!leftPrimary || !rightPrimary) return null;
        return createMacroInstance({
            id,
            patternId: PATTERN_ID,
            blockName: match.blockName,
            absorbedDesignators: match.designators,
            width: fitted.width,
            height: fitted.height,
            placements,
            ports: [{
                key: 'XIN', pinNumber: 'xin', signalName: match.roles.leftSignal,
                x: 0, y: leftPrimary.y, side: 'WEST', terminalSide: 'EAST',
                primaryPinId: leftPrimary.id, tailMode: 'straight',
            }, {
                key: 'XOUT', pinNumber: 'xout', signalName: outputSignal,
                x: fitted.width, y: rightPrimary.y, side: 'EAST', terminalSide: 'WEST',
                primaryPinId: rightPrimary.id, tailMode: 'straight',
            }],
            preferredBlockDirection: 'RIGHT',
        });
    },
};
