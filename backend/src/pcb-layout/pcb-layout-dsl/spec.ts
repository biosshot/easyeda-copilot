import { backendResource } from '#runtime/resources.ts';
import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";
import { compileAntenna, compileSolderJumper } from "#pcb-layout/procedural-footprints.ts";
import type { FootprintSpec, BoardAnchor, BoardEdge, ComponentRole, Layer, PcbRuleLevel, TargetRef } from "#types/pcb/layout-model.ts";
import {
    PCB_BLOCK_PLACEMENTS,
    PCB_BLOCK_ROLES,
    PCB_BOARD_EDGES,
    PCB_BOARD_FACE_DIRECTIONS,
    PCB_BOARD_PAD_LAYERS,
    PCB_BOARD_PAD_SHAPES,
    PCB_CAP_CLUSTER_TOPOLOGIES,
    PCB_COMPONENT_ROLES,
    PCB_EDGE_MOUNT_ALIGNS,
    PCB_EDGE_MOUNT_FACES,
    PCB_LAYERS,
    PCB_MECHANICAL_FACE_DIRECTIONS,
    PCB_PLACEMENT_COMPACTNESS,
    PCB_RULE_LEVELS,
} from "#types/pcb/layout-rules.ts";
import type {
    Block,
    BoardHoleRule,
    BoardPadRule,
    BoardOverflowAllowance,
    EdgeMount,
    EdgePlace,
    FaceDirection,
    FixedPlacement,
    Module,
    PlacementRules,
    ConstraintRegionRule,
    ProceduralFeatureRule,
    RefineGroupRule,
    SignalPathRule,
} from "#types/pcb/layout-rules.ts";

export const PCB_LAYOUT_DSL_TS_DOC = readFileSync(backendResource("dist", "spec-doc.d.ts"), "utf-8");

export const PCB_LAYOUT_DSL_SPEC = `
Write JavaScript PCB layout rules using only the TypeScript declarations below. Do not output JSON.

Required shape:
make_pcb_layout({ code: \`
  board.auto({ aspectRatio: 1.45, density: 0.4, minWidth: 40, minHeight: 25, layers: ["top", "bottom"], clearance: 0.35, edge: 0.8 });
  silkscreen.designators({ height: 1.1, rotations: [0, 90] });
  boardHole("MH1", { at: anchor("board.top_left"), offset: { x: 3, y: 3 }, drill: 3.2, keepout: 4 });
  boardPad("debug", { at: anchor("board.bottom"), offset: { x: 0, y: -2 }, pitch: 1.27, layer: "multi", pads: [[{ name: "GND", net: "GND", shape: "round", diameter: 0.9, hole: { diameter: 0.35 } }]] });
  componentGrid("debug_header", [["GND", "3V3", "TX", "RX"]], { origin: { x: -10, y: 20 }, columnPitch: 2.54, block: "debug_header" });
  edgePlace(["SW1", "LED1"], { edges: ["top", "right"], inset: 1, face: "outward", layer: "top" });
  block("power", ["U1", "L1", "D1", "C1"], "power");
  component("U1").block("power").role("main_ic").top().rotations(0, 180);
  component("C1").block("power").role("decoupling_cap").top().rotations(0, 90, 180, 270);
  veryNear(pin("C1", "1"), pin("U1", "VDD"), "critical");
  bypass(["C1", "C2"], pin("U1", "VDD"), "critical", { gap: 0.4 });
  signalPath("rf_main", [
    [pin("J1", "RF"), pin("C10", "1"), { maxDistance: 18 }],
    [pin("C10", "2"), pin("U5", "RFIN"), { maxDistance: 4 }],
    [pin("U5", "RFOUT"), pin("ANT1", "FEED"), { maxDistance: 16 }],
  ], { priority: "critical", shape: "flexible", preferFacingPads: true });
  refineGroup("headers", ["H1", "H2"], { swap: true, rotateBy: [180] });
\`})

Placement guidance:
- Keep functional blocks small and physical. For dense ICs and switching regulators, prefer one main block plus multiple satellite blocks for clock, flash, decoupling rows, switch/inductor, input, output, feedback, and auxiliary networks.
- For large boards, group related blocks with module("power", ["buck_core", "buck_input", "buck_output"], { anchor: anchor("board.left") }). A module is a placement-only macro group; keep detailed geometry inside blocks and criticalPair/capCluster/coreIsland rules.
- Assign every component to exactly one block. A satellite attaches to a parent with placement/attachTo/anchor; it must not duplicate component ownership.
- A block should be one net-connected physical island using non-GND nets. If a tiny same-role group intentionally has no shared non-GND net, such as USB DP/DM series resistors or repeated indicators, set block(..., { allowDisconnected: true }). Use this rarely; split unrelated support parts instead.
- Every component must have a real resolved EasyEDA footprint from a valid part_uuid. Offline/inferred generic footprints are disabled; if footprint resolution fails, choose/fix the component before layout.
- Use comp("R1") only for real component designators. For block-level constraints use block("power")/block("mcu") targets, not comp("power").
- Default component body clearance is 0.35mm. This is placement/body clearance only; copper clearance for wires is separate.
- Default board edge clearance is 0.8mm. Keep ordinary components away from board edges unless they are mechanical edge parts.
- Around dense IC packages with many pads, leave extra body clearance and escape room. Use blockClearance when support passives or neighboring blocks sit next to the IC body.
- Spread major functional blocks across the board when possible instead of anchoring every block to the same side. Use board anchors and blockClearance to keep channels open for the client-side router.
- For connectors/ports that must protrude outside a board edge, use component("J1").edgeMount("left"/"right"/"top"/"bottom", { overhang: 1.2, face: "outward" }). edgeMount is for real mechanical overhang such as USB/ports, not ordinary buttons.
- For buttons, LEDs, side-access connectors, and controls that must stay inside the board but near one or more edges, use edgePlace(["SW1", "SW2"], { edges: ["top", "right"], inset: 1, face: "outward" }) or component("SW1").edgePlace("right", { inset: 1 }). The solver chooses a free slot along the allowed edge(s).
- face:"outward" means "rotate the component's declared mechanical face toward the board edge". If a connector footprint reports a face_warning or you know its opening direction, add component("J1").faceAt0("left"/"right"/"top"/"bottom") before edgePlace/edgeMount. Pads-based auto detection can be wrong for connectors.
- For antenna/display/mechanical clear zones, use constraintRegion("antenna_clearance", { shape: region.rect({ anchor: anchor("board.top"), width: 16, height: 5 }), allow: { blocks: ["antenna"] } }). Region width/height/offset are in mm and affect board-level placement only. For one-side mechanical keepouts use layers: ["bottom"] or ["top"].
- fixed() is allowed only for mechanical connectors with role("connector"). Do not use fixed() to improve normal component placement; use blocks, satellites, anchors, near/veryNear, criticalPair, bypass, or capCluster.
- For existing mechanical/test/header components that must form a regular fixed array, use componentGrid(...). It is only for connector/test/indicator arrays at board edges or known mechanical positions. Do not use it for decoupling caps, feedback parts, buck/input/output capacitors, or normal electrical islands.
- For board-level mounting holes, use boardHole("MH1", { at: anchor("board.top_left"), offset: { x: 3, y: 3 }, drill: 3.2, keepout: 4 }) or boardHole.corners({ inset: 3, drill: 3.2, keepout: 4 }). Holes are placed before components and create hard placement keepouts.
- For external/test/header pads that must be part of the PCB but not BOM components, use boardPad("debug", { at, offset, pitch, rowPitch, layer, pads: [[...]] }). It becomes a fixed synthetic component for placement and exports as BoardAssemble.pads. Pad shapes are "round" with diameter or "rect"/"oval" with width/height. layer:"multi" requires hole.diameter > 0 on every pad; top/bottom pads must not specify hole. hole.offset is kept as relative EasyEDA offset.
- Add at least one mounting hole by default unless the user says not to, the board is very small, the board is a flex/castellated/module-style design, or mounting holes clearly do not fit the mechanical intent.
- For directional parts that do not need fixed edge mounting, use component("J1").faceTo("board.left"/"board.right"/"board.top"/"board.bottom"). It hard-filters allowed rotations before placement. If faceAt0 is omitted, runtime auto-detects faceAt0 from footprint pads and reports a warning.
- For non-rectangular boards, use board.roundedRect/chamferedRect/notchedRect/circle/oval/L/inverseL/polygon. All shape coordinates and dimensions are in mm. board anchors still refer to the enclosing bbox, while boardHole.corners({ inset }) uses the real outline.
- When an existing PCB placement is provided, preserve({ board: true, components: "all" }) keeps its outline and only components whose centers are inside that outline. Use a designator array instead of "all" to preserve an explicit subset.
- Use criticalPair/corePairs/coreIsland only for dominant pad-to-pad constraints. Keep coreIsland small, usually 2-3 components, and avoid overlapping islands that all share the same main IC.
- Do not put several hard criticalPair rules with tiny maxDistance onto the same parent pin. Make the most important pair hard, keep secondary parts soft, and add bypass plus clearance or blockClearance for body spacing.
- For an ordered signal that passes through series passives, matching parts, IC input/output pins, connectors, or an antenna feed, use one signalPath(...). Every tuple is one physical pad-to-pad PCB segment; adjacent tuples meet at the same pass-through component on different entry/exit pins. Paths may cross blocks/modules and all endpoint ICs may remain movable.
- signalPath is placement intent only. It optimizes segment distance, pad facing, detour, backtracking, and turns; it neither creates copper nor guarantees 50 ohms/controlled impedance. Impedance still depends on stackup, trace geometry, reference plane, and routing.
- refineGroup(...) is an explicit post-placement permission, mainly for fixed/mechanical components that may exchange already resolved poses. It never invents positions. Use rotateBy:[180] only for an axis-preserving relative flip. Unlocked compatible components inside one block/satellite are refined automatically; fixed opportunities are reported but not applied until a refineGroup permits them.
- Do not duplicate the same chain with line(), corePairs(), or separate criticalPair() calls. line() owns a local island and is not a cross-block signal-path primitive. Put maxDistance only on segments with a real placement limit; an omitted maxDistance remains soft and unbounded.
- Keep blocks small. More than 12 components in one block is rejected; split large functional areas into physical satellites such as decoupling, clock, flash, input, output, feedback, buttons, and connectors.
- For capacitor banks with at least 2 capacitors on the same power/return nets and one real target supply pin, use capCluster(...). Every capacitor must have both powerNet and returnNet pads, and target must be on powerNet. Do not use capCluster for crystal load capacitors or unrelated capacitors; use bypass/veryNear instead.
- Add blockClearance between a close satellite and its parent IC/block whenever their bodies could overlap.
- Reference designator text is placed automatically on the same side as its component. Use silkscreen.designators({ height, rotations }) for global defaults and component("U1").designatorText(...) only for local overrides or enabled:false.
- For 30+ component boards, prefer solver({ grid: 1, ignoredSignals: ["GND"] }) as a practical starting point. Avoid tiny grids unless quality is worth the slower search. For mechanically tiny boards where fitting everything matters more than soft electrical aesthetics, use solver({ compactness: "high" }).
- For mechanical/debug previews, use solver({ preview: true, placeOnlyComponents: ["J2", "SW1"] }). Preview mode resolves and places only selected components, filters unrelated rules, and returns pcb_tool_report.status="preview" when there are no hard errors. It is not a final board.
- board.auto({ density }) controls target component density from footprint area. Default is 0.4; lower values make a larger board with more routing room for EasyEDA, higher values make a tighter board.
- Do not write routing rules in this DSL. Routing, DRC classes, copper polygons, and via stitching are handled by the EasyEDA v3 client after server-side placement.

Tool output:
- make_pcb_layout returns collected image_url with label "PCB". It is the placement SVG.
- make_pcb_layout also returns pcb_tool_report with categorized dsl, placement, quality, and solver diagnostics.
- If solver preview/placeOnlyComponents/ignoreComponents is used, pcb_tool_report.preview.enabled=true and the result is only for mechanical/debug inspection, not assembly as a final PCB.
- If placement has hard geometry errors, make_pcb_layout still returns the best available PCB image and board assemble when possible; treat pcb_tool_report.status="error" as failed_with_layout, not as success.
- In production mode no debug files may be saved. Use image_url and pcb_tool_report instead of filesystem paths.
- When iterating after a bad layout, inspect pcb_tool_report first: dsl.errors, placement hard errors, quality.blockViolations, quality.criticalPairViolations, solver.likelyCauses, and solver.suggestions.

\`\`\`ts
${PCB_LAYOUT_DSL_TS_DOC}
\`\`\``;

type RuleLevel = PcbRuleLevel;
type Priority = RuleLevel;
type PinTargetRef = Extract<TargetRef, { type: "pin" }>;
type MechanicalFaceDirection = FaceDirection;
type BlockOptions = Partial<Omit<Block, "name" | "description" | "component_designators" | "role">>;
type ModuleOptions = Partial<Omit<Module, "name" | "block_names">>;
type CriticalPairHint = Extract<PlacementRules["hints"][number], { relation: "critical_pair" }>;
type CapClusterHint = Extract<PlacementRules["hints"][number], { relation: "cap_cluster" }>;
type RelationHint = Extract<PlacementHintRule, { relation: "very_near" | "near" | "away_from" | "same_side" | "cluster_with" }>;

type DslRules = PlacementRules;
type BoardRule = PlacementRules["board"];
type PreserveRule = PlacementRules["preserve"];
type BlockRule = PlacementRules["blocks"][number];
type ComponentRule = PlacementRules["component_rules"][number];
type PlacementHintRule = PlacementRules["hints"][number];
type SolverOptionsRule = PlacementRules["solverOptions"];
type CriticalPairOptions = {
    priority?: Priority;
    maxDistance?: CriticalPairHint["maxDistance"];
    minDistance?: CriticalPairHint["minDistance"];
    weight?: number;
    hard?: CriticalPairHint["hard"];
    crossingPenalty?: CriticalPairHint["crossingPenalty"];
    preferFacingPads?: CriticalPairHint["preferFacingPads"];
};

type SignalPathSegmentInput = [PinTargetRef, PinTargetRef, CriticalPairOptions?];
type SignalPathOptions = CriticalPairOptions & {
    shape?: "flexible" | "straight";
};

type RefineGroupOptions = {
    swap?: boolean;
    rotateBy?: number[];
};

type CoreIslandOptions = CriticalPairOptions & {
    pairs?: Array<[PinTargetRef, PinTargetRef]>;
};

type CapClusterOptions = {
    powerNet: CapClusterHint["powerNet"];
    returnNet: CapClusterHint["returnNet"];
    target: PinTargetRef;
    axis?: CapClusterHint["axis"];
    maxRows?: CapClusterHint["maxRows"];
    maxPerRow?: CapClusterHint["maxPerRow"];
    gap?: CapClusterHint["gap"];
    rowGap?: CapClusterHint["rowGap"];
    topology?: CapClusterHint["topology"];
    priority?: Priority;
};

type BoardHoleOptions = {
    at: Extract<TargetRef, { type: "board_anchor" }>;
    offset?: { x?: number; y?: number };
    drill: number;
    diameter?: number;
    keepout?: number;
};

type BoardHoleCornersOptions = Omit<BoardHoleOptions, "at" | "offset"> & {
    inset?: number;
    prefix?: string;
};

type BoardPadCell = BoardPadRule["pads"][number][number];
type BoardPadOptions = {
    at: Extract<TargetRef, { type: "board_anchor" }>;
    offset?: { x?: number; y?: number };
    pitch: number;
    rowPitch?: number;
    layer?: BoardPadRule["layer"];
    block?: string;
    pads: BoardPadCell[][];
};

type SolderJumperOptions = {
    nets: string[];
    usage?: "configuration" | "power";
    current?: number;
    layer?: Layer;
    block?: string;
    at?: Extract<TargetRef, { type: "board_anchor" }>;
    offset?: { x?: number; y?: number };
};

type ThermalPadOptions = {
    at: PinTargetRef;
    power: {
        dissipation: number;
        maxTemperatureRise: number;
    };
    thetaJC?: number;
    limits?: {
        maxSize?: { width: number; height: number };
    };
};

type AntennaOptions = {
    net: string;
    performance: {
        centerFrequency: number;
        minBandwidth?: number;
        impedance?: number;
    };
    strategy?: "efficient" | "balanced" | "compact";
    topology?: "auto" | "monopole" | "meandered_monopole" | "open_stub";
    limits?: {
        maxSize?: { width: number; height: number };
    };
    layer?: Layer;
    block?: string;
};

type ComponentGridOptions = {
    origin?: { x: number; y: number };
    at?: Extract<TargetRef, { type: "board_anchor" }>;
    offset?: { x?: number; y?: number };
    columnPitch: number;
    rowPitch?: number;
    block: string;
    role?: ComponentRole;
    layer?: Layer;
    rotate?: number;
};

type FixedPlacementOptions = FixedPlacement & {
    boardOverflow?: BoardOverflowOptions;
};

type BoardOverflowOptions = number | BoardOverflowAllowance;
type ConstraintRegionShape = ConstraintRegionRule["shape"];
type ConstraintRegionOptions = {
    shape: ConstraintRegionShape;
    layers?: Layer[];
    allow?: {
        blocks?: string[];
    };
};
type RegionRectOptions = {
    anchor: Extract<TargetRef, { type: "board_anchor" }>;
    width: number;
    height: number;
    offset?: { x?: number; y?: number };
};

type EdgeMountOptions = Omit<Partial<EdgeMount>, "edge" | "face"> & {
    face?: EdgeMount["face"] | MechanicalFaceDirection;
};
type EdgePlaceOptions = Omit<Partial<EdgePlace>, "edges" | "face"> & {
    edge?: BoardEdge;
    edges?: BoardEdge[];
    face?: EdgePlace["face"] | MechanicalFaceDirection;
};

type DesignatorTextOptions = NonNullable<ComponentRule["designatorText"]>;
type DesignatorTextInputOptions = {
    enabled?: boolean | null;
    height?: number | null;
    rotations?: number[] | null;
    margin?: number | null;
};

type BoardShapeType = Exclude<BoardRule["type"], "auto" | "rect">;

type BoardShapeBaseOptions = {
    clearance?: number;
    componentClearance?: number;
    edge?: number;
    edgeClearance?: number;
    layers?: Layer[];
    allowedLayers?: Layer[];
    defaultLayer?: Layer;
};

type RoundedRectOptions = BoardShapeBaseOptions & {
    radius?: number;
    segments?: number;
};

type ChamferedRectOptions = BoardShapeBaseOptions & {
    chamfer?: number;
};

type NotchedRectOptions = BoardShapeBaseOptions & {
    side?: BoardEdge;
    notchWidth: number;
    notchDepth: number;
    offset?: number;
};

type CircleOptions = BoardShapeBaseOptions & {
    segments?: number;
};

type OvalOptions = BoardShapeBaseOptions & {
    segments?: number;
};

type LOptions = BoardShapeBaseOptions & {
    cutoutWidth: number;
    cutoutHeight: number;
    corner?: "top_left" | "top_right" | "bottom_right" | "bottom_left";
};

type InverseLOptions = BoardShapeBaseOptions & {
    legWidth: number;
    legHeight: number;
    corner?: "top_left" | "top_right" | "bottom_right" | "bottom_left";
};

type PolygonBoardOptions = BoardShapeBaseOptions;

type PreserveOptions = {
    board?: boolean;
    components?: "all" | string[];
};

export function runPcbLayoutDsl(code: string): DslRules {
    const builder = new PcbLayoutDslBuilder();
    const sandbox = createContext(builder.createSandbox(), {
        codeGeneration: {
            strings: false,
            wasm: false,
        },
    });
    const script = new Script(`"use strict";\n${code}`, {
        filename: "pcb-layout-dsl.js",
    });

    script.runInContext(sandbox, { timeout: 1000, displayErrors: true });
    return builder.toRules();
}

class PcbLayoutDslBuilder {
    private boardRule: BoardRule | null = null;
    private preserveRule: PreserveRule;
    private readonly boardHoles: BoardHoleRule[] = [];
    private readonly boardPads: BoardPadRule[] = [];
    private readonly proceduralFeatures: ProceduralFeatureRule[] = [];
    private readonly constraintRegions: ConstraintRegionRule[] = [];
    private readonly blocks = new Map<string, BlockRule>();
    private readonly modules = new Map<string, Module>();
    private readonly components = new Map<string, ComponentRule>();
    private readonly hints: PlacementHintRule[] = [];
    private readonly paths = new Map<string, SignalPathRule>();
    private readonly refineGroups = new Map<string, RefineGroupRule>();
    private silkscreenDesignators: DesignatorTextOptions | null = null;
    private solverOptions: SolverOptionsRule = null;

    createSandbox() {
        const builder = this;
        const boardHole = (name: string, options: BoardHoleOptions) => builder.boardHole(name, options);
        Object.assign(boardHole, {
            corners: (options: BoardHoleCornersOptions) => builder.boardHoleCorners(options),
        });
        return {
            board: {
                auto: (options: Record<string, unknown> = {}) => builder.setAutoBoard(options),
                rect: (width: number, height: number, options: Record<string, unknown> = {}) => builder.setRectBoard(width, height, options),
                roundedRect: (width: number, height: number, options: RoundedRectOptions = {}) => builder.setShapeBoard("roundedRect", { width, height, ...options }),
                chamferedRect: (width: number, height: number, options: ChamferedRectOptions = {}) => builder.setShapeBoard("chamferedRect", { width, height, ...options }),
                notchedRect: (width: number, height: number, options: NotchedRectOptions) => builder.setShapeBoard("notchedRect", { width, height, ...options }),
                circle: (diameter: number, options: CircleOptions = {}) => builder.setShapeBoard("circle", { diameter, ...options }),
                oval: (width: number, height: number, options: OvalOptions = {}) => builder.setShapeBoard("oval", { width, height, ...options }),
                L: (width: number, height: number, options: LOptions) => builder.setShapeBoard("L", { width, height, ...options }),
                inverseL: (width: number, height: number, options: InverseLOptions) => builder.setShapeBoard("inverseL", { width, height, ...options }),
                polygon: (points: Array<{ x: number; y: number }>, options: PolygonBoardOptions = {}) => builder.setShapeBoard("polygon", { points, ...options }),
            },
            preserve: (options: PreserveOptions) => builder.preserve(options),
            boardHole,
            boardPad: (name: string, options: BoardPadOptions) => builder.boardPad(name, options),
            solderJumper: (name: string, options: SolderJumperOptions) => builder.solderJumper(name, options),
            primitive: {
                thermalPad: (name: string, options: ThermalPadOptions) => builder.thermalPad(name, options),
            },
            componentGrid: (name: string, components: string[][], options: ComponentGridOptions) =>
                builder.componentGrid(name, components, options),
            edgePlace: (designators: string | string[], options: EdgePlaceOptions) =>
                builder.edgePlace(designators, options),
            region: {
                rect: (options: RegionRectOptions): ConstraintRegionShape => ({
                    type: "rect",
                    anchor: options.anchor,
                    width: requiredPositiveNumber(options.width, "region.rect.width"),
                    height: requiredPositiveNumber(options.height, "region.rect.height"),
                    offset: normalizePointOffset(options.offset),
                }),
            },
            constraintRegion: (name: string, options: ConstraintRegionOptions) =>
                builder.constraintRegion(name, options),
            silkscreen: {
                designators: (options: DesignatorTextInputOptions = {}) => builder.silkscreenDesignators = normalizeDesignatorTextOptions(options),
            },
            block: (
                name: string,
                designators?: string[],
                role = "generic",
                descriptionOrOptions: string | null | BlockOptions = null,
                options: BlockOptions = {},
            ) => builder.block(name, designators, role, descriptionOrOptions, options),
            module: (name: string, blockNames: string[], options: ModuleOptions = {}) =>
                builder.module(name, blockNames, options),
            component: (designator: string) => builder.component(designator),
            fixed: (designator: string, options: FixedPlacementOptions) => builder.fixed(designator, options),
            edgeMount: (designator: string, edge: BoardEdge, options: EdgeMountOptions = {}) =>
                builder.edgeMount(designator, edge, options),
            comp: (designator: string): TargetRef => ({ type: "component", designator }),
            pin: (designator: string, pin_number: string | number): TargetRef => ({ type: "pin", designator, pin_number }),
            anchor: (anchor: BoardAnchor): TargetRef => ({ type: "board_anchor", anchor }),
            near: (source: TargetRef, target: TargetRef, priority: Priority = "high") => builder.relation("near", source, target, priority),
            veryNear: (source: TargetRef, target: TargetRef, priority: Priority = "critical") => builder.relation("very_near", source, target, priority),
            away: (source: TargetRef, target: TargetRef, priority: Priority = "normal") => builder.relation("away_from", source, target, priority),
            sameSide: (source: TargetRef, target: TargetRef, priority: Priority = "high") => builder.relation("same_side", source, target, priority),
            cluster: (source: TargetRef, target: TargetRef, priority: Priority = "high") => builder.relation("cluster_with", source, target, priority),
            clearance: (source: TargetRef, target: TargetRef | "all", min: number, priority: Priority = "high") => builder.clearance(source, target, min, priority),
            blockClearance: (sourceBlock: string, targetBlock: string | "all", min: number, priority: Priority = "high") =>
                builder.blockClearance(sourceBlock, targetBlock, min, priority),
            edge: (source: TargetRef | string, edgeValue: string, priority: Priority = "critical", orientation: "outward" | "inward" | "any" | null = "outward") =>
                builder.edge(source, edgeValue, priority, orientation),
            line: (components: string[], axis: "x" | "y", options: Record<string, unknown> = {}) => builder.line(components, axis, options),
            bypass: (capacitors: string[], target: Extract<TargetRef, { type: "pin" }>, priority: Priority = "critical", options: Record<string, unknown> = {}) =>
                builder.bypass(capacitors, target, priority, options),
            capCluster: (capacitors: string[], options: CapClusterOptions) =>
                builder.capCluster(capacitors, options),
            criticalPair: (source: PinTargetRef, target: PinTargetRef, options: CriticalPairOptions = {}) =>
                builder.criticalPair(source, target, options),
            signalPath: (name: string, segments: SignalPathSegmentInput[], options: SignalPathOptions = {}) =>
                builder.signalPath(name, segments, options),
            refineGroup: (name: string, components: string[], options: RefineGroupOptions = {}) =>
                builder.refineGroup(name, components, options),
            corePairs: (blockName: string, pairs: Array<[PinTargetRef, PinTargetRef]>, options: CriticalPairOptions = {}) =>
                builder.corePairs(blockName, pairs, options),
            coreIsland: (name: string, components: string[], options: CoreIslandOptions = {}) =>
                builder.coreIsland(name, components, options),
            solver: (options: Record<string, unknown>) => builder.solver(options),
        };
    }

    toRules(): DslRules {
        return {
            board: this.boardRule ?? this.setAutoBoard({}),
            preserve: this.preserveRule,
            boardHoles: this.boardHoles,
            boardPads: this.boardPads,
            proceduralFeatures: this.proceduralFeatures,
            constraintRegions: this.constraintRegions,
            silkscreen: {
                designators: this.silkscreenDesignators,
            },
            blocks: [...this.blocks.values()],
            modules: [...this.modules.values()],
            component_rules: [...this.components.values()],
            hints: this.hints,
            paths: [...this.paths.values()],
            refineGroups: [...this.refineGroups.values()],
            solverOptions: this.solverOptions,
        };
    }

    private preserve(options: PreserveOptions) {
        rejectUnknownOptionKeys(options, ["board", "components"], "preserve(...)");
        if (!options || typeof options !== "object") throw new Error("preserve(...) requires options.");
        if (options.board !== undefined && typeof options.board !== "boolean") {
            throw new Error("preserve(...).board must be boolean.");
        }
        if (options.components !== undefined
            && options.components !== "all"
            && !Array.isArray(options.components)) {
            throw new Error('preserve(...).components must be "all" or a component designator array.');
        }
        this.preserveRule = {
            ...(options.board !== undefined ? { board: options.board } : {}),
            ...(options.components !== undefined ? {
                components: options.components === "all"
                    ? "all"
                    : [...new Set(options.components.filter((item): item is string => typeof item === "string" && item.length > 0))],
            } : {}),
        };
    }

    private setAutoBoard(options: Record<string, unknown>): BoardRule {
        this.boardRule = {
            type: "auto",
            aspectRatio: nullableNumber(options.aspectRatio),
            componentDensity: nullableNumber(options.density ?? options.componentDensity),
            minWidth: nullableNumber(options.minWidth),
            minHeight: nullableNumber(options.minHeight),
            maxWidth: nullableNumber(options.maxWidth),
            maxHeight: nullableNumber(options.maxHeight),
            componentClearance: nullableNumber(options.clearance ?? options.componentClearance),
            edgeClearance: nullableNumber(options.edge ?? options.edgeClearance),
            allowedLayers: nullableLayers(options.layers ?? options.allowedLayers),
            defaultLayer: nullableLayer(options.defaultLayer),
        };
        return this.boardRule;
    }

    private setRectBoard(width: number, height: number, options: Record<string, unknown>): BoardRule {
        this.boardRule = {
            type: "rect",
            width,
            height,
            componentClearance: nullableNumber(options.clearance ?? options.componentClearance),
            edgeClearance: nullableNumber(options.edge ?? options.edgeClearance),
            allowedLayers: nullableLayers(options.layers ?? options.allowedLayers),
            defaultLayer: nullableLayer(options.defaultLayer),
        };
        return this.boardRule;
    }

    private setShapeBoard(type: BoardShapeType, options: Record<string, unknown>): BoardRule {
        const common = this.boardCommonOptions(options);
        if (type === "polygon") {
            const points = Array.isArray(options.points)
                ? options.points.flatMap((point) => {
                    if (!point || typeof point !== "object") return [];
                    const x = nullableNumber((point as { x?: unknown }).x);
                    const y = nullableNumber((point as { y?: unknown }).y);
                    return x === null || y === null ? [] : [{ x, y }];
                })
                : [];
            if (points.length < 3) throw new Error("board.polygon(...) requires at least 3 points.");
            this.boardRule = { type, points, ...common };
            return this.boardRule;
        }
        if (type === "roundedRect") {
            this.boardRule = {
                type,
                width: requiredPositiveNumber(options.width, "board.roundedRect width"),
                height: requiredPositiveNumber(options.height, "board.roundedRect height"),
                radius: nullableNumber(options.radius),
                segments: nullableNumber(options.segments),
                ...common,
            };
            return this.boardRule;
        }
        if (type === "chamferedRect") {
            this.boardRule = {
                type,
                width: requiredPositiveNumber(options.width, "board.chamferedRect width"),
                height: requiredPositiveNumber(options.height, "board.chamferedRect height"),
                chamfer: nullableNumber(options.chamfer),
                ...common,
            };
            return this.boardRule;
        }
        if (type === "notchedRect") {
            this.boardRule = {
                type,
                width: requiredPositiveNumber(options.width, "board.notchedRect width"),
                height: requiredPositiveNumber(options.height, "board.notchedRect height"),
                side: normalizeBoardEdge(options.side),
                notchWidth: requiredPositiveNumber(options.notchWidth, "board.notchedRect notchWidth"),
                notchDepth: requiredPositiveNumber(options.notchDepth, "board.notchedRect notchDepth"),
                offset: nullableNumber(options.offset),
                ...common,
            };
            return this.boardRule;
        }
        if (type === "circle") {
            this.boardRule = {
                type,
                diameter: requiredPositiveNumber(options.diameter, "board.circle diameter"),
                segments: nullableNumber(options.segments),
                ...common,
            };
            return this.boardRule;
        }
        if (type === "oval") {
            this.boardRule = {
                type,
                width: requiredPositiveNumber(options.width, "board.oval width"),
                height: requiredPositiveNumber(options.height, "board.oval height"),
                segments: nullableNumber(options.segments),
                ...common,
            };
            return this.boardRule;
        }
        if (type === "L") {
            this.boardRule = {
                type,
                width: requiredPositiveNumber(options.width, "board.L width"),
                height: requiredPositiveNumber(options.height, "board.L height"),
                cutoutWidth: requiredPositiveNumber(options.cutoutWidth, "board.L cutoutWidth"),
                cutoutHeight: requiredPositiveNumber(options.cutoutHeight, "board.L cutoutHeight"),
                corner: normalizeBoardCorner(options.corner),
                ...common,
            };
            return this.boardRule;
        }
        this.boardRule = {
            type,
            width: requiredPositiveNumber(options.width, "board.inverseL width"),
            height: requiredPositiveNumber(options.height, "board.inverseL height"),
            legWidth: requiredPositiveNumber(options.legWidth, "board.inverseL legWidth"),
            legHeight: requiredPositiveNumber(options.legHeight, "board.inverseL legHeight"),
            corner: normalizeBoardCorner(options.corner),
            ...common,
        };
        return this.boardRule;
    }

    private boardCommonOptions(options: Record<string, unknown>) {
        return {
            componentClearance: nullableNumber(options.clearance ?? options.componentClearance),
            edgeClearance: nullableNumber(options.edge ?? options.edgeClearance),
            allowedLayers: nullableLayers(options.layers ?? options.allowedLayers),
            defaultLayer: nullableLayer(options.defaultLayer),
        };
    }

    private boardHole(name: string, options: BoardHoleOptions) {
        if (!options || options.at?.type !== "board_anchor") {
            throw new Error(`boardHole("${name}") requires at: anchor("board...")`);
        }
        const drill = nullableNumber(options.drill);
        if (drill === null || drill <= 0) throw new Error(`boardHole("${name}") requires positive drill.`);
        this.boardHoles.push({
            name,
            at: options.at,
            outlineCorner: null,
            inset: null,
            offset: normalizePointOffset(options.offset),
            drill,
            diameter: nullableNumber(options.diameter),
            keepout: nullableNumber(options.keepout),
        });
    }

    private boardPad(name: string, options: BoardPadOptions) {
        if (!name || typeof name !== "string") throw new Error(`boardPad(...) requires a non-empty name.`);
        if (this.components.has(name)) throw new Error(`boardPad("${name}") conflicts with an existing component("${name}") rule.`);
        if (!options || options.at?.type !== "board_anchor") {
            throw new Error(`boardPad("${name}") requires at: anchor("board...").`);
        }
        const pitch = requiredPositiveNumber(options.pitch, `boardPad("${name}").pitch`);
        const rowPitch = requiredPositiveNumber(options.rowPitch ?? options.pitch, `boardPad("${name}").rowPitch`);
        const layer = isOneOf(PCB_BOARD_PAD_LAYERS, options.layer) ? options.layer : "multi";
        const pads = normalizeBoardPadMatrix(name, options.pads, layer);
        const blockName = typeof options.block === "string" && options.block.length > 0 ? options.block : name;
        const footprint = boardPadFootprint(name, pads, pitch, rowPitch);

        this.boardPads.push({
            name,
            at: options.at,
            offset: normalizePointOffset(options.offset),
            pitch,
            rowPitch,
            layer,
            block: blockName,
            pads,
        });
        this.components.set(name, {
            designator: name,
            block_name: blockName,
            role: "connector",
            footprint,
            allowedLayers: layer === "bottom" ? ["bottom"] : ["top"],
            allowedRotations: [0],
            fixedPlacement: {
                x: null,
                y: null,
                anchor: options.at,
                offset: normalizePointOffset(options.offset),
                rotate: 0,
                layer: layer === "bottom" ? "bottom" : "top",
            },
            boardOverflow: null,
            edgeMount: null,
            edgePlace: null,
            mechanicalFaceAt0: null,
            faceTo: null,
            designatorText: { enabled: false, height: null, rotations: null, margin: null },
        });

        const existingBlock = this.blocks.get(blockName);
        if (existingBlock) {
            if (!existingBlock.component_designators.includes(name)) {
                existingBlock.component_designators.push(name);
            }
        } else {
            this.blocks.set(blockName, {
                name: blockName,
                description: blockName,
                component_designators: [name],
                role: "connector",
                placement: null,
                attachTo: null,
                anchor: null,
                anchorOffset: null,
                sidePreference: null,
                maxBboxScale: null,
                maxBboxWidth: null,
                maxBboxHeight: null,
                hardBbox: null,
                maxAnchorGap: null,
                hardAnchor: null,
                familyMaxBboxScale: null,
                familyMaxWidth: null,
                familyMaxHeight: null,
                familyHard: null,
                placementClearance: null,
                allowDisconnected: true,
            });
        }
    }

    private solderJumper(name: string, options: SolderJumperOptions) {
        if (!name || typeof name !== "string") throw new Error(`solderJumper(...) requires a non-empty name.`);
        rejectUnknownOptionKeys(options, ["nets", "usage", "current", "layer", "block", "at", "offset"], `solderJumper("${name}")`);
        if (this.components.has(name)) throw new Error(`solderJumper("${name}") conflicts with an existing component rule.`);
        if (!options || !Array.isArray(options.nets) || (options.nets.length !== 2 && options.nets.length !== 3)) {
            throw new Error(`solderJumper("${name}") requires nets with exactly 2 or 3 entries.`);
        }
        const nets = options.nets.map((net) => typeof net === "string" ? net.trim() : "");
        if (nets.some((net) => !net)) throw new Error(`solderJumper("${name}") nets must be non-empty strings.`);
        if (new Set(nets).size !== nets.length) throw new Error(`solderJumper("${name}") nets must be distinct.`);
        if (options.at !== undefined && options.at.type !== "board_anchor") {
            throw new Error(`solderJumper("${name}").at must be anchor("board...").`);
        }
        const rule: Extract<ProceduralFeatureRule, { kind: "solder_jumper" }> = {
            kind: "solder_jumper",
            name,
            nets,
            usage: options.usage === "power" ? "power" : "configuration",
            current: nullableNumber(options.current),
            layer: nullableLayer(options.layer) ?? "top",
            block: typeof options.block === "string" && options.block.length > 0 ? options.block : name,
            at: options.at ?? null,
            offset: normalizePointOffset(options.offset) ?? null,
        };
        const compiled = compileSolderJumper(rule);
        this.proceduralFeatures.push(rule);
        this.registerProceduralComponent({
            name,
            block: rule.block ?? name,
            blockRole: rule.usage === "power" ? "power" : "generic",
            componentRole: rule.at ? "connector" : "passive",
            layer: rule.layer,
            footprint: compiled.footprint,
            fixedPlacement: rule.at ? {
                x: null,
                y: null,
                anchor: rule.at,
                offset: rule.offset,
                rotate: 0,
                layer: rule.layer,
            } : null,
        });
    }

    private thermalPad(name: string, options: ThermalPadOptions) {
        if (!name || typeof name !== "string") throw new Error(`primitive.thermalPad(...) requires a non-empty name.`);
        rejectUnknownOptionKeys(options, ["at", "power", "thetaJC", "limits"], `primitive.thermalPad("${name}")`);
        if (!options || options.at?.type !== "pin") throw new Error(`primitive.thermalPad("${name}") requires at: pin("U1", "EP").`);
        const dissipation = requiredPositiveNumber(options.power?.dissipation, `primitive.thermalPad("${name}").power.dissipation`);
        const maxTemperatureRise = requiredPositiveNumber(options.power?.maxTemperatureRise, `primitive.thermalPad("${name}").power.maxTemperatureRise`);
        const thetaJC = options.thetaJC === undefined
            ? null
            : requiredPositiveNumber(options.thetaJC, `primitive.thermalPad("${name}").thetaJC`);
        const maxSize = options.limits?.maxSize ? {
            width: requiredPositiveNumber(options.limits.maxSize.width, `primitive.thermalPad("${name}").limits.maxSize.width`),
            height: requiredPositiveNumber(options.limits.maxSize.height, `primitive.thermalPad("${name}").limits.maxSize.height`),
        } : null;
        this.proceduralFeatures.push({
            kind: "thermal_pad",
            name,
            at: options.at,
            dissipation,
            maxTemperatureRise,
            thetaJC,
            maxSize,
        });
    }

    private antenna(name: string, options: AntennaOptions) {
        if (!name || typeof name !== "string") throw new Error(`primitive.antenna(...) requires a non-empty name.`);
        rejectUnknownOptionKeys(options, ["net", "performance", "strategy", "topology", "limits", "layer", "block"], `primitive.antenna("${name}")`);
        if (this.components.has(name)) throw new Error(`primitive.antenna("${name}") conflicts with an existing component rule.`);
        const net = typeof options?.net === "string" ? options.net.trim() : "";
        if (!net) throw new Error(`primitive.antenna("${name}") requires a non-empty net.`);
        const maxSize = options.limits?.maxSize ? {
            width: requiredPositiveNumber(options.limits.maxSize.width, `primitive.antenna("${name}").limits.maxSize.width`),
            height: requiredPositiveNumber(options.limits.maxSize.height, `primitive.antenna("${name}").limits.maxSize.height`),
        } : null;
        const topology = options.topology === "monopole" || options.topology === "meandered_monopole" || options.topology === "open_stub"
            ? options.topology
            : "auto";
        const rule: Extract<ProceduralFeatureRule, { kind: "antenna" }> = {
            kind: "antenna",
            name,
            net,
            centerFrequency: requiredPositiveNumber(options.performance?.centerFrequency, `primitive.antenna("${name}").performance.centerFrequency`),
            minBandwidth: options.performance?.minBandwidth === undefined
                ? null
                : requiredPositiveNumber(options.performance.minBandwidth, `primitive.antenna("${name}").performance.minBandwidth`),
            impedance: requiredPositiveNumber(options.performance?.impedance ?? 50, `primitive.antenna("${name}").performance.impedance`),
            strategy: options.strategy === "efficient" || options.strategy === "compact" ? options.strategy : "balanced",
            topology,
            maxSize,
            layer: nullableLayer(options.layer) ?? "top",
            block: typeof options.block === "string" && options.block.length > 0 ? options.block : name,
        };
        const compiled = compileAntenna(rule);
        this.proceduralFeatures.push(rule);
        this.registerProceduralComponent({
            name,
            block: rule.block ?? name,
            blockRole: "rf",
            componentRole: "connector",
            layer: rule.layer,
            footprint: compiled.footprint,
            fixedPlacement: null,
        });
    }

    private registerProceduralComponent(options: {
        name: string;
        block: string;
        blockRole: Block["role"];
        componentRole: ComponentRole;
        layer: Layer;
        footprint: FootprintSpec;
        fixedPlacement: ComponentRule["fixedPlacement"];
    }) {
        this.components.set(options.name, {
            designator: options.name,
            block_name: options.block,
            role: options.componentRole,
            footprint: options.footprint ? {
                ...options.footprint,
                pads: options.footprint.pads.map((pad) => ({ ...pad, name: pad.name ?? null, shape: pad.shape ?? null, mount: pad.mount ?? null, drillDiameter: pad.drillDiameter ?? null })),
            } : null,
            allowedLayers: [options.layer],
            allowedRotations: [0, 90, 180, 270],
            fixedPlacement: options.fixedPlacement,
            boardOverflow: null,
            edgeMount: null,
            edgePlace: null,
            mechanicalFaceAt0: null,
            faceTo: null,
            designatorText: { enabled: false, height: null, rotations: null, margin: null },
        });
        const existingBlock = this.blocks.get(options.block);
        if (existingBlock) {
            if (!existingBlock.component_designators.includes(options.name)) existingBlock.component_designators.push(options.name);
            return;
        }
        this.blocks.set(options.block, {
            name: options.block,
            description: options.block,
            component_designators: [options.name],
            role: options.blockRole,
            placement: null,
            attachTo: null,
            anchor: null,
            anchorOffset: null,
            sidePreference: null,
            maxBboxScale: null,
            maxBboxWidth: null,
            maxBboxHeight: null,
            hardBbox: null,
            maxAnchorGap: null,
            hardAnchor: null,
            familyMaxBboxScale: null,
            familyMaxWidth: null,
            familyMaxHeight: null,
            familyHard: null,
            placementClearance: null,
            allowDisconnected: true,
        });
    }

    private componentGrid(name: string, components: string[][], options: ComponentGridOptions) {
        if (!name || typeof name !== "string") throw new Error(`componentGrid(...) requires a non-empty name.`);
        if (!options || typeof options !== "object") throw new Error(`componentGrid("${name}") requires options.`);
        const matrix = normalizeComponentGridMatrix(name, components);
        const designators = matrix.flat();
        if (designators.length < 3) {
            throw new Error(`componentGrid("${name}") requires at least 3 components. Use fixed() for one-off mechanical placement.`);
        }
        const blockName = typeof options.block === "string" && options.block.length > 0 ? options.block : null;
        if (!blockName) throw new Error(`componentGrid("${name}") requires options.block.`);

        this.ensureComponentGridBlock(blockName, designators);

        const origin = normalizeComponentGridOrigin(name, options);
        const columnPitch = requiredPositiveNumber(options.columnPitch, `componentGrid("${name}").columnPitch`);
        const rowPitch = requiredPositiveNumber(options.rowPitch ?? options.columnPitch, `componentGrid("${name}").rowPitch`);
        const role = isOneOf(PCB_COMPONENT_ROLES, options.role) ? options.role : "connector";
        const layer = nullableLayer(options.layer) ?? "top";
        const rotate = nullableNumber(options.rotate) ?? 0;

        matrix.forEach((row, rowIndex) => {
            row.forEach((designator, columnIndex) => {
                const cellOffset = { x: columnIndex * columnPitch, y: rowIndex * rowPitch };
                const fixedPlacement = origin.anchor
                    ? {
                        x: null,
                        y: null,
                        anchor: origin.anchor,
                        offset: addPointOffsets(origin.offset, cellOffset),
                        rotate,
                        layer,
                    }
                    : {
                        x: (origin.x ?? 0) + cellOffset.x,
                        y: (origin.y ?? 0) + cellOffset.y,
                        anchor: null,
                        offset: null,
                        rotate,
                        layer,
                    };
                this.component(designator)
                    .block(blockName)
                    .role(role)
                    .layers(layer)
                    .fixed(fixedPlacement);
            });
        });
    }

    private ensureComponentGridBlock(blockName: string, designators: string[]) {
        const existing = this.blocks.get(blockName);
        if (existing) {
            for (const designator of designators) {
                if (!existing.component_designators.includes(designator)) {
                    existing.component_designators.push(designator);
                }
            }
            existing.allowDisconnected = existing.allowDisconnected ?? true;
            return;
        }

        this.blocks.set(blockName, {
            name: blockName,
            description: blockName,
            component_designators: designators,
            role: "connector",
            placement: null,
            attachTo: null,
            anchor: null,
            anchorOffset: null,
            sidePreference: null,
            maxBboxScale: null,
            maxBboxWidth: null,
            maxBboxHeight: null,
            hardBbox: null,
            maxAnchorGap: null,
            hardAnchor: null,
            familyMaxBboxScale: null,
            familyMaxWidth: null,
            familyMaxHeight: null,
            familyHard: null,
            placementClearance: null,
            allowDisconnected: true,
        });
    }

    private constraintRegion(name: string, options: ConstraintRegionOptions) {
        if (!options?.shape || options.shape.type !== "rect") {
            throw new Error(`constraintRegion("${name}") requires shape: region.rect({ anchor, width, height }).`);
        }
        this.constraintRegions.push({
            name,
            shape: options.shape,
            layers: nullableLayers(options.layers) ?? [...PCB_LAYERS],
            allow: {
                blocks: Array.isArray(options.allow?.blocks)
                    ? options.allow.blocks.filter((blockName) => typeof blockName === "string")
                    : [],
            },
        });
    }

    private boardHoleCorners(options: BoardHoleCornersOptions) {
        const inset = nullableNumber(options.inset) ?? 3;
        const prefix = typeof options.prefix === "string" && options.prefix.length > 0 ? options.prefix : "MH";
        const corners: Array<[string, BoardAnchor, "top_left" | "top_right" | "bottom_right" | "bottom_left"]> = [
            ["1", "board.top_left", "top_left"],
            ["2", "board.top_right", "top_right"],
            ["3", "board.bottom_right", "bottom_right"],
            ["4", "board.bottom_left", "bottom_left"],
        ];
        for (const [suffix, anchorValue, outlineCorner] of corners) {
            const drill = nullableNumber(options.drill);
            if (drill === null || drill <= 0) throw new Error(`boardHole.corners(...) requires positive drill.`);
            this.boardHoles.push({
                name: `${prefix}${suffix}`,
                at: { type: "board_anchor", anchor: anchorValue },
                outlineCorner,
                inset,
                offset: null,
                drill,
                diameter: nullableNumber(options.diameter),
                keepout: nullableNumber(options.keepout),
            });
        }
    }

    private block(name: string, designators?: string[], role = "generic", descriptionOrOptions: string | null | BlockOptions = null, options: BlockOptions = {}): TargetRef {
        if (Array.isArray(designators)) {
            const description = typeof descriptionOrOptions === "string" ? descriptionOrOptions : null;
            const parsedOptions = typeof descriptionOrOptions === "object" && descriptionOrOptions !== null
                ? descriptionOrOptions
                : options;
            this.blocks.set(name, {
                name,
                description,
                component_designators: designators,
                role: normalizeBlockRole(role),
                placement: normalizeBlockPlacement(parsedOptions.placement),
                attachTo: typeof parsedOptions.attachTo === "string" ? parsedOptions.attachTo : null,
                anchor: isTargetRef(parsedOptions.anchor) ? parsedOptions.anchor : null,
                anchorOffset: normalizePointOffset(parsedOptions.anchorOffset),
                sidePreference: normalizeBoardEdge(parsedOptions.sidePreference),
                maxBboxScale: nullableNumber(parsedOptions.maxBboxScale),
                maxBboxWidth: nullableNumber(parsedOptions.maxBboxWidth),
                maxBboxHeight: nullableNumber(parsedOptions.maxBboxHeight),
                hardBbox: nullableBoolean(parsedOptions.hardBbox),
                maxAnchorGap: nullableNumber(parsedOptions.maxAnchorGap),
                hardAnchor: nullableBoolean(parsedOptions.hardAnchor),
                familyMaxBboxScale: nullableNumber(parsedOptions.familyMaxBboxScale),
                familyMaxWidth: nullableNumber(parsedOptions.familyMaxWidth),
                familyMaxHeight: nullableNumber(parsedOptions.familyMaxHeight),
                familyHard: nullableBoolean(parsedOptions.familyHard),
                placementClearance: nullableNumber(parsedOptions.placementClearance),
                allowDisconnected: nullableBoolean(parsedOptions.allowDisconnected),
            });
            for (const designator of designators) {
                this.component(designator).block(name);
            }
        }
        return { type: "block", block_name: name };
    }

    private module(name: string, blockNames: string[], options: ModuleOptions = {}) {
        this.modules.set(name, {
            name,
            block_names: Array.isArray(blockNames) ? blockNames.filter((blockName) => typeof blockName === "string") : [],
            anchor: isTargetRef(options.anchor) ? options.anchor : null,
            sidePreference: normalizeBoardEdge(options.sidePreference),
            maxBboxScale: nullableNumber(options.maxBboxScale),
            maxWidth: nullableNumber(options.maxWidth),
            maxHeight: nullableNumber(options.maxHeight),
            hardBbox: nullableBoolean(options.hardBbox),
            lockInternalAfterPlace: nullableBoolean(options.lockInternalAfterPlace),
            allowInternalRefine: normalizeModuleInternalRefine(options.allowInternalRefine),
            placementPriority: isOneOf(PCB_RULE_LEVELS, options.placementPriority) ? options.placementPriority : null,
        });
    }

    private component(designator: string) {
        if (!this.components.has(designator)) {
            this.components.set(designator, {
                designator,
                block_name: null,
                role: null,
                footprint: null,
                allowedLayers: null,
                allowedRotations: null,
                fixedPlacement: null,
                boardOverflow: null,
                edgeMount: null,
                edgePlace: null,
                mechanicalFaceAt0: null,
                faceTo: null,
                designatorText: null,
            });
        }
        const rule = this.components.get(designator)!;
        return {
            block: (block_name: string) => {
                rule.block_name = block_name;
                return this.component(designator);
            },
            role: (role: ComponentRole) => {
                rule.role = role;
                return this.component(designator);
            },
            layers: (...layers: Layer[]) => {
                rule.allowedLayers = layers;
                return this.component(designator);
            },
            top: () => {
                rule.allowedLayers = ["top"];
                return this.component(designator);
            },
            bottom: () => {
                rule.allowedLayers = ["bottom"];
                return this.component(designator);
            },
            rotations: (...rotations: number[]) => {
                rule.allowedRotations = rotations;
                return this.component(designator);
            },
            faceAt0: (direction: MechanicalFaceDirection) => {
                rule.mechanicalFaceAt0 = normalizeMechanicalFaceDirection(direction);
                return this.component(designator);
            },
            faceTo: (direction: MechanicalFaceDirection) => {
                rule.faceTo = normalizeMechanicalFaceDirection(direction);
                return this.component(designator);
            },
            edgeMount: (edge: BoardEdge, options: EdgeMountOptions = {}) => {
                this.setEdgeMount(rule, designator, edge, options);
                return this.component(designator);
            },
            edgePlace: (edgeOrEdges: BoardEdge | BoardEdge[], options: EdgePlaceOptions = {}) => {
                this.setEdgePlace(rule, designator, { ...options, edges: Array.isArray(edgeOrEdges) ? edgeOrEdges : [edgeOrEdges] });
                return this.component(designator);
            },
            fixed: (options: FixedPlacementOptions) => {
                rule.fixedPlacement = normalizeFixedPlacement(options);
                if (options.boardOverflow !== undefined) rule.boardOverflow = normalizeBoardOverflow(options.boardOverflow);
                return this.component(designator);
            },
            place: (options: FixedPlacementOptions) => {
                rule.fixedPlacement = normalizeFixedPlacement(options);
                if (options.boardOverflow !== undefined) rule.boardOverflow = normalizeBoardOverflow(options.boardOverflow);
                return this.component(designator);
            },
            boardOverflow: (options: BoardOverflowOptions) => {
                rule.boardOverflow = normalizeBoardOverflow(options);
                return this.component(designator);
            },
            designatorText: (options: DesignatorTextInputOptions = {}) => {
                rule.designatorText = normalizeDesignatorTextOptions(options);
                return this.component(designator);
            },
        };
    }

    private relation(relation: RelationHint["relation"], source: TargetRef, target: TargetRef, priority: Priority) {
        this.hints.push({ relation, source, target, priority: normalizeRuleLevel(priority) });
    }

    private clearance(source: TargetRef, target: TargetRef | "all", min: number, priority: Priority) {
        this.hints.push({ relation: "clearance", source, target, min, priority: normalizeRuleLevel(priority) });
    }

    private blockClearance(sourceBlock: string, targetBlock: string | "all", min: number, priority: Priority) {
        this.clearance(
            { type: "block", block_name: sourceBlock },
            targetBlock === "all" ? "all" : { type: "block", block_name: targetBlock },
            min,
            priority,
        );
    }

    private edge(source: TargetRef | string, edge: string, priority: Priority, orientation: "outward" | "inward" | "any" | null) {
        const normalizedEdge = normalizeBoardEdge(edge);
        if (!normalizedEdge) throw new Error(`Invalid edge hint edge: ${edge}`);
        const edgeSource = typeof source === "string" ? this.stringTarget(source) : source;
        if (edgeSource.type !== "component" && edgeSource.type !== "block") {
            throw new Error(`edge(...) source must be a component or block target.`);
        }
        this.hints.push({
            relation: "edge",
            source: edgeSource,
            edge: normalizedEdge,
            orientation,
            priority: normalizeRuleLevel(priority),
        });
    }

    private line(components: string[], axis: "x" | "y", options: Record<string, unknown>) {
        this.hints.push({
            relation: "line",
            components,
            axis,
            gap: nullableNumber(options.gap),
            rotate: nullableNumber(options.rotate),
            priority: normalizeRuleLevel(options.priority ?? "high"),
        });
    }

    private bypass(capacitors: string[], target: Extract<TargetRef, { type: "pin" }>, priority: Priority, options: Record<string, unknown>) {
        this.hints.push({
            relation: "bypass",
            capacitors,
            target,
            axis: normalizeAxis(options.axis),
            gap: nullableNumber(options.gap),
            rotate: nullableNumber(options.rotate),
            priority: normalizeRuleLevel(priority),
        });
    }

    private capCluster(capacitors: string[], options: CapClusterOptions) {
        const capacitorList = Array.isArray(capacitors) ? capacitors.filter((designator) => typeof designator === "string") : [];
        if (capacitorList.length < 2) {
            throw new Error(`capCluster(...) requires at least 2 capacitors. For a single capacitor, use veryNear(pin("C1", "..."), pin("U1", "...")) or bypass(["C1"], targetPin).`);
        }
        this.hints.push({
            relation: "cap_cluster",
            capacitors: capacitorList,
            powerNet: typeof options.powerNet === "string" ? options.powerNet : "",
            returnNet: typeof options.returnNet === "string" ? options.returnNet : "GND",
            target: options.target?.type === "pin" ? options.target : null,
            axis: options.axis ?? null,
            maxRows: options.maxRows === 1 || options.maxRows === 2 ? options.maxRows : null,
            maxPerRow: nullableNumber(options.maxPerRow),
            gap: nullableNumber(options.gap),
            rowGap: nullableNumber(options.rowGap),
            topology: isOneOf(PCB_CAP_CLUSTER_TOPOLOGIES, options.topology) ? options.topology : null,
            priority: normalizeRuleLevel(options.priority ?? "critical"),
        });
    }

    private criticalPair(source: PinTargetRef, target: PinTargetRef, options: CriticalPairOptions = {}, core = false, blockName: string | null = null) {
        this.hints.push({
            relation: "critical_pair",
            source,
            target,
            priority: normalizeRuleLevel(options.priority ?? "critical"),
            maxDistance: nullableNumber(options.maxDistance),
            minDistance: nullableNumber(options.minDistance),
            weightMultiplier: nullableNumber(options.weight),
            hard: nullableBoolean(options.hard),
            crossingPenalty: nullableNumber(options.crossingPenalty),
            preferFacingPads: nullableBoolean(options.preferFacingPads),
            core,
            block: blockName,
            path: null,
        });
    }

    private signalPath(name: string, segments: SignalPathSegmentInput[], options: SignalPathOptions = {}) {
        if (typeof name !== "string" || name.trim().length === 0) {
            throw new Error("signalPath(...) requires a non-empty unique name.");
        }
        if (this.paths.has(name)) throw new Error(`signalPath("${name}") is already defined.`);
        if (!Array.isArray(segments) || segments.length === 0) {
            throw new Error(`signalPath("${name}") requires at least one [pin(...), pin(...)] segment.`);
        }
        rejectUnknownOptionKeys(options, [
            "priority",
            "maxDistance",
            "minDistance",
            "weight",
            "hard",
            "crossingPenalty",
            "preferFacingPads",
            "shape",
        ], `signalPath("${name}")`);
        const priority = normalizeRuleLevel(options.priority ?? "critical");
        const shape = options.shape === "straight" ? "straight" as const : "flexible" as const;
        const preferFacingPads = options.preferFacingPads ?? true;
        const normalizedSegments = segments.map((segment, index) => {
            if (!Array.isArray(segment) || segment.length < 2 || segment.length > 3) {
                throw new Error(`signalPath("${name}").segments[${index}] must be [pin(...), pin(...), options?].`);
            }
            const [source, target, segmentOptions = {}] = segment;
            if (!isPinTargetRef(source) || !isPinTargetRef(target)) {
                throw new Error(`signalPath("${name}").segments[${index}] endpoints must use pin(designator, pin_number).`);
            }
            if (source.designator === target.designator && String(source.pin_number) === String(target.pin_number)) {
                throw new Error(`signalPath("${name}").segments[${index}] cannot connect a pin to itself.`);
            }
            rejectUnknownOptionKeys(segmentOptions, [
                "priority",
                "maxDistance",
                "minDistance",
                "weight",
                "hard",
                "crossingPenalty",
                "preferFacingPads",
            ], `signalPath("${name}").segments[${index}]`);
            return {
                source,
                target,
                priority: normalizeRuleLevel(segmentOptions.priority ?? priority),
                maxDistance: nullableNumber(segmentOptions.maxDistance ?? options.maxDistance),
                minDistance: nullableNumber(segmentOptions.minDistance ?? options.minDistance),
                weightMultiplier: nullableNumber(segmentOptions.weight ?? options.weight),
                hard: nullableBoolean(segmentOptions.hard ?? options.hard),
                crossingPenalty: nullableNumber(segmentOptions.crossingPenalty ?? options.crossingPenalty),
                preferFacingPads: nullableBoolean(segmentOptions.preferFacingPads ?? preferFacingPads),
            };
        });

        for (const [index, segment] of normalizedSegments.entries()) {
            if (segment.minDistance !== null && segment.minDistance < 0) throw new Error(`signalPath("${name}").segments[${index}].minDistance must be >= 0.`);
            if (segment.maxDistance !== null && segment.maxDistance < 0) throw new Error(`signalPath("${name}").segments[${index}].maxDistance must be >= 0.`);
            if (segment.minDistance !== null && segment.maxDistance !== null && segment.minDistance > segment.maxDistance) {
                throw new Error(`signalPath("${name}").segments[${index}] minDistance must not exceed maxDistance.`);
            }
            if (segment.weightMultiplier !== null && segment.weightMultiplier <= 0) throw new Error(`signalPath("${name}").segments[${index}].weight must be > 0.`);
            if (segment.crossingPenalty !== null && segment.crossingPenalty < 0) throw new Error(`signalPath("${name}").segments[${index}].crossingPenalty must be >= 0.`);
        }

        for (let index = 1; index < normalizedSegments.length; index += 1) {
            const previous = normalizedSegments[index - 1];
            const current = normalizedSegments[index];
            if (previous.target.designator !== current.source.designator) {
                throw new Error([
                    `signalPath("${name}") is discontinuous between segments ${index - 1} and ${index}.`,
                    `Expected segment ${index} to leave ${previous.target.designator}, got ${current.source.designator}.`,
                ].join(" "));
            }
            if (String(previous.target.pin_number) === String(current.source.pin_number)) {
                throw new Error(`signalPath("${name}") stage ${previous.target.designator} must use different entry and exit pins.`);
            }
        }

        this.paths.set(name, {
            id: name,
            priority,
            shape,
            preferFacingPads,
            segments: normalizedSegments,
        });
    }

    private refineGroup(name: string, components: string[], options: RefineGroupOptions = {}) {
        if (typeof name !== "string" || name.trim().length === 0) {
            throw new Error("refineGroup(...) requires a non-empty unique name.");
        }
        if (this.refineGroups.has(name)) throw new Error(`refineGroup("${name}") is already defined.`);
        if (!Array.isArray(components)) throw new Error(`refineGroup("${name}") requires a component designator array.`);
        rejectUnknownOptionKeys(options, ["swap", "rotateBy"], `refineGroup("${name}")`);
        const componentDesignators = [...new Set(components.filter((item): item is string => typeof item === "string" && item.length > 0))];
        if (componentDesignators.length === 0) throw new Error(`refineGroup("${name}") requires at least one component.`);
        const swap = options.swap === true;
        if (swap && componentDesignators.length < 2) throw new Error(`refineGroup("${name}") swap requires at least two components.`);
        const rotateBy = [...new Set((options.rotateBy ?? []).map((angle) => normalizeDslAngle(angle)))];
        if (rotateBy.some((angle) => angle !== 180)) {
            throw new Error(`refineGroup("${name}").rotateBy supports only the relative 180 degree post-placement flip.`);
        }
        if (!swap && rotateBy.length === 0) throw new Error(`refineGroup("${name}") must enable swap or rotateBy: [180].`);
        this.refineGroups.set(name, {
            name,
            component_designators: componentDesignators,
            swap,
            rotateBy,
        });
    }

    private corePairs(blockName: string, pairs: Array<[PinTargetRef, PinTargetRef]>, options: CriticalPairOptions = {}) {
        for (const pair of pairs) {
            if (!Array.isArray(pair) || pair.length !== 2) continue;
            this.criticalPair(pair[0], pair[1], {
                priority: options.priority ?? "critical",
                maxDistance: options.maxDistance ?? 3,
                minDistance: options.minDistance,
                weight: options.weight ?? 2.4,
                hard: options.hard ?? true,
                crossingPenalty: options.crossingPenalty ?? 2,
                preferFacingPads: options.preferFacingPads ?? true,
            }, true, blockName);
        }
    }

    private coreIsland(name: string, components: string[], options: CoreIslandOptions = {}) {
        void components;
        const pairs = Array.isArray(options.pairs) ? options.pairs : [];
        this.corePairs(name, pairs, {
            priority: options.priority ?? "critical",
            maxDistance: options.maxDistance ?? 3,
            minDistance: options.minDistance,
            weight: options.weight ?? 2.8,
            hard: options.hard ?? true,
            crossingPenalty: options.crossingPenalty ?? 2,
            preferFacingPads: options.preferFacingPads ?? true,
        });
    }

    private solver(options: Record<string, unknown>) {
        this.solverOptions = {
            candidateRadii: nullableNumberArray(options.candidateRadii),
            candidateAngles: nullableNumberArray(options.candidateAngles),
            fallbackGridStep: nullableNumber(options.fallbackGrid ?? options.fallbackGridStep),
            placementGridStep: nullableNumber(options.grid ?? options.placementGridStep),
            ignoredRatsnestSignals: nullableStringArray(options.ignoredSignals ?? options.ignoredRatsnestSignals),
            localImproveIterations: nullableNumber(options.localImproveIterations),
            localImproveMinDelta: nullableNumber(options.localImproveMinDelta),
            hierarchicalBlocks: typeof options.hierarchicalBlocks === "boolean" ? options.hierarchicalBlocks : null,
            compactness: isOneOf(PCB_PLACEMENT_COMPACTNESS, options.compactness) ? options.compactness : null,
            preview: nullableBoolean(options.preview),
            placeOnlyComponents: nullableStringArray(options.placeOnlyComponents),
            ignoreComponents: nullableStringArray(options.ignoreComponents),
        };
    }

    private fixed(designator: string, options: FixedPlacementOptions) {
        this.component(designator).fixed(options);
    }

    private edgeMount(designator: string, edge: BoardEdge, options: EdgeMountOptions = {}) {
        this.component(designator).edgeMount(edge, options);
    }

    private edgePlace(designators: string | string[], options: EdgePlaceOptions) {
        const list = Array.isArray(designators) ? designators : [designators];
        for (const designator of list) {
            this.setEdgePlace(this.componentRule(designator), designator, options);
        }
    }

    private stringTarget(value: string): TargetRef {
        if (this.blocks.has(value)) {
            return { type: "block", block_name: value };
        }
        return { type: "component", designator: value };
    }

    private setEdgeMount(rule: ComponentRule, designator: string, edge: BoardEdge, options: EdgeMountOptions) {
        const normalizedEdge = normalizeBoardEdge(edge);
        if (!normalizedEdge) throw new Error(`Invalid edgeMount edge for ${designator}: ${edge}`);

        const overhang = Math.max(0, nullableNumber(options.overhang) ?? 0);
        const face = normalizeEdgeMountFace(options.face ?? "outward");
        rule.edgeMount = {
            edge: normalizedEdge,
            overhang,
            face,
            align: normalizeEdgeMountAlign(options.align),
            x: nullableNumber(options.x),
            y: nullableNumber(options.y),
            offset: nullableNumber(options.offset),
            layer: nullableLayer(options.layer),
            slide: nullableBoolean(options.slide),
        };

        if (face && face !== "any") {
            rule.faceTo = face === "outward"
                ? normalizedEdge
                : face === "inward"
                    ? oppositeEdge(normalizedEdge)
                    : normalizeMechanicalFaceDirection(face);
        }

        rule.boardOverflow = mergeBoardOverflow(rule.boardOverflow, boardOverflowForEdge(normalizedEdge, overhang));
        if (options.slide === true) {
            this.edge({ type: "component", designator }, normalizedEdge, "critical", face === "inward" ? "inward" : "outward");
        }
    }

    private setEdgePlace(rule: ComponentRule, designator: string, options: EdgePlaceOptions) {
        const edges = normalizeEdgePlaceEdges(options);
        if (edges.length === 0) throw new Error(`edgePlace for ${designator} requires options.edge or options.edges.`);
        const face = normalizeEdgeMountFace(options.face ?? "outward");
        rule.edgePlace = {
            edges,
            inset: Math.max(0, nullableNumber(options.inset) ?? 0),
            face,
            align: normalizeEdgeMountAlign(options.align),
            x: nullableNumber(options.x),
            y: nullableNumber(options.y),
            offset: nullableNumber(options.offset),
            layer: nullableLayer(options.layer),
        };

        if (face && face !== "any" && edges.length === 1) {
            const edge = edges[0];
            rule.faceTo = face === "outward"
                ? edge
                : face === "inward"
                    ? oppositeEdge(edge)
                    : normalizeMechanicalFaceDirection(face);
        }
    }

    private componentRule(designator: string) {
        this.component(designator);
        return this.components.get(designator)!;
    }
}

function nullableNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeComponentGridMatrix(name: string, value: unknown) {
    if (!Array.isArray(value) || value.length === 0) {
        throw new Error(`componentGrid("${name}") requires a non-empty component matrix.`);
    }
    const seen = new Set<string>();
    return value.map((row, rowIndex) => {
        if (!Array.isArray(row) || row.length === 0) {
            throw new Error(`componentGrid("${name}")[${rowIndex}] must be a non-empty row.`);
        }
        return row.map((designator, columnIndex) => {
            if (typeof designator !== "string" || designator.length === 0) {
                throw new Error(`componentGrid("${name}")[${rowIndex}][${columnIndex}] must be a component designator string.`);
            }
            if (seen.has(designator)) throw new Error(`componentGrid("${name}") contains duplicate component "${designator}".`);
            seen.add(designator);
            return designator;
        });
    });
}

function normalizeComponentGridOrigin(name: string, options: ComponentGridOptions) {
    const hasOrigin = options.origin !== undefined;
    const hasAnchor = options.at !== undefined;
    if (hasOrigin === hasAnchor) {
        throw new Error(`componentGrid("${name}") requires exactly one of options.origin or options.at.`);
    }
    if (hasAnchor) {
        if (options.at?.type !== "board_anchor") {
            throw new Error(`componentGrid("${name}").at must be anchor("board...").`);
        }
        return {
            anchor: options.at,
            offset: normalizePointOffset(options.offset),
            x: null,
            y: null,
        };
    }

    const x = nullableNumber(options.origin?.x);
    const y = nullableNumber(options.origin?.y);
    if (x === null || y === null) {
        throw new Error(`componentGrid("${name}").origin requires finite x and y.`);
    }
    return { anchor: null, offset: null, x, y };
}

function addPointOffsets(
    base: { x?: number | null; y?: number | null } | null,
    next: { x: number; y: number },
) {
    const x = (base?.x ?? 0) + next.x;
    const y = (base?.y ?? 0) + next.y;
    return { x, y };
}

function normalizeBoardPadMatrix(name: string, value: unknown, layer: BoardPadRule["layer"]): BoardPadRule["pads"] {
    if (!Array.isArray(value) || value.length === 0) {
        throw new Error(`boardPad("${name}") requires pads: [[...]] with at least one pad.`);
    }
    return value.map((row, rowIndex) => {
        if (!Array.isArray(row) || row.length === 0) {
            throw new Error(`boardPad("${name}").pads[${rowIndex}] must be a non-empty row.`);
        }
        return row.map((cell, columnIndex) => normalizeBoardPadCell(name, cell, rowIndex, columnIndex, layer));
    });
}

function normalizeBoardPadCell(
    boardPadName: string,
    cell: unknown,
    rowIndex: number,
    columnIndex: number,
    layer: BoardPadRule["layer"],
): BoardPadRule["pads"][number][number] {
    if (!cell || typeof cell !== "object") {
        throw new Error(`boardPad("${boardPadName}").pads[${rowIndex}][${columnIndex}] must be a pad object.`);
    }
    const raw = cell as Record<string, unknown>;
    const name = typeof raw.name === "string" && raw.name.length > 0 ? raw.name : `${rowIndex + 1}.${columnIndex + 1}`;
    const net = typeof raw.net === "string" && raw.net.length > 0 ? raw.net : "";
    const shape = isOneOf(PCB_BOARD_PAD_SHAPES, raw.shape) ? raw.shape : null;
    if (!shape) throw new Error(`boardPad("${boardPadName}").pads[${rowIndex}][${columnIndex}] requires shape: "round" | "rect" | "oval".`);
    const hole = normalizeBoardPadHole(boardPadName, raw.hole, rowIndex, columnIndex, layer);
    if (layer === "multi" && (!hole || hole.diameter <= 0)) {
        throw new Error(`boardPad("${boardPadName}").pads[${rowIndex}][${columnIndex}] uses layer:"multi", so hole.diameter must be > 0.`);
    }

    if (shape === "round") {
        return {
            name,
            net,
            shape,
            diameter: requiredPositiveNumber(raw.diameter, `boardPad("${boardPadName}").pads[${rowIndex}][${columnIndex}].diameter`),
            hole,
        };
    }

    return {
        name,
        net,
        shape,
        width: requiredPositiveNumber(raw.width, `boardPad("${boardPadName}").pads[${rowIndex}][${columnIndex}].width`),
        height: requiredPositiveNumber(raw.height, `boardPad("${boardPadName}").pads[${rowIndex}][${columnIndex}].height`),
        hole,
    };
}

function normalizeBoardPadHole(
    boardPadName: string,
    value: unknown,
    rowIndex: number,
    columnIndex: number,
    layer: BoardPadRule["layer"],
) {
    if (value === null || value === undefined) return null;
    if (layer !== "multi") {
        throw new Error(`boardPad("${boardPadName}").pads[${rowIndex}][${columnIndex}].hole is allowed only when layer: "multi".`);
    }
    if (typeof value !== "object") {
        throw new Error(`boardPad("${boardPadName}").pads[${rowIndex}][${columnIndex}].hole must be an object.`);
    }
    const raw = value as Record<string, unknown>;
    const diameter = nullableNumber(raw.diameter);
    if (diameter === null || diameter <= 0) {
        throw new Error(`boardPad("${boardPadName}").pads[${rowIndex}][${columnIndex}].hole.diameter must be > 0.`);
    }
    return {
        diameter,
        offset: normalizePointOffset(raw.offset),
    };
}

function boardPadFootprint(name: string, pads: BoardPadRule["pads"], pitch: number, rowPitch: number) {
    const rows = pads.length;
    const columns = Math.max(...pads.map((row) => row.length));
    const rawPads = pads.flatMap((row, rowIndex) => row.map((pad, columnIndex) => {
        const pinNumber = String(pads.slice(0, rowIndex).reduce((sum, current) => sum + current.length, 0) + columnIndex + 1);
        const width = pad.shape === "round" ? pad.diameter : pad.width;
        const height = pad.shape === "round" ? pad.diameter : pad.height;
        return {
            pin_number: pinNumber,
            name: pad.name,
            x: columnIndex * pitch,
            y: rowIndex * rowPitch,
            width,
            height,
            shape: pad.shape,
            mount: pad.hole && pad.hole.diameter > 0 ? "through_hole" as const : "smd" as const,
            drillDiameter: pad.hole && pad.hole.diameter > 0 ? pad.hole.diameter : null,
        };
    }));
    const padBoxes = rawPads.map((pad) => ({
        left: pad.x - pad.width / 2,
        right: pad.x + pad.width / 2,
        top: pad.y - pad.height / 2,
        bottom: pad.y + pad.height / 2,
    }));
    const left = Math.min(...padBoxes.map((box) => box.left), 0);
    const right = Math.max(...padBoxes.map((box) => box.right), (columns - 1) * pitch);
    const top = Math.min(...padBoxes.map((box) => box.top), 0);
    const bottom = Math.max(...padBoxes.map((box) => box.bottom), (rows - 1) * rowPitch);
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    return {
        name: `BOARD_PAD_${name}`,
        width: right - left,
        height: bottom - top,
        pads: rawPads.map((pad) => ({
            ...pad,
            x: pad.x - centerX,
            y: pad.y - centerY,
        })),
    };
}

function requiredPositiveNumber(value: unknown, label: string) {
    const numberValue = nullableNumber(value);
    if (numberValue === null || numberValue <= 0) {
        throw new Error(`${label} must be a positive number.`);
    }
    return numberValue;
}

function rejectUnknownOptionKeys(value: unknown, allowed: string[], label: string) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const allowedSet = new Set(allowed);
    const unknown = Object.keys(value).find((key) => !allowedSet.has(key));
    if (unknown) throw new Error(`${label} has unknown key '${unknown}'.`);
}

function nullableBoolean(value: unknown) {
    return typeof value === "boolean" ? value : null;
}

function normalizeMechanicalFaceDirection(value: unknown) {
    if (isOneOf(PCB_BOARD_FACE_DIRECTIONS, value)) return value.replace("board.", "") as BoardEdge;
    return isOneOf(PCB_MECHANICAL_FACE_DIRECTIONS, value) ? value : null;
}

function nullableLayer(value: unknown) {
    return isOneOf(PCB_LAYERS, value) ? value : null;
}

function nullableLayers(value: unknown) {
    return Array.isArray(value) ? value.filter((item) => isOneOf(PCB_LAYERS, item)) : null;
}

function nullableNumberArray(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number" && Number.isFinite(item)) : null;
}

function nullableStringArray(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : null;
}

function normalizeFixedPlacement(options: FixedPlacementOptions) {
    const offset = normalizePointOffset(options.offset);
    return {
        x: nullableNumber(options.x),
        y: nullableNumber(options.y),
        anchor: options.anchor?.type === "board_anchor" ? options.anchor : null,
        offset,
        rotate: nullableNumber(options.rotate),
        layer: nullableLayer(options.layer),
    };
}

function normalizePointOffset(offset: unknown) {
    return offset && typeof offset === "object"
        ? {
            x: nullableNumber((offset as { x?: unknown }).x),
            y: nullableNumber((offset as { y?: unknown }).y),
        }
        : null;
}

function normalizeBoardOverflow(options: BoardOverflowOptions) {
    if (typeof options === "number") {
        const value = Math.max(0, options);
        return { left: value, right: value, top: value, bottom: value };
    }
    return {
        left: Math.max(0, nullableNumber(options.left) ?? 0),
        right: Math.max(0, nullableNumber(options.right) ?? 0),
        top: Math.max(0, nullableNumber(options.top) ?? 0),
        bottom: Math.max(0, nullableNumber(options.bottom) ?? 0),
    };
}

function mergeBoardOverflow(current: unknown, next: BoardOverflowOptions) {
    const currentOverflow = current && typeof current === "object"
        ? normalizeBoardOverflow(current as BoardOverflowOptions)
        : { left: 0, right: 0, top: 0, bottom: 0 };
    const nextOverflow = normalizeBoardOverflow(next);
    return {
        left: Math.max(currentOverflow.left, nextOverflow.left),
        right: Math.max(currentOverflow.right, nextOverflow.right),
        top: Math.max(currentOverflow.top, nextOverflow.top),
        bottom: Math.max(currentOverflow.bottom, nextOverflow.bottom),
    };
}

function boardOverflowForEdge(edge: BoardEdge, value: number): BoardOverflowOptions {
    return {
        left: edge === "left" ? value : 0,
        right: edge === "right" ? value : 0,
        top: edge === "top" ? value : 0,
        bottom: edge === "bottom" ? value : 0,
    };
}

function normalizeEdgeMountFace(value: unknown) {
    if (isOneOf(PCB_EDGE_MOUNT_FACES, value)) return value;
    return normalizeMechanicalFaceDirection(value);
}

function normalizeEdgeMountAlign(value: unknown) {
    return isOneOf(PCB_EDGE_MOUNT_ALIGNS, value) ? value : "center";
}

function normalizeEdgePlaceEdges(options: EdgePlaceOptions) {
    const values = Array.isArray(options.edges)
        ? options.edges
        : options.edge
            ? [options.edge]
            : [];
    return [...new Set(values.map(normalizeBoardEdge).filter((edge): edge is BoardEdge => Boolean(edge)))];
}

function oppositeEdge(edge: BoardEdge): BoardEdge {
    if (edge === "left") return "right";
    if (edge === "right") return "left";
    if (edge === "top") return "bottom";
    return "top";
}

function normalizeDesignatorTextOptions(options: DesignatorTextInputOptions): DesignatorTextOptions {
    return {
        enabled: nullableBoolean(options.enabled),
        height: nullableNumber(options.height),
        rotations: nullableNumberArray(options.rotations),
        margin: nullableNumber(options.margin),
    };
}

function normalizeBlockRole(value: unknown) {
    return isOneOf(PCB_BLOCK_ROLES, value) ? value : "generic";
}

function normalizeBlockPlacement(value: unknown) {
    return isOneOf(PCB_BLOCK_PLACEMENTS, value) ? value : null;
}

function normalizeBoardEdge(value: unknown) {
    return isOneOf(PCB_BOARD_EDGES, value) ? value : null;
}

function normalizeBoardCorner(value: unknown) {
    return value === "top_left" || value === "top_right" || value === "bottom_right" || value === "bottom_left"
        ? value
        : null;
}

function normalizeAxis(value: unknown) {
    return value === "x" || value === "y" ? value : null;
}

function normalizeModuleInternalRefine(value: unknown) {
    if (value === false || value === "satellitesOnly" || value === "all") return value;
    return null;
}

function normalizeDslAngle(value: unknown) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error("refineGroup(...).rotateBy entries must be finite numbers.");
    }
    return ((Math.round(value) % 360) + 360) % 360;
}

function isTargetRef(value: unknown): value is TargetRef {
    if (!value || typeof value !== "object") return false;
    const target = value as { type?: unknown };
    return target.type === "component" || target.type === "pin" || target.type === "block" || target.type === "board_anchor";
}

function isPinTargetRef(value: unknown): value is PinTargetRef {
    if (!value || typeof value !== "object") return false;
    const target = value as { type?: unknown; designator?: unknown; pin_number?: unknown };
    return target.type === "pin"
        && typeof target.designator === "string"
        && (typeof target.pin_number === "string" || typeof target.pin_number === "number");
}

function normalizeRuleLevel(value: unknown, fallback: RuleLevel = "normal"): RuleLevel {
    if (isOneOf(PCB_RULE_LEVELS, value)) return value;
    if (value === "max" || value === "aggressive" || value === "extra_quality") return "critical";
    if (value === "quality") return "high";
    if (value === "medium" || value === "basic" || value === "balanced") return "normal";
    if (value === "none" || value === "fast") return "low";
    if (typeof value === "number") {
        if (value >= 0.85) return "critical";
        if (value >= 0.6) return "high";
        if (value >= 0.3) return "normal";
        return "low";
    }
    if (typeof value === "boolean") return value ? "high" : "low";
    return fallback;
}

function rejectRemovedOptions(label: string, options: Record<string, unknown>, keys: string[], replacement: string) {
    const used = keys.filter((key) => key in options);
    if (used.length === 0) return;
    throw new Error(`${label} no longer accepts ${used.join(", ")}. ${replacement}`);
}

function isOneOf<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
    return typeof value === "string" && (values as readonly string[]).includes(value);
}
