board.rect(45, 45, { layers: ["top", "bottom"], defaultLayer: "top", clearance: 0.5, edge: 1.0 });

block("usb_conn", ["J2", "R1", "R6"], "connector");
block("charger", ["U2", "R7", "C9", "C10"], "power");
block("battery_conn", ["J1"], "connector");
block("power_core", ["U1", "L1"], "power");
block("power_in", ["C3", "R2"], "power", { placement: "satellite", attachTo: "power_core", anchor: pin("U1", "2"), sidePreference: "left", maxAnchorGap: 14 });
block("power_out", ["C5", "C6", "C7", "C20", "C1", "C2"], "power", { placement: "satellite", attachTo: "power_core", anchor: pin("U1", "9"), sidePreference: "right", maxAnchorGap: 14 });
block("power_fb", ["R3", "R4", "C8"], "power", { placement: "satellite", attachTo: "power_core", anchor: pin("U1", "8"), sidePreference: "top", maxAnchorGap: 10 });
block("power_aux", ["C4", "R5"], "power", { placement: "satellite", attachTo: "power_core", anchor: pin("U1", "6"), sidePreference: "bottom", maxAnchorGap: 10 });
block("mcu_core", ["U4"], "mcu");
block("mcu_3v3", ["C11", "C15", "C16", "C17", "C18", "C19"], "mcu", { placement: "satellite", attachTo: "mcu_core", anchor: pin("U4", "1"), sidePreference: "top", maxAnchorGap: 12 });
block("mcu_1v1", ["C14"], "mcu", { placement: "satellite", attachTo: "mcu_core", anchor: pin("U4", "45"), sidePreference: "bottom", maxAnchorGap: 8 });
block("clock", ["X1", "C12", "C13", "R11"], "mcu", { placement: "satellite", attachTo: "mcu_core", anchor: pin("U4", "20"), sidePreference: "left", maxAnchorGap: 10 });
block("flash", ["U3", "R12"], "mcu", { placement: "satellite", attachTo: "mcu_core", anchor: pin("U4", "56"), sidePreference: "right", maxAnchorGap: 10 });
block("usb_data", ["R8", "R9"], "mcu", { placement: "satellite", attachTo: "mcu_core", anchor: pin("U4", "46"), sidePreference: "bottom", maxAnchorGap: 16 });
block("buttons", ["SW1", "SW2", "R10"], "connector");

component("J2").block("usb_conn").role("connector").top().edgeMount("bottom", { overhang: 1 });
component("R1").block("usb_conn").role("passive").top();
component("R6").block("usb_conn").role("passive").top();

component("U2").block("charger").role("main_ic").top();
component("R7").block("charger").role("passive").top();
component("C9").block("charger").role("decoupling_cap").top();
component("C10").block("charger").role("decoupling_cap").top();

component("J1").block("battery_conn").role("connector").top().faceTo("board.top");

component("U1").block("power_core").role("main_ic").top();
component("L1").block("power_core").role("passive").top();
component("C3").block("power_in").role("decoupling_cap").top();
component("R2").block("power_in").role("passive").top();
component("C5").block("power_out").role("decoupling_cap").top();
component("C6").block("power_out").role("decoupling_cap").top();
component("C7").block("power_out").role("decoupling_cap").top();
component("C20").block("power_out").role("decoupling_cap").top();
component("C1").block("power_out").role("decoupling_cap").top();
component("C2").block("power_out").role("decoupling_cap").top();
component("R3").block("power_fb").role("passive").top();
component("R4").block("power_fb").role("passive").top();
component("C8").block("power_fb").role("decoupling_cap").top();
component("C4").block("power_aux").role("decoupling_cap").top();
component("R5").block("power_aux").role("passive").top();

component("U4").block("mcu_core").role("main_ic").top();
component("C11").block("mcu_3v3").role("decoupling_cap").top();
component("C15").block("mcu_3v3").role("decoupling_cap").top();
component("C16").block("mcu_3v3").role("decoupling_cap").top();
component("C17").block("mcu_3v3").role("decoupling_cap").top();
component("C18").block("mcu_3v3").role("decoupling_cap").top();
component("C19").block("mcu_3v3").role("decoupling_cap").top();
component("C14").block("mcu_1v1").role("decoupling_cap").top();
component("X1").block("clock").role("crystal").top();
component("C12").block("clock").role("decoupling_cap").top();
component("C13").block("clock").role("decoupling_cap").top();
component("R11").block("clock").role("passive").top();
component("U3").block("flash").role("main_ic").top();
component("R12").block("flash").role("passive").top();
component("R8").block("usb_data").role("passive").top();
component("R9").block("usb_data").role("passive").top();

component("SW1").block("buttons").role("passive").top();
component("SW2").block("buttons").role("passive").top();
component("R10").block("buttons").role("passive").top();

near(comp("J2"), anchor("board.bottom"), "critical");
near(comp("J1"), anchor("board.top_left"), "normal");
near(comp("SW1"), anchor("board.top_right"), "normal");
near(comp("SW2"), anchor("board.top"), "normal");
near(comp("U2"), comp("J2"), "high");
near(comp("J1"), comp("U2"), "high");
near(comp("U1"), comp("U2"), "normal");
near(comp("U4"), anchor("board.center"), "high");
near(comp("U3"), comp("U4"), "high");

blockClearance("charger", "mcu_core", 3, "high");
blockClearance("power_core", "mcu_core", 2.5, "high");

criticalPair(pin("U1", "1"), pin("L1", "1"), { maxDistance: 5, hard: true, preferFacingPads: true, weight: 1.5 });
criticalPair(pin("U1", "10"), pin("L1", "2"), { maxDistance: 5, preferFacingPads: true, weight: 1.2 });
veryNear(pin("C3", "2"), pin("U1", "2"), "critical");
veryNear(pin("C9", "1"), pin("U2", "4"), "critical");
veryNear(pin("C10", "1"), pin("U2", "5"), "critical");
veryNear(pin("R7", "1"), pin("U2", "2"), "high");
veryNear(pin("R2", "2"), pin("U1", "2"), "high");
veryNear(pin("C14", "1"), pin("U4", "45"), "critical");
veryNear(pin("X1", "1"), pin("U4", "20"), "critical");
veryNear(pin("X1", "3"), pin("U4", "21"), "critical");
veryNear(pin("C13", "1"), pin("U4", "20"), "high");
veryNear(pin("C12", "1"), pin("U4", "21"), "high");
veryNear(pin("R8", "1"), pin("J2", "A6"), "high");
veryNear(pin("R8", "2"), pin("U4", "47"), "high");
veryNear(pin("R9", "1"), pin("J2", "A7"), "high");
veryNear(pin("R9", "2"), pin("U4", "46"), "high");
sameSide(comp("R8"), comp("R9"), "high");
line(["R8", "R9"], "x", { gap: 0.8, priority: "high" });

capCluster(["C5", "C6", "C7", "C20"], { powerNet: "+3V3", returnNet: "GND", target: pin("U1", "9"), axis: "x", maxRows: 2, maxPerRow: 2, gap: 0.8, rowGap: 2.2, topology: "center_power_bus", priority: "high" });
capCluster(["C11", "C15", "C16", "C17", "C18", "C19"], { powerNet: "+3V3", returnNet: "GND", target: pin("U4", "1"), axis: "x", maxRows: 2, maxPerRow: 3, gap: 0.7, rowGap: 2.2, topology: "center_power_bus", priority: "high" });

solver({ grid: 1, fallbackGrid: 2, ignoredSignals: ["GND"], localImproveIterations: 36, localImproveMinDelta: 0.02, hierarchicalBlocks: true });
