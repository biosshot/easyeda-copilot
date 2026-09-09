import type { CircuitComponent } from '#types/circuit.ts';
import type { SymbolWithMeta } from '#types/symbol.ts';
import { getDesignatorLabel } from '#utils/component.ts';
import { isGroundSignal } from '../helpers.ts';

export function normalizePinName(name: string) {
    return name.toUpperCase()
        .replace(/[−–—]/g, '-')
        .replace(/[^A-Z0-9+\-/]/g, '');
}

export function isTwoPinKind(component: CircuitComponent, kind: 'resistor' | 'capacitor' | 'series') {
    if (component.pins.length !== 2) return false;
    const label = getDesignatorLabel(component.designator);
    if (kind === 'resistor') return label === 'Резисторы';
    if (kind === 'capacitor') return label === 'Конденсаторы';
    return label === 'Резисторы' || label === 'Индуктивности';
}

export function branchToGround(component: CircuitComponent, signalName: string) {
    if (component.pins.length !== 2) return null;
    const signalPin = component.pins.find(pin => pin.signal_name === signalName);
    const groundPin = component.pins.find(pin => isGroundSignal(pin.signal_name));
    return signalPin && groundPin && signalPin.pin_number != groundPin.pin_number
        ? { signalPin, groundPin }
        : null;
}

export function componentBetween(component: CircuitComponent, left: string, right: string) {
    if (component.pins.length !== 2 || left === right) return false;
    const signals = new Set(component.pins.map(pin => pin.signal_name));
    return signals.size === 2 && signals.has(left) && signals.has(right);
}

export type OpAmpPins = {
    plus: string | number;
    minus: string | number;
    output: string | number;
};

export function findOpAmpPins(component: CircuitComponent, symbol: SymbolWithMeta): OpAmpPins | null {
    const names = new Map<string, string[]>();
    for (const pin of component.pins) names.set(String(pin.pin_number), [normalizePinName(pin.name)]);
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
            || name.includes('IN+') || name.includes('+IN')
            || /^IN[A-Z0-9]*\+$/.test(name)
            || name.includes('NONINVERT'))) {
            plus = pin.pin_number;
        } else if (variants.some(name => name === '-'
            || name.includes('IN-') || name.includes('-IN')
            || /^IN[A-Z0-9]*-$/.test(name)
            || (/INV/.test(name) && !/NONINV/.test(name)))) {
            minus = pin.pin_number;
        } else if (variants.some(name => name.includes('OUT'))) {
            output = pin.pin_number;
        }
    }
    return plus !== undefined && minus !== undefined && output !== undefined
        ? { plus, minus, output }
        : null;
}

export function findPinByNames(component: CircuitComponent, expressions: RegExp[]) {
    return component.pins.find(pin => {
        const name = normalizePinName(pin.name);
        return expressions.some(expression => expression.test(name));
    }) ?? null;
}

export function uniqueComponents<T extends CircuitComponent>(components: T[]) {
    return [...new Map(components.map(component => [component.designator, component])).values()];
}
