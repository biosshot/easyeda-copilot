import type {
    Box,
    PcbComponent,
    Placement,
    PlacementGraphDiagnostic,
    PlacementInput,
    Point,
} from '#types/pcb/layout-model.ts';
import { normalizeRotation } from '#utils/math.ts';
import {
    boardHoleKeepoutRadius,
    boardBox,
    boxClearanceGap,
    boxPointGap,
    componentPairCollisionBoxPairs,
    dist,
    getBox,
} from '../pcb-auto-place/geometry.ts';
import { componentOutsideBoard } from '../pcb-auto-place/fixed.ts';
import { expandHints } from '../pcb-auto-place/hints.ts';
import {
    componentPairClearance,
    blockBboxLimit,
    blockBox,
    canonicalModuleDesignators,
    designatorsBox,
    familyBboxLimit,
    familyBox,
    moduleBboxLimit,
    placementsCanConflict,
    pointToBoxGap,
    resolveBlockAnchorPoint,
    resolveTargetBox,
    resolveTargetPoint,
} from '../pcb-auto-place/report-helpers.ts';
import { NATIVE_POST_PLACE_SCORE_CONTRACT_VERSION } from './native/contract.ts';
import { encodeNativePostPlaceScoreProblem } from './native/encode-post-place-score.ts';
import { loadNativeBoardPacker } from './native/load-native-board-packer.ts';

export interface PostPlaceMove {
    kind: 'rotate_180' | 'swap';
    designators: string[];
    description: string;
    scoreBefore: number;
    scoreAfter: number;
}

export interface PostPlaceRefineResult {
    placements: Placement[];
    diagnostics: PlacementGraphDiagnostic[];
    moves: PostPlaceMove[];
    scoreBefore: number;
    scoreAfter: number;
}

type Candidate = {
    placements: Placement[];
    changed: Set<string>;
    key: string;
    kind: PostPlaceMove['kind'];
    description: string;
};

const GEOMETRY_EPSILON = 0.001;

/**
 * Final placement polish. It never invents coordinates: components may only
 * rotate 180 degrees in place or exchange poses resolved by the global solver.
 */
export function refinePostPlacement(input: PlacementInput, placements: Placement[]): PostPlaceRefineResult {
    const iterations = Math.max(0, Math.floor(input.solverOptions.localImproveIterations));
    const minDelta = Math.max(0, input.solverOptions.localImproveMinDelta);
    const initialScore = globalPostPlaceScore(input, placements);
    let current = placements.map((placement) => ({ ...placement }));
    let currentScore = initialScore;
    const moves: PostPlaceMove[] = [];

    for (let iteration = 0; iteration < iterations; iteration += 1) {
        let best: Candidate | null = null;
        let bestScore = currentScore;
        for (const candidate of placementCandidates(input, current)) {
            if (!candidateIntroducesNoNewHardViolations(input, current, candidate.placements, candidate.changed)) continue;
            const score = globalPostPlaceScore(input, candidate.placements);
            if (score + minDelta >= bestScore) continue;
            if (best && Math.abs(score - bestScore) <= GEOMETRY_EPSILON && candidate.key.localeCompare(best.key) >= 0) continue;
            best = candidate;
            bestScore = score;
        }
        if (!best) break;
        moves.push({
            kind: best.kind,
            designators: [...best.changed].sort(),
            description: best.description,
            scoreBefore: roundScore(currentScore),
            scoreAfter: roundScore(bestScore),
        });
        current = best.placements;
        currentScore = bestScore;
    }

    const diagnostics = fixedPlacementOpportunities(input, current, currentScore, minDelta);
    return {
        placements: current,
        diagnostics,
        moves,
        scoreBefore: roundScore(initialScore),
        scoreAfter: roundScore(currentScore),
    };
}

export function globalPostPlaceScore(input: PlacementInput, placements: Placement[]) {
    const addon = loadNativeBoardPacker();
    const nativeVersion = addon.postPlaceScoreContractVersion();
    if (nativeVersion !== NATIVE_POST_PLACE_SCORE_CONTRACT_VERSION) {
        throw new Error(`Rust post-place score contract ${nativeVersion} does not match TypeScript contract ${NATIVE_POST_PLACE_SCORE_CONTRACT_VERSION}`);
    }
    return addon.scorePostPlace(encodeNativePostPlaceScoreProblem(input, placements));
}

function placementCandidates(input: PlacementInput, placements: Placement[]) {
    const candidates: Candidate[] = [];
    const seen = new Set<string>();
    const componentByDesignator = new Map(input.components.map((component) => [component.designator, component]));
    const placementByDesignator = new Map(placements.map((placement) => [placement.designator, placement]));
    const explicitMembers = new Set((input.refineGroups ?? []).flatMap((group) => group.componentDesignators));

    for (const component of input.components) {
        if (explicitMembers.has(component.designator)) continue;
        if (!isAutomaticallyRefinable(component)) continue;
        const placement = placementByDesignator.get(component.designator);
        if (!placement || !rotationAllowed(component, placement.rotate + 180)) continue;
        addCandidate(candidates, seen, replacePlacements(placements, [{ ...placement, rotate: normalizeRotation(placement.rotate + 180) }]), new Set([component.designator]), 'rotate_180', `${component.designator} rotate += 180`);
    }

    for (const block of input.blocks) {
        const components = block.component_designators
            .map((designator) => componentByDesignator.get(designator))
            .filter((component): component is PcbComponent => Boolean(component))
            .filter((component) => !explicitMembers.has(component.designator) && isAutomaticallyRefinable(component));
        for (let aIndex = 0; aIndex < components.length; aIndex += 1) {
            for (let bIndex = aIndex + 1; bIndex < components.length; bIndex += 1) {
                const a = components[aIndex];
                const b = components[bIndex];
                if (!componentsArePoseCompatible(a, b)) continue;
                addSwapVariants(candidates, seen, placements, a, b, [0, 180]);
            }
        }
    }

    for (const group of input.refineGroups ?? []) {
        const components = group.componentDesignators
            .map((designator) => componentByDesignator.get(designator))
            .filter((component): component is PcbComponent => Boolean(component))
            .filter(isExplicitlyRefinable);
        if (group.rotateBy.includes(180)) {
            for (const component of components) {
                const placement = placementByDesignator.get(component.designator);
                if (!placement || !rotationAllowed(component, placement.rotate + 180)) continue;
                addCandidate(candidates, seen, replacePlacements(placements, [{ ...placement, rotate: normalizeRotation(placement.rotate + 180) }]), new Set([component.designator]), 'rotate_180', `${group.name}: ${component.designator} rotate += 180`);
            }
        }
        if (!group.swap) continue;
        for (let aIndex = 0; aIndex < components.length; aIndex += 1) {
            for (let bIndex = aIndex + 1; bIndex < components.length; bIndex += 1) {
                const a = components[aIndex];
                const b = components[bIndex];
                if (!componentsArePoseCompatible(a, b)) continue;
                addSwapVariants(candidates, seen, placements, a, b, group.rotateBy.includes(180) ? [0, 180] : [0], group.name);
            }
        }
    }
    return candidates.sort((a, b) => a.key.localeCompare(b.key));
}

function addSwapVariants(
    candidates: Candidate[],
    seen: Set<string>,
    placements: Placement[],
    a: PcbComponent,
    b: PcbComponent,
    rotationDeltas: number[],
    groupName?: string,
) {
    const placementByDesignator = new Map(placements.map((placement) => [placement.designator, placement]));
    const aPlacement = placementByDesignator.get(a.designator);
    const bPlacement = placementByDesignator.get(b.designator);
    if (!aPlacement || !bPlacement) return;
    const geometryOffset = compatibleGeometryRotationOffset(a, b) ?? 0;
    for (const aDelta of rotationDeltas) {
        for (const bDelta of rotationDeltas) {
            const movedA = {
                ...aPlacement,
                x: bPlacement.x,
                y: bPlacement.y,
                layer: bPlacement.layer,
                rotate: normalizeRotation(bPlacement.rotate + geometryOffset + aDelta),
            };
            const movedB = {
                ...bPlacement,
                x: aPlacement.x,
                y: aPlacement.y,
                layer: aPlacement.layer,
                rotate: normalizeRotation(aPlacement.rotate - geometryOffset + bDelta),
            };
            if (!rotationAllowed(a, movedA.rotate) || !rotationAllowed(b, movedB.rotate)) continue;
            const suffix = [aDelta ? `${a.designator}+=180` : '', bDelta ? `${b.designator}+=180` : ''].filter(Boolean).join(', ');
            addCandidate(
                candidates,
                seen,
                replacePlacements(placements, [movedA, movedB]),
                new Set([a.designator, b.designator]),
                'swap',
                `${groupName ? `${groupName}: ` : ''}${a.designator}<->${b.designator}${suffix ? `; ${suffix}` : ''}`,
            );
        }
    }
}

function addCandidate(
    candidates: Candidate[],
    seen: Set<string>,
    placements: Placement[],
    changed: Set<string>,
    kind: Candidate['kind'],
    description: string,
) {
    const key = [...changed].sort().map((designator) => {
        const placement = placements.find((item) => item.designator === designator)!;
        return `${designator}:${placement.x}:${placement.y}:${placement.rotate}:${placement.layer}`;
    }).join('|');
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ placements, changed, key, kind, description });
}

function fixedPlacementOpportunities(input: PlacementInput, placements: Placement[], currentScore: number, minDelta: number) {
    const diagnostics: PlacementGraphDiagnostic[] = [];
    const pairOpportunityMembers = new Set<string>();
    const explicitMembers = new Set((input.refineGroups ?? []).flatMap((group) => group.componentDesignators));
    const fixed = input.components.filter((component) => (
        component.pcb.fixedPlacement
        && !explicitMembers.has(component.designator)
        && isExplicitlyRefinable(component)
    ));
    for (let aIndex = 0; aIndex < fixed.length; aIndex += 1) {
        for (let bIndex = aIndex + 1; bIndex < fixed.length; bIndex += 1) {
            const a = fixed[aIndex];
            const b = fixed[bIndex];
            if (!componentsArePoseCompatible(a, b)) continue;
            const variants: Candidate[] = [];
            addSwapVariants(variants, new Set(), placements, a, b, [0, 180]);
            let best: { candidate: Candidate; score: number } | null = null;
            for (const candidate of variants) {
                if (!candidateIntroducesNoNewHardViolations(input, placements, candidate.placements, candidate.changed)) continue;
                const score = globalPostPlaceScore(input, candidate.placements);
                if (score + minDelta >= currentScore || (best && score >= best.score - GEOMETRY_EPSILON)) continue;
                best = { candidate, score };
            }
            if (!best) continue;
            pairOpportunityMembers.add(a.designator);
            pairOpportunityMembers.add(b.designator);
            const needsRotation = best.candidate.description.includes('+=180');
            const options = needsRotation ? '{ swap: true, rotateBy: [180] }' : '{ swap: true }';
            diagnostics.push({
                severity: 'warning',
                code: 'post_place_opportunity',
                nodeId: `post-place:${a.designator}:${b.designator}`,
                message: `${a.designator}/${b.designator}: potential post-place improvement ${best.candidate.description}; global score ${roundScore(currentScore)} -> ${roundScore(best.score)}. Operation is blocked by fixed placement. Add refineGroup("post_${a.designator}_${b.designator}", ["${a.designator}", "${b.designator}"], ${options});`,
            });
        }
    }
    const placementByDesignator = new Map(placements.map((placement) => [placement.designator, placement]));
    for (const component of fixed) {
        if (pairOpportunityMembers.has(component.designator)) continue;
        const placement = placementByDesignator.get(component.designator);
        if (!placement || !rotationAllowed(component, placement.rotate + 180)) continue;
        const candidate: Candidate = {
            placements: replacePlacements(placements, [{ ...placement, rotate: normalizeRotation(placement.rotate + 180) }]),
            changed: new Set([component.designator]),
            key: component.designator,
            kind: 'rotate_180',
            description: `${component.designator} rotate += 180`,
        };
        if (!candidateIntroducesNoNewHardViolations(input, placements, candidate.placements, candidate.changed)) continue;
        const score = globalPostPlaceScore(input, candidate.placements);
        if (score + minDelta >= currentScore) continue;
        diagnostics.push({
            severity: 'warning',
            code: 'post_place_opportunity',
            nodeId: `post-place:${component.designator}`,
            message: `${component.designator}: potential post-place improvement ${candidate.description}; global score ${roundScore(currentScore)} -> ${roundScore(score)}. Operation is blocked by fixed placement. Add refineGroup("post_${component.designator}", ["${component.designator}"], { rotateBy: [180] });`,
        });
    }
    return diagnostics;
}

function candidateIntroducesNoNewHardViolations(
    input: PlacementInput,
    baselinePlacements: Placement[],
    candidatePlacements: Placement[],
    changed: Set<string>,
) {
    // Existing placement debt must not freeze unrelated post-place improvements.
    // Reject only violation identities that appear for the first time.
    const baseline = collectHardViolationKeys(input, baselinePlacements, changed);
    const candidate = collectHardViolationKeys(input, candidatePlacements, changed);
    return [...candidate].every((violation) => baseline.has(violation));
}

function collectHardViolationKeys(input: PlacementInput, placements: Placement[], changed: Set<string>) {
    const violations = new Set<string>();
    const placementByDesignator = new Map(placements.map((placement) => [placement.designator, placement]));
    const componentByDesignator = new Map(input.components.map((component) => [component.designator, component]));

    for (const designator of changed) {
        const component = componentByDesignator.get(designator);
        const placement = placementByDesignator.get(designator);
        if (!component || !placement) {
            violations.add(`component:${designator}:missing`);
            continue;
        }
        if (!rotationAllowed(component, placement.rotate)) violations.add(`component:${designator}:rotation`);
        if (!component.pcb.allowedLayers.includes(placement.layer) || !input.board.allowedLayers.includes(placement.layer)) {
            violations.add(`component:${designator}:layer`);
        }
        const box = getBox(component, placement);
        if (componentOutsideBoard(input, component, box)) violations.add(`component:${designator}:outside-board`);
        for (const [holeIndex, hole] of (input.boardHoles ?? []).entries()) {
            const required = boardHoleKeepoutRadius(hole) + input.board.clearances.component;
            if (boxPointGap(box, hole) + GEOMETRY_EPSILON < required) {
                violations.add(`component:${designator}:board-hole:${holeIndex}`);
            }
        }
        for (const [regionIndex, region] of (input.constraintRegions ?? []).entries()) {
            if (region.allowBlocks.includes(component.block_name) || !region.layers.includes(placement.layer)) continue;
            if (boxesOverlap(box, region.box)) violations.add(`component:${designator}:region:${region.name}:${regionIndex}`);
        }
    }

    for (let aIndex = 0; aIndex < input.components.length; aIndex += 1) {
        const a = input.components[aIndex];
        const aPlacement = placementByDesignator.get(a.designator);
        if (!aPlacement) continue;
        for (let bIndex = aIndex + 1; bIndex < input.components.length; bIndex += 1) {
            const b = input.components[bIndex];
            if (!changed.has(a.designator) && !changed.has(b.designator)) continue;
            const bPlacement = placementByDesignator.get(b.designator);
            if (!bPlacement) {
                violations.add(`component:${b.designator}:missing`);
                continue;
            }
            if (!placementsCanConflict(a, aPlacement, b, bPlacement)) continue;
            const required = componentPairClearance(input, a, b);
            const pairs = componentPairCollisionBoxPairs(a, aPlacement, b, bPlacement);
            if (pairs.some((pair) => boxClearanceGap(pair.a, pair.b) + GEOMETRY_EPSILON < required)) {
                violations.add(`collision:${a.designator}:${b.designator}`);
            }
        }
    }

    for (const [ruleIndex, rule] of expandHints(input).entries()) {
        if (!rule.hard) continue;
        if (rule.kind === 'distance' && rule.target && rule.target !== 'all') {
            const source = resolveTargetPoint(input, rule.source, placementByDesignator, componentByDesignator);
            const target = resolveTargetPoint(input, rule.target, placementByDesignator, componentByDesignator);
            if (!source || !target) {
                violations.add(`hint:${ruleIndex}:unresolved`);
                continue;
            }
            const value = dist(source, target);
            if (rule.min !== undefined && value + GEOMETRY_EPSILON < rule.min) violations.add(`hint:${ruleIndex}:min`);
            if (rule.max !== undefined && value > rule.max + GEOMETRY_EPSILON) violations.add(`hint:${ruleIndex}:max`);
        }
        if (rule.kind === 'clearance' && rule.target) {
            const source = resolveTargetBox(input, rule.source, placementByDesignator, componentByDesignator);
            if (!source) {
                violations.add(`hint:${ruleIndex}:unresolved-source`);
                continue;
            }
            const targets: Array<{ key: string; box: Box }> = rule.target === 'all'
                ? input.components.flatMap((component) => {
                    if (targetContainsDesignator(rule.source, component.designator)) return [];
                    const placement = placementByDesignator.get(component.designator);
                    return placement ? [{ key: component.designator, box: getBox(component, placement) }] : [];
                })
                : [resolveTargetBox(input, rule.target, placementByDesignator, componentByDesignator)]
                    .flatMap((box) => box ? [{ key: 'target', box }] : []);
            if (rule.min !== undefined) {
                for (const target of targets) {
                    if (boxClearanceGap(source, target.box) + GEOMETRY_EPSILON < rule.min) {
                        violations.add(`hint:${ruleIndex}:clearance:${target.key}`);
                    }
                }
            }
        }
        if (rule.kind === 'edge' && rule.edge) {
            const source = resolveTargetBox(input, rule.source, placementByDesignator, componentByDesignator);
            if (!source) {
                violations.add(`hint:${ruleIndex}:unresolved-source`);
                continue;
            }
            const value = boxDistanceToEdge(input, source, rule.edge);
            if (rule.min !== undefined && value + GEOMETRY_EPSILON < rule.min) violations.add(`hint:${ruleIndex}:min`);
            if (rule.max !== undefined && value > rule.max + GEOMETRY_EPSILON) violations.add(`hint:${ruleIndex}:max`);
        }
    }
    collectHierarchyHardViolationKeys(input, placementByDesignator, componentByDesignator, violations);
    return violations;
}

function collectHierarchyHardViolationKeys(
    input: PlacementInput,
    placements: Map<string, Placement>,
    components: Map<string, PcbComponent>,
    violations: Set<string>,
) {
    for (const block of input.blocks) {
        const box = blockBox(input, block.name, placements, components);
        if (!box) continue;
        if (block.hardBbox && boxExceedsLimit(box, blockBboxLimit(input, block, components))) {
            violations.add(`block:${block.name}:bbox`);
        }
        if (block.familyHard) {
            const boxValue = familyBox(input, block, placements, components);
            if (boxValue && boxExceedsLimit(boxValue, familyBboxLimit(input, block, components))) {
                violations.add(`block:${block.name}:family-bbox`);
            }
        }
        if (block.hardAnchor && block.anchor && block.maxAnchorGap !== undefined) {
            const anchor = resolveBlockAnchorPoint(input, block, placements, components);
            if (!anchor || pointToBoxGap(anchor, box) > block.maxAnchorGap + GEOMETRY_EPSILON) {
                violations.add(`block:${block.name}:anchor`);
            }
        }
    }
    for (const module of input.modules) {
        if (!module.hardBbox) continue;
        const box = designatorsBox([...canonicalModuleDesignators(input, module)], placements, components);
        if (box && boxExceedsLimit(box, moduleBboxLimit(input, module, components))) {
            violations.add(`module:${module.name}:bbox`);
        }
    }
}

function boxExceedsLimit(box: Box, limit: { maxWidth: number | null; maxHeight: number | null }) {
    const width = box.right - box.left;
    const height = box.bottom - box.top;
    return (limit.maxWidth !== null && width > limit.maxWidth + GEOMETRY_EPSILON)
        || (limit.maxHeight !== null && height > limit.maxHeight + GEOMETRY_EPSILON);
}

function componentsArePoseCompatible(a: PcbComponent, b: PcbComponent) {
    return Boolean(a.part_uuid && b.part_uuid && a.part_uuid === b.part_uuid)
        || Boolean(a.footprint_uuid && b.footprint_uuid && a.footprint_uuid === b.footprint_uuid)
        || compatibleGeometryRotationOffset(a, b) !== null;
}

function compatibleGeometryRotationOffset(a: PcbComponent, b: PcbComponent) {
    const target = footprintGeometrySignature(b, 0);
    return [0, 90, 180, 270].find((angle) => footprintGeometrySignature(a, angle) === target) ?? null;
}

function footprintGeometrySignature(component: PcbComponent, angle: number) {
    const rotated = component.footprint.pads.map((pad) => {
        const point = rotateLocal({ x: pad.x, y: pad.y }, angle);
        const quarterTurn = angle % 180 !== 0;
        return [
            roundGeometry(point.x),
            roundGeometry(point.y),
            roundGeometry(quarterTurn ? pad.height : pad.width),
            roundGeometry(quarterTurn ? pad.width : pad.height),
            pad.shape ?? '',
            pad.mount ?? '',
            roundGeometry(pad.drillDiameter ?? 0),
        ].join(':');
    }).sort();
    const size = angle % 180 === 0
        ? [component.footprint.width, component.footprint.height]
        : [component.footprint.height, component.footprint.width];
    return `${roundGeometry(size[0])}x${roundGeometry(size[1])}|${rotated.join('|')}`;
}

function isAutomaticallyRefinable(component: PcbComponent) {
    return !component.pcb.fixedPlacement && isExplicitlyRefinable(component);
}

function isExplicitlyRefinable(component: PcbComponent) {
    return !component.pcb.edgeMount
        && !component.pcb.edgePlace
        && !component.pcb.syntheticBoardPad;
}

function rotationAllowed(component: PcbComponent, rotation: number) {
    const normalized = normalizeRotation(rotation);
    const allowed = component.pcb.allowedRotations.length > 0 ? component.pcb.allowedRotations : [0, 90, 180, 270];
    return allowed.some((angle) => normalizeRotation(angle) === normalized);
}

function boxDistanceToEdge(input: PlacementInput, box: Box, edge: 'left' | 'right' | 'top' | 'bottom') {
    const board = boardBox(input.board);
    if (edge === 'left') return Math.abs(box.left - board.left);
    if (edge === 'right') return Math.abs(board.right - box.right);
    if (edge === 'top') return Math.abs(box.top - board.top);
    return Math.abs(board.bottom - box.bottom);
}

function targetContainsDesignator(target: { type: string; designator?: string }, designator: string) {
    return (target.type === 'component' || target.type === 'pin') && target.designator === designator;
}

function replacePlacements(placements: Placement[], replacements: Placement[]) {
    const byDesignator = new Map(replacements.map((placement) => [placement.designator, placement]));
    return placements.map((placement) => byDesignator.get(placement.designator) ?? placement);
}

function boxesOverlap(a: Box, b: Box) {
    return Math.min(a.right - b.left, b.right - a.left) > GEOMETRY_EPSILON
        && Math.min(a.bottom - b.top, b.bottom - a.top) > GEOMETRY_EPSILON;
}

function rotateLocal(point: Point, angle: number) {
    const radians = angle * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos };
}

function roundGeometry(value: number) {
    return Math.round(value * 1000) / 1000;
}

function roundScore(value: number) {
    return Math.round(value * 1000) / 1000;
}
