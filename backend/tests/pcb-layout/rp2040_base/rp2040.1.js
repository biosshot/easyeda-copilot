board.roundedRect(50, 50, {
    layers: ["top", "bottom"],
    defaultLayer: "top",
    clearance: 0.8,
    edge: 3,
    radius: 5
});
boardHole.corners({ inset: 3.5, drill: 3.2, keepout: 4 });

block("usb_power", ["J2", "J1", "U2", "R1", "R6", "R7", "C9", "C10"], "power", "USB connector, battery/input connector, 5V path and input regulator support", {
    placement: "main",
    anchor: anchor("board.top"),
    maxBboxWidth: 30,
    maxBboxHeight: 23,
});
block("buck", ["U1"], "power", "3V3 buck controller anchor", {
    placement: "main",
    anchor: anchor("board.left"),
    maxBboxScale: 1.3,
    maxAnchorGap: 10,
    hardBbox: true,
    familyHard: true,
});
block("buck_switch", ["L1"], "power", "Buck switch inductor tight to U1 L1/L2 pins", {
    placement: "satellite",
    attachTo: "buck",
    maxBboxWidth: 3,
    maxBboxHeight: 3,
    hardBbox: true,
    hardAnchor: true,

    maxAnchorGap: 2,
});
block("buck_input", ["C3", "R2"], "power", "Buck VIN and EN input support", {
    placement: "satellite",
    attachTo: "buck",
    anchor: pin("U1", "2"),
    sidePreference: "top",
    maxBboxWidth: 6.5,
    maxBboxHeight: 5.5,
    hardBbox: true,
    maxAnchorGap: 4,
});
block("buck_output", ["C5", "C6", "C7", "C20"], "power", "Buck 3V3 output capacitors", {
    placement: "satellite",
    attachTo: "buck",
    anchor: pin("U1", "9"),
    sidePreference: "right",
    maxBboxWidth: 11.5,
    maxBboxHeight: 8,
    hardBbox: true,
    maxAnchorGap: 8,
});
block("buck_feedback", ["R3", "R5", "C8"], "power", "Buck feedback network close to FB", {
    placement: "satellite",
    attachTo: "buck",
    anchor: pin("U1", "8"),
    sidePreference: "bottom",
    maxBboxWidth: 7.5,
    maxBboxHeight: 5.8,
    hardBbox: true,
    maxAnchorGap: 5,
    hardAnchor: true,
});
block("buck_vaux", ["C4"], "power", "Buck VAUX decoupling", {
    placement: "satellite",
    attachTo: "buck",
    anchor: pin("U1", "6"),
    sidePreference: "bottom",
    maxBboxWidth: 3.4,
    maxBboxHeight: 2.6,
    hardBbox: true,
    maxAnchorGap: 4,
    hardAnchor: true,
});
block("buck_pg", ["R4"], "power", "Buck PG pullup close to U1 PG pin", {
    placement: "satellite",
    attachTo: "buck",
    anchor: pin("U1", "5"),
    sidePreference: "bottom",
    maxBboxWidth: 3.4,
    maxBboxHeight: 2.6,
    hardBbox: true,
    maxAnchorGap: 4,
    hardAnchor: true,
});
block("buck_output_small", ["C1", "C2"], "power", "Buck small output/ground support caps", {
    placement: "satellite",
    attachTo: "buck",
    anchor: pin("U1", "9"),
    sidePreference: "right",
    maxBboxWidth: 5.8,
    maxBboxHeight: 3.6,
    hardBbox: true,
    maxAnchorGap: 7,
});
block("mcu", ["U4"], "mcu", "RP2040 core placement anchor", {
    placement: "main",
    anchor: anchor("board.bottom"),
    maxBboxScale: 1.2,
    maxAnchorGap: 6,
    hardAnchor: true,
    familyMaxWidth: 28,
    familyMaxHeight: 28,
    familyHard: true,
});
block("clock", ["X1", "C12", "C13", "R11"], "mcu", "Crystal oscillator close to RP2040", {
    placement: "satellite",
    attachTo: "mcu",
    anchor: pin("U4", "20"),
    sidePreference: "left",
    maxBboxWidth: 11,
    maxBboxHeight: 7.5,
    hardBbox: true,
    maxAnchorGap: 4.5,
    hardAnchor: true,
});
block("flash", ["U3", "R12"], "mcu", "QSPI flash close to RP2040", {
    placement: "satellite",
    attachTo: "mcu",
    anchor: pin("U4", "52"),
    sidePreference: "top",
    maxBboxWidth: 8.5,
    maxBboxHeight: 5.5,
    hardBbox: true,
    maxAnchorGap: 6.5,
});
block("flash_boot", ["SW2"], "mcu", "QSPI boot select near RP2040", {
    placement: "satellite",
    attachTo: "mcu",
    anchor: pin("U4", "56"),
    sidePreference: "top",
    maxBboxScale: 1.2,
    maxAnchorGap: 6,
});
block("mcu_decoupling_io_a", ["C11", "C16"], "mcu", "RP2040 IOVDD decoupling near pins 1 and 10", {
    placement: "satellite",
    attachTo: "mcu",
    anchor: pin("U4", "1"),
    sidePreference: "left",
    maxBboxWidth: 6.5,
    maxBboxHeight: 6,
    hardBbox: true,
    maxAnchorGap: 6,
});
block("mcu_decoupling_core", ["C14", "C15"], "mcu", "RP2040 core regulator and nearby IOVDD decoupling", {
    placement: "satellite",
    attachTo: "mcu",
    anchor: pin("U4", "45"),
    sidePreference: "bottom",
    maxBboxWidth: 6.5,
    maxBboxHeight: 6,
    hardBbox: true,
    maxAnchorGap: 6,
});
block("mcu_decoupling_usb", ["C17", "C18", "C19"], "mcu", "RP2040 USB and right-side IOVDD decoupling", {
    placement: "satellite",
    attachTo: "mcu",
    anchor: pin("U4", "49"),
    sidePreference: "right",
    maxBboxWidth: 8.5,
    maxBboxHeight: 6.5,
    hardBbox: true,
    maxAnchorGap: 6.5,
});
block("mcu_boot_reset", ["SW1", "R10"], "mcu", "RP2040 boot/reset support", {
    placement: "satellite",
    attachTo: "mcu",
    anchor: pin("U4", "26"),
    sidePreference: "bottom",
    maxBboxWidth: 6.5,
    maxBboxHeight: 6.5,
    hardBbox: true,
    maxAnchorGap: 6.5,
});

block("usb_res", ["R9", "R8"], "mcu", "RP2040 usb_res", {
    placement: "satellite",
    attachTo: "mcu",
    anchor: pin("U4", "47"),
    maxBboxWidth: 4.8,
    maxBboxHeight: 3.6,
    hardBbox: true,
    maxAnchorGap: 5,
    hardAnchor: true,
});

component("J2")
    .block("usb_power")
    .role("connector")
    .top()
    .faceTo("board.top")
    .fixed({ anchor: anchor("board.top"), offset: { x: 0, y: 3.5 }, rotate: 0, layer: "top", boardOverflow: { top: 10 } })

component("J1").block("usb_power").role("connector").top().rotations(0, 180).faceAt0("right").faceTo("board.right");
component("U2").block("usb_power").role("main_ic").top();
component("R1").block("usb_power").role("passive").top();
component("R6").block("usb_power").role("passive").top();
component("R7").block("usb_power").role("passive").top();
component("C9").block("usb_power").role("decoupling_cap").top();
component("C10").block("usb_power").role("decoupling_cap").top();

component("U1").block("buck").role("main_ic").top();
component("L1").block("buck_switch").role("passive").top();
component("C3").block("buck_input").role("decoupling_cap").top();
component("R2").block("buck_input").role("passive").top();
component("C5").block("buck_output").role("decoupling_cap").top();
component("C6").block("buck_output").role("decoupling_cap").top();
component("C7").block("buck_output").role("decoupling_cap").top();
component("C20").block("buck_output").role("decoupling_cap").top();
component("R3").block("buck_feedback").role("passive").top();
component("R5").block("buck_feedback").role("passive").top();
component("C8").block("buck_feedback").role("decoupling_cap").top();
component("C1").block("buck_output_small").role("decoupling_cap").top();
component("C2").block("buck_output_small").role("decoupling_cap").top();
component("C4").block("buck_vaux").role("decoupling_cap").top();
component("R4").block("buck_pg").role("passive").top();

component("U4").block("mcu").role("main_ic").top().rotations(180);
component("C11").block("mcu_decoupling_io_a").role("decoupling_cap").top();
component("C16").block("mcu_decoupling_io_a").role("decoupling_cap").top();
component("C14").block("mcu_decoupling_core").role("decoupling_cap").top();
component("C15").block("mcu_decoupling_core").role("decoupling_cap").top();
component("C17").block("mcu_decoupling_usb").role("decoupling_cap").top();
component("C18").block("mcu_decoupling_usb").role("decoupling_cap").top();
component("C19").block("mcu_decoupling_usb").role("decoupling_cap").top();
component("R8").block("usb_res").role("passive").top();
component("R9").block("usb_res").role("passive").top();
component("R10").block("mcu_boot_reset").role("passive").top();
component("SW1").block("mcu_boot_reset").role("passive").top();

component("X1").block("clock").role("crystal").top();
component("C12").block("clock").role("decoupling_cap").top();
component("C13").block("clock").role("decoupling_cap").top();
component("R11").block("clock").role("passive").top();

component("U3").block("flash").role("main_ic").top();
component("R12").block("flash").role("passive").top();
component("SW2").block("flash_boot").role("passive").top();

// Mechanical placement.
edge("J2", "top", "critical", "outward");
near(block("usb_power"), anchor("board.top"), "high");
near(block("buck"), anchor("board.left"), "high");
near(block("buck_switch"), comp("U1"), "critical");
near(block("buck_input"), comp("U1"), "critical");
near(block("buck_output"), comp("U1"), "critical");
near(block("buck_feedback"), comp("U1"), "critical");
near(block("buck_vaux"), comp("U1"), "critical");
near(block("buck_pg"), comp("U1"), "critical");
near(block("buck_output_small"), comp("U1"), "normal");
near(block("mcu"), anchor("board.center"), "high");
near(block("clock"), comp("U4"), "critical");
near(block("flash"), comp("U4"), "critical");
near(block("flash_boot"), comp("U4"), "high");
near(block("mcu_decoupling_io_a"), comp("U4"), "critical");
near(block("mcu_decoupling_core"), comp("U4"), "critical");
near(block("mcu_decoupling_usb"), comp("U4"), "critical");
near(block("mcu_boot_reset"), comp("U4"), "high");
near(block("usb_res"), comp("U4"), "high");

blockClearance("usb_power", "buck", 2.2, "high");
blockClearance("buck", "mcu", 2.4, "high");
blockClearance("clock", "buck", 3.0, "high");
blockClearance("flash", "buck", 2.4, "normal");
blockClearance("usb_power", "buck_input", 1.4, "normal");
blockClearance("buck_switch", "buck", 1.1, "critical");
blockClearance("buck_switch", "mcu", 2.2, "high");
blockClearance("buck_output", "mcu", 2.0, "normal");
blockClearance("buck_feedback", "clock", 2.2, "high");
blockClearance("buck_output", "buck", 1.1, "critical");
blockClearance("buck_vaux", "buck", 1.0, "critical");
blockClearance("buck_pg", "buck", 1.0, "critical");
blockClearance("buck_pg", "buck_output", 1.0, "normal");
blockClearance("buck_output_small", "buck", 1.0, "normal");
blockClearance("clock", "flash", 1.4, "normal");
blockClearance("flash", "mcu", 1.1, "critical");
blockClearance("mcu_decoupling_io_a", "flash", 1.2, "normal");
blockClearance("mcu_decoupling_usb", "usb_res", 1.2, "normal");
blockClearance("mcu_decoupling_io_a", "mcu", 1.1, "critical");
blockClearance("mcu_decoupling_core", "mcu", 1.1, "critical");
blockClearance("mcu_decoupling_usb", "mcu", 1.1, "critical");

// USB/input power path.
veryNear(pin("R1", "1"), pin("J2", "A5"), "critical");
veryNear(pin("R6", "1"), pin("J2", "B5"), "critical");
veryNear(pin("C9", "1"), pin("U2", "4"), "critical");
veryNear(pin("C10", "1"), pin("U2", "5"), "critical");
veryNear(pin("R7", "1"), pin("U2", "2"), "critical");
near(pin("J2", "A4B9"), pin("U2", "4"), "critical");
near(pin("J2", "B4A9"), pin("U2", "4"), "critical");
near(pin("J1", "1"), pin("U2", "5"), "high");
near(pin("J1", "1"), pin("U1", "2"), "high");
bypass(["C9", "C10"], pin("U2", "5"), "critical", { gap: 0.55 });

// Buck converter: keep the switching loop and support networks as separate compact islands.
coreIsland("buck_switch_core", ["U1", "L1"], {
    pairs: [
        [pin("L1", "1"), pin("U1", "1")],
        [pin("L1", "2"), pin("U1", "10")],
    ],
    maxDistance: 1,
    crossingPenalty: 30,
    weight: 30.2,
});
criticalPair(pin("C3", "2"), pin("U1", "2"), { maxDistance: 3, hard: true, weight: 2.2, crossingPenalty: 1.5, preferFacingPads: true });
criticalPair(pin("C5", "2"), pin("U1", "9"), { maxDistance: 3, hard: true, weight: 2.4, crossingPenalty: 1.5, preferFacingPads: true });
criticalPair(pin("C8", "2"), pin("U1", "8"), { maxDistance: 4, weight: 1.8, crossingPenalty: 1.2, preferFacingPads: true });
criticalPair(pin("R2", "1"), pin("U1", "3"), { maxDistance: 3.2, hard: true, weight: 1.8, crossingPenalty: 1, preferFacingPads: true });
criticalPair(pin("R3", "2"), pin("U1", "8"), { maxDistance: 4, weight: 1.8, crossingPenalty: 1, preferFacingPads: true });
criticalPair(pin("R5", "1"), pin("U1", "8"), { maxDistance: 4, weight: 1.8, crossingPenalty: 1, preferFacingPads: true });
criticalPair(pin("C4", "2"), pin("U1", "6"), { maxDistance: 4, hard: true, weight: 1.4, crossingPenalty: 1, preferFacingPads: true });
veryNear(pin("C3", "2"), pin("U1", "2"), "critical");
veryNear(pin("C4", "2"), pin("U1", "6"), "critical");
veryNear(pin("C5", "2"), pin("U1", "9"), "critical");
capCluster(["C5", "C6", "C7", "C20"], {
    powerNet: "+3V3",
    returnNet: "GND",
    target: pin("U1", "9"),
    axis: "x",
    maxRows: 2,
    maxPerRow: 3,
    gap: 1.1,
    rowGap: 1.2,
    topology: "center_power_bus",
    priority: "critical",
});
veryNear(pin("C8", "2"), pin("U1", "8"), "critical");
veryNear(pin("R3", "2"), pin("U1", "8"), "critical");
veryNear(pin("R5", "1"), pin("U1", "8"), "critical");
line(["R3", "C8", "R5"], "x", { gap: 1.1, priority: "critical" });
veryNear(pin("R2", "1"), pin("U1", "3"), "high");
near(pin("C6", "2"), pin("U1", "9"), "high");
near(pin("C7", "2"), pin("U1", "9"), "high");
near(pin("C20", "1"), pin("U1", "9"), "high");
near(comp("R3"), comp("R5"), "critical");
near(comp("C6"), comp("C7"), "high");
near(comp("C1"), comp("C2"), "normal");
criticalPair(pin("R4", "2"), pin("U1", "5"), { maxDistance: 3.2, hard: true, weight: 2.2, crossingPenalty: 1.5, preferFacingPads: true });
veryNear(pin("R4", "2"), pin("U1", "5"), "critical");
near(pin("R4", "1"), pin("U1", "9"), "normal");
near(pin("C1", "2"), pin("U1", "9"), "normal");
clearance(block("buck"), block("clock"), 3.0, "high");

// RP2040 local decoupling.
capCluster(["C11", "C16"], {
    powerNet: "+3V3",
    returnNet: "GND",
    target: pin("U4", "1"),
    maxRows: 1,
    gap: 0.55,
    priority: "critical",
});
bypass(["C14", "C15"], pin("U4", "45"), "critical", { gap: 0.55 });
capCluster(["C17", "C18", "C19"], {
    powerNet: "+3V3",
    returnNet: "GND",
    target: pin("U4", "49"),
    maxRows: 1,
    gap: 0.55,
    priority: "critical",
});
criticalPair(pin("C11", "1"), pin("U4", "1"), { maxDistance: 4.5, weight: 1.8, crossingPenalty: 1 });
criticalPair(pin("C16", "1"), pin("U4", "10"), { maxDistance: 4.5, weight: 1.8, crossingPenalty: 1 });
criticalPair(pin("C15", "1"), pin("U4", "22"), { maxDistance: 4.8, weight: 1.5, crossingPenalty: 1 });
criticalPair(pin("C14", "1"), pin("U4", "45"), { maxDistance: 4.8, weight: 1.8, crossingPenalty: 1 });
criticalPair(pin("C17", "1"), pin("U4", "33"), { maxDistance: 4.8, weight: 1.5, crossingPenalty: 1 });
criticalPair(pin("C18", "1"), pin("U4", "42"), { maxDistance: 4.8, weight: 1.5, crossingPenalty: 1 });
criticalPair(pin("C19", "1"), pin("U4", "49"), { maxDistance: 4.8, weight: 1.8, crossingPenalty: 1 });
veryNear(pin("C11", "1"), pin("U4", "1"), "critical");
veryNear(pin("C16", "1"), pin("U4", "10"), "critical");
veryNear(pin("C15", "1"), pin("U4", "22"), "critical");
veryNear(pin("C14", "1"), pin("U4", "45"), "critical");
veryNear(pin("C17", "1"), pin("U4", "33"), "critical");
veryNear(pin("C18", "1"), pin("U4", "42"), "critical");
veryNear(pin("C19", "1"), pin("U4", "49"), "critical");
near(pin("R10", "2"), pin("U4", "26"), "high");
near(pin("SW1", "1"), pin("U4", "26"), "high");

// USB data/CC near MCU but still routed from top connector area.
criticalPair(pin("R8", "2"), pin("U4", "47"), { maxDistance: 3.2, hard: true, weight: 2.2, crossingPenalty: 1.5, preferFacingPads: true });
criticalPair(pin("R9", "2"), pin("U4", "46"), { maxDistance: 3.2, hard: true, weight: 2.2, crossingPenalty: 1.5, preferFacingPads: true });
veryNear(pin("R8", "2"), pin("U4", "47"), "critical");
veryNear(pin("R9", "2"), pin("U4", "46"), "critical");
near(pin("R8", "1"), pin("J2", "A6"), "high");
near(pin("R9", "1"), pin("J2", "A7"), "high");
line(["R8", "R9"], "x", { gap: 1.1, priority: "high", rotate: 270 });

// Crystal island.
veryNear(pin("X1", "1"), pin("U4", "20"), "critical");
veryNear(pin("X1", "3"), pin("U4", "21"), "critical");
veryNear(pin("C13", "1"), pin("U4", "20"), "critical");
veryNear(pin("C12", "1"), pin("U4", "21"), "critical");
near(pin("R11", "1"), pin("U4", "20"), "high");
near(pin("R11", "2"), pin("U4", "21"), "high");
line(["C12", "X1", "C13"], "x", { gap: 0.55, priority: "high" });

// Flash/QSPI island.
veryNear(pin("U3", "6"), pin("U4", "52"), "critical");
veryNear(pin("U3", "5"), pin("U4", "53"), "critical");
veryNear(pin("U3", "3"), pin("U4", "54"), "critical");
veryNear(pin("U3", "2"), pin("U4", "55"), "critical");
veryNear(pin("U3", "7"), pin("U4", "51"), "critical");
near(pin("R12", "2"), pin("U4", "56"), "high");
near(pin("SW2", "1"), pin("U4", "56"), "high");

solver({
    grid: 1,
    fallbackGrid: 2,
    ignoredSignals: ["GND"],
    localImproveIterations: 40,
    localImproveMinDelta: 0.02,
    hierarchicalBlocks: true,
});
