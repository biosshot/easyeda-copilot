// Diagnostic for face:"outward" itself. There is intentionally no faceAt0,
// faceTo, fixed placement, or explicit rotation in this fixture.

board.rect(80, 620, {
  layers: ["top", "bottom"],
  defaultLayer: "top",
  clearance: 0.5,
  edge: 1.0,
});

silkscreen.designators({ height: 1.1, rotations: [0, 90], margin: 0.4 });

const connectorIds = Array.from({ length: 20 }, (_, index) => `J${index + 1}`);
const startY = -285;
const stepY = 30;

for (const designator of connectorIds) {
  block(`connector_${designator}`, [designator], "connector");
}

for (let index = 0; index < connectorIds.length; index += 1) {
  const designator = connectorIds[index];
  component(designator)
    .block(`connector_${designator}`)
    .role("connector")
    .top()
    .edgePlace("left", {
      inset: 2,
      y: startY + index * stepY,
      face: "outward",
      layer: "top",
    });
}

solver({
  grid: 0.5,
  fallbackGrid: 1.0,
  ignoredSignals: ["GND"],
  localImproveIterations: 0,
});
