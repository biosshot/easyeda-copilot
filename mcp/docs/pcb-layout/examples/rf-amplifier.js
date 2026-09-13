// Complete new-board placement example. No preserve(...) is needed.

// 1. Board and global rules
board.roundedRect(33, 25, {
  radius: 1.5,
  layers: ["top"],
  defaultLayer: "top",
  clearance: 0.35,
  edge: 0.5,
});

// 2. Functional blocks
block("rf_input", ["RF1"], "connector", "SMA input");
block("rf_core", ["C6", "U2", "C7"], "rf", "DC blocks and wideband gain stage");
block("rf_output", ["RF2"], "connector", "SMA output");
block("power_input", ["CN1"], "connector", "Power input at board edge");
block("power", ["U1", "C1", "C2", "C3"], "power", "Low-noise regulator and local bypass");
block("rf_supply", ["L1", "C4", "C5"], "power", null, {
  placement: "satellite",
  attachTo: "rf_core",
  anchor: pin("U2", "1"),
});

// 3. Components and mechanics
component("RF1").block("rf_input").role("connector").top().edgeMount("left", {
  overhang: 3,
  face: "outward",
  align: "center",
});
component("RF2").block("rf_output").role("connector").top().edgeMount("right", {
  overhang: 3,
  face: "outward",
  align: "center",
});
component("CN1").block("power_input").role("connector").top().edgePlace("top", {
  inset: 0.7,
  face: "any",
  align: "center",
});

component("C6").block("rf_core").role("passive").top();
component("U2").block("rf_core").role("main_ic").top();
component("C7").block("rf_core").role("passive").top();
component("U1").block("power").role("main_ic").top();
component("C1").block("power").role("decoupling_cap").top();
component("C2").block("power").role("decoupling_cap").top();
component("C3").block("power").role("decoupling_cap").top();
component("L1").block("rf_supply").role("passive").top();
component("C4").block("rf_supply").role("decoupling_cap").top();
component("C5").block("rf_supply").role("decoupling_cap").top();

// 4. Electrical placement intent
near(block("rf_core"), anchor("board.center"), "critical");

signalPath("rf_main", [
  [pin("RF1", "1"), pin("C6", "1"), { maxDistance: 14.5, preferFacingPads: true }],
  [pin("C6", "2"), pin("U2", "6"), { maxDistance: 2.5, hard: true, preferFacingPads: true }],
  [pin("U2", "3"), pin("C7", "1"), { maxDistance: 2.5, hard: true, preferFacingPads: true }],
  [pin("C7", "2"), pin("RF2", "1"), { maxDistance: 14.5, preferFacingPads: true }],
], {
  priority: "critical",
  shape: "straight",
  preferFacingPads: true,
});

corePairs("power", [
  [pin("U1", "1"), pin("C1", "1")],
  [pin("U1", "5"), pin("C2", "1")],
  [pin("U1", "4"), pin("C3", "1")],
], { priority: "high", maxDistance: 4.5, preferFacingPads: true });
near(comp("CN1"), comp("U1"), "high");

veryNear(pin("L1", "2"), pin("U2", "1"), "critical");
capCluster(["C4", "C5"], {
  powerNet: "VCC_RF",
  returnNet: "GND",
  target: pin("U2", "1"),
  maxRows: 1,
  gap: 0.3,
  topology: "edge_bus",
  priority: "critical",
});

// 5. Output and solver
silkscreen.designators({ enabled: true, height: 0.9, rotations: [0, 90], margin: 0.2 });
solver({
  grid: 0.5,
  ignoredSignals: ["GND"],
  compactness: "normal",
});
