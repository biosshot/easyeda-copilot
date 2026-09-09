import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderPlacementSubsetSvg } from "../../../src/pcb-layout/pcb-auto-place/render.ts";
import { runPcbLayoutFixture } from "../run-pcb-layout-fixture.ts";

const run = await runPcbLayoutFixture(import.meta.url, "CONNECTOR_ROTATIONS_90");

assert.equal(run.placementReport.ok, true, "faceTo(left) diagnostic must remain geometry-clean");
assert.equal(run.layout.board.outline.width, 80);
assert.equal(run.layout.board.outline.height, 620);
assert.equal(run.placementInput.components.length, 20);
assert.equal(run.placements.length, 20);
assert.equal(new Set(run.placementInput.components.map((component) => component.part_uuid)).size, 20);

const placementByDesignator = new Map(run.placements.map((placement) => [placement.designator, placement]));
const diagnostics = run.placementInput.components.map((component) => {
  const placement = placementByDesignator.get(component.designator)!;
  assert.equal(component.pcb.faceTo, "left", `${component.designator} must request only faceTo(left)`);
  assert.equal(component.pcb.mechanicalFaceAt0Source, "auto_pads",
    `${component.designator} must exercise pad-based faceAt0 inference`);
  assert.ok(component.pcb.faceWarning, `${component.designator} must expose the auto-face warning`);
  return {
    designator: component.designator,
    value: component.value,
    part_uuid: component.part_uuid,
    footprint: component.footprint.name,
    inferred_face_at_0: component.pcb.mechanicalFaceAt0,
    inference_source: component.pcb.mechanicalFaceAt0Source,
    requested_face_to: component.pcb.faceTo,
    selected_rotation: placement.rotate,
    warning: component.pcb.faceWarning,
  };
});

const outputDir = resolve(".test-output/pcb-layout/CONNECTOR_ROTATIONS_90");
const previewDir = resolve(outputDir, "previews");
mkdirSync(previewDir, { recursive: true });
writeFileSync(resolve(outputDir, "auto-face-report.json"), JSON.stringify(diagnostics, null, 2));
writeFileSync(resolve(outputDir, "auto-face-report.md"), [
  "| Ref | Part | auto faceAt0 | faceTo | selected rotate |",
  "| --- | --- | --- | --- | ---: |",
  ...diagnostics.map((item) =>
    `| ${item.designator} | ${item.value} | ${item.inferred_face_at_0} | ${item.requested_face_to} | ${item.selected_rotation}° |`),
  "",
].join("\n"));

for (const placement of run.placements) {
  const component = run.placementInput.components.find((item) => item.designator === placement.designator)!;
  writeFileSync(resolve(previewDir, `${placement.designator}.svg`), renderPlacementSubsetSvg(
    run.placementInput,
    [placement],
    {
      title: `${placement.designator} — ${component.value} — auto faceAt0 ${component.pcb.mechanicalFaceAt0} -> left — rotate ${placement.rotate}°`,
      padding: 2,
      ratsnest: false,
    },
  ));
}

console.table(diagnostics.map(({ designator, value, inferred_face_at_0, selected_rotation }) => ({
  designator,
  value,
  inferred_face_at_0,
  selected_rotation,
})));
