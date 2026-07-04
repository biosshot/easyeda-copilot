// ESpower layout intent.
// Board: 30 x 35 mm, two copper sides. USB is on the top edge; U8/U14 are on
// the lower edge; SW2 and U9 share the upper-right area. U11 has a dedicated
// antenna keepout rectangle with at least 3 mm placement clearance.

board.rect(30, 35, {
  layers: ["top", "bottom"],
  defaultLayer: "top",
  clearance: 0.35,
  edge: 0.45
});

silkscreen.designators({ height: 0.65, rotations: [0, 90], margin: 0.12 });

constraintRegion("u11_antenna_clearance", {
  shape: region.rect({
    anchor: anchor("board.left"),
    width: 5.5,
    height: 13,
    offset: { y: -4.5 }
  }),
  allow: { blocks: ["antenna"] }
});

block("mount_holes", ["SCREW1", "SCREW2"], "connector", {
  allowDisconnected: true
});
block("antenna", ["U11"], "rf", {
  placement: "main",
  anchor: anchor("board.left"),
  anchorOffset: { y: -4.5 }
});
block("rf_match", ["L1", "C1", "C2"], "rf", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "1"),
  placementClearance: 0.2
});

block("mcu_core", ["U1"], "mcu", {
  placement: "main",
  anchor: anchor("board.center"),
  placementClearance: 0.5
});
block("mcu_clock", ["X1", "C4", "C6"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "29"),
  placementClearance: 0.25
});
block("mcu_vdd_spi", ["C3"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "18"),
  placementClearance: 0.2
});
block("mcu_decoup", ["C9", "C10", "C15"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "11"),
  placementClearance: 0.2
});
block("mcu_pulls", ["R12", "R13"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "6"),
  placementClearance: 0.2
});
block("right_buttons", ["U4", "U5"], "mcu", {
  placement: "main",
  anchor: anchor("board.right"),
  allowDisconnected: true,
  placementClearance: 0.3
});
block("button_support", ["R1", "R2", "C5"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "7"),
  allowDisconnected: true,
  placementClearance: 0.2
});

block("usb_top", ["U12"], "connector", {
  placement: "main",
  anchor: anchor("board.top"),
  placementClearance: 0.25
});
block("usb_support", ["R5", "R6", "R7", "R8", "D1"], "connector", {
  placement: "satellite",
  attachTo: "usb_top",
  anchor: pin("U12", "B6"),
  allowDisconnected: true,
  placementClearance: 0.25
});
block("battery_top_right", ["U9", "SW2"], "connector", {
  placement: "main",
  anchor: anchor("board.top_right"),
  allowDisconnected: true,
  placementClearance: 0.35
});

block("ldo_3v3", ["U6", "C7", "C8", "C16"], "power", {
  placement: "main",
  anchor: anchor("board.left"),
  placementClearance: 0.25
});
block("charger", ["U7", "Q1", "C11", "C12", "R10", "R11", "LED1", "R14"], "power", {
  placement: "main",
  anchor: anchor("board.bottom_left"),
  placementClearance: 0.25
});
block("battery_sense", ["Q2", "R15", "R16", "R17", "C13"], "analog", {
  placement: "main",
  anchor: anchor("board.bottom"),
  placementClearance: 0.25
});
block("current_input", ["U8"], "connector", {
  placement: "main",
  anchor: anchor("board.bottom"),
  anchorOffset: { x: 1 },
  placementClearance: 0.3
});
block("current_sense", ["U13", "R21", "C14", "R19", "R20"], "power", {
  placement: "main",
  anchor: anchor("board.bottom"),
  anchorOffset: { x: 2 },
  placementClearance: 0.3
});
block("bottom_ground", ["U14"], "connector", {
  placement: "main",
  anchor: anchor("board.bottom")
});

module("top_io", ["usb_top", "usb_support", "battery_top_right"], {
  anchor: anchor("board.top"),
  placementPriority: "critical"
});
module("mcu_section", ["mcu_core", "mcu_clock", "mcu_vdd_spi", "mcu_decoup", "mcu_pulls", "right_buttons"], {
  anchor: anchor("board.center"),
  placementPriority: "high"
});
module("power_section", ["ldo_3v3", "charger", "battery_sense", "current_io", "bottom_ground"], {
  anchor: anchor("board.bottom"),
  placementPriority: "high"
});

component("SCREW1").block("mount_holes").role("connector").top()
  .fixed({ x: -12, y: -14.5, layer: "top" });
component("SCREW2").block("mount_holes").role("connector").top()
  .fixed({ x: 12, y: 14.5, layer: "top" });

component("U11").block("antenna").role("connector").top()
  .rotations(90)
  .edgeMount("left", { overhang: 0.2, y: -4.5, layer: "top", face: "any" });
component("U12").block("usb_top").role("connector").top()
  .edgeMount("top", { overhang: 1.0, x: -2.0, layer: "top", face: "outward" });
component("SW2").block("battery_top_right").role("connector").top()
  .edgeMount("top", { overhang: 0.6, align: "end", layer: "top", face: "outward" });
component("U9").block("battery_top_right").role("connector").top()
  .edgeMount("right", { overhang: 0.4, y: -8.2, layer: "top", face: "outward" });
component("U8").block("current_input").role("connector").top()
  .edgeMount("bottom", { overhang: 0.4, x: 0.0, layer: "top", face: "outward" });
component("U14").block("bottom_ground").role("connector").top()
  .edgeMount("bottom", { overhang: 0.4, x: 6.5, layer: "top", face: "outward" });
component("U4").block("right_buttons").role("connector").top()
  .edgeMount("right", { overhang: 0.4, y: -1.8, layer: "top", face: "outward" });
component("U5").block("right_buttons").role("connector").top()
  .edgeMount("right", { overhang: 0.4, y: 4.6, layer: "top", face: "outward" });

component("U1").block("mcu_core").role("main_ic").top();
component("X1").block("mcu_clock").role("crystal").top();
["C4", "C6"].forEach((d) => component(d).block("mcu_clock").role("passive").top());
component("C3").block("mcu_vdd_spi").role("decoupling_cap").bottom();
["C9", "C10", "C15"].forEach((d) => component(d).block("mcu_decoup").role("decoupling_cap").top());
["R12", "R13"].forEach((d) => component(d).block("mcu_pulls").role("passive").bottom());
["L1", "C1", "C2"].forEach((d) => component(d).block("rf_match").role("passive").top());
["R1", "R2"].forEach((d) => component(d).block("button_support").role("passive").top());
component("C5").block("button_support").role("decoupling_cap").top();

["R5", "R6", "R7", "R8"].forEach((d) => component(d).block("usb_support").role("passive").bottom());
component("D1").block("usb_support").role("passive").bottom();

component("U6").block("ldo_3v3").role("main_ic").bottom();
["C7", "C8", "C16"].forEach((d) => component(d).block("ldo_3v3").role("decoupling_cap").bottom());

component("U7").block("charger").role("main_ic").bottom();
component("Q1").block("charger").role("passive").bottom();
["C11", "C12"].forEach((d) => component(d).block("charger").role("decoupling_cap").bottom());
["R10", "R11", "R14"].forEach((d) => component(d).block("charger").role("passive").bottom());
component("LED1").block("charger").role("indicator").bottom();

component("Q2").block("battery_sense").role("passive").bottom();
["R15", "R16", "R17"].forEach((d) => component(d).block("battery_sense").role("passive").bottom());
component("C13").block("battery_sense").role("decoupling_cap").bottom();

component("U13").block("current_sense").role("main_ic").bottom();
component("R21").block("current_sense").role("passive").bottom();
component("C14").block("current_sense").role("decoupling_cap").bottom();
["R19", "R20"].forEach((d) => component(d).block("current_sense").role("passive").bottom());

corePairs("rf_path", [
  [pin("U1", "1"), pin("L1", "1")],
  [pin("L1", "2"), pin("U11", "1")]
], { maxDistance: 5.5, hard: false, weight: 8, preferFacingPads: true });
criticalPair(pin("U1", "29"), pin("X1", "1"), { maxDistance: 4.5, hard: true, weight: 8, preferFacingPads: true });
criticalPair(pin("U1", "30"), pin("X1", "3"), { maxDistance: 4.5, hard: true, weight: 8, preferFacingPads: true });
criticalPair(pin("U1", "25"), pin("R7", "1"), { maxDistance: 8, hard: false, weight: 5, preferFacingPads: true });
criticalPair(pin("U1", "26"), pin("R8", "1"), { maxDistance: 8, hard: false, weight: 5, preferFacingPads: true });
criticalPair(pin("U13", "7"), pin("R21", "1"), { maxDistance: 5, hard: false, weight: 6, preferFacingPads: true });
criticalPair(pin("U13", "8"), pin("R21", "2"), { maxDistance: 5, hard: false, weight: 6, preferFacingPads: true });

veryNear(pin("C3", "2"), pin("U1", "18"), "critical");
capCluster(["C9", "C10", "C15"], {
  powerNet: "3V3",
  returnNet: "GND",
  target: pin("U1", "31"),
  maxRows: 1,
  gap: 0.35,
  priority: "high"
});
capCluster(["C8", "C16"], {
  powerNet: "3V3",
  returnNet: "GND",
  target: pin("U6", "5"),
  maxRows: 1,
  gap: 0.45,
  priority: "high"
});

near(block("antenna"), anchor("board.left"), "critical");
near(block("usb_top"), anchor("board.top"), "critical");
near(block("battery_top_right"), anchor("board.top_right"), "critical");
near(block("current_input"), anchor("board.bottom"), "critical");
near(block("current_sense"), anchor("board.bottom"), "critical");
near(block("right_buttons"), anchor("board.right"), "critical");
near(block("mcu_core"), anchor("board.center"), "high");
near(block("rf_match"), block("antenna"), "high");
near(block("charger"), block("battery_top_right"), "high");
near(block("ldo_3v3"), block("usb_top"), "normal");
near(block("battery_sense"), block("current_sense"), "high");

blockClearance("antenna", "all", 3.0, "critical");
blockClearance("antenna", "rf_match", 3.0, "critical");
blockClearance("antenna", "mcu_core", 3.0, "critical");
blockClearance("usb_support", "antenna", 3.0, "critical");
blockClearance("usb_support", "mount_holes", 0.8, "critical");
blockClearance("usb_top", "battery_top_right", 0.8, "high");
blockClearance("usb_top", "antenna", 1.5, "critical");
blockClearance("mcu_core", "right_buttons", 0.8, "high");
blockClearance("mcu_core", "current_sense", 2.0, "critical");
blockClearance("mcu_clock", "current_sense", 1.5, "critical");
blockClearance("rf_match", "current_sense", 1.5, "critical");
blockClearance("current_sense", "bottom_ground", 1.0, "critical");
blockClearance("mount_holes", "all", 0.8, "critical");

solver({
  grid: 1.5,
  ignoredSignals: ["GND"],
  compactness: "high"
});
