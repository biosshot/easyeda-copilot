use crate::geometry::{round_placement, Box2, Point};
use crate::model::{PassiveIslandPlacement, PassiveIslandProblem, PassiveIslandSolution};
use smallvec::SmallVec;
use std::cmp::Ordering;
use std::collections::HashSet;

const PLACEMENT_EPSILON: f64 = 0.005;
const ROTATION_LIMIT: usize = 4096;

#[derive(Clone, Copy)]
enum Axis {
    X,
    Y,
}

#[derive(Clone)]
struct CandidatePlacement {
    component_id: usize,
    orientation_index: usize,
    x: f64,
    y: f64,
}

#[derive(Clone)]
struct BestCandidate {
    placements: Vec<CandidatePlacement>,
    score: f64,
    legal: bool,
}

pub fn solve(problem: PassiveIslandProblem) -> Result<PassiveIslandSolution, String> {
    let orders = candidate_orders(&problem);
    let mut best_legal: Option<BestCandidate> = None;
    let mut best_fallback: Option<BestCandidate> = None;
    let mut evaluated_variants = 0usize;

    for order in orders {
        for axis in [Axis::X, Axis::Y] {
            for rows in 1..=2usize.min(order.len()) {
                enumerate_rotation_combinations(&problem, &order, ROTATION_LIMIT, |orientations| {
                    let placements = place_grid(&problem, &order, orientations, axis, rows);
                    let legal = !has_overlap(&problem, &placements);
                    let score = score_variant(&problem, &placements, legal);
                    evaluated_variants += 1;
                    if is_better(&best_fallback, score) {
                        best_fallback = Some(BestCandidate {
                            placements: placements.clone(),
                            score,
                            legal,
                        });
                    }
                    if legal && is_better(&best_legal, score) {
                        best_legal = Some(BestCandidate {
                            placements,
                            score,
                            legal,
                        });
                    }
                });
            }
        }
    }

    let best = best_legal
        .or(best_fallback)
        .ok_or_else(|| "passive island generated no candidates".to_string())?;
    let bbox = placements_box(&problem, &best.placements);
    let dx = (bbox.left + bbox.right) / 2.0;
    let dy = (bbox.top + bbox.bottom) / 2.0;
    let placements = best
        .placements
        .iter()
        .map(|placement| {
            let orientation = orientation(&problem, placement);
            PassiveIslandPlacement {
                component_id: placement.component_id,
                x: round_placement(placement.x - dx),
                y: round_placement(placement.y - dy),
                rotation: orientation.rotation,
            }
        })
        .collect();

    Ok(PassiveIslandSolution {
        version: problem.version,
        placements,
        score: best.score,
        legal: best.legal,
        evaluated_variants,
    })
}

fn is_better(best: &Option<BestCandidate>, score: f64) -> bool {
    if best
        .as_ref()
        .is_none_or(|current| score.total_cmp(&current.score) == Ordering::Less)
    {
        return true;
    }
    false
}

fn candidate_orders(problem: &PassiveIslandProblem) -> Vec<Vec<usize>> {
    let original: Vec<_> = (0..problem.components.len()).collect();
    let mut reverse = original.clone();
    reverse.reverse();
    let mut sorted = original.clone();
    sorted.sort_by(|a, b| {
        has_net(problem, *b, problem.main_net_id)
            .cmp(&has_net(problem, *a, problem.main_net_id))
            .then_with(|| {
                problem.components[*a]
                    .designator
                    .cmp(&problem.components[*b].designator)
            })
    });
    let mut sorted_reverse = sorted.clone();
    sorted_reverse.reverse();
    let paired = paired_shared_net_order(problem, &sorted);
    let mut paired_reverse = paired.clone();
    paired_reverse.reverse();
    let interleaved = interleave_ends(&sorted);
    let mut interleaved_reverse = interleaved.clone();
    interleaved_reverse.reverse();
    unique_orders(vec![
        original,
        reverse,
        sorted,
        sorted_reverse,
        paired,
        paired_reverse,
        interleaved,
        interleaved_reverse,
    ])
}

fn paired_shared_net_order(problem: &PassiveIslandProblem, components: &[usize]) -> Vec<usize> {
    let mut pairs = Vec::with_capacity(components.len().saturating_mul(2));
    for i in 0..components.len() {
        for j in (i + 1)..components.len() {
            let shared = shared_nets(problem, components[i], components[j]).len();
            if shared >= 2 {
                pairs.push((components[i], components[j], shared));
            }
        }
    }
    pairs.sort_by(|a, b| {
        b.2.cmp(&a.2).then_with(|| {
            problem.components[a.0]
                .designator
                .cmp(&problem.components[b.0].designator)
        })
    });
    let mut remaining = vec![false; problem.components.len()];
    for component in components {
        remaining[*component] = true;
    }
    let mut order = Vec::with_capacity(components.len());
    for (a, b, _) in pairs {
        if !remaining[a] || !remaining[b] {
            continue;
        }
        order.push(a);
        order.push(b);
        remaining[a] = false;
        remaining[b] = false;
    }
    for component in components {
        if remaining[*component] {
            order.push(*component);
        }
    }
    if order.is_empty() {
        components.to_vec()
    } else {
        order
    }
}

fn interleave_ends(items: &[usize]) -> Vec<usize> {
    let mut result = Vec::with_capacity(items.len());
    let mut left = 0usize;
    let mut right = items.len().saturating_sub(1);
    while left <= right && left < items.len() {
        result.push(items[left]);
        if left != right {
            result.push(items[right]);
        }
        left += 1;
        if right == 0 {
            break;
        }
        right -= 1;
    }
    result
}

fn unique_orders(orders: Vec<Vec<usize>>) -> Vec<Vec<usize>> {
    let mut seen = HashSet::new();
    orders
        .into_iter()
        .filter(|order| seen.insert(order.clone()))
        .collect()
}

fn enumerate_rotation_combinations(
    problem: &PassiveIslandProblem,
    order: &[usize],
    limit: usize,
    mut visit: impl FnMut(&[usize]),
) {
    fn recurse(
        problem: &PassiveIslandProblem,
        order: &[usize],
        limit: usize,
        index: usize,
        current: &mut Vec<usize>,
        count: &mut usize,
        visit: &mut impl FnMut(&[usize]),
    ) {
        if *count >= limit {
            return;
        }
        if index == order.len() {
            visit(current);
            *count += 1;
            return;
        }
        for orientation_index in 0..problem.components[order[index]].orientations.len() {
            current.push(orientation_index);
            recurse(problem, order, limit, index + 1, current, count, visit);
            current.pop();
            if *count >= limit {
                break;
            }
        }
    }
    let mut current = Vec::with_capacity(order.len());
    let mut count = 0usize;
    recurse(
        problem,
        order,
        limit,
        0,
        &mut current,
        &mut count,
        &mut visit,
    );
}

fn place_grid(
    problem: &PassiveIslandProblem,
    order: &[usize],
    orientations: &[usize],
    axis: Axis,
    rows: usize,
) -> Vec<CandidatePlacement> {
    let max_per_row = order.len().div_ceil(rows);
    let mut row_sizes = Vec::with_capacity(rows);
    for row in 0..rows {
        let start = row * max_per_row;
        let end = order.len().min((row + 1) * max_per_row);
        if start >= end {
            continue;
        }
        let mut width: f64 = 0.0;
        let mut height: f64 = 0.0;
        for index in start..end {
            let orientation = &problem.components[order[index]].orientations[orientations[index]];
            match axis {
                Axis::X => {
                    width += orientation.width;
                    height = height.max(orientation.height);
                }
                Axis::Y => {
                    width = width.max(orientation.width);
                    height += orientation.height;
                }
            }
        }
        let gaps = problem.clearance * (end - start).saturating_sub(1) as f64;
        match axis {
            Axis::X => width += gaps,
            Axis::Y => height += gaps,
        }
        row_sizes.push((width, height));
    }

    let cross_total: f64 = row_sizes
        .iter()
        .map(|(width, height)| match axis {
            Axis::X => *height,
            Axis::Y => *width,
        })
        .sum();
    let mut cross_cursor =
        -cross_total / 2.0 - problem.clearance * row_sizes.len().saturating_sub(1) as f64 / 2.0;
    let mut placements = Vec::with_capacity(order.len());
    for (row, (row_width, row_height)) in row_sizes.iter().copied().enumerate() {
        let start = row * max_per_row;
        let end = order.len().min(start + max_per_row);
        let mut main_cursor = -match axis {
            Axis::X => row_width,
            Axis::Y => row_height,
        } / 2.0;
        let cross_size = match axis {
            Axis::X => row_height,
            Axis::Y => row_width,
        };
        let cross_center = cross_cursor + cross_size / 2.0;
        for index in start..end {
            let component_id = order[index];
            let orientation_index = orientations[index];
            let orientation = &problem.components[component_id].orientations[orientation_index];
            let main_size = match axis {
                Axis::X => orientation.width,
                Axis::Y => orientation.height,
            };
            let main_center = main_cursor + main_size / 2.0;
            placements.push(CandidatePlacement {
                component_id,
                orientation_index,
                x: round_placement(match axis {
                    Axis::X => main_center,
                    Axis::Y => cross_center,
                }),
                y: round_placement(match axis {
                    Axis::X => cross_center,
                    Axis::Y => main_center,
                }),
            });
            main_cursor += main_size + problem.clearance;
        }
        cross_cursor += cross_size + problem.clearance;
    }
    placements
}

fn score_variant(
    problem: &PassiveIslandProblem,
    placements: &[CandidatePlacement],
    legal: bool,
) -> f64 {
    let bbox = placements_box(problem, placements);
    let width = bbox.right - bbox.left;
    let height = bbox.bottom - bbox.top;
    let mut score = width * height * 2.0 + (width + height);
    if !legal {
        score += 1_000_000.0;
    }
    score += aspect_ratio_penalty(width, height);
    score += net_spread(problem, placements, problem.main_net_id) * 70.0;
    score += shared_net_spread_penalty(problem, placements);
    score += shared_component_net_pair_penalty(problem, placements);
    score += net_centroid_distance(problem, placements, problem.main_net_id) * 12.0;
    score
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
        (excess * excess) * width.min(height).max(1.0) * 220.0
    }
}

fn shared_net_spread_penalty(
    problem: &PassiveIslandProblem,
    placements: &[CandidatePlacement],
) -> f64 {
    let mut score = 0.0;
    let mut seen = vec![false; problem.net_names.len()];
    let mut nets = Vec::with_capacity(
        problem
            .net_names
            .len()
            .min(placements.len().saturating_mul(2)),
    );
    for placement in placements {
        for net in &problem.components[placement.component_id].pin_net_ids {
            if !seen[*net] {
                seen[*net] = true;
                nets.push(*net);
            }
        }
    }
    for net in nets {
        let points = net_points(problem, placements, net);
        if points.len() < 2 {
            continue;
        }
        let weight = if net == problem.main_net_id {
            22.0
        } else if problem.net_ground[net] {
            46.0
        } else {
            54.0
        };
        score += points_spread(&points) * weight;
        score += points_centroid_distance(&points) * weight * 0.25;
    }
    score
}

fn shared_component_net_pair_penalty(
    problem: &PassiveIslandProblem,
    placements: &[CandidatePlacement],
) -> f64 {
    let mut score = 0.0;
    for i in 0..placements.len() {
        for j in (i + 1)..placements.len() {
            let common_nets = shared_nets(
                problem,
                placements[i].component_id,
                placements[j].component_id,
            );
            if common_nets.is_empty() {
                continue;
            }
            let pair_weight = if common_nets.len() >= 2 { 220.0 } else { 18.0 };
            for net in &common_nets {
                let Some(a) = component_net_pad_point(problem, &placements[i], *net) else {
                    continue;
                };
                let Some(b) = component_net_pad_point(problem, &placements[j], *net) else {
                    continue;
                };
                let net_weight = if *net == problem.main_net_id {
                    1.15
                } else if problem.net_ground[*net] {
                    1.05
                } else {
                    1.0
                };
                let dx = a.x - b.x;
                let dy = a.y - b.y;
                let distance = (dx * dx + dy * dy).sqrt();
                score += distance * pair_weight * net_weight;
                if common_nets.len() >= 2 {
                    score += (distance * distance) * 32.0 * net_weight;
                }
            }
            if common_nets.len() >= 2 {
                score += shared_two_net_vector_penalty(
                    problem,
                    &placements[i],
                    &placements[j],
                    &common_nets,
                ) * 140.0;
            }
        }
    }
    score
}

fn shared_two_net_vector_penalty(
    problem: &PassiveIslandProblem,
    a: &CandidatePlacement,
    b: &CandidatePlacement,
    common_nets: &[usize],
) -> f64 {
    let mut nets = common_nets.to_vec();
    nets.sort_by(|left, right| {
        if *left == problem.main_net_id {
            Ordering::Less
        } else if *right == problem.main_net_id {
            Ordering::Greater
        } else {
            problem.net_names[*left].cmp(&problem.net_names[*right])
        }
    });
    let first = nets[0];
    let second = nets[1];
    let (Some(a_first), Some(a_second), Some(b_first), Some(b_second)) = (
        component_net_pad_point(problem, a, first),
        component_net_pad_point(problem, a, second),
        component_net_pad_point(problem, b, first),
        component_net_pad_point(problem, b, second),
    ) else {
        return 0.0;
    };
    let a_vector = normalize_vector(Point {
        x: a_second.x - a_first.x,
        y: a_second.y - a_first.y,
    });
    let b_vector = normalize_vector(Point {
        x: b_second.x - b_first.x,
        y: b_second.y - b_first.y,
    });
    let dx = a_vector.x - b_vector.x;
    let dy = a_vector.y - b_vector.y;
    (dx * dx + dy * dy).sqrt()
}

fn normalize_vector(vector: Point) -> Point {
    let length = (vector.x * vector.x + vector.y * vector.y).sqrt();
    if length <= 0.0001 {
        Point { x: 0.0, y: 0.0 }
    } else {
        Point {
            x: vector.x / length,
            y: vector.y / length,
        }
    }
}

fn has_overlap(problem: &PassiveIslandProblem, placements: &[CandidatePlacement]) -> bool {
    let count = problem.components.len();
    for i in 0..placements.len() {
        for j in (i + 1)..placements.len() {
            let a = &placements[i];
            let b = &placements[j];
            if problem.component_conflict[a.component_id * count + b.component_id] == 0 {
                continue;
            }
            let clearance =
                problem.component_pair_clearance[a.component_id * count + b.component_id];
            let a_component = &problem.components[a.component_id];
            let b_component = &problem.components[b.component_id];
            let a_orientation = orientation(problem, a);
            let b_orientation = orientation(problem, b);
            if a_component.layer == b_component.layer {
                if boxes_overlap(
                    &body_world_box(a_orientation, a),
                    &body_world_box(b_orientation, b),
                    clearance,
                ) {
                    return true;
                }
            } else {
                let a_body = body_world_box(a_orientation, a);
                let b_body = body_world_box(b_orientation, b);
                if b_orientation
                    .through_hole_boxes
                    .iter()
                    .any(|box_| boxes_overlap(&a_body, &world_box(box_, b), clearance))
                    || a_orientation
                        .through_hole_boxes
                        .iter()
                        .any(|box_| boxes_overlap(&world_box(box_, a), &b_body, clearance))
                {
                    return true;
                }
            }
        }
    }
    false
}

fn boxes_overlap(a: &Box2, b: &Box2, clearance: f64) -> bool {
    !(a.right + clearance - PLACEMENT_EPSILON < b.left
        || a.left - clearance + PLACEMENT_EPSILON > b.right
        || a.bottom + clearance - PLACEMENT_EPSILON < b.top
        || a.top - clearance + PLACEMENT_EPSILON > b.bottom)
}

fn placements_box(problem: &PassiveIslandProblem, placements: &[CandidatePlacement]) -> Box2 {
    let first = body_world_box(orientation(problem, &placements[0]), &placements[0]);
    placements
        .iter()
        .skip(1)
        .fold(first, |mut bbox, placement| {
            let box_ = body_world_box(orientation(problem, placement), placement);
            bbox.left = bbox.left.min(box_.left);
            bbox.right = bbox.right.max(box_.right);
            bbox.top = bbox.top.min(box_.top);
            bbox.bottom = bbox.bottom.max(box_.bottom);
            bbox
        })
}

fn world_box(box_: &Box2, placement: &CandidatePlacement) -> Box2 {
    Box2 {
        left: placement.x + box_.left,
        right: placement.x + box_.right,
        top: placement.y + box_.top,
        bottom: placement.y + box_.bottom,
    }
}

fn body_world_box(
    orientation: &crate::model::PassiveIslandOrientation,
    placement: &CandidatePlacement,
) -> Box2 {
    Box2 {
        left: placement.x - orientation.width / 2.0,
        right: placement.x + orientation.width / 2.0,
        top: placement.y - orientation.height / 2.0,
        bottom: placement.y + orientation.height / 2.0,
    }
}

fn net_spread(
    problem: &PassiveIslandProblem,
    placements: &[CandidatePlacement],
    net: usize,
) -> f64 {
    let points = net_points(problem, placements, net);
    if points.len() < 2 {
        0.0
    } else {
        points_spread(&points)
    }
}

fn net_centroid_distance(
    problem: &PassiveIslandProblem,
    placements: &[CandidatePlacement],
    net: usize,
) -> f64 {
    let points = net_points(problem, placements, net);
    points_centroid_distance(&points)
}

fn net_points(
    problem: &PassiveIslandProblem,
    placements: &[CandidatePlacement],
    net: usize,
) -> Vec<Point> {
    let mut points = Vec::with_capacity(placements.len().saturating_mul(2));
    for placement in placements {
        let component = &problem.components[placement.component_id];
        let orientation = orientation(problem, placement);
        for (index, pin_net) in component.pin_net_ids.iter().enumerate() {
            if *pin_net != net {
                continue;
            }
            if let Some(point) = orientation.pin_points[index] {
                points.push(Point {
                    x: placement.x + point.x,
                    y: placement.y + point.y,
                });
            }
        }
    }
    points
}

fn component_net_pad_point(
    problem: &PassiveIslandProblem,
    placement: &CandidatePlacement,
    net: usize,
) -> Option<Point> {
    let component = &problem.components[placement.component_id];
    let index = component
        .pin_net_ids
        .iter()
        .position(|pin_net| *pin_net == net)?;
    let point = orientation(problem, placement).pin_points[index]?;
    Some(Point {
        x: placement.x + point.x,
        y: placement.y + point.y,
    })
}

fn shared_nets(problem: &PassiveIslandProblem, a: usize, b: usize) -> SmallVec<[usize; 4]> {
    let a_nets = &problem.components[a].pin_net_ids;
    problem.components[b]
        .pin_net_ids
        .iter()
        .copied()
        .filter(|net| a_nets.contains(net))
        .collect()
}

fn has_net(problem: &PassiveIslandProblem, component: usize, net: usize) -> bool {
    problem.components[component].pin_net_ids.contains(&net)
}

fn points_spread(points: &[Point]) -> f64 {
    let mut left = points[0].x;
    let mut right = points[0].x;
    let mut top = points[0].y;
    let mut bottom = points[0].y;
    for point in &points[1..] {
        left = left.min(point.x);
        right = right.max(point.x);
        top = top.min(point.y);
        bottom = bottom.max(point.y);
    }
    (right - left) + (bottom - top)
}

fn points_centroid_distance(points: &[Point]) -> f64 {
    if points.len() < 2 {
        return 0.0;
    }
    let mut sum_x = 0.0;
    let mut sum_y = 0.0;
    for point in points {
        sum_x += point.x;
        sum_y += point.y;
    }
    let center_x = sum_x / points.len() as f64;
    let center_y = sum_y / points.len() as f64;
    points
        .iter()
        .map(|point| {
            let dx = point.x - center_x;
            let dy = point.y - center_y;
            (dx * dx + dy * dy).sqrt()
        })
        .sum()
}

fn orientation<'a>(
    problem: &'a PassiveIslandProblem,
    placement: &CandidatePlacement,
) -> &'a crate::model::PassiveIslandOrientation {
    &problem.components[placement.component_id].orientations[placement.orientation_index]
}
