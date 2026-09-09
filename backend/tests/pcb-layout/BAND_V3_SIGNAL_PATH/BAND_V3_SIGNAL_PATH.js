// Regression fixture based on mcp-work/band_v3_easyeda.
// The RF chain is expressed once as an ordered placement path. It is not a
// routed trace and does not claim or guarantee 50-ohm impedance.

board.roundedRect(42, 30, {
  radius: 2,
  segments: 10,
  layers: ["top"],
  defaultLayer: "top",
  clearance: 0.35,
  edge: 0.5,
});

boardHole.corners({
  drill: 3,
  diameter: 3,
  keepout: 2.3,
  inset: 3.5,
  prefix: "MH",
});

block("rf_input_connector", ["J1"], "connector", "Input SMA edge connector");
block("rf_core", ["C1", "U1", "C2"], "rf", "DC blocks and MMIC pass-through stage");
block("rf_output_connector", ["J2"], "connector", "Output SMA edge connector");
block("power_entry", ["J3", "C3"], "power", "Bias input and local bypass");
block("bias_feed", ["R1"], "power", null, {
  placement: "satellite",
  attachTo: "rf_core",
  anchor: pin("U1", "3"),
});

component("J1")
  .block("rf_input_connector")
  .role("connector")
  .top()
  .edgeMount("left", { overhang: 6.5, align: "center", face: "outward", layer: "top" });

component("J2")
  .block("rf_output_connector")
  .role("connector")
  .top()
  .edgeMount("right", { overhang: 6.5, align: "center", face: "outward", layer: "top" });

component("J3")
  .block("power_entry")
  .role("connector")
  .top()
  .edgePlace("top", { inset: 0.5, align: "center", x: 0, face: "outward", layer: "top" });

// These components stay individually movable. The ordered path, rather than a
// rigid line/core island, selects their positions and rotations.
component("C1").block("rf_core").role("passive").top();
component("U1").block("rf_core").role("main_ic").top();
component("C2").block("rf_core").role("passive").top();
component("C3").block("power_entry").role("decoupling_cap").top();
component("R1").block("bias_feed").role("passive").top();

signalPath("rf_main", [
  [pin("J1", "5"), pin("C1", "1"), { maxDistance: 19 }],
  [pin("C1", "2"), pin("U1", "1"), { maxDistance: 4, hard: true }],
  [pin("U1", "3"), pin("C2", "1"), { maxDistance: 4, hard: true }],
  [pin("C2", "2"), pin("J2", "5"), { maxDistance: 19 }],
], {
  priority: "critical",
  shape: "straight",
  preferFacingPads: true,
});

signalPath("bias_feed", [
  [pin("J3", "1"), pin("R1", "1"), { maxDistance: 19 }],
  [pin("R1", "2"), pin("U1", "3"), { maxDistance: 4.5, hard: true }],
], {
  priority: "high",
  shape: "straight",
  preferFacingPads: true,
});

criticalPair(pin("C3", "1"), pin("J3", "1"), {
  maxDistance: 4.5,
  preferFacingPads: true,
});

near(comp("U1"), anchor("board.center"), "critical");

silkscreen.designators({ enabled: true, height: 1, rotations: [0, 90], margin: 0.2 });

solver({
  grid: 0.5,
  ignoredSignals: ["GND"],
  compactness: "normal",
});
