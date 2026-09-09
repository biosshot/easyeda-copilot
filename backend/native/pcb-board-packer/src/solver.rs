use crate::geometry::{
    box_center, box_corners, box_inside_polygon_board, box_outside_bounds_severity,
    boxes_overlap_depth, normalize_rotation, overlap_depth, point_in_polygon,
    point_to_polygon_distance, rotate_box, rotate_point, round_placement, translate_box,
    union_boxes, Box2, Point,
};
use crate::model::{
    BoardPackProblem, BoardPackSolution, ComponentGeometry, Primitive, PrimitiveState, Rank,
    Relation,
};
use crate::signal_path;
use std::cell::RefCell;
use std::cmp::Ordering;
use std::collections::{BTreeSet, HashMap, HashSet};
use std::sync::Arc;

#[derive(Clone)]
struct WorkingPrimitive {
    id: u32,
    source_index: usize,
    primitive: Primitive,
    placement_ids: Arc<Vec<u32>>,
    point_component_ids: Arc<Vec<Option<u32>>>,
    components: Arc<Vec<(usize, ComponentGeometry)>>,
    rotation: i32,
}

#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
struct PlacementKey {
    designator: u32,
    x: u64,
    y: u64,
    rotation: i32,
    layer: u8,
}

#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
struct PrimitiveKey {
    id: u32,
    left: u64,
    top: u64,
    right: u64,
    bottom: u64,
    placements: Vec<PlacementKey>,
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct SearchStateKey {
    remaining: Vec<u32>,
    placed: Vec<PrimitiveKey>,
}

#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
struct PoseKey {
    primitive: u32,
    rotation: i32,
    left: u64,
    top: u64,
}

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
struct PosePairKey(PoseKey, PoseKey);

const GEOMETRY_CACHE_LIMIT: usize = 250_000;

#[derive(Clone)]
struct SearchState {
    placed: Vec<WorkingPrimitive>,
    remaining: Vec<WorkingPrimitive>,
    rank: Rank,
    ordinal: usize,
}

#[derive(Clone)]
struct RankedCandidate {
    primitive: WorkingPrimitive,
    rank: Rank,
    ordinal: usize,
}

#[derive(Clone, Copy)]
enum CompiledEndpoint {
    Anchor(Point),
    Pad { primitive: u32, point: usize },
    Component { primitive: u32, designator: u32 },
    Primitive { primitive: u32 },
    Missing,
}

#[derive(Clone, Copy)]
enum Side {
    Left,
    Right,
    Top,
    Bottom,
}

struct CompiledRelation {
    from: CompiledEndpoint,
    to: CompiledEndpoint,
    skip: bool,
    hard: bool,
    weight: f64,
    max_distance: Option<f64>,
    min_distance: Option<f64>,
    satellite_anchor: bool,
    anchor_offset: Option<Point>,
    side: Option<Side>,
}

struct Context {
    problem: BoardPackProblem,
    relations: Vec<CompiledRelation>,
    hard_overlap_cache: RefCell<HashMap<PosePairKey, f64>>,
    outside_cache: RefCell<HashMap<PoseKey, bool>>,
    outside_severity_cache: RefCell<HashMap<PoseKey, f64>>,
}

pub fn solve(problem: BoardPackProblem) -> Result<BoardPackSolution, String> {
    let primitive_ids = lexical_ids(
        problem
            .primitives
            .iter()
            .map(|primitive| primitive.id.clone()),
    );
    let designator_ids = lexical_ids(problem.primitives.iter().flat_map(|primitive| {
        primitive
            .placements
            .iter()
            .map(|placement| placement.designator.clone())
    }));
    let relations = compile_relations(&problem, &primitive_ids, &designator_ids);
    let context = Context {
        problem,
        relations,
        hard_overlap_cache: RefCell::new(HashMap::new()),
        outside_cache: RefCell::new(HashMap::new()),
        outside_severity_cache: RefCell::new(HashMap::new()),
    };
    let mut components_by_primitive: HashMap<Arc<str>, Vec<(usize, ComponentGeometry)>> =
        HashMap::new();
    for (index, component) in context.problem.components.iter().cloned().enumerate() {
        components_by_primitive
            .entry(component.primitive_id.clone())
            .or_default()
            .push((index, component));
    }
    let mut primitives: Vec<WorkingPrimitive> = context
        .problem
        .primitives
        .iter()
        .cloned()
        .enumerate()
        .map(|(source_index, primitive)| {
            let components = components_by_primitive
                .remove(&primitive.id)
                .unwrap_or_default();
            let placement_ids = Arc::new(
                primitive
                    .placements
                    .iter()
                    .map(|placement| designator_ids[&placement.designator])
                    .collect(),
            );
            let point_component_ids = Arc::new(
                primitive
                    .connection_points
                    .iter()
                    .map(|point| {
                        point
                            .reference
                            .split_once('.')
                            .and_then(|(designator, _)| designator_ids.get(designator).copied())
                    })
                    .collect(),
            );
            WorkingPrimitive {
                id: primitive_ids[&primitive.id],
                source_index,
                primitive,
                placement_ids,
                point_component_ids,
                components: Arc::new(components),
                rotation: 0,
            }
        })
        .collect();
    for primitive in &mut primitives {
        if !primitive.primitive.locked {
            fit_to_bounds(primitive, &context);
        }
    }

    let mut locked = Vec::new();
    let mut remaining = Vec::new();
    for primitive in primitives {
        if primitive.primitive.locked {
            locked.push(primitive);
        } else {
            remaining.push(primitive);
        }
    }
    remaining.sort_by(|a, b| compare_f64(seed_rank(b, &context), seed_rank(a, &context)));

    let mut ordinal = 0usize;
    let initial_rank = state_rank(&locked, &context);
    let mut states = vec![SearchState {
        placed: locked,
        remaining,
        rank: initial_rank,
        ordinal,
    }];
    let search_width = context.problem.search_width.max(32);

    while states.iter().any(|state| !state.remaining.is_empty()) {
        let mut expanded = Vec::new();
        for state in states {
            if state.remaining.is_empty() {
                expanded.push(state);
                continue;
            }
            let next_index = choose_next(&state, &context);
            let next = state.remaining[next_index].clone();
            let candidates = ranked_candidates(&next, &state.placed, &context);
            let legal: Vec<_> = candidates
                .iter()
                .filter(|candidate| candidate.rank.hard_count == state.rank.hard_count)
                .cloned()
                .collect();
            let source = if legal.is_empty() { candidates } else { legal };
            let limit = candidate_limit(search_width, state.remaining.len());
            for candidate in source.into_iter().take(limit) {
                ordinal += 1;
                let mut placed = state.placed.clone();
                placed.push(candidate.primitive);
                let mut remaining = state.remaining.clone();
                remaining.remove(next_index);
                expanded.push(SearchState {
                    placed,
                    remaining,
                    rank: candidate.rank,
                    ordinal,
                });
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
    let best = states
        .into_iter()
        .find(|state| state.remaining.is_empty())
        .ok_or_else(|| "Rust board packer did not produce a complete state".to_string())?;
    let improved = local_improve(best.placed, &context);
    let repaired = repair_hard_violations(improved, &context);
    let final_rank = state_rank(&repaired, &context);
    let states = repaired
        .iter()
        .map(|primitive| {
            let source = &context.problem.primitives[primitive.source_index];
            let source_origin = box_center(&source.bbox);
            let source_point = source.placements.first().map(|placement| {
                rotate_point(
                    &Point {
                        x: placement.x,
                        y: placement.y,
                    },
                    &source_origin,
                    primitive.rotation,
                )
            });
            let final_point = primitive
                .primitive
                .placements
                .first()
                .map(|placement| Point {
                    x: placement.x,
                    y: placement.y,
                });
            let (translation_x, translation_y) = match (source_point, final_point) {
                (Some(source), Some(final_)) => (
                    round_placement(final_.x - source.x),
                    round_placement(final_.y - source.y),
                ),
                _ => {
                    let rotated_box = rotate_box(&source.bbox, &source_origin, primitive.rotation);
                    (
                        round_placement(primitive.primitive.bbox.left - rotated_box.left),
                        round_placement(primitive.primitive.bbox.top - rotated_box.top),
                    )
                }
            };
            Ok(PrimitiveState {
                primitive_id: primitive.primitive.id.clone(),
                rotation: primitive.rotation,
                translation_x,
                translation_y,
                placements: primitive.primitive.placements.as_ref().clone(),
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    Ok(BoardPackSolution {
        version: context.problem.version,
        states,
        rank: final_rank,
    })
}

fn ranked_candidates(
    primitive: &WorkingPrimitive,
    placed: &[WorkingPrimitive],
    context: &Context,
) -> Vec<RankedCandidate> {
    let mut candidates = Vec::new();
    let mut ordinal = 0usize;
    for variant in orientation_variants(primitive) {
        for candidate in position_candidates(&variant, placed, context) {
            ordinal += 1;
            let mut all = placed.to_vec();
            all.push(candidate.clone());
            candidates.push(RankedCandidate {
                primitive: candidate,
                rank: state_rank(&all, context),
                ordinal,
            });
        }
    }
    dedupe_candidates(&mut candidates);
    candidates.sort_by(compare_candidates);
    if std::env::var("PCB_BOARD_PACKER_TRACE_DESIGNATOR")
        .ok()
        .as_deref()
        == primitive
            .primitive
            .placements
            .first()
            .map(|placement| placement.designator.as_ref())
    {
        let values: Vec<_> = candidates
            .iter()
            .take(12)
            .filter_map(|candidate| {
                candidate
                    .primitive
                    .primitive
                    .placements
                    .first()
                    .map(|placement| {
                        (
                            placement.x,
                            placement.y,
                            placement.rotate,
                            candidate.rank.hard_count,
                            candidate.rank.score,
                        )
                    })
            })
            .collect();
        eprintln!(
            "[pcb-board-packer] candidates {}: {:?}",
            primitive.primitive.id, values
        );
    }
    candidates
}

fn position_candidates(
    primitive: &WorkingPrimitive,
    placed: &[WorkingPrimitive],
    context: &Context,
) -> Vec<WorkingPrimitive> {
    let pack_box = packing_box(primitive);
    let width = pack_box.right - pack_box.left;
    let height = pack_box.bottom - pack_box.top;
    let mut centers = Vec::new();
    centers.extend(edge_place_centers(primitive, width, height, context));
    centers.extend(board_slot_centers(width, height, &context.problem.bounds));
    centers.extend(free_rect_slot_centers(width, height, placed, context));
    centers.extend(placed_slot_centers(width, height, placed, context));
    centers.extend(relation_slot_centers(primitive, placed, context));
    let placed_primitives: Vec<_> = placed.iter().map(|item| &item.primitive).collect();
    let current_center = box_center(&pack_box);
    centers.extend(
        signal_path::bridge_deltas(&primitive.primitive, &placed_primitives)
            .into_iter()
            .map(|delta| Point {
                x: current_center.x + delta.x,
                y: current_center.y + delta.y,
            }),
    );
    centers.extend(coarse_grid_centers(
        width,
        height,
        &context.problem.bounds,
        context.problem.grid,
    ));
    dedupe_points(&mut centers);

    let mut candidates = Vec::with_capacity(centers.len());
    for center in centers {
        let mut candidate = primitive.clone();
        move_packing_center(&mut candidate, center);
        fit_to_bounds(&mut candidate, context);
        candidates.push(candidate);
    }
    let legal: Vec<_> = candidates
        .iter()
        .filter(|candidate| candidate_hard_count(candidate, placed, context) == 0)
        .cloned()
        .collect();
    if legal.is_empty() {
        candidates
    } else {
        legal
    }
}

fn orientation_variants(primitive: &WorkingPrimitive) -> Vec<WorkingPrimitive> {
    let orientations = if !primitive.primitive.allowed_orientations.is_empty() {
        primitive.primitive.allowed_orientations.as_ref().clone()
    } else if primitive.primitive.can_rotate {
        vec![0, 90, 180, 270]
    } else {
        vec![0]
    };
    orientations
        .into_iter()
        .map(|angle| {
            let mut variant = primitive.clone();
            rotate_primitive(&mut variant, angle);
            variant
        })
        .collect()
}

fn translate_primitive(primitive: &mut WorkingPrimitive, dx: f64, dy: f64) {
    primitive.primitive.bbox = translate_box(&primitive.primitive.bbox, dx, dy);
    for box_ in Arc::make_mut(&mut primitive.primitive.collision_boxes) {
        *box_ = translate_box(box_, dx, dy);
    }
    for placement in Arc::make_mut(&mut primitive.primitive.placements) {
        placement.x = round_placement(placement.x + dx);
        placement.y = round_placement(placement.y + dy);
    }
    for point in Arc::make_mut(&mut primitive.primitive.connection_points) {
        point.x = round_placement(point.x + dx);
        point.y = round_placement(point.y + dy);
    }
    for port in Arc::make_mut(&mut primitive.primitive.path_ports) {
        port.x = round_placement(port.x + dx);
        port.y = round_placement(port.y + dy);
    }
    for (_, component) in Arc::make_mut(&mut primitive.components) {
        component.body_box = translate_box(&component.body_box, dx, dy);
        for box_ in Arc::make_mut(&mut component.through_hole_boxes) {
            *box_ = translate_box(box_, dx, dy);
        }
    }
}

fn rotate_primitive(primitive: &mut WorkingPrimitive, angle: i32) {
    let angle = normalize_rotation(angle);
    if angle == 0 {
        return;
    }
    let origin = box_center(&primitive.primitive.bbox);
    primitive.primitive.bbox = rotate_box(&primitive.primitive.bbox, &origin, angle);
    for box_ in Arc::make_mut(&mut primitive.primitive.collision_boxes) {
        *box_ = rotate_box(box_, &origin, angle);
    }
    primitive.primitive.width =
        round_placement(primitive.primitive.bbox.right - primitive.primitive.bbox.left);
    primitive.primitive.height =
        round_placement(primitive.primitive.bbox.bottom - primitive.primitive.bbox.top);
    let orientations = Arc::make_mut(&mut primitive.primitive.allowed_orientations);
    for orientation in orientations.iter_mut() {
        *orientation = normalize_rotation(*orientation - angle);
    }
    orientations.sort_unstable();
    orientations.dedup();
    for placement in Arc::make_mut(&mut primitive.primitive.placements) {
        let point = rotate_point(
            &Point {
                x: placement.x,
                y: placement.y,
            },
            &origin,
            angle,
        );
        placement.x = point.x;
        placement.y = point.y;
        placement.rotate = normalize_rotation(placement.rotate + angle);
    }
    for point in Arc::make_mut(&mut primitive.primitive.connection_points) {
        let rotated = rotate_point(
            &Point {
                x: point.x,
                y: point.y,
            },
            &origin,
            angle,
        );
        point.x = rotated.x;
        point.y = rotated.y;
    }
    for port in Arc::make_mut(&mut primitive.primitive.path_ports) {
        let rotated = rotate_point(
            &Point {
                x: port.x,
                y: port.y,
            },
            &origin,
            angle,
        );
        port.x = rotated.x;
        port.y = rotated.y;
        port.normal = signal_path::rotate_normal(&port.normal, angle);
    }
    for (_, component) in Arc::make_mut(&mut primitive.components) {
        component.body_box = rotate_box(&component.body_box, &origin, angle);
        for box_ in Arc::make_mut(&mut component.through_hole_boxes) {
            *box_ = rotate_box(box_, &origin, angle);
        }
    }
    primitive.rotation = normalize_rotation(primitive.rotation + angle);
}

fn state_rank(primitives: &[WorkingPrimitive], context: &Context) -> Rank {
    let hard_count = hard_count(primitives, context);
    let hard_severity = hard_severity(primitives, context);
    Rank {
        hard_count,
        hard_severity,
        score: board_score(primitives, context, hard_count, hard_severity),
    }
}

fn local_improve(mut current: Vec<WorkingPrimitive>, context: &Context) -> Vec<WorkingPrimitive> {
    let mut current_rank = state_rank(&current, context);
    let passes = if current_rank.hard_count > 0 { 4 } else { 2 };
    for _ in 0..passes {
        let mut changed = false;
        for index in 0..current.len() {
            if current[index].primitive.locked {
                continue;
            }
            let fixed: Vec<_> = current
                .iter()
                .enumerate()
                .filter(|(item_index, _)| *item_index != index)
                .map(|(_, item)| item.clone())
                .collect();
            let candidates = ranked_candidates(&current[index], &fixed, context);
            let mut best = current[index].clone();
            let mut best_rank = Rank {
                hard_count: current_rank.hard_count,
                hard_severity: current_rank.hard_severity,
                score: current_rank.score,
            };
            for candidate in candidates.into_iter().take(80) {
                let mut variant = current.clone();
                variant[index] = candidate.primitive.clone();
                let rank = state_rank(&variant, context);
                let better = rank.hard_count < best_rank.hard_count
                    || (rank.hard_count == best_rank.hard_count
                        && rank.hard_severity + 0.001 < best_rank.hard_severity)
                    || (rank.hard_count == best_rank.hard_count
                        && (rank.hard_severity - best_rank.hard_severity).abs() <= 0.001
                        && rank.score + 0.001 < best_rank.score);
                if better {
                    best = candidate.primitive;
                    best_rank = rank;
                }
            }
            if primitive_key(&best) != primitive_key(&current[index]) {
                current[index] = best;
                current_rank = best_rank;
                changed = true;
            }
        }
        if !changed {
            break;
        }
    }
    current
}

fn repair_hard_violations(
    mut current: Vec<WorkingPrimitive>,
    context: &Context,
) -> Vec<WorkingPrimitive> {
    let mut current_rank = state_rank(&current, context);
    let max_passes = 8.max(current.len() * 6);
    for _ in 0..max_passes {
        let variants = hard_repair_variants(&current, context);
        let mut best: Option<(Vec<WorkingPrimitive>, Rank)> = None;
        for variant in variants {
            let rank = state_rank(&variant, context);
            if compare_rank(
                &rank,
                best.as_ref().map(|(_, rank)| rank).unwrap_or(&current_rank),
            ) == Ordering::Less
            {
                best = Some((variant, rank));
            }
        }
        let Some((variant, rank)) = best else {
            break;
        };
        current = variant;
        current_rank = rank;
        if current_rank.hard_count == 0 {
            current = local_improve(current, context);
            current_rank = state_rank(&current, context);
            if current_rank.hard_count == 0 {
                break;
            }
        }
    }
    current
}

fn hard_repair_variants(
    primitives: &[WorkingPrimitive],
    context: &Context,
) -> Vec<Vec<WorkingPrimitive>> {
    let mut variants = Vec::new();
    for index in 0..primitives.len() {
        if primitives[index].primitive.locked {
            continue;
        }
        let mut fitted = primitives[index].clone();
        fit_to_bounds(&mut fitted, context);
        if primitive_key(&fitted) != primitive_key(&primitives[index]) {
            let mut variant = primitives.to_vec();
            variant[index] = fitted;
            variants.push(variant);
        }
    }
    for a_index in 0..primitives.len() {
        for b_index in a_index + 1..primitives.len() {
            let clearance =
                primitive_clearance(&primitives[a_index], &primitives[b_index], context);
            if boxes_overlap_depth(
                packing_boxes(&primitives[a_index]),
                packing_boxes(&primitives[b_index]),
                clearance,
            ) <= 0.0
            {
                continue;
            }
            variants.extend(separation_variants(primitives, a_index, b_index, context));
        }
    }
    variants
}

fn separation_variants(
    primitives: &[WorkingPrimitive],
    a_index: usize,
    b_index: usize,
    context: &Context,
) -> Vec<Vec<WorkingPrimitive>> {
    let a = &primitives[a_index];
    let b = &primitives[b_index];
    if a.primitive.locked && b.primitive.locked {
        return Vec::new();
    }
    let clearance = primitive_clearance(a, b, context);
    let a_box = packing_box(a);
    let b_box = packing_box(b);
    let x_overlap =
        (a_box.right + clearance - b_box.left).min(b_box.right + clearance - a_box.left);
    let y_overlap =
        (a_box.bottom + clearance - b_box.top).min(b_box.bottom + clearance - a_box.top);
    let axes = if x_overlap <= y_overlap {
        [('x', x_overlap), ('y', y_overlap)]
    } else {
        [('y', y_overlap), ('x', x_overlap)]
    };
    let mut variants = Vec::new();
    for (axis, overlap) in axes {
        if overlap <= 0.0 {
            continue;
        }
        let direction = if axis == 'x' {
            sign_or_negative((a_box.left + a_box.right) / 2.0 - (b_box.left + b_box.right) / 2.0)
        } else {
            sign_or_negative((a_box.top + a_box.bottom) / 2.0 - (b_box.top + b_box.bottom) / 2.0)
        };
        let distance = round_placement(overlap + (0.001_f64).max(context.problem.grid * 0.1));
        let a_share = if a.primitive.locked {
            0.0
        } else if b.primitive.locked {
            1.0
        } else {
            0.5
        };
        let b_share = if b.primitive.locked {
            0.0
        } else if a.primitive.locked {
            1.0
        } else {
            0.5
        };
        let mut both = primitives.to_vec();
        if a_share > 0.0 {
            both[a_index] = translated_for_repair(a, axis, direction * distance * a_share, context);
        }
        if b_share > 0.0 {
            both[b_index] =
                translated_for_repair(b, axis, -direction * distance * b_share, context);
        }
        variants.push(both);
        if !a.primitive.locked {
            let mut one = primitives.to_vec();
            one[a_index] = translated_for_repair(a, axis, direction * distance, context);
            variants.push(one);
        }
        if !b.primitive.locked {
            let mut one = primitives.to_vec();
            one[b_index] = translated_for_repair(b, axis, -direction * distance, context);
            variants.push(one);
        }
    }
    variants
}

fn translated_for_repair(
    primitive: &WorkingPrimitive,
    axis: char,
    distance: f64,
    context: &Context,
) -> WorkingPrimitive {
    let mut moved = primitive.clone();
    if axis == 'x' {
        translate_primitive(&mut moved, round_placement(distance), 0.0);
    } else {
        translate_primitive(&mut moved, 0.0, round_placement(distance));
    }
    fit_to_bounds(&mut moved, context);
    moved
}

fn sign_or_negative(value: f64) -> f64 {
    if value > 0.0 {
        1.0
    } else {
        -1.0
    }
}

fn board_score(
    primitives: &[WorkingPrimitive],
    context: &Context,
    hard_count: usize,
    hard_severity: f64,
) -> f64 {
    if primitives.is_empty() {
        return 0.0;
    }
    let boxes: Vec<_> = primitives
        .iter()
        .flat_map(|primitive| packing_boxes(primitive).iter().copied())
        .collect();
    let bbox = union_boxes(&boxes);
    let width = bbox.right - bbox.left;
    let height = bbox.bottom - bbox.top;
    let high = context.problem.compactness.as_ref() == "high";
    let relation_weight = if high { 0.35 } else { 1.0 };
    let area_weight = if high { 1.2 } else { 0.12 };
    let perimeter_weight = if high { 8.0 } else { 1.5 };
    let overlap_weight = if high { 1.2 } else { 1.0 };
    let edge_weight = if high { 0.4 } else { 1.0 };
    let path_primitives: Vec<_> = primitives.iter().map(|item| &item.primitive).collect();
    relation_penalty(primitives, context) * relation_weight
        + hard_severity * 1_000_000.0
        + hard_count as f64 * 100_000_000.0
        + envelope_overlap_penalty(primitives, context) * overlap_weight
        + width * height * area_weight
        + (width + height) * perimeter_weight
        + edge_bias_penalty(primitives, context) * edge_weight
        + edge_place_penalty(primitives, context)
        + signal_path::topology_penalty(&path_primitives, &context.problem.relations)
            * if high { 3.0 } else { 5.0 }
}

fn hard_count(primitives: &[WorkingPrimitive], context: &Context) -> usize {
    let mut count = 0;
    for i in 0..primitives.len() {
        for j in i + 1..primitives.len() {
            if primitive_hard_overlap(&primitives[i], &primitives[j], context) > 0.0 {
                count += 1;
            }
        }
    }
    for primitive in primitives {
        if primitive_outside(primitive, context) {
            count += 1;
        }
        if edge_place_violation(primitive, context) > 0.0 {
            count += 1;
        }
        for obstacle in &context.problem.obstacles {
            if boxes_overlap_depth(
                packing_boxes(primitive),
                &[*obstacle],
                context.problem.clearance,
            ) > 0.0
            {
                count += 1;
            }
        }
        count += constraint_violation_count(primitive, context);
    }
    count
}

fn hard_severity(primitives: &[WorkingPrimitive], context: &Context) -> f64 {
    let mut severity = 0.0;
    for i in 0..primitives.len() {
        for j in i + 1..primitives.len() {
            severity += primitive_hard_overlap(&primitives[i], &primitives[j], context);
        }
    }
    for primitive in primitives {
        severity += primitive_outside_severity(primitive, context)
            + edge_place_violation(primitive, context);
        for obstacle in &context.problem.obstacles {
            severity += boxes_overlap_depth(
                packing_boxes(primitive),
                &[*obstacle],
                context.problem.clearance,
            );
        }
        severity += constraint_violation_severity(primitive, context);
    }
    severity
}

fn candidate_hard_count(
    candidate: &WorkingPrimitive,
    placed: &[WorkingPrimitive],
    context: &Context,
) -> usize {
    let mut count = usize::from(primitive_outside(candidate, context));
    count += usize::from(edge_place_violation(candidate, context) > 0.0);
    count += placed
        .iter()
        .filter(|other| primitive_hard_overlap(candidate, other, context) > 0.0)
        .count();
    count += context
        .problem
        .obstacles
        .iter()
        .filter(|obstacle| {
            boxes_overlap_depth(
                packing_boxes(candidate),
                &[**obstacle],
                context.problem.clearance,
            ) > 0.0
        })
        .count();
    count + constraint_violation_count(candidate, context)
}

fn primitive_hard_overlap(a: &WorkingPrimitive, b: &WorkingPrimitive, context: &Context) -> f64 {
    let key = pose_pair_key(a, b);
    if let Some(value) = context.hard_overlap_cache.borrow().get(&key).copied() {
        return value;
    }
    let broad_clearance = primitive_clearance(a, b, context);
    if boxes_overlap_depth(packing_boxes(a), packing_boxes(b), broad_clearance) <= 0.0 {
        cache_insert(&context.hard_overlap_cache, key, 0.0);
        return 0.0;
    }
    let mut max_overlap: f64 = 0.0;
    for (a_index, a_component) in a.components.iter() {
        for (b_index, b_component) in b.components.iter() {
            let count = context.problem.components.len();
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
                max_overlap = max_overlap.max(boxes_overlap_depth(
                    &[a_component.body_box],
                    &b_component.through_hole_boxes,
                    clearance,
                ));
                max_overlap = max_overlap.max(boxes_overlap_depth(
                    &a_component.through_hole_boxes,
                    &[b_component.body_box],
                    clearance,
                ));
            }
        }
    }
    let result = if max_overlap <= 1e-9 {
        0.0
    } else {
        max_overlap
    };
    cache_insert(&context.hard_overlap_cache, key, result);
    result
}

fn primitive_clearance(a: &WorkingPrimitive, b: &WorkingPrimitive, context: &Context) -> f64 {
    let mut clearance = context.problem.clearance;
    let count = context.problem.components.len();
    for (a_index, _) in a.components.iter() {
        for (b_index, _) in b.components.iter() {
            clearance =
                clearance.max(context.problem.component_pair_clearance[a_index * count + b_index]);
        }
    }
    clearance
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

fn primitive_outside(primitive: &WorkingPrimitive, context: &Context) -> bool {
    let key = pose_key(primitive);
    if let Some(value) = context.outside_cache.borrow().get(&key).copied() {
        return value;
    }
    let result = if primitive.components.is_empty() {
        let edge = primitive
            .primitive
            .edge_place
            .as_ref()
            .and_then(|intent| intent.inset)
            .unwrap_or(context.problem.edge_clearance)
            .max(0.0);
        packing_boxes(primitive).iter().any(|box_| {
            !box_inside_polygon_board(
                box_,
                &context.problem.full_board_bounds,
                &context.problem.board_outline,
                edge,
            )
        })
    } else {
        primitive
            .components
            .iter()
            .any(|(_, component)| component_outside(component, context))
    };
    cache_insert(&context.outside_cache, key, result);
    result
}

fn primitive_outside_severity(primitive: &WorkingPrimitive, context: &Context) -> f64 {
    let key = pose_key(primitive);
    if let Some(value) = context.outside_severity_cache.borrow().get(&key).copied() {
        return value;
    }
    let result = if primitive.components.is_empty() {
        let edge = primitive
            .primitive
            .edge_place
            .as_ref()
            .and_then(|intent| intent.inset)
            .unwrap_or(context.problem.edge_clearance)
            .max(0.0);
        let bounds = inset_box(&context.problem.full_board_bounds, edge);
        packing_boxes(primitive)
            .iter()
            .map(|box_| polygon_board_outside_severity(box_, &bounds, edge, context))
            .sum()
    } else {
        primitive
            .components
            .iter()
            .map(|(_, component)| component_outside_severity(component, context))
            .sum()
    };
    cache_insert(&context.outside_severity_cache, key, result);
    result
}

fn component_outside(component: &ComponentGeometry, context: &Context) -> bool {
    if has_board_overflow(component) {
        return box_outside_bounds_severity(
            &component.body_box,
            &component_board_bounds(component, context),
        ) > 0.0;
    }
    !box_inside_polygon_board(
        &component.body_box,
        &context.problem.full_board_bounds,
        &context.problem.board_outline,
        component.edge_clearance,
    )
}

fn component_outside_severity(component: &ComponentGeometry, context: &Context) -> f64 {
    let bounds = component_board_bounds(component, context);
    if has_board_overflow(component) {
        return box_outside_bounds_severity(&component.body_box, &bounds);
    }
    polygon_board_outside_severity(
        &component.body_box,
        &bounds,
        component.edge_clearance,
        context,
    )
}

fn component_board_bounds(component: &ComponentGeometry, context: &Context) -> Box2 {
    let full = context.problem.full_board_bounds;
    let overflow = component.board_overflow;
    let edge = component.edge_clearance.max(0.0);
    Box2 {
        left: if overflow.left > 0.0 {
            full.left - overflow.left
        } else {
            full.left + edge
        },
        right: if overflow.right > 0.0 {
            full.right + overflow.right
        } else {
            full.right - edge
        },
        top: if overflow.top > 0.0 {
            full.top - overflow.top
        } else {
            full.top + edge
        },
        bottom: if overflow.bottom > 0.0 {
            full.bottom + overflow.bottom
        } else {
            full.bottom - edge
        },
    }
}

fn has_board_overflow(component: &ComponentGeometry) -> bool {
    component.board_overflow.left > 0.0
        || component.board_overflow.right > 0.0
        || component.board_overflow.top > 0.0
        || component.board_overflow.bottom > 0.0
}

fn polygon_board_outside_severity(box_: &Box2, bounds: &Box2, edge: f64, context: &Context) -> f64 {
    let mut severity = box_outside_bounds_severity(box_, bounds);
    for corner in box_corners(box_) {
        let inside = point_in_polygon(&corner, &context.problem.board_outline)
            && (edge <= 0.0
                || point_to_polygon_distance(&corner, &context.problem.board_outline) + 1e-6
                    >= edge);
        if inside {
            continue;
        }
        let edge_distance = point_to_polygon_distance(&corner, &context.problem.board_outline);
        severity += edge_distance.max(0.01) + (edge - edge_distance).max(0.0);
    }
    severity
}

fn constraint_violation_count(primitive: &WorkingPrimitive, context: &Context) -> usize {
    context
        .problem
        .constraint_regions
        .iter()
        .filter(|region| {
            primitive.components.iter().any(|(_, component)| {
                !region.allow_blocks.contains(&component.block_name)
                    && region.layers.contains(&component.layer)
                    && overlap_depth(&component.body_box, &region.box_, 0.0) > 0.0
            })
        })
        .count()
}

fn constraint_violation_severity(primitive: &WorkingPrimitive, context: &Context) -> f64 {
    context
        .problem
        .constraint_regions
        .iter()
        .flat_map(|region| {
            primitive.components.iter().filter_map(|(_, component)| {
                if region.allow_blocks.contains(&component.block_name)
                    || !region.layers.contains(&component.layer)
                {
                    return None;
                }
                Some(overlap_depth(&component.body_box, &region.box_, 0.0))
            })
        })
        .sum()
}

fn envelope_overlap_penalty(primitives: &[WorkingPrimitive], context: &Context) -> f64 {
    let mut penalty = 0.0;
    for i in 0..primitives.len() {
        for j in i + 1..primitives.len() {
            if !primitive_can_conflict(&primitives[i], &primitives[j], context) {
                continue;
            }
            let depth = overlap_depth(
                &primitives[i].primitive.bbox,
                &primitives[j].primitive.bbox,
                context.problem.clearance,
            );
            if depth > 0.0 {
                penalty += depth.powi(2) * 700.0 + depth * 140.0;
            }
        }
    }
    penalty
}

fn relation_penalty(primitives: &[WorkingPrimitive], context: &Context) -> f64 {
    let mut penalty = 0.0;
    for relation in &context.relations {
        if relation.skip {
            continue;
        }
        let Some(from) = endpoint_point(primitives, relation.from) else {
            continue;
        };
        let Some(mut to) = endpoint_point(primitives, relation.to) else {
            continue;
        };
        if relation.satellite_anchor {
            if let Some(offset) = relation.anchor_offset {
                to.0.x = round_placement(to.0.x + offset.x);
                to.0.y = round_placement(to.0.y + offset.y);
            }
        }
        if from.1 == to.1 {
            continue;
        }
        let weight = relation.weight;
        let distance = ((from.0.x - to.0.x).powi(2) + (from.0.y - to.0.y).powi(2)).sqrt();
        penalty += distance * weight + distance_limit_penalty(relation, distance, weight);
        if relation.satellite_anchor {
            if let Some(side) = relation.side {
                penalty += side_penalty(side, from.0, to.0, weight);
            }
        }
    }
    penalty
}

fn edge_bias_penalty(primitives: &[WorkingPrimitive], context: &Context) -> f64 {
    let board_area = box_area(&context.problem.bounds).max(1.0);
    primitives
        .iter()
        .filter(|primitive| !primitive.primitive.locked)
        .map(|primitive| {
            let box_ = packing_box(primitive);
            let ratio = box_area(&box_) / board_area;
            if ratio < 0.055 && primitive.primitive.kind.as_ref() != "module" {
                return 0.0;
            }
            let distance = (box_.left - context.problem.bounds.left)
                .abs()
                .min((context.problem.bounds.right - box_.right).abs())
                .min((box_.top - context.problem.bounds.top).abs())
                .min((context.problem.bounds.bottom - box_.bottom).abs());
            distance * (1.0 + ratio * 60.0).min(8.0)
        })
        .sum()
}

fn edge_place_penalty(primitives: &[WorkingPrimitive], context: &Context) -> f64 {
    primitives
        .iter()
        .map(|primitive| {
            let Some(intent) = &primitive.primitive.edge_place else {
                return 0.0;
            };
            let box_ = packing_box(primitive);
            let center = box_center(&box_);
            intent
                .edges
                .iter()
                .map(|edge| {
                    let inset = intent.inset.unwrap_or(0.0).max(0.0);
                    let distance = match edge.as_ref() {
                        "left" => {
                            (box_.left - (context.problem.full_board_bounds.left + inset)).abs()
                        }
                        "right" => {
                            (box_.right - (context.problem.full_board_bounds.right - inset)).abs()
                        }
                        "top" => (box_.top - (context.problem.full_board_bounds.top + inset)).abs(),
                        _ => {
                            (box_.bottom - (context.problem.full_board_bounds.bottom - inset)).abs()
                        }
                    };
                    let exact = if edge.as_ref() == "left" || edge.as_ref() == "right" {
                        intent.y.map(|y| (center.y - y).abs())
                    } else {
                        intent.x.map(|x| (center.x - x).abs())
                    };
                    distance * 800.0 + exact.unwrap_or(0.0) * 35.0
                })
                .fold(f64::INFINITY, f64::min)
        })
        .sum()
}

fn edge_place_violation(primitive: &WorkingPrimitive, context: &Context) -> f64 {
    let Some(intent) = &primitive.primitive.edge_place else {
        return 0.0;
    };
    let box_ = packing_box(primitive);
    let tolerance = 0.05_f64.max(context.problem.grid * 0.51);
    let best = intent
        .edges
        .iter()
        .map(|edge| {
            let inset = intent.inset.unwrap_or(0.0).max(0.0);
            match edge.as_ref() {
                "left" => (box_.left - (context.problem.full_board_bounds.left + inset)).abs(),
                "right" => (box_.right - (context.problem.full_board_bounds.right - inset)).abs(),
                "top" => (box_.top - (context.problem.full_board_bounds.top + inset)).abs(),
                _ => (box_.bottom - (context.problem.full_board_bounds.bottom - inset)).abs(),
            }
        })
        .fold(f64::INFINITY, f64::min);
    (best - tolerance).max(0.0) * 8.0
}

fn board_slot_centers(width: f64, height: f64, bounds: &Box2) -> Vec<Point> {
    let left = bounds.left + width / 2.0;
    let right = bounds.right - width / 2.0;
    let top = bounds.top + height / 2.0;
    let bottom = bounds.bottom - height / 2.0;
    let center = box_center(bounds);
    vec![
        center,
        Point { x: left, y: top },
        Point { x: right, y: top },
        Point { x: left, y: bottom },
        Point {
            x: right,
            y: bottom,
        },
        Point {
            x: center.x,
            y: top,
        },
        Point {
            x: center.x,
            y: bottom,
        },
        Point {
            x: left,
            y: center.y,
        },
        Point {
            x: right,
            y: center.y,
        },
    ]
}

fn free_rect_slot_centers(
    width: f64,
    height: f64,
    placed: &[WorkingPrimitive],
    context: &Context,
) -> Vec<Point> {
    let mut occupied: Vec<Box2> = placed
        .iter()
        .flat_map(|primitive| {
            packing_boxes(primitive)
                .iter()
                .map(|box_| inflate_box(box_, context.problem.clearance))
        })
        .collect();
    occupied.extend(
        context
            .problem
            .obstacles
            .iter()
            .map(|box_| inflate_box(box_, context.problem.clearance)),
    );
    let mut free_rects = vec![context.problem.bounds];
    for occupied_box in occupied {
        free_rects = free_rects
            .into_iter()
            .flat_map(|rect| subtract_rect(&rect, &occupied_box))
            .collect();
        if free_rects.len() > 160 {
            free_rects = prune_free_rects(free_rects, 100);
        }
    }
    let mut centers = Vec::new();
    for rect in prune_free_rects(free_rects, 80) {
        if rect.right - rect.left + 0.0001 < width || rect.bottom - rect.top + 0.0001 < height {
            continue;
        }
        let left = rect.left + width / 2.0;
        let right = rect.right - width / 2.0;
        let top = rect.top + height / 2.0;
        let bottom = rect.bottom - height / 2.0;
        let center = box_center(&rect);
        centers.extend([
            Point { x: left, y: top },
            Point { x: right, y: top },
            Point { x: left, y: bottom },
            Point {
                x: right,
                y: bottom,
            },
            Point {
                x: center.x,
                y: top,
            },
            Point {
                x: center.x,
                y: bottom,
            },
            Point {
                x: left,
                y: center.y,
            },
            Point {
                x: right,
                y: center.y,
            },
            center,
        ]);
    }
    for point in &mut centers {
        *point = snap_point(*point, context.problem.grid);
    }
    centers
}

fn subtract_rect(rect: &Box2, cut: &Box2) -> Vec<Box2> {
    let Some(overlap) = intersect_box(rect, cut) else {
        return vec![*rect];
    };
    let mut result = Vec::new();
    if overlap.left > rect.left {
        result.push(Box2 {
            left: rect.left,
            right: overlap.left,
            top: rect.top,
            bottom: rect.bottom,
        });
    }
    if overlap.right < rect.right {
        result.push(Box2 {
            left: overlap.right,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
        });
    }
    if overlap.top > rect.top {
        result.push(Box2 {
            left: overlap.left,
            right: overlap.right,
            top: rect.top,
            bottom: overlap.top,
        });
    }
    if overlap.bottom < rect.bottom {
        result.push(Box2 {
            left: overlap.left,
            right: overlap.right,
            top: overlap.bottom,
            bottom: rect.bottom,
        });
    }
    result
        .into_iter()
        .filter(|box_| box_.right - box_.left > 0.05 && box_.bottom - box_.top > 0.05)
        .collect()
}

fn intersect_box(a: &Box2, b: &Box2) -> Option<Box2> {
    let result = Box2 {
        left: a.left.max(b.left),
        right: a.right.min(b.right),
        top: a.top.max(b.top),
        bottom: a.bottom.min(b.bottom),
    };
    (result.left < result.right && result.top < result.bottom).then_some(result)
}

fn prune_free_rects(rects: Vec<Box2>, limit: usize) -> Vec<Box2> {
    let mut unique = Vec::new();
    let mut seen = HashSet::new();
    for box_ in rects {
        let rounded = Box2 {
            left: round_placement(box_.left),
            right: round_placement(box_.right),
            top: round_placement(box_.top),
            bottom: round_placement(box_.bottom),
        };
        let key = (
            rounded.left.to_bits(),
            rounded.right.to_bits(),
            rounded.top.to_bits(),
            rounded.bottom.to_bits(),
        );
        if seen.insert(key) {
            unique.push(rounded);
        }
    }
    let snapshot = unique.clone();
    unique.retain(|item| {
        !snapshot
            .iter()
            .any(|other| other != item && box_contains(other, item))
    });
    unique.sort_by(|a, b| compare_f64(box_area(b), box_area(a)));
    unique.truncate(limit);
    unique
}

fn box_contains(container: &Box2, item: &Box2) -> bool {
    container.left <= item.left
        && container.right >= item.right
        && container.top <= item.top
        && container.bottom >= item.bottom
}

fn inflate_box(box_: &Box2, value: f64) -> Box2 {
    Box2 {
        left: round_placement(box_.left - value),
        right: round_placement(box_.right + value),
        top: round_placement(box_.top - value),
        bottom: round_placement(box_.bottom + value),
    }
}

fn placed_slot_centers(
    width: f64,
    height: f64,
    placed: &[WorkingPrimitive],
    context: &Context,
) -> Vec<Point> {
    let mut centers = Vec::new();
    for box_ in placed.iter().flat_map(|primitive| packing_boxes(primitive)) {
        let clearance = context.problem.clearance;
        let left = box_.left - clearance - width / 2.0;
        let right = box_.right + clearance + width / 2.0;
        let top = box_.top - clearance - height / 2.0;
        let bottom = box_.bottom + clearance + height / 2.0;
        let x = (box_.left + box_.right) / 2.0;
        let y = (box_.top + box_.bottom) / 2.0;
        centers.extend([
            Point { x: left, y },
            Point { x: right, y },
            Point { x, y: top },
            Point { x, y: bottom },
            Point { x: left, y: top },
            Point { x: right, y: top },
            Point { x: left, y: bottom },
            Point {
                x: right,
                y: bottom,
            },
        ]);
    }
    let placed_boxes: Vec<_> = placed
        .iter()
        .flat_map(|primitive| packing_boxes(primitive).iter().copied())
        .collect();
    let x_values: Vec<_> = placed_boxes
        .iter()
        .flat_map(|box_| {
            [
                box_.left - context.problem.clearance - width / 2.0,
                box_.right + context.problem.clearance + width / 2.0,
                (box_.left + box_.right) / 2.0,
            ]
        })
        .collect();
    let y_values: Vec<_> = placed_boxes
        .iter()
        .flat_map(|box_| {
            [
                box_.top - context.problem.clearance - height / 2.0,
                box_.bottom + context.problem.clearance + height / 2.0,
                (box_.top + box_.bottom) / 2.0,
            ]
        })
        .collect();
    let x_slots = slot_positions(
        context.problem.bounds.left + width / 2.0,
        context.problem.bounds.right - width / 2.0,
        &x_values,
    );
    let y_slots = slot_positions(
        context.problem.bounds.top + height / 2.0,
        context.problem.bounds.bottom - height / 2.0,
        &y_values,
    );
    for x in x_slots {
        for y in &y_slots {
            centers.push(Point { x, y: *y });
        }
    }
    for point in &mut centers {
        *point = snap_point(*point, context.problem.grid);
    }
    centers
}

fn edge_place_centers(
    primitive: &WorkingPrimitive,
    width: f64,
    height: f64,
    context: &Context,
) -> Vec<Point> {
    let Some(intent) = &primitive.primitive.edge_place else {
        return Vec::new();
    };
    let mut result = Vec::new();
    for edge in intent.edges.iter() {
        let inset = intent.inset.unwrap_or(0.0).max(0.0);
        for cross in edge_cross_coordinates(edge, width, height, intent, context) {
            let point = match edge.as_ref() {
                "left" => Point {
                    x: context.problem.full_board_bounds.left + inset + width / 2.0,
                    y: cross,
                },
                "right" => Point {
                    x: context.problem.full_board_bounds.right - inset - width / 2.0,
                    y: cross,
                },
                "top" => Point {
                    x: cross,
                    y: context.problem.full_board_bounds.top + inset + height / 2.0,
                },
                _ => Point {
                    x: cross,
                    y: context.problem.full_board_bounds.bottom - inset - height / 2.0,
                },
            };
            result.push(snap_point(point, context.problem.grid));
        }
    }
    result
}

fn edge_cross_coordinates(
    edge: &str,
    width: f64,
    height: f64,
    intent: &crate::model::EdgePlaceIntent,
    context: &Context,
) -> Vec<f64> {
    let offset = intent.offset.unwrap_or(0.0);
    let exact = if edge == "left" || edge == "right" {
        intent.y
    } else {
        intent.x
    };
    if let Some(exact) = exact {
        return vec![exact + offset];
    }
    let (min, max) = if edge == "left" || edge == "right" {
        (
            context.problem.bounds.top + height / 2.0,
            context.problem.bounds.bottom - height / 2.0,
        )
    } else {
        (
            context.problem.bounds.left + width / 2.0,
            context.problem.bounds.right - width / 2.0,
        )
    };
    if max < min {
        return vec![(min + max) / 2.0 + offset];
    }
    let start = min + offset;
    let end = max + offset;
    let center = (min + max) / 2.0 + offset;
    let preferred = match intent.align.as_deref() {
        Some("start") => start,
        Some("end") => end,
        _ => center,
    };
    let mut values = vec![preferred, center, start, end];
    for index in 1..8 {
        values.push(min + (max - min) * index as f64 / 8.0 + offset);
    }
    let mut seen = HashSet::new();
    values.retain(|value| value.is_finite() && seen.insert(value.clamp(min, max).to_bits()));
    for value in &mut values {
        *value = value.clamp(min, max);
    }
    values.sort_by(|a, b| compare_f64((a - preferred).abs(), (b - preferred).abs()));
    values
}

fn relation_slot_centers(
    primitive: &WorkingPrimitive,
    placed: &[WorkingPrimitive],
    context: &Context,
) -> Vec<Point> {
    let mut result = Vec::new();
    let primitive_center = box_center(&packing_box(primitive));
    for relation in &context.relations {
        if relation.skip {
            continue;
        }
        if let (Some(moving), Some(mut target)) = (
            endpoint_point(std::slice::from_ref(primitive), relation.from),
            endpoint_point(placed, relation.to),
        ) {
            apply_relation_target_offset(&mut target.0, relation);
            result.extend(endpoint_centers(
                primitive_center,
                moving.0,
                target.0,
                relation,
                context,
            ));
        }
        if let (Some(moving), Some(mut target)) = (
            endpoint_point(std::slice::from_ref(primitive), relation.to),
            endpoint_point(placed, relation.from),
        ) {
            apply_relation_target_offset(&mut target.0, relation);
            result.extend(endpoint_centers(
                primitive_center,
                moving.0,
                target.0,
                relation,
                context,
            ));
        }
    }
    for point in &mut result {
        *point = snap_point(*point, context.problem.grid);
    }
    result
}

fn apply_relation_target_offset(point: &mut Point, relation: &CompiledRelation) {
    if !relation.satellite_anchor {
        return;
    }
    if let Some(offset) = relation.anchor_offset {
        point.x = round_placement(point.x + offset.x);
        point.y = round_placement(point.y + offset.y);
    }
}

fn endpoint_centers(
    center: Point,
    moving: Point,
    target: Point,
    relation: &CompiledRelation,
    context: &Context,
) -> Vec<Point> {
    let offset = Point {
        x: moving.x - center.x,
        y: moving.y - center.y,
    };
    let clearance = context
        .problem
        .clearance
        .max(relation.min_distance.unwrap_or(0.0));
    let directions: Vec<Point> = match relation.side {
        Some(Side::Left) => vec![
            Point { x: -1.0, y: 0.0 },
            Point { x: 0.0, y: 1.0 },
            Point { x: 0.0, y: -1.0 },
            Point { x: 1.0, y: 0.0 },
        ],
        Some(Side::Right) => vec![
            Point { x: 1.0, y: 0.0 },
            Point { x: 0.0, y: 1.0 },
            Point { x: 0.0, y: -1.0 },
            Point { x: -1.0, y: 0.0 },
        ],
        Some(Side::Top) => vec![
            Point { x: 0.0, y: -1.0 },
            Point { x: 1.0, y: 0.0 },
            Point { x: -1.0, y: 0.0 },
            Point { x: 0.0, y: 1.0 },
        ],
        Some(Side::Bottom) => vec![
            Point { x: 0.0, y: 1.0 },
            Point { x: 1.0, y: 0.0 },
            Point { x: -1.0, y: 0.0 },
            Point { x: 0.0, y: -1.0 },
        ],
        _ => vec![
            Point { x: 1.0, y: 0.0 },
            Point { x: -1.0, y: 0.0 },
            Point { x: 0.0, y: 1.0 },
            Point { x: 0.0, y: -1.0 },
            Point { x: 0.0, y: 0.0 },
        ],
    };
    directions
        .into_iter()
        .map(|direction| Point {
            x: target.x + direction.x * clearance - offset.x,
            y: target.y + direction.y * clearance - offset.y,
        })
        .collect()
}

fn coarse_grid_centers(width: f64, height: f64, bounds: &Box2, grid: f64) -> Vec<Point> {
    let left = bounds.left + width / 2.0;
    let right = bounds.right - width / 2.0;
    let top = bounds.top + height / 2.0;
    let bottom = bounds.bottom - height / 2.0;
    let mut result = Vec::with_capacity(49);
    for x in 0..7 {
        for y in 0..7 {
            result.push(snap_point(
                Point {
                    x: left + (right - left) * x as f64 / 6.0,
                    y: top + (bottom - top) * y as f64 / 6.0,
                },
                grid,
            ));
        }
    }
    result
}

fn endpoint_point(
    primitives: &[WorkingPrimitive],
    endpoint: CompiledEndpoint,
) -> Option<(Point, Option<u32>)> {
    match endpoint {
        CompiledEndpoint::Anchor(point) => Some((point, None)),
        CompiledEndpoint::Pad { primitive, point } => {
            let primitive = primitives.iter().find(|item| item.id == primitive)?;
            let point = primitive.primitive.connection_points.get(point)?;
            Some((
                Point {
                    x: point.x,
                    y: point.y,
                },
                Some(primitive.id),
            ))
        }
        CompiledEndpoint::Component {
            primitive,
            designator,
        } => {
            let primitive = primitives.iter().find(|item| item.id == primitive)?;
            let mut count = 0usize;
            let mut x = 0.0;
            let mut y = 0.0;
            for (index, point) in primitive.primitive.connection_points.iter().enumerate() {
                if primitive.point_component_ids[index] != Some(designator) {
                    continue;
                }
                count += 1;
                x += point.x;
                y += point.y;
            }
            let point = if count == 0 {
                box_center(&primitive.primitive.bbox)
            } else {
                Point {
                    x: round_placement(x / count as f64),
                    y: round_placement(y / count as f64),
                }
            };
            Some((point, Some(primitive.id)))
        }
        CompiledEndpoint::Primitive { primitive } => {
            let primitive = primitives.iter().find(|item| item.id == primitive)?;
            Some((box_center(&packing_box(primitive)), Some(primitive.id)))
        }
        CompiledEndpoint::Missing => None,
    }
}

fn compile_relations(
    problem: &BoardPackProblem,
    primitive_ids: &HashMap<Arc<str>, u32>,
    designator_ids: &HashMap<Arc<str>, u32>,
) -> Vec<CompiledRelation> {
    problem
        .relations
        .iter()
        .map(|relation| CompiledRelation {
            from: compile_endpoint(&relation.from, problem, primitive_ids, designator_ids),
            to: compile_endpoint(&relation.to, problem, primitive_ids, designator_ids),
            skip: relation.effect.as_ref() == "lock" || relation.kind.as_ref() == "net",
            hard: relation.hard,
            weight: relation_weight(relation),
            max_distance: relation.max_distance,
            min_distance: relation.min_distance,
            satellite_anchor: relation.satellite_anchor,
            anchor_offset: relation.anchor_offset,
            side: compile_side(relation.side_preference.as_deref()),
        })
        .collect()
}

fn compile_endpoint(
    endpoint: &str,
    problem: &BoardPackProblem,
    primitive_ids: &HashMap<Arc<str>, u32>,
    designator_ids: &HashMap<Arc<str>, u32>,
) -> CompiledEndpoint {
    if let Some(anchor) = endpoint.strip_prefix("anchor:") {
        return anchor_point(anchor, &problem.bounds)
            .map(CompiledEndpoint::Anchor)
            .unwrap_or(CompiledEndpoint::Missing);
    }
    if let Some(reference) = endpoint.strip_prefix("pad:") {
        for primitive in &problem.primitives {
            if let Some(point) = primitive
                .connection_points
                .iter()
                .position(|point| point.reference.as_ref() == reference)
            {
                return CompiledEndpoint::Pad {
                    primitive: primitive_ids[&primitive.id],
                    point,
                };
            }
        }
    }
    if let Some(designator) = endpoint.strip_prefix("component:") {
        for primitive in &problem.primitives {
            if primitive
                .placements
                .iter()
                .any(|placement| placement.designator.as_ref() == designator)
            {
                let Some(&designator) = designator_ids.get(designator) else {
                    break;
                };
                return CompiledEndpoint::Component {
                    primitive: primitive_ids[&primitive.id],
                    designator,
                };
            }
        }
    }
    let source = endpoint
        .strip_prefix("block:")
        .map(|name| format!("tree:block:{name}"))
        .or_else(|| {
            endpoint
                .strip_prefix("module:")
                .map(|name| format!("tree:module:{name}"))
        });
    if let Some(source) = source {
        for primitive in &problem.primitives {
            if primitive
                .source_node_ids
                .iter()
                .any(|id| id.as_ref() == source)
            {
                return CompiledEndpoint::Primitive {
                    primitive: primitive_ids[&primitive.id],
                };
            }
        }
    }
    CompiledEndpoint::Missing
}

fn compile_side(side: Option<&str>) -> Option<Side> {
    match side {
        Some("left") => Some(Side::Left),
        Some("right") => Some(Side::Right),
        Some("top") => Some(Side::Top),
        Some("bottom") => Some(Side::Bottom),
        _ => None,
    }
}

fn anchor_point(anchor: &str, bounds: &Box2) -> Option<Point> {
    if !anchor.starts_with("board.") {
        return None;
    }
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

fn seed_rank(primitive: &WorkingPrimitive, context: &Context) -> f64 {
    let area = box_area(&packing_box(primitive));
    let board_area = box_area(&context.problem.bounds).max(1.0);
    let relation_count = context
        .relations
        .iter()
        .filter(|relation| touches(primitive, relation.from) || touches(primitive, relation.to))
        .count();
    let label = primitive.primitive.label.to_ascii_lowercase();
    let label_weight = [
        "connector",
        "usb",
        "jack",
        "terminal",
        "mount",
        "hole",
        "power",
        "buck",
        "reg",
        "mcu",
        "core",
        "main",
    ]
    .iter()
    .any(|word| label.contains(word));
    (if primitive.primitive.locked {
        50_000.0
    } else {
        0.0
    }) + if primitive.primitive.edge_place.is_some() {
        20_000.0
    } else {
        0.0
    } + area / board_area * 8_000.0
        + primitive.primitive.width.max(primitive.primitive.height) * 45.0
        + relation_count as f64 * 90.0
        + if primitive.primitive.kind.as_ref() == "module" {
            700.0
        } else if primitive.primitive.kind.as_ref() == "block" {
            500.0
        } else {
            0.0
        }
        + if label_weight { 250.0 } else { 0.0 }
}

fn choose_next(state: &SearchState, context: &Context) -> usize {
    let mut best = 0;
    let mut best_rank = f64::NEG_INFINITY;
    for (index, primitive) in state.remaining.iter().enumerate() {
        let placed_relations = context
            .relations
            .iter()
            .filter(|relation| {
                (touches(primitive, relation.from) || touches(primitive, relation.to))
                    && state.placed.iter().any(|placed| {
                        touches(placed, relation.from) || touches(placed, relation.to)
                    })
            })
            .map(|relation| relation.weight)
            .sum::<f64>();
        let rank = seed_rank(primitive, context) + placed_relations * 80.0;
        if rank > best_rank {
            best = index;
            best_rank = rank;
        }
    }
    best
}

fn touches(primitive: &WorkingPrimitive, endpoint: CompiledEndpoint) -> bool {
    match endpoint {
        CompiledEndpoint::Pad {
            primitive: owner, ..
        }
        | CompiledEndpoint::Component {
            primitive: owner, ..
        }
        | CompiledEndpoint::Primitive { primitive: owner } => primitive.id == owner,
        CompiledEndpoint::Anchor(_) | CompiledEndpoint::Missing => false,
    }
}

fn relation_weight(relation: &Relation) -> f64 {
    let priority = match relation.priority.as_deref() {
        Some("critical") => 30.0,
        Some("high") => 16.0,
        Some("low") => 3.0,
        _ => 8.0,
    };
    let kind = match relation.kind.as_ref() {
        "critical_pair" => 2.5,
        "anchor" => 1.7,
        "edge" => 1.4,
        "island_target" => 1.6,
        _ => 1.0,
    };
    let effect = match relation.effect.as_ref() {
        "move_both" => 1.2,
        "move_from" => 1.0,
        _ => 0.4,
    };
    priority
        * kind
        * effect
        * relation
            .weight
            .map(|weight| (weight / 70.0).max(0.25))
            .unwrap_or(1.0)
}

fn distance_limit_penalty(relation: &CompiledRelation, value: f64, weight: f64) -> f64 {
    let multiplier = if relation.hard { 5.0 } else { 1.0 };
    let mut penalty = 0.0;
    if let Some(max) = relation.max_distance {
        let excess = (value - max).max(0.0);
        penalty += (excess.powi(2) * 1500.0 + excess * 120.0) * weight * multiplier;
    }
    if let Some(min) = relation.min_distance {
        let shortage = (min - value).max(0.0);
        penalty += (shortage.powi(2) * 800.0 + shortage * 80.0) * weight * multiplier;
    }
    penalty.min(250_000.0)
}

fn side_penalty(side: Side, from: Point, to: Point, weight: f64) -> f64 {
    let dx = from.x - to.x;
    let dy = from.y - to.y;
    let length = (dx * dx + dy * dy).sqrt();
    let actual = if length > 0.000001 {
        Point {
            x: dx / length,
            y: dy / length,
        }
    } else {
        Point { x: 0.0, y: 0.0 }
    };
    let desired = match side {
        Side::Left => Point { x: -1.0, y: 0.0 },
        Side::Right => Point { x: 1.0, y: 0.0 },
        Side::Top => Point { x: 0.0, y: -1.0 },
        Side::Bottom => Point { x: 0.0, y: 1.0 },
    };
    (1.0 - actual.x * desired.x - actual.y * desired.y).max(0.0) * weight * 120.0
}

fn fit_to_bounds(primitive: &mut WorkingPrimitive, context: &Context) {
    let box_ = packing_box(primitive);
    let base = if let Some(intent) = &primitive.primitive.edge_place {
        inset_box(
            &context.problem.full_board_bounds,
            intent.inset.unwrap_or(0.0).max(0.0),
        )
    } else {
        context.problem.bounds
    };
    let full = context.problem.full_board_bounds;
    let overflow = primitive.components.iter().fold(
        crate::model::BoardOverflow::default(),
        |mut result, (_, component)| {
            result.left = result.left.max(component.board_overflow.left);
            result.right = result.right.max(component.board_overflow.right);
            result.top = result.top.max(component.board_overflow.top);
            result.bottom = result.bottom.max(component.board_overflow.bottom);
            result
        },
    );
    let bounds = Box2 {
        left: if overflow.left > 0.0 {
            full.left - overflow.left
        } else {
            base.left
        },
        right: if overflow.right > 0.0 {
            full.right + overflow.right
        } else {
            base.right
        },
        top: if overflow.top > 0.0 {
            full.top - overflow.top
        } else {
            base.top
        },
        bottom: if overflow.bottom > 0.0 {
            full.bottom + overflow.bottom
        } else {
            base.bottom
        },
    };
    let dx = if box_.left < bounds.left {
        bounds.left - box_.left
    } else if box_.right > bounds.right {
        bounds.right - box_.right
    } else {
        0.0
    };
    let dy = if box_.top < bounds.top {
        bounds.top - box_.top
    } else if box_.bottom > bounds.bottom {
        bounds.bottom - box_.bottom
    } else {
        0.0
    };
    if dx != 0.0 || dy != 0.0 {
        translate_primitive(primitive, round_placement(dx), round_placement(dy));
    }
}

fn slot_positions(min: f64, max: f64, values: &[f64]) -> Vec<f64> {
    if max < min {
        return Vec::new();
    }
    let center = (min + max) / 2.0;
    let mut result = vec![min, max, center];
    result.extend(values.iter().copied());
    let mut seen = HashSet::new();
    result.retain(|value| {
        value.is_finite() && seen.insert(round_placement(value.clamp(min, max)).to_bits())
    });
    for value in &mut result {
        *value = round_placement(value.clamp(min, max));
    }
    result.sort_by(|a, b| compare_f64((a - center).abs(), (b - center).abs()));
    result.truncate(18);
    result
}

fn move_packing_center(primitive: &mut WorkingPrimitive, center: Point) {
    let current = box_center(&packing_box(primitive));
    translate_primitive(
        primitive,
        round_placement(center.x - current.x),
        round_placement(center.y - current.y),
    );
}

fn packing_boxes(primitive: &WorkingPrimitive) -> &[Box2] {
    &primitive.primitive.collision_boxes
}
fn packing_box(primitive: &WorkingPrimitive) -> Box2 {
    union_boxes(packing_boxes(primitive))
}
fn inset_box(box_: &Box2, value: f64) -> Box2 {
    Box2 {
        left: box_.left + value,
        right: box_.right - value,
        top: box_.top + value,
        bottom: box_.bottom - value,
    }
}
fn box_area(box_: &Box2) -> f64 {
    (box_.right - box_.left).max(0.0) * (box_.bottom - box_.top).max(0.0)
}
fn snap_point(point: Point, grid: f64) -> Point {
    if grid <= 0.0 {
        Point {
            x: round_placement(point.x),
            y: round_placement(point.y),
        }
    } else {
        Point {
            x: round_placement(crate::geometry::js_round(point.x / grid) * grid),
            y: round_placement(crate::geometry::js_round(point.y / grid) * grid),
        }
    }
}

fn dedupe_points(points: &mut Vec<Point>) {
    let mut seen = HashSet::new();
    points.retain(|point| seen.insert((number_key(point.x), number_key(point.y))));
}
fn dedupe_candidates(candidates: &mut Vec<RankedCandidate>) {
    let mut seen = HashSet::new();
    candidates.retain(|candidate| seen.insert(primitive_key(&candidate.primitive)));
}
fn dedupe_states(states: Vec<SearchState>) -> Vec<SearchState> {
    let mut seen = HashSet::new();
    states
        .into_iter()
        .filter(|state| {
            let mut keys: Vec<_> = state.placed.iter().map(primitive_key).collect();
            keys.sort();
            let mut remaining: Vec<_> = state
                .remaining
                .iter()
                .map(|primitive| primitive.id)
                .collect();
            remaining.sort();
            seen.insert(SearchStateKey {
                remaining,
                placed: keys,
            })
        })
        .collect()
}
fn primitive_key(primitive: &WorkingPrimitive) -> PrimitiveKey {
    let mut placements: Vec<_> = primitive
        .primitive
        .placements
        .iter()
        .zip(primitive.placement_ids.iter())
        .map(|(placement, designator)| PlacementKey {
            designator: *designator,
            x: number_key(placement.x),
            y: number_key(placement.y),
            rotation: placement.rotate,
            layer: layer_key(&placement.layer),
        })
        .collect();
    placements.sort();
    PrimitiveKey {
        id: primitive.id,
        left: number_key(primitive.primitive.bbox.left),
        top: number_key(primitive.primitive.bbox.top),
        right: number_key(primitive.primitive.bbox.right),
        bottom: number_key(primitive.primitive.bbox.bottom),
        placements,
    }
}

fn lexical_ids(values: impl IntoIterator<Item = Arc<str>>) -> HashMap<Arc<str>, u32> {
    let values: BTreeSet<_> = values.into_iter().collect();
    values
        .into_iter()
        .enumerate()
        .map(|(index, value)| (value, index as u32))
        .collect()
}

fn number_key(value: f64) -> u64 {
    if value == 0.0 {
        0
    } else {
        value.to_bits()
    }
}

fn pose_key(primitive: &WorkingPrimitive) -> PoseKey {
    PoseKey {
        primitive: primitive.id,
        rotation: primitive.rotation,
        left: number_key(primitive.primitive.bbox.left),
        top: number_key(primitive.primitive.bbox.top),
    }
}

fn pose_pair_key(a: &WorkingPrimitive, b: &WorkingPrimitive) -> PosePairKey {
    let a = pose_key(a);
    let b = pose_key(b);
    if a <= b {
        PosePairKey(a, b)
    } else {
        PosePairKey(b, a)
    }
}

fn cache_insert<K, V>(cache: &RefCell<HashMap<K, V>>, key: K, value: V)
where
    K: Eq + std::hash::Hash,
{
    let mut cache = cache.borrow_mut();
    if cache.len() < GEOMETRY_CACHE_LIMIT {
        cache.insert(key, value);
    }
}

fn layer_key(layer: &str) -> u8 {
    match layer {
        "top" => 0,
        "bottom" => 1,
        "multi" => 2,
        _ => 3,
    }
}
fn candidate_limit(search_width: usize, remaining: usize) -> usize {
    28.max(120.min((search_width * 3).div_ceil(remaining.max(1))))
}
fn compare_f64(a: f64, b: f64) -> Ordering {
    a.partial_cmp(&b).unwrap_or(Ordering::Equal)
}
fn compare_rank(a: &Rank, b: &Rank) -> Ordering {
    a.hard_count
        .cmp(&b.hard_count)
        .then_with(|| compare_f64(a.hard_severity, b.hard_severity))
        .then_with(|| compare_f64(a.score, b.score))
}
fn compare_states(a: &SearchState, b: &SearchState) -> Ordering {
    compare_rank(&a.rank, &b.rank).then(a.ordinal.cmp(&b.ordinal))
}
fn compare_candidates(a: &RankedCandidate, b: &RankedCandidate) -> Ordering {
    compare_rank(&a.rank, &b.rank).then(a.ordinal.cmp(&b.ordinal))
}
