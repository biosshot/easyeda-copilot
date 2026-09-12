/**
 * Local routing DSL. A file is a sequence of statements followed by exactly
 * one of applyDrcRules(), applyStackup(), runCopper(), runRouting(),
 * or runAll(). Dimensions are mm.
 * Omitted values inherit the imported board/DSN rules.
 */

type PhysicalLayer = "TOP" | "BOTTOM" | `INNER_${number}`;
type LayerSelector = PhysicalLayer | "OUTER" | "ALL" | PhysicalLayer[];
type CopperTarget = object;
type RegionSelector = object;
type FanoutTarget = object;

interface ViaOptions {
  /** Nominal/preferred via diameter. */
  diameterMm?: number;
  /** Nominal/preferred drill diameter. */
  drillMm?: number;
  /** Hard minimum via diameter. */
  minDiameterMm?: number;
  /** Hard minimum drill diameter. */
  minDrillMm?: number;
}

interface FanoutOptions {
  /** auto tries a surface stub first, then underpad for the remaining nets. */
  method?: "auto" | "stub" | "underpad";
  /** Distance past the pad edge before the surface stub bends. Default: 0.1 mm. */
  extensionMm?: number;
}

interface RuleOptions {
  /** Nominal/preferred width used for ordinary routing. */
  trackWidthMm?: number;
  /** Hard lower bound used by neck-down and final validation. */
  minTrackWidthMm?: number;
  clearanceMm?: number;
  edgeClearanceMm?: number;
  holeToHoleClearanceMm?: number;
  allowedLayers?: LayerSelector;
  via?: ViaOptions;
}

interface ImpedanceOptions {
  targetOhm: number;
  tolerancePercent?: number;
  /** Omitted/auto selects the nearest unambiguous solid reference copper. */
  referenceNet?: string | "auto";
}

type NetPriority = "critical" | "high" | "normal" | "low";
type ViaPreference = "auto" | "avoid" | "forbid";

interface NetRoutingPreference {
  /** Relative routing importance. Default: normal. */
  priority?: NetPriority;
  /** auto uses the router default; avoid is strong; forbid is prohibitive best-effort. Neither is a DRC rule. Default: auto. */
  viaPreference?: ViaPreference;
}

interface ZoneOptions {
  clearanceMm?: number;
  minThicknessMm?: number;
  fill?: {
    style?: "solid" | "hatched";
    hatchThicknessMm?: number;
    hatchGapMm?: number;
    hatchOrientationDeg?: number;
  };
  padConnection?: {
    mode?: "solid" | "thermal" | "none";
    thermalGapMm?: number;
    spokeWidthMm?: number;
    spokeCount?: number;
    spokeAngleDeg?: number;
  };
  removeIslandsBelowMm2?: number;
}

declare function pad(component: string, pad: string | number): CopperTarget;
/** Select an entire component for component-scoped routing policy. */
declare function component(designator: string): FanoutTarget;
declare function net(name: string): CopperTarget;
declare function board(): RegionSelector;
/** Component-bounded region; currently implemented for viaStitch grid/around. */
declare function components(...designators: string[]): RegionSelector;

interface PolygonBuilder {
  connect(...targets: CopperTarget[]): this;
  on(layers: LayerSelector): this;
  compact(options?: { maxPadFreeGapWidths?: number }): this;
  maxPadFreeGapWidths(value: number): this;
  zone(options: ZoneOptions): this;
}

declare function polygon(net: string): PolygonBuilder;

declare function plane(options: {
  net: string;
  /** Layers to pour. Runtime default OUTER (TOP and BOTTOM); explicitly choose the layers appropriate to this board's ground/reference plan. */
  layers?: LayerSelector;
  region?: RegionSelector;
  zone?: ZoneOptions;
  stitching?: false | true | {
    gridMm?: number;
    maxVisibleViaDistanceMm?: number;
    via?: "drc-min" | Pick<ViaOptions, "diameterMm" | "drillMm">;
    /** Allow pad-centered stitching vias. Default false; requires explicit opt-in. */
    viaInPad?: boolean;
  };
}): void;

declare function drc(options: RuleOptions): void;
declare function netClass(name: string, options: RuleOptions & { nets: string[] }): void;
/** Add or move nets into an existing net class without replacing its other members. */
declare function assignNetsToNetClass(name: string, nets: string[]): void;
/** Remove selected nets from one named net class. */
declare function removeNetsFromNetClass(name: string, nets: string[]): void;
/** Remove selected nets from whichever net class currently owns them. */
declare function unassignNetClass(nets: string[]): void;
/** Delete one net class relation. */
declare function deleteNetClass(name: string): void;

declare function signalNet(net: string, options?: RuleOptions & NetRoutingPreference & {
  netClass?: string;
  impedance?: ImpedanceOptions;
}): void;

declare function powerNet(net: string, options?: RuleOptions & NetRoutingPreference & {
  netClass?: string;
  maxCurrentA?: number;
  maxTempRiseC?: number;
  maxTrackWidthMm?: number;
  /** Pads carrying the trunk current. Other pads use tapWidthMm. */
  powerPads?: CopperTarget[];
  tapWidthMm?: number | "drc-min";
}): void;

/** Coupled differential pair: keep both legs adjacent; set spacing/skew intent as required. */
declare function diffPair(id: string, options: RuleOptions & {
  positive: string;
  negative: string;
  gapMm?: number;
  maxSkewMm?: number;
  maxUncoupledLengthMm?: number;
  impedance?: ImpedanceOptions;
}): void;
/** Delete one differential-pair relation. */
declare function deleteDiffPair(id: string): void;

/** Match lengths of independent nets; does not enforce adjacency. Use diffPair for a differential pair. */
declare function matchedGroup(id: string, options: {
  nets: string[];
  toleranceMm?: number;
}): void;
/** Add nets to an existing matched group without replacing its other members. */
declare function addNetsToMatchedGroup(id: string, nets: string[]): void;
/** Remove selected nets from one matched group. Groups with fewer than two members are removed. */
declare function removeNetsFromMatchedGroup(id: string, nets: string[]): void;
/** Move nets from any current matched group into the named group. */
declare function moveNetsToMatchedGroup(id: string, nets: string[]): void;
/** Delete one matched-group relation. */
declare function deleteMatchedGroup(id: string): void;

interface ViaStitchCommon {
  via?: Pick<ViaOptions, "diameterMm" | "drillMm"> | "drc-min";
}

type ViaStitchOptions =
  | ViaStitchCommon & {
      mode: "grid";
      net: string;
      region: RegionSelector;
      pitchMm: number;
      viaInPad?: boolean;
    }
  | ViaStitchCommon & {
      mode: "along";
      net: string;
      routes: string[];
      pitchMm?: number;
      offsetMm?: number;
      rows?: number;
      rowSpacingMm?: number;
      stagger?: boolean;
    }
  | ViaStitchCommon & {
      mode: "around";
      net: string;
      target: RegionSelector | FanoutTarget;
      pitchMm?: number;
      offsetMm?: number;
      rows?: number;
      side?: "inside" | "outside";
    }
  | ViaStitchCommon & {
      mode: "return";
      referenceNet: string | "auto";
      forNets?: string[];
      maxDistanceMm?: number;
    };

declare function viaStitch(id: string, options: ViaStitchOptions): void;

interface BusDetectOptions {
  detectionRadiusMm?: number;
  minNets?: number;
  attractionRadiusMm?: number;
}

/** true emits only backend enablement; omitted numeric fields stay backend defaults. */
declare function busDetect(enabled: boolean | BusDetectOptions): void;

/** Explicit dense-package escape retry for a component or one logical pad. The first routing attempt must omit it unless the user requires it; successful fanout copper is created before main routing. */
declare function fanout(target: FanoutTarget, options?: FanoutOptions): void;

/**
 * Exclude whole components or individual logical pads from explicit
 * dense-package fanout. This does not exclude their nets from normal routing.
 */
declare function disableFanout(...targets: FanoutTarget[]): void;

/** Copper disableRouting defaults to false. true forbids new tracks globally, not planes or through-via spans; intersected with per-net allowedLayers. Repeat in each routing program that needs this policy. */
declare function stack(options: {
  boardThicknessMm?: number;
  fallbackCopperThicknessOz?: number;
  viaPlatingThicknessUm?: number;
  maxTrackWidthMm?: number;
  layers?: Array<
    | { kind: "copper"; name: PhysicalLayer; thicknessOz?: number; thicknessMm?: number; disableRouting?: boolean }
    | { kind: "dielectric"; name?: string; thicknessMm?: number; relativePermittivity?: number; lossTangent?: number; material?: string }
  >;
  solderMask?: {
    top?: { thicknessMm?: number; relativePermittivity?: number };
    bottom?: { thicknessMm?: number; relativePermittivity?: number };
  };
}): void;

declare function onlyNets(...nets: string[]): void;
declare function ignoreNets(...nets: string[]): void;
declare function clearRouting(options?: {
  nets?: "all" | string[];
  /** Alias for nets, retained for natural agent requests. */
  only?: string[];
  items?: Array<"tracks" | "vias" | "zones">;
}): void;

declare function applyDrcRules(): void;
declare function applyStackup(): void;
declare function runCopper(): void;
declare function runRouting(): void;
declare function runAll(): void;
