// TPS63060 3.3V buck-boost regulator layout intent.
// This fixture is shaped for the v2 placer graph:
// board -> module/family -> main block -> satellite blocks -> islands/components.

board.roundedRect(35, 25, {
  radius: 1.8,
  layers: ["top", "bottom"],
  defaultLayer: "top",
  clearance: 0.6,
  edge: 1.8
});
silkscreen.designators({ height: 0.9, rotations: [0, 90], margin: 0.2 });

block("input_connector", ["J1"], "connector", {
  placement: "main",
  anchor: anchor("board.left")
});
block("output_connector", ["J2"], "connector", {
  placement: "main",
  anchor: anchor("board.right")
});

block("regulator_core", ["U1", "L1"], "power", {
  placement: "main",
  anchor: anchor("board.center"),
});

block("input_caps", ["C2", "C3", "R2"], "power", {
  placement: "satellite",
  attachTo: "regulator_core",
  anchor: pin("U1", "2"),
});

block("output_caps", ["C5", "C6", "C7"], "power", {
  placement: "satellite",
  attachTo: "regulator_core",
  anchor: pin("U1", "9"),
});

block("feedback", ["R3", "R5", "C1", "C8"], "analog", {
  placement: "satellite",
  attachTo: "regulator_core",
  anchor: pin("U1", "8"),
});

block("auxiliary", ["C4", "R4"], "analog", {
  placement: "satellite",
  attachTo: "regulator_core",
  anchor: pin("U1", "6"),
  allowDisconnected: true,
});

module("regulator_family", ["regulator_core", "input_caps", "output_caps", "feedback", "auxiliary"], {
  anchor: anchor("board.center"),
});

component("J1").block("input_connector").role("connector").top()
  .edgeMount("left", { overhang: 1.0, face: "outward", y: 0 });
component("J2").block("output_connector").role("connector").top()
  .edgeMount("right", { overhang: 1.0, face: "outward", y: 0 });

component("U1").block("regulator_core").role("main_ic").top()
  ;
component("L1").block("regulator_core").role("passive").top()
  ;

component("C2").block("input_caps").role("decoupling_cap").top();
component("C3").block("input_caps").role("decoupling_cap").top();
component("R2").block("input_caps").role("passive").top();

component("C5").block("output_caps").role("decoupling_cap").top();
component("C6").block("output_caps").role("decoupling_cap").top();
component("C7").block("output_caps").role("decoupling_cap").top();

component("R3").block("feedback").role("passive").top();
component("R5").block("feedback").role("passive").top();
component("C1").block("feedback").role("decoupling_cap").top();
component("C8").block("feedback").role("decoupling_cap").top();

component("C4").block("auxiliary").role("decoupling_cap").top();
component("R4").block("auxiliary").role("passive").top();

coreIsland("switch_loop", ["U1", "L1"], {
  pairs: [[pin("U1", "1"), pin("L1", "1")], [pin("U1", "10"), pin("L1", "2")]],
  maxDistance: 5.6,
  hard: true,
  weight: 12,
  preferFacingPads: true
});

criticalPair(pin("U1", "1"), pin("L1", "1"), { maxDistance: 5.6, hard: true, weight: 12, preferFacingPads: true });
criticalPair(pin("U1", "10"), pin("L1", "2"), { maxDistance: 5.6, hard: true, weight: 12, preferFacingPads: true });
criticalPair(pin("U1", "2"), pin("C3", "2"), { maxDistance: 4.8, hard: true, weight: 10, preferFacingPads: true });
criticalPair(pin("U1", "9"), pin("C5", "2"), { maxDistance: 4.8, hard: true, weight: 10, preferFacingPads: true });
criticalPair(pin("U1", "8"), pin("R3", "2"), { maxDistance: 4.0, hard: true, weight: 9, preferFacingPads: true });
criticalPair(pin("C4", "2"), pin("U1", "6"), { maxDistance: 4.8, hard: true, weight: 8, preferFacingPads: true });

criticalPair(pin("C2", "2"), pin("C3", "2"), { maxDistance: 4.5, hard: false, weight: 6, preferFacingPads: true });
criticalPair(pin("C5", "2"), pin("C6", "2"), { maxDistance: 4.2, hard: false, weight: 6, preferFacingPads: true });
criticalPair(pin("C6", "2"), pin("C7", "2"), { maxDistance: 5.2, hard: false, weight: 5, preferFacingPads: true });
criticalPair(pin("R5", "1"), pin("R3", "2"), { maxDistance: 5.4, hard: false, weight: 4, preferFacingPads: true });
criticalPair(pin("C8", "2"), pin("R3", "2"), { maxDistance: 5.4, hard: false, weight: 4, preferFacingPads: true });
veryNear(pin("C1", "1"), pin("R3", "2"), "high");

capCluster(["C2", "C3"], {
  powerNet: "BAT+",
  returnNet: "GND",
  target: pin("U1", "2"),
  maxRows: 1,
  maxPerRow: 2,
  gap: 0.65,
  priority: "critical"
});
capCluster(["C5", "C6", "C7"], {
  powerNet: "+3V3",
  returnNet: "GND",
  target: pin("U1", "9"),
  maxRows: 1,
  maxPerRow: 5,
  gap: 0.65,
  rowGap: 1.0,
  topology: "center_power_bus",
  priority: "critical"
});

solver({
  grid: 0.5,
  fallbackGrid: 1,
  ignoredSignals: ["GND"],
  localImproveIterations: 48,
  hierarchicalBlocks: true,
  crossingPenalty: 0.15
});
