board.rect(16.5, 23, {
  layers: ["top", "bottom"],
  defaultLayer: "top",
  clearance: 0.1,
  edge: 0.2
});

silkscreen.designators({ height: 0.65, rotations: [0, 90], margin: 0.1 });

boardPad("bottom_io", {
  at: anchor("board.bottom"),
  offset: { x: 0, y: -1.8 },
  pitch: 2.4,
  layer: "top",
  pads: [[
    { name: "GND", net: "GND", shape: "oval", width: 2, height: 3 },
    { name: "+5V", net: "+5V", shape: "oval", width: 2, height: 3 },
    { name: "TX", net: "TX", shape: "oval", width: 2, height: 3 },
    { name: "RX", net: "RX", shape: "oval", width: 2, height: 3 }
  ]]
});

constraintRegion("antenna_clearance", {
  shape: region.rect({ anchor: anchor("board.top"), width: 16, height: 4.4 }),
  allow: { blocks: ["radio_antenna"] }
});

block("radio_core", ["U2"], "rf", {
  placement: "main",
  anchor: anchor("board.top"),
  familyMaxWidth: 13,
  familyMaxHeight: 12,
  placementClearance: 0.45
});
block("radio_antenna", ["U3"], "rf", {
  placement: "main",
  anchor: anchor("board.top")
});
block("radio_matching", ["Z1", "Z2", "Z3"], "rf", {
  placement: "satellite",
  attachTo: "radio_core",
  anchor: pin("U2", "22"),
  maxAnchorGap: 4.8,
  maxBboxWidth: 7,
  maxBboxHeight: 7,
  hardAnchor: true,
  placementClearance: 0.25
});
block("radio_clock", ["U4"], "rf", {
  placement: "satellite",
  attachTo: "radio_core",
  anchor: pin("U2", "4"),
  maxAnchorGap: 4.5,
  maxBboxWidth: 7,
  maxBboxHeight: 6,
  hardAnchor: true,
  placementClearance: 0.25
});
block("radio_dcc_caps", ["C7", "C15"], "rf", {
  placement: "satellite",
  attachTo: "radio_core",
  anchor: pin("U2", "2"),
  maxAnchorGap: 4.5,
  maxBboxWidth: 5,
  maxBboxHeight: 5,
  placementClearance: 0.2
});
block("radio_vr_pa", ["C8"], "rf", {
  placement: "satellite",
  attachTo: "radio_core",
  anchor: pin("U2", "1"),
  maxAnchorGap: 3.5,
  maxBboxWidth: 3,
  maxBboxHeight: 3,
  placementClearance: 0.2
});
block("radio_decoup", ["C10", "C11", "C19"], "rf", {
  placement: "satellite",
  attachTo: "radio_core",
  anchor: pin("U2", "11"),
  maxAnchorGap: 5.5,
  maxBboxWidth: 7,
  maxBboxHeight: 6,
  placementClearance: 0.25
});
block("radio_control", ["R3"], "rf", {
  placement: "satellite",
  attachTo: "radio_core",
  anchor: pin("U2", "3"),
  maxAnchorGap: 4.5,
  maxBboxWidth: 4,
  maxBboxHeight: 4,
  placementClearance: 0.2
});

block("mcu_core", ["U1"], "mcu", {
  placement: "main",
  anchor: anchor("board.bottom"),
  familyMaxWidth: 14,
  familyMaxHeight: 15,
  placementClearance: 0.45
});
block("mcu_rf_feed", ["L1"], "rf", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "2"),
  maxAnchorGap: 3.8,
  maxBboxWidth: 4,
  maxBboxHeight: 4,
  hardAnchor: true,
  placementClearance: 0.2
});
block("mcu_xtal", ["X1", "C16", "C17"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "29"),
  maxAnchorGap: 4.0,
  maxBboxWidth: 7,
  maxBboxHeight: 5,
  hardAnchor: true,
  placementClearance: 0.25
});
block("mcu_decoup", ["C3", "C4", "C5", "C6", "C9", "C13", "C14"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "11"),
  maxAnchorGap: 6.0,
  maxBboxWidth: 10,
  maxBboxHeight: 8,
  placementClearance: 0.2
});
block("mcu_vdd_spi", ["C12"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "18"),
  maxAnchorGap: 3.5,
  maxBboxWidth: 3,
  maxBboxHeight: 3,
  placementClearance: 0.2
});
block("mcu_control", ["R1", "R2", "C2", "SW1"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "15"),
  maxAnchorGap: 5.5,
  maxBboxWidth: 8,
  maxBboxHeight: 6,
  placementClearance: 0.25
});
block("status_led", ["LED1", "R4", "C1"], "generic", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "14"),
  maxAnchorGap: 6.5,
  maxBboxWidth: 7,
  maxBboxHeight: 6,
  placementClearance: 0.25
});

block("power_3v3", ["U5", "C18"], "power", {
  placement: "main",
  anchor: anchor("board.bottom_right"),
  familyMaxWidth: 13,
  familyMaxHeight: 7,
  placementClearance: 0.35
});

module("rf_section", ["radio_antenna", "radio_core"], {
  anchor: anchor("board.top"),
  placementPriority: "high",
  maxWidth: 16,
  maxHeight: 11
});
module("mcu_section", ["mcu_core"], {
  anchor: anchor("board.bottom"),
  placementPriority: "high",
  maxWidth: 16,
  maxHeight: 14
});
module("power_section", ["power_3v3"], {
  anchor: anchor("board.bottom_right"),
  placementPriority: "normal",
  maxWidth: 14,
  maxHeight: 7
});

component("U2").block("radio_core").role("main_ic").top();
component("U1").block("mcu_core").role("main_ic").bottom();
component("U5").block("power_3v3").role("main_ic").bottom();

component("U3").block("radio_antenna").role("connector").top().edgeMount("top", { overhang: 0.2, align: "center", face: "outward" });
["Z1", "Z2", "Z3"].forEach(d => component(d).block("radio_matching").role("passive").top());

component("U4").block("radio_clock").role("crystal").top();
["C7", "C15"].forEach(d => component(d).block("radio_dcc_caps").role("decoupling_cap").top());
component("C8").block("radio_vr_pa").role("decoupling_cap").top();
["C10", "C11", "C19"].forEach(d => component(d).block("radio_decoup").role("decoupling_cap").top());
component("R3").block("radio_control").role("passive").top();

component("L1").block("mcu_rf_feed").role("passive").bottom();
component("X1").block("mcu_xtal").role("crystal").bottom();
["C16", "C17"].forEach(d => component(d).block("mcu_xtal").role("decoupling_cap").bottom());
["C3", "C4", "C5", "C6", "C9", "C13", "C14"].forEach(d => component(d).block("mcu_decoup").role("decoupling_cap").bottom());
component("C12").block("mcu_vdd_spi").role("decoupling_cap").bottom();
["R1", "R2"].forEach(d => component(d).block("mcu_control").role("passive").bottom());
component("C2").block("mcu_control").role("decoupling_cap").bottom();
component("SW1").block("mcu_control").role("connector").bottom().rotations(0, 180);

component("LED1").block("status_led").role("indicator").bottom();
component("R4").block("status_led").role("passive").bottom();
component("C1").block("status_led").role("decoupling_cap").bottom();

component("C18").block("power_3v3").role("decoupling_cap").bottom();

corePairs("radio_bus", [
  [pin("U1", "5"), pin("U2", "8")],
  [pin("U1", "6"), pin("U2", "3")],
  [pin("U1", "8"), pin("U2", "7")],
  [pin("U1", "9"), pin("U2", "17")],
  [pin("U1", "10"), pin("U2", "16")],
  [pin("U1", "12"), pin("U2", "18")],
  [pin("U1", "13"), pin("U2", "19")]
], { maxDistance: 9, hard: false, weight: 7, preferFacingPads: true });

corePairs("radio_xtal", [
  [pin("U2", "4"), pin("U4", "1")],
  [pin("U2", "6"), pin("U4", "3")]
], { maxDistance: 4, hard: true, weight: 9, preferFacingPads: true });

corePairs("mcu_xtal", [
  [pin("U1", "30"), pin("X1", "1")],
  [pin("U1", "29"), pin("X1", "3")]
], { maxDistance: 4, hard: true, weight: 9, preferFacingPads: true });

corePairs("rf_path", [
  [pin("U2", "22"), pin("Z3", "1")],
  [pin("Z3", "2"), pin("Z1", "1")],
  [pin("Z1", "2"), pin("U3", "1")]
], { maxDistance: 4.5, hard: true, weight: 10, preferFacingPads: true });

criticalPair(pin("U2", "22"), pin("Z3", "1"), { maxDistance: 3.0, hard: true, weight: 12, preferFacingPads: true });
criticalPair(pin("Z3", "2"), pin("Z1", "1"), { maxDistance: 3.0, hard: true, weight: 10, preferFacingPads: true });
criticalPair(pin("Z2", "1"), pin("Z3", "2"), { maxDistance: 3.0, hard: false, weight: 7, preferFacingPads: true });
criticalPair(pin("U1", "2"), pin("L1", "2"), { maxDistance: 3.0, hard: true, weight: 8, preferFacingPads: true });
criticalPair(pin("U1", "7"), pin("R1", "1"), { maxDistance: 4.5, hard: false, weight: 6, preferFacingPads: true });
criticalPair(pin("U2", "3"), pin("R3", "1"), { maxDistance: 4.5, hard: false, weight: 6, preferFacingPads: true });
criticalPair(pin("U2", "1"), pin("C8", "1"), { maxDistance: 4.0, hard: false, weight: 6, preferFacingPads: true });
criticalPair(pin("U1", "15"), pin("SW1", "1"), { maxDistance: 5.0, hard: false, weight: 5, preferFacingPads: true });
criticalPair(pin("U1", "14"), pin("R4", "1"), { maxDistance: 5.0, hard: false, weight: 5, preferFacingPads: true });

capCluster(["C3", "C4", "C5", "C6"], {
  powerNet: "+3.3V",
  returnNet: "GND",
  target: pin("U1", "11"),
  maxRows: 2,
  maxPerRow: 2,
  gap: 0.35,
  rowGap: 0.7,
  topology: "center_power_bus",
  priority: "critical"
});
bypass(["C9", "C13", "C14"], pin("U1", "31"), "high", { gap: 0.3 });
veryNear(pin("C12", "1"), pin("U1", "18"), "critical");
capCluster(["C7", "C15"], {
  powerNet: "$1N7169",
  returnNet: "GND",
  target: pin("U2", "2"),
  maxRows: 1,
  gap: 0.35,
  priority: "high"
});
capCluster(["C10", "C11", "C19"], {
  powerNet: "+3.3V",
  returnNet: "GND",
  target: pin("U2", "11"),
  maxRows: 1,
  gap: 0.3,
  priority: "critical"
});

near(block("power_3v3"), block("mcu_core"), "normal");
near(comp("U2"), anchor("board.top"), "critical");
near(comp("U1"), anchor("board.bottom"), "critical");
near(comp("U5"), anchor("board.bottom_right"), "critical");
near(comp("U4"), anchor("board.left"), "high");
blockClearance("radio_core", "mcu_core", 2.0, "critical");
blockClearance("power_3v3", "radio_clock", 1.0, "critical");
blockClearance("radio_antenna", "radio_matching", 0.2, "normal");
blockClearance("radio_antenna", "radio_core", 1.2, "high");
blockClearance("radio_antenna", "radio_clock", 1.2, "high");
blockClearance("radio_antenna", "mcu_core", 2.5, "high");
blockClearance("radio_antenna", "status_led", 2.0, "high");
blockClearance("radio_matching", "mcu_core", 0.8, "high");
blockClearance("radio_clock", "radio_matching", 0.5, "normal");
blockClearance("status_led", "radio_matching", 0.8, "normal");

solver({
  grid: 0.25,
  ignoredSignals: ["GND"],
});
