---
name: spice
description: Write and run ngspice simulations from circuit descriptions, component connections, or existing netlists. Search local SPICE models and produce numerical results and PNG plots using standalone Node.js scripts.
---

# SPICE simulation

This skill is independent of an EDA editor and MCP. Requires Node.js >=20.19. The scripts run directly as JavaScript; no compilation or Python is needed. Resolve script paths relative to this SKILL.md, not the current working directory.

## Workflow

1. Obtain component values and actual net connections from the caller's schematic tools, supplied netlist, or circuit description. State the question being tested, supplies, input stimulus, load, and operating conditions. Detected circuit blocks are optional context, not a restriction on what can be simulated.
2. Find device models with `node scripts/search.mjs "MPN"`. On first use it prepares two cache files: `library.jsonl` and `index.json` with byte offsets. It returns matching models, their text, exact `modelId`, original `sourcePath`, matching reasons, and validation scope. `sourcePath` is an archive identifier, not an existing filesystem path. Use `--include-review` only when ordinary results are insufficient. Similar names do not establish an equivalent component.
3. Save the selected model with `node scripts/copy-model.mjs "<modelId from search>" --out ./simulation/models`. This reads only that JSONL record and writes one `.lib`, returning its absolute path, model name and `.include` directive. Existing identical copies are reused; edited files are never overwritten. Read the complete saved model, including any text truncated in search. Establish port order from comments and the `.SUBCKT` declaration. Internal structure can support an inference but does not establish physical package pin numbers. Record inferred assignments; prefer another clearly documented model if important ports remain uncertain. No external pin-mapping table is required.
4. Write a standard `.cir` file with a title on its first line, `.include`/`.lib` declarations, sources, `.save`, analysis directives, and `.end`. Use `.op`, `.dc`, `.ac`, and `.tran` as needed. The runner owns `.control`; do not include a control block. Use separate circuits for repeated parameter cases. Include only selected model files to avoid name collisions.
5. Run `node scripts/simulate.mjs circuit.cir --out results/run-01`. Output directory must be new. The runner finds/prepares ngspice, sets `ngbehavior=ltpsa` before reading the netlist, runs with `-n -b`, exports ASCII raw/CSV/JSON and creates PNGs through Sharp. Numerical settings belong in `.options` in the netlist, not CLI flags. Relative includes resolve from each original file's directory and are copied recursively into the result's `models/` directory.
6. Read `result.json`, measurements in `ngspice.log`, numerical data, and the PNGs. Check operating points, expected magnitudes, loading, saturation, and timestep/frequency resolution. Successful execution is not proof of model fidelity or correct circuit behavior. Compare important results with an independent calculation or a meaningful known limit.
7. Report what was simulated, the selected models and assumptions, quantitative results, and material limitations. Keep the complete result directory with the user's research: it contains the rewritten circuit and referenced model snapshots, with original paths and hashes recorded in `result.json`. External stimulus data files (e.g. file-backed sources) are not bundled; use inline sources or copy such data into the run explicitly.

For convergence problems, read [modeling.md](references/modeling.md). For missing dependencies or download failures, read [installation.md](references/installation.md). For plot customization, read [plots.md](references/plots.md). No PCB parasitic extraction is included.

## Commands

```sh
node scripts/search.mjs "LM358" --limit 3
node scripts/search.mjs "LM358" --include-review --text-limit 60000
node scripts/copy-model.mjs "<modelId from search>" --out ./simulation/models
node scripts/simulate.mjs circuit.cir --out results/run-01 --timeout 120
node scripts/simulate.mjs circuit.cir --out results/run-02 --ngspice /absolute/path/to/ngspice
```

Use `--library <directory containing index.json and library.jsonl>` or `--manifest <file>` to select a library. `--cache` / `SPICE_CACHE_DIR` selects the shared cache root; default is `<OS temp>/easyeda-copilot-mcp/spice`. Clearing this cache only requires reinstalling dependencies. Research outputs belong outside it. `--no-install` makes execution offline when dependencies are already available; `--no-plot` explicitly requests numerical output only. A PNG failure is reported separately from simulation failure.

Library `compiled` means load and generic instantiation passed without warnings on ngspice 45.2 with `ltpsa`. It does not guarantee convergence, correct pin assignments, or accuracy for the requested analysis. The runner reports its actual engine version separately.

## Examples

- [rc-filter.cir](examples/rc-filter.cir): OP, AC and transient; cutoff near 1591.55 Hz.
- [diode.cir](examples/diode.cir): DC sweep with an explicitly generic model.
- [custom-plot.mjs](examples/custom-plot.mjs): edit a PNG gain plot using exported complex data.
