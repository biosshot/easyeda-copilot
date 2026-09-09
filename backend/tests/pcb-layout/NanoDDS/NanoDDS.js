// NanoDDS mixed-signal routing stress test.
// The source circuit has no U5; XP1 is the only RF/output connector, so it is
// used as the required right-edge connector.

board.roundedRect(140, 140, {
    radius: 3,
    segments: 10,
    layers: ["top", "bottom"],
    defaultLayer: "bottom",
    clearance: 1.0,
    edge: 1.5,
});
silkscreen.designators({ height: 1.0, rotations: [0, 90], margin: 0.25 });

// Mechanical/user-facing parts are intentionally outside the movable modules.
block("dc_connector", ["DC1"], "connector", {
    placement: "main",
    anchor: anchor("board.top_left"),
});
block("rf_connector", ["XP1"], "connector", {
    placement: "main",
    anchor: anchor("board.right"),
});

block("encoder", ["SW1"], "generic", {
    placement: "main",
    anchor: anchor("board.bottom_left"),
});

block("power_input_regulator", ["DA1", "C4", "C5", "SJ1", "R1", "R6"], "power", {
    placement: "main",
    anchor: anchor("board.top_left"),
    maxBboxWidth: 23,
    maxBboxHeight: 18,
    placementClearance: 1.0,
});
block("power_5v", ["DA2", "C3"], "power", {
    placement: "satellite",
    attachTo: "power_input_regulator",
    anchor: pin("DA1", "2"),
    sidePreference: "right",
    maxBboxWidth: 16,
    maxBboxHeight: 10,
    maxAnchorGap: 8,
    placementClearance: 0.8,
});
block("rail_driver", [
    "DA5", "VT1", "VT2", "R2", "R3", "R7", "R45", "R46", "R47", "R48",
    "C1", "C2", "C8", "C9", "C32",
], "power", {
    placement: "main",
    anchor: anchor("board.left"),
    maxBboxWidth: 32,
    maxBboxHeight: 25,
    placementClearance: 1.05,
});

block("digital_core", ["DD1", "C20", "C23"], "mcu", {
    placement: "main",
    anchor: anchor("board.center"),
    familyMaxWidth: 58,
    familyMaxHeight: 42,
    placementClearance: 0.9,
});
block("divider_mux", ["DA3", "C15", "C21", "C22"], "mcu", {
    placement: "main",
    anchor: anchor("board.center"),
    maxBboxWidth: 18,
    maxBboxHeight: 16,
    placementClearance: 0.95,
});
block("r2r_ladder", [
    "R12", "R17", "R20", "R23", "R28", "R31", "R34", "R40",
    "R14", "R19", "R22", "R25", "R29", "R32", "R35", "R41",
], "analog", {
    placement: "main",
    anchor: anchor("board.center"),
    maxBboxWidth: 30,
    maxBboxHeight: 9,
    placementClearance: 0.7,
});
block("logic_reference", ["R26", "R27"], "analog", {
    placement: "satellite",
    attachTo: "digital_core",
    anchor: pin("DD1", "21"),
    sidePreference: "bottom",
    maxBboxWidth: 8,
    maxBboxHeight: 5,
    maxAnchorGap: 7,
    placementClearance: 0.55,
});
block("calibration", ["R42", "R43", "R44", "CALP"], "analog", {
    placement: "main",
    anchor: anchor("board.bottom"),
    maxBboxWidth: 14,
    maxBboxHeight: 8,
    placementClearance: 0.6,
});
block("attenuator", ["R16", "R18", "R21", "R24"], "analog", {
    placement: "main",
    anchor: anchor("board.center"),
    maxBboxWidth: 14,
    maxBboxHeight: 8,
    placementClearance: 0.55,
});

block("waveform_amp", [
    "DA6", "R13", "C17", "R15", "C16", "C33",
    "C7", "C10", "C11", "C12",
], "analog", {
    placement: "main",
    anchor: anchor("board.center"),
    maxBboxWidth: 26,
    maxBboxHeight: 22,
    placementClearance: 0.95,
});
block("offset_amp", [
    "DA7", "R36", "C26", "R37", "C27", "R33", "R30", "R38", "R39",
    "C13", "C14", "C18", "C19", "C30", "C31",
], "analog", {
    placement: "main",
    anchor: anchor("board.bottom"),
    maxBboxWidth: 30,
    maxBboxHeight: 23,
    placementClearance: 0.95,
});
block("output_amp", [
    "DA8", "R9", "R10", "R11", "R5", "R4", "R8", "D1", "D2",
    "C24", "C25", "C28", "C29",
], "rf", {
    placement: "main",
    anchor: anchor("board.right"),
    maxBboxWidth: 28,
    maxBboxHeight: 22,
    placementClearance: 0.85,
});
block("testpoints", ["+12V", "-12V", "+5V", "KT2", "KT3"], "generic", {
    placement: "main",
    anchor: anchor("board.bottom"),
    maxBboxWidth: 16,
    maxBboxHeight: 8,
    placementClearance: 0.7,
});

module("power", ["power_input_regulator", "power_5v", "rail_driver"], {
    anchor: anchor("board.top_left"),
    sidePreference: "left",
    maxWidth: 46,
    maxHeight: 27,
    hardBbox: false,
});
module("digital_dds", ["digital_core", "divider_mux", "r2r_ladder", "logic_reference"], {
    anchor: anchor("board.bottom_left"),
    sidePreference: "left",
    maxWidth: 48,
    maxHeight: 34,
    hardBbox: false,
});
module("analog_output", ["waveform_amp", "offset_amp", "output_amp", "calibration", "attenuator", "testpoints"], {
    anchor: anchor("board.bottom_right"),
    sidePreference: "right",
    maxWidth: 46,
    maxHeight: 31,
    hardBbox: false,
});

component("DC1").block("dc_connector").role("connector").top()
    .edgeMount("left", { overhang: 1.2, y: -20, layer: "top", face: "outward" })
    ;
component("XP1").block("rf_connector").role("connector").top()
    .edgeMount("right", { overhang: 1.2, y: 10, layer: "top", face: "outward" })
    ;
component("SW1").block("encoder").role("connector").top()
    .fixed({ anchor: anchor("board.top"), offset: { x: 25, y: 11 }, rotate: 0, layer: "top" });

[
    "DA1", "DA2", "DA3", "DA5", "DA6", "DA7", "DA8", "DD1",
    "VT1", "VT2",
].forEach((designator) => component(designator).role("main_ic").bottom());

[
    "C1", "C2", "C3", "C4", "C5", "C7", "C8", "C9", "C10", "C11",
    "C12", "C13", "C14", "C15", "C16", "C17", "C18", "C19", "C20", "C21",
    "C22", "C23", "C24", "C25", "C26", "C27", "C28", "C29", "C30", "C31",
    "C32", "C33",
].forEach((designator) => component(designator).role("decoupling_cap").bottom());

[
    "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10", "R11",
    "R12", "R13", "R14", "R15", "R16", "R17", "R18", "R19", "R20", "R21",
    "R22", "R23", "R24", "R25", "R26", "R27", "R28", "R29", "R30", "R31",
    "R32", "R33", "R34", "R35", "R36", "R37", "R38", "R39", "R40", "R41",
    "R42", "R43", "R44", "R45", "R46", "R47", "R48",
    "D1", "D2", "SJ1", "CALP", "KT2", "KT3", "+12V", "-12V", "+5V",
].forEach((designator) => component(designator).role("passive").bottom());

component("DA1").fixed({ x: -19, y: -18, rotate: 0, layer: "bottom" });
component("DA5").fixed({ x: -3, y: -19, rotate: 0, layer: "bottom" });
component("DD1").fixed({ x: -30, y: 16.5, rotate: 90, layer: "bottom" });
component("DA6").fixed({ x: 7, y: 18, rotate: 0, layer: "bottom" });
component("DA7").fixed({ x: 13, y: 8, rotate: 0, layer: "bottom" });
component("DA8").fixed({ x: 29, y: 18, rotate: 0, layer: "bottom" });

near(block("power_input_regulator"), comp("DC1"), "critical");
near(block("power_5v"), block("power_input_regulator"), "high");
near(block("rail_driver"), block("power_input_regulator"), "high");
near(block("digital_core"), comp("SW1"), "normal");
near(block("r2r_ladder"), block("digital_core"), "critical");
near(block("divider_mux"), block("r2r_ladder"), "high");
near(block("waveform_amp"), block("r2r_ladder"), "critical");
near(block("offset_amp"), block("waveform_amp"), "high");
near(block("output_amp"), comp("XP1"), "critical");
near(block("output_amp"), block("waveform_amp"), "high");

blockClearance("power_input_regulator", "digital_core", 3.0, "normal");
blockClearance("rail_driver", "digital_core", 3.0, "normal");
blockClearance("rail_driver", "r2r_ladder", 3.0, "normal");
blockClearance("output_amp", "digital_core", 3.0, "normal");

line(["R12", "R17", "R20", "R23", "R28", "R31", "R34", "R40"], "x", {
    gap: 0.55,
    priority: "critical",
});
line(["R14", "R19", "R22", "R25", "R29", "R32", "R35", "R41"], "x", {
    gap: 0.55,
    priority: "critical",
});

line(["R16", "R18", "R21", "R24"], "x", { gap: 0.6, priority: "high" });
line(["R42", "R43", "R44"], "x", { gap: 0.6, priority: "normal" });

criticalPair(pin("DC1", "1"), pin("DA1", "3"), { maxDistance: 14, weight: 7, preferFacingPads: true });
criticalPair(pin("DA1", "2"), pin("DA2", "1"), { maxDistance: 14, weight: 5, preferFacingPads: true });
criticalPair(pin("DA2", "3"), pin("DD1", "23"), { maxDistance: 30, weight: 3 });

criticalPair(pin("DD1", "1"), pin("R12", "1"), { maxDistance: 24, weight: 6 });
criticalPair(pin("DD1", "2"), pin("R17", "1"), { maxDistance: 24, weight: 6 });
criticalPair(pin("DD1", "3"), pin("R20", "1"), { maxDistance: 24, weight: 6 });
criticalPair(pin("DD1", "4"), pin("R23", "1"), { maxDistance: 24, weight: 6 });
criticalPair(pin("DD1", "5"), pin("R28", "1"), { maxDistance: 24, weight: 6 });
criticalPair(pin("DD1", "6"), pin("R31", "1"), { maxDistance: 24, weight: 6 });
criticalPair(pin("DD1", "7"), pin("R34", "1"), { maxDistance: 24, weight: 6 });
criticalPair(pin("DD1", "8"), pin("R40", "1"), { maxDistance: 24, weight: 6 });

criticalPair(pin("DA3", "12"), pin("DA6", "2"), { maxDistance: 12, weight: 5, preferFacingPads: true });
criticalPair(pin("R13", "2"), pin("DA6", "3"), { maxDistance: 6, weight: 7, preferFacingPads: true });
criticalPair(pin("DA6", "1"), pin("DA3", "12"), { maxDistance: 12, weight: 4, preferFacingPads: true });
criticalPair(pin("DA7", "7"), pin("R10", "1"), { maxDistance: 10, weight: 5 });
criticalPair(pin("DA8", "1"), pin("XP1", "5"), { maxDistance: 15, weight: 8, preferFacingPads: true });
criticalPair(pin("D1", "2"), pin("XP1", "5"), { maxDistance: 10, weight: 6 });
criticalPair(pin("D2", "1"), pin("XP1", "5"), { maxDistance: 10, weight: 6 });

criticalPair(pin("DD1", "19"), pin("SW1", "A"), { maxDistance: 24, weight: 3 });
criticalPair(pin("DD1", "18"), pin("SW1", "B"), { maxDistance: 24, weight: 3 });
criticalPair(pin("DD1", "17"), pin("SW1", "D"), { maxDistance: 24, weight: 3 });

capCluster(["C1", "C2"], {
    powerNet: "+12V",
    returnNet: "GND",
    target: pin("DA5", "8"),
    axis: "x",
    maxRows: 1,
    gap: 0.55,
    priority: "high",
});
capCluster(["C8", "C9"], {
    powerNet: "-12V",
    returnNet: "GND",
    target: pin("DA5", "4"),
    axis: "x",
    maxRows: 1,
    gap: 0.55,
    priority: "high",
});
capCluster(["C7", "C10"], {
    powerNet: "+12V",
    returnNet: "GND",
    target: pin("DA6", "8"),
    axis: "x",
    maxRows: 1,
    gap: 0.55,
    priority: "high",
});
capCluster(["C11", "C12"], {
    powerNet: "-12V",
    returnNet: "GND",
    target: pin("DA6", "4"),
    axis: "x",
    maxRows: 1,
    gap: 0.55,
    priority: "high",
});
capCluster(["C13", "C14"], {
    powerNet: "+12V",
    returnNet: "GND",
    target: pin("DA7", "8"),
    axis: "x",
    maxRows: 1,
    gap: 0.55,
    priority: "high",
});
capCluster(["C18", "C19"], {
    powerNet: "-12V",
    returnNet: "GND",
    target: pin("DA7", "4"),
    axis: "x",
    maxRows: 1,
    gap: 0.55,
    priority: "high",
});
capCluster(["C24", "C25"], {
    powerNet: "+12V",
    returnNet: "GND",
    target: pin("DA8", "8"),
    axis: "x",
    maxRows: 1,
    gap: 0.55,
    priority: "high",
});
capCluster(["C28", "C29"], {
    powerNet: "-12V",
    returnNet: "GND",
    target: pin("DA8", "4"),
    axis: "x",
    maxRows: 1,
    gap: 0.55,
    priority: "high",
});
capCluster(["C20", "C23"], {
    powerNet: "+3.3V",
    returnNet: "GND",
    target: pin("DD1", "21"),
    axis: "x",
    maxRows: 1,
    gap: 0.55,
    priority: "critical",
});
capCluster(["C21", "C22", "C15"], {
    powerNet: "+3.3V",
    returnNet: "GND",
    target: pin("DA3", "16"),
    axis: "x",
    maxRows: 1,
    maxPerRow: 3,
    gap: 0.55,
    priority: "high",
});

solver({
    grid: 0.5,
    fallbackGrid: 1.5,
    ignoredSignals: ["GND"],
    localImproveIterations: 48,
    localImproveMinDelta: 0.03,
    hierarchicalBlocks: true,
});
