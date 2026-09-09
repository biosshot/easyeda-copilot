board.polygon([
  { x: -20, y: -6 },
  { x: -10.5, y: -6 },
  { x: -10.5, y: -9 },
  { x: 20, y: -9 },
  { x: 20, y: 9 },
  { x: -10.5, y: 9 },
  { x: -10.5, y: 6 },
  { x: -20, y: 6 }
], { layers: ["top", "bottom"], defaultLayer: "top", clearance: 0.1, edge: 0.1 });

solver({ grid: 0.5, ignoredSignals: ["GND"] });
silkscreen.designators({ enabled: false });

constraintRegion("usb_tongue", {
  allow: { blocks: ["usb_contacts"] },
  shape: region.rect({ anchor: anchor("board.left"), width: 9.5, height: 12 })
});

block("usb_contacts", ["X1"], "connector");
block("usb_series", ["R3", "R4"], "mcu", {
  allowDisconnected: true
});
block("power_3v3", ["U2", "C1", "C4", "C10"], "power", {
  placement: "main",
  anchor: pin("X1", "4")
});
block("mcu_core", ["U1"], "mcu");
block("mcu_decoup_3v3_a", ["C9", "C11"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "1")
});
block("mcu_decoup_3v3_b", ["C12", "C13"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "22")
});
block("mcu_decoup_3v3_c", ["C14", "C15", "C16"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "49")
});
block("mcu_decoup_1v1", ["C6", "C7", "C8"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "45")
});
block("flash", ["U3", "C5"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "52")
});
block("flash_pullup", ["R1"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "56")
});
block("clock", ["U4", "R5", "C2", "C3"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "20")
});
block("run_button", ["SW1"], "mcu");
block("boot_button", ["SW2"], "mcu");
block("status_led", ["LED1", "R6"], "mcu");

component("X1")
  .block("usb_contacts")
  .role("connector")
  .top()
  .fixed({ x: -15, y: 0, layer: "top" })
  .faceTo("board.left");

component("U1").block("mcu_core").role("main_ic").top();
component("U2").block("power_3v3").role("main_ic").top();
component("U3").block("flash").role("main_ic").top();
component("U4").block("clock").role("crystal").top();

component("R1").block("flash_pullup").role("passive").top();
component("R3").block("usb_series").role("passive").top();
component("R4").block("usb_series").role("passive").top();
component("R5").block("clock").role("passive").top();
component("R6").block("status_led").role("passive").top();

component("C1").block("power_3v3").role("decoupling_cap").top();
component("C2").block("clock").role("decoupling_cap").top();
component("C3").block("clock").role("decoupling_cap").top();
component("C4").block("power_3v3").role("decoupling_cap").top();
component("C5").block("flash").role("decoupling_cap").top();
component("C6").block("mcu_decoup_1v1").role("decoupling_cap").top();
component("C7").block("mcu_decoup_1v1").role("decoupling_cap").top();
component("C8").block("mcu_decoup_1v1").role("decoupling_cap").top();
component("C9").block("mcu_decoup_3v3_a").role("decoupling_cap").top();
component("C10").block("power_3v3").role("decoupling_cap").top();
component("C11").block("mcu_decoup_3v3_a").role("decoupling_cap").top();
component("C12").block("mcu_decoup_3v3_b").role("decoupling_cap").top();
component("C13").block("mcu_decoup_3v3_b").role("decoupling_cap").top();
component("C14").block("mcu_decoup_3v3_c").role("decoupling_cap").top();
component("C15").block("mcu_decoup_3v3_c").role("decoupling_cap").top();
component("C16").block("mcu_decoup_3v3_c").role("decoupling_cap").top();

component("LED1").block("status_led").role("indicator").top();
component("SW1").block("run_button").role("passive").top();
component("SW2").block("boot_button").role("passive").top();

near(block("usb_contacts"), anchor("board.left"), "critical");
near(block("mcu_core"), anchor("board.center"), "critical");
near(block("power_3v3"), block("usb_contacts"), "high");
near(block("power_3v3"), anchor("board.center"), "high");
near(block("usb_series"), block("usb_contacts"), "critical");
near(block("usb_series"), anchor("board.center"), "critical");
near(block("status_led"), anchor("board.top"), "high");
near(block("run_button"), anchor("board.top"), "normal");
near(block("boot_button"), anchor("board.top"), "normal");
near(block("boot_button"), block("flash_pullup"), "normal");

blockClearance("usb_contacts", "all", 0.2, "critical");
blockClearance("mcu_core", "all", 0.2, "high");
blockClearance("power_3v3", "clock", 0.8, "critical");
blockClearance("power_3v3", "mcu_core", 0.4, "high");
blockClearance("power_3v3", "mcu_decoup_1v1", 0.5, "critical");

criticalPair(pin("X1", "2"), pin("R3", "2"), { maxDistance: 18, priority: "critical", preferFacingPads: true });
criticalPair(pin("R3", "1"), pin("U1", "47"), { maxDistance: 8, priority: "critical", preferFacingPads: true });
criticalPair(pin("X1", "3"), pin("R4", "2"), { maxDistance: 18, priority: "critical", preferFacingPads: true });
criticalPair(pin("R4", "1"), pin("U1", "46"), { maxDistance: 8, priority: "critical", preferFacingPads: true });

criticalPair(pin("U3", "1"), pin("U1", "56"), { maxDistance: 10, priority: "critical", preferFacingPads: true });
criticalPair(pin("U3", "6"), pin("U1", "52"), { maxDistance: 10, priority: "critical", preferFacingPads: true });
criticalPair(pin("U3", "5"), pin("U1", "53"), { maxDistance: 10, priority: "high", preferFacingPads: true });
criticalPair(pin("U3", "2"), pin("U1", "55"), { maxDistance: 10, priority: "high", preferFacingPads: true });

criticalPair(pin("U4", "3"), pin("U1", "20"), { maxDistance: 7, priority: "critical", preferFacingPads: true });
criticalPair(pin("R5", "2"), pin("U1", "21"), { maxDistance: 7, priority: "critical", preferFacingPads: true });
criticalPair(pin("R1", "2"), pin("U1", "56"), { maxDistance: 9, priority: "high", preferFacingPads: true });
criticalPair(pin("SW2", "2"), pin("R1", "1"), { maxDistance: 8, priority: "normal", preferFacingPads: true });
criticalPair(pin("SW1", "2"), pin("U1", "28"), { maxDistance: 12, priority: "high", preferFacingPads: true });
criticalPair(pin("R6", "2"), pin("U1", "31"), { maxDistance: 13, priority: "normal", preferFacingPads: true });

capCluster(["C9", "C11"], {
  powerNet: "3V3",
  returnNet: "GND",
  target: pin("U1", "1"),
  maxRows: 2,
  gap: 0.25,
  priority: "critical"
});
capCluster(["C12", "C13"], {
  powerNet: "3V3",
  returnNet: "GND",
  target: pin("U1", "22"),
  maxRows: 1,
  gap: 0.25,
  priority: "critical"
});
capCluster(["C14", "C15", "C16"], {
  powerNet: "3V3",
  returnNet: "GND",
  target: pin("U1", "49"),
  maxRows: 2,
  maxPerRow: 2,
  gap: 0.25,
  rowGap: 0.45,
  topology: "center_power_bus",
  priority: "critical"
});
capCluster(["C6", "C7", "C8"], {
  powerNet: "1V1",
  returnNet: "GND",
  target: pin("U1", "45"),
  maxRows: 2,
  maxPerRow: 2,
  gap: 0.25,
  rowGap: 0.45,
  topology: "center_power_bus",
  priority: "critical"
});

bypass(["C5"], pin("U3", "8"), "high", { gap: 0.25 });
bypass(["C1", "C4", "C10"], pin("U2", "2"), "high", { gap: 0.25 });
veryNear(pin("C2", "2"), pin("U4", "3"), "critical");
veryNear(pin("C3", "2"), pin("U4", "1"), "critical");
