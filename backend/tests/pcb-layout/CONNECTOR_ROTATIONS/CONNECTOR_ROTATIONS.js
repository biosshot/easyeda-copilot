// Mechanical orientation regression: twenty different, real EasyEDA connector
// footprints on one deliberately long board. Directional connectors are placed
// on the top/bottom edge with an explicit faceAt0, so the mating opening or wire
// entry faces out of the board. Vertical/internal connectors stay in the middle.

board.rect(320, 80, {
  layers: ["top", "bottom"],
  defaultLayer: "top",
  clearance: 0.5,
  edge: 1.0,
});

silkscreen.designators({ height: 1.1, rotations: [0], margin: 0.4 });

const connectorIds = Array.from({ length: 20 }, (_, index) => `J${index + 1}`);

for (const designator of connectorIds) {
  block(`connector_${designator}`, [designator], "connector");
}

function external(designator, faceAt0, faceTo, x, y, rotate, overflow = 0) {
  component(designator)
    .block(`connector_${designator}`)
    .role("connector")
    .top()
    .faceAt0(faceAt0)
    .faceTo(faceTo)
    .fixed({ x, y, rotate, layer: "top", boardOverflow: overflow });
}

// Top edge (opening/wire-entry direction is the board top after rotation).
external("J1",  "top",    "top", -138, -36.80,   0, 1.0); // USB-C KH-TYPE-C-16P
external("J3",  "bottom", "top", -100, -32.62, 180, 1.0); // RJ45
external("J6",  "top",    "top",  -62, -34.72,   0);      // 18-pin FPC, inside edge
external("J9",  "right",  "top",  -24, -33.16, 270, 1.0); // right-angle SMA
external("J13", "bottom", "top",   24, -29.97, 180, 1.0); // XLR-3
external("J16", "top",    "top",   62, -37.63,   0, 0.8); // Micro-USB 10118193
external("J18", "top",    "top",  100, -35.30,   0);      // JST-GH, inside edge
external("J19", "top",    "top",  138, -33.25,   0);      // terminal block, inside edge

// Bottom edge. The repeated 180-degree cases are deliberate: they catch the
// common LLM failure where the footprint is placed correctly but faces inward.
external("J2",  "top",    "bottom", -138, 32.96, 180, 1.0); // USB-A
external("J5",  "bottom", "bottom", -100, 35.13,   0);      // terminal block, inside edge
external("J7",  "top",    "bottom",  -62, 36.92, 180, 1.0); // USB-C TYPEC-304
external("J8",  "top",    "bottom",  -24, 37.28, 180, 0.8); // Micro-USB Type-B
external("J11", "top",    "bottom",   24, 35.05, 180);      // 40-pin FPC, inside edge
external("J12", "right",  "bottom",   62, 33.63,  90, 1.0); // DC barrel jack
external("J14", "bottom", "bottom",  100, 33.42,   0, 1.0); // PCB-edge SMA
external("J15", "bottom", "bottom",  138, 33.71,   0, 1.0); // 2.5 mm TRS jack

// These four are vertical/internal connectors; "outward" has no useful board-
// edge meaning. Fixed 0/90/180/270 rotations make their visual symmetry (or lack
// of it) explicit without pretending that a cable exits through the PCB edge.
for (const [designator, x, rotate] of [
  ["J4", -45, 0],   // vertical JST-PH
  ["J10", -15, 90], // U.FL
  ["J17", 15, 180], // JST-PH side-entry footprint kept internal for comparison
  ["J20", 45, 270], // vertical 1x8 header
]) {
  component(designator).block(`connector_${designator}`).role("connector").top()
    .fixed({ x, y: 0, rotate, layer: "top" });
}

solver({
  grid: 0.5,
  fallbackGrid: 1.0,
  ignoredSignals: ["GND"],
  localImproveIterations: 0,
});
