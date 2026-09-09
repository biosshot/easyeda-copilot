import { getDesignatorLabel } from '#utils/component.ts';
import { chooseRotation, createMacroInstance, createPlacement, createShortSymbolPlacement, fitPlacements,
    isGroundSignal, macroId, pinForSignal, placementPin, setPinRoutingSignal, shortSymbolKindForSignal } from '../helpers.ts';
import type { CircuitLayoutPattern, PatternMatch } from '../types.ts';
import { SCHEMATIC_CLEARANCE as gap } from '../../refinement/policy.ts';

const ID = 'led-resistor';

export const ledResistorPattern: CircuitLayoutPattern = {
    id: ID, priority: 25,
    findMatches(context) {
        const matches: PatternMatch[] = [];
        for (const [blockName, components] of context.componentsByBlock) {
            for (const led of components.filter(c => getDesignatorLabel(c.designator) === 'Светодиоды' && c.pins.length === 2)) {
                for (const resistor of components.filter(c => getDesignatorLabel(c.designator) === 'Резисторы' && c.pins.length === 2)) {
                    const shared = led.pins.filter(p => p.signal_name && !/^NC$/i.test(p.signal_name) && resistor.pins.some(r => r.signal_name === p.signal_name));
                    if (shared.length !== 1 || (context.signalEndpoints.get(shared[0].signal_name)?.length ?? 0) !== 2) continue;
                    const outer = [led, resistor].map(c => c.pins.find(p => p.signal_name !== shared[0].signal_name)?.signal_name);
                    if (outer.some(s => !s || /^NC$/i.test(s)) || outer[0] === outer[1]) continue;
                    matches.push({ patternId: ID, priority: this.priority, blockName, designators: [resistor.designator, led.designator],
                        roles: { resistor: resistor.designator, led: led.designator, shared: shared[0].signal_name } });
                }
            }
        }
        return matches;
    },
    instantiate(match, context) {
        // Recheck the full context: a third tap may already belong to another macro.
        if (context.signalEndpoints.get(match.roles.shared)?.length !== 2) return null;
        const resistor = context.componentsByDesignator.get(match.roles.resistor)!;
        const led = context.componentsByDesignator.get(match.roles.led)!;
        if (!resistor || !led) return null;
        const outer = (c: typeof led) => c.pins.find(p => p.signal_name !== match.roles.shared)!;
        const resistorBottom = isGroundSignal(outer(resistor).signal_name) || shortSymbolKindForSignal(outer(led).signal_name) === 'VCC';
        const ordered = resistorBottom ? [led, resistor] : [resistor, led];
        const prepared = ordered.map((c, i) => {
            const symbol = context.symbolsByDesignator.get(c.designator);
            if (!symbol || symbol.symbol.pins.length !== 2) return null;
            const middle = pinForSignal(c, match.roles.shared)!, outside = outer(c);
            const north = i === 0 ? outside : middle, south = i === 0 ? middle : outside;
            const geometry = chooseRotation(symbol.symbol, new Map([[String(north.pin_number), 'NORTH'], [String(south.pin_number), 'SOUTH']]));
            const n = geometry.pins.find(p => p.num == north.pin_number)!, s = geometry.pins.find(p => p.num == south.pin_number)!;
            if (!n || !s || Math.abs(n.x - s.x) > 1e-5 || n.y >= s.y) return null;
            return { c, symbol, geometry, north, south, n, s };
        });
        if (prepared.some(p => !p)) return null;
        const [top, bottom] = prepared as NonNullable<typeof prepared[number]>[];
        const placements = [createPlacement(top.symbol, top.geometry, top.geometry.rotation, -top.n.x, 0),
            createPlacement(bottom.symbol, bottom.geometry, bottom.geometry.rotation, -bottom.n.x, top.s.y + gap.pinEscape * 2 - bottom.n.y)];
        const id = macroId(ID, match.designators), localized = new Set<string>();
        for (const [i, endpoint] of [top.north, bottom.south].entries()) {
            const kind = shortSymbolKindForSignal(endpoint.signal_name);
            if (!kind) continue;
            // A supply above the chain and a ground below it keep the usual reading direction.
            if ((i === 0 && kind !== 'VCC') || (i === 1 && kind !== 'GND')) continue;
            const p = placementPin(placements[i], endpoint.pin_number)!;
            const flag = createShortSymbolPlacement({ kind, signalName: endpoint.signal_name, blockName: match.blockName, scope: id, ordinal: i, x: 0, y: 0 });
            flag.x = p.x - flag.width / 2;
            flag.y = i === 0 ? p.y - flag.height - gap.port : p.y + gap.port;
            setPinRoutingSignal(placements[i], endpoint.pin_number, flag.designator);
            placements.push(flag); localized.add(endpoint.signal_name);
        }
        const fitted = fitPlacements(placements, gap.port);
        const ports: Parameters<typeof createMacroInstance>[0]['ports'] = [];
        for (const [i, endpoint] of [top.north, bottom.south].entries()) {
            if (localized.has(endpoint.signal_name)) continue;
            const p = placementPin(placements[i], endpoint.pin_number)!;
            ports.push({ key: i === 0 ? 'HIGH' : 'LOW', pinNumber: String(i), signalName: endpoint.signal_name,
                x: p.x, y: i === 0 ? 0 : fitted.height, side: i === 0 ? 'NORTH' : 'SOUTH',
                terminalSide: i === 0 ? 'SOUTH' : 'NORTH', primaryPinId: p.id });
        }
        return createMacroInstance({ id, patternId: ID, blockName: match.blockName, absorbedDesignators: match.designators,
            width: fitted.width, height: fitted.height, placements, ports });
    },
};
