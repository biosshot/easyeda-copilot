import type { HintPriority, NumericRule, PlacementHint, PlacementInput } from '#types/pcb/layout-model.ts';

export function expandHints(input: PlacementInput): NumericRule[] {
    return input.hints.flatMap((hint): NumericRule[] => {
        const weight = priorityWeight(hint.priority);

        if (hint.relation === 'line' || hint.relation === 'bypass' || hint.relation === 'cap_cluster') {
            return [];
        }

        if (hint.relation === 'critical_pair') {
            const multiplier = hint.weightMultiplier ?? (hint.core ? 2.4 : 1.8);
            return [{
                kind: 'distance',
                source: hint.source,
                target: hint.target,
                min: hint.minDistance,
                max: hint.path ? hint.maxDistance : hint.maxDistance ?? (hint.core ? 3 : semanticDistance('very_near', hint.priority)),
                weight: weight * multiplier,
                hard: hint.hard ?? (hint.path ? false : hint.priority === 'critical'),
                criticalPair: true,
                corePair: hint.core,
                crossingPenalty: hint.crossingPenalty ?? (hint.core ? 2 : 0),
                preferFacingPads: hint.preferFacingPads ?? hint.core === true,
            }];
        }

        if (hint.relation === 'edge') {
            return [{
                kind: 'edge',
                source: hint.source,
                edge: hint.edge,
                orientation: hint.orientation ?? 'any',
                max: input.board.clearances.edge + 0.5,
                weight,
                hard: hint.priority === 'critical',
            }];
        }

        if (hint.relation === 'prefer_layer') {
            return [{ kind: 'prefer_layer', source: hint.source, layer: hint.layer, weight }];
        }

        if (hint.relation === 'same_side') {
            return [{ kind: 'same_side', source: hint.source, target: hint.target, weight }];
        }

        if (hint.relation === 'away_from') {
            return [{ kind: 'clearance', source: hint.source, target: hint.target, min: semanticDistance('away_from', hint.priority), weight }];
        }

        if (hint.relation === 'clearance') {
            return [{ kind: 'clearance', source: hint.source, target: hint.target, min: hint.min, weight, hard: hint.priority === 'critical' }];
        }

        return [{
            kind: 'distance',
            source: hint.source,
            target: hint.target,
            min: hint.relation === 'very_near' ? 0.4 : 0.8,
            max: semanticDistance(hint.relation, hint.priority),
            weight,
            hard: hint.relation === 'very_near' && hint.priority === 'critical',
        }];
    });
}

export function priorityWeight(priority: HintPriority) {
    if (priority === 'critical') return 240;
    if (priority === 'high') return 140;
    if (priority === 'normal') return 70;
    return 25;
}

function semanticDistance(relation: PlacementHint['relation'], priority: HintPriority) {
    if (relation === 'very_near') return priority === 'critical' ? 3 : 4;
    if (relation === 'near') return priority === 'high' || priority === 'critical' ? 8 : 12;
    if (relation === 'cluster_with') return 10;
    if (relation === 'away_from') return priority === 'high' || priority === 'critical' ? 12 : 8;
    return 8;
}
