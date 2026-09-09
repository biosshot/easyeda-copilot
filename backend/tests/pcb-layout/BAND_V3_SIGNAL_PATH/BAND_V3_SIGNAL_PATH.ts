import assert from "node:assert/strict";
import { runPcbLayoutFixture } from "../run-pcb-layout-fixture.ts";

const run = await runPcbLayoutFixture(import.meta.url, "BAND_V3_SIGNAL_PATH");
const path = run.placementReport.signalPaths.find((item) => item.id === "rf_main");
const biasPath = run.placementReport.signalPaths.find((item) => item.id === "bias_feed");
const u1 = run.placements.find((placement) => placement.designator === "U1");
const r1 = run.placements.find((placement) => placement.designator === "R1");
const j3 = run.placements.find((placement) => placement.designator === "J3");

assert.equal(run.placementReport.ok, true, JSON.stringify(run.placementReport));
assert.ok(path, "rf_main signal path report is missing");
assert.equal(path.resolved, true, JSON.stringify(path));
assert.equal(path.withinConstraints, true, JSON.stringify(path));
assert.ok(path.backtrack !== null && path.backtrack <= 0.5, JSON.stringify(path));
assert.ok(path.detour !== null && path.detour <= 0.5, JSON.stringify(path));
assert.ok(u1 && (u1.rotate === 90 || u1.rotate === 270), `MMIC must face along the RF axis: ${JSON.stringify(u1)}`);
assert.ok(biasPath, "bias_feed signal path report is missing");
assert.equal(biasPath.resolved, true, JSON.stringify(biasPath));
assert.equal(biasPath.withinConstraints, true, JSON.stringify(biasPath));
assert.ok(
    r1 && u1 && j3 && Math.abs(r1.y - j3.y) < Math.abs(u1.y - j3.y),
    `R1 must be between the power entry and U1 instead of behind the RF path: ${JSON.stringify({ j3, r1, u1 })}`,
);
assert.match(run.placementSvg, /data-signal-path="rf_main"/);
assert.match(run.placementSvg, /data-signal-path="bias_feed"/);

console.log(`rf_main: distance=${path.pathDistance}mm detour=${path.detour}mm backtrack=${path.backtrack} turns=${path.turns}`);
console.log(`bias_feed: distance=${biasPath.pathDistance}mm detour=${biasPath.detour}mm backtrack=${biasPath.backtrack} turns=${biasPath.turns}`);
