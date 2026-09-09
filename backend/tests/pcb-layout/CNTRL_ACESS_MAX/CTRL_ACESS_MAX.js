// CTRL_ACESS_MAX access controller layout intent.
// Main mechanical interfaces are held on board edges; placement then builds
// compact power, ESP32, USB, RS-485, and external I/O islands around them.

board.roundedRect(80, 60, {
    radius: 2.5,
    segments: 10,
    layers: ["top", "bottom"],
    defaultLayer: "top",
    clearance: 0.1,
    edge: 0.6,
});
silkscreen.designators({ height: 0.9, rotations: [0, 90], margin: 0.22 });

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

block("usb_port", ["USB1"], "connector", {
    placement: "main",
    anchor: anchor("board.left"),
    maxBboxWidth: 14,
    maxBboxHeight: 8,
});
block("usb_cc", ["R6", "R8"], "connector", {
    placement: "satellite",
    attachTo: "usb_port",
    anchor: pin("USB1", "4"),
    sidePreference: "right",
    maxBboxWidth: 6,
    maxBboxHeight: 6,
    maxAnchorGap: 5,
    hardAnchor: true,
    placementClearance: 0.45,
    allowDisconnected: true,
});
block("usb_power_protect", ["U1", "D1"], "power", {
    placement: "satellite",
    attachTo: "usb_port",
    anchor: pin("USB1", "2"),
    sidePreference: "right",
    maxBboxWidth: 9,
    maxBboxHeight: 7,
    maxAnchorGap: 7,
    placementClearance: 0.5,
});
block("usb_data_esd", ["U9", "U10"], "mcu", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U5", "14"),
    sidePreference: "left",
    maxBboxWidth: 5,
    maxBboxHeight: 5,
    maxAnchorGap: 7,
    placementClearance: 0.4,
    allowDisconnected: true,
});

block("poe_input", ["RJ1", "D7", "C18"], "power", {
    placement: "main",
    anchor: anchor("board.bottom"),
    maxBboxWidth: 42,
    maxBboxHeight: 34,
    placementClearance: 0.9,
});
block("buck_12v", ["U16", "L1", "D2", "C2", "L2", "C20", "C3"], "power", {
    placement: "main",
    anchor: anchor("board.bottom_right"),
    maxBboxWidth: 38,
    maxBboxHeight: 26,
    placementClearance: 0.9,
});
block("protected_12v", ["P1", "D4", "D5", "Q2", "Q3", "R16", "R17", "R18"], "power", {
    placement: "main",
    anchor: anchor("board.top_right"),
    maxBboxWidth: 24,
    maxBboxHeight: 20,
    placementClearance: 0.85,
});
block("linear_5v", ["U14", "C17"], "power", {
    placement: "main",
    anchor: anchor("board.top"),
    maxBboxWidth: 12,
    maxBboxHeight: 10,
    placementClearance: 0.75,
});
block("ldo_3v3p", ["U13", "C13", "C14", "C15", "D6", "C19"], "power", {
    placement: "main",
    anchor: anchor("board.top"),
    maxBboxWidth: 22,
    maxBboxHeight: 12,
    placementClearance: 0.75,
});
block("load_switch_3v3", ["U8", "C6", "C7", "R12"], "power", {
    placement: "satellite",
    attachTo: "ldo_3v3p",
    anchor: pin("U8", "5"),
    sidePreference: "bottom",
    maxBboxWidth: 13,
    maxBboxHeight: 10,
    maxAnchorGap: 9,
    placementClearance: 0.65,
});

block("mcu_core", ["U5"], "mcu", {
    placement: "main",
    anchor: anchor("board.center"),
    familyMaxWidth: 48,
    familyMaxHeight: 42,
    placementClearance: 0.9,
});
block("mcu_decoupling", ["C4", "C5"], "mcu", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U5", "2"),
    sidePreference: "left",
    maxBboxWidth: 6,
    maxBboxHeight: 5,
    maxAnchorGap: 14,
    placementClearance: 0.45,
});
block("mcu_boot_reset", ["SW2", "SW3", "R11", "C11", "C8"], "mcu", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U5", "3"),
    sidePreference: "left",
    maxBboxWidth: 13,
    maxBboxHeight: 12,
    maxAnchorGap: 10,
    placementClearance: 0.55,
    allowDisconnected: true,
});
block("mcu_status_led", ["LED1", "R19"], "generic", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U5", "17"),
    sidePreference: "top",
    maxAnchorGap: 14,
    placementClearance: 0.45,
});

block("rs485_core", ["U3", "U4", "U12", "Q4", "R21", "R7", "R2", "R3", "R4"], "generic", {
    placement: "main",
    anchor: anchor("board.right"),
    maxBboxWidth: 23,
    maxBboxHeight: 22,
    placementClearance: 0.65,
});
block("rs485_bus", ["SW1", "R5", "R1", "R10"], "connector", {
    placement: "satellite",
    attachTo: "rs485_core",
    anchor: pin("U3", "6"),
    sidePreference: "bottom",
    maxBboxWidth: 18,
    maxBboxHeight: 10,
    maxAnchorGap: 9,
    placementClearance: 0.65,
});

block("uart_connector", ["U6"], "connector", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U5", "10"),
    sidePreference: "right",
    maxBboxWidth: 10,
    maxBboxHeight: 12,
    maxAnchorGap: 12,
    placementClearance: 0.55,
});
block("spi_connector", ["CN2"], "connector", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U5", "18"),
    sidePreference: "right",
    maxBboxWidth: 13,
    maxBboxHeight: 12,
    maxAnchorGap: 14,
    placementClearance: 0.55,
});
block("manual_latch", ["CN1", "R13"], "connector", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U5", "17"),
    sidePreference: "top",
    maxBboxWidth: 10,
    maxBboxHeight: 10,
    maxAnchorGap: 12,
    placementClearance: 0.55,
});
block("mag_input", ["U11", "R15", "R20", "C9", "U15"], "connector", {
    placement: "main",
    anchor: anchor("board.left"),
    maxBboxWidth: 18,
    maxBboxHeight: 14,
    placementClearance: 0.7,
});

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

module("power_tree", [
    "poe_input",
    "buck_12v",
    "protected_12v",
    "linear_5v",
    "ldo_3v3p",
], {
    anchor: anchor("board.top"),
    maxWidth: 84,
    maxHeight: 58,
    hardBbox: false,
    placementPriority: "high",
});
module("esp32_system", [
    "usb_port",
    "mcu_core",
], {
    anchor: anchor("board.center"),
    maxWidth: 62,
    maxHeight: 48,
    hardBbox: false,
});
module("field_io", ["rs485_core", "mag_input"], {
    anchor: anchor("board.right"),
    maxWidth: 84,
    maxHeight: 52,
    hardBbox: false,
});

// ---------------------------------------------------------------------------
// Component options
// ---------------------------------------------------------------------------

component("USB1").block("usb_port").role("connector").top()
    .edgeMount("left", { overhang: 1.2, y: -19, layer: "top", face: "outward" });
component("RJ1").block("poe_input").role("connector").top()
    .edgeMount("bottom", { overhang: 1.4, x: -22, layer: "top", face: "outward" });
component("P1").block("protected_12v").role("connector").top()
    .fixed({ anchor: anchor("board.right"), offset: { x: -7, y: -18 }, rotate: 270, layer: "top" });
component("U11").block("mag_input").role("connector").top()
    .edgeMount("left", { overhang: 1.0, y: 9, layer: "top", face: "outward" });
component("U6").block("uart_connector").role("connector").top()
    .rotations(0, 180);
component("CN1").block("manual_latch").role("connector").top()
    .rotations(0, 180);
component("CN2").block("spi_connector").role("connector").top()
    .rotations(0, 180);
component("SW1").block("rs485_bus").role("connector").top()

for (const d of ["U5", "U13", "U14", "U8", "U3", "U16"]) component(d).role("main_ic").top();
for (const d of ["U1", "U4", "U9", "U10", "U12", "U15", "Q2", "Q3", "Q4"]) component(d).role("passive").top();
for (const d of ["L1", "L2", "D1", "D2", "D4", "D5", "D6", "D7"]) component(d).role("passive").top();
for (const d of ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R10", "R11", "R12", "R13", "R15", "R16", "R17", "R18", "R19", "R20", "R21"]) component(d).role("passive").top();
for (const d of ["C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C11", "C13", "C14", "C15", "C17", "C18", "C19", "C20"]) component(d).role("decoupling_cap").top();
for (const d of ["SW2", "SW3"]) component(d).role("passive").top();
component("LED1").role("indicator").top();

// Keep dense packages in predictable orientations and align small passive rows.
component("U5").rotations(0, 180);
component("U3").rotations(0, 180);
component("U16").rotations(0, 180);

line(["R6", "R8"], "x", { gap: 0.6, priority: "high" });
line(["U9", "U10"], "x", { gap: 0.55, priority: "high" });
line(["SW3", "SW2"], "y", { gap: 0.8, priority: "normal" });
line(["R2", "R3", "R4"], "y", { gap: 0.55, priority: "high" });
line(["R17", "R18", "Q3"], "x", { gap: 0.65, priority: "normal" });
line(["D4", "D5"], "x", { gap: 0.8, priority: "high" });

// ---------------------------------------------------------------------------
// Placement relationships
// ---------------------------------------------------------------------------

near(block("usb_port"), block("mcu_core"), "high");
near(block("usb_data_esd"), block("usb_port"), "critical");
near(block("usb_power_protect"), block("ldo_3v3p"), "high");
near(block("poe_input"), block("buck_12v"), "critical");
near(block("buck_12v"), block("protected_12v"), "high");
near(block("linear_5v"), block("buck_12v"), "high");
near(block("ldo_3v3p"), block("mcu_core"), "high");
near(block("load_switch_3v3"), block("mcu_core"), "critical");
near(block("rs485_core"), block("mcu_core"), "high");
near(block("rs485_bus"), block("rs485_core"), "critical");
near(block("uart_connector"), block("mcu_core"), "normal");
near(block("spi_connector"), block("mcu_core"), "normal");
near(block("manual_latch"), block("mcu_core"), "normal");
near(block("mag_input"), block("mcu_core"), "normal");

blockClearance("buck_12v", "mcu_core", 3.0, "high");
blockClearance("buck_12v", "rs485_core", 2.0, "normal");
blockClearance("protected_12v", "mcu_core", 2.0, "normal");
blockClearance("rs485_core", "mcu_core", 1.5, "high");
blockClearance("poe_input", "usb_port", 2.2, "high");
blockClearance("uart_connector", "spi_connector", 1.2, "normal");
blockClearance("manual_latch", "spi_connector", 1.2, "normal");

// ---------------------------------------------------------------------------
// Critical local electrical geometry
// ---------------------------------------------------------------------------

criticalPair(pin("USB1", "4"), pin("R6", "2"), { maxDistance: 4.8, hard: true, weight: 5, preferFacingPads: true });
criticalPair(pin("USB1", "10"), pin("R8", "2"), { maxDistance: 7, hard: true, weight: 5, preferFacingPads: true });
criticalPair(pin("USB1", "5"), pin("U9", "2"), { maxDistance: 28, weight: 4, preferFacingPads: true });
criticalPair(pin("USB1", "6"), pin("U10", "2"), { maxDistance: 28, weight: 4, preferFacingPads: true });
criticalPair(pin("U9", "2"), pin("U5", "13"), { maxDistance: 11, weight: 4, crossingPenalty: 2 });
criticalPair(pin("U10", "2"), pin("U5", "14"), { maxDistance: 11, weight: 4, crossingPenalty: 2 });
criticalPair(pin("USB1", "2"), pin("D1", "2"), { maxDistance: 6, weight: 5, preferFacingPads: true });

criticalPair(pin("U16", "2"), pin("L1", "2"), { maxDistance: 9.5, hard: true, weight: 10, crossingPenalty: 3, preferFacingPads: true });
criticalPair(pin("U16", "2"), pin("D2", "1"), { maxDistance: 12.5, hard: true, weight: 10, crossingPenalty: 3, preferFacingPads: true });
criticalPair(pin("RJ1", "1"), pin("D7", "2"), { maxDistance: 7, weight: 6, preferFacingPads: true });
criticalPair(pin("D7", "1"), pin("U16", "1"), { maxDistance: 35, weight: 5, preferFacingPads: true });
criticalPair(pin("U16", "1"), pin("C3", "1"), { maxDistance: 6, weight: 5, preferFacingPads: true });
criticalPair(pin("L1", "1"), pin("C2", "1"), { maxDistance: 10, hard: true, weight: 8, preferFacingPads: true });
criticalPair(pin("U16", "4"), pin("C2", "1"), { maxDistance: 26, weight: 5, preferFacingPads: true });
criticalPair(pin("U16", "3"), pin("L2", "1"), { maxDistance: 6, weight: 4, preferFacingPads: true });

criticalPair(pin("U13", "3"), pin("C13", "2"), { maxDistance: 5, hard: true, weight: 7, preferFacingPads: true });
criticalPair(pin("U13", "4"), pin("C14", "2"), { maxDistance: 5, hard: true, weight: 7, preferFacingPads: true });
criticalPair(pin("U14", "3"), pin("C20", "2"), { maxDistance: 18, weight: 5, preferFacingPads: true });
criticalPair(pin("U14", "1"), pin("C17", "2"), { maxDistance: 5, weight: 5, preferFacingPads: true });
criticalPair(pin("U8", "5"), pin("C6", "2"), { maxDistance: 4.5, hard: true, weight: 6, preferFacingPads: true });
criticalPair(pin("U8", "1"), pin("C7", "2"), { maxDistance: 4.5, hard: true, weight: 6, preferFacingPads: true });
criticalPair(pin("U5", "2"), pin("C5", "2"), { maxDistance: 12, hard: true, weight: 6, preferFacingPads: true });
criticalPair(pin("U5", "3"), pin("R11", "1"), { maxDistance: 8, weight: 5, preferFacingPads: true });
criticalPair(pin("U5", "27"), pin("SW2", "2"), { maxDistance: 12, weight: 4 });
criticalPair(pin("U5", "17"), pin("R19", "2"), { maxDistance: 8, weight: 4, preferFacingPads: true });

criticalPair(pin("U5", "4"), pin("U3", "4"), { maxDistance: 105, weight: 2, crossingPenalty: 1, preferFacingPads: true });
criticalPair(pin("U5", "5"), pin("R7", "2"), { maxDistance: 105, weight: 2, crossingPenalty: 1, preferFacingPads: true });
criticalPair(pin("U5", "6"), pin("U3", "1"), { maxDistance: 105, weight: 2, crossingPenalty: 1, preferFacingPads: true });
criticalPair(pin("U3", "6"), pin("U4", "1"), { maxDistance: 8, weight: 6, crossingPenalty: 2, preferFacingPads: true });
criticalPair(pin("U3", "7"), pin("U4", "2"), { maxDistance: 8, weight: 6, crossingPenalty: 2, preferFacingPads: true });
criticalPair(pin("U3", "6"), pin("SW1", "1"), { maxDistance: 11, weight: 6, crossingPenalty: 2, preferFacingPads: true });
criticalPair(pin("U3", "7"), pin("R5", "2"), { maxDistance: 8, weight: 6, crossingPenalty: 2, preferFacingPads: true });
criticalPair(pin("U12", "2"), pin("U3", "1"), { maxDistance: 6, weight: 5, preferFacingPads: true });
criticalPair(pin("U12", "1"), pin("U3", "4"), { maxDistance: 5, weight: 5, preferFacingPads: true });
criticalPair(pin("Q4", "3"), pin("U3", "2"), { maxDistance: 5.5, weight: 5, preferFacingPads: true });

criticalPair(pin("U5", "18"), pin("CN2", "1"), { maxDistance: 110, weight: 2, crossingPenalty: 1 });
criticalPair(pin("U5", "19"), pin("CN2", "2"), { maxDistance: 110, weight: 2, crossingPenalty: 1 });
criticalPair(pin("U5", "20"), pin("CN2", "3"), { maxDistance: 110, weight: 2, crossingPenalty: 1 });
criticalPair(pin("U5", "21"), pin("CN2", "4"), { maxDistance: 110, weight: 2, crossingPenalty: 1 });
criticalPair(pin("U5", "22"), pin("CN2", "5"), { maxDistance: 110, weight: 2, crossingPenalty: 1 });
criticalPair(pin("U5", "23"), pin("CN2", "7"), { maxDistance: 110, weight: 2, crossingPenalty: 1 });
criticalPair(pin("U5", "10"), pin("U6", "2"), { maxDistance: 105, weight: 2 });
criticalPair(pin("U5", "11"), pin("U6", "3"), { maxDistance: 105, weight: 2 });
criticalPair(pin("U11", "2"), pin("R20", "2"), { maxDistance: 5, weight: 5, preferFacingPads: true });
criticalPair(pin("R20", "1"), pin("C9", "2"), { maxDistance: 5, weight: 5, preferFacingPads: true });
criticalPair(pin("U15", "2"), pin("C9", "2"), { maxDistance: 5, weight: 4, preferFacingPads: true });
criticalPair(pin("CN1", "2"), pin("R13", "1"), { maxDistance: 6, weight: 4, preferFacingPads: true });

// ---------------------------------------------------------------------------
// Capacitor clusters
// ---------------------------------------------------------------------------

capCluster(["C13", "C19"], {
    powerNet: "VIN_3V3",
    returnNet: "GND",
    target: pin("U13", "3"),
    axis: "x",
    maxRows: 2,
    gap: 0.6,
    priority: "critical",
});
capCluster(["C14", "C15"], {
    powerNet: "+3.3VP",
    returnNet: "GND",
    target: pin("U13", "4"),
    axis: "x",
    maxRows: 2,
    gap: 0.6,
    priority: "critical",
});
capCluster(["C4", "C5"], {
    powerNet: "+3.3V",
    returnNet: "GND",
    target: pin("U5", "2"),
    axis: "y",
    maxRows: 2,
    gap: 0.55,
    priority: "critical",
});

solver({
    grid: 0.8,
    fallbackGrid: 1.6,
    ignoredSignals: ["GND", "PGND"],
    localImproveIterations: 42,
    localImproveMinDelta: 0.04,
    hierarchicalBlocks: true,
});
