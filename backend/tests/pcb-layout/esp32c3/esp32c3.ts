import assert from "node:assert/strict";
import { runPcbLayoutFixture } from "../run-pcb-layout-fixture.ts";

const run = await runPcbLayoutFixture(import.meta.url, "esp32c3");
const legalized = run.stages.find((stage) => stage.name === "02-v2-legalize");
const refined = run.stages.find((stage) => stage.name === "03-v2-post-place");
assert.ok(legalized, "ESP32C3 fixture must expose the resolved pre-refine placement");
assert.ok(refined, "ESP32C3 fixture must run the post-place refinement stage");

const before = new Map(legalized.placements.map((placement) => [placement.designator, placement]));
const after = new Map(refined.placements.map((placement) => [placement.designator, placement]));
for (const [left, right] of [["H1", "H2"], ["R4", "R5"]] as const) {
    assert.equal(after.get(left)?.x, before.get(right)?.x, `${left}/${right} must exchange resolved x slots`);
    assert.equal(after.get(left)?.y, before.get(right)?.y, `${left}/${right} must exchange resolved y slots`);
    assert.equal(after.get(right)?.x, before.get(left)?.x, `${left}/${right} must exchange resolved x slots`);
    assert.equal(after.get(right)?.y, before.get(left)?.y, `${left}/${right} must exchange resolved y slots`);
}

const postData = refined.data as {
    scoreBefore: number;
    scoreAfter: number;
    moves: Array<{ description: string; scoreBefore: number; scoreAfter: number }>;
};
assert.ok(postData.scoreAfter < postData.scoreBefore, "whole-board post-place score must improve");
assert.ok(postData.moves.some((move) => move.description.includes("headers: H1<->H2") && move.description.includes("+=180")));
assert.ok(postData.moves.some((move) => move.description.includes("R4<->R5")));
assert.ok(postData.moves.every((move) => move.scoreAfter < move.scoreBefore));
assert.equal(run.placementReport.ok, true);
