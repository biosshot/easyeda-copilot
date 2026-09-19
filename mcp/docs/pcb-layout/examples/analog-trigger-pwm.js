// Analog trigger front end with a PWM-derived comparator threshold.
// The two dominant ordered paths use signalPath(); feedback and bypass parts
// remain local constraints. No passive component is fixed.

board.roundedRect(36, 20, {
  radius: 1.5,
  layers: ["top"],
  defaultLayer: "top",
  clearance: 0.3,
  edge: 0.3,
});

block("input_connector", ["H3"], "connector");
block("mcu_connector", ["H2"], "connector");
block("test_connector", ["H1"], "connector");
block("input_stage", ["R5", "R6", "U2", "C3"], "analog");
block("comparator", ["R2", "R3", "U1", "R1", "C2"], "analog");
block("pwm_reference", ["R4", "C1", "U3", "C4"], "analog");

component("H3").role("connector").top().edgePlace("left", { inset: 1.2, face: "any" });
component("H2").role("connector").top().edgePlace("right", { inset: 1.2, face: "any" });
component("H1").role("connector").top().edgePlace("bottom", { inset: 1.2, face: "any" });

component("U1").role("main_ic").top();
component("U2").role("main_ic").top();
component("U3").role("main_ic").top();
component("C2").role("decoupling_cap").top();
component("C3").role("decoupling_cap").top();
component("C4").role("decoupling_cap").top();

signalPath("trigger_main", [
  [pin("H3", "1"), pin("R5", "1"), { maxDistance: 5, preferFacingPads: true }],
  [pin("R5", "2"), pin("U2", "3"), { maxDistance: 4, preferFacingPads: true }],
  [pin("U2", "1"), pin("R2", "1"), { maxDistance: 5, preferFacingPads: true }],
  [pin("R2", "2"), pin("U1", "3"), { maxDistance: 4, preferFacingPads: true }],
  [pin("U1", "5"), pin("R1", "1"), { maxDistance: 3.5, preferFacingPads: true }],
  [pin("R1", "2"), pin("H2", "4"), { maxDistance: 8, preferFacingPads: true }],
], {
  priority: "critical",
  shape: "flexible",
  preferFacingPads: true,
});

signalPath("pwm_threshold", [
  [pin("H2", "3"), pin("R4", "1"), { maxDistance: 6, preferFacingPads: true }],
  [pin("R4", "2"), pin("U3", "3"), { maxDistance: 4.5, preferFacingPads: true }],
  [pin("U3", "1"), pin("U1", "1"), { maxDistance: 5, preferFacingPads: true }],
], {
  priority: "critical",
  shape: "flexible",
  preferFacingPads: true,
});

veryNear(pin("R6", "2"), pin("U2", "3"), "high");
veryNear(pin("C1", "1"), pin("U3", "3"), "critical");
veryNear(pin("R3", "2"), pin("U1", "3"), "critical");
veryNear(pin("R3", "1"), pin("U1", "5"), "critical");

bypass(["C3"], pin("U2", "5"), "critical", { gap: 0.3 });
bypass(["C2"], pin("U1", "4"), "critical", { gap: 0.3 });
bypass(["C4"], pin("U3", "5"), "critical", { gap: 0.3 });

silkscreen.designators({ enabled: true, height: 0.8, rotations: [0, 90], margin: 0.15 });
solver({ grid: 0.25, ignoredSignals: ["GND", "+3V3"], compactness: "high" });
