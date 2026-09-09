use crate::geometry::Point;
use crate::model::{PostPlaceNet, PostPlaceScoreProblem};
use crate::signal_path;

const EPSILON: f64 = 0.001;

#[derive(Clone, Copy)]
struct Segment {
    net: usize,
    a: Point,
    b: Point,
    length: f64,
    weight: f64,
}

pub fn score(problem: &PostPlaceScoreProblem) -> Result<f64, String> {
    validate(problem)?;
    let segments: Vec<_> = problem
        .nets
        .iter()
        .enumerate()
        .flat_map(|(index, net)| minimum_spanning_segments(index, net))
        .collect();
    let mut score = 0.0;
    for segment in &segments {
        score += segment.length * 10.0 * segment.weight;
        score += segment.length * segment.length * 0.35 * segment.weight;
    }
    score += crossing_penalty(&segments) * 180.0;

    for term in &problem.distances {
        let value = distance(term.source, term.target);
        score += value * term.weight;
        if let Some(max) = term.max {
            if value > max {
                score += (value - max).powi(2) * term.weight * 20.0;
            }
        }
        if let Some(min) = term.min {
            if value < min {
                score += (min - value).powi(2) * term.weight * 20.0;
            }
        }
    }
    for term in &problem.clearances {
        let gap = box_clearance_gap(&term.source, &term.target);
        if gap < term.minimum {
            score += (term.minimum - gap).powi(2) * term.weight * 20.0;
        }
    }
    score += problem.fixed_penalties.iter().sum::<f64>();
    for term in &problem.edges {
        let distance = match term.edge.as_ref() {
            "left" => (term.source.left - term.board.left).abs(),
            "right" => (term.board.right - term.source.right).abs(),
            "top" => (term.source.top - term.board.top).abs(),
            _ => (term.board.bottom - term.source.bottom).abs(),
        };
        score += distance * term.weight;
    }
    for path in &problem.paths {
        score += signal_path::topology_penalty_for_ports(
            &path.ports,
            path.shape.as_ref() == "straight",
            &path.priority,
            path.weight,
            path.prefer_facing_pads,
        ) * 20.0;
    }
    Ok(score)
}

fn minimum_spanning_segments(net_index: usize, net: &PostPlaceNet) -> Vec<Segment> {
    if net.points.len() < 2 {
        return Vec::new();
    }
    let mut connected = vec![false; net.points.len()];
    connected[0] = true;
    let mut connected_count = 1;
    let mut result = Vec::with_capacity(net.points.len() - 1);
    while connected_count < net.points.len() {
        let mut best: Option<(usize, usize, f64)> = None;
        for from in 0..net.points.len() {
            if !connected[from] {
                continue;
            }
            for to in 0..net.points.len() {
                if connected[to] {
                    continue;
                }
                let length = distance(net.points[from], net.points[to]);
                if best.is_none_or(|(best_from, best_to, best_length)| {
                    length < best_length - EPSILON
                        || ((length - best_length).abs() <= EPSILON
                            && (from, to) < (best_from, best_to))
                }) {
                    best = Some((from, to, length));
                }
            }
        }
        let Some((from, to, length)) = best else {
            break;
        };
        connected[to] = true;
        connected_count += 1;
        result.push(Segment {
            net: net_index,
            a: net.points[from],
            b: net.points[to],
            length,
            weight: net.weight,
        });
    }
    result
}

fn crossing_penalty(segments: &[Segment]) -> f64 {
    let mut penalty = 0.0;
    for a_index in 0..segments.len() {
        for b_index in (a_index + 1)..segments.len() {
            let a = segments[a_index];
            let b = segments[b_index];
            if a.net == b.net || share_endpoint(a, b) {
                continue;
            }
            if properly_intersect(a.a, a.b, b.a, b.b) {
                penalty += (a.weight * b.weight).sqrt();
            }
        }
    }
    penalty
}

fn properly_intersect(a: Point, b: Point, c: Point, d: Point) -> bool {
    let o1 = cross(a, b, c);
    let o2 = cross(a, b, d);
    let o3 = cross(c, d, a);
    let o4 = cross(c, d, b);
    ((o1 > EPSILON && o2 < -EPSILON) || (o1 < -EPSILON && o2 > EPSILON))
        && ((o3 > EPSILON && o4 < -EPSILON) || (o3 < -EPSILON && o4 > EPSILON))
}

fn share_endpoint(a: Segment, b: Segment) -> bool {
    [a.a, a.b].iter().any(|left| {
        [b.a, b.b]
            .iter()
            .any(|right| distance(*left, *right) < EPSILON)
    })
}

fn cross(a: Point, b: Point, c: Point) -> f64 {
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

fn distance(a: Point, b: Point) -> f64 {
    (a.x - b.x).hypot(a.y - b.y)
}

fn box_clearance_gap(a: &crate::geometry::Box2, b: &crate::geometry::Box2) -> f64 {
    let x_separation = (b.left - a.right).max(a.left - b.right);
    let y_separation = (b.top - a.bottom).max(a.top - b.bottom);
    x_separation.max(y_separation)
}

fn validate(problem: &PostPlaceScoreProblem) -> Result<(), String> {
    if problem.version != 1 {
        return Err(format!(
            "unsupported post-place score contract {}; expected 1",
            problem.version
        ));
    }
    let all_finite = problem.nets.iter().all(|net| {
        net.weight.is_finite()
            && net
                .points
                .iter()
                .all(|point| point.x.is_finite() && point.y.is_finite())
    }) && problem
        .fixed_penalties
        .iter()
        .all(|value| value.is_finite());
    if !all_finite {
        return Err("post-place score contains a non-finite value".into());
    }
    Ok(())
}
