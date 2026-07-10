// RP2040 reference layout for the graph-driven v2 placer.
// Keep this file declarative: modules describe large regions, blocks describe ownership,
// and islands/critical pairs describe the few places where pad geometry matters.

board.roundedRect(42, 42, {
    radius: 2.5,
    segments: 8,
    layers: ["top", "bottom"],
    defaultLayer: "top",
    clearance: 0.127,
    edge: 2.2,
});
boardHole.corners({ inset: 4, drill: 3.2, diameter: 3.2, keepout: 4, prefix: "MH" });
silkscreen.designators({ height: 1.0, rotations: [0, 90], margin: 0.25 });

block("usb_connector", ["J2", "R1", "R6"], "connector", {
    placement: "main",
    anchor: anchor("board.bottom"),
});
block("battery_connector", ["J1"], "connector", {
    placement: "main",
    anchor: anchor("board.left"),
});
block("charger", ["U2", "R7", "C10", "C9"], "power", {
    placement: "main",
    anchor: anchor("board.left"),
});

block("buck_core", ["U1", "L1"], "power", {
    placement: "main",
    anchor: anchor("board.top_left"),
});
block("buck_input", ["C3", "C2", "R2"], "power", {
    placement: "satellite",
    attachTo: "buck_core",
    anchor: pin("U1", "2"),
});
block("buck_output", ["C5", "C6", "C7"], "power", {
    placement: "satellite",
    attachTo: "buck_core",
    anchor: pin("U1", "9"),
});
block("buck_feedback", ["R3", "R5", "C8", "C1"], "analog", {
    placement: "satellite",
    attachTo: "buck_core",
    anchor: pin("U1", "8"),
});
block("buck_aux", ["C4", "R4"], "analog", {
    placement: "satellite",
    attachTo: "buck_core",
    anchor: pin("U1", "5"),
    allowDisconnected: true,
});

block("mcu_core", ["U4"], "mcu", {
    placement: "main",
    anchor: anchor("board.center"),
});
block("mcu_clock", ["X1", "C12", "C13", "R11"], "mcu", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U4", "20"),
});
block("mcu_flash", ["U3", "R12"], "mcu", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U4", "52"),
});
block("mcu_usb_series", ["R8", "R9"], "mcu", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U4", "47"),
    allowDisconnected: true,
});
block("mcu_decoup_left", ["C11", "C15", "C16"], "mcu", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U4", "1"),
});
block("mcu_decoup_right", ["C17", "C18", "C19", "C20"], "mcu", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U4", "49"),
});
block("mcu_vreg", ["C14"], "mcu", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U4", "45"),
});
block("buttons", ["R10", "SW1", "SW2"], "generic", {
    placement: "satellite",
    attachTo: "mcu_core",
    anchor: pin("U4", "26"),
    allowDisconnected: true,
});

module("input_power", ["usb_connector", "battery_connector", "charger"], {
    anchor: anchor("board.bottom_left"),
});
module("buck", ["buck_core", "buck_input", "buck_output", "buck_feedback", "buck_aux"], {
    anchor: anchor("board.top_left"),
});
module("rp2040", ["mcu_core", "mcu_clock", "mcu_flash", "mcu_usb_series", "mcu_decoup_left", "mcu_decoup_right", "mcu_vreg", "buttons"], {
    anchor: anchor("board.center"),
});

component("J2").block("usb_connector").role("connector").top()
    .edgeMount("bottom", { overhang: 1.2, layer: "top", face: "outward" })
    ;
component("J1").block("battery_connector").role("connector").top()
    .edgeMount("left", { overhang: 1.0, layer: "top", face: "outward", slide: true });

component("U2").block("charger").role("main_ic").top();
component("U1").block("buck_core").role("main_ic").top();
component("L1").block("buck_core").role("passive").top();
component("U4").block("mcu_core").role("main_ic").top();
component("U3").block("mcu_flash").role("main_ic").top();
component("X1").block("mcu_clock").role("crystal").top();
component("SW1").block("buttons").role("passive").top();
component("SW2").block("buttons").role("passive").top();

[
    "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10",
    "C11", "C12", "C13", "C14", "C15", "C16", "C17", "C18", "C19", "C20",
].forEach((designator) => component(designator).role("decoupling_cap").top());
[
    "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10", "R11", "R12",
].forEach((designator) => component(designator).role("passive").top());

near(block("usb_connector"), anchor("board.bottom"), "critical");
near(block("battery_connector"), block("charger"), "high");
near(block("charger"), block("buck_core"), "high");
near(block("mcu_core"), anchor("board.center"), "critical");
near(block("mcu_usb_series"), block("usb_connector"), "high");
near(block("mcu_core"), block("usb_connector"), "critical");
away(block("mcu_core"), block("buck_core"), "normal");

blockClearance("usb_connector", "mcu_core", 3.0, "high");
blockClearance("charger", "mcu_core", 2.5, "normal");
blockClearance("buck_core", "mcu_core", 3.0, "high");
blockClearance("buck_output", "mcu_core", 2.5, "high");
blockClearance("mcu_clock", "mcu_flash", 1.4, "normal");

bypass(["C9"], pin("U2", "4"), "critical", { gap: 0.6 });
bypass(["C10"], pin("U2", "5"), "critical", { gap: 0.6 });
veryNear(pin("R7", "1"), pin("U2", "2"), "critical");
criticalPair(pin("R1", "1"), pin("J2", "A5"), { maxDistance: 4.5, weight: 1.6, preferFacingPads: true });
criticalPair(pin("R6", "1"), pin("J2", "B5"), { maxDistance: 7.0, weight: 1.6, preferFacingPads: true });

coreIsland("buck_switch_loop", ["U1", "L1"], {
    pairs: [
        [pin("U1", "1"), pin("L1", "1")],
        [pin("U1", "10"), pin("L1", "2")],
    ],
    maxDistance: 5.6,
    hard: true,
    weight: 10,
    preferFacingPads: true,
});
criticalPair(pin("U1", "2"), pin("C3", "2"), { maxDistance: 4.8, hard: true, weight: 8, preferFacingPads: true });
criticalPair(pin("U1", "3"), pin("R2", "1"), { maxDistance: 5.2, weight: 5, preferFacingPads: true });
criticalPair(pin("U1", "9"), pin("C5", "2"), { maxDistance: 4.8, hard: true, weight: 8, preferFacingPads: true });
criticalPair(pin("U1", "8"), pin("R3", "2"), { maxDistance: 4.8, hard: true, weight: 8, preferFacingPads: true });
criticalPair(pin("U1", "8"), pin("R5", "1"), { maxDistance: 5.4, weight: 4, preferFacingPads: true });
criticalPair(pin("U1", "8"), pin("C8", "2"), { maxDistance: 5.4, weight: 4, preferFacingPads: true });
criticalPair(pin("U1", "5"), pin("R4", "2"), { maxDistance: 5.2, weight: 4, preferFacingPads: true });
criticalPair(pin("U1", "6"), pin("C4", "2"), { maxDistance: 5.2, weight: 4, preferFacingPads: true });

criticalPair(pin("X1", "1"), pin("U4", "20"), { maxDistance: 5.2, hard: true, weight: 7, preferFacingPads: true });
criticalPair(pin("X1", "3"), pin("U4", "21"), { maxDistance: 5.2, hard: true, weight: 7, preferFacingPads: true });
veryNear(pin("C13", "1"), pin("U4", "20"), "critical");
veryNear(pin("C12", "1"), pin("U4", "21"), "critical");
near(pin("R11", "1"), pin("U4", "20"), "high");
near(pin("R11", "2"), pin("U4", "21"), "high");

corePairs("mcu_flash_bus", [
    [pin("U3", "6"), pin("U4", "52")],
    [pin("U3", "5"), pin("U4", "53")],
    [pin("U3", "2"), pin("U4", "55")],
    [pin("U3", "7"), pin("U4", "51")],
], { maxDistance: 7.0, hard: true, weight: 6, preferFacingPads: true });
near(pin("R12", "2"), pin("U4", "56"), "high");
near(pin("SW2", "1"), pin("U4", "56"), "normal");

criticalPair(pin("R8", "2"), pin("U4", "47"), { maxDistance: 5.5, hard: true, weight: 6, preferFacingPads: true });
criticalPair(pin("R9", "2"), pin("U4", "46"), { maxDistance: 5.5, hard: true, weight: 6, preferFacingPads: true });
criticalPair(pin("R8", "1"), pin("J2", "A6"), { maxDistance: 15, weight: 2, preferFacingPads: true });
criticalPair(pin("R9", "1"), pin("J2", "A7"), { maxDistance: 15, weight: 2, preferFacingPads: true });

capCluster(["C11", "C15", "C16"], { powerNet: "+3V3", returnNet: "GND", target: pin("U4", "1"), axis: "y", maxRows: 1, gap: 0.65, priority: "critical" });
capCluster(["C17", "C18", "C19", "C20"], { powerNet: "+3V3", returnNet: "GND", target: pin("U4", "49"), axis: "y", maxRows: 2, maxPerRow: 2, gap: 0.65, priority: "critical" });
veryNear(pin("C14", "1"), pin("U4", "45"), "critical");
criticalPair(pin("C11", "1"), pin("U4", "1"), { maxDistance: 5.2, weight: 4 });
criticalPair(pin("C16", "1"), pin("U4", "10"), { maxDistance: 5.2, weight: 4 });
criticalPair(pin("C14", "1"), pin("U4", "45"), { maxDistance: 5.2, hard: true, weight: 5 });
near(pin("R10", "2"), pin("U4", "26"), "high");
near(pin("SW1", "1"), pin("U4", "26"), "normal");

solver({
    grid: 0.5,
    ignoredSignals: ["GND"],
});
