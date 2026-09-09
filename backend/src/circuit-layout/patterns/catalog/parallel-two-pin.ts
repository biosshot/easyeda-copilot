import { getPinDirection } from '#circuit-layout/improvement.ts';
import type { SymbolData } from '#types/symbol.ts';
import { getDesignatorLabel } from '#utils/component.ts';
import {
    chooseRotation,
    createMacroInstance,
    createPlacement,
    createShortSymbolPlacement,
    fitPlacements,
    isGroundSignal,
    macroId,
    pinForSignal,
    placementPin,
    setPinRoutingSignal,
} from '../helpers.ts';
import type { CircuitLayoutPattern, PatternContext, PatternMatch } from '../types.ts';

const PATTERN_ID = 'parallel-two-pin';
const COMPONENT_GAP = 20;
const PADDING = 20;
const RAIL_CLEARANCE = 10;
const GROUND_SYMBOL_GAP = 20;
const NESTED_COMPONENT_COUNT = 5;
const NESTED_IC_PIN_COUNT = 7;
const AXIS_EPSILON = 2;

function hasOpposedAxialPins(symbol: SymbolData) {
    if (symbol.pins.length !== 2) return false;
    const [first, second] = symbol.pins;
    const firstDirection = getPinDirection(symbol, first);
    const secondDirection = getPinDirection(symbol, second);
    const sameX = Math.abs(first.x - second.x) <= AXIS_EPSILON;
    const sameY = Math.abs(first.y - second.y) <= AXIS_EPSILON;
    const horizontallyOpposed = (firstDirection === 'LEFT' && secondDirection === 'RIGHT')
        || (firstDirection === 'RIGHT' && secondDirection === 'LEFT');
    const verticallyOpposed = (firstDirection === 'TOP' && secondDirection === 'BOTTOM')
        || (firstDirection === 'BOTTOM' && secondDirection === 'TOP');

    return (sameY && horizontallyOpposed) || (sameX && verticallyOpposed);
}

function designatorOrder(left: string, right: string) {
    return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

function pairKey(first: string, second: string) {
    return JSON.stringify([first, second].sort());
}

function shouldNest(match: PatternMatch, context: PatternContext) {
    if (match.designators.length >= NESTED_COMPONENT_COUNT) return true;

    const group = new Set(match.designators);
    return [match.roles.signalA, match.roles.signalB].some(signalName => {
        if (isGroundSignal(signalName)) return false;
        return (context.signalEndpoints.get(signalName) ?? []).some(endpoint => {
            if (group.has(endpoint.designator)) return false;
            const component = context.componentsByDesignator.get(endpoint.designator);
            return component !== undefined && component.pins.length >= NESTED_IC_PIN_COUNT
                && getDesignatorLabel(component.designator) === 'Микросхемы';
        });
    });
}

export const parallelTwoPinPattern: CircuitLayoutPattern = {
    id: PATTERN_ID,
    priority: 10,

    findMatches(context) {
        const matches: PatternMatch[] = [];
        for (const [blockName, components] of context.componentsByBlock) {
            const groups = new Map<string, typeof components>();
            for (const component of components) {
                const symbol = context.symbolsByDesignator.get(component.designator);
                if (component.pins.length !== 2 || !symbol || !hasOpposedAxialPins(symbol.symbol)) continue;
                const [first, second] = component.pins.map(pin => pin.signal_name);
                if (!first || !second || first === second) continue;
                const key = pairKey(first, second);
                const group = groups.get(key) ?? [];
                group.push(component);
                groups.set(key, group);
            }

            for (const group of groups.values()) {
                if (group.length < 2) continue;
                group.sort((left, right) => designatorOrder(left.designator, right.designator));
                const [signalA, signalB] = group[0].pins.map(pin => pin.signal_name);
                matches.push({
                    patternId: PATTERN_ID,
                    priority: this.priority,
                    blockName,
                    designators: group.map(component => component.designator),
                    roles: { signalA, signalB },
                });
            }
        }
        return matches;
    },

    instantiate(match, context) {
        const entries = match.designators.map(designator => ({
            component: context.componentsByDesignator.get(designator),
            symbol: context.symbolsByDesignator.get(designator),
        }));
        if (entries.some(entry => !entry.component || !entry.symbol)) return null;

        let signalA = match.roles.signalA;
        let signalB = match.roles.signalB;
        if (isGroundSignal(signalA) && !isGroundSignal(signalB)) {
            [signalA, signalB] = [signalB, signalA];
        }
        const prepared = entries.map(entry => {
            const component = entry.component!;
            const symbol = entry.symbol!;
            const pinA = pinForSignal(component, signalA);
            const pinB = pinForSignal(component, signalB);
            if (!pinA || !pinB || pinA.pin_number == pinB.pin_number) return null;
            const geometry = chooseRotation(symbol.symbol, new Map([
                [String(pinA.pin_number), 'NORTH'],
                [String(pinB.pin_number), 'SOUTH'],
            ]));
            const geometryPinA = geometry.pins.find(pin => pin.num == pinA.pin_number);
            if (!geometryPinA) return null;
            return { component, symbol, pinA, pinB, geometry, geometryPinA };
        });
        if (prepared.some(entry => !entry)) return null;

        const pinAY = Math.max(...prepared.map(entry => entry!.geometryPinA.y));
        let cursorX = 0;
        const placements = prepared.map(entry => {
            const current = entry!;
            const placement = createPlacement(
                current.symbol,
                current.geometry,
                current.geometry.rotation,
                cursorX,
                pinAY - current.geometryPinA.y,
            );
            cursorX += current.geometry.width + COMPONENT_GAP;
            return placement;
        });
        const id = macroId(PATTERN_ID, match.designators);
        const localGround = isGroundSignal(signalB);
        if (localGround) {
            const rowLeft = Math.min(...placements.map(placement => placement.x));
            const rowRight = Math.max(...placements.map(placement => placement.x + placement.width));
            const lowerPinY = Math.max(...prepared.map((entry, index) =>
                placementPin(placements[index], entry!.pinB.pin_number)!.y));
            const ground = createShortSymbolPlacement({
                kind: 'GND',
                signalName: signalB,
                blockName: match.blockName,
                scope: id,
                ordinal: 0,
                x: 0,
                y: 0,
            });
            ground.x = (rowLeft + rowRight - ground.width) / 2;
            ground.y = lowerPinY + RAIL_CLEARANCE + GROUND_SYMBOL_GAP;
            prepared.forEach((entry, index) => {
                setPinRoutingSignal(placements[index], entry!.pinB.pin_number, ground.designator);
            });
            placements.push(ground);
        }
        const fitted = fitPlacements(placements, PADDING);
        const first = prepared[0]!;
        const last = prepared.at(-1)!;
        const firstPlacement = placements[0];
        const lastPlacement = placements[prepared.length - 1];
        const firstA = placementPin(firstPlacement, first.pinA.pin_number);
        const lastB = placementPin(lastPlacement, last.pinB.pin_number);
        if (!firstA || !lastB) return null;
        const componentPins = prepared.map((entry, index) => ({
            upper: placementPin(placements[index], entry!.pinA.pin_number),
            lower: placementPin(placements[index], entry!.pinB.pin_number),
        }));
        if (componentPins.some(pins => !pins.upper || !pins.lower)) return null;
        const upperRailY = Math.min(...componentPins.map(pins => pins.upper!.y)) - RAIL_CLEARANCE;
        const lowerRailY = Math.max(...componentPins.map(pins => pins.lower!.y)) + RAIL_CLEARANCE;
        const portX = fitted.width / 2;

        const group = new Set(match.designators);
        const isExternal = (signalName: string) => (context.signalEndpoints.get(signalName) ?? [])
            .some(endpoint => !group.has(endpoint.designator));
        const ports = [] as Parameters<typeof createMacroInstance>[0]['ports'];
        if (isExternal(signalA)) {
            ports.push({
                key: 'A', pinNumber: 'a', signalName: signalA,
                x: portX, y: upperRailY, side: 'NORTH', terminalSide: 'NORTH',
                primaryPinId: firstA.id,
            });
        }
        if (!localGround && isExternal(signalB)) {
            ports.push({
                key: 'B', pinNumber: 'b', signalName: signalB,
                x: portX, y: lowerRailY, side: 'SOUTH', terminalSide: 'SOUTH',
                primaryPinId: lastB.id,
            });
        }

        const macro = createMacroInstance({
            id,
            patternId: PATTERN_ID,
            blockName: match.blockName,
            absorbedDesignators: match.designators,
            width: fitted.width,
            height: fitted.height,
            placements,
            ports,
        });
        macro.forceRoutedSignals = [signalA, signalB];
        macro.routingClearance = RAIL_CLEARANCE;
        if (shouldNest(match, context)) {
            macro.layoutChildBlock = {
                name: `parl_${match.designators.join('_')}`,
                description: `Parallel components: ${match.designators.join(', ')}`,
                layoutOptions: { 'org.eclipse.elk.direction': 'UP' },
            };
        }
        return macro;
    },
};
