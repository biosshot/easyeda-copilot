board.rect(30, 35, {
  layers: ["top", "bottom"],
  defaultLayer: "top",
  clearance: 0.35,
  edge: 0.8
});

solver({ grid: 0.5, ignoredSignals: ["GND"], compactness: "high" });
silkscreen.designators({ height: 0.75, rotations: [0, 90], margin: 0.12 });

constraintRegion("top_usb_zone", {
  allow: { blocks: ["usb_connector", "usb_cc", "usb_power"] },
  layers: ["top", "bottom"],
  shape: region.rect({ anchor: anchor("board.top"), width: 12.0, height: 6.0 })
});

constraintRegion("antenna_keepout", {
  allow: { blocks: ["antenna"] },
  layers: ["top", "bottom"],
  shape: region.rect({
    anchor: anchor("board.right"),
    width: 9.5,
    height: 14.0,
    offset: { x: -0.2, y: 1.0 }
  })
});

block("usb_connector", ["U12"], "connector", { placement: "main", anchor: anchor("board.top") });
block("usb_cc", ["R5", "R6"], "connector", {
  placement: "satellite",
  attachTo: "usb_connector",
  anchor: pin("U12", "A5"),
  allowDisconnected: true
});
block("usb_data", ["R7", "R8"], "connector", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "25"),
  allowDisconnected: true
});
block("usb_power", ["D1", "R14"], "power", {
  placement: "satellite",
  attachTo: "usb_connector",
  anchor: pin("U12", "A4")
});

block("mcu_core", ["U1"], "mcu", { placement: "main", anchor: anchor("board.bottom") });
block("mcu_xtal", ["X1", "C4", "C6"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "29")
});
block("mcu_vdd_spi", ["C3"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "18")
});
block("mcu_decoup", ["C10", "C14", "C15", "C16"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "17")
});
block("mcu_enable", ["R1", "C5"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "7")
});
block("mcu_en_button", ["U4"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "7")
});
block("mcu_boot_io", ["R2", "R12", "R13", "R19", "R20"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "15")
});
block("mcu_gpio7_filter", ["C13"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "13")
});
block("mcu_boot_button", ["U5"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "15")
});

block("antenna", ["U11"], "rf", { placement: "main", anchor: anchor("board.right") });
block("rf_match", ["L1", "C1", "C2"], "rf", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "1")
});

block("ldo", ["U6", "C7", "C8", "C9", "C12"], "power", {
  placement: "main",
  anchor: anchor("board.left")
});
block("charger", ["U7", "R10", "R11", "LED1", "C11"], "power", {
  placement: "main",
  anchor: anchor("board.bottom_left")
});
block("power_path", ["Q1", "Q2", "R15", "R16", "R17"], "power", {
  placement: "main",
  anchor: anchor("board.left")
});
block("battery_connector", ["U9"], "connector", {
  placement: "main",
  anchor: anchor("board.bottom_left"),
  allowDisconnected: true
});
block("battery_switch", ["SW2"], "connector", {
  placement: "main",
  anchor: anchor("board.left"),
  allowDisconnected: true
});
block("current_sense", ["U13", "R21"], "analog", {
  placement: "main",
  anchor: anchor("board.bottom")
});
block("input_connector", ["U8"], "connector", { placement: "main", anchor: anchor("board.left") });
block("gnd_connector", ["U14"], "connector", {
  placement: "main",
  anchor: anchor("board.bottom_right"),
  allowDisconnected: true
});
block("mount_holes", ["SCREW1", "SCREW2"], "connector", {
  placement: "main",
  anchor: anchor("board.top"),
  allowDisconnected: true
});

component("U12").block("usb_connector").role("connector").top()
  .edgeMount("top", { overhang: 0.8, align: "center", face: "outward", layer: "top" });
["R5", "R6"].forEach(d => component(d).block("usb_cc").role("passive").top());
["R7", "R8"].forEach(d => component(d).block("usb_data").role("passive").top());
component("D1").block("usb_power").role("passive").top();
component("R14").block("usb_power").role("passive").top();

component("U1").block("mcu_core").role("main_ic").top();
component("X1").block("mcu_xtal").role("crystal").top();
["C4", "C6"].forEach(d => component(d).block("mcu_xtal").role("decoupling_cap").top());
component("C3").block("mcu_vdd_spi").role("decoupling_cap").top();
["C10", "C14", "C15", "C16"].forEach(d => component(d).block("mcu_decoup").role("decoupling_cap").top());
component("R1").block("mcu_enable").role("passive").top();
component("C5").block("mcu_enable").role("decoupling_cap").top();
component("U4").block("mcu_en_button").role("connector").top()
  .edgePlace("left", { inset: 0.8, y: -6, face: "outward", layer: "top" });
["R2", "R12", "R13", "R19", "R20"].forEach(d => component(d).block("mcu_boot_io").role("passive").bottom());
component("C13").block("mcu_gpio7_filter").role("decoupling_cap").bottom();
component("U5").block("mcu_boot_button").role("connector").top()
  .edgePlace("right", { inset: 0.8, y: -10, face: "outward", layer: "top" });

component("U11").block("antenna").role("connector").top()
  .edgeMount("right", { overhang: 0.2, y: 1.0, face: "outward", layer: "top" });
["L1", "C1", "C2"].forEach(d => component(d).block("rf_match").role("passive").top());

component("U6").block("ldo").role("main_ic").bottom();
["C7", "C8", "C9", "C12"].forEach(d => component(d).block("ldo").role("decoupling_cap").bottom());
component("U7").block("charger").role("main_ic").bottom();
["R10", "R11"].forEach(d => component(d).block("charger").role("passive").bottom());
component("LED1").block("charger").role("indicator").bottom();
component("C11").block("charger").role("decoupling_cap").bottom();
["Q1", "Q2", "R15", "R16", "R17"].forEach(d => component(d).block("power_path").role("passive").bottom());
component("U9").block("battery_connector").role("connector").bottom()
  .fixed({ x: -10, y: 12.1, rotate: 180, layer: "bottom" })
  .faceTo("board.bottom");
component("SW2").block("battery_switch").role("connector").top()
  .edgePlace("left", { inset: 1.0, face: "outward", layer: "top" });
component("U13").block("current_sense").role("main_ic").bottom();
component("R21").block("current_sense").role("passive").bottom();
component("U8").block("input_connector").role("connector").bottom()
  .fixed({ x: 0, y: 12.1, rotate: 180, layer: "bottom" })
  .faceTo("board.bottom");
component("U14").block("gnd_connector").role("connector").bottom()
  .fixed({ x: 10, y: 12.1, rotate: 180, layer: "bottom" })
  .faceTo("board.bottom");
component("SCREW1").block("mount_holes").role("connector").top()
  .fixed({ anchor: anchor("board.top_left"), offset: { x: 3.8, y: 3.8 }, layer: "top" })
  .designatorText({ enabled: false });
component("SCREW2").block("mount_holes").role("connector").top()
  .fixed({ anchor: anchor("board.top_right"), offset: { x: -3.8, y: 3.8 }, layer: "top" })
  .designatorText({ enabled: false });

criticalPair(pin("U12", "A7"), pin("R7", "1"), { maxDistance: 5.5, hard: false, weight: 8, preferFacingPads: true });
criticalPair(pin("U12", "A6"), pin("R8", "1"), { maxDistance: 5.5, hard: false, weight: 8, preferFacingPads: true });
criticalPair(pin("R7", "2"), pin("U1", "25"), { maxDistance: 8.0, hard: false, weight: 8, preferFacingPads: true });
criticalPair(pin("R8", "2"), pin("U1", "26"), { maxDistance: 8.0, hard: false, weight: 8, preferFacingPads: true });
criticalPair(pin("U1", "1"), pin("L1", "1"), { maxDistance: 3.2, hard: true, weight: 14, preferFacingPads: true });
criticalPair(pin("L1", "2"), pin("U11", "1"), { maxDistance: 6.0, hard: false, weight: 10, preferFacingPads: true });
criticalPair(pin("U1", "29"), pin("X1", "1"), { maxDistance: 4.5, hard: true, weight: 10, preferFacingPads: true });
criticalPair(pin("U1", "30"), pin("X1", "3"), { maxDistance: 4.5, hard: true, weight: 10, preferFacingPads: true });

criticalPair(pin("U6", "1"), pin("C7", "2"), { maxDistance: 4.5, hard: false, weight: 8, preferFacingPads: true });
criticalPair(pin("U6", "5"), pin("C8", "2"), { maxDistance: 4.5, hard: false, weight: 8, preferFacingPads: true });
criticalPair(pin("U7", "3"), pin("C11", "1"), { maxDistance: 5.0, hard: false, weight: 8, preferFacingPads: true });
criticalPair(pin("U13", "7"), pin("R21", "1"), { maxDistance: 5.0, hard: false, weight: 9, preferFacingPads: true });
criticalPair(pin("U13", "8"), pin("R21", "2"), { maxDistance: 5.0, hard: false, weight: 9, preferFacingPads: true });

capCluster(["C10", "C14", "C15", "C16"], {
  powerNet: "3V3",
  returnNet: "GND",
  target: pin("U1", "17"),
  maxRows: 2,
  maxPerRow: 2,
  gap: 0.35,
  rowGap: 0.7,
  topology: "center_power_bus",
  priority: "critical"
});
bypass(["C3"], pin("U1", "18"), "critical", { gap: 0.35 });
bypass(["C4", "C6"], pin("U1", "29"), "high", { gap: 0.35 });
bypass(["C7"], pin("U6", "1"), "high", { gap: 0.35 });
bypass(["C8", "C9"], pin("U6", "5"), "high", { gap: 0.35 });

veryNear(pin("U12", "A5"), pin("R5", "1"), "critical");
veryNear(pin("U12", "B5"), pin("R6", "2"), "critical");
veryNear(pin("U12", "A4"), pin("D1", "2"), "high");
veryNear(pin("U1", "7"), pin("R1", "1"), "high");
veryNear(pin("U1", "7"), pin("C5", "2"), "high");
veryNear(pin("U1", "9"), pin("R16", "1"), "high");

near(comp("U12"), anchor("board.top"), "critical");
near(comp("U1"), anchor("board.bottom"), "high");
near(comp("U11"), anchor("board.right"), "critical");
near(comp("U6"), anchor("board.left"), "high");
near(comp("U7"), anchor("board.bottom_left"), "high");
near(comp("U13"), anchor("board.bottom"), "high");
near(comp("R21"), comp("U8"), "high");

blockClearance("antenna", "all", 3.0, "critical");
blockClearance("usb_connector", "mcu_core", 1.0, "high");
blockClearance("usb_connector", "power_path", 1.0, "critical");
blockClearance("current_sense", "antenna", 3.0, "critical");
blockClearance("current_sense", "power_path", 0.8, "critical");
