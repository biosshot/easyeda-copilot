import assert from "node:assert/strict";
import { runPcbLayoutFixture } from "../run-pcb-layout-fixture.ts";
import { renderPlacementSubsetSvg } from "../../../src/pcb-layout/pcb-auto-place/render.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const run = await runPcbLayoutFixture(import.meta.url, "CONNECTOR_ROTATIONS");

assert.equal(run.placementReport.ok, true, "connector orientation fixture must be geometry-clean");
assert.equal(run.placementInput.components.length, 20, "the visual fixture must retain all 20 connector footprints");
assert.equal(run.placements.length, 20, "all connector footprints must receive a placement");
assert.equal(new Set(run.placementInput.components.map((component) => component.part_uuid)).size, 20,
  "every connector must use a different real EasyEDA part_uuid");

const expectedRotations = new Map<string, number>([
  ["J1", 0], ["J2", 180], ["J3", 180], ["J4", 0], ["J5", 0],
  ["J6", 0], ["J7", 180], ["J8", 180], ["J9", 270], ["J10", 90],
  ["J11", 180], ["J12", 90], ["J13", 180], ["J14", 0], ["J15", 0],
  ["J16", 0], ["J17", 180], ["J18", 0], ["J19", 0], ["J20", 270],
]);

for (const placement of run.placements) {
  assert.equal(placement.rotate, expectedRotations.get(placement.designator),
    `${placement.designator} must retain its visually verified mechanical rotation`);
}

const previewDir = resolve(".test-output/pcb-layout/CONNECTOR_ROTATIONS/previews");
mkdirSync(previewDir, { recursive: true });
for (const placement of run.placements) {
  const component = run.placementInput.components.find((item) => item.designator === placement.designator)!;
  writeFileSync(resolve(previewDir, `${placement.designator}.svg`), renderPlacementSubsetSvg(
    run.placementInput,
    [placement],
    { title: `${placement.designator} — ${component.value} — rotate ${placement.rotate}°`, padding: 2, ratsnest: false },
  ));
}
