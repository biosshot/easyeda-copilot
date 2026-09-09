use crate::geometry::{is_finite_box, is_finite_point, Box2, Point};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardPackProblem {
    pub version: u32,
    pub grid: f64,
    pub clearance: f64,
    pub search_width: usize,
    pub compactness: Arc<str>,
    pub bounds: Box2,
    pub full_board_bounds: Box2,
    pub board_outline: Vec<Point>,
    pub edge_clearance: f64,
    pub primitives: Vec<Primitive>,
    pub relations: Vec<Relation>,
    pub obstacles: Vec<Box2>,
    pub constraint_regions: Vec<ConstraintRegion>,
    pub components: Vec<ComponentGeometry>,
    pub component_pair_clearance: Vec<f64>,
    pub component_conflict: Vec<u8>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Primitive {
    pub id: Arc<str>,
    pub kind: Arc<str>,
    pub label: Arc<str>,
    pub source_node_id: Arc<str>,
    pub source_node_ids: Arc<Vec<Arc<str>>>,
    pub locked: bool,
    pub can_rotate: bool,
    pub allowed_orientations: Arc<Vec<i32>>,
    pub bbox: Box2,
    pub collision_boxes: Arc<Vec<Box2>>,
    pub width: f64,
    pub height: f64,
    pub placements: Arc<Vec<Placement>>,
    pub connection_points: Arc<Vec<ConnectionPoint>>,
    #[serde(default)]
    pub path_ports: Arc<Vec<PathPort>>,
    pub edge_place: Option<EdgePlaceIntent>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Placement {
    pub designator: Arc<str>,
    pub x: f64,
    pub y: f64,
    pub rotate: i32,
    pub layer: Arc<str>,
    pub score: f64,
}

#[derive(Clone, Debug, Deserialize)]
pub struct ConnectionPoint {
    pub x: f64,
    pub y: f64,
    #[serde(rename = "ref")]
    pub reference: Arc<str>,
    pub net: Option<Arc<str>>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathPort {
    pub x: f64,
    pub y: f64,
    pub path_id: Arc<str>,
    pub order: i32,
    #[serde(rename = "ref")]
    pub reference: Arc<str>,
    pub role: Arc<str>,
    pub normal: Point,
}

#[derive(Clone, Debug, Deserialize)]
pub struct EdgePlaceIntent {
    pub edges: Arc<Vec<Arc<str>>>,
    pub inset: Option<f64>,
    pub align: Option<Arc<str>>,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub offset: Option<f64>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Relation {
    pub id: Arc<str>,
    pub kind: Arc<str>,
    pub from: Arc<str>,
    pub to: Arc<str>,
    pub relation: Option<Arc<str>>,
    pub priority: Option<Arc<str>>,
    pub hard: bool,
    pub weight: Option<f64>,
    pub effect: Arc<str>,
    pub max_distance: Option<f64>,
    pub min_distance: Option<f64>,
    pub satellite_anchor: bool,
    pub anchor_offset: Option<Point>,
    pub side_preference: Option<Arc<str>>,
    pub path_id: Option<Arc<str>>,
    pub path_shape: Option<Arc<str>>,
    #[serde(default)]
    pub prefer_facing_pads: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConstraintRegion {
    pub name: Arc<str>,
    #[serde(rename = "box")]
    pub box_: Box2,
    pub layers: Vec<Arc<str>>,
    pub allow_blocks: Vec<Arc<str>>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComponentGeometry {
    pub designator: Arc<str>,
    pub primitive_id: Arc<str>,
    pub block_name: Arc<str>,
    pub layer: Arc<str>,
    pub body_box: Box2,
    pub through_hole_boxes: Arc<Vec<Box2>>,
    #[serde(default)]
    pub board_overflow: BoardOverflow,
    #[serde(default)]
    pub edge_clearance: f64,
}

#[derive(Clone, Copy, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardOverflow {
    pub left: f64,
    pub right: f64,
    pub top: f64,
    pub bottom: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockComponentGeometry {
    pub designator: Arc<str>,
    pub primitive_id: Arc<str>,
    pub block_name: Arc<str>,
    pub layer: Arc<str>,
    pub body_box: Box2,
    pub through_hole_boxes: Arc<Vec<Box2>>,
    pub pin_count: usize,
    pub role: Option<Arc<str>>,
    pub power_component: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockSolveProblem {
    pub version: u32,
    pub grid: f64,
    pub clearance: f64,
    pub search_width: usize,
    pub compactness: Arc<str>,
    pub target_width: Option<f64>,
    pub target_height: Option<f64>,
    pub bounds: Option<Box2>,
    pub collision_mode: Arc<str>,
    pub hard_collision_mode: Arc<str>,
    pub candidate_box_mode: Arc<str>,
    pub primitives: Vec<Primitive>,
    pub relations: Vec<Relation>,
    pub obstacles: Vec<Box2>,
    pub components: Vec<BlockComponentGeometry>,
    pub component_pair_clearance: Vec<f64>,
    pub component_conflict: Vec<u8>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PassiveIslandProblem {
    pub version: u32,
    pub grid: f64,
    pub clearance: f64,
    pub main_net_id: usize,
    pub net_names: Vec<Arc<str>>,
    pub net_ground: Vec<bool>,
    pub components: Vec<PassiveIslandComponent>,
    pub component_pair_clearance: Vec<f64>,
    pub component_conflict: Vec<u8>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PassiveIslandComponent {
    pub id: usize,
    pub designator: Arc<str>,
    pub layer: Arc<str>,
    pub pin_net_ids: Vec<usize>,
    pub orientations: Vec<PassiveIslandOrientation>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PassiveIslandOrientation {
    pub rotation: i32,
    pub width: f64,
    pub height: f64,
    pub body_box: Box2,
    pub through_hole_boxes: Vec<Box2>,
    pub pin_points: Vec<Option<Point>>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PassiveIslandSolution {
    pub version: u32,
    pub placements: Vec<PassiveIslandPlacement>,
    pub score: f64,
    pub legal: bool,
    pub evaluated_variants: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PassiveIslandPlacement {
    pub component_id: usize,
    pub x: f64,
    pub y: f64,
    pub rotation: i32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostPlaceScoreProblem {
    pub version: u32,
    pub nets: Vec<PostPlaceNet>,
    pub distances: Vec<PostPlaceDistance>,
    pub clearances: Vec<PostPlaceClearance>,
    pub fixed_penalties: Vec<f64>,
    pub edges: Vec<PostPlaceEdge>,
    pub paths: Vec<PostPlacePath>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostPlaceNet {
    pub name: Arc<str>,
    pub points: Vec<Point>,
    pub weight: f64,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostPlaceDistance {
    pub source: Point,
    pub target: Point,
    pub weight: f64,
    pub min: Option<f64>,
    pub max: Option<f64>,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostPlaceClearance {
    pub source: Box2,
    pub target: Box2,
    pub minimum: f64,
    pub weight: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostPlaceEdge {
    pub source: Box2,
    pub board: Box2,
    pub edge: Arc<str>,
    pub weight: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostPlacePath {
    pub path_id: Arc<str>,
    pub ports: Vec<PathPort>,
    pub shape: Arc<str>,
    pub priority: Arc<str>,
    pub weight: f64,
    pub prefer_facing_pads: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignalPathEvaluationProblem {
    pub version: u32,
    pub path_id: Arc<str>,
    pub ports: Vec<PathPort>,
    pub shape: Arc<str>,
    pub priority: Arc<str>,
    pub weight: f64,
    pub prefer_facing_pads: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignalPathBridgeProblem {
    pub version: u32,
    pub moving_ports: Vec<PathPort>,
    pub placed_ports: Vec<PathPort>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardPackSolution {
    pub version: u32,
    pub states: Vec<PrimitiveState>,
    pub rank: Rank,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimitiveState {
    pub primitive_id: Arc<str>,
    pub rotation: i32,
    pub translation_x: f64,
    pub translation_y: f64,
    pub placements: Vec<Placement>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Rank {
    pub hard_count: usize,
    pub hard_severity: f64,
    pub score: f64,
}

impl BoardPackProblem {
    pub fn validate(&self, expected_version: u32) -> std::result::Result<(), String> {
        if self.version != expected_version {
            return Err(format!(
                "unsupported contract {}; expected {expected_version}",
                self.version
            ));
        }
        finite(self.grid, "grid")?;
        finite(self.clearance, "clearance")?;
        finite(self.edge_clearance, "edgeClearance")?;
        if self.search_width == 0 {
            return Err("searchWidth must be positive".into());
        }
        if self.compactness.as_ref() != "normal" && self.compactness.as_ref() != "high" {
            return Err(format!("unsupported compactness {}", self.compactness));
        }
        if !is_finite_box(&self.bounds) || !is_finite_box(&self.full_board_bounds) {
            return Err("board bounds contain non-finite values".into());
        }
        if self
            .board_outline
            .iter()
            .any(|point| !is_finite_point(point))
        {
            return Err("board outline contains non-finite values".into());
        }
        let component_count = self.components.len();
        let matrix_size = component_count * component_count;
        if self.component_pair_clearance.len() != matrix_size
            || self.component_conflict.len() != matrix_size
        {
            return Err(format!(
                "component matrices must contain {matrix_size} entries for {component_count} components"
            ));
        }
        if self
            .component_pair_clearance
            .iter()
            .any(|value| !value.is_finite())
        {
            return Err("component clearance matrix contains non-finite values".into());
        }
        for primitive in &self.primitives {
            primitive.validate()?;
        }
        for obstacle in &self.obstacles {
            if !is_finite_box(obstacle) {
                return Err("obstacle contains non-finite values".into());
            }
        }
        for component in &self.components {
            if !is_finite_box(&component.body_box)
                || component
                    .through_hole_boxes
                    .iter()
                    .any(|box_| !is_finite_box(box_))
                || !component.edge_clearance.is_finite()
                || component.edge_clearance < 0.0
                || !component.board_overflow.left.is_finite()
                || !component.board_overflow.right.is_finite()
                || !component.board_overflow.top.is_finite()
                || !component.board_overflow.bottom.is_finite()
                || component.board_overflow.left < 0.0
                || component.board_overflow.right < 0.0
                || component.board_overflow.top < 0.0
                || component.board_overflow.bottom < 0.0
            {
                return Err(format!(
                    "component {} contains non-finite geometry",
                    component.designator
                ));
            }
        }
        Ok(())
    }
}

impl BlockSolveProblem {
    pub fn validate(&self, expected_version: u32) -> std::result::Result<(), String> {
        if self.version != expected_version {
            return Err(format!(
                "unsupported block contract {}; expected {expected_version}",
                self.version
            ));
        }
        finite(self.grid, "grid")?;
        finite(self.clearance, "clearance")?;
        if self.search_width == 0 {
            return Err("searchWidth must be positive".into());
        }
        if self.compactness.as_ref() != "normal" && self.compactness.as_ref() != "high" {
            return Err(format!("unsupported compactness {}", self.compactness));
        }
        if let Some(bounds) = &self.bounds {
            if !is_finite_box(bounds) {
                return Err("block bounds contain non-finite values".into());
            }
        }
        let count = self.components.len();
        let matrix_size = count * count;
        if self.component_pair_clearance.len() != matrix_size
            || self.component_conflict.len() != matrix_size
        {
            return Err(format!(
                "component matrices must contain {matrix_size} entries for {count} components"
            ));
        }
        for primitive in &self.primitives {
            primitive.validate()?;
        }
        Ok(())
    }
}

impl PassiveIslandProblem {
    pub fn validate(&self, expected_version: u32) -> std::result::Result<(), String> {
        if self.version != expected_version {
            return Err(format!(
                "unsupported passive island contract {}; expected {expected_version}",
                self.version
            ));
        }
        finite(self.grid, "grid")?;
        finite(self.clearance, "clearance")?;
        if self.main_net_id >= self.net_names.len() || self.net_names.len() != self.net_ground.len()
        {
            return Err("passive island net metadata is inconsistent".into());
        }
        if self.components.len() < 2 || self.components.len() > 12 {
            return Err("passive island must contain 2..12 components".into());
        }
        let count = self.components.len();
        let matrix_size = count * count;
        if self.component_pair_clearance.len() != matrix_size
            || self.component_conflict.len() != matrix_size
        {
            return Err(format!(
                "component matrices must contain {matrix_size} entries for {count} components"
            ));
        }
        if self
            .component_pair_clearance
            .iter()
            .any(|value| !value.is_finite())
        {
            return Err("passive island clearance matrix contains non-finite values".into());
        }
        for (index, component) in self.components.iter().enumerate() {
            if component.id != index || component.orientations.is_empty() {
                return Err(format!(
                    "passive island component {} has invalid id or no orientations",
                    component.designator
                ));
            }
            if component
                .pin_net_ids
                .iter()
                .any(|net| *net >= self.net_names.len())
            {
                return Err(format!(
                    "component {} references an unknown net",
                    component.designator
                ));
            }
            for orientation in &component.orientations {
                finite(orientation.width, "orientation width")?;
                finite(orientation.height, "orientation height")?;
                if !is_finite_box(&orientation.body_box)
                    || orientation
                        .through_hole_boxes
                        .iter()
                        .any(|box_| !is_finite_box(box_))
                    || orientation.pin_points.len() != component.pin_net_ids.len()
                    || orientation
                        .pin_points
                        .iter()
                        .flatten()
                        .any(|point| !is_finite_point(point))
                {
                    return Err(format!(
                        "component {} contains invalid orientation geometry",
                        component.designator
                    ));
                }
            }
        }
        Ok(())
    }
}

impl Primitive {
    fn validate(&self) -> std::result::Result<(), String> {
        if !is_finite_box(&self.bbox)
            || self.collision_boxes.iter().any(|box_| !is_finite_box(box_))
        {
            return Err(format!("primitive {} contains non-finite boxes", self.id));
        }
        finite(self.width, "primitive width")?;
        finite(self.height, "primitive height")?;
        for placement in self.placements.iter() {
            finite(placement.x, "placement x")?;
            finite(placement.y, "placement y")?;
            finite(placement.score, "placement score")?;
        }
        for point in self.connection_points.iter() {
            if !point.x.is_finite() || !point.y.is_finite() {
                return Err(format!(
                    "primitive {} contains non-finite connection points",
                    self.id
                ));
            }
        }
        for port in self.path_ports.iter() {
            if !port.x.is_finite()
                || !port.y.is_finite()
                || !is_finite_point(&port.normal)
                || port.order < 0
            {
                return Err(format!("primitive {} contains invalid path ports", self.id));
            }
        }
        Ok(())
    }
}

fn finite(value: f64, name: &str) -> std::result::Result<(), String> {
    value
        .is_finite()
        .then_some(())
        .ok_or_else(|| format!("{name} is not finite"))
}
