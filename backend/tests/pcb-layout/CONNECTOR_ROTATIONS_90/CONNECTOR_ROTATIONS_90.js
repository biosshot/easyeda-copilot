// Diagnostic fixture for the exact question: why is faceTo("left") alone not
// enough to orient an arbitrary real connector footprint correctly?
//
// Deliberately do NOT specify faceAt0 or rotate anywhere. Runtime must infer the
// footprint's zero-degree mating face from pad geometry, then choose a rotation
// that should make that inferred face point left. The resulting mistakes are the
// subject of this visual test, not placement failures to be corrected here.

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
    .faceTo("left")
    .fixed({ x: -23, y: startY + index * stepY, layer: "top" });
}

solver({
  grid: 0.5,
  fallbackGrid: 1.0,
  ignoredSignals: ["GND"],
  localImproveIterations: 0,
});
