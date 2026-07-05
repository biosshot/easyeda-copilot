type RuleLevel = "low" | "normal" | "high" | "critical";
type Priority = RuleLevel;
type Layer = "top" | "bottom";
type BlockRole = "power" | "mcu" | "analog" | "rf" | "connector" | "sensor" | "generic";
type BlockPlacement = "main" | "satellite";
type ComponentRole = "connector" | "main_ic" | "decoupling_cap" | "crystal" | "passive" | "indicator";
type MechanicalFaceDirection = "left" | "right" | "top" | "bottom" | "board.left" | "board.right" | "board.top" | "board.bottom";
type BoardEdge = "left" | "right" | "top" | "bottom";
type BoardPadLayer = "top" | "bottom" | "multi";
type BoardPadShape = "rect" | "oval" | "round";
type BoardAnchor =
  | "board.center" | "board.left" | "board.right" | "board.top" | "board.bottom"
  | "board.top_left" | "board.top_right" | "board.bottom_left" | "board.bottom_right";

type TargetRef =
  | { type: "component"; designator: string }
  | { type: "pin"; designator: string; pin_number: string | number }
  | { type: "block"; block_name: string }
  | { type: "board_anchor"; anchor: BoardAnchor };
type PinTargetRef = Extract<TargetRef, { type: "pin" }>;

interface BlockOptions {
  /** Main blocks are placed globally. Satellite blocks are compact physical islands attached near a parent block/component area. Split power converters and dense IC support into small satellites by function/side. */
  placement?: BlockPlacement;
  /** Parent block name for satellite placement. */
  attachTo?: string;
  /** Soft parent-side anchor for satellite placement, usually a pin(...) on the parent IC. */
  anchor?: TargetRef;
  /** Escape hatch for small same-role placement groups that intentionally do not share a non-GND net, e.g. USB DP/DM series resistor pairs or repeated indicators. Do not use for real functional blocks; split unrelated power/MCU/RF support into separate blocks instead. */
  allowDisconnected?: boolean;
}

interface ModuleOptions {
  /** Optional module anchor. The module bbox is softly attracted to this target after block/satellite placement. */
  anchor?: TargetRef;
}

interface BoardOptions {
  /** Allowed PCB layers for placement. Default: ["top"]. */
  layers?: Layer[];
  /** Default component side. Default: "top". */
  defaultLayer?: Layer;
  /** Minimum body-to-body component clearance. Used as hard placement clearance. Default 1.3mm. This is not wire/copper clearance. */
  clearance?: number;
  /** Minimum component body distance from board edge. Default 2.5mm. */
  edge?: number;
}

interface BoardShapeBaseOptions extends BoardOptions { }

interface RoundedRectOptions extends BoardShapeBaseOptions {
  radius?: number;
  segments?: number;
}

interface ChamferedRectOptions extends BoardShapeBaseOptions {
  chamfer?: number;
}

interface NotchedRectOptions extends BoardShapeBaseOptions {
  side?: BoardEdge;
  notchWidth: number;
  notchDepth: number;
  offset?: number;
}

interface CircleOptions extends BoardShapeBaseOptions {
  segments?: number;
}

interface OvalOptions extends BoardShapeBaseOptions {
  segments?: number;
}

interface LOptions extends BoardShapeBaseOptions {
  cutoutWidth: number;
  cutoutHeight: number;
  corner?: "top_left" | "top_right" | "bottom_right" | "bottom_left";
}

interface InverseLOptions extends BoardShapeBaseOptions {
  legWidth: number;
  legHeight: number;
  corner?: "top_left" | "top_right" | "bottom_right" | "bottom_left";
}

interface PolygonBoardOptions extends BoardShapeBaseOptions { }

interface AutoBoardOptions extends BoardOptions {
  /** Preferred width/height ratio. Default around 1.45. */
  aspectRatio?: number;
  /** Target component density = total footprint area / board area. Default 0.4. Lower values create more room for the client-side router; higher values create tighter boards. */
  density?: number;
  /** Alias for density. */
  componentDensity?: number;
  /** Minimum board width/height. Keep compact and based on component sizes plus placement margin. */
  minWidth?: number;
  minHeight?: number;
  /** Maximum board width/height. Use sparingly; too small can make placement impossible. */
  maxWidth?: number;
  maxHeight?: number;
}

declare const board: {
  /** Let the solver size a rectangular board from component footprints and hints. Prefer this unless exact dimensions are given. */
  auto(options?: AutoBoardOptions): void;
  /** Fixed rectangular board size. Use only when dimensions are known; avoid oversized boards. */
  rect(width: number, height: number, options?: BoardOptions): void;
  /** Rounded rectangle outline. Normalized to a polygon internally. */
  roundedRect(width: number, height: number, options?: RoundedRectOptions): void;
  /** Rectangle with equal chamfered corners. Normalized to a polygon internally. */
  chamferedRect(width: number, height: number, options?: ChamferedRectOptions): void;
  /** Rectangle with one inward notch. */
  notchedRect(width: number, height: number, options: NotchedRectOptions): void;
  /** Circular board outline. */
  circle(diameter: number, options?: CircleOptions): void;
  /** Oval board outline. */
  oval(width: number, height: number, options?: OvalOptions): void;
  /** L-shaped board by cutting one corner from a rectangle. */
  L(width: number, height: number, options: LOptions): void;
  /** Inverse-L style board controlled by kept leg sizes. */
  inverseL(width: number, height: number, options: InverseLOptions): void;
  /** Explicit polygon in mm. Bbox remains the source for board.left/right/top/bottom anchors. */
  polygon(points: Array<{ x: number; y: number }>, options?: PolygonBoardOptions): void;
};

interface BoardHoleOptions {
  /** Board anchor that defines the reference point. Component/block-relative holes are intentionally unsupported for now. */
  at: Extract<TargetRef, { type: "board_anchor" }>;
  /** Offset in mm from at. Positive X is right, positive Y is down. */
  offset?: { x?: number; y?: number };
  /** Finished hole drill diameter in mm. */
  drill: number;
  /** Copper/mechanical diameter in mm. Defaults to drill for plain board holes. */
  diameter?: number;
  /** Placement keepout radius from hole center in mm. Defaults to max(diameter, drill) / 2. */
  keepout?: number;
}

interface BoardHoleCornersOptions extends Omit<BoardHoleOptions, "at" | "offset"> {
  /** Inward offset from each real board outline corner in mm. Default 3mm. */
  inset?: number;
  /** Name prefix. Default "MH", producing MH1..MH4. */
  prefix?: string;
}

interface BoardHoleFunction {
  /** Add a board-level hole before placement starts. Exported as an unnetted via in BoardAssemble. */
  (name: string, options: BoardHoleOptions): void;
  /** Convenience helper for four corner holes. Offsets are automatically directed inward from each corner. */
  corners(options: BoardHoleCornersOptions): void;
}

declare const boardHole: BoardHoleFunction;

interface BoardPadHoleOptions {
  /** Drill diameter in mm. Must be > 0. Required for layer:"multi"; forbidden for top/bottom pads. */
  diameter: number;
  /** Relative EasyEDA hole offset from this pad center. */
  offset?: { x?: number; y?: number };
}

type BoardPadCell =
  | {
    name: string;
    net: string;
    shape: "round";
    diameter: number;
    hole?: BoardPadHoleOptions;
  }
  | {
    name: string;
    net: string;
    shape: "rect" | "oval";
    width: number;
    height: number;
    hole?: BoardPadHoleOptions;
  };

interface BoardPadOptions {
  /** Fixed board anchor for the synthetic pad group. */
  at: Extract<TargetRef, { type: "board_anchor" }>;
  /** Offset in mm from at. Positive X is right, positive Y is down. */
  offset?: { x?: number; y?: number };
  /** Column pitch in mm. */
  pitch: number;
  /** Row pitch in mm. Defaults to pitch. */
  rowPitch?: number;
  /** Copper side for all pads. layer:"multi" requires hole.diameter > 0 on every pad. Default "multi". */
  layer?: BoardPadLayer;
  /** Optional block owner. If omitted, a connector block with the same name is created. */
  block?: string;
  /** Matrix of pads. One row creates a line; multiple rows create a full pad header/grid. */
  pads: BoardPadCell[][];
}

/** Create a synthetic fixed component made from external board pads/test pads/header pads. Exported as BoardAssemble.pads, not components[]. */
declare function boardPad(name: string, options: BoardPadOptions): void;

interface ComponentGridOptions {
  /** Absolute board coordinate of matrix[0][0]. Board origin is center. Use either origin or at, not both. */
  origin?: { x: number; y: number };
  /** Board anchor for matrix[0][0]. Use either origin or at, not both. */
  at?: Extract<TargetRef, { type: "board_anchor" }>;
  /** Offset in mm from at. Positive X is right, positive Y is down. */
  offset?: { x?: number; y?: number };
  /** Column pitch in mm. */
  columnPitch: number;
  /** Row pitch in mm. Defaults to columnPitch. */
  rowPitch?: number;
  /** Block owner for all listed components. The block is treated as allowDisconnected because this is a mechanical array. */
  block: string;
  /** Role for all listed components. Default "connector". Use only connector/test/indicator-style arrays. */
  role?: ComponentRole;
  /** Locked layer for all listed components. Default "top". */
  layer?: Layer;
  /** Locked rotation for all listed components. Default 0. */
  rotate?: number;
}

/** Place existing mechanical connector/test/header/indicator components as a fixed regular matrix. matrix[row][column]; not for electrical islands, decoupling, feedback, or power passives. */
declare function componentGrid(name: string, matrix: string[][], options: ComponentGridOptions): void;

interface RegionRectOptions {
  /** Board anchor for region placement. Edge/corner anchors make the rect grow inward from that edge/corner. */
  anchor: Extract<TargetRef, { type: "board_anchor" }>;
  /** Region width in mm. */
  width: number;
  /** Region height in mm. */
  height: number;
  /** Optional offset in mm. Positive X is right, positive Y is down. */
  offset?: { x?: number; y?: number };
}

type ConstraintRegionShape = {
  type: "rect";
  anchor: Extract<TargetRef, { type: "board_anchor" }>;
  width: number;
  height: number;
  offset?: { x?: number; y?: number };
};

interface ConstraintRegionOptions {
  /** Only blocks listed here may intersect the region. All other blocks/components are excluded at board placement. */
  allow?: { blocks?: string[] };
  /** Board layers affected by this placement keepout. Defaults to both top and bottom. */
  layers?: Layer[];
  shape: ConstraintRegionShape;
}

declare const region: {
  /** Rectangular board-level placement region. Width/height/offset are in mm. */
  rect(options: RegionRectOptions): ConstraintRegionShape;
};

/** Board-level placement constraint region. Supports allow.blocks and optional layer filtering; affects board placement only. */
declare function constraintRegion(name: string, options: ConstraintRegionOptions): void;

interface DesignatorTextOptions {
  /** Enable/disable reference designator placement. Default true. */
  enabled?: boolean;
  /** Text height in mm. Default 1.1mm. */
  height?: number;
  /** Allowed text rotations in degrees. Default [0, 90]. */
  rotations?: number[];
  /** Minimum gap from component body/text obstacles in mm. Default 0.25mm. */
  margin?: number;
}

declare const silkscreen: {
  /** Configure automatic reference/designator text placement for all components. */
  designators(options?: DesignatorTextOptions): void;
};

/** Define a functional block and assign listed components to it. Unknown roles should be "generic". */
declare function block(name: string, designators?: string[], role?: BlockRole, descriptionOrOptions?: string | null | BlockOptions, options?: BlockOptions): TargetRef;
/** Define a macro placement module from existing block names. Use for major board areas such as power, mcu, usb, sensors. */
declare function module(name: string, blockNames: string[], options?: ModuleOptions): void;

interface ComponentBuilder {
  /** Assign component to a block. */
  block(name: string): ComponentBuilder;
  /** Set placement role; affects ordering and default aesthetics. */
  role(role: ComponentRole): ComponentBuilder;
  /** Allow component on specific layers. */
  layers(...layers: Layer[]): ComponentBuilder;
  /** Restrict component to top side. */
  top(): ComponentBuilder;
  /** Restrict component to bottom side. */
  bottom(): ComponentBuilder;
  /** Allowed rotations in degrees. Avoid calling rotations() unless orientation is explicitly required or mechanically constrained. */
  rotations(...rotations: number[]): ComponentBuilder;
  /** Declare where the mechanical face/port/opening points at rotate=0. If omitted and faceTo() is used, runtime auto-detects from footprint pads and reports a warning. */
  faceAt0(direction: MechanicalFaceDirection): ComponentBuilder;
  /** Hard-constrain rotation so the component's mechanical face points to this board direction. Use for USB/connectors/buttons/displays. */
  faceTo(direction: MechanicalFaceDirection): ComponentBuilder;
  /** Mount a mechanical component on a board edge with real overhang outside the board. Use for USB/ports only, not ordinary buttons. */
  edgeMount(edge: BoardEdge, options?: EdgeMountOptions): ComponentBuilder;
  /** Place a mechanical component near one or more board edges while keeping it inside the board. Use for buttons/LEDs/side controls. If face auto-detection is wrong, call faceAt0(...) before this. */
  edgePlace(edgeOrEdges: BoardEdge | BoardEdge[], options?: EdgePlaceOptions): ComponentBuilder;
  /** Lock this component to an exact board position. Allowed only for role("connector") mechanical parts; normal components must be placed by blocks/hints. */
  fixed(options: FixedPlacementOptions): ComponentBuilder;
  /** Alias for fixed(). */
  place(options: FixedPlacementOptions): ComponentBuilder;
  /** Allow this component footprint to extend past the board edge by the given millimeters. Use only for mechanical edge parts such as USB connectors. */
  boardOverflow(options: BoardOverflowOptions): ComponentBuilder;
  /** Override automatic reference/designator text placement for this component. Use enabled:false to hide it. */
  designatorText(options?: DesignatorTextOptions): ComponentBuilder;
}

/** Configure a component by designator. */
declare function component(designator: string): ComponentBuilder;

interface FixedPlacementOptions {
  /** Absolute board X/Y in mm. Board origin is center. */
  x?: number;
  y?: number;
  /** Board anchor for board-size-relative placement. Only anchor(...) targets are supported. */
  anchor?: Extract<TargetRef, { type: "board_anchor" }>;
  /** Offset in mm added to x/y or anchor. */
  offset?: { x?: number; y?: number };
  /** Locked rotation in degrees. */
  rotate?: number;
  /** Locked layer. */
  layer?: Layer;
  /** Optional board overflow allowance in mm for this fixed component. */
  boardOverflow?: BoardOverflowOptions;
}

type BoardOverflowOptions = number | {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
};

interface EdgeMountOptions {
  /** How far the component body may extend outside the selected board edge. Default 0. */
  overhang?: number;
  /** Default "outward". Use "any" only when orientation is irrelevant. */
  face?: "outward" | "inward" | "any" | MechanicalFaceDirection;
  /** Cross-edge alignment. start/end mean left/right for top/bottom edges and top/bottom for left/right edges. Default center. */
  align?: "center" | "start" | "end";
  /** Exact X coordinate for top/bottom edge mounts. */
  x?: number;
  /** Exact Y coordinate for left/right edge mounts. */
  y?: number;
  /** Additional cross-edge offset after align/x/y. */
  offset?: number;
  layer?: Layer;
  /** If true, only constrain face/overflow and add an edge hint; the solver may slide the component along the edge. Default false locks the edge-mounted component. */
  slide?: boolean;
}

interface EdgePlaceOptions {
  /** One allowed board edge, or use edges for multiple choices. Component stays inside the board. */
  edge?: BoardEdge;
  /** Allowed board edges. Solver chooses a free slot along one of them. */
  edges?: BoardEdge[];
  /** Distance from the real board edge inward in mm. Default 0. */
  inset?: number;
  /** Default "outward". With one edge, this filters rotation so the mechanical face points correctly. Use "any" for non-directional edge parts. */
  face?: "outward" | "inward" | "any" | MechanicalFaceDirection;
  /** Preferred cross-edge alignment. The solver may still slide if needed. Default center. */
  align?: "center" | "start" | "end";
  /** Preferred/exact X coordinate for top/bottom edge placement. */
  x?: number;
  /** Preferred/exact Y coordinate for left/right edge placement. */
  y?: number;
  /** Additional cross-edge offset in mm. */
  offset?: number;
  /** Optional locked layer for this edge-placed component. */
  layer?: Layer;
}

/** Place mechanical components near board edge(s) but inside the board. Use for buttons, LEDs, side-access connectors, and edge controls. Not for USB/ports that must overhang; use edgeMount for those. */
declare function edgePlace(designators: string | string[], options: EdgePlaceOptions): void;
/** Lock a component to an exact/anchor-relative board position. Allowed only for role("connector") mechanical parts. */
declare function fixed(designator: string, options: FixedPlacementOptions): void;
/** Global helper equivalent to component(designator).edgeMount(edge, options). */
declare function edgeMount(designator: string, edge: BoardEdge, options?: EdgeMountOptions): void;

/** Target a component center. */
declare function comp(designator: string): TargetRef;
/** Target a specific component pin/pad. Prefer pin-to-pin hints for critical analog/power placement. */
declare function pin(designator: string, pin_number: string | number): TargetRef;
/** Target a board anchor such as "board.left" or "board.center". */
declare function anchor(anchor: BoardAnchor): TargetRef;

/** Softly attract two targets. For electrical intent, prefer pin(...) targets over comp(...) targets. */
declare function near(source: TargetRef, target: TargetRef, priority?: Priority): void;
/** Strongly attract two targets. Use sparingly, mainly for truly short electrical paths. Prefer pin(...) to pin(...); avoid comp(...) here unless only a rough grouping is needed. */
declare function veryNear(source: TargetRef, target: TargetRef, priority?: Priority): void;

interface CriticalPairOptions {
  /** Priority baseline. Defaults to "critical". */
  priority?: Priority;
  /** Desired maximum pad-to-pad distance in mm. Defaults to 3mm for corePairs(). Use realistic values based on footprints and required clearance. */
  maxDistance?: number;
  /** Optional minimum pad-to-pad distance in mm. */
  minDistance?: number;
  /** Multiplier over priority weight. Use >1 only for dominant electrical pairs. */
  weight?: number;
  /** Treat maxDistance as a hard placement limit. Make only the truly dominant pair hard; do not make many hard pairs to the same parent pin. */
  hard?: boolean;
  /** Prefer rotations where the two pads face each other. */
  preferFacingPads?: boolean;
}

interface CoreIslandOptions extends CriticalPairOptions {
  /** Dominant pin pairs inside this island. The island packer keeps these short before placing lower-priority components. Keep islands small and non-overlapping. */
  pairs?: Array<[PinTargetRef, PinTargetRef]>;
}

/** Dominant pad-to-pad constraint for short critical electrical paths such as buck switch-node-to-inductor or RF matching pairs. Prefer one hard dominant pair plus soft secondary pairs. */
declare function criticalPair(source: PinTargetRef, target: PinTargetRef, options?: CriticalPairOptions): void;
/** Bulk helper for the dominant pairs inside a functional block. Emits criticalPair() rules with stronger defaults. */
declare function corePairs(blockName: string, pairs: Array<[PinTargetRef, PinTargetRef]>, options?: CriticalPairOptions): void;
/** Define a critical placement island whose internal pair geometry is packed before normal block/component placement. Does not reassign components to blocks. Use for 2-3 dominant components; avoid several islands sharing the same main IC. */
declare function coreIsland(name: string, components: string[], options?: CoreIslandOptions): void;

/** Softly separate two targets. Use clearance() for guaranteed minimum spacing. */
declare function away(source: TargetRef, target: TargetRef, priority?: Priority): void;
/** Prefer two components on the same PCB side. */
declare function sameSide(source: TargetRef, target: TargetRef, priority?: Priority): void;
/** Cluster related targets without requiring very short distances. */
declare function cluster(source: TargetRef, target: TargetRef, priority?: Priority): void;
/** Require or prefer minimum body clearance between source and target/"all". Critical is treated as hard. Use target "all" sparingly. */
declare function clearance(source: TargetRef, target: TargetRef | "all", min: number, priority?: Priority): void;
/** Require or prefer minimum clearance between block bounding boxes. Use to keep functional groups self-contained and separated. */
declare function blockClearance(sourceBlock: string, targetBlock: string | "all", min: number, priority?: Priority): void;
/** Place component/block near a board edge while respecting board edge clearance. Prefer near(comp(...), anchor("board.left"), ...) unless edge orientation is mechanically required. */
declare function edge(source: TargetRef | string, edge: BoardEdge, priority?: Priority, orientation?: "outward" | "inward" | "any" | null): void;

interface BypassOptions {
  /** Gap between capacitor bodies. Effective gap will not be less than board.clearance. */
  gap?: number;
}

/** Place bypass capacitors in a row near a target supply pin. Add clearance/blockClearance when the row is close enough to overlap an IC body. */
declare function bypass(capacitors: string[], target: Extract<TargetRef, { type: "pin" }>, priority?: Priority, options?: BypassOptions): void;

interface CapClusterOptions {
  /** Net that should form the shared power bus side, e.g. "+3V3", "BAT+", "VIN". */
  powerNet: string;
  /** Return net, usually "GND". */
  returnNet: string;
  /** Required target supply pin to keep the bank near. The target pin must be on powerNet. */
  target: Extract<TargetRef, { type: "pin" }>;
  /** Maximum rows. Only 1 or 2 are supported; default chooses 1 for small banks and 2 for larger banks. */
  maxRows?: 1 | 2;
  /** Maximum capacitors per row before using a second row. Default 3. */
  maxPerRow?: number;
  /** Body gap inside each row. Effective gap will not be less than board.clearance. */
  gap?: number;
  /** Distance between row centers for two-row banks. Effective value preserves board.clearance. */
  rowGap?: number;
  /** edge_bus keeps one row with power pads on one side; center_power_bus makes two rows face power pads inward to a central bus. */
  topology?: "edge_bus" | "center_power_bus";
  priority?: Priority;
}

/** Place a bank of 2+ capacitors as a bus-aware cluster. Every capacitor must have both powerNet and returnNet pads. For a single capacitor, crystal load capacitors, or unrelated capacitors use veryNear/bypass instead. Unlike generic row placement, this chooses rotations so same-net pads face the shared bus: one row uses power on one side and return on the other; two rows put power pads inward toward a center bus and return pads outward. */
declare function capCluster(capacitors: string[], options: CapClusterOptions): void;

interface SolverOptions {
  /** Placement grid in mm. Larger values are faster and cleaner; smaller values allow tighter placement. For complex boards, 1mm is a good starting point. */
  grid?: number;
  /** Signals ignored during placement ratsnest scoring, usually ["GND"]. */
  ignoredSignals?: string[];
  /** "normal" keeps balanced electrical/aesthetic placement. "high" heavily prefers minimum block/module/board occupied size for very compact boards. Default "normal". */
  compactness?: "normal" | "high";
}

declare function solver(options: SolverOptions): void;
