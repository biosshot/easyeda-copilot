board.polygon([
  { x: -20.0, y: -6.0 },
  { x: -10.5, y: -6.0 },
  { x: -10.5, y: -22.0 },
  { x: 32.0, y: -22.0 },
  { x: 32.0, y: 22.0 },
  { x: -10.5, y: 22.0 },
  { x: -10.5, y: 6.0 },
  { x: -20.0, y: 6.0 }
], {
  layers: ["top", "bottom"],
  defaultLayer: "top",
  clearance: 0.15,
  edge: 0.15
});

solver({ grid: 0.25, ignoredSignals: ["GND"], compactness: "high" });
silkscreen.designators({ enabled: false });

solderJumper("SJ_BOOT", {
  nets: ["QSPI_SS", "GND"],
  usage: "configuration",
  layer: "top",
  block: "jumpers"
});

primitive.thermalPad("U1_THERMAL", {
  at: pin("U1", "57"),
  power: { dissipation: 4.0, maxTemperatureRise: 30 },
  limits: { maxSize: { width: 10.0, height: 10.0 } }
});

constraintRegion("usb_tongue", {
  allow: { blocks: ["usb_contacts"] },
  layers: ["top", "bottom"],
  shape: region.rect({ anchor: anchor("board.left"), width: 9.7, height: 12.0 })
});

constraintRegion("body_only", {
  allow: {
    blocks: [
      "mcu_core", "usb_data", "flash", "clock", "boot",
      "buttons", "led", "vreg", "bulk_in", "bulk_out",
      "decoup_3v3_a", "decoup_3v3_b", "decoup_1v1",
      "jumpers", "usb_contacts"
    ]
  },
  layers: ["top", "bottom"],
  shape: region.rect({ anchor: anchor("board.right"), width: 42.5, height: 44.0 })
});

block("usb_contacts", ["X1"], "connector", {
  placement: "main",
  anchor: anchor("board.left"),
  allowDisconnected: true
});
block("mcu_core", ["U1"], "mcu", {
  placement: "main",
  anchor: anchor("board.center")
});
block("usb_data", ["R3", "R4"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "47"),
  allowDisconnected: true
});
block("flash", ["U3", "C5", "R1"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "52")
});
block("clock", ["U4", "R5", "C2", "C3"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "20")
});
block("boot", ["SW2"], "connector", {
  placement: "main",
  anchor: pin("U1", "56")
});
block("buttons", ["SW1"], "connector", {
  placement: "main",
  anchor: anchor("board.right")
});
block("led", ["LED1", "R6"], "mcu", {
  placement: "main",
  anchor: pin("U1", "30")
});
block("vreg", ["U2"], "power", {
  placement: "main",
  anchor: anchor("board.bottom")
});
block("bulk_in", ["C1"], "power", {
  placement: "satellite",
  attachTo: "vreg",
  anchor: pin("U2", "3")
});
block("bulk_out", ["C4", "C10"], "power", {
  placement: "satellite",
  attachTo: "vreg",
  anchor: pin("U2", "2")
});
block("decoup_3v3_a", ["C9", "C11", "C12"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "10")
});
block("decoup_3v3_b", ["C13", "C14", "C15", "C16"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "42")
});
block("decoup_1v1", ["C6", "C7", "C8"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "23")
});

component("X1").block("usb_contacts").role("connector").top()
  .fixed({ x: -15.2, y: 0.0, rotate: 180, layer: "top", boardOverflow: { left: 0.4 } })
  .faceTo("board.left");

component("U1").block("mcu_core").role("main_ic").top();
["R3", "R4"].forEach(d => component(d).block("usb_data").role("passive").top());
component("U3").block("flash").role("main_ic").top();
component("R1").block("flash").role("passive").top();
component("C5").block("flash").role("decoupling_cap").top();
component("U4").block("clock").role("crystal").top();
["R5", "C2", "C3"].forEach(d => component(d).block("clock").role("passive").top());
component("SW2").block("boot").role("connector").top()
  .edgePlace("bottom", { inset: 0.3, align: "end", face: "outward", layer: "top" });
component("SW1").block("buttons").role("connector").top()
  .edgePlace("top", { inset: 0.3, align: "end", face: "outward", layer: "top" });
component("LED1").block("led").role("indicator").top()
  .edgePlace("right", { inset: 0.4, y: -2.0, face: "any", layer: "top" });
component("R6").block("led").role("passive").top();

component("U2").block("vreg").role("main_ic").top();
component("C1").block("bulk_in").role("decoupling_cap").top();
["C4", "C10"].forEach(d => component(d).block("bulk_out").role("decoupling_cap").top());
["C9", "C11", "C12"].forEach(d => component(d).block("decoup_3v3_a").role("decoupling_cap").top());
["C13", "C14", "C15", "C16"].forEach(d => component(d).block("decoup_3v3_b").role("decoupling_cap").top());
["C6", "C7", "C8"].forEach(d => component(d).block("decoup_1v1").role("decoupling_cap").top());

criticalPair(pin("X1", "2"), pin("R3", "2"), { maxDistance: 6.5, hard: false, weight: 10, preferFacingPads: true });
criticalPair(pin("X1", "3"), pin("R4", "2"), { maxDistance: 6.5, hard: false, weight: 10, preferFacingPads: true });
criticalPair(pin("R3", "1"), pin("U1", "47"), { maxDistance: 7.0, hard: false, weight: 10, preferFacingPads: true });
criticalPair(pin("R4", "1"), pin("U1", "46"), { maxDistance: 7.0, hard: false, weight: 10, preferFacingPads: true });

coreIsland("qspi", ["U1", "U3"], {
  pairs: [
    [pin("U3", "6"), pin("U1", "52")],
    [pin("U3", "1"), pin("U1", "56")]
  ],
  maxDistance: 7.0,
  hard: false,
  weight: 10,
  preferFacingPads: true
});
criticalPair(pin("U4", "3"), pin("U1", "20"), { maxDistance: 5.0, hard: false, weight: 10, preferFacingPads: true });
criticalPair(pin("R5", "2"), pin("U1", "21"), { maxDistance: 5.0, hard: false, weight: 9, preferFacingPads: true });
criticalPair(pin("U4", "1"), pin("R5", "1"), { maxDistance: 3.5, hard: false, weight: 8, preferFacingPads: true });

criticalPair(pin("U2", "3"), pin("C1", "2"), { maxDistance: 4.0, hard: false, weight: 8, preferFacingPads: true });
criticalPair(pin("U2", "2"), pin("C4", "2"), { maxDistance: 4.0, hard: false, weight: 8, preferFacingPads: true });
criticalPair(pin("U2", "2"), pin("C10", "2"), { maxDistance: 5.0, hard: false, weight: 7, preferFacingPads: true });

capCluster(["C9", "C11", "C12"], {
  powerNet: "3V3",
  returnNet: "GND",
  target: pin("U1", "10"),
  maxRows: 1,
  maxPerRow: 3,
  gap: 0.25,
  priority: "critical"
});
capCluster(["C13", "C14", "C15", "C16"], {
  powerNet: "3V3",
  returnNet: "GND",
  target: pin("U1", "42"),
  maxRows: 2,
  maxPerRow: 2,
  gap: 0.25,
  rowGap: 0.5,
  topology: "center_power_bus",
  priority: "critical"
});
capCluster(["C6", "C7", "C8"], {
  powerNet: "1V1",
  returnNet: "GND",
  target: pin("U1", "23"),
  maxRows: 1,
  maxPerRow: 3,
  gap: 0.25,
  priority: "critical"
});
capCluster(["C4", "C10"], {
  powerNet: "3V3",
  returnNet: "GND",
  target: pin("U2", "2"),
  maxRows: 1,
  maxPerRow: 2,
  gap: 0.3,
  priority: "high"
});

bypass(["C5"], pin("U3", "8"), "high", { gap: 0.25 });
bypass(["C1"], pin("U2", "3"), "high", { gap: 0.25 });
bypass(["C2"], pin("U1", "20"), "high", { gap: 0.25 });
bypass(["C3"], pin("U1", "21"), "high", { gap: 0.25 });

veryNear(pin("SW1", "2"), pin("U1", "28"), "high");
veryNear(pin("SW2", "2"), pin("R1", "1"), "high");
veryNear(pin("R1", "2"), pin("U1", "56"), "high");
veryNear(pin("LED1", "2"), pin("U1", "30"), "normal");
veryNear(pin("LED1", "3"), pin("U1", "29"), "normal");
veryNear(pin("LED1", "1"), pin("R6", "1"), "high");
veryNear(pin("R6", "2"), pin("U1", "31"), "high");

near(comp("X1"), anchor("board.left"), "critical");
near(comp("U1"), anchor("board.center"), "critical");
near(comp("U3"), comp("U1"), "critical");
near(comp("U4"), comp("U1"), "critical");
near(comp("U2"), anchor("board.bottom"), "high");
near(comp("LED1"), anchor("board.right"), "normal");
veryNear(pin("SJ_BOOT", "1"), pin("U1", "56"), "high");

blockClearance("usb_contacts", "mcu_core", 1.0, "high");
blockClearance("vreg", "clock", 0.8, "high");
blockClearance("buttons", "clock", 0.8, "normal");
