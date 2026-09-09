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
} from '../helpers.ts';
import type { CircuitLayoutPattern, PatternMatch } from '../types.ts';
import { branchToGround, isTwoPinKind } from './common.ts';

const PATTERN_ID = 'power-pi-filter';
const PADDING = 15;
const GAP = 0;

export const powerPiFilterPattern: CircuitLayoutPattern = {
    id: PATTERN_ID,
    priority: 90,

    findMatches(context) {
        const matches: PatternMatch[] = [];
        for (const [blockName, components] of context.componentsByBlock) {
            const capacitors = components.filter(component =>
                isTwoPinKind(component, 'capacitor') && context.symbolsByDesignator.has(component.designator));
            for (const series of components.filter(component =>
                isTwoPinKind(component, 'series') && context.symbolsByDesignator.has(component.designator))) {
                let [first, second] = series.pins;
                if (!first.signal_name || !second.signal_name
                    || first.signal_name === second.signal_name
                    || isGroundSignal(first.signal_name) || isGroundSignal(second.signal_name)) continue;
                const looksFiltered = (signal: string) => /(?:^|_)VREG|A(?:VDD|VCC)|D(?:VDD|VCC)/i.test(signal);
                if (looksFiltered(first.signal_name) && !looksFiltered(second.signal_name)) {
                    [first, second] = [second, first];
                }
                for (const leftCap of capacitors.filter(cap => branchToGround(cap, first.signal_name))) {
                    for (const rightCap of capacitors.filter(cap => branchToGround(cap, second.signal_name))) {
                        if (leftCap.designator === rightCap.designator) continue;
                        matches.push({
                            patternId: PATTERN_ID,
                            priority: this.priority,
                            blockName,
                            designators: [series.designator, leftCap.designator, rightCap.designator],
                            roles: {
                                series: series.designator,
                                leftCap: leftCap.designator,
                                rightCap: rightCap.designator,
                                leftSignal: first.signal_name,
                                rightSignal: second.signal_name,
                            },
                        });
                    }
                }
            }
        }
        return matches;
    },

    instantiate(match, context) {
        const seriesComponent = context.componentsByDesignator.get(match.roles.series);
        const leftCapComponent = context.componentsByDesignator.get(match.roles.leftCap);
        const rightCapComponent = context.componentsByDesignator.get(match.roles.rightCap);
        const seriesSymbol = context.symbolsByDesignator.get(match.roles.series);
        const leftCapSymbol = context.symbolsByDesignator.get(match.roles.leftCap);
        const rightCapSymbol = context.symbolsByDesignator.get(match.roles.rightCap);
        if (!seriesComponent || !leftCapComponent || !rightCapComponent
            || !seriesSymbol || !leftCapSymbol || !rightCapSymbol) return null;
        const leftSeriesPin = pinForSignal(seriesComponent, match.roles.leftSignal);
        const rightSeriesPin = pinForSignal(seriesComponent, match.roles.rightSignal);
        const leftBranch = branchToGround(leftCapComponent, match.roles.leftSignal);
        const rightBranch = branchToGround(rightCapComponent, match.roles.rightSignal);
        if (!leftSeriesPin || !rightSeriesPin || !leftBranch || !rightBranch) return null;

        const seriesGeometry = chooseRotation(seriesSymbol.symbol, new Map([
            [String(leftSeriesPin.pin_number), 'WEST'],
            [String(rightSeriesPin.pin_number), 'EAST'],
        ]));
        const leftCapGeometry = chooseRotation(leftCapSymbol.symbol, new Map([
            [String(leftBranch.signalPin.pin_number), 'NORTH'],
            [String(leftBranch.groundPin.pin_number), 'SOUTH'],
        ]));
        const rightCapGeometry = chooseRotation(rightCapSymbol.symbol, new Map([
            [String(rightBranch.signalPin.pin_number), 'NORTH'],
            [String(rightBranch.groundPin.pin_number), 'SOUTH'],
        ]));
        const seriesPlacement = createPlacement(seriesSymbol, seriesGeometry, seriesGeometry.rotation, 0, 0);
        const seriesLeft = placementPin(seriesPlacement, leftSeriesPin.pin_number);
        const seriesRight = placementPin(seriesPlacement, rightSeriesPin.pin_number);
        const leftCapPin = leftCapGeometry.pins.find(pin => pin.num == leftBranch.signalPin.pin_number);
        const rightCapPin = rightCapGeometry.pins.find(pin => pin.num == rightBranch.signalPin.pin_number);
        if (!seriesLeft || !seriesRight || !leftCapPin || !rightCapPin) return null;
        const capY = seriesPlacement.height + GAP;
        const leftCapPlacement = createPlacement(leftCapSymbol, leftCapGeometry, leftCapGeometry.rotation,
            seriesLeft.x - leftCapPin.x - GAP, capY - leftCapPin.y);
        const rightCapPlacement = createPlacement(rightCapSymbol, rightCapGeometry, rightCapGeometry.rotation,
            seriesRight.x - rightCapPin.x + GAP, capY - rightCapPin.y);
        const placements = [seriesPlacement, leftCapPlacement, rightCapPlacement];
        const id = macroId(PATTERN_ID, match.designators);
        if (!localizePlacementPin({
            placements, placement: leftCapPlacement,
            pinNumber: leftBranch.groundPin.pin_number, blockName: match.blockName, scope: id, ordinal: 0, hgap: 5
        })
            || !localizePlacementPin({
                placements, placement: rightCapPlacement,
                pinNumber: rightBranch.groundPin.pin_number, blockName: match.blockName, scope: id, ordinal: 1, hgap: 5
            })) return null;

        const fitted = fitPlacements(placements, PADDING);
        const leftPrimary = placementPin(seriesPlacement, leftSeriesPin.pin_number);
        const rightPrimary = placementPin(seriesPlacement, rightSeriesPin.pin_number);
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
                key: 'IN', pinNumber: 'in', signalName: match.roles.leftSignal,
                x: 0, y: leftPrimary.y, side: 'WEST', terminalSide: 'EAST',
                primaryPinId: leftPrimary.id, tailMode: 'straight',
            }, {
                key: 'OUT', pinNumber: 'out', signalName: match.roles.rightSignal,
                x: fitted.width, y: rightPrimary.y, side: 'EAST', terminalSide: 'WEST',
                primaryPinId: rightPrimary.id, tailMode: 'straight',
            }],
            preferredBlockDirection: 'RIGHT',
        });
    },
};
