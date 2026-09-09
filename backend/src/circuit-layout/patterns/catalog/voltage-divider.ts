import { getDesignatorLabel } from '#utils/component.ts';
import { componentSignals, isGroundSignal, sharedSignals } from '../helpers.ts';
import { instantiateTappedChain } from '../tapped-chain.ts';
import type { CircuitLayoutPattern, PatternMatch } from '../types.ts';

const PATTERN_ID = 'voltage-divider';

export const voltageDividerPattern: CircuitLayoutPattern = {
    id: PATTERN_ID,
    priority: 20,

    findMatches(context) {
        const matches: PatternMatch[] = [];

        for (const [blockName, components] of context.componentsByBlock) {
            const resistors = components
                .filter(component => getDesignatorLabel(component.designator) === 'Резисторы')
                .filter(component => component.pins.length === 2)
                .filter(component => context.symbolsByDesignator.has(component.designator))
                .sort((left, right) => left.designator.localeCompare(right.designator));

            for (let leftIndex = 0; leftIndex < resistors.length; leftIndex++) {
                for (let rightIndex = leftIndex + 1; rightIndex < resistors.length; rightIndex++) {
                    const left = resistors[leftIndex];
                    const right = resistors[rightIndex];
                    const shared = sharedSignals(left, right);
                    if (shared.length !== 1) continue;

                    const middleSignal = shared[0];
                    const leftOuter = [...componentSignals(left)].filter(signal => signal !== middleSignal);
                    const rightOuter = [...componentSignals(right)].filter(signal => signal !== middleSignal);
                    if (leftOuter.length !== 1 || rightOuter.length !== 1) continue;
                    if (leftOuter[0] === rightOuter[0]) continue;

                    const leftGrounded = isGroundSignal(leftOuter[0]);
                    const rightGrounded = isGroundSignal(rightOuter[0]);
                    if (leftGrounded === rightGrounded) continue;

                    const top = leftGrounded ? right : left;
                    const bottom = leftGrounded ? left : right;
                    matches.push({
                        patternId: PATTERN_ID,
                        priority: this.priority,
                        blockName,
                        designators: [top.designator, bottom.designator],
                        roles: {
                            top: top.designator,
                            bottom: bottom.designator,
                            middleSignal,
                        },
                    });
                }
            }
        }

        return matches;
    },

    instantiate: instantiateTappedChain,
};
