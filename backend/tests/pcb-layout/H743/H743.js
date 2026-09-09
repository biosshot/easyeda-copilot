// MAVERICK_H743V1 placement v2.
// Mechanics are fixed from the approved mechanical preview.
// Schematic is immutable; null-footprint schematic markers are ignored and modeled mechanically.

board.roundedRect(45, 35, {
  radius: 1.0,
  segments: 8,
  layers: ["top", "bottom"],
  defaultLayer: "top",
  clearance: 0.1,
  edge: 0.10,
});

silkscreen.designators({ enabled: false });

solver({
  ignoreComponents: [
    "T1", "T2", "T3", "T4",
    "U10", "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18", "U19", "U20",
  ],
  grid: 0.5,
  ignoredSignals: ["GND"],
  compactness: "high",
});

function assign(designators, blockName, role, layer) {
  for (const designator of designators) {
    const c = component(designator).block(blockName).role(role);
    if (layer === "top") c.top();
    if (layer === "bottom") c.bottom();
  }
}

// ---- Fixed board mechanics -------------------------------------------------

block("usb_mech", ["USB1"], "connector", { allowDisconnected: true });
block("cn1_bottom", ["CN1"], "connector", { allowDisconnected: true });
block("cn3_top", ["CN3"], "connector", { allowDisconnected: true });
block("cn2_bottom", ["CN2"], "connector", { allowDisconnected: true });
block("cn4_top", ["CN4"], "connector", { allowDisconnected: true });
block("cn5_bottom", ["CN5"], "connector", { allowDisconnected: true });
block("cn6_top", ["CN6"], "connector", { allowDisconnected: true });
block("card_socket", ["CARD1"], "connector", { allowDisconnected: true });
block("buttons_top", ["SW1", "SW2"], "connector", { allowDisconnected: true });

component("USB1").block("usb_mech").role("connector").top()
  .fixed({ x: -18.19, y: 0.0, rotate: 270, layer: "top", boardOverflow: { left: 1.5 } })
  .faceTo("board.left");

component("CN1").block("cn1_bottom").role("connector").bottom()
  .fixed({ x: -2.57, y: -13.77, rotate: 0, layer: "bottom" });
component("CN3").block("cn3_top").role("connector").top()
  .fixed({ x: -2.57, y: -13.77, rotate: 0, layer: "top" });
component("CN2").block("cn2_bottom").role("connector").bottom()
  .fixed({ x: 18.39, y: -8.17, rotate: 90, layer: "bottom" });
component("CN4").block("cn4_top").role("connector").top()
  .fixed({ x: 18.39, y: -8.17, rotate: 90, layer: "top" });
component("CN5").block("cn5_bottom").role("connector").bottom()
  .fixed({ x: 18.39, y: 8.17, rotate: 90, layer: "bottom" });
component("CN6").block("cn6_top").role("connector").top()
  .fixed({ x: 18.39, y: 8.17, rotate: 90, layer: "top" });

component("CARD1").block("card_socket").role("connector").bottom()
  .fixed({ x: -3.86, y: 12.83, rotate: 0, layer: "bottom" });
component("SW1").block("buttons_top").role("connector").top()
component("SW2").block("buttons_top").role("connector").top()

boardHole("T1", { at: anchor("board.center"), offset: { x: -15.43, y: -11.67 }, drill: 3.0, diameter: 4.0, keepout: 2.1 });
boardHole("T2", { at: anchor("board.center"), offset: { x: 10.29, y: -11.67 }, drill: 3.0, diameter: 4.0, keepout: 2.1 });
boardHole("T3", { at: anchor("board.center"), offset: { x: -15.43, y: 11.67 }, drill: 3.0, diameter: 4.0, keepout: 2.1 });
boardHole("T4", { at: anchor("board.center"), offset: { x: 10.29, y: 11.67 }, drill: 3.0, diameter: 4.0, keepout: 2.1 });

// ---- MCU family ------------------------------------------------------------

block("mcu_core", ["U1"], "mcu", { placement: "main", anchor: anchor("board.center") });
block("mcu_decoup_main", ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "K1"),
});
block("mcu_vcap_boot_reset", ["C9", "C10", "C11", "R1", "R2"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "E7"),
});
block("mcu_clock", ["X1"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "C1"),
});

component("U1").block("mcu_core").role("main_ic").top();
assign(["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"], "mcu_decoup_main", "decoupling_cap", "bottom");
assign(["C9", "C10", "C11"], "mcu_vcap_boot_reset", "decoupling_cap", "bottom");
assign(["R1", "R2"], "mcu_vcap_boot_reset", "passive", "bottom");
component("X1").block("mcu_clock").role("crystal").top();

// module("mcu_family", ["mcu_core", "mcu_decoup_main", "mcu_vcap_boot_reset", "mcu_clock"], {
//   anchor: anchor("board.center"),
// });

// ---- USB and left-edge support --------------------------------------------

block("usb_cc", ["R6", "R7"], "connector", {
  placement: "satellite",
  attachTo: "usb_mech",
  anchor: pin("USB1", "A5"),
  allowDisconnected: true,
});
block("usb_power", ["D1", "R3", "R4", "R5", "LED1"], "power", {
  placement: "satellite",
  attachTo: "usb_mech",
  anchor: pin("USB1", "A4B9"),
  allowDisconnected: true,
});
block("usb_series", ["R8", "R9"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "C10"),
  allowDisconnected: true,
});

assign(["R6", "R7"], "usb_cc", "passive", "top");
assign(["D1", "R3", "R4", "R5"], "usb_power", "passive", "top");
component("LED1").block("usb_power").role("indicator").top();
assign(["R8", "R9"], "usb_series", "passive", "top");

// module("usb_family", ["usb_mech", "usb_cc", "usb_power", "usb_series"], {
//   anchor: anchor("board.left"),
// });

// ---- Power converters ------------------------------------------------------

block("buck_5_core", ["U4", "L1", "D2"], "power", {
  placement: "main",
  anchor: anchor("board.bottom_left"),
});
block("buck_5_input", ["C20", "C21", "C22", "C25", "C26", "R10"], "power", {
  placement: "satellite",
  attachTo: "buck_5_core",
  anchor: pin("U4", "7"),
});
block("buck_5_output", ["C23", "C24"], "power", {
  placement: "satellite",
  attachTo: "buck_5_core",
  anchor: pin("L1", "2"),
});
block("buck_5_feedback", ["R11", "R12"], "analog", {
  placement: "satellite",
  attachTo: "buck_5_core",
  anchor: pin("U4", "5"),
});

block("buck_9_core", ["U5", "L2"], "power", {
  placement: "main",
  anchor: anchor("board.bottom_left"),
});
block("buck_9_input", ["C27", "C28", "C29", "C32", "C33", "R13"], "power", {
  placement: "satellite",
  attachTo: "buck_9_core",
  anchor: pin("U5", "7"),
});
block("buck_9_output", ["C30", "C31"], "power", {
  placement: "satellite",
  attachTo: "buck_9_core",
  anchor: pin("L2", "2"),
});
block("buck_9_feedback", ["R14", "R15"], "analog", {
  placement: "satellite",
  attachTo: "buck_9_core",
  anchor: pin("U5", "5"),
});

block("input_protection", ["D3", "D4"], "power", { placement: "main", anchor: anchor("board.left") });
block("ldo_main", ["U2", "C12", "C13", "C14", "C15", "C16", "C17"], "power", {
  placement: "main",
  anchor: comp("U1"),
});
block("ldo_gyro", ["U3", "C18", "C19"], "power", {
  placement: "main",
  anchor: anchor("board.center"),
});

component("U4").block("buck_5_core").role("main_ic").bottom();
assign(["L1", "D2"], "buck_5_core", "passive", "bottom");
assign(["C20", "C21", "C22", "C25", "C26"], "buck_5_input", "decoupling_cap", "bottom");
component("R10").block("buck_5_input").role("passive").bottom();
assign(["C23", "C24"], "buck_5_output", "decoupling_cap", "bottom");
assign(["R11", "R12"], "buck_5_feedback", "passive", "bottom");

component("U5").block("buck_9_core").role("main_ic").bottom();
component("L2").block("buck_9_core").role("passive").bottom();
assign(["C27", "C28", "C29", "C32", "C33"], "buck_9_input", "decoupling_cap", "bottom");
component("R13").block("buck_9_input").role("passive").bottom();
assign(["C30", "C31"], "buck_9_output", "decoupling_cap", "bottom");
assign(["R14", "R15"], "buck_9_feedback", "passive", "bottom");

assign(["D3", "D4"], "input_protection", "passive", "top");
component("U2").block("ldo_main").role("main_ic").bottom();
assign(["C12", "C13", "C14", "C15", "C16", "C17"], "ldo_main", "decoupling_cap", "bottom");
component("U3").block("ldo_gyro").role("main_ic").bottom();
assign(["C18", "C19"], "ldo_gyro", "decoupling_cap", "bottom");

// module("power_family", [
//   "buck_5_core", "buck_5_input", "buck_5_output", "buck_5_feedback",
//   "buck_9_core", "buck_9_input", "buck_9_output", "buck_9_feedback",
//   "input_protection", "ldo_main", "ldo_gyro",
// ], { anchor: anchor("board.bottom_left") });

// ---- OSD / video -----------------------------------------------------------

block("osd_core", ["U6"], "generic", { placement: "main", anchor: comp("CN2") });
block("osd_video", ["R16", "R17", "R18", "C34", "C35", "C36", "X2"], "generic", {
  placement: "satellite",
  attachTo: "osd_core",
  anchor: pin("U6", "22"),
});
block("osd_decoup", ["C39", "C40", "C41"], "generic", {
  placement: "satellite",
  attachTo: "osd_core",
  anchor: pin("U6", "3"),
});

component("U6").block("osd_core").role("main_ic").top();
assign(["R16", "R17", "R18", "C34", "C35", "C36"], "osd_video", "passive", "top");
component("X2").block("osd_video").role("crystal").top();
assign(["C39", "C40", "C41"], "osd_decoup", "decoupling_cap", "top");
// module("osd_family", ["osd_core", "osd_video", "osd_decoup"], { anchor: anchor("board.top_right") });

// ---- Sensors ---------------------------------------------------------------

block("gyro1", ["U7", "C37", "C42", "C43"], "sensor", {
  placement: "main",
  anchor: anchor("board.center"),
});
block("gyro2", ["U8", "C38", "C44", "C45"], "sensor", {
  placement: "main",
  anchor: anchor("board.center"),
});
block("baro", ["U9", "R19", "R20", "R21", "R27", "C46", "C47", "C48", "C49"], "sensor", {
  placement: "main",
  anchor: anchor("board.center"),
});

component("U7").block("gyro1").role("main_ic").top();
assign(["C37", "C42", "C43"], "gyro1", "decoupling_cap", "top");
component("U8").block("gyro2").role("main_ic").top();
assign(["C38", "C44", "C45"], "gyro2", "decoupling_cap", "top");
component("U9").block("baro").role("main_ic").top();
assign(["C46", "C47", "C48", "C49"], "baro", "decoupling_cap", "top");
assign(["R19", "R20", "R21", "R27"], "baro", "passive", "top");
// module("sensor_family", ["gyro1", "gyro2", "baro"], { anchor: anchor("board.center") });

// ---- Remaining interfaces --------------------------------------------------

block("can_if", ["U21", "R36"], "generic", { placement: "main", anchor: comp("CN4") });
component("U21").block("can_if").role("main_ic").top();
component("R36").block("can_if").role("passive").top();

block("beeper_sbus_adc", ["Q1", "Q2", "R28", "R29", "R30", "R33", "R34", "R35"], "generic", {
  placement: "main",
  anchor: anchor("board.right"),
});
assign(["Q1", "Q2"], "beeper_sbus_adc", "passive", "bottom");
assign(["R28", "R29", "R30", "R33", "R34", "R35"], "beeper_sbus_adc", "passive", "bottom");

block("status_leds", ["LED2", "LED3", "R31", "R32"], "generic", {
  placement: "main",
  anchor: anchor("board.top"),
});
assign(["LED2", "LED3"], "status_leds", "indicator", "top");
assign(["R31", "R32"], "status_leds", "passive", "top");

block("unused_pullups", ["R22", "R23", "R24", "R25", "R26"], "generic", {
  placement: "main",
  anchor: anchor("board.right"),
  allowDisconnected: true,
});
assign(["R22", "R23", "R24", "R25", "R26"], "unused_pullups", "passive", "top");

// ---- Electrical intent / DSL features -------------------------------------

near(block("mcu_core"), anchor("board.center"), "critical");
near(block("gyro1"), block("mcu_core"), "critical");
near(block("gyro2"), block("mcu_core"), "critical");
near(block("baro"), block("mcu_core"), "high");
near(block("usb_series"), block("usb_mech"), "high");
near(block("osd_core"), block("cn2_bottom"), "high");
near(block("can_if"), block("cn4_top"), "high");


coreIsland("buck_5_switch_loop", ["U4", "L1"], {
  pairs: [[pin("U4", "2"), pin("L1", "1")]],
  maxDistance: 5.0,
  hard: true,
  weight: 10,
  preferFacingPads: true,
});
criticalPair(pin("U4", "7"), pin("C21", "2"), { maxDistance: 4.8, hard: true, weight: 8, preferFacingPads: true });
criticalPair(pin("U4", "5"), pin("R11", "1"), { maxDistance: 4.8, hard: true, weight: 7, preferFacingPads: true });
criticalPair(pin("L1", "2"), pin("C23", "2"), { maxDistance: 5.5, weight: 7, preferFacingPads: true });

coreIsland("buck_9_switch_loop", ["U5", "L2"], {
  pairs: [[pin("U5", "2"), pin("L2", "1")]],
  maxDistance: 5.0,
  hard: true,
  weight: 10,
  preferFacingPads: true,
});
criticalPair(pin("U5", "7"), pin("C28", "2"), { maxDistance: 4.8, hard: true, weight: 8, preferFacingPads: true });
criticalPair(pin("U5", "5"), pin("R14", "1"), { maxDistance: 4.8, hard: true, weight: 7, preferFacingPads: true });
criticalPair(pin("L2", "2"), pin("C30", "2"), { maxDistance: 5.5, weight: 7, preferFacingPads: true });

criticalPair(pin("X1", "1"), pin("U1", "D1"), { maxDistance: 5.0, hard: true, weight: 8, preferFacingPads: true });
criticalPair(pin("X1", "3"), pin("U1", "C1"), { maxDistance: 5.0, hard: true, weight: 8, preferFacingPads: true });
criticalPair(pin("X2", "1"), pin("U6", "5"), { maxDistance: 5.0, hard: true, weight: 7, preferFacingPads: true });
criticalPair(pin("X2", "3"), pin("U6", "6"), { maxDistance: 5.0, hard: true, weight: 7, preferFacingPads: true });

capCluster(["C1", "C2", "C3", "C4", "C5", "C6"], {
  powerNet: "3V3_A",
  returnNet: "GND",
  target: pin("U1", "K1"),
  maxRows: 2,
  maxPerRow: 3,
  gap: 0.1,
  rowGap: 0.1,
  topology: "center_power_bus",
  priority: "critical",
});
capCluster(["C37", "C42", "C43"], {
  powerNet: "3V3_GYRO",
  returnNet: "GND",
  target: pin("U7", "5"),
  maxRows: 1,
  gap: 0.1,
  priority: "critical",
});
capCluster(["C38", "C44", "C45"], {
  powerNet: "3V3_GYRO",
  returnNet: "GND",
  target: pin("U8", "5"),
  maxRows: 1,
  gap: 0.1,
  priority: "critical",
});
capCluster(["C46", "C47", "C48"], {
  powerNet: "3V3_A",
  returnNet: "GND",
  target: pin("U9", "6"),
  maxRows: 2,
  maxPerRow: 2,
  gap: 0.1,
  rowGap: 0.1,
  topology: "center_power_bus",
  priority: "high",
});

bypass(["C10"], pin("U1", "E7"), "critical", { gap: 0.1 });
bypass(["C11"], pin("U1", "F8"), "critical", { gap: 0.1 });
bypass(["C18"], pin("U3", "5"), "high", { gap: 0.1 });
bypass(["C19"], pin("U3", "5"), "high", { gap: 0.1 });
