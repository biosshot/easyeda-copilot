board.rect(35, 50, {
  layers: ["top", "bottom"],
  defaultLayer: "top",
  clearance: 0.75,
  edge: 1.2
});

boardHole("MH1", {
  at: anchor("board.top_left"),
  offset: { x: 3.5, y: 3.5 },
  drill: 3.2,
  diameter: 3.2,
  keepout: 4.0
});

silkscreen.designators({ height: 0.8, rotations: [0, 90], margin: 0.15 });

block("usb_connector", ["USB1", "R2", "R3"], "connector", {
  placement: "main",
  anchor: anchor("board.top"),
  familyMaxWidth: 20,
  familyMaxHeight: 17,
  placementClearance: 0.45
});
block("usb_series", ["R4", "R5"], "mcu", {
  placement: "satellite",
  attachTo: "usb_connector",
  anchor: pin("USB1", "A6"),
  maxAnchorGap: 7,
  maxBboxWidth: 8,
  maxBboxHeight: 5,
  placementClearance: 0.35,
  allowDisconnected: true
});

block("right_header", ["CN1"], "connector", {
  placement: "main",
  anchor: anchor("board.right"),
  familyMaxWidth: 42,
  familyMaxHeight: 42
});
block("bottom_debug", ["U9", "U10"], "connector", {
  placement: "main",
  anchor: anchor("board.bottom"),
  familyMaxWidth: 22,
  familyMaxHeight: 8,
  placementClearance: 0.55,
  allowDisconnected: true
});

block("mcu_core", ["U1"], "mcu", {
  placement: "main",
  anchor: anchor("board.center"),
  familyMaxWidth: 40,
  familyMaxHeight: 35,
  placementClearance: 0.65
});
block("mcu_decoup_3v3", ["C1", "C3", "C4", "C5", "C6", "C9", "C14"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "11"),
  maxAnchorGap: 8,
  maxBboxWidth: 10,
  maxBboxHeight: 10,
  placementClearance: 0.3
});
block("mcu_decoup_1v1", ["C2", "C7", "C10", "C12"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "23"),
  maxAnchorGap: 9,
  maxBboxWidth: 9,
  maxBboxHeight: 6,
  placementClearance: 0.3
});
block("mcu_vreg", ["L1"], "power", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "48"),
  maxAnchorGap: 8,
  maxBboxWidth: 5,
  maxBboxHeight: 5,
  placementClearance: 0.35
});
block("adc_filter", ["R1", "C8", "C11", "C13"], "analog", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "44"),
  maxAnchorGap: 11,
  maxBboxWidth: 9,
  maxBboxHeight: 7,
  placementClearance: 0.35,
  allowDisconnected: true
});
block("flash", ["U2"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "60"),
  maxBboxWidth: 11,
  maxBboxHeight: 10,
  placementClearance: 0.4
});
block("clock", ["U3", "C15", "C16", "R12"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "21"),
  maxAnchorGap: 5,
  hardAnchor: true,
  maxBboxWidth: 10,
  maxBboxHeight: 7,
  placementClearance: 0.3
});
block("boot", ["SW1", "R11"], "mcu", {
  placement: "main",
  anchor: anchor("board.bottom"),
  maxBboxWidth: 8,
  maxBboxHeight: 7,
  placementClearance: 0.4
});

block("sensor_core", ["U4"], "sensor", {
  placement: "main",
  anchor: anchor("board.left"),
  familyMaxWidth: 18,
  familyMaxHeight: 18,
  placementClearance: 0.55
});
block("sensor_decoup", ["C17", "C18", "C19", "C23"], "sensor", {
  placement: "satellite",
  attachTo: "sensor_core",
  anchor: pin("U4", "13"),
  maxAnchorGap: 4,
  maxBboxWidth: 9,
  maxBboxHeight: 6,
  placementClearance: 0.3,
  allowDisconnected: true
});
block("level_shift", ["U7", "U8"], "sensor", {
  placement: "satellite",
  attachTo: "sensor_core",
  anchor: pin("U4", "23"),
  maxAnchorGap: 6,
  hardAnchor: true,
  maxBboxWidth: 12,
  maxBboxHeight: 8,
  familyMaxWidth: 12,
  familyMaxHeight: 12,
  placementClearance: 0.35
});

block("power_3v3", ["U5", "C20", "C21"], "power", {
  placement: "main",
  anchor: anchor("board.top"),
  familyMaxWidth: 15,
  familyMaxHeight: 12,
  placementClearance: 0.45
});
block("power_1v8", ["U6", "C22"], "power", {
  placement: "main",
  anchor: anchor("board.center"),
  familyMaxWidth: 14,
  familyMaxHeight: 12,
  placementClearance: 0.45
});

block("status_leds", ["LED1", "LED2", "LED3", "LED4", "LED5", "R6", "R7", "R8", "R9", "R10"], "generic", {
  placement: "main",
  anchor: anchor("board.left"),
  familyMaxWidth: 20,
  familyMaxHeight: 18,
  placementClearance: 0.35,
  allowDisconnected: true
});

module("mcu", ["mcu_core", "mcu_decoup_3v3", "mcu_decoup_1v1", "mcu_vreg", "adc_filter", "flash", "clock", "boot"], {
  anchor: anchor("board.center"),
  placementPriority: "high"
});

module("sensor", ["sensor_core", "sensor_decoup", "level_shift"], {
  anchor: anchor("board.left"),
  placementPriority: "high",
  maxWidth: 22,
  maxHeight: 25
});

module("power", ["power_3v3", "power_1v8"], {
  anchor: anchor("board.top"),
  placementPriority: "high",
  maxWidth: 26,
  maxHeight: 26
});

component("USB1").block("usb_connector").role("connector").top().edgeMount("top", { overhang: 1.0, align: "center" });
component("CN1").block("right_header").role("connector").top().fixed({ anchor: anchor("board.right"), offset: { x: -1.25, y: 0 }, rotate: 90, layer: "top", boardOverflow: { right: 0.2 } });
component("U9").block("bottom_debug").role("connector").top().edgeMount("bottom", { overhang: 0.2, align: "start", offset: 5 });
component("U10").block("bottom_debug").role("connector").top().edgeMount("bottom", { overhang: 0.2, align: "center", offset: -2 });

component("U1").block("mcu_core").role("main_ic").top();
component("U2").block("flash").role("main_ic").top();
component("U3").block("clock").role("crystal").top();
component("U4").block("sensor_core").role("main_ic").top();
component("U5").block("power_3v3").role("main_ic").top();
component("U6").block("power_1v8").role("main_ic").top();
component("U7").block("level_shift").role("main_ic").top();
component("U8").block("level_shift").role("main_ic").top();
component("L1").block("mcu_vreg").role("passive").top();
component("SW1").block("boot").role("connector").top();

["C1", "C3", "C4", "C5", "C6", "C9", "C14"].forEach(d => component(d).block("mcu_decoup_3v3").role("decoupling_cap").top());
["C2", "C7", "C10", "C12"].forEach(d => component(d).block("mcu_decoup_1v1").role("decoupling_cap").top());
["R1", "C8", "C11", "C13"].forEach(d => component(d).block("adc_filter").role(d.startsWith("C") ? "decoupling_cap" : "passive").top());
["C15", "C16", "R12"].forEach(d => component(d).block("clock").role(d.startsWith("C") ? "decoupling_cap" : "passive").top());
["R2", "R3"].forEach(d => component(d).block("usb_connector").role("passive").top());
["R4", "R5"].forEach(d => component(d).block("usb_series").role("passive").top());
["R11"].forEach(d => component(d).block("boot").role("passive").top());
["C17", "C18", "C19", "C23"].forEach(d => component(d).block("sensor_decoup").role("decoupling_cap").top());
["C20", "C21"].forEach(d => component(d).block("power_3v3").role("decoupling_cap").top());
["C22"].forEach(d => component(d).block("power_1v8").role("decoupling_cap").top());
["LED1", "LED2", "LED3", "LED4", "LED5"].forEach(d => component(d).block("status_leds").role("indicator").top());
["R6", "R7", "R8", "R9", "R10"].forEach(d => component(d).block("status_leds").role("passive").top());

bypass(["C1", "C3", "C4", "C5", "C6", "C9", "C14"], pin("U1", "11"), "critical", { gap: 0.3 });
bypass(["C2", "C7", "C10", "C12"], pin("U1", "23"), "critical", { gap: 0.3 });
capCluster(["C17", "C18", "C23"], { powerNet: "+1V8", returnNet: "GND", target: pin("U4", "13"), maxRows: 1, gap: 0.35, priority: "critical" });
capCluster(["C20", "C22"], { powerNet: "VBUS", returnNet: "GND", target: pin("U5", "3"), maxRows: 1, gap: 0.45, priority: "high" });

criticalPair(pin("USB1", "A6"), pin("R4", "2"), { maxDistance: 7, hard: false, weight: 5, preferFacingPads: true });
criticalPair(pin("USB1", "A7"), pin("R5", "2"), { maxDistance: 7, hard: false, weight: 5, preferFacingPads: true });
criticalPair(pin("R4", "1"), pin("U1", "52"), { maxDistance: 7, hard: false, weight: 4, preferFacingPads: true });
criticalPair(pin("R5", "1"), pin("U1", "51"), { maxDistance: 7, hard: false, weight: 4, preferFacingPads: true });
criticalPair(pin("U1", "48"), pin("L1", "1"), { maxDistance: 3.5, hard: true, weight: 5, preferFacingPads: true });
criticalPair(pin("L1", "2"), pin("U1", "50"), { maxDistance: 4.5, hard: false, weight: 3, preferFacingPads: true });
criticalPair(pin("U3", "1"), pin("U1", "21"), { maxDistance: 4, hard: true, weight: 8, preferFacingPads: true });
criticalPair(pin("R12", "1"), pin("U1", "22"), { maxDistance: 6, hard: false, weight: 6, preferFacingPads: true });

corePairs("flash", [
  [pin("U1", "60"), pin("U2", "1")],
  [pin("U1", "56"), pin("U2", "6")],
  [pin("U1", "57"), pin("U2", "5")],
  [pin("U1", "59"), pin("U2", "2")]
], { maxDistance: 9, hard: false, weight: 6, preferFacingPads: true });

corePairs("level_shift", [
  [pin("U1", "14"), pin("U7", "8")],
  [pin("U1", "15"), pin("U7", "1")],
  [pin("U1", "16"), pin("U8", "8")],
  [pin("U1", "13"), pin("U8", "1")]
], { maxDistance: 18, hard: false, weight: 3, preferFacingPads: true });

corePairs("sensor_core", [
  [pin("U4", "23"), pin("U7", "5")],
  [pin("U4", "24"), pin("U7", "4")],
  [pin("U4", "9"), pin("U8", "5")],
  [pin("U4", "22"), pin("U8", "4")]
], { maxDistance: 7, hard: false, weight: 6, preferFacingPads: true });

near(comp("U1"), comp("CN1"), "high");
near(comp("SW1"), anchor("board.bottom"), "normal");

blockClearance("right_header", "mcu_core", 1.5, "high");
blockClearance("right_header", "adc_filter", 2.0, "high");
blockClearance("right_header", "clock", 2.0, "high");
blockClearance("usb_connector", "power_3v3", 1.0, "normal");
blockClearance("usb_connector", "usb_series", 0.5, "normal");
blockClearance("usb_connector", "flash", 1.2, "high");
blockClearance("clock", "mcu_core", 0.8, "high");
clearance(anchor("board.top_left"), comp("USB1"), 2, "high");

solver({
  grid: 0.5,
  fallbackGrid: 1,
  ignoredSignals: ["GND"],
  localImproveIterations: 40,
  hierarchicalBlocks: true
});
