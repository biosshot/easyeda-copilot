
Write JavaScript PCB layout rules using only the TypeScript declarations below. Do not output JSON.

Required shape:
make_pcb_layout({ code: `
  board.auto({ aspectRatio: 1.45, density: 0.4, minWidth: 40, minHeight: 25, layers: ["top", "bottom"], clearance: 1.3, edge: 2.5 });
  silkscreen.designators({ height: 1.1, rotations: [0, 90] });
  boardHole("MH1", { at: anchor("board.top_left"), offset: { x: 3, y: 3 }, drill: 3.2, keepout: 4 });
  block("power", ["U1", "L1", "D1", "C1"], "power");
  component("U1").block("power").role("main_ic").top().rotations(0, 180).noWiresUnder();
  component("C1").block("power").role("decoupling_cap").top().rotations(0, 90, 180, 270);
  veryNear(pin("C1", "1"), pin("U1", "VDD"), "critical");
  bypass(["C1", "C2"], pin("U1", "VDD"), "critical", { axis: "x", rotate: 90 });
  route.netClass("power", ["VIN", "VOUT"], { width: 0.5, clearance: 0.25, zIndex: 320 });
  route.polygon(["VIN", "VOUT"], { expansion: 0.6, clearance: 0.45, minWidth: 0.5, minPadConnections: 2 });
  route.ignore("GND");
  route.run({ profile: "high", trace: "fortyfive", width: 0.2, clearance: 0.127, viaDiameter: 0.61, viaDrill: 0.305 });
`})

Placement guidance:
- Keep functional blocks small and physical. For dense ICs and switching regulators, prefer one main block plus multiple satellite blocks for clock, flash, decoupling rows, switch/inductor, input, output, feedback, and auxiliary networks.
- Assign every component to exactly one block. A satellite attaches to a parent with placement/attachTo/anchor; it must not duplicate component ownership.
- Use comp("R1") only for real component designators. For block-level constraints use block("power")/block("mcu") targets, not comp("power").
- Default component body clearance is 1.3mm. This is placement/body clearance only; copper clearance for wires is separate. Do not pack components tightly unless the board is intentionally constrained.
- Default board edge clearance is 2.5mm. Keep ordinary components away from board edges unless they are mechanical edge parts.
- Around dense IC packages with many pads, leave extra body clearance and routing escape room. Use blockClearance when support passives or neighboring blocks sit next to the IC body.
- Spread major functional blocks across the board when possible instead of anchoring every block to the same side. Use board anchors and blockClearance to keep routing channels open.
- For connectors/ports that must sit on a board edge, prefer component("J1").edgeMount("left"/"right"/"top"/"bottom", { overhang: 3 }) instead of hand-written fixed()/boardOverflow()/offset. edgeMount computes the fixed center from the real footprint bbox after rotation.
- For board-level mounting holes, use boardHole("MH1", { at: anchor("board.top_left"), offset: { x: 3, y: 3 }, drill: 3.2, keepout: 4 }) or boardHole.corners({ inset: 3, drill: 3.2, keepout: 4 }). Holes are placed before components and create hard placement keepouts.
- Add at least one mounting hole by default unless the user says not to, the board is very small, the board is a flex/castellated/module-style design, or mounting holes clearly do not fit the mechanical intent.
- For directional parts that do not need fixed edge mounting, use component("J1").faceTo("board.left"/"board.right"/"board.top"/"board.bottom"). It hard-filters allowed rotations before placement. If faceAt0 is omitted, runtime auto-detects faceAt0 from footprint pads and reports a warning.
- Use bbox and anchor limits to describe real geometry, not wishes. Too-tight hardBbox/hardAnchor commonly creates overlaps or timeouts.
- For non-rectangular boards, use board.roundedRect/chamferedRect/notchedRect/circle/oval/L/inverseL/polygon. All shape coordinates and dimensions are in mm. board anchors still refer to the enclosing bbox, while boardHole.corners({ inset }) uses the real outline.
- Use criticalPair/corePairs/coreIsland only for dominant pad-to-pad constraints. Keep coreIsland small, usually 2-3 components, and avoid overlapping islands that all share the same main IC.
- Do not put several hard criticalPair rules with tiny maxDistance onto the same parent pin. Make the most important pair hard, keep secondary parts soft, and add bypass/line plus clearance or blockClearance for body spacing.
- For capacitor banks on the same power/return nets, use capCluster(...) instead of line()/bypass(); it aligns same-net pads toward shared buses and locks the resulting rotations.
- GND via stitching is enabled by default when a GND net exists, with a 4mm grid. Use route.stitch({ net: "GND", grid: 3 }) only to override the whole-board default or to add scoped stitching. Use route.polygon(..., { stitch: { grid: 3 } }) or route.powerPolygon(..., { stitch: { grid: 3 } }) when stitching should be limited to generated polygon copper.
- Add blockClearance between a close satellite and its parent IC/block whenever their bodies could overlap.
- Reference designator text is placed automatically on the same side as its component. Use silkscreen.designators({ height, rotations }) for global defaults and component("U1").designatorText(...) only for local overrides or enabled:false.
- For 30+ component boards, prefer solver({ grid: 1, fallbackGrid: 2, localImproveIterations: 32-40 }) as a practical starting point. Avoid tiny grids and high iteration counts unless quality is worth the slower search.
- board.auto({ density }) controls target component density from footprint area. Default is 0.4; lower values make a larger board with more routing room, higher values make a tighter board.
- Routing defaults are wire width 0.2mm, wire clearance 0.127mm, via diameter 0.61mm, and via drill 0.305mm. Use these unless the user or manufacturing rules require different values.
- In route.netClass, use zIndex for routing order control. Higher zIndex routes earlier. Missing zIndex is treated as 0; ties keep declaration order.
- Use route.polygon(net, ...) for general post-route copper pours. Use route.powerPolygon(...) for local power copper around buck/input/output pads; do not put polygon options into route.netClass.

Tool output:
- make_pcb_layout returns collected image_url with label "PCB". It is routed SVG when routing succeeds, otherwise placement SVG.
- make_pcb_layout also returns pcb_tool_report with compact placement/routing status, overlaps, outside-board issues, block violations, critical pair distance violations, and unrouted/partial nets.
- In production mode no debug files may be saved. Use image_url and pcb_tool_report instead of filesystem paths.
- When iterating after a bad layout, inspect pcb_tool_report first: overlaps, outsideBoard, blockViolations, criticalPairViolations, unroutedNets, and partiallyRoutedNets.

```ts
type RuleLevel = "low" | "normal" | "high" | "critical";
type Priority = RuleLevel;
type Layer = "top" | "bottom";
type BlockRole = "power" | "mcu" | "analog" | "rf" | "connector" | "sensor" | "generic";
type BlockPlacement = "main" | "satellite";
type ComponentRole = "connector" | "main_ic" | "decoupling_cap" | "crystal" | "passive" | "indicator";
type MechanicalFaceDirection = "left" | "right" | "top" | "bottom" | "board.left" | "board.right" | "board.top" | "board.bottom";
type Axis = "x" | "y";
type BoardEdge = "left" | "right" | "top" | "bottom";
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
  /** Offset in mm applied to the anchor target before block attraction/anchor-gap scoring. Useful for board-edge main blocks that need internal room for satellites. Positive X is right, positive Y is down. */
  anchorOffset?: { x?: number; y?: number };
  /** Preferred side of the parent block for satellite placement. */
  sidePreference?: BoardEdge;
  /** Near-hard maximum bbox scale over estimated packed block size. Useful for clock/flash/small buck satellites; keep large enough for real footprints plus clearance. */
  maxBboxScale?: number;
  /** Absolute maximum block bbox width/height in mm. */
  maxBboxWidth?: number;
  maxBboxHeight?: number;
  /** Treat block bbox limit as a hard placement constraint. Use sparingly; too-tight hard bbox limits can create overlaps or timeouts. Defaults hard for satellite blocks with bbox limits. */
  hardBbox?: boolean;
  /** Maximum distance from anchor point to this block bbox in mm. Leave enough space for body clearance from the parent package. */
  maxAnchorGap?: number;
  /** Treat maxAnchorGap as hard. Use sparingly; too-tight hard anchors can force body overlap near ICs. */
  hardAnchor?: boolean;
  /** Limit bbox of parent block plus all attached satellite blocks. Useful to keep a functional family together without forcing all parts into one block. */
  familyMaxBboxScale?: number;
  familyMaxWidth?: number;
  familyMaxHeight?: number;
  /** Treat family bbox as hard. Prefer soft family limits unless the user gave a real mechanical/electrical envelope. */
  familyHard?: boolean;
  /** Local body-to-body placement clearance in mm for this exact block/satellite. Use for tight switch/current-loop islands such as U1/L1 without lowering whole-board clearance. It is intentionally not inherited by all child satellites. */
  placementClearance?: number;
}

interface BoardOptions {
  /** Allowed PCB layers for placement/routing. Default: ["top"]. */
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
  /** Target component density = total footprint area / board area. Default 0.4. Lower values create more routing room; higher values create tighter boards. */
  density?: number;
  /** Alias for density. */
  componentDensity?: number;
  /** Minimum board width/height. Keep compact and based on component sizes plus routing margin. */
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
  /** Mount a mechanical component on a board edge. Computes fixed center, face direction, and board overflow from the real footprint bbox after rotation. Prefer this for USB/ports/buttons on edges instead of fixed()+offset+boardOverflow. */
  edgeMount(edge: BoardEdge, options?: EdgeMountOptions): ComponentBuilder;
  /** Lock this component to an exact board position. Fixed components are placed before auto-placement and are never moved by repair. */
  fixed(options: FixedPlacementOptions): ComponentBuilder;
  /** Alias for fixed(). */
  place(options: FixedPlacementOptions): ComponentBuilder;
  /** Allow this component footprint to extend past the board edge by the given millimeters. Use only for mechanical edge parts such as USB connectors. */
  boardOverflow(options: BoardOverflowOptions): ComponentBuilder;
  /** Prohibit routed wires/vias under component body while leaving pad access windows.
   * Use only when routing under the component is genuinely harmful, such as sensitive feedback resistors or specific connector bodies.
   * allowOwnNets opens a local cross-shaped access window centered on each pad.
   * Use allowOwnNets for connectors whose body is much larger than their pads.
   */
  noWiresUnder(options?: boolean | { enabled?: boolean; allowOwnNets?: boolean }): ComponentBuilder;
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

/** Lock a component to an exact/anchor-relative board position. Use for mechanical connectors such as USB, buttons, mounting-related parts. */
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
  /** Secondary penalty for ratsnest segment crossings from this pair. Keep small, e.g. 1-3. */
  crossingPenalty?: number;
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

interface LineOptions {
  /** Gap between component bodies. Effective gap will not be less than board.clearance. */
  gap?: number;
  /** Force common rotation when allowed. */
  rotate?: number;
  priority?: Priority;
}

/** Arrange components in one horizontal/vertical row. Use sparingly for true arrays, matched groups, or explicit user-requested alignment. */
declare function line(components: string[], axis: Axis, options?: LineOptions): void;

interface PairedLineOptions {
  gap?: number;
  rowGap?: number;
  primaryRotate?: number;
  secondaryRotate?: number;
  priority?: Priority;
}

/** Arrange primary/secondary pairs in two aligned rows. Useful for diode+resistor arrays. */
declare function pairedLine(pairs: Array<{ primary: string; secondary: string }>, axis: Axis, options?: PairedLineOptions): void;

interface BypassOptions {
  /** Row axis. If omitted, solver chooses by footprint long axis. */
  axis?: Axis;
  /** Gap between capacitor bodies. Effective gap will not be less than board.clearance. */
  gap?: number;
  /** Force capacitor rotation when allowed. */
  rotate?: number;
}

/** Place bypass capacitors in a row near a target supply pin. Add clearance/blockClearance when the row is close enough to overlap an IC body. */
declare function bypass(capacitors: string[], target: Extract<TargetRef, { type: "pin" }>, priority?: Priority, options?: BypassOptions): void;

interface CapClusterOptions {
  /** Net that should form the shared power bus side, e.g. "+3V3", "BAT+", "VIN". */
  powerNet: string;
  /** Return net, usually "GND". */
  returnNet: string;
  /** Optional target supply pin to keep the bank near. */
  target?: Extract<TargetRef, { type: "pin" }>;
  /** Cluster axis. For horizontal capacitor banks use "x". */
  axis?: Axis;
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

/** Place a bank of capacitors as a bus-aware cluster. Unlike line()/bypass(), this chooses rotations so same-net pads face the shared bus: one row uses power on one side and return on the other; two rows put power pads inward toward a center bus and return pads outward. */
declare function capCluster(capacitors: string[], options: CapClusterOptions): void;

interface SolverOptions {
  /** Placement grid in mm. Larger values are faster and cleaner; smaller values allow tighter placement. For complex boards, 1mm is a good starting point. */
  grid?: number;
  /** Fallback candidate grid in mm. Do not set smaller than needed; tiny values can make placement slow. For complex boards, about 2mm is a good starting point. */
  fallbackGrid?: number;
  /** Signals ignored during placement ratsnest scoring, usually ["GND"]. */
  ignoredSignals?: string[];
  /** Local improvement iterations after initial placement. Keep around 32-40 for complex 30+ component boards unless the user asks for slower placement quality. */
  localImproveIterations?: number;
  /** Minimum score improvement accepted per local move. */
  localImproveMinDelta?: number;
  /** Move functional blocks as rigid groups after local component placement. Default true; disable only for tiny/simple boards. */
  hierarchicalBlocks?: boolean;
}

declare function solver(options: SolverOptions): void;

interface RouteRunOptions {
  /** Router effort level. Use the unified RuleLevel vocabulary. */
  profile?: RuleLevel;
  trace?: "orthogonal" | "fortyfive" | "free_angle";
  /** Default trace width in mm. Default 0.2mm unless explicitly required otherwise. */
  width?: number;
  /** Default copper clearance in mm. Default 0.127mm unless explicitly required otherwise. */
  clearance?: number;
  /** Default via diameter in mm. Default 0.61mm unless explicitly required otherwise. */
  viaDiameter?: number;
  /** Default via drill in mm. Default 0.305mm unless explicitly required otherwise. */
  viaDrill?: number;
  completion?: RuleLevel;
  compactness?: RuleLevel;
  viaAvoidance?: RuleLevel;
  cleanup?: RuleLevel;
  designName?: string;
}

interface RouteNetClassOptions {
  /** Trace width in mm. Default route width is 0.2mm; only widen high-current/power nets with a concrete reason. */
  width?: number;
  /** Copper clearance in mm. Default route clearance is 0.127mm unless the user or manufacturing rules require more. */
  clearance?: number;
  viaAvoidance?: RuleLevel;
  /** Explicit routing order. Higher values route earlier. Missing zIndex is treated as 0; ties keep declaration order. */
  zIndex?: number;
}

interface StitchOptionsBase {
  /** Via grid step in mm. */
  grid?: number;
  /** Via diameter in mm. Defaults to route.run viaDiameter. */
  diameter?: number;
  /** Via drill in mm. Defaults to route.run viaDrill. */
  drill?: number;
  /** Keepout from pads/tracks/vias/board holes in mm. Defaults to net clearance. */
  clearance?: number;
  /** Board edge keepout in mm. Defaults to board edge clearance. */
  edge?: number;
  /** Safety cap for generated stitching vias. */
  maxCount?: number;
}

interface StitchOptions extends StitchOptionsBase {
  /** Net to stitch. */
  net: string;
  /** Optional scoped area around a component, pin, or block. Without around, this replaces the whole-board default stitch rule for this net. */
  around?: TargetRef;
  /** Margin around the resolved around target bbox. */
  margin?: number;
}

interface PolygonOptions {
  /** Optional scoped area around a component, pin, block, or board anchor. */
  around?: TargetRef;
  /** Margin around the resolved around target bbox. */
  margin?: number;
  /** Max polygon growth distance from own tracks/pads/vias before hitting board edge or obstacles. Prefer about 0.4-0.8mm for compact pours. */
  expansion?: number;
  /** Clearance from polygon to other nets and other polygons. Prefer about 0.45mm by default. */
  clearance?: number;
  /** Drop polygon regions narrower than this. Prefer about 0.5mm by default. */
  minWidth?: number;
  /** Drop polygon islands with area smaller than this, in mm^2. Default 1mm^2. */
  minArea?: number;
  /** Keep a polygon island only when it touches at least this many same-net pads. Default 2 for route.polygon, 1 for route.powerPolygon. */
  minPadConnections?: number;
  /** Shape style for post-processing. */
  style?: "compact" | "smooth" | "orthogonal45";
  /** Cleanup strength for small steps, protrusions, and notches. */
  cleanup?: "none" | "normal" | "strong";
  /** Stitch vias inside this generated polygon only. */
  stitch?: StitchOptionsBase;
}

interface PowerPolygonOptions extends PolygonOptions {
  /** Net to generate local power copper for. */
  net: string;
  /** Dominant pads that should seed and constrain the local power copper. */
  connect?: PinTargetRef[];
}

declare const route: {
  /** Disable routing. Placement only. */
  skip(): void;
  /** Run Freerouting after placement. */
  run(options?: RouteRunOptions): void;
  /** Define routing rules for a group of signals. */
  netClass(name: string, signals: string | string[], options?: RouteNetClassOptions): void;
  /** Generate general post-route polygon copper for one or more nets. Use for board/local distribution pours, not for defining routing class width/clearance. */
  polygon(signals: string | string[], options?: PolygonOptions): void;
  /** Generate local intent-based power copper around specific pads or a block, e.g. buck VIN/VOUT copper. */
  powerPolygon(options: PowerPolygonOptions): void;
  /** Add post-routing via stitching. GND has a default whole-board rule when present; without around this replaces the whole-board default for the same net. */
  stitch(options: StitchOptions): void;
  /** Ignore signal(s) in the autorouter, usually "GND" when it will be served by copper pour/stitching. */
  ignore(signals: string | string[]): void;
};

```