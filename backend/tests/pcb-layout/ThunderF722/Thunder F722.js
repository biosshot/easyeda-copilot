board.rect(50, 50, {
  layers: ["top", "bottom"],
  defaultLayer: "top",
  clearance: 0.05,
  edge: 0.8
});

solver({ grid: 0.5, ignoredSignals: ["GND"], compactness: "high" });
silkscreen.designators({ height: 0.75, rotations: [0, 90], margin: 0.15 });

block("mount_holes", ["H1", "H2", "H3", "H4"], "connector", { allowDisconnected: true });

block("usb_connector", ["USB1", "R13", "R19"], "connector");
block("usb_esd", ["D1", "R8", "R9"], "connector");
block("usb_power_or", ["D2"], "power");

block("mcu_core", ["U2"], "mcu");
block("mcu_clock", ["X1"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U2", "5")
});
block("mcu_vcap", ["C20"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U2", "30")
});
block("mcu_boot", ["R11", "SW1"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U2", "60")
});
block("mcu_status", ["LED1", "R16"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U2", "46")
});
block("mcu_decoup_a", ["C38", "C37", "C32"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U2", "1")
});
block("mcu_decoup_b", ["C11", "C19", "C31"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U2", "19")
});
block("mcu_decoup_c", ["C12", "C23", "C24", "C25"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U2", "48")
});

block("flash", ["U4"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U2", "41")
});
block("flash_pullups", ["R5", "R6"], "mcu", {
  placement: "satellite",
  attachTo: "flash",
  anchor: pin("U4", "8")
});

block("gyro", ["R2", "C2"], "sensor", {
  placement: "main",
  anchor: pin("U2", "20")
});

block("i2c_pullups", ["R20", "R21"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U2", "28")
});
block("vbat_sense", ["R18", "R15"], "analog", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U2", "11")
});
block("beeper", ["Q3"], "generic", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U2", "4")
});
block("led_power", ["LED2", "R14", "LED3", "R17", "LED4", "R1"], "generic", {
  placement: "main",
  anchor: anchor("board.bottom"),
  allowDisconnected: true
});

block("ldo_3v3", ["U9", "C4"], "power", {
  placement: "main",
  anchor: anchor("board.left")
});

block("buck_5v_core", ["U3", "L1"], "power", {
  placement: "main",
  anchor: anchor("board.center")
});
block("buck_5v_input", ["C6", "C8", "C3", "C5", "C7"], "power", {
  placement: "satellite",
  attachTo: "buck_5v_core",
  anchor: pin("U3", "7")
});
block("buck_5v_output", ["C14", "C15"], "power", {
  placement: "satellite",
  attachTo: "buck_5v_core",
  anchor: pin("L1", "2")
});
block("buck_5v_switch", ["R22", "C13"], "power", {
  placement: "satellite",
  attachTo: "buck_5v_core",
  anchor: pin("U3", "6")
});
block("buck_5v_comp", ["R4", "C9"], "analog", {
  placement: "satellite",
  attachTo: "buck_5v_core",
  anchor: pin("U3", "2")
});
block("buck_5v_feedback_a", ["R24", "R30", "R29"], "analog", {
  placement: "satellite",
  attachTo: "buck_5v_core",
  anchor: pin("U3", "1")
});
block("buck_5v_feedback_b", ["R3"], "analog", {
  placement: "satellite",
  attachTo: "buck_5v_core",
  anchor: pin("U3", "3")
});

block("boost_9v_core", ["U1", "L2"], "power", {
  placement: "main",
  anchor: anchor("board.center")
});
block("boost_9v_input", ["C22"], "power", {
  placement: "satellite",
  attachTo: "boost_9v_core",
  anchor: pin("U1", "7")
});
block("boost_9v_output", ["C16", "C17"], "power", {
  placement: "satellite",
  attachTo: "boost_9v_core",
  anchor: pin("L2", "2")
});
block("boost_9v_switch", ["R12", "C18"], "power", {
  placement: "satellite",
  attachTo: "boost_9v_core",
  anchor: pin("U1", "6")
});
block("boost_9v_comp", ["C21", "R27"], "analog", {
  placement: "satellite",
  attachTo: "boost_9v_core",
  anchor: pin("U1", "2")
});
block("boost_9v_feedback_a", ["R10", "R26", "R7"], "analog", {
  placement: "satellite",
  attachTo: "boost_9v_core",
  anchor: pin("U1", "1")
});
block("boost_9v_feedback_b", ["R28"], "analog", {
  placement: "satellite",
  attachTo: "boost_9v_core",
  anchor: pin("U1", "3")
});

block("left_io", ["9V", "5V1", "GND3", "GND4", "TX1", "RX1", "RX2", "TX5", "TX6", "RX6", "SCL1", "SDA1"], "connector", {
  allowDisconnected: true
});
block("right_io_a", ["GND10", "B-1", "B+1", "GND9", "RX3", "TX3", "5V6", "GND8", "TX2", "VTX1", "5VTX", "TX2A"], "connector", {
  allowDisconnected: true
});
block("right_io_b", ["9VTX", "GND6", "CAM1", "9V2", "CURR1", "M1", "M2", "M3", "M4", "VBAT1", "GND5", "RX5"], "connector", {
  allowDisconnected: true
});
block("edge_connectors", ["P1", "U10", "U5", "CN1"], "connector", {
  allowDisconnected: true
});

// module("mcu_section", ["mcu_core", "gyro", "flash"], { anchor: anchor("board.center") });
// module("power_section", ["buck_5v_core", "boost_9v_core", "ldo_3v3"], { anchor: anchor("board.center") });
// module("edge_io", ["left_io", "right_io_a", "right_io_b", "edge_connectors"], { anchor: anchor("board.right") });
// module("usb_section", ["usb_connector", "usb_esd", "usb_power_or"], { anchor: anchor("board.left") });

component("H1").block("mount_holes").role("connector").top().fixed({ x: -20.5, y: -20.5, layer: "top" });
component("H2").block("mount_holes").role("connector").top().fixed({ x: 20.5, y: -20.5, layer: "top" });
component("H3").block("mount_holes").role("connector").top().fixed({ x: -20.5, y: 20.5, layer: "top" });
component("H4").block("mount_holes").role("connector").top().fixed({ x: 20.5, y: 20.5, layer: "top" });

component("USB1").block("usb_connector").role("connector").top().edgeMount("left", {
  y: -12,
  overhang: 1.2,
  face: "outward",
  layer: "top"
});
["R13", "R19"].forEach(d => component(d).block("usb_connector").role("passive").top());
component("D1").block("usb_esd").role("passive").top();
["R8", "R9"].forEach(d => component(d).block("usb_esd").role("passive").top());
component("D2").block("usb_power_or").role("passive").top();

component("U2").block("mcu_core").role("main_ic").top();
component("X1").block("mcu_clock").role("crystal").top();
component("C20").block("mcu_vcap").role("decoupling_cap").top();
component("R11").block("mcu_boot").role("passive").top();
component("SW1").block("mcu_boot").role("connector").top().rotations(0, 180);
component("LED1").block("mcu_status").role("indicator").top();
component("R16").block("mcu_status").role("passive").top();
["C38", "C37", "C32"].forEach(d => component(d).block("mcu_decoup_a").role("decoupling_cap").top());
["C11", "C19", "C31"].forEach(d => component(d).block("mcu_decoup_b").role("decoupling_cap").top());
["C12", "C23", "C24", "C25"].forEach(d => component(d).block("mcu_decoup_c").role("decoupling_cap").top());

component("U4").block("flash").role("main_ic").top();
["R5", "R6"].forEach(d => component(d).block("flash_pullups").role("passive").top());
component("R2").block("gyro").role("main_ic").top();
component("C2").block("gyro").role("decoupling_cap").top();
["R20", "R21"].forEach(d => component(d).block("i2c_pullups").role("passive").top());
["R18", "R15"].forEach(d => component(d).block("vbat_sense").role("passive").top());
component("Q3").block("beeper").role("passive").top();
["LED2", "LED3", "LED4"].forEach(d => component(d).block("led_power").role("indicator").top());
["R14", "R17", "R1"].forEach(d => component(d).block("led_power").role("passive").top());

component("U9").block("ldo_3v3").role("main_ic").top();
component("C4").block("ldo_3v3").role("decoupling_cap").top();

component("U3").block("buck_5v_core").role("main_ic").top();
component("L1").block("buck_5v_core").role("passive").top();
["C6", "C8", "C3", "C5", "C7"].forEach(d => component(d).block("buck_5v_input").role("decoupling_cap").top());
["C14", "C15"].forEach(d => component(d).block("buck_5v_output").role("decoupling_cap").top());
["R22", "C13"].forEach(d => component(d).block("buck_5v_switch").role(d.startsWith("C") ? "decoupling_cap" : "passive").top());
["R4", "C9"].forEach(d => component(d).block("buck_5v_comp").role(d.startsWith("C") ? "decoupling_cap" : "passive").top());
["R24", "R30", "R29"].forEach(d => component(d).block("buck_5v_feedback_a").role("passive").top());
component("R3").block("buck_5v_feedback_b").role("passive").top();

component("U1").block("boost_9v_core").role("main_ic").top();
component("L2").block("boost_9v_core").role("passive").top();
component("C22").block("boost_9v_input").role("decoupling_cap").top();
["C16", "C17"].forEach(d => component(d).block("boost_9v_output").role("decoupling_cap").top());
["R12", "C18"].forEach(d => component(d).block("boost_9v_switch").role(d.startsWith("C") ? "decoupling_cap" : "passive").top());
["C21", "R27"].forEach(d => component(d).block("boost_9v_comp").role(d.startsWith("C") ? "decoupling_cap" : "passive").top());
["R10", "R26", "R7"].forEach(d => component(d).block("boost_9v_feedback_a").role("passive").top());
component("R28").block("boost_9v_feedback_b").role("passive").top();

componentGrid("left_io_grid", [
  ["9V", "TX1", "TX6"],
  ["5V1", "RX1", "RX6"],
  ["GND3", "RX2", "SCL1"],
  ["GND4", "TX5", "SDA1"]
], {
  origin: { x: -23.3, y: 1.6 },
  columnPitch: 2.2,
  rowPitch: 2.2,
  block: "left_io",
  layer: "top",
  rotate: 0
});

componentGrid("right_io_a_grid", [
  ["TX2", "RX3", "GND10"],
  ["VTX1", "TX3", "B-1"],
  ["5VTX", "5V6", "B+1"],
  ["TX2A", "GND8", "GND9"]
], {
  origin: { x: 18.4, y: 1.6 },
  columnPitch: 2.2,
  rowPitch: 2.2,
  block: "right_io_a",
  layer: "top",
  rotate: 0
});

componentGrid("right_io_b_grid", [
  ["9VTX", "GND6", "CAM1", "9V2"],
  ["VBAT1", "GND5", "M1", "M2", "M3", "M4", "CURR1", "RX5"]
], {
  origin: { x: -7.35, y: 20.6 },
  columnPitch: 2.1,
  rowPitch: 2.1,
  block: "right_io_b",
  layer: "top",
  rotate: 0
});

component("P1").block("edge_connectors").role("connector").top().edgeMount("top", {
  x: 0,
  overhang: 0.3,
  face: "outward",
  layer: "top"
});
component("U10").block("edge_connectors").role("connector").top().edgeMount("top", {
  x: 13,
  overhang: 0.3,
  face: "outward",
  layer: "top"
});
component("U5").block("edge_connectors").role("connector").top().edgeMount("right", {
  y: -12,
  overhang: 0.3,
  face: "outward",
  layer: "top"
});
component("CN1").block("edge_connectors").role("connector").top().edgeMount("top", {
  x: -13,
  overhang: 0.3,
  face: "outward",
  layer: "top"
});

near(block("usb_connector"), anchor("board.left"), "critical");
near(block("usb_esd"), block("usb_connector"), "critical");
near(block("mcu_core"), anchor("board.center"), "high");
near(block("gyro"), block("mcu_core"), "critical");
near(block("flash"), block("mcu_core"), "critical");
near(block("ldo_3v3"), block("mcu_core"), "normal");
near(block("buck_5v_core"), anchor("board.bottom"), "normal");
near(block("boost_9v_core"), anchor("board.bottom"), "normal");
near(block("led_power"), anchor("board.bottom"), "normal");
near(block("left_io"), anchor("board.left"), "critical");
near(block("right_io_a"), anchor("board.right"), "critical");
near(block("right_io_b"), anchor("board.bottom"), "critical");

blockClearance("mount_holes", "all", 0.2, "critical");
blockClearance("usb_connector", "mcu_core", 0.5, "critical");
blockClearance("buck_5v_core", "mcu_core", 0.5, "high");
blockClearance("boost_9v_core", "mcu_core", 0.5, "high");
blockClearance("buck_5v_core", "boost_9v_core", 0.5, "high");

criticalPair(pin("USB1", "5"), pin("D1", "1"), { maxDistance: 5.0, hard: false, weight: 7, preferFacingPads: true });
criticalPair(pin("USB1", "6"), pin("D1", "3"), { maxDistance: 5.0, hard: false, weight: 7, preferFacingPads: true });
criticalPair(pin("R8", "2"), pin("U2", "44"), { maxDistance: 12.0, hard: false, weight: 6, preferFacingPads: true });
criticalPair(pin("R9", "2"), pin("U2", "45"), { maxDistance: 12.0, hard: false, weight: 6, preferFacingPads: true });

criticalPair(pin("U4", "6"), pin("U2", "34"), { maxDistance: 9.0, hard: false, weight: 6, preferFacingPads: true });
criticalPair(pin("U4", "5"), pin("U2", "36"), { maxDistance: 9.0, hard: false, weight: 6, preferFacingPads: true });
criticalPair(pin("U4", "2"), pin("U2", "35"), { maxDistance: 9.0, hard: false, weight: 6, preferFacingPads: true });
criticalPair(pin("U4", "1"), pin("U2", "41"), { maxDistance: 9.0, hard: false, weight: 6, preferFacingPads: true });

criticalPair(pin("R2", "23"), pin("U2", "21"), { maxDistance: 8.0, hard: false, weight: 7, preferFacingPads: true });
criticalPair(pin("R2", "24"), pin("U2", "23"), { maxDistance: 8.0, hard: false, weight: 7, preferFacingPads: true });
criticalPair(pin("R2", "9"), pin("U2", "22"), { maxDistance: 8.0, hard: false, weight: 7, preferFacingPads: true });
criticalPair(pin("R2", "22"), pin("U2", "20"), { maxDistance: 8.0, hard: false, weight: 7, preferFacingPads: true });
criticalPair(pin("R2", "12"), pin("U2", "25"), { maxDistance: 8.0, hard: false, weight: 7, preferFacingPads: true });

criticalPair(pin("U3", "6"), pin("L1", "1"), { maxDistance: 4.0, hard: true, weight: 10, preferFacingPads: true });
criticalPair(pin("L1", "2"), pin("C14", "2"), { maxDistance: 5.5, hard: false, weight: 7, preferFacingPads: true });
criticalPair(pin("L1", "2"), pin("C15", "2"), { maxDistance: 5.5, hard: false, weight: 7, preferFacingPads: true });
criticalPair(pin("U1", "6"), pin("L2", "1"), { maxDistance: 4.0, hard: true, weight: 10, preferFacingPads: true });
criticalPair(pin("L2", "2"), pin("C16", "2"), { maxDistance: 5.5, hard: false, weight: 7, preferFacingPads: true });
criticalPair(pin("L2", "2"), pin("C17", "2"), { maxDistance: 5.5, hard: false, weight: 7, preferFacingPads: true });

capCluster(["C38", "C37", "C32"], {
  powerNet: "+3.3V",
  returnNet: "GND",
  target: pin("U2", "1"),
  maxRows: 2,
  maxPerRow: 2,
  gap: 0.1,
  rowGap: 0.1,
  topology: "center_power_bus",
  priority: "critical"
});
capCluster(["C11", "C19", "C31"], {
  powerNet: "+3.3V",
  returnNet: "GND",
  target: pin("U2", "19"),
  maxRows: 2,
  maxPerRow: 2,
  gap: 0.1,
  rowGap: 0.1,
  topology: "center_power_bus",
  priority: "critical"
});
capCluster(["C12", "C23", "C24", "C25"], {
  powerNet: "+3.3V",
  returnNet: "GND",
  target: pin("U2", "48"),
  maxRows: 2,
  maxPerRow: 2,
  gap: 0.1,
  rowGap: 0.1,
  topology: "center_power_bus",
  priority: "critical"
});
capCluster(["C6", "C8", "C3", "C5", "C7"], {
  powerNet: "+VLIPO",
  returnNet: "GND",
  target: pin("U3", "7"),
  maxRows: 2,
  maxPerRow: 3,
  gap: 0.1,
  rowGap: 0.1,
  topology: "center_power_bus",
  priority: "high"
});
capCluster(["C14", "C15"], {
  powerNet: "+5VBAT",
  returnNet: "GND",
  target: pin("L1", "2"),
  maxRows: 1,
  gap: 0.1,
  priority: "critical"
});
capCluster(["C16", "C17"], {
  powerNet: "+9V",
  returnNet: "GND",
  target: pin("L2", "2"),
  maxRows: 1,
  gap: 0.1,
  priority: "critical"
});

veryNear(pin("C4", "2"), pin("U9", "1"), "critical");
veryNear(pin("C20", "2"), pin("U2", "30"), "critical");
veryNear(pin("X1", "3"), pin("U2", "5"), "critical");
veryNear(pin("X1", "1"), pin("U2", "6"), "critical");
