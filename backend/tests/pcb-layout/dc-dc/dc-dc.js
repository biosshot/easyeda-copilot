board.roundedRect(35, 25, {
    radius: 2.5,
    segments: 8,
    layers: ["top", "bottom"],
    defaultLayer: "top",
    clearance: 0.8,
    edge: 1.5,
});

solver({
    grid: 0.5,
    fallbackGrid: 1,
    ignoredSignals: ["GND"],
    hierarchicalBlocks: true,
});

// Connectors are board-level objects. They constrain the power-flow direction
// without becoming rigid members of the regulator module.
block("input_connector", ["J1"], "connector", {
    placementClearance: 0.8,
});

block("output_connector", ["J2"], "connector", {
    placementClearance: 0.8,
});

// U1, L1 and D1 form the switching-current loop. Keeping them in one block
// lets V2 build the core island before any surrounding satellites are placed.
block("power_stage", ["U1", "L1", "D1", "C5"], "power", {
    placement: "main",
    anchor: anchor("board.center"),
    maxBboxWidth: 15,
    maxBboxHeight: 13,
    maxBboxScale: 1.8,
    placementClearance: 0.7,
});

block("input_caps", ["C1", "C2"], "power", {
    placement: "satellite",
    attachTo: "power_stage",
    anchor: pin("U1", "7"),
    sidePreference: "left",
    maxBboxWidth: 7,
    maxBboxHeight: 10,
    maxAnchorGap: 5.5,
    placementClearance: 0.65,
});

block("output_caps", ["C3", "C4"], "power", {
    placement: "satellite",
    attachTo: "power_stage",
    anchor: pin("L1", "2"),
    sidePreference: "right",
    maxBboxWidth: 7,
    maxBboxHeight: 10,
    maxAnchorGap: 5.5,
    placementClearance: 0.65,
});

// These passive blocks are intentionally not forced into line hints. The V2
// passive-net island solver should orient shared-net pads toward each other.
block("feedback", ["R1", "R2"], "analog", {
    placement: "satellite",
    attachTo: "power_stage",
    anchor: pin("U1", "4"),
    sidePreference: "bottom",
    maxBboxWidth: 7,
    maxBboxHeight: 6,
    maxAnchorGap: 5,
    placementClearance: 0.65,
});

block("enable", ["R3", "R4"], "analog", {
    placement: "satellite",
    attachTo: "power_stage",
    anchor: pin("U1", "2"),
    sidePreference: "left",
    maxBboxWidth: 7,
    maxBboxHeight: 6,
    maxAnchorGap: 5.5,
    placementClearance: 0.65,
});

block("compensation", ["R6", "C6"], "analog", {
    placement: "satellite",
    attachTo: "power_stage",
    anchor: pin("U1", "3"),
    sidePreference: "bottom",
    maxBboxWidth: 7,
    maxBboxHeight: 6,
    maxAnchorGap: 4.5,
    placementClearance: 0.65,
});

block("rt", ["R5"], "analog", {
    placement: "satellite",
    attachTo: "power_stage",
    anchor: pin("U1", "6"),
    sidePreference: "bottom",
    maxAnchorGap: 4.5,
    placementClearance: 0.65,
});

module("regulator", [
    "power_stage",
    "input_caps",
    "output_caps",
    "feedback",
    "enable",
    "compensation",
    "rt",
], {
    anchor: anchor("board.center"),
    maxWidth: 34,
    maxHeight: 25,
    hardBbox: false,
});

component("J1")
    .block("input_connector")
    .role("connector")
    .top()
    .faceAt0("top")
    .edgeMount("left", { overhang: 0.5, layer: "top" });

component("J2")
    .block("output_connector")
    .role("connector")
    .top()
    .faceAt0("top")
    .edgeMount("right", { overhang: 0.5, layer: "top" });

component("U1").block("power_stage").role("main_ic").top().rotations(0);
component("L1").block("power_stage").role("passive").top().rotations(0, 180);
component("D1").block("power_stage").role("passive").top().rotations(0, 180);
component("C5").block("power_stage").role("decoupling_cap").top();

component("C1").block("input_caps").role("decoupling_cap").top();
component("C2").block("input_caps").role("decoupling_cap").top();
component("C3").block("output_caps").role("decoupling_cap").top();
component("C4").block("output_caps").role("decoupling_cap").top();

component("R1").block("feedback").role("passive").top();
component("R2").block("feedback").role("passive").top();
component("R3").block("enable").role("passive").top();
component("R4").block("enable").role("passive").top();
component("R6").block("compensation").role("passive").top();
component("C6").block("compensation").role("decoupling_cap").top();
component("R5").block("rt").role("passive").top();

coreIsland("switching_core", ["U1", "L1"], {
    pairs: [
        [pin("U1", "1"), pin("L1", "1")],
    ],
    maxDistance: 5.6,
    priority: "critical",
    hard: true,
    preferFacingPads: true,
});

capCluster(["C1", "C2"], {
    powerNet: "VIN_12V",
    returnNet: "GND",
    target: pin("U1", "7"),
    axis: "y",
    maxRows: 1,
    gap: 0.65,
    topology: "center_power_bus",
    priority: "critical",
});

capCluster(["C3", "C4"], {
    powerNet: "VOUT_3V3",
    returnNet: "GND",
    target: pin("L1", "2"),
    axis: "y",
    maxRows: 1,
    gap: 0.65,
    topology: "center_power_bus",
    priority: "critical",
});

criticalPair(pin("U1", "1"), pin("L1", "1"), {
    maxDistance: 5.6,
    hard: true,
    preferFacingPads: true,
});

criticalPair(pin("U1", "1"), pin("D1", "1"), {
    maxDistance: 5.6,
    hard: true,
    preferFacingPads: true,
});

criticalPair(pin("U1", "8"), pin("C5", "1"), {
    maxDistance: 4,
    priority: "critical",
    preferFacingPads: true,
});

criticalPair(pin("U1", "1"), pin("C5", "2"), {
    maxDistance: 4.2,
    priority: "critical",
    preferFacingPads: true,
});

criticalPair(pin("U1", "7"), pin("C2", "1"), {
    maxDistance: 5.5,
    priority: "critical",
    preferFacingPads: true,
});

criticalPair(pin("L1", "2"), pin("C3", "1"), {
    maxDistance: 5.5,
    priority: "critical",
    preferFacingPads: true,
});

criticalPair(pin("U1", "4"), pin("R2", "2"), {
    maxDistance: 5,
    priority: "high",
    preferFacingPads: true,
});

criticalPair(pin("U1", "3"), pin("R6", "1"), {
    maxDistance: 4.5,
    priority: "high",
    preferFacingPads: true,
});

criticalPair(pin("U1", "6"), pin("R5", "1"), {
    maxDistance: 4.5,
    priority: "high",
    preferFacingPads: true,
});
