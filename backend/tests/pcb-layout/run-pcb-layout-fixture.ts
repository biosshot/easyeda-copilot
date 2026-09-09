import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPcbLayout } from "#pcb-layout/run-pcb-layout.ts";
import type { ExplainCircuit } from "#types/circuit.ts";

export async function runPcbLayoutFixture(metaUrl: string, fixtureName: string, outputName = fixtureName) {
    const dirname = path.dirname(fileURLToPath(metaUrl));
    const read = (file: string) => readFileSync(path.join(dirname, file), "utf-8");
    const run = await runPcbLayout({
        circuit: JSON.parse(read(`${fixtureName}.json`)) as ExplainCircuit,
        code: read(`${fixtureName}.js`),
        outputDir: path.join(".test-output", "pcb-layout", outputName),
    });

    console.log([
        `placement_ok: ${run.placementReport.ok}`,
        `components: ${run.placementInput.components.length}`,
        `board: ${run.layout.board.outline.width}mm x ${run.layout.board.outline.height}mm`,
        `errors: ${run.digest.errors.length}`,
        ...run.digest.errors.slice(0, 24).map((line) => `- ${line}`),
        `diagnostics: ${run.digest.diagnostics.length}`,
        ...run.digest.diagnostics.slice(0, 24).map((line) => `- ${line}`),
    ].join("\n"));

    return run;
}
