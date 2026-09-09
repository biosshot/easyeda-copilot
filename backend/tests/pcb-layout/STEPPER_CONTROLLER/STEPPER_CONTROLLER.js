// Stepper controller layout intent.
// Board: 45 x 60 mm, two copper sides. The lower bottom-side area is kept for
// a directly mounted stepper motor. SCREW1..SCREW4 form a 31 x 31 mm mount.

board.roundedRect(45, 60, {
  radius: 2,
  segments: 8,
  layers: ["top", "bottom"],
  defaultLayer: "top",
  clearance: 0.1,
  edge: 0.8
});
solver({ grid: 0.5, fallbackGrid: 1, ignoredSignals: ["GND"], compactness: "high" });
silkscreen.designators({ height: 0.75, rotations: [0, 90], margin: 0.15 });

block("motor_mount", ["SCREW1", "SCREW2", "SCREW3", "SCREW4"], "connector", {
  allowDisconnected: true
});
component("SCREW1").block("motor_mount").role("connector").bottom()
  .fixed({ x: -15.5, y: -3.7, layer: "bottom" });
component("SCREW2").block("motor_mount").role("connector").bottom()
  .fixed({ x: 15.5, y: -3.7, layer: "bottom" });
component("SCREW3").block("motor_mount").role("connector").bottom()
  .fixed({ x: -15.5, y: 27.3, layer: "bottom" });
component("SCREW4").block("motor_mount").role("connector").bottom()
  .fixed({ x: 15.5, y: 27.3, layer: "bottom" });

block("usb_data_port", ["USB1", "R38", "R39", "R30", "R31", "D1", "D2", "C2", "R9"], "connector", {
  placement: "main",
  anchor: anchor("board.top"),
  allowDisconnected: true
});
block("usb_pd_input", ["USB2", "U9", "R8", "R10", "R12", "R13", "R26", "R28", "R29", "R42", "LED2", "C33"], "power", {
  placement: "main",
  anchor: anchor("board.top_right"),
  allowDisconnected: true
});
block("usb_uart", ["USB3", "R40", "R41"], "connector", {
  placement: "main",
  anchor: anchor("board.right"),
  allowDisconnected: true
});
block("ideal_diode_20v", ["U12", "Q2", "C41"], "power", {
  placement: "main",
  anchor: anchor("board.top_right")
});

block("buck_core", ["U10", "U11", "C37"], "power", {
  placement: "main",
  anchor: anchor("board.top_left")
});
block("buck_input", ["C35", "C36", "C40", "R37"], "power", {
  placement: "satellite",
  attachTo: "buck_core",
  anchor: pin("U10", "3")
});
block("buck_feedback", ["C39", "R32", "R33", "R34"], "analog", {
  placement: "satellite",
  attachTo: "buck_core",
  anchor: pin("U10", "4")
});
block("buck_output", ["C42", "C43"], "power", {
  placement: "satellite",
  attachTo: "buck_core",
  anchor: pin("U11", "1")
});
block("mcu_core", ["U4", "C1", "C21", "C24", "C26", "C32", "D40"], "mcu", {
  placement: "main",
  anchor: anchor("board.left")
});
block("mcu_boot_en", ["R20", "R25", "C8", "C13", "SW1", "SW2"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U4", "8"),
  allowDisconnected: true
});
block("status_leds", ["LED1", "LED3", "LED4", "LED6", "R4", "R16", "R18", "R36"], "generic", {
  placement: "main",
  anchor: anchor("board.left"),
  allowDisconnected: true
});

block("encoder_sensor", ["U1", "R1", "R6", "R7", "CN1"], "sensor", {
  placement: "main",
  anchor: anchor("board.bottom_left"),
  allowDisconnected: true
});
block("diag_header", ["J1"], "connector", {
  placement: "main",
  anchor: anchor("board.left")
});
block("driver_core", ["DD1", "C34", "R27", "D16", "D17"], "power", {
  placement: "main",
  anchor: anchor("board.top"),
  allowDisconnected: true
});
block("motor_outputs", ["U7", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12"], "power", {
  placement: "main",
  anchor: anchor("board.bottom")
});

component("USB1").block("usb_data_port").role("connector").bottom()
  .edgeMount("top", { overhang: 1.0, x: -12, layer: "bottom", face: "outward" });
component("USB2").block("usb_pd_input").role("connector").bottom()
  .edgeMount("top", { overhang: 1.0, x: 11, layer: "bottom", face: "outward" });
component("USB3").block("usb_uart").role("connector").bottom()
  .edgeMount("right", { overhang: 1.0, y: -20, layer: "bottom", face: "outward" });
component("CN1").block("encoder_sensor").role("connector").bottom()
  .edgeMount("left", { overhang: 0.6, y: 11, layer: "bottom", face: "outward" });
component("J1").block("diag_header").role("connector").bottom()
  .edgeMount("left", { overhang: 0.6, y: -11, layer: "bottom", face: "outward" });
component("U7").block("motor_outputs").role("connector").bottom()
  .edgeMount("bottom", { overhang: 0.8, x: 0, layer: "bottom", face: "outward" });

component("DD1").block("driver_core").role("main_ic").top();
component("U4").block("mcu_core").role("main_ic").bottom();
component("U1").block("encoder_sensor").role("main_ic").bottom();
component("U9").block("usb_pd_input").role("main_ic").bottom();
component("U10").block("buck_core").role("main_ic").bottom();
component("U11").block("buck_core").role("passive").bottom();
component("U12").block("ideal_diode_20v").role("main_ic").bottom();
component("Q2").block("ideal_diode_20v").role("passive").bottom();
component("SW1").block("mcu_boot_en").role("passive").bottom();
component("SW2").block("mcu_boot_en").role("passive").bottom();

[
  "C1", "C2", "C8", "C13", "C21", "C24", "C26", "C32", "C33", "C35", "C36",
  "C37", "C39", "C40", "C41", "C42", "C43"
].forEach((designator) => component(designator).role("decoupling_cap").bottom());
component("C34").role("decoupling_cap").top();
[
  "R1", "R4", "R6", "R7", "R8", "R9", "R10", "R12", "R13", "R16", "R18", "R20",
  "R25", "R26", "R28", "R29", "R30", "R31", "R32", "R33", "R34", "R36",
  "R37", "R38", "R39", "R40", "R41", "R42"
].forEach((designator) => component(designator).role("passive").bottom());
component("R27").role("passive").top();
["D1", "D2", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D40"].forEach((designator) =>
  component(designator).role("passive").bottom()
);
["D16", "D17"].forEach((designator) => component(designator).role("passive").top());
["LED1", "LED2", "LED3", "LED4", "LED6"].forEach((designator) =>
  component(designator).role("indicator").bottom()
);

near(block("motor_mount"), anchor("board.bottom"), "critical");
near(block("driver_core"), block("motor_outputs"), "critical");
near(block("encoder_sensor"), block("motor_mount"), "high");
near(block("buck_core"), anchor("board.top_left"), "high");
near(block("usb_pd_input"), block("ideal_diode_20v"), "high");
away(block("buck_core"), block("encoder_sensor"), "normal");

blockClearance("motor_mount", "all", 1.0, "critical");
blockClearance("buck_core", "mcu_core", 1.0, "high");
blockClearance("driver_core", "mcu_core", 1.5, "critical");
blockClearance("driver_core", "mcu_boot_en", 1.5, "critical");
blockClearance("driver_core", "buck_core", 1.0, "normal");
blockClearance("motor_outputs", "motor_mount", 2.0, "critical");
blockClearance("usb_uart", "motor_mount", 2.0, "critical");
