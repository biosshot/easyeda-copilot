use crate::geometry::{
    box_center, normalize_rotation, overlap_depth, rotate_box, rotate_point, round_placement,
    translate_box, union_boxes, Box2, Point,
};
use crate::model::{
    BlockComponentGeometry, BlockSolveProblem, BoardPackSolution, Placement, Primitive,
    PrimitiveState, Rank, Relation,
};
use crate::signal_path;
use std::cell::RefCell;
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

#[derive(Clone)]
struct WorkingPrimitive {
    id: u32,
    source_index: usize,
    primitive: Primitive,
    components: Arc<Vec<(usize, BlockComponentGeometry)>>,
    source_components: Arc<Vec<(usize, BlockComponentGeometry)>>,
    source_placements: Arc<Vec<Placement>>,
    source_node_ids: Arc<HashSet<Arc<str>>>,
    point_net_ids: Arc<Vec<Option<u32>>>,
    rotation: i32,
}

#[derive(Clone)]
struct SearchState {
    placed: Vec<WorkingPrimitive>,
    remaining: Vec<WorkingPrimitive>,
    incremental: IncrementalEvaluation,
    hard_violations: usize,
    score: f64,
    ordinal: usize,
}

#[derive(Clone)]
struct RankedCandidate {
    primitive: WorkingPrimitive,
    incremental: IncrementalEvaluation,
    hard_violations: usize,
    score: f64,
    ordinal: usize,
}

#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
struct PrimitivePoseKey {
    primitive_id: u32,
    rotation: i32,
    left: u64,
    top: u64,
    right: u64,
    bottom: u64,
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct SearchStateKey {
    remaining: Vec<u32>,
    placed: Vec<PrimitivePoseKey>,
}

#[derive(Clone, Copy)]
struct Evaluation {
    hard_violations: usize,
    score: f64,
}

#[derive(Clone)]
struct IncrementalEvaluation {
    evaluation: Evaluation,
    primitive_overlap_depths: Vec<f64>,
    size: usize,
}

struct Context {
    problem: BlockSolveProblem,
    relations: Vec<CompiledRelation>,
    net_ground: Vec<bool>,
    evaluation_cache: RefCell<HashMap<Vec<PrimitivePoseKey>, Evaluation>>,
    net_scoring_scratch: RefCell<NetScoringScratch>,
    validate_incremental_scoring: bool,
}

struct NetScoringScratch {
    accumulators: Vec<NetAccumulator>,
    signal_order: Vec<usize>,
    ground_order: Vec<usize>,
}

#[derive(Clone, Copy)]
struct NetAccumulator {
    seen: bool,
    point_count: usize,
    primitive_count: usize,
    last_primitive: u32,
    min_x: f64,
    max_x: f64,
    min_y: f64,
    max_y: f64,
}

impl Default for NetAccumulator {
    fn default() -> Self {
        Self {
            seen: false,
            point_count: 0,
            primitive_count: 0,
            last_primitive: u32::MAX,
            min_x: f64::INFINITY,
            max_x: f64::NEG_INFINITY,
            min_y: f64::INFINITY,
            max_y: f64::NEG_INFINITY,
        }
    }
}

#[derive(Clone, Copy)]
struct EndpointPoint {
    point: Point,
    primitive_id: Option<u32>,
}

#[derive(Clone)]
struct CompiledRelation {
    relation: Relation,
    from: CompiledEndpoint,
    to: CompiledEndpoint,
}

#[derive(Clone)]
enum CompiledEndpoint {
    Anchor(Option<Point>),
    Pad {
        primitive_id: u32,
        point_index: usize,
    },
    Component {
        primitive_id: u32,
        point_indices: Arc<Vec<usize>>,
    },
    Primitive {
        primitive_id: u32,
    },
    Missing,
}

pub fn solve_block(problem: BlockSolveProblem) -> Result<BoardPackSolution, String> {
    let primitive_ids = lexical_ids(
        problem
            .primitives
            .iter()
            .map(|primitive| primitive.id.clone()),
    );
    let mut components_by_primitive: HashMap<Arc<str>, Vec<(usize, BlockComponentGeometry)>> =
        HashMap::new();
    for (index, component) in problem.components.iter().cloned().enumerate() {
        components_by_primitive
            .entry(component.primitive_id.clone())
            .or_default()
            .push((index, component));
    }
    let mut net_ids = HashMap::<Arc<str>, u32>::new();
    let mut net_ground = Vec::new();
    for primitive in &problem.primitives {
        for point in primitive.connection_points.iter() {
            let Some(net) = &point.net else { continue };
            if net_ids.contains_key(net) {
                continue;
            }
            let id = net_ids.len() as u32;
            net_ground.push(is_ground(net));
            net_ids.insert(net.clone(), id);
        }
    }
    let primitives: Vec<WorkingPrimitive> = problem
        .primitives
        .iter()
        .cloned()
        .enumerate()
        .map(|(source_index, primitive)| {
            let source_node_ids = Arc::new(primitive.source_node_ids.iter().cloned().collect());
            let point_net_ids = Arc::new(
                primitive
                    .connection_points
                    .iter()
                    .map(|point| point.net.as_ref().and_then(|net| net_ids.get(net).copied()))
                    .collect(),
            );
            let components = Arc::new(
                components_by_primitive
                    .remove(&primitive.id)
                    .unwrap_or_default(),
            );
            WorkingPrimitive {
                id: primitive_ids[&primitive.id],
                source_index,
                components: components.clone(),
                source_components: components,
                source_placements: primitive.placements.clone(),
                primitive,
                source_node_ids,
                point_net_ids,
                rotation: 0,
            }
        })
        .collect();
    let relations = compile_relations(&problem.relations, &primitives, problem.bounds.as_ref());
    let context = Context {
        problem,
        relations,
        net_ground,
        evaluation_cache: RefCell::new(HashMap::new()),
        net_scoring_scratch: RefCell::new(NetScoringScratch {
            accumulators: vec![NetAccumulator::default(); net_ids.len()],
            signal_order: Vec::with_capacity(net_ids.len()),
            ground_order: Vec::with_capacity(net_ids.len()),
        }),
        validate_incremental_scoring: std::env::var_os("PCB_NATIVE_VALIDATE_INCREMENTAL_SCORING")
            .is_some_and(|value| value == "1"),
    };
    let solved = if context.problem.search_width > 1 {
        solve_beam(primitives, &context)
    } else {
        solve_greedy(primitives, &context)
    };
    let improved = local_improve(solved, &context);
    let has_global_frame =
        context.problem.bounds.is_some() || !context.problem.obstacles.is_empty();
    let final_primitives =
        if improved.iter().any(|primitive| primitive.primitive.locked) || has_global_frame {
            improved
        } else {
            center_primitives(improved, context.problem.grid)
        };
    solution(&context, &final_primitives)
}

fn solve_greedy(primitives: Vec<WorkingPrimitive>, context: &Context) -> Vec<WorkingPrimitive> {
    let mut placed: Vec<_> = primitives
        .iter()
        .filter(|primitive| primitive.primitive.locked)
        .cloned()
        .collect();
    let mut remaining: Vec<_> = primitives
        .into_iter()
        .filter(|primitive| !primitive.primitive.locked)
        .collect();
    remaining.sort_by(|a, b| compare_f64(seed_rank(b, context), seed_rank(a, context)));
    if placed.is_empty() && !remaining.is_empty() {
        let seed = remaining.remove(0);
        let candidates = block_candidates(&seed, &[], context);
        let candidate = best_candidate(&[], candidates, context)
            .unwrap_or_else(|| center_primitive(seed, context.problem.grid));
        placed.push(candidate);
    }
    let mut incremental = incremental_evaluation(&placed, context);
    while !remaining.is_empty() {
        let mut best_index = 0usize;
        let mut best: Option<WorkingPrimitive> = None;
        let mut best_hard = usize::MAX;
        let mut best_score = f64::INFINITY;
        let mut best_incremental = None;
        for (index, primitive) in remaining.iter().enumerate() {
            for candidate in block_candidates(primitive, &placed, context) {
                let mut variant = placed.clone();
                variant.push(candidate.clone());
                let candidate_incremental =
                    append_incremental_evaluation(&placed, &variant, &incremental, context);
                let evaluation = candidate_incremental.evaluation;
                let hard = evaluation.hard_violations;
                let score = evaluation.score;
                if hard < best_hard
                    || (hard == best_hard && compare_f64(score, best_score) == Ordering::Less)
                {
                    best_index = index;
                    best = Some(candidate);
                    best_hard = hard;
                    best_score = score;
                    best_incremental = Some(candidate_incremental);
                }
            }
        }
        let next = remaining.remove(best_index);
        if let Some(best) = best {
            placed.push(best);
            incremental = best_incremental.expect("best candidate must have an evaluation");
        } else {
            placed.push(center_primitive(next, context.problem.grid));
            incremental = incremental_evaluation(&placed, context);
        }
    }
    placed
}

fn solve_beam(primitives: Vec<WorkingPrimitive>, context: &Context) -> Vec<WorkingPrimitive> {
    let search_width = context.problem.search_width.max(2);
    let locked: Vec<_> = primitives
        .iter()
        .filter(|primitive| primitive.primitive.locked)
        .cloned()
        .collect();
    let mut remaining: Vec<_> = primitives
        .into_iter()
        .filter(|primitive| !primitive.primitive.locked)
        .collect();
    remaining.sort_by(|a, b| compare_f64(seed_rank(b, context), seed_rank(a, context)));
    let mut ordinal = 0usize;
    let initial_incremental = incremental_evaluation(&locked, context);
    let initial_evaluation = initial_incremental.evaluation;
    let mut states = vec![SearchState {
        hard_violations: initial_evaluation.hard_violations,
        score: initial_evaluation.score,
        placed: locked,
        remaining,
        incremental: initial_incremental,
        ordinal,
    }];
    while states.iter().any(|state| !state.remaining.is_empty()) {
        let mut expanded = Vec::new();
        for state in states {
            if state.remaining.is_empty() {
                expanded.push(state);
                continue;
            }
            let per_primitive_limit = 8usize.max(div_ceil(search_width, state.remaining.len()));
            for index in 0..state.remaining.len() {
                let primitive = &state.remaining[index];
                let mut ranked = Vec::new();
                for (candidate_ordinal, candidate) in
                    block_candidates(primitive, &state.placed, context)
                        .into_iter()
                        .enumerate()
                {
                    let mut placed = state.placed.clone();
                    placed.push(candidate.clone());
                    let incremental = append_incremental_evaluation(
                        &state.placed,
                        &placed,
                        &state.incremental,
                        context,
                    );
                    let evaluation = incremental.evaluation;
                    ranked.push(RankedCandidate {
                        hard_violations: evaluation.hard_violations,
                        score: evaluation.score,
                        primitive: candidate,
                        incremental,
                        ordinal: candidate_ordinal,
                    });
                }
                ranked.sort_by(compare_candidates);
                ranked.truncate(per_primitive_limit);
                for candidate in ranked {
                    ordinal += 1;
                    let mut placed = state.placed.clone();
                    placed.push(candidate.primitive);
                    let mut remaining = state.remaining.clone();
                    remaining.remove(index);
                    expanded.push(SearchState {
                        placed,
                        remaining,
                        incremental: candidate.incremental,
                        hard_violations: candidate.hard_violations,
                        score: candidate.score,
                        ordinal,
                    });
                }
            }
        }
        states = dedupe_states(expanded);
        states.sort_by(compare_states);
        states.truncate(search_width);
        if states.is_empty() {
            break;
        }
    }
    states.sort_by(compare_states);
    states
        .iter()
        .find(|state| state.remaining.is_empty())
        .or_else(|| states.first())
        .map(|state| state.placed.clone())
        .unwrap_or_default()
}

fn local_improve(mut current: Vec<WorkingPrimitive>, context: &Context) -> Vec<WorkingPrimitive> {
    let current_evaluation = evaluate(&current, context);
    let mut current_hard = current_evaluation.hard_violations;
    let mut current_score = current_evaluation.score;
    let max_passes = if current_hard > 0 {
        2usize.max(current.len())
    } else {
        2
    };
    for _ in 0..max_passes {
        let mut changed = false;
        for index in 0..current.len() {
            if current[index].primitive.locked {
                continue;
            }
            let fixed: Vec<_> = current
                .iter()
                .enumerate()
                .filter(|(item, _)| *item != index)
                .map(|(_, value)| value.clone())
                .collect();
            let mut best = current[index].clone();
            let mut best_hard = current_hard;
            let mut best_score = current_score;
            for candidate in block_candidates(&current[index], &fixed, context) {
                let mut variant = current.clone();
                variant[index] = candidate.clone();
                let evaluation = evaluate(&variant, context);
                let hard = evaluation.hard_violations;
                let score = evaluation.score;
                if hard < best_hard || (hard == best_hard && score + 0.001 < best_score) {
                    best = candidate;
                    best_hard = hard;
                    best_score = score;
                }
            }
            if primitive_pose_key(&best) != primitive_pose_key(&current[index]) {
                current[index] = best;
                current_hard = best_hard;
                current_score = best_score;
                changed = true;
            }
        }
        if !changed {
            break;
        }
    }
    current
}

fn best_candidate(
    placed: &[WorkingPrimitive],
    candidates: Vec<WorkingPrimitive>,
    context: &Context,
) -> Option<WorkingPrimitive> {
    let mut best = None;
    let mut best_hard = usize::MAX;
    let mut best_score = f64::INFINITY;
    for candidate in candidates {
        let mut variant = placed.to_vec();
        variant.push(candidate.clone());
        let evaluation = evaluate(&variant, context);
        let hard = evaluation.hard_violations;
        let score = evaluation.score;
        if hard < best_hard
            || (hard == best_hard && compare_f64(score, best_score) == Ordering::Less)
        {
            best = Some(candidate);
            best_hard = hard;
            best_score = score;
        }
    }
    best
}

fn solution(
    context: &Context,
    primitives: &[WorkingPrimitive],
) -> Result<BoardPackSolution, String> {
    let states = primitives
        .iter()
        .map(|primitive| {
            let source = &context.problem.primitives[primitive.source_index];
            let source_origin = box_center(&source.bbox);
            let rotated_first = source.placements.first().map(|placement| {
                rotate_point(
                    &Point {
                        x: placement.x,
                        y: placement.y,
                    },
                    &source_origin,
                    primitive.rotation,
                )
            });
            let final_first = primitive
                .primitive
                .placements
                .first()
                .map(|placement| Point {
                    x: placement.x,
                    y: placement.y,
                });
            let (translation_x, translation_y) = match (rotated_first, final_first) {
                (Some(source), Some(final_)) => (
                    round_placement(final_.x - source.x),
                    round_placement(final_.y - source.y),
                ),
                _ => {
                    let rotated = rotate_box(&source.bbox, &source_origin, primitive.rotation);
                    (
                        round_placement(primitive.primitive.bbox.left - rotated.left),
                        round_placement(primitive.primitive.bbox.top - rotated.top),
                    )
                }
            };
            PrimitiveState {
                primitive_id: primitive.primitive.id.clone(),
                rotation: primitive.rotation,
                translation_x,
                translation_y,
                placements: primitive.primitive.placements.as_ref().clone(),
            }
        })
        .collect();
    let evaluation = evaluate(primitives, context);
    Ok(BoardPackSolution {
        version: context.problem.version,
        states,
        rank: Rank {
            hard_count: evaluation.hard_violations,
            hard_severity: 0.0,
            score: evaluation.score,
        },
    })
}

// Candidate generation and scoring are kept below so the hot solver loop only
// operates on compact numeric working primitives.

fn block_candidates(
    primitive: &WorkingPrimitive,
    placed: &[WorkingPrimitive],
    context: &Context,
) -> Vec<WorkingPrimitive> {
    if primitive.primitive.locked {
        return vec![primitive.clone()];
    }
    let variants = orientation_variants(primitive);
    if placed.is_empty() {
        let primary: Vec<_> = variants
            .iter()
            .cloned()
            .map(|variant| fit_to_bounds(center_primitive(variant, context.problem.grid), context))
            .collect();
        if context.problem.bounds.is_none()
            || primary
                .iter()
                .any(|candidate| candidate_hard_violation_count(candidate, &[], context) == 0)
        {
            return dedupe_primitives(primary);
        }
        let mut all = primary.clone();
        all.extend(board_fallback_candidates(&variants, &[], &primary, context));
        return dedupe_primitives(all);
    }
    let mut primary = Vec::new();
    for variant in &variants {
        primary.extend(block_candidates_for_orientation(variant, placed, context));
    }
    let primary = dedupe_primitives(primary);
    if context.problem.bounds.is_none()
        || primary
            .iter()
            .any(|candidate| candidate_hard_violation_count(candidate, placed, context) == 0)
    {
        return primary;
    }
    let mut all = primary.clone();
    all.extend(board_fallback_candidates(
        &variants, placed, &primary, context,
    ));
    dedupe_primitives(all)
}

fn block_candidates_for_orientation(
    primitive: &WorkingPrimitive,
    placed: &[WorkingPrimitive],
    context: &Context,
) -> Vec<WorkingPrimitive> {
    let mut anchors: Vec<Box2> = placed
        .iter()
        .flat_map(|item| primitive_candidate_boxes(item, context))
        .collect();
    anchors.push(union_boxes(
        &placed
            .iter()
            .map(|item| item.primitive.bbox)
            .collect::<Vec<_>>(),
    ));
    let mut candidates = Vec::new();
    for anchor in anchors {
        let centers = adjacent_centers(
            primitive.primitive.width,
            primitive.primitive.height,
            &anchor,
            context.problem.clearance,
        );
        for center in centers {
            candidates.push(fit_to_bounds(
                move_primitive_center_exact(primitive.clone(), center),
                context,
            ));
            candidates.push(fit_to_bounds(
                move_primitive_center(primitive.clone(), center, context.problem.grid),
                context,
            ));
        }
        if context.problem.candidate_box_mode.as_ref() == "collision" {
            for moving_box in primitive_candidate_boxes(primitive, context) {
                candidates.extend(box_anchored_candidates(
                    primitive,
                    &moving_box,
                    &anchor,
                    context,
                ));
            }
        }
    }
    candidates.extend(relation_anchored_candidates(primitive, placed, context));
    let placed_primitives: Vec<_> = placed.iter().map(|item| &item.primitive).collect();
    for delta in signal_path::bridge_deltas(&primitive.primitive, &placed_primitives) {
        candidates.push(fit_to_bounds(
            translate_primitive(primitive, delta.x, delta.y),
            context,
        ));
        candidates.push(fit_to_bounds(
            translate_primitive(
                primitive,
                snap(delta.x, context.problem.grid),
                snap(delta.y, context.problem.grid),
            ),
            context,
        ));
    }
    dedupe_primitives(candidates)
}

fn adjacent_centers(width: f64, height: f64, anchor: &Box2, clearance: f64) -> [Point; 8] {
    let cx = (anchor.left + anchor.right) / 2.0;
    let cy = (anchor.top + anchor.bottom) / 2.0;
    [
        Point {
            x: anchor.right + clearance + width / 2.0,
            y: cy,
        },
        Point {
            x: anchor.left - clearance - width / 2.0,
            y: cy,
        },
        Point {
            x: cx,
            y: anchor.bottom + clearance + height / 2.0,
        },
        Point {
            x: cx,
            y: anchor.top - clearance - height / 2.0,
        },
        Point {
            x: anchor.right + clearance + width / 2.0,
            y: anchor.bottom + clearance + height / 2.0,
        },
        Point {
            x: anchor.right + clearance + width / 2.0,
            y: anchor.top - clearance - height / 2.0,
        },
        Point {
            x: anchor.left - clearance - width / 2.0,
            y: anchor.bottom + clearance + height / 2.0,
        },
        Point {
            x: anchor.left - clearance - width / 2.0,
            y: anchor.top - clearance - height / 2.0,
        },
    ]
}

fn box_anchored_candidates(
    primitive: &WorkingPrimitive,
    moving_box: &Box2,
    anchor: &Box2,
    context: &Context,
) -> Vec<WorkingPrimitive> {
    adjacent_centers(
        moving_box.right - moving_box.left,
        moving_box.bottom - moving_box.top,
        anchor,
        context.problem.clearance,
    )
    .into_iter()
    .flat_map(|center| {
        [
            fit_to_bounds(
                move_box_center_exact(primitive.clone(), moving_box, center),
                context,
            ),
            fit_to_bounds(
                move_box_center(primitive.clone(), moving_box, center, context.problem.grid),
                context,
            ),
        ]
    })
    .collect()
}

fn orientation_variants(primitive: &WorkingPrimitive) -> Vec<WorkingPrimitive> {
    let orientations: Vec<i32> = if primitive.primitive.locked {
        vec![0]
    } else if !primitive.primitive.allowed_orientations.is_empty() {
        primitive.primitive.allowed_orientations.as_ref().clone()
    } else if primitive.primitive.can_rotate {
        vec![0, 90, 180, 270]
    } else {
        vec![0]
    };
    orientations
        .into_iter()
        .map(|angle| rotate_primitive(primitive, angle))
        .collect()
}

fn translate_primitive(primitive: &WorkingPrimitive, dx: f64, dy: f64) -> WorkingPrimitive {
    let mut next = primitive.clone();
    next.primitive.bbox = translate_box(&next.primitive.bbox, dx, dy);
    next.primitive.collision_boxes = Arc::new(
        next.primitive
            .collision_boxes
            .iter()
            .map(|box_| translate_box(box_, dx, dy))
            .collect(),
    );
    next.primitive.placements = Arc::new(
        next.primitive
            .placements
            .iter()
            .cloned()
            .map(|mut placement| {
                placement.x = round_placement(placement.x + dx);
                placement.y = round_placement(placement.y + dy);
                placement
            })
            .collect(),
    );
    next.primitive.connection_points = Arc::new(
        next.primitive
            .connection_points
            .iter()
            .cloned()
            .map(|mut point| {
                point.x = round_placement(point.x + dx);
                point.y = round_placement(point.y + dy);
                point
            })
            .collect(),
    );
    next.primitive.path_ports = Arc::new(
        next.primitive
            .path_ports
            .iter()
            .cloned()
            .map(|mut port| {
                port.x = round_placement(port.x + dx);
                port.y = round_placement(port.y + dy);
                port
            })
            .collect(),
    );
    rebuild_component_geometry(&mut next);
    next
}

fn rotate_primitive(primitive: &WorkingPrimitive, angle: i32) -> WorkingPrimitive {
    let normalized = normalize_rotation(angle);
    if normalized == 0 {
        return primitive.clone();
    }
    let origin = box_center(&primitive.primitive.bbox);
    let mut next = primitive.clone();
    next.rotation = normalize_rotation(next.rotation + normalized);
    if !next.primitive.allowed_orientations.is_empty() {
        let mut orientations: Vec<_> = next
            .primitive
            .allowed_orientations
            .iter()
            .map(|orientation| normalize_rotation(*orientation - normalized))
            .collect();
        orientations.sort();
        orientations.dedup();
        next.primitive.allowed_orientations = Arc::new(orientations);
    }
    next.primitive.bbox = rotate_box(&primitive.primitive.bbox, &origin, normalized);
    next.primitive.width = round_placement(next.primitive.bbox.right - next.primitive.bbox.left);
    next.primitive.height = round_placement(next.primitive.bbox.bottom - next.primitive.bbox.top);
    next.primitive.collision_boxes = Arc::new(
        primitive
            .primitive
            .collision_boxes
            .iter()
            .map(|box_| rotate_box(box_, &origin, normalized))
            .collect(),
    );
    next.primitive.placements = Arc::new(
        primitive
            .primitive
            .placements
            .iter()
            .cloned()
            .map(|mut placement| {
                let point = rotate_point(
                    &Point {
                        x: placement.x,
                        y: placement.y,
                    },
                    &origin,
                    normalized,
                );
                placement.x = point.x;
                placement.y = point.y;
                placement.rotate = normalize_rotation(placement.rotate + normalized);
                placement
            })
            .collect(),
    );
    next.primitive.connection_points = Arc::new(
        primitive
            .primitive
            .connection_points
            .iter()
            .cloned()
            .map(|mut point| {
                let rotated = rotate_point(
                    &Point {
                        x: point.x,
                        y: point.y,
                    },
                    &origin,
                    normalized,
                );
                point.x = rotated.x;
                point.y = rotated.y;
                point
            })
            .collect(),
    );
    next.primitive.path_ports = Arc::new(
        primitive
            .primitive
            .path_ports
            .iter()
            .cloned()
            .map(|mut port| {
                let rotated = rotate_point(
                    &Point {
                        x: port.x,
                        y: port.y,
                    },
                    &origin,
                    normalized,
                );
                port.x = rotated.x;
                port.y = rotated.y;
                port.normal = signal_path::rotate_normal(&port.normal, normalized);
                port
            })
            .collect(),
    );
    rebuild_component_geometry(&mut next);
    next
}

fn rebuild_component_geometry(primitive: &mut WorkingPrimitive) {
    primitive.components = Arc::new(
        primitive
            .source_components
            .iter()
            .cloned()
            .map(|(index, mut component)| {
                let source = primitive
                    .source_placements
                    .iter()
                    .find(|placement| placement.designator == component.designator);
                let target = primitive
                    .primitive
                    .placements
                    .iter()
                    .find(|placement| placement.designator == component.designator);
                if let (Some(source), Some(target)) = (source, target) {
                    let delta_rotation = normalize_rotation(target.rotate - source.rotate);
                    let source_width = component.body_box.right - component.body_box.left;
                    let source_height = component.body_box.bottom - component.body_box.top;
                    let (width, height) = if delta_rotation == 90 || delta_rotation == 270 {
                        (source_height, source_width)
                    } else {
                        (source_width, source_height)
                    };
                    component.body_box = Box2 {
                        left: target.x - width / 2.0,
                        right: target.x + width / 2.0,
                        top: target.y - height / 2.0,
                        bottom: target.y + height / 2.0,
                    };
                    let source_origin = Point {
                        x: source.x,
                        y: source.y,
                    };
                    let dx = round_placement(target.x - source.x);
                    let dy = round_placement(target.y - source.y);
                    component.through_hole_boxes = Arc::new(
                        component
                            .through_hole_boxes
                            .iter()
                            .map(|box_| {
                                translate_box(
                                    &rotate_box(box_, &source_origin, delta_rotation),
                                    dx,
                                    dy,
                                )
                            })
                            .collect(),
                    );
                }
                (index, component)
            })
            .collect(),
    );
}

fn center_primitives(primitives: Vec<WorkingPrimitive>, grid: f64) -> Vec<WorkingPrimitive> {
    if primitives.is_empty() {
        return primitives;
    }
    let bbox = union_boxes(
        &primitives
            .iter()
            .map(|primitive| primitive.primitive.bbox)
            .collect::<Vec<_>>(),
    );
    let dx = round_placement(snap(-(bbox.left + bbox.right) / 2.0, grid));
    let dy = round_placement(snap(-(bbox.top + bbox.bottom) / 2.0, grid));
    primitives
        .iter()
        .map(|primitive| translate_primitive(primitive, dx, dy))
        .collect()
}

fn center_primitive(primitive: WorkingPrimitive, grid: f64) -> WorkingPrimitive {
    move_primitive_center(primitive, Point { x: 0.0, y: 0.0 }, grid)
}

fn move_primitive_center(
    primitive: WorkingPrimitive,
    center: Point,
    grid: f64,
) -> WorkingPrimitive {
    let current = box_center(&primitive.primitive.bbox);
    let dx = snap(center.x - current.x, grid);
    let dy = snap(center.y - current.y, grid);
    translate_primitive(&primitive, dx, dy)
}

fn move_primitive_center_exact(primitive: WorkingPrimitive, center: Point) -> WorkingPrimitive {
    let current = box_center(&primitive.primitive.bbox);
    translate_primitive(
        &primitive,
        round_placement(center.x - current.x),
        round_placement(center.y - current.y),
    )
}

fn move_box_center(
    primitive: WorkingPrimitive,
    box_: &Box2,
    center: Point,
    grid: f64,
) -> WorkingPrimitive {
    let current = box_center(box_);
    let dx = snap(center.x - current.x, grid);
    let dy = snap(center.y - current.y, grid);
    translate_primitive(&primitive, dx, dy)
}

fn move_box_center_exact(
    primitive: WorkingPrimitive,
    box_: &Box2,
    center: Point,
) -> WorkingPrimitive {
    let current = box_center(box_);
    translate_primitive(
        &primitive,
        round_placement(center.x - current.x),
        round_placement(center.y - current.y),
    )
}

fn fit_to_bounds(primitive: WorkingPrimitive, context: &Context) -> WorkingPrimitive {
    let Some(bounds) = context.problem.bounds else {
        return primitive;
    };
    let dx = if primitive.primitive.bbox.left < bounds.left {
        bounds.left - primitive.primitive.bbox.left
    } else if primitive.primitive.bbox.right > bounds.right {
        bounds.right - primitive.primitive.bbox.right
    } else {
        0.0
    };
    let dy = if primitive.primitive.bbox.top < bounds.top {
        bounds.top - primitive.primitive.bbox.top
    } else if primitive.primitive.bbox.bottom > bounds.bottom {
        bounds.bottom - primitive.primitive.bbox.bottom
    } else {
        0.0
    };
    translate_primitive(&primitive, round_placement(dx), round_placement(dy))
}

fn primitive_candidate_boxes(primitive: &WorkingPrimitive, context: &Context) -> Vec<Box2> {
    if context.problem.candidate_box_mode.as_ref() == "collision" {
        primitive_collision_boxes(primitive, context).to_vec()
    } else {
        vec![primitive.primitive.bbox]
    }
}

fn primitive_collision_boxes<'a>(primitive: &'a WorkingPrimitive, context: &Context) -> &'a [Box2] {
    let envelope = context.problem.collision_mode.as_ref() == "envelope"
        || context.problem.collision_mode.as_ref() == "hybrid";
    if envelope
        && (primitive.primitive.kind.as_ref() == "block"
            || primitive.primitive.kind.as_ref() == "module")
    {
        std::slice::from_ref(&primitive.primitive.bbox)
    } else if primitive.primitive.collision_boxes.is_empty() {
        std::slice::from_ref(&primitive.primitive.bbox)
    } else {
        primitive.primitive.collision_boxes.as_ref()
    }
}

fn dedupe_primitives(primitives: Vec<WorkingPrimitive>) -> Vec<WorkingPrimitive> {
    let mut seen = HashSet::new();
    primitives
        .into_iter()
        .filter(|primitive| seen.insert(primitive_pose_key(primitive)))
        .collect()
}

fn primitive_pose_key(primitive: &WorkingPrimitive) -> PrimitivePoseKey {
    PrimitivePoseKey {
        primitive_id: primitive.id,
        rotation: normalize_rotation(primitive.rotation),
        left: number_key(primitive.primitive.bbox.left),
        top: number_key(primitive.primitive.bbox.top),
        right: number_key(primitive.primitive.bbox.right),
        bottom: number_key(primitive.primitive.bbox.bottom),
    }
}

fn evaluate(primitives: &[WorkingPrimitive], context: &Context) -> Evaluation {
    let key: Vec<_> = primitives.iter().map(primitive_pose_key).collect();
    if let Some(evaluation) = context.evaluation_cache.borrow().get(&key).copied() {
        return evaluation;
    }
    let evaluation = Evaluation {
        hard_violations: hard_geometry_violation_count(primitives, context),
        score: score_block(primitives, context),
    };
    let mut cache = context.evaluation_cache.borrow_mut();
    if cache.len() < 10_000 {
        cache.insert(key, evaluation);
    }
    evaluation
}

fn incremental_evaluation(
    primitives: &[WorkingPrimitive],
    context: &Context,
) -> IncrementalEvaluation {
    let primitive_overlap_depths = primitive_overlap_matrix(primitives, context);
    let evaluation = Evaluation {
        hard_violations: hard_geometry_violation_count(primitives, context),
        score: score_block_with_overlap_matrix(
            primitives,
            context,
            Some(&primitive_overlap_depths),
        ),
    };
    validate_incremental_evaluation(primitives, evaluation, context);
    IncrementalEvaluation {
        evaluation,
        primitive_overlap_depths,
        size: primitives.len(),
    }
}

fn append_incremental_evaluation(
    placed: &[WorkingPrimitive],
    primitives: &[WorkingPrimitive],
    previous: &IncrementalEvaluation,
    context: &Context,
) -> IncrementalEvaluation {
    debug_assert_eq!(previous.size, placed.len());
    debug_assert_eq!(primitives.len(), placed.len() + 1);
    let candidate = primitives.last().expect("appended primitive");
    let primitive_overlap_depths = extend_primitive_overlap_matrix(
        &previous.primitive_overlap_depths,
        placed,
        candidate,
        context,
    );
    let evaluation = Evaluation {
        hard_violations: previous.evaluation.hard_violations
            + candidate_hard_violation_count(candidate, placed, context),
        score: score_block_with_overlap_matrix(
            primitives,
            context,
            Some(&primitive_overlap_depths),
        ),
    };
    validate_incremental_evaluation(primitives, evaluation, context);
    IncrementalEvaluation {
        evaluation,
        primitive_overlap_depths,
        size: primitives.len(),
    }
}

fn primitive_overlap_matrix(primitives: &[WorkingPrimitive], context: &Context) -> Vec<f64> {
    let size = primitives.len();
    let mut depths = vec![0.0; size * size];
    for i in 0..size {
        for j in (i + 1)..size {
            if !primitive_can_conflict(&primitives[i], &primitives[j], context) {
                continue;
            }
            let depth = primitive_overlap_depth(&primitives[i], &primitives[j], context);
            depths[i * size + j] = depth;
            depths[j * size + i] = depth;
        }
    }
    depths
}

fn extend_primitive_overlap_matrix(
    previous: &[f64],
    placed: &[WorkingPrimitive],
    candidate: &WorkingPrimitive,
    context: &Context,
) -> Vec<f64> {
    let old_size = placed.len();
    let size = old_size + 1;
    debug_assert_eq!(previous.len(), old_size * old_size);
    let mut depths = vec![0.0; size * size];
    for row in 0..old_size {
        depths[row * size..row * size + old_size]
            .copy_from_slice(&previous[row * old_size..(row + 1) * old_size]);
    }
    for (index, primitive) in placed.iter().enumerate() {
        if !primitive_can_conflict(primitive, candidate, context) {
            continue;
        }
        let depth = primitive_overlap_depth(primitive, candidate, context);
        depths[index * size + old_size] = depth;
        depths[old_size * size + index] = depth;
    }
    depths
}

fn validate_incremental_evaluation(
    primitives: &[WorkingPrimitive],
    actual: Evaluation,
    context: &Context,
) {
    if !context.validate_incremental_scoring {
        return;
    }
    let expected = evaluate(primitives, context);
    assert_eq!(
        actual.hard_violations, expected.hard_violations,
        "incremental hard violation count mismatch"
    );
    assert_eq!(
        actual.score.to_bits(),
        expected.score.to_bits(),
        "incremental block score mismatch"
    );
}

fn hard_geometry_violation_count(primitives: &[WorkingPrimitive], context: &Context) -> usize {
    let mut count = 0;
    for i in 0..primitives.len() {
        for j in (i + 1)..primitives.len() {
            if !primitive_can_conflict(&primitives[i], &primitives[j], context) {
                continue;
            }
            let overlap = if context.problem.hard_collision_mode.as_ref() == "primitive" {
                primitive_overlap_depth(&primitives[i], &primitives[j], context)
            } else {
                component_overlap_depth(&primitives[i], &primitives[j], context)
            };
            if overlap > 0.0 {
                count += 1;
            }
        }
    }
    for primitive in primitives {
        for obstacle in &context.problem.obstacles {
            let component_boxes;
            let boxes = if context.problem.hard_collision_mode.as_ref() == "primitive" {
                primitive_collision_boxes(primitive, context)
            } else {
                component_boxes = primitive_component_boxes(primitive);
                &component_boxes
            };
            if boxes
                .iter()
                .any(|box_| overlap_depth(box_, obstacle, context.problem.clearance) > 0.0)
            {
                count += 1;
            }
        }
        if let Some(bounds) = context.problem.bounds {
            if primitive_outside_bounds(primitive, &bounds) {
                count += 1;
            }
        }
    }
    count
}

fn candidate_hard_violation_count(
    candidate: &WorkingPrimitive,
    placed: &[WorkingPrimitive],
    context: &Context,
) -> usize {
    let mut count = 0;
    for other in placed {
        if !primitive_can_conflict(candidate, other, context) {
            continue;
        }
        let overlap = if context.problem.hard_collision_mode.as_ref() == "primitive" {
            primitive_overlap_depth(candidate, other, context)
        } else {
            component_overlap_depth(candidate, other, context)
        };
        if overlap > 0.0 {
            count += 1;
        }
    }
    for obstacle in &context.problem.obstacles {
        let component_boxes;
        let boxes = if context.problem.hard_collision_mode.as_ref() == "primitive" {
            primitive_collision_boxes(candidate, context)
        } else {
            component_boxes = primitive_component_boxes(candidate);
            &component_boxes
        };
        if boxes
            .iter()
            .any(|box_| overlap_depth(box_, obstacle, context.problem.clearance) > 0.0)
        {
            count += 1;
        }
    }
    if let Some(bounds) = context.problem.bounds {
        if primitive_outside_bounds(candidate, &bounds) {
            count += 1;
        }
    }
    count
}

fn primitive_can_conflict(a: &WorkingPrimitive, b: &WorkingPrimitive, context: &Context) -> bool {
    if a.components.is_empty() || b.components.is_empty() {
        return true;
    }
    let count = context.problem.components.len();
    a.components.iter().any(|(a_index, _)| {
        b.components
            .iter()
            .any(|(b_index, _)| context.problem.component_conflict[a_index * count + b_index] != 0)
    })
}

fn component_overlap_depth(a: &WorkingPrimitive, b: &WorkingPrimitive, context: &Context) -> f64 {
    let count = context.problem.components.len();
    let mut max_overlap: f64 = 0.0;
    for (a_index, a_component) in a.components.iter() {
        for (b_index, b_component) in b.components.iter() {
            if context.problem.component_conflict[a_index * count + b_index] == 0 {
                continue;
            }
            let clearance = context.problem.component_pair_clearance[a_index * count + b_index];
            if a_component.layer == b_component.layer {
                max_overlap = max_overlap.max(overlap_depth(
                    &a_component.body_box,
                    &b_component.body_box,
                    clearance,
                ));
            } else {
                for box_ in b_component.through_hole_boxes.iter() {
                    max_overlap =
                        max_overlap.max(overlap_depth(&a_component.body_box, box_, clearance));
                }
                for box_ in a_component.through_hole_boxes.iter() {
                    max_overlap =
                        max_overlap.max(overlap_depth(box_, &b_component.body_box, clearance));
                }
            }
        }
    }
    max_overlap
}

fn primitive_overlap_depth(a: &WorkingPrimitive, b: &WorkingPrimitive, context: &Context) -> f64 {
    let mut max_overlap: f64 = 0.0;
    for a_box in primitive_collision_boxes(a, context) {
        for b_box in primitive_collision_boxes(b, context) {
            max_overlap = max_overlap.max(overlap_depth(&a_box, &b_box, context.problem.clearance));
        }
    }
    max_overlap
}

fn primitive_component_boxes(primitive: &WorkingPrimitive) -> Vec<Box2> {
    let boxes: Vec<_> = primitive
        .components
        .iter()
        .flat_map(|(_, component)| {
            let mut boxes = vec![component.body_box];
            boxes.extend(component.through_hole_boxes.iter().copied());
            boxes
        })
        .collect();
    if boxes.is_empty() {
        primitive.primitive.collision_boxes.as_ref().clone()
    } else {
        boxes
    }
}

fn primitive_outside_bounds(primitive: &WorkingPrimitive, bounds: &Box2) -> bool {
    primitive.primitive.bbox.left < bounds.left
        || primitive.primitive.bbox.right > bounds.right
        || primitive.primitive.bbox.top < bounds.top
        || primitive.primitive.bbox.bottom > bounds.bottom
}

fn score_block(primitives: &[WorkingPrimitive], context: &Context) -> f64 {
    score_block_with_overlap_matrix(primitives, context, None)
}

fn score_block_with_overlap_matrix(
    primitives: &[WorkingPrimitive],
    context: &Context,
    primitive_overlap_depths: Option<&[f64]>,
) -> f64 {
    if primitives.is_empty() {
        return 0.0;
    }
    let bbox = union_boxes(
        &primitives
            .iter()
            .map(|primitive| primitive.primitive.bbox)
            .collect::<Vec<_>>(),
    );
    let width = bbox.right - bbox.left;
    let height = bbox.bottom - bbox.top;
    let high = context.problem.compactness.as_ref() == "high";
    let (
        bbox_area,
        bbox_perimeter,
        hull_area,
        hull_perimeter,
        aspect_weight,
        relation_weight_,
        net_weight,
        target_weight,
    ) = if high {
        (4.2, 5.4, 14.4, 12.0, 1.4, 0.45, 0.65, 1.2)
    } else {
        (1.5, 2.25, 0.5, 0.75, 1.0, 1.0, 1.0, 1.0)
    };
    let boxes: Vec<_> = primitives
        .iter()
        .flat_map(|primitive| {
            primitive_collision_boxes(primitive, context)
                .iter()
                .copied()
        })
        .collect();
    let (hull_a, hull_p) = convex_hull_metrics(if boxes.is_empty() { vec![bbox] } else { boxes });
    let mut score = width * height * bbox_area
        + (width + height) * bbox_perimeter
        + hull_a * hull_area
        + hull_p * hull_perimeter;
    score += aspect_ratio_penalty(width, height) * aspect_weight;
    score += overlap_penalty(primitives, context, primitive_overlap_depths);
    score += bounds_penalty(primitives, context.problem.bounds.as_ref());
    score += dense_ic_access_penalty(primitives, context) * if high { 0.45 } else { 1.0 };
    score += power_yield_penalty(primitives, context) * if high { 0.3 } else { 1.0 };
    score += scoped_relation_penalty(primitives, context) * relation_weight_;
    score += external_port_exposure_penalty(primitives, context) * if high { 0.35 } else { 1.0 };
    score += port_facing_penalty(primitives, context) * if high { 0.55 } else { 1.0 };
    let component_count: usize = primitives
        .iter()
        .map(|primitive| primitive.primitive.placements.len())
        .sum();
    let small = component_count > 0 && component_count < 5;
    let (signal_spread, ground_spread) = same_net_spread_penalties(
        primitives,
        context,
        if small { None } else { Some(3) },
        if small { None } else { Some(4.0) },
    );
    score += signal_spread * if small { 18.0 } else { 4.0 } * net_weight;
    score += ground_spread * if small { 2.5 } else { 0.15 } * net_weight;
    score += target_size_penalty(width, height, context) * target_weight;
    let path_primitives: Vec<_> = primitives.iter().map(|item| &item.primitive).collect();
    score += signal_path::topology_penalty(&path_primitives, &context.problem.relations)
        * if high { 2.5 } else { 4.0 };
    score
}

fn overlap_penalty(
    primitives: &[WorkingPrimitive],
    context: &Context,
    primitive_overlap_depths: Option<&[f64]>,
) -> f64 {
    let envelope = context.problem.collision_mode.as_ref() == "envelope"
        || context.problem.collision_mode.as_ref() == "hybrid";
    let mut penalty = 0.0;
    for i in 0..primitives.len() {
        for j in (i + 1)..primitives.len() {
            if !primitive_can_conflict(&primitives[i], &primitives[j], context) {
                continue;
            }
            let overlap = primitive_overlap_depths
                .map(|depths| depths[i * primitives.len() + j])
                .unwrap_or_else(|| {
                    primitive_overlap_depth(&primitives[i], &primitives[j], context)
                });
            if overlap > 0.0 {
                penalty += if envelope {
                    250_000.0 + overlap * 25_000.0
                } else {
                    10_000_000.0 + overlap * 100_000.0
                };
            }
        }
    }
    for primitive in primitives {
        for obstacle in &context.problem.obstacles {
            for box_ in primitive_collision_boxes(primitive, context) {
                let overlap = overlap_depth(&box_, obstacle, context.problem.clearance);
                if overlap > 0.0 {
                    penalty += 10_000_000.0 + overlap * 100_000.0;
                }
            }
        }
    }
    penalty
}

fn bounds_penalty(primitives: &[WorkingPrimitive], bounds: Option<&Box2>) -> f64 {
    let Some(bounds) = bounds else {
        return 0.0;
    };
    primitives
        .iter()
        .map(|primitive| {
            let box_ = primitive.primitive.bbox;
            let overflow = (bounds.left - box_.left).max(0.0)
                + (box_.right - bounds.right).max(0.0)
                + (bounds.top - box_.top).max(0.0)
                + (box_.bottom - bounds.bottom).max(0.0);
            if overflow > 0.0 {
                10_000_000.0 + overflow * 500_000.0
            } else {
                0.0
            }
        })
        .sum()
}

fn aspect_ratio_penalty(width: f64, height: f64) -> f64 {
    if width <= 0.0 || height <= 0.0 {
        return 0.0;
    }
    let ratio = (width / height).max(height / width);
    let excess = (ratio - 5.0).max(0.0);
    if excess <= 0.0 {
        0.0
    } else {
        excess * excess * width.min(height).max(1.0) * 220.0
    }
}

fn target_size_penalty(width: f64, height: f64, context: &Context) -> f64 {
    let excess = |value: f64| {
        let value = value.max(0.0);
        value * value * 20_000.0 + value * 2_000.0
    };
    context
        .problem
        .target_width
        .map(|target| excess(width - target))
        .unwrap_or(0.0)
        + context
            .problem
            .target_height
            .map(|target| excess(height - target))
            .unwrap_or(0.0)
}

fn convex_hull_metrics(boxes: Vec<Box2>) -> (f64, f64) {
    let mut points: Vec<Point> = boxes
        .iter()
        .flat_map(|box_| {
            [
                Point {
                    x: box_.left,
                    y: box_.top,
                },
                Point {
                    x: box_.right,
                    y: box_.top,
                },
                Point {
                    x: box_.right,
                    y: box_.bottom,
                },
                Point {
                    x: box_.left,
                    y: box_.bottom,
                },
            ]
        })
        .map(|point| Point {
            x: round_placement(point.x),
            y: round_placement(point.y),
        })
        .collect();
    points.sort_by(|a, b| compare_f64(a.x, b.x).then_with(|| compare_f64(a.y, b.y)));
    points.dedup_by(|a, b| a.x == b.x && a.y == b.y);
    if points.len() < 3 {
        let bbox = union_boxes(&boxes);
        let width = (bbox.right - bbox.left).max(0.0);
        let height = (bbox.bottom - bbox.top).max(0.0);
        return (width * height, width + height);
    }
    let cross =
        |a: Point, b: Point, c: Point| (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    let mut lower = Vec::new();
    for point in points.iter() {
        while lower.len() >= 2
            && cross(lower[lower.len() - 2], lower[lower.len() - 1], *point) <= 0.0
        {
            lower.pop();
        }
        lower.push(*point);
    }
    let mut upper = Vec::new();
    for point in points.iter().rev() {
        while upper.len() >= 2
            && cross(upper[upper.len() - 2], upper[upper.len() - 1], *point) <= 0.0
        {
            upper.pop();
        }
        upper.push(*point);
    }
    lower.pop();
    upper.pop();
    lower.extend(upper);
    let mut area = 0.0;
    let mut perimeter = 0.0;
    for index in 0..lower.len() {
        let next = lower[(index + 1) % lower.len()];
        area += lower[index].x * next.y - next.x * lower[index].y;
        perimeter += (lower[index].x - next.x).hypot(lower[index].y - next.y);
    }
    (area.abs() / 2.0, perimeter)
}

fn relation_anchored_candidates(
    primitive: &WorkingPrimitive,
    placed: &[WorkingPrimitive],
    context: &Context,
) -> Vec<WorkingPrimitive> {
    let mut candidates = Vec::new();
    for compiled in &context.relations {
        let relation = &compiled.relation;
        if relation.effect.as_ref() == "lock"
            || relation.kind.as_ref() == "net"
            || relation.effect.as_ref() == "score_only"
        {
            continue;
        }
        let moving_from = endpoint_point(std::slice::from_ref(primitive), &compiled.from);
        let placed_to = endpoint_point(placed, &compiled.to)
            .map(|point| relation_target_point(point, relation));
        if let (Some(moving), Some(target)) = (moving_from, placed_to) {
            let anchor = placed
                .iter()
                .find(|item| Some(item.id) == target.primitive_id)
                .map(|item| item.primitive.bbox)
                .unwrap_or(point_box(target.point));
            candidates.extend(endpoint_anchored_candidates(
                primitive,
                moving.point,
                &anchor,
                target.point,
                relation,
                context,
            ));
        }
        let moving_to = endpoint_point(std::slice::from_ref(primitive), &compiled.to);
        let placed_from = endpoint_point(placed, &compiled.from)
            .map(|point| relation_target_point(point, relation));
        if let (Some(moving), Some(target)) = (moving_to, placed_from) {
            let anchor = placed
                .iter()
                .find(|item| Some(item.id) == target.primitive_id)
                .map(|item| item.primitive.bbox)
                .unwrap_or(point_box(target.point));
            candidates.extend(endpoint_anchored_candidates(
                primitive,
                moving.point,
                &anchor,
                target.point,
                relation,
                context,
            ));
        }
    }
    candidates
}

fn endpoint_anchored_candidates(
    primitive: &WorkingPrimitive,
    moving: Point,
    anchor: &Box2,
    target: Point,
    relation: &Relation,
    context: &Context,
) -> Vec<WorkingPrimitive> {
    let center = box_center(&primitive.primitive.bbox);
    let offset = Point {
        x: moving.x - center.x,
        y: moving.y - center.y,
    };
    let near_distance = context
        .problem
        .clearance
        .max(relation.min_distance.unwrap_or(0.0));
    let size = primitive.primitive.width.max(primitive.primitive.height);
    let slide_step = context
        .problem
        .grid
        .max((size * 0.25).min(relation.max_distance.unwrap_or(size)));
    let slides = dedupe_numbers(vec![
        0.0,
        -slide_step,
        slide_step,
        -slide_step * 2.0,
        slide_step * 2.0,
    ]);
    let c = context.problem.clearance;
    let mut centers = vec![
        Point {
            x: target.x - offset.x - c,
            y: target.y - offset.y,
        },
        Point {
            x: target.x - offset.x + c,
            y: target.y - offset.y,
        },
        Point {
            x: target.x - offset.x,
            y: target.y - offset.y - c,
        },
        Point {
            x: target.x - offset.x,
            y: target.y - offset.y + c,
        },
        Point {
            x: anchor.left - c - primitive.primitive.width / 2.0,
            y: target.y - offset.y,
        },
        Point {
            x: anchor.right + c + primitive.primitive.width / 2.0,
            y: target.y - offset.y,
        },
        Point {
            x: target.x - offset.x,
            y: anchor.top - c - primitive.primitive.height / 2.0,
        },
        Point {
            x: target.x - offset.x,
            y: anchor.bottom + c + primitive.primitive.height / 2.0,
        },
    ];
    for slide in slides {
        centers.extend([
            Point {
                x: anchor.left - c - primitive.primitive.width / 2.0,
                y: target.y - offset.y + slide,
            },
            Point {
                x: anchor.right + c + primitive.primitive.width / 2.0,
                y: target.y - offset.y + slide,
            },
            Point {
                x: target.x - offset.x + slide,
                y: anchor.top - c - primitive.primitive.height / 2.0,
            },
            Point {
                x: target.x - offset.x + slide,
                y: anchor.bottom + c + primitive.primitive.height / 2.0,
            },
        ]);
    }
    if let Some(max_distance) = relation.max_distance {
        if max_distance > near_distance {
            let distances = dedupe_numbers(
                vec![
                    near_distance,
                    max_distance * 0.35,
                    max_distance * 0.6,
                    max_distance * 0.9,
                ]
                .into_iter()
                .filter(|value| *value <= max_distance)
                .collect(),
            );
            let directions = [
                Point { x: 1.0, y: 0.0 },
                Point { x: -1.0, y: 0.0 },
                Point { x: 0.0, y: 1.0 },
                Point { x: 0.0, y: -1.0 },
                Point { x: 1.0, y: 1.0 },
                Point { x: 1.0, y: -1.0 },
                Point { x: -1.0, y: 1.0 },
                Point { x: -1.0, y: -1.0 },
            ]
            .map(normalize);
            for distance in distances {
                for direction in directions {
                    centers.push(Point {
                        x: target.x + direction.x * distance - offset.x,
                        y: target.y + direction.y * distance - offset.y,
                    });
                }
            }
        }
    }
    centers
        .into_iter()
        .flat_map(|center| {
            [
                fit_to_bounds(
                    move_primitive_center_exact(primitive.clone(), center),
                    context,
                ),
                fit_to_bounds(
                    move_primitive_center(primitive.clone(), center, context.problem.grid),
                    context,
                ),
            ]
        })
        .collect()
}

fn scoped_relation_penalty(primitives: &[WorkingPrimitive], context: &Context) -> f64 {
    let mut penalty = 0.0;
    for compiled in &context.relations {
        let relation = &compiled.relation;
        if relation.effect.as_ref() == "lock" || relation.kind.as_ref() == "net" {
            continue;
        }
        let Some(from) = endpoint_point(primitives, &compiled.from) else {
            continue;
        };
        let Some(to) = endpoint_point(primitives, &compiled.to)
            .map(|point| relation_target_point(point, relation))
        else {
            continue;
        };
        if from.primitive_id == to.primitive_id {
            continue;
        }
        let weight = relation_weight(relation);
        let value = distance(from.point, to.point);
        penalty += value * weight
            + relation_distance_limit_penalty(relation, value, weight)
            + relation_side_penalty(relation, from.point, to.point, weight);
    }
    penalty
}

fn external_port_exposure_penalty(primitives: &[WorkingPrimitive], context: &Context) -> f64 {
    let bbox = union_boxes(
        &primitives
            .iter()
            .map(|primitive| primitive.primitive.bbox)
            .collect::<Vec<_>>(),
    );
    let count: usize = primitives
        .iter()
        .map(|primitive| primitive.primitive.placements.len())
        .sum();
    let weight = if count > 0 && count < 5 { 1.25 } else { 5.0 };
    let mut penalty = 0.0;
    for compiled in &context.relations {
        let relation = &compiled.relation;
        if relation.effect.as_ref() == "lock"
            || relation.kind.as_ref() == "net"
            || relation.effect.as_ref() == "score_only"
        {
            continue;
        }
        let from = endpoint_point(primitives, &compiled.from);
        let to = endpoint_point(primitives, &compiled.to);
        if from.is_some() && to.is_some() {
            continue;
        }
        let Some(inside) = from.or(to) else {
            continue;
        };
        let boundary = (inside.point.x - bbox.left)
            .abs()
            .min((bbox.right - inside.point.x).abs())
            .min((inside.point.y - bbox.top).abs())
            .min((bbox.bottom - inside.point.y).abs());
        penalty += boundary * relation_weight(relation) * weight;
    }
    penalty
}

fn port_facing_penalty(primitives: &[WorkingPrimitive], context: &Context) -> f64 {
    let mut penalty = 0.0;
    for compiled in &context.relations {
        let relation = &compiled.relation;
        if relation.effect.as_ref() == "lock"
            || relation.kind.as_ref() == "net"
            || relation.effect.as_ref() == "score_only"
        {
            continue;
        }
        let (Some(from), Some(to)) = (
            endpoint_point(primitives, &compiled.from),
            endpoint_point(primitives, &compiled.to),
        ) else {
            continue;
        };
        if from.primitive_id == to.primitive_id {
            continue;
        }
        let facing = relation.kind.as_ref() == "critical_pair"
            || relation.kind.as_ref() == "island_target"
            || relation.relation.as_deref() == Some("very_near")
            || relation.relation.as_deref() == Some("cap_cluster");
        if facing {
            penalty += endpoint_facing_penalty(primitives, from, to.point)
                * relation_weight(relation)
                * 2.5;
            penalty += endpoint_facing_penalty(primitives, to, from.point)
                * relation_weight(relation)
                * 1.2;
        }
    }
    penalty
}

fn endpoint_facing_penalty(
    primitives: &[WorkingPrimitive],
    source: EndpointPoint,
    target: Point,
) -> f64 {
    let Some(id) = source.primitive_id else {
        return 0.0;
    };
    let Some(primitive) = primitives.iter().find(|primitive| primitive.id == id) else {
        return 0.0;
    };
    let center = box_center(&primitive.primitive.bbox);
    if distance(source.point, center) < 0.05 {
        return 0.0;
    }
    let port = normalize(Point {
        x: source.point.x - center.x,
        y: source.point.y - center.y,
    });
    let link = normalize(Point {
        x: target.x - center.x,
        y: target.y - center.y,
    });
    (1.0 - dot(port, link)).max(0.0)
}

fn endpoint_point(
    primitives: &[WorkingPrimitive],
    endpoint: &CompiledEndpoint,
) -> Option<EndpointPoint> {
    match endpoint {
        CompiledEndpoint::Anchor(point) => point.map(|point| EndpointPoint {
            point,
            primitive_id: None,
        }),
        CompiledEndpoint::Pad {
            primitive_id,
            point_index,
        } => {
            let primitive = primitives
                .iter()
                .find(|primitive| primitive.id == *primitive_id)?;
            let point = primitive.primitive.connection_points.get(*point_index)?;
            Some(EndpointPoint {
                point: Point {
                    x: point.x,
                    y: point.y,
                },
                primitive_id: Some(*primitive_id),
            })
        }
        CompiledEndpoint::Component {
            primitive_id,
            point_indices,
        } => {
            let primitive = primitives
                .iter()
                .find(|primitive| primitive.id == *primitive_id)?;
            let point = if point_indices.is_empty() {
                box_center(&primitive.primitive.bbox)
            } else {
                let mut x = 0.0;
                let mut y = 0.0;
                for index in point_indices.iter() {
                    let point = primitive.primitive.connection_points.get(*index)?;
                    x += point.x;
                    y += point.y;
                }
                Point {
                    x: x / point_indices.len() as f64,
                    y: y / point_indices.len() as f64,
                }
            };
            Some(EndpointPoint {
                point,
                primitive_id: Some(*primitive_id),
            })
        }
        CompiledEndpoint::Primitive { primitive_id } => {
            let primitive = primitives
                .iter()
                .find(|primitive| primitive.id == *primitive_id)?;
            Some(EndpointPoint {
                point: box_center(&primitive.primitive.bbox),
                primitive_id: Some(*primitive_id),
            })
        }
        CompiledEndpoint::Missing => None,
    }
}

fn compile_relations(
    relations: &[Relation],
    primitives: &[WorkingPrimitive],
    bounds: Option<&Box2>,
) -> Vec<CompiledRelation> {
    relations
        .iter()
        .cloned()
        .map(|relation| CompiledRelation {
            from: compile_endpoint(&relation.from, primitives, bounds),
            to: compile_endpoint(&relation.to, primitives, bounds),
            relation,
        })
        .collect()
}

fn compile_endpoint(
    endpoint: &str,
    primitives: &[WorkingPrimitive],
    bounds: Option<&Box2>,
) -> CompiledEndpoint {
    if let Some(anchor) = endpoint.strip_prefix("anchor:") {
        return CompiledEndpoint::Anchor(anchor_point(anchor, bounds));
    }
    if let Some(reference) = endpoint.strip_prefix("pad:") {
        for primitive in primitives {
            if let Some(point_index) = primitive
                .primitive
                .connection_points
                .iter()
                .position(|point| point.reference.as_ref() == reference)
            {
                return CompiledEndpoint::Pad {
                    primitive_id: primitive.id,
                    point_index,
                };
            }
        }
        return CompiledEndpoint::Missing;
    }
    if let Some(designator) = endpoint.strip_prefix("component:") {
        for primitive in primitives {
            if !primitive
                .primitive
                .placements
                .iter()
                .any(|placement| placement.designator.as_ref() == designator)
            {
                continue;
            }
            let prefix = format!("{designator}.");
            let point_indices = primitive
                .primitive
                .connection_points
                .iter()
                .enumerate()
                .filter_map(|(index, point)| point.reference.starts_with(&prefix).then_some(index))
                .collect();
            return CompiledEndpoint::Component {
                primitive_id: primitive.id,
                point_indices: Arc::new(point_indices),
            };
        }
        return CompiledEndpoint::Missing;
    }
    for (prefix, tree_prefix) in [("block:", "tree:block:"), ("module:", "tree:module:")] {
        if let Some(name) = endpoint.strip_prefix(prefix) {
            let target = format!("{tree_prefix}{name}");
            return primitives
                .iter()
                .find(|primitive| {
                    primitive
                        .source_node_ids
                        .iter()
                        .any(|id| id.as_ref() == target)
                })
                .map(|primitive| CompiledEndpoint::Primitive {
                    primitive_id: primitive.id,
                })
                .unwrap_or(CompiledEndpoint::Missing);
        }
    }
    CompiledEndpoint::Missing
}

fn relation_target_point(mut point: EndpointPoint, relation: &Relation) -> EndpointPoint {
    if relation.satellite_anchor {
        if let Some(offset) = relation.anchor_offset {
            point.point.x = round_placement(point.point.x + offset.x);
            point.point.y = round_placement(point.point.y + offset.y);
        }
    }
    point
}

fn relation_weight(relation: &Relation) -> f64 {
    let priority = match relation.priority.as_deref() {
        Some("critical") => 30.0,
        Some("high") => 16.0,
        Some("low") => 3.0,
        _ => 8.0,
    };
    let kind = if relation.kind.as_ref() == "critical_pair" {
        2.2
    } else if relation.relation.as_deref() == Some("very_near") {
        1.7
    } else if relation.relation.as_deref() == Some("near") {
        1.1
    } else {
        1.0
    };
    let effect = if relation.effect.as_ref() == "move_both" {
        1.2
    } else if relation.effect.as_ref() == "move_from" {
        1.0
    } else {
        0.4
    };
    let configured = relation
        .weight
        .map(|weight| (weight / 70.0).max(0.25))
        .unwrap_or(1.0);
    priority * kind * effect * configured
}

fn relation_distance_limit_penalty(relation: &Relation, value: f64, weight: f64) -> f64 {
    let multiplier = if relation.hard { 5.0 } else { 1.0 };
    let mut penalty = 0.0;
    if let Some(maximum) = relation.max_distance {
        let excess = (value - maximum).max(0.0);
        penalty += (excess * excess * 1_500.0 + excess * 120.0) * weight * multiplier;
    }
    if let Some(minimum) = relation.min_distance {
        let shortage = (minimum - value).max(0.0);
        penalty += (shortage * shortage * 800.0 + shortage * 80.0) * weight * multiplier;
    }
    penalty.min(250_000.0)
}

fn relation_side_penalty(relation: &Relation, from: Point, to: Point, weight: f64) -> f64 {
    if !relation.satellite_anchor {
        return 0.0;
    }
    let desired = match relation.side_preference.as_deref() {
        Some("left") => Point { x: -1.0, y: 0.0 },
        Some("right") => Point { x: 1.0, y: 0.0 },
        Some("top") => Point { x: 0.0, y: -1.0 },
        Some("bottom") => Point { x: 0.0, y: 1.0 },
        _ => return 0.0,
    };
    let actual = normalize(Point {
        x: from.x - to.x,
        y: from.y - to.y,
    });
    (1.0 - dot(actual, desired)).max(0.0) * weight * 120.0
}

fn same_net_spread_penalties(
    primitives: &[WorkingPrimitive],
    context: &Context,
    ground_max_points: Option<usize>,
    ground_max_spread: Option<f64>,
) -> (f64, f64) {
    let mut scratch = context.net_scoring_scratch.borrow_mut();
    let NetScoringScratch {
        accumulators,
        signal_order,
        ground_order,
    } = &mut *scratch;
    accumulators.fill(NetAccumulator::default());
    signal_order.clear();
    ground_order.clear();
    for primitive in primitives {
        for (point_index, point) in primitive.primitive.connection_points.iter().enumerate() {
            let Some(net_id) = primitive.point_net_ids[point_index] else {
                continue;
            };
            let net_index = net_id as usize;
            let ground = context.net_ground[net_index];
            let accumulator = &mut accumulators[net_index];
            if !accumulator.seen {
                accumulator.seen = true;
                if ground {
                    ground_order.push(net_index);
                } else {
                    signal_order.push(net_index);
                }
            }
            accumulator.point_count += 1;
            if accumulator.last_primitive != primitive.id {
                accumulator.last_primitive = primitive.id;
                accumulator.primitive_count += 1;
            }
            accumulator.min_x = accumulator.min_x.min(point.x);
            accumulator.max_x = accumulator.max_x.max(point.x);
            accumulator.min_y = accumulator.min_y.min(point.y);
            accumulator.max_y = accumulator.max_y.max(point.y);
        }
    }
    let signal_penalty = spread_penalty(accumulators, signal_order, None, None);
    let ground_penalty = spread_penalty(
        accumulators,
        ground_order,
        ground_max_points,
        ground_max_spread,
    );
    (signal_penalty, ground_penalty)
}

fn spread_penalty(
    accumulators: &[NetAccumulator],
    order: &[usize],
    max_points: Option<usize>,
    max_spread: Option<f64>,
) -> f64 {
    let mut penalty = 0.0;
    for &net_index in order {
        let accumulator = accumulators[net_index];
        if accumulator.primitive_count < 2 {
            continue;
        }
        let spread = accumulator.max_x - accumulator.min_x + accumulator.max_y - accumulator.min_y;
        if max_points.is_some_and(|limit| accumulator.point_count > limit)
            || max_spread.is_some_and(|limit| spread > limit)
        {
            continue;
        }
        penalty += spread;
    }
    penalty
}

fn dense_ic_access_penalty(primitives: &[WorkingPrimitive], context: &Context) -> f64 {
    if context.problem.search_width > 1 {
        return 0.0;
    }
    let placement_count: usize = primitives
        .iter()
        .map(|primitive| primitive.primitive.placements.len())
        .sum();
    if placement_count > 20 {
        return 0.0;
    }
    let components: Vec<_> = primitives
        .iter()
        .flat_map(|primitive| primitive.components.iter().map(|(_, component)| component))
        .collect();
    if components.len() < 2 {
        return 0.0;
    }
    let mut penalty = 0.0;
    for source in &components {
        if source.role.as_deref() == Some("connector") || source.pin_count < 8 {
            continue;
        }
        let halo = 1.5f64.min(0.25f64.max((source.pin_count as f64 - 8.0) * 0.025));
        let halo_box = Box2 {
            left: source.body_box.left - halo,
            right: source.body_box.right + halo,
            top: source.body_box.top - halo,
            bottom: source.body_box.bottom + halo,
        };
        let source_weight = (if source.role.as_deref() == Some("main_ic") {
            1.45
        } else {
            1.0
        }) * if source.pin_count >= 64 {
            1.35
        } else if source.pin_count >= 32 {
            1.2
        } else {
            1.0
        };
        for neighbor in &components {
            if source.designator == neighbor.designator || source.layer != neighbor.layer {
                continue;
            }
            let depth = overlap_depth(&halo_box, &neighbor.body_box, 0.0);
            if depth <= 0.0 {
                continue;
            }
            let neighbor_weight = if neighbor.role.as_deref() == Some("decoupling_cap") {
                0.55
            } else if neighbor.power_component {
                1.15
            } else if neighbor.role.as_deref() == Some("passive") {
                0.7
            } else {
                1.0
            };
            penalty += (depth * depth * 1_500.0 + depth * 600.0) * source_weight * neighbor_weight;
        }
    }
    penalty
}

fn power_yield_penalty(primitives: &[WorkingPrimitive], context: &Context) -> f64 {
    if primitives.len() < 3 || primitives.len() > 36 {
        return 0.0;
    }
    let connection_count: usize = primitives
        .iter()
        .map(|primitive| primitive.primitive.connection_points.len())
        .sum();
    if connection_count > 240 {
        return 0.0;
    }
    let affinity = |primitive: &WorkingPrimitive| {
        if primitive.components.is_empty() {
            0.0
        } else {
            primitive
                .components
                .iter()
                .filter(|(_, component)| component.power_component)
                .count() as f64
                / primitive.components.len() as f64
        }
    };
    let power: Vec<_> = primitives
        .iter()
        .filter(|primitive| affinity(primitive) >= 0.55 && !primitive.primitive.locked)
        .collect();
    if power.is_empty() {
        return 0.0;
    }
    let mut by_net: HashMap<Arc<str>, Vec<(u32, Point)>> = HashMap::new();
    for primitive in primitives {
        if affinity(primitive) >= 0.75 {
            continue;
        }
        for point in primitive.primitive.connection_points.iter() {
            let Some(net) = &point.net else {
                continue;
            };
            if is_ground(net) || is_power(net) || is_switching_power(net) {
                continue;
            }
            by_net.entry(net.clone()).or_default().push((
                primitive.id,
                Point {
                    x: point.x,
                    y: point.y,
                },
            ));
        }
    }
    let corridor = 1.2f64.max(context.problem.clearance * 1.75);
    let mut penalty = 0.0;
    for (net, points) in by_net {
        let limited = &points[..points.len().min(8)];
        for i in 0..limited.len() {
            for j in (i + 1)..limited.len() {
                if limited[i].0 == limited[j].0 {
                    continue;
                }
                let direct = distance(limited[i].1, limited[j].1);
                if !(0.5..=45.0).contains(&direct) {
                    continue;
                }
                for primitive in &power {
                    if primitive.id == limited[i].0 || primitive.id == limited[j].0 {
                        continue;
                    }
                    let distance_to_box =
                        segment_box_distance(limited[i].1, limited[j].1, &primitive.primitive.bbox);
                    if distance_to_box >= corridor {
                        continue;
                    }
                    let depth = corridor - distance_to_box;
                    penalty += (depth * depth * 220.0 + depth * 80.0)
                        * affinity(primitive)
                        * signal_net_weight(&net);
                }
            }
        }
    }
    penalty
}

fn board_fallback_candidates(
    variants: &[WorkingPrimitive],
    placed: &[WorkingPrimitive],
    primary: &[WorkingPrimitive],
    context: &Context,
) -> Vec<WorkingPrimitive> {
    let Some(bounds) = context.problem.bounds else {
        return Vec::new();
    };
    let preferred: Vec<_> = primary
        .iter()
        .map(|candidate| box_center(&candidate.primitive.bbox))
        .collect();
    let mut candidates = Vec::new();
    let max_per_variant = (256 / variants.len().max(1)).max(32);
    let step = context.problem.grid.max(0.25);
    for variant in variants {
        let min_x = snap_up(bounds.left + variant.primitive.width / 2.0, step);
        let max_x = snap_down(bounds.right - variant.primitive.width / 2.0, step);
        let min_y = snap_up(bounds.top + variant.primitive.height / 2.0, step);
        let max_y = snap_down(bounds.bottom - variant.primitive.height / 2.0, step);
        if min_x > max_x || min_y > max_y {
            continue;
        }
        let mut centers = Vec::new();
        let mut y = min_y;
        while y <= max_y + 0.0001 {
            let mut x = min_x;
            while x <= max_x + 0.0001 {
                centers.push(Point {
                    x: round_placement(x),
                    y: round_placement(y),
                });
                x += step;
            }
            y += step;
        }
        centers.sort_by(|a, b| {
            compare_f64(
                preferred_distance_squared(*a, &preferred),
                preferred_distance_squared(*b, &preferred),
            )
        });
        let mut accepted = 0;
        for center in centers {
            let candidate = move_primitive_center(variant.clone(), center, context.problem.grid);
            if candidate_hard_violation_count(&candidate, placed, context) > 0 {
                continue;
            }
            candidates.push(candidate);
            accepted += 1;
            if accepted >= max_per_variant || candidates.len() >= 256 {
                break;
            }
        }
    }
    candidates
}

fn seed_rank(primitive: &WorkingPrimitive, context: &Context) -> f64 {
    let degree = context
        .problem
        .relations
        .iter()
        .filter(|relation| {
            primitive_touches_endpoint(primitive, &relation.from)
                || primitive_touches_endpoint(primitive, &relation.to)
        })
        .count();
    primitive.primitive.width * primitive.primitive.height
        + degree as f64 * 10.0
        + if primitive.primitive.label.as_ref() == "core"
            || primitive.primitive.label.contains("main")
        {
            20.0
        } else {
            0.0
        }
}

fn primitive_touches_endpoint(primitive: &WorkingPrimitive, endpoint: &str) -> bool {
    if let Some(reference) = endpoint.strip_prefix("pad:") {
        return primitive
            .primitive
            .connection_points
            .iter()
            .any(|point| point.reference.as_ref() == reference);
    }
    if let Some(designator) = endpoint.strip_prefix("component:") {
        return primitive
            .primitive
            .placements
            .iter()
            .any(|placement| placement.designator.as_ref() == designator);
    }
    false
}

fn dedupe_states(states: Vec<SearchState>) -> Vec<SearchState> {
    let mut seen = HashSet::new();
    states
        .into_iter()
        .filter(|state| {
            let mut remaining: Vec<_> = state
                .remaining
                .iter()
                .map(|primitive| primitive.id)
                .collect();
            remaining.sort();
            let mut placed: Vec<_> = state.placed.iter().map(primitive_pose_key).collect();
            placed.sort();
            seen.insert(SearchStateKey { remaining, placed })
        })
        .collect()
}

fn number_key(value: f64) -> u64 {
    if value == 0.0 {
        0
    } else {
        value.to_bits()
    }
}

fn compare_candidates(a: &RankedCandidate, b: &RankedCandidate) -> Ordering {
    a.hard_violations
        .cmp(&b.hard_violations)
        .then_with(|| compare_f64(a.score, b.score))
        .then_with(|| a.ordinal.cmp(&b.ordinal))
}

fn compare_states(a: &SearchState, b: &SearchState) -> Ordering {
    a.hard_violations
        .cmp(&b.hard_violations)
        .then_with(|| compare_f64(a.score, b.score))
        .then_with(|| a.ordinal.cmp(&b.ordinal))
}

fn lexical_ids(values: impl IntoIterator<Item = Arc<str>>) -> HashMap<Arc<str>, u32> {
    let mut values: Vec<_> = values.into_iter().collect();
    values.sort();
    values.dedup();
    values
        .into_iter()
        .enumerate()
        .map(|(index, value)| (value, index as u32))
        .collect()
}

fn compare_f64(a: f64, b: f64) -> Ordering {
    a.partial_cmp(&b).unwrap_or(Ordering::Equal)
}
fn div_ceil(value: usize, divisor: usize) -> usize {
    (value + divisor - 1) / divisor
}
fn snap(value: f64, grid: f64) -> f64 {
    if grid <= 0.0 {
        value
    } else {
        (value / grid + 0.5).floor() * grid
    }
}
fn snap_up(value: f64, grid: f64) -> f64 {
    if grid <= 0.0 {
        value
    } else {
        (value / grid).ceil() * grid
    }
}
fn snap_down(value: f64, grid: f64) -> f64 {
    if grid <= 0.0 {
        value
    } else {
        (value / grid).floor() * grid
    }
}
fn distance(a: Point, b: Point) -> f64 {
    (a.x - b.x).hypot(a.y - b.y)
}
fn dot(a: Point, b: Point) -> f64 {
    a.x * b.x + a.y * b.y
}
fn normalize(point: Point) -> Point {
    let length = point.x.hypot(point.y);
    if length > 0.000001 {
        Point {
            x: point.x / length,
            y: point.y / length,
        }
    } else {
        Point { x: 0.0, y: 0.0 }
    }
}
fn point_box(point: Point) -> Box2 {
    Box2 {
        left: point.x,
        right: point.x,
        top: point.y,
        bottom: point.y,
    }
}
fn dedupe_numbers(values: Vec<f64>) -> Vec<f64> {
    let mut seen = HashSet::new();
    values
        .into_iter()
        .filter(|value| value.is_finite() && seen.insert(round_placement(*value).to_bits()))
        .collect()
}
fn preferred_distance_squared(point: Point, preferred: &[Point]) -> f64 {
    if preferred.is_empty() {
        point.x * point.x + point.y * point.y
    } else {
        preferred
            .iter()
            .map(|target| (point.x - target.x).powi(2) + (point.y - target.y).powi(2))
            .fold(f64::INFINITY, f64::min)
    }
}

fn anchor_point(anchor: &str, bounds: Option<&Box2>) -> Option<Point> {
    let bounds = bounds?;
    let x = if anchor.ends_with(".left")
        || anchor.ends_with(".top_left")
        || anchor.ends_with(".bottom_left")
    {
        bounds.left
    } else if anchor.ends_with(".right")
        || anchor.ends_with(".top_right")
        || anchor.ends_with(".bottom_right")
    {
        bounds.right
    } else {
        (bounds.left + bounds.right) / 2.0
    };
    let y = if anchor.ends_with(".top")
        || anchor.ends_with(".top_left")
        || anchor.ends_with(".top_right")
    {
        bounds.top
    } else if anchor.ends_with(".bottom")
        || anchor.ends_with(".bottom_left")
        || anchor.ends_with(".bottom_right")
    {
        bounds.bottom
    } else {
        (bounds.top + bounds.bottom) / 2.0
    };
    Some(Point {
        x: round_placement(x),
        y: round_placement(y),
    })
}

fn is_ground(net: &str) -> bool {
    let upper = net.to_ascii_uppercase();
    upper == "GND"
        || upper.starts_with("GND_")
        || upper.starts_with("GND-")
        || upper.ends_with("_GND")
        || upper.ends_with("-GND")
}
fn is_power(net: &str) -> bool {
    let value = net.trim().to_ascii_uppercase();
    if is_ground(&value) {
        return false;
    }
    matches!(
        value.as_str(),
        "VBUS"
            | "VCC"
            | "VDD"
            | "VIN"
            | "VOUT"
            | "VSYS"
            | "VBAT"
            | "BAT"
            | "BAT+"
            | "BATT"
            | "BATT+"
            | "AVDD"
            | "DVDD"
            | "IOVDD"
            | "ADC_AVDD"
            | "VREF"
    ) || value.starts_with('+') && value.contains('V')
        || value.chars().next().is_some_and(|c| c.is_ascii_digit()) && value.contains('V')
        || ["VCC_", "VDD_", "VIN_", "VOUT_", "VBAT_", "VSYS_"]
            .iter()
            .any(|prefix| value.starts_with(prefix))
}
fn is_switching_power(net: &str) -> bool {
    let value = net.trim().to_ascii_uppercase();
    ["SW", "LX", "PH", "BOOT", "BST", "SWNODE", "VREG_LX"]
        .iter()
        .any(|prefix| {
            value == *prefix
                || value.starts_with(&format!("{prefix}_"))
                || value.starts_with(&format!("{prefix}-"))
        })
}
fn signal_net_weight(net: &str) -> f64 {
    let value = net.to_ascii_uppercase();
    if [
        "USB", "D+", "D-", "DP", "DM", "QSPI", "SPI", "I2C", "SDA", "SCL", "XIN", "XOUT", "CLK",
        "MISO", "MOSI", "SCLK", "CS",
    ]
    .iter()
    .any(|prefix| value.starts_with(prefix))
    {
        1.5
    } else {
        1.0
    }
}

fn segment_box_distance(a: Point, b: Point, box_: &Box2) -> f64 {
    if segment_intersects_box(a, b, box_) {
        return 0.0;
    }
    let corners = [
        Point {
            x: box_.left,
            y: box_.top,
        },
        Point {
            x: box_.right,
            y: box_.top,
        },
        Point {
            x: box_.right,
            y: box_.bottom,
        },
        Point {
            x: box_.left,
            y: box_.bottom,
        },
    ];
    let projected = [
        Point {
            x: box_.left,
            y: a.y.clamp(box_.top, box_.bottom),
        },
        Point {
            x: box_.right,
            y: a.y.clamp(box_.top, box_.bottom),
        },
        Point {
            x: a.x.clamp(box_.left, box_.right),
            y: box_.top,
        },
        Point {
            x: a.x.clamp(box_.left, box_.right),
            y: box_.bottom,
        },
    ];
    let mut best = point_to_box_distance(a, box_).min(point_to_box_distance(b, box_));
    for point in projected {
        best = best.min(point_to_segment_distance(point, a, b));
    }
    for corner in corners {
        best = best.min(point_to_segment_distance(corner, a, b));
    }
    best
}
fn segment_intersects_box(a: Point, b: Point, box_: &Box2) -> bool {
    if point_inside_box(a, box_) || point_inside_box(b, box_) {
        return true;
    }
    let c = [
        Point {
            x: box_.left,
            y: box_.top,
        },
        Point {
            x: box_.right,
            y: box_.top,
        },
        Point {
            x: box_.right,
            y: box_.bottom,
        },
        Point {
            x: box_.left,
            y: box_.bottom,
        },
    ];
    (0..4).any(|i| segments_intersect(a, b, c[i], c[(i + 1) % 4]))
}
fn point_inside_box(p: Point, b: &Box2) -> bool {
    p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom
}
fn orientation(a: Point, b: Point, c: Point) -> f64 {
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}
fn segments_intersect(a: Point, b: Point, c: Point, d: Point) -> bool {
    let o1 = orientation(a, b, c);
    let o2 = orientation(a, b, d);
    let o3 = orientation(c, d, a);
    let o4 = orientation(c, d, b);
    (o1 == 0.0 && point_to_segment_distance(c, a, b) < 0.000001)
        || (o2 == 0.0 && point_to_segment_distance(d, a, b) < 0.000001)
        || (o3 == 0.0 && point_to_segment_distance(a, c, d) < 0.000001)
        || (o4 == 0.0 && point_to_segment_distance(b, c, d) < 0.000001)
        || (o1 > 0.0) != (o2 > 0.0) && (o3 > 0.0) != (o4 > 0.0)
}
fn point_to_segment_distance(p: Point, a: Point, b: Point) -> f64 {
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let length_squared = dx * dx + dy * dy;
    if length_squared <= 0.000001 {
        return distance(p, a);
    }
    let t = (((p.x - a.x) * dx + (p.y - a.y) * dy) / length_squared).clamp(0.0, 1.0);
    distance(
        p,
        Point {
            x: a.x + t * dx,
            y: a.y + t * dy,
        },
    )
}
fn point_to_box_distance(p: Point, b: &Box2) -> f64 {
    let dx = if p.x < b.left {
        b.left - p.x
    } else if p.x > b.right {
        p.x - b.right
    } else {
        0.0
    };
    let dy = if p.y < b.top {
        b.top - p.y
    } else if p.y > b.bottom {
        p.y - b.bottom
    } else {
        0.0
    };
    dx.hypot(dy)
}
