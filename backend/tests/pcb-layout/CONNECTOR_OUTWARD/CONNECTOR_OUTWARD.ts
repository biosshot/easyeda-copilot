import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderPlacementSubsetSvg } from "../../../src/pcb-layout/pcb-auto-place/render.ts";
import { runPcbLayoutFixture } from "../run-pcb-layout-fixture.ts";

const run = await runPcbLayoutFixture(import.meta.url, "CONNECTOR_OUTWARD");

assert.equal(run.placementReport.ok, true, "face:outward diagnostic must remain geometry-clean");
assert.equal(run.placementInput.components.length, 20);
assert.equal(run.placements.length, 20);
assert.equal(new Set(run.placementInput.components.map((component) => component.part_uuid)).size, 20);

const placementByDesignator = new Map(run.placements.map((placement) => [placement.designator, placement]));
const diagnostics = run.placementInput.components.map((component) => {
  const placement = placementByDesignator.get(component.designator)!;
  assert.deepEqual(component.pcb.edgePlace?.edges, ["left"]);
  assert.equal(component.pcb.edgePlace?.face, "outward");
  assert.equal(component.pcb.faceTo, "left",
    `${component.designator}: outward on the left edge must compile to faceTo(left)`);
  assert.equal(component.pcb.mechanicalFaceAt0Source, "auto_pads");
  assert.ok(component.pcb.faceWarning);
  return {
    designator: component.designator,
    value: component.value,
    part_uuid: component.part_uuid,
    footprint: component.footprint.name,
    requested_edge: "left",
    requested_face: component.pcb.edgePlace?.face,
    compiled_face_to: component.pcb.faceTo,
    inferred_face_at_0: component.pcb.mechanicalFaceAt0,
    selected_rotation: placement.rotate,
    x: placement.x,
    y: placement.y,
    warning: component.pcb.faceWarning,
  };
});

const outputDir = resolve(".test-output/pcb-layout/CONNECTOR_OUTWARD");
const previewDir = resolve(outputDir, "previews");
mkdirSync(previewDir, { recursive: true });
writeFileSync(resolve(outputDir, "outward-report.json"), JSON.stringify(diagnostics, null, 2));
writeFileSync(resolve(outputDir, "outward-report.md"), [
  "| Ref | Part | outward edge | compiled faceTo | auto faceAt0 | selected rotate |",
  "| --- | --- | --- | --- | --- | ---: |",
  ...diagnostics.map((item) =>
    `| ${item.designator} | ${item.value} | ${item.requested_edge} | ${item.compiled_face_to} | ${item.inferred_face_at_0} | ${item.selected_rotation}° |`),
  "",
].join("\n"));

for (const placement of run.placements) {
  const component = run.placementInput.components.find((item) => item.designator === placement.designator)!;
  writeFileSync(resolve(previewDir, `${placement.designator}.svg`), renderPlacementSubsetSvg(
    run.placementInput,
    [placement],
    {
      title: `${placement.designator} — ${component.value} — outward left — auto faceAt0 ${component.pcb.mechanicalFaceAt0} — rotate ${placement.rotate}°`,
      padding: 2,
      ratsnest: false,
    },
  ));
}

console.table(diagnostics.map(({ designator, value, compiled_face_to, inferred_face_at_0, selected_rotation }) => ({
  designator,
  value,
  compiled_face_to,
  inferred_face_at_0,
  selected_rotation,
})));
