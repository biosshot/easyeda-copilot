import {
    chooseRotation,
    createMacroInstance,
    createPlacement,
    createShortSymbolPlacement,
    macroId,
    pinForSignal,
    placementPin,
    setPinRoutingSignal,
    shortSymbolKindForSignal,
    translatePlacements,
    fitPlacements,
} from './helpers.ts';
import type { PatternMatch, PatternContext } from './types.ts';
import { SCHEMATIC_CLEARANCE as gap } from '../refinement/policy.ts';

/** Geometry shared by recognizers; pin roles come from the match, never from a
 * guessed electrical transfer function. The legacy spacing remains selectable. */
export function instantiateTappedChain(match: PatternMatch, context: PatternContext, padded = false) {
    const DIVIDER_PATTERN_PADDING = padded ? gap.port : 7;
    const DIVIDER_COMPONENT_GAP = padded ? gap.pinEscape * 2 : 10;
    const LOCAL_SHORT_GAP = padded ? gap.port : 7;
    const topComponent = context.componentsByDesignator.get(match.roles.top);
    const bottomComponent = context.componentsByDesignator.get(match.roles.bottom);
    const topSymbol = context.symbolsByDesignator.get(match.roles.top);
    const bottomSymbol = context.symbolsByDesignator.get(match.roles.bottom);
    if (!topComponent || !bottomComponent || !topSymbol || !bottomSymbol) return null;

    const middleSignal = match.roles.middleSignal;
    const topMiddlePin = pinForSignal(topComponent, middleSignal);
    const bottomMiddlePin = pinForSignal(bottomComponent, middleSignal);
    const topOuterPin = topComponent.pins.find(pin => pin.signal_name !== middleSignal);
    const bottomOuterPin = bottomComponent.pins.find(pin => pin.signal_name !== middleSignal);
    if (!topMiddlePin || !bottomMiddlePin || !topOuterPin || !bottomOuterPin) return null;
    const id = macroId(match.patternId, match.designators);

    // A generic chain need not inherit the vertical axis of a resistor divider.
    // Its series arm can face the actual IC terminal; the ground arm stays below
    // the tap. This uses terminal geometry, not an inductor or converter name.
    if (padded && (match.roles.entrySide === 'WEST' || match.roles.entrySide === 'EAST')) {
        const entry = match.roles.entrySide, exit = entry === 'WEST' ? 'EAST' : 'WEST';
        const series = chooseRotation(topSymbol.symbol, new Map([[String(topOuterPin.pin_number), entry], [String(topMiddlePin.pin_number), exit]]));
        const shunt = chooseRotation(bottomSymbol.symbol, new Map([[String(bottomMiddlePin.pin_number), 'NORTH'], [String(bottomOuterPin.pin_number), 'SOUTH']]));
        const top = createPlacement(topSymbol, series, series.rotation, 0, 0), mid = placementPin(top, topMiddlePin.pin_number)!;
        const sp = shunt.pins.find(p => String(p.num) === String(bottomMiddlePin.pin_number))!;
        const bottom = createPlacement(bottomSymbol, shunt, shunt.rotation,
            mid.x + (exit === 'EAST' ? gap.branch : -gap.branch) - sp.x, series.height + gap.branch);
        const ground = placementPin(bottom, bottomOuterPin.pin_number)!;
        const flag = createShortSymbolPlacement({ kind: 'GND', signalName: bottomOuterPin.signal_name,
            blockName: match.blockName, scope: id, ordinal: 0, x: ground.x, y: ground.y });
        flag.x = ground.x - flag.width / 2; flag.y = ground.y + gap.port;
        setPinRoutingSignal(bottom, bottomOuterPin.pin_number, flag.designator);
        const placements = [top, bottom, flag], fitted = fitPlacements(placements, gap.pinEscape);
        const outer = placementPin(top, topOuterPin.pin_number)!, middle = placementPin(top, topMiddlePin.pin_number)!;
        return createMacroInstance({ id, patternId: match.patternId, blockName: match.blockName,
            absorbedDesignators: match.designators, width: fitted.width, height: fitted.height, placements,
            ports: [{ key: 'HIGH', pinNumber: 'high', signalName: topOuterPin.signal_name,
                x: entry === 'WEST' ? 0 : fitted.width, y: outer.y, side: entry, terminalSide: exit,
                primaryPinId: outer.id, tailMode: 'straight' },
            { key: 'MID', pinNumber: 'mid', signalName: middleSignal,
                x: exit === 'EAST' ? fitted.width : 0, y: middle.y, side: exit, terminalSide: entry,
                primaryPinId: middle.id, tailMode: 'straight' }] });
    }

    const topGeometry = chooseRotation(topSymbol.symbol, new Map([
        [String(topOuterPin.pin_number), 'NORTH'],
        [String(topMiddlePin.pin_number), 'SOUTH'],
    ]));
    const bottomGeometry = chooseRotation(bottomSymbol.symbol, new Map([
        [String(bottomMiddlePin.pin_number), 'NORTH'],
        [String(bottomOuterPin.pin_number), 'SOUTH'],
    ]));

    const componentWidth = Math.max(topGeometry.width, bottomGeometry.width);
    const topPlacement = createPlacement(
        topSymbol,
        topGeometry,
        topGeometry.rotation,
        (componentWidth - topGeometry.width) / 2,
        0,
    );
    const bottomPlacement = createPlacement(
        bottomSymbol,
        bottomGeometry,
        bottomGeometry.rotation,
        (componentWidth - bottomGeometry.width) / 2,
        topGeometry.height + DIVIDER_COMPONENT_GAP,
    );
    const placements = [topPlacement, bottomPlacement];

    const topMiddle = placementPin(topPlacement, topMiddlePin.pin_number);
    const bottomMiddle = placementPin(bottomPlacement, bottomMiddlePin.pin_number);
    if (!topMiddle || !bottomMiddle) return null;

    if (padded) {
        const topOuter = placementPin(topPlacement, topOuterPin.pin_number)!, bottomOuter = placementPin(bottomPlacement, bottomOuterPin.pin_number)!;
        if (topSymbol.symbol.pins.length !== 2 || bottomSymbol.symbol.pins.length !== 2
            || Math.abs(topOuter.x - topMiddle.x) > 1e-5 || Math.abs(bottomOuter.x - bottomMiddle.x) > 1e-5
            || topOuter.y >= topMiddle.y || bottomOuter.y <= bottomMiddle.y) return null;
        const delta = topMiddle.x - bottomMiddle.x;
        bottomPlacement.x += delta; bottomMiddle.x += delta;
    }

    const junction = {
        x: (topMiddle.x + bottomMiddle.x) / 2,
        y: (topMiddle.y + bottomMiddle.y) / 2,
    };
    const localizedOuterSignals = new Set<string>();
    const ordinals = { GND: 0, VCC: 0 };
    const addOuterShort = (
        placement: typeof topPlacement,
        pinNumber: string | number,
        signalName: string,
        outer: { x: number; y: number },
    ) => {
        const kind = shortSymbolKindForSignal(signalName);
        if (!kind) return;
        const shortPlacement = createShortSymbolPlacement({
            kind,
            signalName,
            blockName: match.blockName,
            scope: id,
            ordinal: ordinals[kind]++,
            x: outer.x,
            y: outer.y,
        });
        shortPlacement.x = outer.x - shortPlacement.width / 2;
        shortPlacement.y = kind === 'VCC'
            ? outer.y - shortPlacement.height - LOCAL_SHORT_GAP
            : outer.y + LOCAL_SHORT_GAP;
        setPinRoutingSignal(placement, pinNumber, shortPlacement.designator);
        placements.push(shortPlacement);
        localizedOuterSignals.add(signalName);
    };
    const topOuterBeforeTranslation = placementPin(topPlacement, topOuterPin.pin_number);
    const bottomOuterBeforeTranslation = placementPin(bottomPlacement, bottomOuterPin.pin_number);
    if (!topOuterBeforeTranslation || !bottomOuterBeforeTranslation) return null;
    addOuterShort(topPlacement, topOuterPin.pin_number, topOuterPin.signal_name, topOuterBeforeTranslation);
    addOuterShort(bottomPlacement, bottomOuterPin.pin_number, bottomOuterPin.signal_name, bottomOuterBeforeTranslation);

    const minX = Math.min(...placements.map(placement => placement.x));
    const maxX = Math.max(...placements.map(placement => placement.x + placement.width));
    const minY = Math.min(...placements.map(placement => placement.y));
    const maxY = Math.max(...placements.map(placement => placement.y + placement.height));
    const halfWidth = Math.max(junction.x - minX, maxX - junction.x) + DIVIDER_PATTERN_PADDING;
    const halfHeight = Math.max(junction.y - minY, maxY - junction.y) + DIVIDER_PATTERN_PADDING;
    const dx = halfWidth - junction.x;
    const dy = halfHeight - junction.y;
    translatePlacements(placements, dx, dy);

    const width = halfWidth * 2;
    const height = halfHeight * 2;
    const topOuter = placementPin(topPlacement, topOuterPin.pin_number);
    const topMiddleTranslated = placementPin(topPlacement, topMiddlePin.pin_number);
    const bottomOuter = placementPin(bottomPlacement, bottomOuterPin.pin_number);
    if (!topOuter || !topMiddleTranslated || !bottomOuter) return null;

    const ports = [] as Parameters<typeof createMacroInstance>[0]['ports'];
    if (!localizedOuterSignals.has(topOuterPin.signal_name)) {
        ports.push({
            key: 'HIGH',
            pinNumber: 'high',
            signalName: topOuterPin.signal_name,
            x: width / 2,
            y: 0,
            side: 'NORTH',
            terminalSide: 'SOUTH',
            primaryPinId: topOuter.id,
        });
    }
    let tapSide: 'WEST' | 'EAST' = 'EAST';
    if (padded) {
        const anchors = (context.signalEndpoints.get(middleSignal) ?? []).filter(p => !match.designators.includes(p.designator)
            && p.blockName === match.blockName && (/^U/i.test(p.designator) || (context.symbolsByDesignator.get(p.designator)?.symbol.pins.length ?? 0) > 4));
        if (anchors.length === 1) {
            const symbol = context.symbolsByDesignator.get(anchors[0].designator)?.symbol;
            const pin = symbol?.pins.find(p => String(p.num) === String(anchors[0].pinNumber));
            if (symbol && pin && Math.abs(pin.x - symbol.width) < 1e-5) {
                // Do not turn a tall divider into the reserved corridor of a
                // nearby series attachment on the same IC face. In that case
                // keep the existing tap face and let local placement offset it.
                const busy = symbol.pins.some(q => Math.abs(q.x - pin.x) < 1e-5 && q.signal_name !== middleSignal
                    && Math.abs(q.y - pin.y) < topGeometry.height + gap.component
                    && (context.signalEndpoints.get(q.signal_name) ?? []).some(e => {
                        const c = context.componentsByDesignator.get(e.designator);
                        if (!c || match.designators.includes(c.designator) || c.pins.length !== 2 || c.pins.some(p => shortSymbolKindForSignal(p.signal_name))) return false;
                        const attached = c.pins.filter(p => (context.signalEndpoints.get(p.signal_name) ?? []).some(other =>
                            other.designator !== c.designator && /^U/i.test(other.designator)));
                        return attached.length === 1;
                    }));
                if (!busy) tapSide = 'WEST';
            }
        }
    }
    ports.push({
        key: 'MID',
        pinNumber: 'mid',
        signalName: middleSignal,
        x: tapSide === 'WEST' ? 0 : width,
        y: height / 2,
        side: tapSide,
        terminalSide: tapSide === 'WEST' ? 'EAST' : 'WEST',
        primaryPinId: topMiddleTranslated.id,
        tailBendPoints: [{ x: width / 2, y: height / 2 }],
    });
    if (!localizedOuterSignals.has(bottomOuterPin.signal_name)) {
        ports.push({
            key: 'LOW',
            pinNumber: 'low',
            signalName: bottomOuterPin.signal_name,
            x: width / 2,
            y: height,
            side: 'SOUTH',
            terminalSide: 'NORTH',
            primaryPinId: bottomOuter.id,
        });
    }

    return createMacroInstance({
        id,
        patternId: match.patternId,
        blockName: match.blockName,
        absorbedDesignators: match.designators,
        width,
        height,
        placements,
        ports,
    });
}
