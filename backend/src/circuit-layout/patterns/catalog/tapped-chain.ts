import { componentSignals, isGroundSignal, sharedSignals, shortSymbolKindForSignal } from '../helpers.ts';
import { instantiateTappedChain } from '../tapped-chain.ts';
import type { CircuitLayoutPattern, PatternMatch } from '../types.ts';

/** A visual tapped chain, not a claim that its parts form a voltage divider. */
export const tappedChainPattern: CircuitLayoutPattern = {
    id: 'tapped-chain', priority: 5,
    findMatches(context) {
        const matches: PatternMatch[] = [];
        for (const [blockName, components] of context.componentsByBlock) {
            const parts = components.filter(c => /^[RCLD]\d/.test(c.designator) && c.pins.length === 2);
            for (let i = 0; i < parts.length; i++) for (const b of parts.slice(i + 1)) {
                const a = parts[i], shared = sharedSignals(a, b);
                if (shared.length !== 1 || shortSymbolKindForSignal(shared[0])) continue;
                if (!(context.signalEndpoints.get(shared[0]) ?? []).some(p => p.designator !== a.designator && p.designator !== b.designator
                    && p.blockName === blockName)) continue;
                // Three eligible arms on the same bus offer several equally
                // plausible pairs. Leave them to ELK instead of selecting one.
                if (parts.filter(c => componentSignals(c).has(shared[0])).length !== 2) continue;
                const outer = [a, b].map(c => [...componentSignals(c)].filter(s => s !== shared[0]));
                if (outer.some(s => s.length !== 1) || outer[0][0] === outer[1][0]) continue;
                const grounded = outer.map(s => isGroundSignal(s[0]));
                if (grounded[0] === grounded[1]) continue;
                const [top, bottom] = grounded[0] ? [b, a] : [a, b];
                const outerSignal = [...componentSignals(top)].find(s => s !== shared[0])!;
                const anchors = (context.signalEndpoints.get(outerSignal) ?? []).filter(p => p.blockName === blockName
                    && p.designator !== top.designator && p.designator !== bottom.designator
                    && (/^U/i.test(p.designator) || (context.symbolsByDesignator.get(p.designator)?.symbol.pins.length ?? 0) > 4));
                let entrySide = '';
                if (anchors.length === 1 && !shortSymbolKindForSignal(outerSignal)) {
                    const anchor = context.symbolsByDesignator.get(anchors[0].designator)?.symbol;
                    const pin = anchor?.pins.find(p => String(p.num) === String(anchors[0].pinNumber));
                    if (anchor && pin) {
                        if (Math.abs(pin.x) < 1e-5) entrySide = 'EAST';
                        else if (Math.abs(pin.x - anchor.width) < 1e-5) entrySide = 'WEST';
                    }
                }
                matches.push({ patternId: this.id, priority: this.priority, blockName, designators: [top.designator, bottom.designator],
                    roles: { top: top.designator, bottom: bottom.designator, middleSignal: shared[0], entrySide } });
            }
        }
        return matches;
    },
    instantiate: (match, context) => instantiateTappedChain(match, context, true),
};
