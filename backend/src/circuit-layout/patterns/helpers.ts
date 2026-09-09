import { getPinDirection } from '#circuit-layout/improvement.ts';
import { shortSymbolsMap, stableShortSymbolId } from '#circuit-layout/short-symbol.ts';
import type { CircuitComponent } from '#types/circuit.ts';
import type { SymbolData, SymbolPin, SymbolWithMeta } from '#types/symbol.ts';
import type {
    MacroComponentPlacement,
    MacroInstance,
    MacroPort,
    OrthogonalSide,
    PatternContext,
    PatternPinEndpoint,
    RotatedSymbolGeometry,
} from './types.ts';

export const PATTERN_PADDING = 20;
export type PatternShortSymbolKind = 'GND' | 'VCC' | 'NETPORT';

export function shortSymbolKindForSignal(signalName: string): Exclude<PatternShortSymbolKind, 'NETPORT'> | null {
    if (shortSymbolsMap.GND.is(signalName)) return 'GND';
    if (shortSymbolsMap.VCC.is(signalName)) return 'VCC';
    return null;
}

function orthogonalPinSide(symbol: { width: number; height: number }, pin: { x: number; y: number }): OrthogonalSide {
    const direction = getPinDirection(symbol, pin);
    if (direction === 'TOP') return 'NORTH';
    if (direction === 'BOTTOM') return 'SOUTH';
    if (direction === 'LEFT') return 'WEST';
    return 'EAST';
}

export function createPatternContext(circuit: PatternContext['circuit'], symbols: SymbolWithMeta[]): PatternContext {
    const componentsByBlock = new Map<string, CircuitComponent[]>();
    const componentsByDesignator = new Map(circuit.components.map(component => [component.designator, component]));
    const symbolsByDesignator = new Map(symbols.map(symbol => [symbol.designator, symbol]));
    const signalEndpoints = new Map<string, PatternPinEndpoint[]>();

    for (const component of circuit.components) {
        const blockComponents = componentsByBlock.get(component.block_name) ?? [];
        blockComponents.push(component);
        componentsByBlock.set(component.block_name, blockComponents);

        for (const pin of component.pins) {
            if (!pin.signal_name) continue;
            const endpoints = signalEndpoints.get(pin.signal_name) ?? [];
            endpoints.push({
                designator: component.designator,
                blockName: component.block_name,
                pinNumber: pin.pin_number,
                signalName: pin.signal_name,
            });
            signalEndpoints.set(pin.signal_name, endpoints);
        }
    }

    return {
        circuit,
        componentsByBlock,
        componentsByDesignator,
        signalEndpoints,
        symbolsByDesignator,
    };
}

export function pinId(designator: string, pinNumber: string | number) {
    return `${designator}_pin_${pinNumber}`;
}

export { isGroundSignal } from '../ground.ts';

export function normalizeRotation(rotation: number): 0 | 90 | 180 | 270 {
    const normalized = ((rotation % 360) + 360) % 360;
    if (normalized === 90 || normalized === 180 || normalized === 270) return normalized;
    return 0;
}

export function rotateSymbolGeometry(symbol: SymbolData, rotation: number): RotatedSymbolGeometry {
    const normalized = normalizeRotation(rotation);
    // Exact quarter-turns keep a twice-turned macro identical to geometry
    // rebuilt directly from its final ASM angle (no accumulated sin/cos drift).
    const turn = (p: { x: number; y: number }) => normalized === 90 ? { x: p.y, y: -p.x }
        : normalized === 180 ? { x: -p.x, y: -p.y } : normalized === 270 ? { x: -p.y, y: p.x } : { ...p };
    const rotatedSize = turn({ x: symbol.width, y: symbol.height });
    const width = Math.abs(rotatedSize.x);
    const height = Math.abs(rotatedSize.y);
    const transform = (point: { x: number; y: number }) => {
        const rotated = turn({
            x: point.x - symbol.width / 2,
            y: point.y - symbol.height / 2,
        });
        return {
            x: rotated.x + width / 2,
            y: rotated.y + height / 2,
        };
    };
    const pins = symbol.pins.map(pin => ({ ...pin, ...transform(pin) }));

    return {
        width,
        height,
        pins,
        // The library insertion point is a point in the bounds, not a vector
        // from their origin. Transform it exactly like the physical pins.
        center: transform(symbol.center),
    };
}

export function chooseRotation(
    symbol: SymbolData,
    desiredSides: Map<string, OrthogonalSide>,
): RotatedSymbolGeometry & { rotation: 0 | 90 | 180 | 270 } {
    const candidates = ([0, 90, 180, 270] as const).map(rotation => {
        const geometry = rotateSymbolGeometry(symbol, rotation);
        let score = 0;
        for (const pin of geometry.pins) {
            const desired = desiredSides.get(String(pin.num));
            if (!desired) continue;
            if (orthogonalPinSide(geometry, pin) !== desired) score++;
        }
        return { ...geometry, rotation, score };
    });
    candidates.sort((left, right) => left.score - right.score || left.rotation - right.rotation);
    return candidates[0];
}

export function createPlacement(
    symbol: SymbolWithMeta,
    geometry: RotatedSymbolGeometry,
    rotation: number,
    x: number,
    y: number,
): MacroComponentPlacement {
    return {
        designator: symbol.designator,
        blockName: symbol.block_name,
        x,
        y,
        rotate: normalizeRotation(rotation),
        center: structuredClone(geometry.center),
        width: geometry.width,
        height: geometry.height,
        pins: geometry.pins.map(pin => ({
            ...pin,
            id: pinId(symbol.designator, pin.num),
            side: orthogonalPinSide(geometry, pin),
        })),
    };
}

export function createShortSymbolPlacement(args: {
    kind: PatternShortSymbolKind;
    signalName: string;
    blockName: string;
    scope: string;
    ordinal: number;
    x: number;
    y: number;
}): MacroComponentPlacement {
    const routingSignalName = stableShortSymbolId(
        args.kind,
        args.signalName,
        `${args.blockName}\u0000${args.scope}`,
        args.ordinal,
    );
    const shortSymbol = shortSymbolsMap[args.kind].create(
        args.signalName,
        args.blockName,
        routingSignalName,
    );
    const width = shortSymbol.node.width ?? 20;
    const height = shortSymbol.node.height ?? 20;
    const nodePort = shortSymbol.node.ports?.[0];
    const componentPin = shortSymbol.component.pins[0];
    if (!nodePort || !componentPin) {
        throw new Error(`Short symbol ${routingSignalName} has no pin`);
    }
    const pin = {
        num: componentPin.pin_number,
        name: componentPin.name,
        signal_name: componentPin.signal_name,
        part: '',
        x: nodePort.x ?? width / 2,
        y: nodePort.y ?? 0,
    };

    return {
        designator: shortSymbol.component.designator,
        blockName: args.blockName,
        generatedComponent: structuredClone(shortSymbol.component),
        x: args.x,
        y: args.y,
        rotate: 0,
        center: { x: width / 2, y: height / 2 },
        width,
        height,
        pins: [{
            ...pin,
            id: nodePort.id,
            side: orthogonalPinSide({ width, height }, pin),
            routingSignalName,
        }],
    };
}

export function setPinRoutingSignal(
    placement: MacroComponentPlacement,
    pinNumber: string | number,
    routingSignalName: string,
) {
    const pin = placement.pins.find(candidate => candidate.num == pinNumber);
    if (!pin) throw new Error(`Pin ${placement.designator}.${pinNumber} not found`);
    pin.routingSignalName = routingSignalName;
}

export function placementPin(placement: MacroComponentPlacement, pinNumber: string | number) {
    const pin = placement.pins.find(candidate => candidate.num == pinNumber);
    if (!pin) return null;
    return {
        ...pin,
        x: placement.x + pin.x,
        y: placement.y + pin.y,
    };
}

export function translatePlacements(
    placements: MacroComponentPlacement[],
    dx: number,
    dy: number,
) {
    for (const placement of placements) {
        placement.x += dx;
        placement.y += dy;
    }
}

export function createMacroInstance(args: {
    id: string;
    patternId: string;
    blockName: string;
    absorbedDesignators: string[];
    width: number;
    height: number;
    placements: MacroComponentPlacement[];
    ports: Omit<MacroPort, 'elkPortId'>[];
    preferredBlockDirection?: MacroInstance['preferredBlockDirection'];
}): MacroInstance {
    const ports = args.ports.map(port => ({
        ...port,
        elkPortId: pinId(args.id, port.pinNumber),
    }));
    return {
        id: args.id,
        patternId: args.patternId,
        blockName: args.blockName,
        absorbedDesignators: [...args.absorbedDesignators],
        placements: args.placements,
        ports,
        routedPaths: [],
        preferredBlockDirection: args.preferredBlockDirection,
        node: {
            designator: args.id,
            block_name: args.blockName,
            symbol: {
                width: args.width,
                height: args.height,
                center: { x: args.width / 2, y: args.height / 2 },
                pins: ports.map(port => ({
                    num: port.pinNumber,
                    name: port.key,
                    signal_name: port.signalName,
                    x: port.x,
                    y: port.y,
                    part: '',
                })),
            },
        },
    };
}

export function componentPin(component: CircuitComponent, pinNumber: string | number) {
    return component.pins.find(pin => pin.pin_number == pinNumber) ?? null;
}

export function componentSignals(component: CircuitComponent) {
    return new Set(component.pins.map(pin => pin.signal_name).filter(Boolean));
}

export function sharedSignals(left: CircuitComponent, right: CircuitComponent) {
    const rightSignals = componentSignals(right);
    return [...componentSignals(left)].filter(signal => rightSignals.has(signal));
}

export function pinForSignal(component: CircuitComponent, signalName: string) {
    return component.pins.find(pin => pin.signal_name === signalName) ?? null;
}

export function macroId(patternId: string, designators: string[]) {
    const suffix = [...designators].sort().join('__').replace(/[^A-Za-z0-9_.-]/g, '_');
    return `__macro__${patternId}__${suffix}`;
}

export function macroBounds(placements: MacroComponentPlacement[]) {
    const minX = Math.min(...placements.map(placement => placement.x));
    const minY = Math.min(...placements.map(placement => placement.y));
    const maxX = Math.max(...placements.map(placement => placement.x + placement.width));
    const maxY = Math.max(...placements.map(placement => placement.y + placement.height));
    return { minX, minY, maxX, maxY };
}

export function localizePlacementPin(args: {
    placements: MacroComponentPlacement[];
    placement: MacroComponentPlacement;
    pinNumber: string | number;
    blockName: string;
    scope: string;
    ordinal: number;
    wgap?: number;
    hgap?: number;
}) {
    const pin = placementPin(args.placement, args.pinNumber);
    if (!pin) return null;
    const kind = shortSymbolKindForSignal(pin.signal_name);
    if (!kind) return null;
    const short = createShortSymbolPlacement({
        kind,
        signalName: pin.signal_name,
        blockName: args.blockName,
        scope: args.scope,
        ordinal: args.ordinal,
        x: pin.x,
        y: pin.y,
    });
    const hgap = args.hgap ?? 25;
    const wgap = args.wgap ?? 25;

    if (pin.side === 'WEST') {
        short.x = pin.x - short.width - wgap;
        short.y = pin.y + hgap;
    } else if (pin.side === 'EAST') {
        short.x = pin.x + wgap;
        short.y = pin.y + hgap;
    } else {
        short.x = pin.x - short.width / 2;
        short.y = pin.side === 'NORTH' ? pin.y - short.height - hgap : pin.y + hgap;
    }
    setPinRoutingSignal(args.placement, args.pinNumber, short.designator);
    args.placements.push(short);
    return short;
}

export function fitPlacements(placements: MacroComponentPlacement[], padding: number) {
    const bounds = macroBounds(placements);
    const dx = padding - bounds.minX;
    const dy = padding - bounds.minY;
    translatePlacements(placements, dx, dy);
    return {
        dx,
        dy,
        width: bounds.maxX - bounds.minX + padding * 2,
        height: bounds.maxY - bounds.minY + padding * 2,
    };
}

export function symbolPinForComponentPin(
    symbol: SymbolWithMeta,
    pinNumber: string | number,
) {
    return symbol.symbol.pins.find(pin => pin.num == pinNumber) ?? null;
}
