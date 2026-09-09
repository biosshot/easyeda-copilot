// ICM-20948 + RP2350A IMU dev board layout intent.
// Board: 30 mm x 50 mm. USB-C on the top edge, 15-pin GPIO header on the
// right edge, SWD/power headers near the bottom edge. Routing remains global;
// placement is driven by compact local islands around the RP2350A and IMU.

board.roundedRect(35, 50, {
    radius: 1.2,
    segments: 8,
    layers: ["top", "bottom"],
    defaultLayer: "top",
    clearance: 0.127,
    edge: 0.3
});
silkscreen.designators({ height: 0.8, rotations: [0, 90], margin: 0.18 });

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

block("usb_port", ["USB1"], "connector", {
    placement: "main",
    anchor: anchor("board.top"),
    maxBboxWidth: 14,
    maxBboxHeight: 8,
});
block("usb_cc", ["R2", "R3"], "connector", {
    placement: "satellite",
    attachTo: "usb_port",
    anchor: pin("USB1", "A5"),
    sidePreference: "bottom",
    maxBboxWidth: 5,
    maxBboxHeight: 4,
    maxAnchorGap: 4,
    hardAnchor: true,
    placementClearance: 0.35,
});
block("usb_series", ["R4", "R5"], "mcu", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U1", "52"),
    sidePreference: "top",
    maxBboxWidth: 5,
    maxBboxHeight: 4,
    maxAnchorGap: 5.2,
    hardAnchor: true,
    placementClearance: 0.35,
});

block("ldo_3v3", ["U5", "C20", "C21", "C22"], "power", {
    placement: "main",
    anchor: anchor("board.top_left"),
    anchorOffset: { x: 6.5, y: 7.0 },
    maxBboxWidth: 11,
    maxBboxHeight: 13,
    placementClearance: 0.45,
});
block("ldo_1v8", ["U6", "C23"], "power", {
    placement: "main",
    anchor: anchor("board.left"),
    anchorOffset: { x: 6.0, y: -3.0 },
    maxBboxWidth: 10,
    maxBboxHeight: 8,
    placementClearance: 0.45,
});

block("mcu_core", ["U1"], "mcu", {
    placement: "main",
    anchor: anchor("board.center"),
    anchorOffset: { x: 0.5, y: -3.0 },
    familyMaxWidth: 24,
    familyMaxHeight: 34,
});
block("rp2350_vreg", ["L1", "R1", "C11", "C12", "C13"], "power", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U1", "48"),
    sidePreference: "right",
    maxBboxWidth: 9,
    maxBboxHeight: 8,
    maxAnchorGap: 5,
    hardAnchor: true,
    placementClearance: 0.35,
});
block("mcu_decoup_3v3_left", ["C1", "C3", "C4"], "mcu", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U1", "1"),
    sidePreference: "left",
    maxBboxWidth: 6,
    maxBboxHeight: 7,
    maxAnchorGap: 5.5,
    placementClearance: 0.35,
});
block("mcu_decoup_3v3_right", ["C5", "C6", "C9"], "mcu", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U1", "45"),
    sidePreference: "right",
    maxBboxWidth: 6,
    maxBboxHeight: 7,
    maxAnchorGap: 5.5,
    placementClearance: 0.35,
});
block("mcu_decoup_1v1", ["C2", "C7", "C10"], "mcu", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U1", "6"),
    sidePreference: "top",
    maxBboxWidth: 6,
    maxBboxHeight: 7,
    maxAnchorGap: 5.5,
    placementClearance: 0.35,
});
block("adc_filter", ["C8"], "analog", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U1", "44"),
    sidePreference: "right",
    maxBboxWidth: 4,
    maxBboxHeight: 3,
    maxAnchorGap: 4.5,
    placementClearance: 0.35,
});

block("flash", ["U2", "C14"], "mcu", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U1", "58"),
    sidePreference: "bottom",
    maxBboxWidth: 7,
    maxBboxHeight: 10,
    maxAnchorGap: 5.5,
    hardAnchor: true,
    placementClearance: 0.35,
});
block("crystal", ["U3", "C15", "C16", "R12"], "mcu", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U1", "21"),
    sidePreference: "top",
    maxBboxWidth: 8,
    maxBboxHeight: 6,
    maxAnchorGap: 4.8,
    hardAnchor: true,
    placementClearance: 0.35,
});
block("boot", ["SW1", "R11"], "generic", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U1", "60"),
    anchorOffset: { x: -3.5, y: 8.0 },
    sidePreference: "bottom",
    maxBboxWidth: 8,
    maxBboxHeight: 6,
    maxAnchorGap: 8,
    placementClearance: 0.45,
});

block("imu_level_shift", ["U7", "U8"], "sensor", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U1", "14"),
    anchorOffset: { x: -4.0, y: 7.0 },
    sidePreference: "bottom",
    maxBboxWidth: 7,
    maxBboxHeight: 7,
    maxAnchorGap: 9,
    hardAnchor: true,
    placementClearance: 0.35,
});
block("imu_core", ["U4", "C17", "C18", "C19"], "sensor", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U1", "14"),
    anchorOffset: { x: -7.0, y: 11.0 },
    sidePreference: "bottom",
    maxBboxWidth: 8,
    maxBboxHeight: 8,
    maxAnchorGap: 15,
    placementClearance: 0.35,
});

block("led_power", ["LED1", "LED2", "LED3", "R6", "R7", "R8"], "generic", {
    placement: "main",
    anchor: anchor("board.bottom_right"),
    maxBboxWidth: 8,
    maxBboxHeight: 9,
    placementClearance: 0.35,
});
block("led_gpio", ["LED4", "LED5", "R9", "R10"], "generic", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U1", "2"),
    anchorOffset: { x: 5.5, y: 10.0 },
    sidePreference: "bottom",
    maxBboxWidth: 7,
    maxBboxHeight: 7,
    maxAnchorGap: 10,
    placementClearance: 0.35,
});

block("header_swd", ["U9"], "connector", {
    placement: "main",
    anchor: anchor("board.bottom_left"),
    maxBboxWidth: 9,
    maxBboxHeight: 4,
});
block("header_power", ["U10"], "connector", {
    placement: "main",
    anchor: anchor("board.bottom"),
    maxBboxWidth: 9,
    maxBboxHeight: 6,
});
block("header_gpio", ["CN1"], "connector", {
    placement: "main",
    anchor: anchor("board.right"),
    maxBboxWidth: 4,
    maxBboxHeight: 40,
});

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

module("top_usb", ["usb_port", "usb_cc"], {
    anchor: anchor("board.top"),
    maxWidth: 16,
    maxHeight: 12,
    lockInternalAfterPlace: true,
});

module("rp2350", [
    "mcu_core",
    "usb_series",
    "rp2350_vreg",
    "mcu_decoup_3v3_left",
    "mcu_decoup_3v3_right",
    "mcu_decoup_1v1",
    "adc_filter",
    "flash",
    "crystal",
    "boot",
    "imu_level_shift",
    "imu_core",
    "led_gpio",
], {
    anchor: anchor("board.center"),
    maxWidth: 26,
    maxHeight: 40,
    lockInternalAfterPlace: true,
});
module("bottom_io", ["header_swd", "header_power", "led_power"], {
    anchor: anchor("board.bottom"),
    maxWidth: 28,
    maxHeight: 13,
    lockInternalAfterPlace: true,
});
module("right_gpio", ["header_gpio"], {
    anchor: anchor("board.right"),
    maxWidth: 4,
    maxHeight: 42,
    lockInternalAfterPlace: true,
});

// ---------------------------------------------------------------------------
// Component options
// ---------------------------------------------------------------------------

component("USB1").block("usb_port").role("connector").top()
    .edgeMount("top", { overhang: 0.8, face: "outward", x: 0, layer: "top" })
    ;
component("CN1").block("header_gpio").role("connector").top()
    .fixed({ anchor: anchor("board.right"), offset: { x: -2.8, y: 0 }, rotate: 270, layer: "top" });
component("U9").block("header_swd").role("connector").top()
    .fixed({ anchor: anchor("board.bottom_left"), offset: { x: 6.1, y: -3.4 }, rotate: 0, layer: "top" });
component("U10").block("header_power").role("connector").top()
    .fixed({ anchor: anchor("board.bottom"), offset: { x: 3.4, y: -4.3 }, rotate: 0, layer: "top" });

component("U1").block("mcu_core").role("main_ic").top()
    ;
component("L1").block("rp2350_vreg").role("passive").top()
    ;
component("U2").block("flash").role("main_ic").top();
component("U3").block("crystal").role("crystal").top();
component("U4").block("imu_core").role("main_ic").top()
    ;
component("U5").block("ldo_3v3").role("main_ic").top();
component("U6").block("ldo_1v8").role("main_ic").top();
component("U7").block("imu_level_shift").role("main_ic").top();
component("U8").block("imu_level_shift").role("main_ic").top();
component("SW1").block("boot").role("passive").top();

for (const d of ["R2", "R3"]) component(d).block("usb_cc").role("passive").top();
for (const d of ["R4", "R5"]) component(d).block("usb_series").role("passive").top();
for (const d of ["R1"]) component(d).block("rp2350_vreg").role("passive").top();
for (const d of ["R6", "R7", "R8"]) component(d).block("led_power").role("passive").top();
for (const d of ["R9", "R10"]) component(d).block("led_gpio").role("passive").top();
component("R11").block("boot").role("passive").top();
component("R12").block("crystal").role("passive").top();

for (const d of ["C20", "C21", "C22"]) component(d).block("ldo_3v3").role("decoupling_cap").top();
component("C23").block("ldo_1v8").role("decoupling_cap").top();
for (const d of ["C11", "C12", "C13"]) component(d).block("rp2350_vreg").role("decoupling_cap").top();
for (const d of ["C1", "C3", "C4"]) component(d).block("mcu_decoup_3v3_left").role("decoupling_cap").top();
for (const d of ["C5", "C6", "C9"]) component(d).block("mcu_decoup_3v3_right").role("decoupling_cap").top();
for (const d of ["C2", "C7", "C10"]) component(d).block("mcu_decoup_1v1").role("decoupling_cap").top();
component("C8").block("adc_filter").role("decoupling_cap").top();
component("C14").block("flash").role("decoupling_cap").top();
for (const d of ["C15", "C16"]) component(d).block("crystal").role("decoupling_cap").top();
for (const d of ["C17", "C18", "C19"]) component(d).block("imu_core").role("decoupling_cap").top();

for (const d of ["LED1", "LED2", "LED3"]) component(d).block("led_power").role("indicator").top();
for (const d of ["LED4", "LED5"]) component(d).block("led_gpio").role("indicator").top();

// ---------------------------------------------------------------------------
// Mechanical and visual arrays
// ---------------------------------------------------------------------------

line(["R2", "R3"], "y", { gap: 0.55, priority: "high" });
line(["R4", "R5"], "y", { gap: 0.55, priority: "critical" });
line(["U7", "U8"], "y", { gap: 0.65, priority: "high" });
line(["LED1", "LED2", "LED3"], "y", { gap: 0.6, priority: "normal" });
line(["R6", "R7", "R8"], "y", { gap: 0.6, priority: "normal" });
line(["LED4", "LED5"], "y", { gap: 0.6, priority: "normal" });
line(["R9", "R10"], "y", { gap: 0.6, priority: "normal" });

near(block("usb_port"), anchor("board.top"), "critical");
near(block("usb_series"), block("usb_port"), "high");
near(block("ldo_3v3"), block("usb_port"), "high");
near(block("ldo_1v8"), block("ldo_3v3"), "high");
near(block("header_gpio"), block("mcu_core"), "normal");
near(block("imu_level_shift"), block("imu_core"), "critical");
near(block("led_gpio"), block("mcu_core"), "normal");
away(block("rp2350_vreg"), block("crystal"), "normal");

blockClearance("usb_port", "mcu_core", 2.2, "high");
blockClearance("ldo_3v3", "mcu_core", 1.2, "critical");
blockClearance("ldo_3v3", "imu_core", 1.2, "critical");
blockClearance("ldo_3v3", "imu_level_shift", 1.2, "critical");
blockClearance("ldo_1v8", "mcu_core", 1.2, "critical");
blockClearance("ldo_1v8", "mcu_decoup_1v1", 1.2, "critical");
blockClearance("ldo_1v8", "boot", 1.2, "critical");
blockClearance("ldo_1v8", "imu_level_shift", 1.2, "critical");
blockClearance("ldo_1v8", "led_gpio", 1.2, "critical");
blockClearance("header_swd", "header_power", 1.2, "critical");
blockClearance("rp2350_vreg", "crystal", 1.4, "normal");
blockClearance("flash", "crystal", 1.2, "normal");
blockClearance("header_gpio", "all", 0.8, "normal");

// ---------------------------------------------------------------------------
// Critical local electrical geometry
// ---------------------------------------------------------------------------

criticalPair(pin("USB1", "A5"), pin("R2", "1"), { maxDistance: 4, hard: true, weight: 4, preferFacingPads: true });
criticalPair(pin("USB1", "B5"), pin("R3", "1"), { maxDistance: 4, hard: true, weight: 4, preferFacingPads: true });
criticalPair(pin("USB1", "A6"), pin("R4", "2"), { maxDistance: 5.5, weight: 5, preferFacingPads: true });
criticalPair(pin("R4", "1"), pin("U1", "52"), { maxDistance: 5.5, hard: true, weight: 8, crossingPenalty: 2, preferFacingPads: true });
criticalPair(pin("USB1", "A7"), pin("R5", "2"), { maxDistance: 5.5, weight: 5, preferFacingPads: true });
criticalPair(pin("R5", "1"), pin("U1", "51"), { maxDistance: 5.5, hard: true, weight: 8, crossingPenalty: 2, preferFacingPads: true });

coreIsland("rp2350_switcher", ["U1", "L1"], {
    pairs: [
        [pin("U1", "48"), pin("L1", "1")],
        [pin("L1", "2"), pin("U1", "50")],
    ],
    maxDistance: 4.2,
    hard: true,
    weight: 10,
    crossingPenalty: 3,
    preferFacingPads: true,
});
criticalPair(pin("U1", "46"), pin("C11", "2"), { maxDistance: 4.5, hard: true, weight: 6, preferFacingPads: true });
criticalPair(pin("U1", "50"), pin("C12", "2"), { maxDistance: 4.5, hard: true, weight: 6, preferFacingPads: true });
criticalPair(pin("R1", "1"), pin("C11", "2"), { maxDistance: 3.5, weight: 4, preferFacingPads: true });
criticalPair(pin("R1", "2"), pin("C13", "2"), { maxDistance: 3.5, weight: 4, preferFacingPads: true });

corePairs("qspi_flash_bus", [
    [pin("U1", "60"), pin("U2", "1")],
    [pin("U1", "59"), pin("U2", "2")],
    [pin("U1", "58"), pin("U2", "3")],
    [pin("U1", "57"), pin("U2", "5")],
    [pin("U1", "56"), pin("U2", "6")],
    [pin("U1", "55"), pin("U2", "7")],
], { maxDistance: 7.0, hard: true, weight: 7, crossingPenalty: 2, preferFacingPads: true });
criticalPair(pin("U2", "8"), pin("C14", "2"), { maxDistance: 3.5, hard: true, weight: 5, preferFacingPads: true });

corePairs("crystal_loop", [
    [pin("U1", "21"), pin("U3", "1")],
    [pin("U1", "22"), pin("R12", "1")],
    [pin("R12", "2"), pin("U3", "3")],
], { maxDistance: 4.8, hard: true, weight: 8, crossingPenalty: 2, preferFacingPads: true });
criticalPair(pin("C15", "2"), pin("U3", "1"), { maxDistance: 3.5, weight: 5, preferFacingPads: true });
criticalPair(pin("C16", "1"), pin("U3", "3"), { maxDistance: 3.5, weight: 5, preferFacingPads: true });

corePairs("imu_mcu_level_bus", [
    [pin("U1", "15"), pin("U7", "1")],
    [pin("U1", "14"), pin("U7", "8")],
    [pin("U1", "16"), pin("U8", "8")],
    [pin("U1", "13"), pin("U8", "1")],
], { maxDistance: 7.0, hard: true, weight: 6, crossingPenalty: 2, preferFacingPads: true });
corePairs("imu_local_bus", [
    [pin("U7", "4"), pin("U4", "24")],
    [pin("U7", "5"), pin("U4", "23")],
    [pin("U8", "4"), pin("U4", "22")],
    [pin("U8", "5"), pin("U4", "9")],
], { maxDistance: 6.0, hard: true, weight: 7, crossingPenalty: 2, preferFacingPads: true });
criticalPair(pin("U4", "8"), pin("C17", "2"), { maxDistance: 3.2, hard: true, weight: 5, preferFacingPads: true });
criticalPair(pin("U4", "13"), pin("C18", "1"), { maxDistance: 3.2, hard: true, weight: 5, preferFacingPads: true });
criticalPair(pin("U4", "10"), pin("C19", "1"), { maxDistance: 3.2, hard: true, weight: 5, preferFacingPads: true });

criticalPair(pin("LED1", "1"), pin("R6", "1"), { maxDistance: 3.0, weight: 4, preferFacingPads: true });
criticalPair(pin("LED2", "1"), pin("R7", "1"), { maxDistance: 3.0, weight: 4, preferFacingPads: true });
criticalPair(pin("LED3", "1"), pin("R8", "1"), { maxDistance: 3.0, weight: 4, preferFacingPads: true });
criticalPair(pin("LED4", "1"), pin("R9", "2"), { maxDistance: 3.0, weight: 4, preferFacingPads: true });
criticalPair(pin("LED5", "1"), pin("R10", "2"), { maxDistance: 3.0, weight: 4, preferFacingPads: true });
criticalPair(pin("LED4", "2"), pin("U1", "2"), { maxDistance: 9.0, weight: 2, preferFacingPads: true });
criticalPair(pin("LED5", "2"), pin("U1", "3"), { maxDistance: 9.0, weight: 2, preferFacingPads: true });

criticalPair(pin("U9", "1"), pin("U1", "25"), { maxDistance: 14, weight: 2 });
criticalPair(pin("U9", "3"), pin("U1", "24"), { maxDistance: 14, weight: 2 });

// ---------------------------------------------------------------------------
// Capacitor clusters
// ---------------------------------------------------------------------------

capCluster(["C20", "C22"], {
    powerNet: "VBUS",
    returnNet: "GND",
    target: pin("USB1", "A4B9"),
    axis: "x",
    maxRows: 1,
    maxPerRow: 2,
    gap: 0.55,
    priority: "critical",
});
capCluster(["C21"], {
    powerNet: "+3V3",
    returnNet: "GND",
    target: pin("U5", "2"),
    axis: "x",
    maxRows: 1,
    gap: 0.55,
    priority: "critical",
});
capCluster(["C23"], {
    powerNet: "+1V8",
    returnNet: "GND",
    target: pin("U6", "4"),
    axis: "x",
    maxRows: 1,
    gap: 0.55,
    priority: "critical",
});
capCluster(["C1", "C3", "C4"], {
    powerNet: "+3V3",
    returnNet: "GND",
    target: pin("U1", "1"),
    axis: "y",
    maxRows: 1,
    maxPerRow: 3,
    gap: 0.55,
    priority: "critical",
});
capCluster(["C5", "C6", "C9"], {
    powerNet: "+3V3",
    returnNet: "GND",
    target: pin("U1", "45"),
    axis: "y",
    maxRows: 1,
    maxPerRow: 3,
    gap: 0.55,
    priority: "critical",
});
capCluster(["C2", "C7", "C10"], {
    powerNet: "+1V1",
    returnNet: "GND",
    target: pin("U1", "6"),
    axis: "y",
    maxRows: 1,
    maxPerRow: 3,
    gap: 0.55,
    priority: "critical",
});
capCluster(["C11"], {
    powerNet: "VREG_AVDD",
    returnNet: "GND",
    target: pin("U1", "46"),
    axis: "x",
    maxRows: 1,
    maxPerRow: 1,
    gap: 0.55,
    priority: "critical",
});
capCluster(["C12"], {
    powerNet: "+1V1",
    returnNet: "GND",
    target: pin("U1", "50"),
    axis: "x",
    maxRows: 1,
    maxPerRow: 1,
    gap: 0.55,
    priority: "critical",
});
capCluster(["C13"], {
    powerNet: "+3V3",
    returnNet: "GND",
    target: pin("R1", "2"),
    axis: "x",
    maxRows: 1,
    maxPerRow: 1,
    gap: 0.55,
    priority: "critical",
});
capCluster(["C17", "C18"], {
    powerNet: "+1V8",
    returnNet: "GND",
    target: pin("U4", "8"),
    axis: "x",
    maxRows: 1,
    maxPerRow: 2,
    gap: 0.55,
    priority: "critical",
});

// ---------------------------------------------------------------------------
// Solver / router
// ---------------------------------------------------------------------------

solver({
    grid: 0.5,
    fallbackGrid: 1,
    ignoredSignals: ["GND"],
    localImproveIterations: 44,
    localImproveMinDelta: 0.05,
    hierarchicalBlocks: true,
});
