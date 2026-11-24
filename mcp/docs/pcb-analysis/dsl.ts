/** Analysis DSL, variant B. Executable source is JavaScript with top-level await.
 * Reference this file for IDE globals. Production supports board/conductor DC and explicit circuit DC/Z(f)/transient;
 * geometry connectivity/clearance/edge-clearance; explicit S/Z/Y multiports and bounded Touchstone;
 * supplied passive relaxation/authored-resonant-Y/full-RLC/real-K-delay time models through si().network (not PCB SI or TDR; timing and eye post-process only these waveforms).
 * Descriptions, validation, reports, explicit-value sweep and solve/optimize search (P14 v1, local/heuristic) are implemented.
 * Analyzers or models outside this subset reject with ANALYZER_NOT_IMPLEMENTED (or a specific *_NOT_IMPLEMENTED code); results are never fabricated.
 * Coordinates: millimetres, absolute board Y down; no implicit material defaults.
 * This document imports only the package's public, existing board transport.
 */
import type { RoutingBoardV2, RoutingStackup, PolygonMm } from 'eda-copilot-backend/types';
export type { RoutingBoardV2 };
export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
export type AnalysisKind = 'geometry' | 'dc' | 'pi' | 'thermal' | 'electrothermal' | 'impedance' | 'tdr' | 'si' | 'eye' | 'emi' | 'em' | 'networkParameters';
export interface Diagnostic { code: string; message: string; path?: string; severity: 'error' | 'warning' | 'info' }
export interface Validity { status: 'valid' | 'conditional' | 'unavailable'; reason?: string; domain?: Json }
export interface Complex { real: number; imaginary: number }
export interface DataDescription {
  kind: 'scalar' | 'series' | 'map' | 'table' | 'eye' | 'polar' | 'bar';
  unit: string; validity: Validity; diagnostics: readonly Diagnostic[];
  value?: number | Complex | boolean | string;
  values?: readonly (number | Complex | null)[];
  axis?: { name: 'timeS' | 'frequencyHz'; unit: 's' | 'Hz'; values: readonly number[] };
  /** Actual supplied data or artifact identity, never a fabricated file path. */
  data?: Json; contextId?: string;
}
/** Real scalar abs/real/imaginary/magnitude and finite real min/max reducers.
 * Partial reducers remain conditional; potentials with independent references
 * cannot be reduced together. Complex/series real, imaginary, magnitude and phaseDeg preserve axes; phase is
 * [-180,180] deg, zero phase undefined. Complex extrema require real/magnitude.
 * at() selects an exactly saved axis position without interpolation.
 * Unsupported operations return unavailable with diagnostics, never physical zero.
 */
export interface DataValue extends DataDescription {
  min(): DataValue; max(): DataValue; abs(): DataValue;
  real(): DataValue; imaginary(): DataValue; magnitude(): DataValue; phaseDeg(): DataValue;
  at(position: { timeS: number } | { frequencyHz: number }): DataValue;
}
export type Selector = { kind: 'pad'; designator: string; number: string }
  | { kind: 'padId'; id: string } | { kind: 'component'; designator: string }
  | { kind: 'net'; name: string } | { kind: 'region'; layers: readonly string[]; polygon: PolygonMm };
export type PadSelector = Extract<Selector, { kind: 'pad' | 'padId' }>;
/** A captured via object, never an ideal net connection. Layered extraction
 * requires a layer and a confirmed finite pad/barrel contact. */
export type ViaSelector = {kind:'viaId';id:string};
export type ElectrodeSelector = PadSelector | ViaSelector;
export interface Handle { readonly kind: string; readonly id: string; readonly contextId: string }
export interface Port extends Handle { readonly kind: 'port' }
export interface Channel extends Handle { readonly kind: 'channel' }
export interface Differential extends Handle { readonly kind: 'differential' }
export interface PortObject extends Handle { port(name: string): Port }
export interface Line extends PortObject { readonly kind: 'line' }
export interface Circuit extends PortObject { readonly kind: 'circuit' }
export interface ThermalNetwork extends Handle { readonly kind: 'thermalNetwork' }
export interface Network extends PortObject { readonly kind: 'network' | 'connect' }
export interface Scene extends PortObject { readonly kind: 'scene' }
export interface Antenna extends Handle { readonly kind: 'antenna' }
export interface Conductor extends Handle { readonly kind: 'conductor' }
export type Target = Line | Channel | Differential | Scene | Antenna | Resource | RoutingBoardV2;
export type Waveform =
  | { kind: 'step'; from: number; to: number; atS: number; riseS: number }
  | { kind: 'sine'; offset: number; amplitude: number; periodS: number; phaseDeg: number }
  | { kind: 'pulse'; low: number; high: number; delayS: number; riseS: number; highS: number; fallS: number; periodS: number; count: number }
  | { kind: 'pwl'; points: readonly (readonly [number, number])[]; interpolation: 'linear' | 'hold'; repeat?: { periodS: number; count: number } };
export interface Frequency { startHz: number; stopHz: number; points: number; scale: 'linear' | 'log' }
export interface Time { stopS: number; sampleStepS: number }
export interface Spectrum { frequencyHz: readonly number[]; values: readonly Complex[]; unit: 'V' | 'A' }
export interface Environment { name: string; ambientC: number | Waveform }
/** Resources are explicit host data, not file loaders. ports lists the names the
 * resource exposes; parameters lists permitted scene parameters. No IBIS/SPICE/
 * Touchstone format is implied. Missing models never resolve by a similar name. */
export interface Resource {
  id: string; kind: string; source?: string; analyses?: readonly AnalysisKind[];
  ports?: readonly string[]; parameters?: Readonly<Record<string, number>>;
  validity?: Validity; data?: Json;
}
/** Optional authored sampled-to-time model assumption. Ordinary frequency use
 * does not require it. gInf is the conducting remainder after subtracting s*CInf.
 * Fitted time results remain conditional on finite samples and this closure. */
export type PassiveRelaxationTemporal = {
 method:'passive-relaxation'; modeTransform?:readonly (readonly number[])[];
 normalizationOhm?:number|Readonly<Record<string,number>>;
 highFrequency:{conductanceS:readonly number[];capacitanceF:readonly number[]};
};
/** Authored one series-RLC section per constant orthonormal mode. Y only,
 * 1..2 ports; conditional finite-sample identification, no unknown-pole proof.
 * dcSlopeF=lim(Ymode/s) in F; inverseInductancePerH=lim(s*Ymode) in 1/H. */
export type PassiveResonantYTemporal = {
 method:'passive-resonant-y'; modeTransform:readonly (readonly number[])[];
 normalizationOhm:number; dcSlopeF:readonly number[];
 highFrequency:{inverseInductancePerH:readonly number[]};
};
/** Explicit tabulated common-return model; source is provenance, never a URL loader.
 * Matrix [frequency][out][in]. S uses positive real power-wave references;
 * Z is Ohm, Y is Siemens. Interpolation is complex linear in source representation. */
export type FrequencyNetworkData = {
 format:'network-parameters'; representation:'S'|'Z'|'Y'; frequenciesHz:readonly number[];
 parameters:readonly (readonly (readonly {real:number;imaginary:number}[])[])[];
 referenceOhm?:number|Readonly<Record<string,number>>;referenceTopology:'common';nature:'passive'|'active'|'unspecified';
 temporal?:PassiveRelaxationTemporal|PassiveResonantYTemporal;
};
export type PhysicalPortSampleData = {
 format:'physical-port-samples';samplePolicy:'exact'|'rational-hybrid';
 /** With `rational-hybrid`: the frequencies solved directly; the other points come from a rational model. */
 directFrequenciesHz?:readonly number[];
 representation:'S'|'Y'|'Z';referenceTopology:'physical-pairs';nature:'passive';
 frequenciesHz:readonly number[]; parameters:FrequencyNetworkData['parameters']; referenceOhm:readonly number[];
 /** Original S table retained by derived Y/Z; referenceOhm keeps producer wave references. */
 producerParameters?:FrequencyNetworkData['parameters'];
 physicalPorts:readonly {positive:{sourcePath:string;layer:string};negative:{sourcePath:string;layer:string}}[];
};
export type TouchstoneNetworkData = {format:'touchstone';content:string;referenceTopology:'common';nature:'passive'|'active'|'unspecified';temporal?:PassiveRelaxationTemporal};
/** Full entries, no automatic symmetrization or discarded mutual coefficients.
 * Infinity keeps all metal potentials; candidate null modes are not a neutrality
 * condition. They must span null(A^T), and are reduced after source/load assembly. */
export type PhysicalTerminal={node:string}|{reference:'ground'};
export interface PhysicalState {kind:'physical-state';steady:boolean;potentialsV:readonly {instanceId:string;node:string;value:number}[];currentsA:readonly {instanceId:string;dof:string;value:number}[]}
export type CoupledRlcData={format:'coupled-rlc';referenceTopology:'grounded'|'infinity';potentialNodes:readonly string[];currentDofs:readonly string[];incidence:readonly(readonly[number,number,number])[];portIncidence:readonly(readonly[number,number,number])[];resistanceOhm:readonly(readonly[number,number,number])[];inductanceH:readonly(readonly[number,number,number])[];capacitanceF:readonly(readonly[number,number,number])[];structuralGaugeModes?:readonly(readonly number[])[];conservedPotentialModes?:readonly(readonly number[])[];portTerminals?:readonly {positive:PhysicalTerminal;negative:PhysicalTerminal}[]};
export type DelayedScatteringData={format:'delayed-scattering';referenceTopology:'common';nature:'passive';referenceOhm:number|Readonly<Record<string,number>>;scattering:readonly(readonly number[])[];delayS:number};
export type NetworkResource = Omit<Resource,'kind'|'ports'|'data'|'parameters'> & {kind:'network';ports:readonly string[];data:FrequencyNetworkData|PhysicalPortSampleData|TouchstoneNetworkData|CoupledRlcData|DelayedScatteringData};
export interface Material {
  id?: string; conductivitySM?: number; relativePermittivity?: number; lossTangent?: number;
  thermalConductivityWPerMK?: number; densityKgM3?: number; specificHeatJPerKgK?: number;
  referenceC?: number; temperatureCoefficientPerK?: number; source?: string; state?: string;
  /** Explicit host resource metadata (e.g. supplied property tables). No table
   * interpolation, file loading or material applicability is implemented here. */
  kind?: 'material'; data?: Json; validity?: Validity; analyses?: readonly AnalysisKind[];
}
export type Materials = Readonly<Record<string, Material>>;
export type Model = Resource | LocalModel;
export type LocalModel =
  | { kind: 'resistor'; resistanceOhm: number; referenceC?: number; temperatureCoefficientPerK?: number }
  | { kind: 'capacitor'; capacitanceF: number; esrOhm?: number; eslH?: number; ideal?: boolean }
  | { kind: 'inductor'; inductanceH: number; seriesResistanceOhm?: number; ideal?: boolean }
  | { kind: 'linear-driver'; lowV: number; highV: number; outputResistanceOhm: number }
  | { kind: 'rc-input'; capacitanceF: number; resistanceOhm?: number }
  | { kind: 'thermal-network' | 'thermal-path'; nodes: readonly ThermalNode[]; links: readonly ThermalLink[]; contacts?: readonly { node: string; target: Selector; resistanceKPerW: number }[] }
  | { kind: 'heatsink'; heatCapacityJPerK: number }
  | { kind: 'thermal-interface'; resistanceKPerW: number }
  | ({ kind: 'cooling'; scale?: Waveform } & ({ resistanceKPerW: number; table?: never } | { resistanceKPerW?: never; table: readonly { deltaTemperatureK: number; heatFlowW: number }[] }));
export interface ComponentDescription {
  designator: string; kind: 'ic' | 'resistor' | 'capacitor' | 'inductor' | 'device';
  model?: Model; pins?: Readonly<Record<string, string | readonly string[]>>;
  ground?: readonly string[]; supplies?: Readonly<Record<string, readonly string[]>>;
  thermalNodes?: readonly string[]; resistanceOhm?: number; capacitanceF?: number;
  inductanceH?: number; esrOhm?: number; eslH?: number; seriesResistanceOhm?: number;
  referenceC?: number; temperatureCoefficientPerK?: number; ideal?: boolean;
}
export type ComponentInput = Omit<ComponentDescription, 'kind'>;
export type ComponentBase = Pick<ComponentInput, 'designator' | 'model' | 'pins' | 'ground' | 'supplies' | 'thermalNodes'>;
export type ResistorInput = ComponentBase & Pick<ComponentInput, 'resistanceOhm' | 'referenceC' | 'temperatureCoefficientPerK'>;
export type CapacitorInput = ComponentBase & Pick<ComponentInput, 'capacitanceF' | 'esrOhm' | 'eslH' | 'ideal'>;
export type InductorInput = ComponentBase & Pick<ComponentInput, 'inductanceH' | 'seriesResistanceOhm' | 'ideal'>;
export type StackupInput = Omit<RoutingStackup, 'layers'> & {
  /** Explicit scenario barrel physics, never added to RoutingBoardV2. */
  platingMaterial?: string; diameterConvention?: 'finished_hole' | 'before_plating';
  layers: readonly (
    | { kind: 'copper'; name: string; thicknessMm?: number; thicknessOz?: number; material?: string; backgroundMaterial?: string }
    | { kind: 'dielectric'; name: string; thicknessMm: number; material?: string; relativePermittivity?: number; lossTangent?: number }
  )[];
};
/** Adapter output reuses RoutingStackup; provenance preserves authored input.
 * Oz→mm uses 0.03479 mm/oz, matching the captured routing stack convention. No fallback supplied.
 * boardThicknessMm excludes solder mask; inconsistent thicknesses are rejected. */
export interface StackupDescription { kind: 'stackup'; input: StackupInput; routing: RoutingStackup }
export type Stimulus = { kind: 'bits'; bits: string; bitRateBps: number; riseS: number; fallS: number; repeatCount: number }
  | { kind: 'prbs'; order: number; seed: number; bits: number; bitRateBps: number; riseS: number; fallS: number }
  | { kind: 'waveform'; voltageV: Waveform };
export type Binding = { port: Port; ports?: never } | { ports: Readonly<Record<string, Port>>; port?: never };
export type Driver = Binding & { model: Model; stimulus: Stimulus };
export type Receiver = Binding & { model: Model };
export interface Source { port: Port; voltageV?: number; currentA?: number; model?: Model | 'ideal'; waveform?: Waveform; voltageSpectrum?: Spectrum; currentSpectrum?: Spectrum }
export interface PortLoad { port: Port; currentA?: number; powerW?: number; resistanceOhm?: number; model?: Model; waveform?: Waveform }
/** Selected pin lists replace the group completely. Default return is exact GND;
 * both sides default equal; each override is part of, not additional to, currentA.
 * A nonnegative remainder is shared only among unspecified pins on that side.
 * Dynamic override distribution is deferred (prepare reports it as unverified). */
export interface ComponentLoad {
  designator: string; rail: Extract<Selector, { kind: 'net' }>; currentA: number;
  return?: Extract<Selector, { kind: 'net' }>; domain?: string; pins?: readonly string[]; returnPins?: readonly string[];
  distribution?: 'equal'; returnDistribution?: 'equal'; waveform?: Waveform;
  pinCurrentsA?: Readonly<Record<string, number | Waveform>>; returnPinCurrentsA?: Readonly<Record<string, number | Waveform>>;
}
export type Load = PortLoad | ComponentLoad;
export interface LoadDefaults { rail: Extract<Selector, { kind: 'net' }>; defaultCurrentA: number; return?: Extract<Selector, { kind: 'net' }>; overrides: Readonly<Record<string, { currentA: number }>> }
export interface ThermalNode { id: string; boundary?: 'environment'; heatCapacityJPerK?: number }
/** Heat flow is positive from->to; default observation ID is `from->to`. */
export interface ThermalLink { id?: string; from: string; to: string; resistanceKPerW?: number; model?: Model }
export interface ThermalNetworkInput { nodes: readonly ThermalNode[]; links: readonly ThermalLink[]; sources: readonly { node: string; powerW: number | Waveform }[] }
export type CircuitElement =
  | { id: string; kind: 'resistor'; nodes: readonly [string, string]; resistanceOhm: number; referenceC?: number; temperatureCoefficientPerK?: number }
  | { id: string; kind: 'capacitor'; nodes: readonly [string, string]; capacitanceF: number; esrOhm?: number; eslH?: number; ideal?: boolean }
  | { id: string; kind: 'inductor'; nodes: readonly [string, string]; inductanceH: number; seriesResistanceOhm?: number; ideal?: boolean }
  | { id: string; kind: 'voltage-source'; nodes: readonly [string, string]; voltageV: number; model: Model | 'ideal'; waveform?: Waveform }
  | { id: string; kind: 'current-source'; nodes: readonly [string, string]; currentA: number; waveform?: Waveform }
  | { id: string; kind: 'model'; model: Model | ComponentDescription; pins: Readonly<Record<string, string>> };
/** Explicit linear network; no automatic PCB connection. Reference is mandatory
 * or the documented gnd. V=first-second, I first-to-second, passive power sign.
 * Local R/C/L model mapping uses exactly p/n. No hidden ESR/ESL/DCR.
 * DC uses constants; time waveforms are absolute and initial steady uses t=0+.
 * AC Z zeroes independent sources and injects +1 A into positive/extracts negative. */
export interface CircuitInput { nodes: readonly string[]; reference?: string; ports: readonly { id: string; positive: string; negative: string }[]; elements: readonly CircuitElement[] }
/** Graded dielectric P1 mesh; independent mesh/domain convergence fixed at 1%.
 * Dimensions in mm; domainScale is artificial padding / physical transverse size. */
export interface CrossSectionMesh { maxNodes?: number; maxTriangles?: number; maxRefinements?: number; maxEdgeMm?: number; domainScale?: number }
/** Height is clear dielectric from each plane to the adjacent signal face.
 * Stripline material interface is the lower signal face; top material fills gaps.
 * Explicit epsilon, lossTangent (0..0.05) and state required; no mask/dispersion.
 * Absent conductors means PEC. Losses require positive frequency, small skin depth
 * and independently converged surface/region loss integrals. Fixed temperature. */
export type LineInput = { widthMm: number; copperThicknessMm: number; lengthMm?: number; solderMask?: RoutingStackup['solderMask']; conductors?: {signal: Material;referencePlanes:{bottom:{thicknessMm:number;material:Material};top?:{thicknessMm:number;material:Material}}} } & (
  | { kind: 'microstrip'; dielectricHeightMm: number; material: Material }
  | { kind: 'coupled-microstrip'; dielectricHeightMm: number; material: Material; gapMm: number }
  | { kind: 'stripline'; topDielectricHeightMm: number; bottomDielectricHeightMm: number; topMaterial: Material; bottomMaterial: Material }
  | { kind: 'coupled-stripline'; topDielectricHeightMm: number; bottomDielectricHeightMm: number; topMaterial: Material; bottomMaterial: Material; gapMm: number }
);
/** Board surfaces: characteristic for total exposed top+bottom area, apportioned
 * by area; K/W is not an areal resistance. No inferred side convection. */
export interface Cooling { boardSurfaces?: Model; heatsinks?: readonly { target: Selector; thermalNode: string; model: Model; interface: Model; cooling: Model }[] }
export type Heat = readonly { target: Selector; node: string; powerW: number | Waveform }[] | { category: 'ic' | 'device' | 'resistor'; defaultPowerW: number; overrides: Readonly<Record<string, { powerW: number }>> };
/** Circuit time: relative local step-doubling tolerance (default 1e-6);
 * absoluteTolerance multiplies 1 V for voltage / 1 A for current (default 1e-9);
 * maxIterations bounds attempted internal steps (default 200000, max 1000000).
 * Thermal time uses relative temperature-rise/local-change tolerance 1e-6 and
 * absolute 1e-7 degC; the same attempted-step bound applies.
 * Circuit DC/AC custom numerics explicitly reject. */
export interface Numerics { relativeTolerance?: number; absoluteTolerance?: number; maxIterations?: number; /** Coupled descriptor time only. */ maxStepS?: number }
export interface CommonOptions { name?: string; numerics?: Numerics; budget?: { maxSeconds?: number; maxMemoryMiB?: number } }
export interface PhysicalOptions { components?: readonly ComponentDescription[]; stackup?: StackupDescription; materials?: Materials }
export interface ElectricalOptions extends PhysicalOptions { sources?: readonly Source[]; loads?: readonly Load[] | LoadDefaults; temperatureC?: number; circuit?: Circuit }
/** Independent CPU/F64 RC or layered P1 FEM. Board geometry/materials and
 * finite contacts are explicit. maxEdgeMm is nominal grid spacing, locally
 * refined at selected contacts; convergence must be demonstrated. Losses accept
 * a complete authoritative DC lossMap in the same board/context only. */
export interface ThermalOptions extends PhysicalOptions { network?: ThermalNetwork; heat?: Heat; losses?: DataValue; cooling?: Cooling; environment?: Environment; initialC?: number | 'ambient'; initial?: 'steady' | FinalState; domain?: 'steady' | 'time'; atS?: number; time?: Time; mesh?: {maxEdgeMm?:number;/** Default50000; up to100000 ordinary, explicit140000 with opt-in refinement. Bounds unpruned replicated mesh; memory/link admission remain separate. */maxNodes?:number;/** Optional bounded1..6 midpoint passes and one independent nested control under the ONE run budget. Publishes final control field and scalar history. Failed gate makes numerically valid fields conditional, never claims absolute accuracy. */refinement?:{maxPasses:number;relativeTolerance:number;validationMaxEdgeMm:number};/** Curve deviation mm, default .001, range .000001.. .01. Never changed automatically at the node cap. */geometryDeviationMm?:number}; inputPolicy?: {cadFill:'strict'|'snapshot'} }
export type Rule = { kind: 'connectivity' } | { kind: 'clearance' | 'edge-clearance'; minMm: number }
  | { kind: 'length'; channel: Channel; maxMm: number } | { kind: 'skew'; channels: readonly Channel[]; maxMm: number }
  | { kind: 'reference-continuity'; channel: Channel } | { kind: 'return-transition'; channel: Channel; maxDistanceMm: number };
export type Excitation = { name?: string; port: Port; voltageV?: number | Waveform; currentA?: number | Waveform; /** Required positive Thevenin source resistance for voltage excitations (P12 v1 standalone network). */ outputResistanceOhm?: number; voltageSpectrum?: Spectrum; currentSpectrum?: Spectrum }
  | { name: string; model: Resource; placement: { positionMm: { x: number; y: number; z: number }; rotationDeg: { x: number; y: number; z: number } }; voltageV?: number | Waveform; currentA?: number | Waveform };
export interface Measurement { id?: string; port: Port; quantity: 'voltage' | 'current'; model?: Model; detector?: 'rms' | 'peak'; bandwidthHz?: number }
export interface EmExcitation { port: Port; incidentPowerW: number; phaseDeg: number }
export type Coupling = { target: Selector; thermalNode: string } | { element: string; thermalNode: string };
export interface Configurations {
  geometry: CommonOptions & { scope?: readonly Selector[]; rules?: readonly Rule[] };
  dc: CommonOptions & ElectricalOptions & { conductor?: Conductor; currentA?: number; voltageV?: number;
    /** Unknown CAD fill freshness may be used only as an explicitly conditional snapshot. */
    inputPolicy?: { cadFill: 'strict' | 'snapshot' };
    /** Scenario assertion: these nets carry no DC current. Their copper domains enter the loss map with zero loss and the map is `conditional`. Refused with DC_IDLE_NET_CARRIES_CURRENT if a declared source/load/component reaches the net, DC_IDLE_NET_UNKNOWN if the net is not on the board. */
    idleNets?: readonly Extract<Selector, { kind: 'net' }>[];
    mesh?: { maxAreaMm2?: number; minAngleDeg?: number; maxNodes?: number; maxTriangles?: number; maxRefinementSteps?: number; geometryDeviationMm?: number };
  };
  pi: CommonOptions & ElectricalOptions & { /** Scenario-wide target for the frequency magnitude chart only. */ targetImpedanceOhm?: number; domain?: 'frequency' | 'time'; frequency?: Frequency; frequencyHz?: number; time?: Time; initial?: 'steady' | FinalState };
  thermal: CommonOptions & ThermalOptions;
  electrothermal: CommonOptions & Pick<PhysicalOptions, 'stackup' | 'materials'> & { electrical?: ElectricalOptions & { operating?: readonly { target: Selector; gateVoltageV: number }[] }; thermal?: ThermalOptions; couplings?: readonly Coupling[]; time?: Time; coupling?: { toleranceK?: number; relativeLossTolerance?: number; maxIterations?: number; relaxation?: number } };
  impedance: CommonOptions & PhysicalOptions & { mesh?: CrossSectionMesh; target?: Line | Channel | Differential | Resource; method?: 'formula' | 'cross-section' | 'layered'; frequency?: Frequency; frequencyHz?: number; temperatureC?: number };
  tdr: CommonOptions & PhysicalOptions & { target?: Line | Channel | Differential | Resource | Network; referenceOhm?: number | Readonly<Record<string, number>>; riseS?: number; termination?: 'matched' | 'open' | 'short' | Model; time?: Time; temperatureC?: number };
  si: CommonOptions & PhysicalOptions & { initial?:'steady'|PhysicalState; channels?: readonly (Channel | Differential | Line)[]; network?: Network | Line; drivers?: readonly Driver[]; receivers?: readonly Receiver[]; time?: Time; temperatureC?: number };
  eye: CommonOptions & { signal?: DataValue; bitRateBps?: number; discardS?: number; phaseS?: number; thresholdV?: number };
  emi: CommonOptions & ElectricalOptions & { kind?: 'risk' | 'conducted' | 'coupling'; signals?: readonly { channel: Channel | Differential; riseS: number }[]; rules?: readonly Rule[]; excitations?: readonly Excitation[]; measurement?: Measurement | readonly Measurement[]; time?: Time; frequency?: Frequency; frequencyHz?: number; spectrum?: { discardS: number; window: 'hann' | 'rectangular'; startHz: number; stopHz: number } };
  em: CommonOptions & PhysicalOptions & { target?: Target; method?: 'full-wave'; frequency?: Frequency; frequencyHz?: number; space?: { kind: 'free-space' }; outputs?: readonly ('sParameters' | 'fields' | 'radiation')[]; excitation?: EmExcitation | Excitation; excitations?: readonly (EmExcitation | Excitation)[]; observation?: { frequenciesHz: readonly number[]; thetaDeg: { from: number; to: number; step: number }; phiDeg: { from: number; to: number; step: number }; distanceM: number }; temperatureC?: number };
  networkParameters: CommonOptions & { network?: Network | Line; frequency?: Frequency; frequencyHz?: number; representation?: 'S' | 'Z' | 'Y'; referenceOhm?: number | Readonly<Record<string, number>> };
}
export interface Preparation {
  kind: AnalysisKind; contextId: string; structurallyValid: boolean; physicalReady: boolean;
  executorAvailable: boolean; diagnostics: readonly Diagnostic[]; components: readonly Json[];
  /** Explicit field provenance; requirements needing extraction remain unverified. */
  inputs: Readonly<Record<string, { source: 'manual'; value: Json }>>;
  assumptions: readonly string[];
}
export type Builder<K extends AnalysisKind> = {
  readonly [P in keyof Configurations[K]]-?: (value: NonNullable<Configurations[K][P]>) => Builder<K>
} & { prepare(): Promise<Preparation>; run(): Promise<Results[K]> };
export interface FinalState { kind: 'finalState'; contextId: string; analysisId: string; data: Json }
export interface ResultBase {
  id: string; kind: AnalysisKind; status: 'complete' | 'partial' | 'failed'; diagnostics: readonly Diagnostic[];
  method: string; inputs: Json; assumptions: readonly string[]; contextId: string;
}
export interface DcResult extends ResultBase {
  /** Explicit circuits instead expose MNA node/element values, quality and
   * requests in solution. No circuit spatial maps. Circuit current(elementId)
   * is first-node to second-node; losses are R/ESR/DCR dissipation. */
  /** Real solution/mesh, quality, coverage and timings. Map data references this ID.
   * External pad electrodes use the first physical layer; no across-layer pad short.
   * Barrel rings are circumferential equipotential electrodes with finite segments.
   * Current density is volumetric A/mm²; triangle losses are W. Peaks at ideal
   * sharp corners depend on mesh; no transient or constant-power model. */
  solution?: Json;
  /** Port declarations alone do not connect electrodes or select domains.
   * Active source/load/element pads use their electrode potential. A passive
   * single-pad side reads the area-weighted piecewise-linear FEM potential over
   * all prepared copper terminal triangles on its first physical surface,
   * excluding bores; it adds no conductivity or solve. Later-declared ports may
   * observe this immutable result too. Missing/uncomputed/incomplete coverage,
   * incompatible mathematical gauges and aggregated sides are unavailable.
   * No fallback to another layer or first mesh node is performed. */
  voltage(port: Port): DataValue; current(target: Port | Selector | string): DataValue;
  resistance: DataValue; losses: DataValue; lossMap: DataValue; voltageMap: DataValue; currentDensityMap: DataValue;
}
/** Explicit circuits: Z(f) complex Ohm/Hz; time V/A/W series on seconds.
 * No implicit AC voltage/current, transfer/resonances or spatial maps.
 * finalState is the latest compatible state in this bounded session; stopS is
 * absolute, waveform phases do not restart. Altered/foreign/unknown states reject.
 * sampleStepS controls output only; sampled extrema can miss internal peaks. */
export interface PiResult extends DcResult { impedance(port: Port): DataValue; transfer(path: { from: Port; to: Port }): DataValue; resonances: DataValue; finalState: FinalState }
export interface ThermalResult extends ResultBase {
  /** Complete final numerical arrays; optional refinement scalar history and common-origin coordinates. Sampled convergence is not absolute accuracy. */
  readonly solution?: Json;
  temperature(node: string | { target: Selector; node: string }): DataValue;
  heatFlow(link: string): DataValue; temperatureMap: DataValue; finalState: FinalState; energyBalance: DataValue;
}
export type TimingOptions = { kind: 'sampling'; data: readonly { port: Port; lowV: number; highV: number }[]; clock: { port: Port; thresholdV: number; edges: 'rising' | 'falling' | 'both'; sampleOffsetS: number }; window: { startS: number; stopS: number } }
  | { kind: 'propagation'; paths: readonly { from: Port; to: Port; sourceThresholdV: number; destinationThresholdV: number }[]; edges: 'rising' | 'falling' | 'both'; maxDelayS: number; window: { startS: number; stopS: number } };
/** Timing is implemented only for waveforms from supported si().network temporal
 * runs: sampling gives clock-sampled levels and setup/hold; propagation gives
 * same-edge threshold-crossing delay, skew (ordinal pairing) and spread. Missing
 * events, ambiguous matching or window-limited intervals remain unavailable with
 * diagnostics; there is no implicit zero delay. */
export interface TimingResult { samples: DataValue; events: DataValue; setup: DataValue; hold: DataValue; delay: DataValue; skew: DataValue; delaySpread: DataValue; diagnostics: readonly Diagnostic[] }
export interface SiResult extends ResultBase { voltage(port: Port): DataValue; differentialVoltage(ports: { positive: Port; negative: Port }): DataValue; timing(options: TimingOptions): TimingResult }
/** Measurements are nominal distances in mm with source polygons/witness references.
 * Scope checks selected copper against surrounding copper. Connectivity reports
 * conservative shorts/contacts; open intent is unavailable. count() is unavailable
 * whenever requested coverage is incomplete; confirmed items remain retained. */
export interface GeometryResult extends ResultBase { violations: { count(): DataValue; items: readonly Json[] }; measurements: DataValue }
/** cross-section: single Z0 scalar Ohm; pair table Ohm with even/odd/differential/common rows.
 * rlgc is unit-1 structured mixed-unit matrices (F/m,H/m, assumed-zero Ohm/m,S/m).
 * delay is full-length scalar/modal s; missing length makes delay/network unavailable.
 * With losses, single Zc is a complex frequency series, pair a frequency/mode table.
 * rlgc contains frequenciesHz and samples of R, Lexternal, Linternal, Ltotal, G, C,
 * modal alpha/beta/complex Zc, regional and physical surface contributions and units.
 * Lossy delay is phase delay beta*length/omega [s], not group delay.
 * network is the immutable exact-grid P6b resource; interpolation stays conditional.
 * Layered frequencyHz(0) reports electrode conductance and a compatible loop probe
 * in segments. Characteristic impedance, delay and network are unavailable there. */
export interface ImpedanceResult extends ResultBase { characteristicImpedance: DataValue; rlgc: DataValue; delay: DataValue; segments: DataValue; network: Network }
export interface TdrResult extends ResultBase { reflection: DataValue; impedance: DataValue; distance: DataValue }
export interface EyeResult extends ResultBase { diagram: DataValue; height: DataValue; width: DataValue; timingMargin: DataValue; voltageMargin: DataValue }
export interface EmiResult extends ResultBase { voltage(port: Port): DataValue; current(port: Port): DataValue; measurement(id: string): DataValue; risks: DataValue; spectra: DataValue }
export interface EmResult extends ResultBase { network: Network; sParameters: DataValue; fields: DataValue; radiation: DataValue; pattern: DataValue; radiatedPower: DataValue }
export interface NetworkParametersResult extends ResultBase { parameter(ports: { out: string; in: string }): DataValue; network: Network }
export interface Results { geometry: GeometryResult; dc: DcResult; pi: PiResult; thermal: ThermalResult; electrothermal: ResultBase & { electrical: DcResult; thermal: ThermalResult; losses: DataValue; convergence: DataValue }; impedance: ImpedanceResult; tdr: TdrResult; si: SiResult; eye: EyeResult; emi: EmiResult; em: EmResult; networkParameters: NetworkParametersResult }
export interface CheckInput { name: string; actual: DataValue | number | boolean | string | null; min?: number; max?: number; target?: number; tolerance?: number; unit?: string; equals?: boolean | string | number }
export interface CheckRecord { id: string; name: string; status: 'pass' | 'fail' | 'unknown'; actual: Json; expected: Json; message: string }
export interface PlotInput { title: string; data: DataValue | Json; kind?: 'line' | 'heatmap' | 'table' | 'eye' | 'polar' | 'bar'; layer?: string; atS?: number; atHz?: number }
export interface Report {
  contextId: string; boardIdentity?: string; descriptors: readonly Json[]; calculations: readonly Json[];
  checks: readonly CheckRecord[]; logs: readonly Json[]; plots: readonly Json[];
  summary: { pass: number; fail: number; unknown: number }; diagnostics: readonly Diagnostic[];
}
export interface SweepParameter<T = number | Model | Environment> { name: string; unit?: string; values: readonly T[] }
export type Metric = DataValue | number;
export type Evaluation = Metric | Readonly<Record<string, Metric>>;
export interface SweepResult { attempts: readonly { parameters: Json; status: 'complete' | 'failed'; value?: Json; error?: string }[]; series: DataValue }
export interface SearchParameter { unit?: string; min?: number; max?: number; values?: readonly number[] }
export interface SearchResult { status: 'found' | 'not-found' | 'budget-exhausted' | 'failed'; best?: Json; history: readonly Json[]; violations: readonly Json[]; note?: string }
export interface SolveOptions { parameter: SearchParameter & { name: string }; evaluate: (value: number) => Promise<DataValue> | DataValue; target: number; tolerance: number; unit: string; maxEvaluations: number }
export interface OptimizeOptions { parameters: Readonly<Record<string, SearchParameter>>; evaluate: (values: Readonly<Record<string, number>>) => Promise<Readonly<Record<string, DataValue>>> | Readonly<Record<string, DataValue>>; objective: { metric: string; direction: 'minimize' | 'maximize'; unit: string }; constraints: readonly { metric: string; min?: number; max?: number; unit: string }[]; maxEvaluations: number; seed: number }
export type VariantChange = { kind: 'track-width'; target: Selector; widthMm: number }
  | { kind: 'stackup'; stackup: StackupDescription }
  | { kind: 'material'; name: string; material: Material }
  | { kind: 'component-model'; target: Selector; model: Model }
  | { kind: 'component-pose'; target: Selector; xMm: number; yMm: number; rotationDeg: number };
export interface AnalysisContext {
  geometry(): Builder<'geometry'>; dc(): Builder<'dc'>; pi(): Builder<'pi'>;
  thermal(): Builder<'thermal'>; electrothermal(): Builder<'electrothermal'>;
  impedance(): Builder<'impedance'>; tdr(): Builder<'tdr'>; si(): Builder<'si'>;
  eye(): Builder<'eye'>; emi(): Builder<'emi'>; em(): Builder<'em'>; networkParameters(): Builder<'networkParameters'>;
  /** Optional extraction surface for both contacts. Existing DC rejects active
   * surface-specific contacts; passive DC observations remain unavailable. */
  port(input: { positive: ElectrodeSelector | readonly ElectrodeSelector[]; negative: ElectrodeSelector | readonly ElectrodeSelector[]; layer?: string; positiveLayer?: string; negativeLayer?: string }): Port;
  channel(input: { from: Port; to: Port; via?: readonly Selector[]; scope?: readonly Selector[] }): Channel;
  differential(input: { positive: Channel; negative: Channel }): Differential;
  conductor(input: { lengthMm: number; widthMm: number; thicknessMm: number; material: Material }): Conductor;
  line(input: LineInput): Line; circuit(input: CircuitInput): Circuit;
  thermalNetwork(input: ThermalNetworkInput): ThermalNetwork;
  model(input: NetworkResource): NetworkResource;
  model(input: LocalModel): LocalModel;
  scene(input: { model: Resource; parameters?: Readonly<Record<string, number>> }): Scene;
  antenna(input: { structure: RoutingBoardV2 | Scene; feed: Port; models?: readonly Model[] }): Antenna;
  network(input: { model: Resource; ports: Readonly<Record<string, string>> }): Network;
  connect(input: { networks: readonly (Network | Line)[]; connections: readonly { from: Port; to: Port; contacts?:'both'|'positive'|'negative' }[]; ports: Readonly<Record<string, Port>> }): Network;
  variant(input: { changes: readonly VariantChange[] }): AnalysisContext;
  check(input: CheckInput): CheckRecord;
  log(input: { level: 'info' | 'warning' | 'error'; message: string; data?: Json }): void;
  plot(input: PlotInput): void; report(): Report;
  sweep<T>(options: { parameter: SweepParameter<T>; evaluate: (value: T) => Evaluation | Promise<Evaluation> }): Promise<SweepResult>;
  sweep(options: { parameters: Readonly<Record<string, Omit<SweepParameter, 'name'>>>; mode: 'cartesian' | 'zip'; evaluate: (values: Readonly<Record<string, number | Model | Environment>>) => Evaluation | Promise<Evaluation> }): Promise<SweepResult>;
  /** solve: 1-D root finding of evaluate(x)-target. optimize: bounded seeded local search; not a global-optimum claim. */
  solve(options: SolveOptions): Promise<SearchResult>; optimize(options: OptimizeOptions): Promise<SearchResult>;
}
export interface ProfilesInput { environments?: Readonly<Record<string, Environment>>; stackups?: Readonly<Record<string, StackupDescription>>; cooling?: Readonly<Record<string, Cooling | Model>>; checks?: Readonly<Record<string, readonly Rule[]>>; numerics?: Readonly<Record<string, Numerics>> }
export interface Profiles extends Required<ProfilesInput> { environment(input: Environment): Environment; sample(input: { environment: Environment; atS: number }): number }
export interface MaterialCatalog { readonly [key: string]: Material | MaterialCatalog }
export interface ModelCatalog { readonly [key: string]: Model | ModelCatalog | readonly ComponentDescription[] | readonly Coupling[] }
export interface EmCatalog { readonly [key: string]: Resource | EmCatalog }
/** Catalogs may use project namespaces (e.g. electrical.sbc.pmicBoundary).
 * Project-specific TS declarations can narrow these resource/namespace unions;
 * arbitrary absent keys are never resolved automatically at runtime. */
export interface Models { materials?: MaterialCatalog; electrical?: ModelCatalog; thermal?: ModelCatalog; em?: EmCatalog }
/** No built-in project resources. All catalogs are provided by the host.
 * Example (boardless):
 * const a = analysis();
 * const line = a.line({kind:'microstrip', widthMm:.3, copperThicknessMm:.035,
 *   dielectricHeightMm:.18, material:{relativePermittivity:4.2}});
 * const preparation = await a.impedance().target(line).method('formula').frequencyHz(1e9).prepare();
 * a.log({level:'info',message:JSON.stringify(preparation.diagnostics)});
 */
declare global {
  const board: RoutingBoardV2 | undefined;
  const profiles: Profiles;
  const models: Readonly<Models>;
  function analysis(options?: { board: RoutingBoardV2 }): AnalysisContext;
  function pad(designator: string, number: string | number): Extract<Selector, { kind: 'pad' }>;
  function padId(id: string): Extract<Selector, { kind: 'padId' }>;
  function viaId(id:string):ViaSelector;
  function component(designator: string): Extract<Selector, { kind: 'component' }>;
  function net(name: string): Extract<Selector, { kind: 'net' }>;
  function region(input: { layers: readonly string[]; polygon: PolygonMm }): Extract<Selector, { kind: 'region' }>;
  function stackup(input: StackupInput): StackupDescription;
  function ic(input: ComponentBase): ComponentDescription;
  function resistor(input: ResistorInput): ComponentDescription;
  function capacitor(input: CapacitorInput): ComponentDescription;
  function inductor(input: InductorInput): ComponentDescription;
  function device(input: ComponentBase & { model: Model }): ComponentDescription;
}
