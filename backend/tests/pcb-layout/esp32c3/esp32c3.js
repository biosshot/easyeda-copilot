board.roundedRect(38, 32, {
  radius: 1.5,
  layers: ["top", "bottom"],
  defaultLayer: "top",
  clearance: 0.25,
  edge: 0.4,
});

block("MCU", ["U2"], "mcu");
block("MCU_Decoupling", ["C4", "C5"], "mcu", null, {
  placement: "satellite",
  attachTo: "MCU",
  anchor: pin("U2", "1"),
});
block("Reset_Support", ["R6", "C6"], "mcu", null, {
  placement: "satellite",
  attachTo: "MCU",
  anchor: pin("U2", "2"),
});
block("Reset_Button", ["SW1"], "connector");
block("Boot_Support", ["R7"], "mcu", null, {
  placement: "satellite",
  attachTo: "MCU",
  anchor: pin("U2", "8"),
});
block("Boot_Button", ["SW2"], "connector");
block("USB_Port", ["USB1", "R2", "R3", "D1"], "connector");
block("USB_Termination", ["R4", "R5"], "generic", null, {
  placement: "satellite",
  attachTo: "MCU",
  anchor: pin("U2", "13"),
  allowDisconnected: true,
});
block("Power", ["U1", "C1", "C2", "C3"], "power");
block("Header_Left", ["H1"], "connector", null, { allowDisconnected: true });
block("Header_Right", ["H2"], "connector", null, { allowDisconnected: true });

component("H1").block("Header_Left").role("connector").top().fixed({
  x: -17.25,
  y: 0,
  rotate: 90,
  layer: "top",
});

component("H2").block("Header_Right").role("connector").top().fixed({
  x: 17.25,
  y: 0,
  rotate: 90,
  layer: "top",
});

refineGroup("headers", ["H1", "H2"], { swap: true, rotateBy: [180] });

component("USB1").block("USB_Port").role("connector").top().edgeMount("bottom", {
  overhang: 1.0,
  face: "outward",
  align: "center",
});

component("U2").block("MCU").role("main_ic").top().rotations(180).edgeMount("top", {
  overhang: 6.0,
  face: "any",
  align: "center",
});

component("C4").block("MCU_Decoupling").role("decoupling_cap").bottom();
component("C5").block("MCU_Decoupling").role("decoupling_cap").bottom();

component("SW1").block("Reset_Button").role("connector").top().edgePlace("bottom", {
  inset: 1.0,
  face: "any",
  x: -9.5,
});

component("SW2").block("Boot_Button").role("connector").top().edgePlace("bottom", {
  inset: 1.0,
  face: "any",
  x: 9.5,
});

capCluster(["C4", "C5"], {
  powerNet: "+3V3",
  returnNet: "GND",
  target: pin("U2", "1"),
  maxRows: 1,
  gap: 0.4,
  priority: "critical",
});

capCluster(["C2", "C3"], {
  powerNet: "+3V3",
  returnNet: "GND",
  target: pin("U1", "5"),
  maxRows: 1,
  gap: 0.4,
  priority: "high",
});

veryNear(pin("C1", "1"), pin("U1", "1"), "high");
veryNear(pin("R6", "2"), pin("U2", "2"), "high");
veryNear(pin("C6", "1"), pin("U2", "2"), "high");
veryNear(pin("R7", "2"), pin("U2", "8"), "high");

veryNear(pin("R2", "1"), pin("USB1", "A5"), "high");
veryNear(pin("R3", "1"), pin("USB1", "B5"), "high");
near(comp("U1"), comp("USB1"), "high");

signalPath("USB_DM_PATH", [
  [pin("USB1", "B7"), pin("D1", "1"), { maxDistance: 5.0, preferFacingPads: true }],
  [pin("D1", "6"), pin("R4", "1"), { maxDistance: 25.0 }],
  [pin("R4", "2"), pin("U2", "13"), { maxDistance: 5.0, preferFacingPads: true }],
], { priority: "critical", shape: "flexible" });

signalPath("USB_DP_PATH", [
  [pin("USB1", "A6"), pin("D1", "3"), { maxDistance: 5.0, preferFacingPads: true }],
  [pin("D1", "4"), pin("R5", "1"), { maxDistance: 25.0 }],
  [pin("R5", "2"), pin("U2", "14"), { maxDistance: 5.0, preferFacingPads: true }],
], { priority: "critical", shape: "flexible" });

silkscreen.designators({ enabled: true, height: 1.0, rotations: [0, 90], margin: 0.2 });
solver({
  grid: 0.25,
  ignoredSignals: ["GND"],
  compactness: "high",
});
