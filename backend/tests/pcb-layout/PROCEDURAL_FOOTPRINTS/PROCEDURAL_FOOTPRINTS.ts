import { runPcbLayoutFixture } from "../run-pcb-layout-fixture.ts";
import { renderPlacementSubsetSvg } from "../../../src/pcb-layout/pcb-auto-place/render.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const run = await runPcbLayoutFixture(import.meta.url, "PROCEDURAL_FOOTPRINTS");
assert.equal(run.placementReport.ok, true, "procedural footprint e2e placement must be geometry-clean");
assert.equal(run.boardAssemble.components?.some((component) => component.designator === "SJ_BOOT"), false);
assert.equal(run.boardAssemble.pads?.filter((pad) => pad.name.startsWith("SJ_BOOT.")).length, 2);
assert.equal(run.boardAssemble.vias?.filter((via) => via.net === "GND").length, 9);
assert.equal(run.boardAssemble.polygons?.filter((polygon) => polygon.net === "GND" && polygon.layer === "bottom").length, 1);
const previewDir = resolve(".test-output/pcb-layout/PROCEDURAL_FOOTPRINTS/previews");
mkdirSync(previewDir, { recursive: true });

for (const [fileName, designator, viewLayer] of [
    ["thermal-pad-top.svg", "U1", "top"],
    ["thermal-pad-bottom.svg", "U1", "bottom"],
    ["solder-jumper.svg", "SJ_BOOT", "top"],
] as const) {
    writeFileSync(resolve(previewDir, fileName), renderPlacementSubsetSvg(
        run.placementInput,
        run.placements.filter((placement) => placement.designator === designator),
        { padding: designator === "U1" ? 0.6 : 1.2, labels: false, viewLayer, ratsnest: false },
    ));
}
