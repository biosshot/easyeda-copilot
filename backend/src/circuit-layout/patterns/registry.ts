import { crystalOscillatorPattern } from './catalog/crystal-oscillator.ts';
import { opAmpInvertingPattern } from './catalog/opamp-inverting.ts';
import { opAmpNonInvertingPattern } from './catalog/opamp-noninverting.ts';
import { opAmpVoltageFollowerPattern } from './catalog/opamp-voltage-follower.ts';
import { powerPiFilterPattern } from './catalog/power-pi-filter.ts';
import { parallelTwoPinPattern } from './catalog/parallel-two-pin.ts';
import type { CircuitLayoutPattern } from './types.ts';
import { voltageDividerPattern } from './catalog/voltage-divider.ts';
import { ledResistorPattern } from './catalog/led-resistor.ts';
import { tappedChainPattern } from './catalog/tapped-chain.ts';
import { instantiateTappedChain } from './tapped-chain.ts';

export const circuitLayoutPatterns: CircuitLayoutPattern[] = [
    opAmpVoltageFollowerPattern,
    opAmpInvertingPattern,
    crystalOscillatorPattern,
    opAmpNonInvertingPattern,
    powerPiFilterPattern,
    voltageDividerPattern,
    parallelTwoPinPattern,
];

/** Keep the main catalog as a reproducible baseline while the refinement is opt-in. */
const paddedPatterns = [...circuitLayoutPatterns.map(pattern => pattern.id === 'voltage-divider'
    ? { ...pattern, instantiate: (match: Parameters<typeof instantiateTappedChain>[0], context: Parameters<typeof instantiateTappedChain>[1]) => instantiateTappedChain(match, context, true) }
    : pattern), ledResistorPattern, tappedChainPattern];

export const refinedCircuitLayoutPatterns: CircuitLayoutPattern[] = paddedPatterns.map(pattern => ({ ...pattern,
    instantiate(match, context) {
        const macro = pattern.instantiate(match, context);
        if (macro?.placements.some(p => (p.designator.startsWith('U') || (context.symbolsByDesignator.get(p.designator)?.symbol.pins.length ?? 0) > 4)
            && ((p.rotate % 360) + 360) % 360 !== 0)) return null;
        if (macro && ['power-pi-filter', 'parallel-two-pin', 'voltage-divider', 'led-resistor', 'tapped-chain'].includes(pattern.id)) {
            macro.refinementRotations = [180];
        }
        return macro;
    },
}));
