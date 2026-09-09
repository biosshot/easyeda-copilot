use crate::geometry::{round_placement, Point};
use crate::model::{PathPort, Primitive, Relation};
use serde::Serialize;
use std::collections::BTreeMap;

#[derive(Clone, Copy)]
struct PathMetadata {
    straight: bool,
    priority: u8,
    weight: f64,
    prefer_facing_pads: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopologyEvaluation {
    pub path_id: String,
    pub shape: &'static str,
    pub resolved_points: usize,
    pub first_order: i32,
    pub last_order: i32,
    pub direct_distance: f64,
    pub path_distance: f64,
    pub detour: f64,
    pub backtrack: f64,
    pub turns: f64,
    pub facing: f64,
    pub penalty: f64,
}

pub fn topology_penalty(primitives: &[&Primitive], relations: &[Relation]) -> f64 {
    let metadata = path_metadata(relations);
    let mut ports_by_path: BTreeMap<&str, Vec<&PathPort>> = BTreeMap::new();
    for primitive in primitives {
        for port in primitive.path_ports.iter() {
            ports_by_path
                .entry(port.path_id.as_ref())
                .or_default()
                .push(port);
        }
    }
    ports_by_path
        .into_iter()
        .filter_map(|(path_id, ports)| {
            evaluate_path_ports(path_id, &ports, metadata.get(path_id).copied())
        })
        .map(|evaluation| evaluation.penalty)
        .sum()
}

pub fn topology_penalty_for_ports(
    ports: &[PathPort],
    straight: bool,
    priority: &str,
    weight: f64,
    prefer_facing_pads: bool,
) -> f64 {
    let refs: Vec<_> = ports.iter().collect();
    evaluate_path_ports(
        "",
        &refs,
        Some(PathMetadata {
            straight,
            priority: match priority {
                "critical" => 3,
                "high" => 2,
                "low" => 0,
                _ => 1,
            },
            weight,
            prefer_facing_pads,
        }),
    )
    .map(|evaluation| evaluation.penalty)
    .unwrap_or(0.0)
}

pub fn evaluate_ports(
    path_id: &str,
    ports: &[PathPort],
    straight: bool,
    priority: &str,
    weight: f64,
    prefer_facing_pads: bool,
) -> Option<TopologyEvaluation> {
    let refs: Vec<_> = ports.iter().collect();
    evaluate_path_ports(
        path_id,
        &refs,
        Some(PathMetadata {
            straight,
            priority: match priority {
                "critical" => 3,
                "high" => 2,
                "low" => 0,
                _ => 1,
            },
            weight,
            prefer_facing_pads,
        }),
    )
}

pub fn bridge_deltas(moving: &Primitive, placed: &[&Primitive]) -> Vec<Point> {
    let placed_ports: Vec<_> = placed
        .iter()
        .flat_map(|primitive| primitive.path_ports.iter().cloned())
        .collect();
    bridge_deltas_for_ports(&moving.path_ports, &placed_ports)
}

pub fn bridge_deltas_for_ports(moving_ports: &[PathPort], placed_ports: &[PathPort]) -> Vec<Point> {
    let mut moving_by_path: BTreeMap<&str, Vec<&PathPort>> = BTreeMap::new();
    for port in moving_ports {
        moving_by_path
            .entry(port.path_id.as_ref())
            .or_default()
            .push(port);
    }
    let mut placed_by_path: BTreeMap<&str, Vec<&PathPort>> = BTreeMap::new();
    for port in placed_ports {
        placed_by_path
            .entry(port.path_id.as_ref())
            .or_default()
            .push(port);
    }

    let mut deltas = Vec::new();
    for (path_id, raw_moving_ports) in moving_by_path {
        let moving_ports = unique_ordered_ports(raw_moving_ports);
        let fixed_ports =
            unique_ordered_ports(placed_by_path.get(path_id).cloned().unwrap_or_default());
        if moving_ports.is_empty() || fixed_ports.len() < 2 {
            continue;
        }
        let first = moving_ports[0];
        let last = moving_ports[moving_ports.len() - 1];
        let before = fixed_ports
            .iter()
            .copied()
            .filter(|port| port.order < first.order)
            .next_back();
        let after = fixed_ports
            .iter()
            .copied()
            .find(|port| port.order > last.order);
        let (Some(before), Some(after)) = (before, after) else {
            continue;
        };
        if after.order <= before.order {
            continue;
        }

        let desired_first = interpolate_by_order(before, after, first.order);
        let desired_last = interpolate_by_order(before, after, last.order);
        push_unique(
            &mut deltas,
            Point {
                x: ((desired_first.x - first.x) + (desired_last.x - last.x)) / 2.0,
                y: ((desired_first.y - first.y) + (desired_last.y - last.y)) / 2.0,
            },
        );

        let axis = normalize(Point {
            x: after.x - before.x,
            y: after.y - before.y,
        });
        let moving_mid = midpoint(first, last);
        let desired_mid = midpoint_points(&desired_first, &desired_last);
        let difference = Point {
            x: desired_mid.x - moving_mid.x,
            y: desired_mid.y - moving_mid.y,
        };
        let longitudinal = dot(&difference, &axis);
        push_unique(
            &mut deltas,
            Point {
                x: difference.x - axis.x * longitudinal,
                y: difference.y - axis.y * longitudinal,
            },
        );
    }
    deltas
}

pub fn rotate_normal(normal: &Point, angle: i32) -> Point {
    let radians = f64::from(angle).to_radians();
    let (sin, cos) = radians.sin_cos();
    Point {
        x: round_placement(normal.x * cos - normal.y * sin),
        y: round_placement(normal.x * sin + normal.y * cos),
    }
}

fn evaluate_path_ports(
    path_id: &str,
    raw_ports: &[&PathPort],
    metadata: Option<PathMetadata>,
) -> Option<TopologyEvaluation> {
    let ports = unique_ordered_ports(raw_ports.to_vec());
    if ports.len() < 3 {
        return None;
    }
    let first = ports[0];
    let last = ports[ports.len() - 1];
    let chord = Point {
        x: last.x - first.x,
        y: last.y - first.y,
    };
    let direct_distance = magnitude(&chord);
    if direct_distance < 0.001 {
        return None;
    }
    let axis = normalize(chord);
    let edges: Vec<Point> = ports
        .windows(2)
        .map(|pair| Point {
            x: pair[1].x - pair[0].x,
            y: pair[1].y - pair[0].y,
        })
        .filter(|edge| magnitude(edge) > 0.001)
        .collect();
    if edges.len() < 2 {
        return None;
    }

    let path_distance: f64 = edges.iter().map(magnitude).sum();
    let detour = (path_distance - direct_distance).max(0.0);
    let backtrack: f64 = edges.iter().map(|edge| (-dot(edge, &axis)).max(0.0)).sum();
    let turns: f64 = edges
        .windows(2)
        .map(|pair| (1.0 - dot(&normalize(pair[0]), &normalize(pair[1]))).max(0.0))
        .sum();
    let metadata = metadata.unwrap_or(PathMetadata {
        straight: false,
        priority: 1,
        weight: 1.0,
        prefer_facing_pads: false,
    });
    let facing = if metadata.prefer_facing_pads {
        routed_segment_facing_penalty(&ports)
    } else {
        0.0
    };
    let priority = match metadata.priority {
        3 => 1.8,
        2 => 1.35,
        0 => 0.65,
        _ => 1.0,
    };
    let shape_detour = if metadata.straight { 22.0 } else { 8.0 };
    let shape_turns = if metadata.straight { 18.0 } else { 5.0 };
    let penalty = round_placement(
        (detour * shape_detour + backtrack * 42.0 + turns * shape_turns + facing * 12.0)
            * priority
            * metadata.weight,
    );
    Some(TopologyEvaluation {
        path_id: path_id.to_owned(),
        shape: if metadata.straight {
            "straight"
        } else {
            "flexible"
        },
        resolved_points: ports.len(),
        first_order: first.order,
        last_order: last.order,
        direct_distance: round_placement(direct_distance),
        path_distance: round_placement(path_distance),
        detour: round_placement(detour),
        backtrack: round_placement(backtrack),
        turns: round_placement(turns),
        facing: round_placement(facing),
        penalty,
    })
}

fn routed_segment_facing_penalty(ports: &[&PathPort]) -> f64 {
    let by_order: BTreeMap<i32, &PathPort> = ports.iter().map(|port| (port.order, *port)).collect();
    let Some(max_order) = by_order.keys().next_back().copied() else {
        return 0.0;
    };
    let mut penalty = 0.0;
    for order in (0..=max_order).step_by(2) {
        let (Some(source), Some(target)) = (by_order.get(&order), by_order.get(&(order + 1)))
        else {
            continue;
        };
        let link = normalize(Point {
            x: target.x - source.x,
            y: target.y - source.y,
        });
        if magnitude(&link) < 0.001 {
            continue;
        }
        if magnitude(&source.normal) > 0.001 {
            penalty += (1.0 - dot(&normalize(source.normal), &link)).max(0.0);
        }
        if magnitude(&target.normal) > 0.001 {
            penalty += (1.0
                - dot(
                    &normalize(target.normal),
                    &Point {
                        x: -link.x,
                        y: -link.y,
                    },
                ))
            .max(0.0);
        }
    }
    penalty
}

fn unique_ordered_ports(mut ports: Vec<&PathPort>) -> Vec<&PathPort> {
    ports.sort_by(|a, b| {
        a.order
            .cmp(&b.order)
            .then_with(|| a.reference.cmp(&b.reference))
    });
    ports.dedup_by_key(|port| port.order);
    ports
}

fn path_metadata(relations: &[Relation]) -> BTreeMap<&str, PathMetadata> {
    let mut result = BTreeMap::new();
    for relation in relations {
        let Some(path_id) = relation.path_id.as_deref() else {
            continue;
        };
        let priority = match relation.priority.as_deref() {
            Some("critical") => 3,
            Some("high") => 2,
            Some("low") => 0,
            _ => 1,
        };
        let weight = relation
            .weight
            .filter(|value| value.is_finite())
            .map(|value| (value / 70.0).max(0.25))
            .unwrap_or(1.0);
        result
            .entry(path_id)
            .and_modify(|previous: &mut PathMetadata| {
                previous.straight |= relation.path_shape.as_deref() == Some("straight");
                previous.priority = previous.priority.max(priority);
                previous.weight = previous.weight.max(weight);
                previous.prefer_facing_pads |= relation.prefer_facing_pads;
            })
            .or_insert(PathMetadata {
                straight: relation.path_shape.as_deref() == Some("straight"),
                priority,
                weight,
                prefer_facing_pads: relation.prefer_facing_pads,
            });
    }
    result
}

fn interpolate_by_order(before: &PathPort, after: &PathPort, order: i32) -> Point {
    let ratio = f64::from(order - before.order) / f64::from(after.order - before.order);
    Point {
        x: before.x + (after.x - before.x) * ratio,
        y: before.y + (after.y - before.y) * ratio,
    }
}

fn midpoint(a: &PathPort, b: &PathPort) -> Point {
    Point {
        x: (a.x + b.x) / 2.0,
        y: (a.y + b.y) / 2.0,
    }
}

fn midpoint_points(a: &Point, b: &Point) -> Point {
    Point {
        x: (a.x + b.x) / 2.0,
        y: (a.y + b.y) / 2.0,
    }
}

fn normalize(point: Point) -> Point {
    let length = magnitude(&point);
    if length > 0.000001 {
        Point {
            x: point.x / length,
            y: point.y / length,
        }
    } else {
        Point { x: 0.0, y: 0.0 }
    }
}

fn magnitude(point: &Point) -> f64 {
    point.x.hypot(point.y)
}

fn dot(a: &Point, b: &Point) -> f64 {
    a.x * b.x + a.y * b.y
}

fn push_unique(points: &mut Vec<Point>, point: Point) {
    let rounded = Point {
        x: round_placement(point.x),
        y: round_placement(point.y),
    };
    if !points.iter().any(|existing| existing == &rounded) {
        points.push(rounded);
    }
}
