---
name: easyeda-copilot
description: Create, modify, place, route, or review EasyEDA schematics and PCBs with EasyEDA Copilot, using direct MCP tools when available or the generated standalone CLI skill.
---

# EasyEDA Copilot

Use the direct MCP tools when they are available. A generated standalone skill contains `build-info.json` and `scripts/easyeda-copilot-cli.js`; in that mode read [the CLI guide](cli.md), resolve the launcher's absolute path, and run it with Node.js >=20.19. Before first use, read `build-info.json`: an `npm` distribution requires `npm install --omit=dev` in `scripts/runtime/`, while a matching-platform `bundled` distribution does not. Stop if `installationBlockers` is nonempty.

In CLI mode, run `node <absolute-launcher-path> start` once, retain the returned four-character daemon ID, and translate each tool invocation below to `<launcher> <id> call <tool>`. Omitted arguments are `{}`; use `<id> tools help <tool>` for the current JSON Schema rather than inferring arguments. Keep the same ID for a task and its long operations, then stop it when finished.

Complete only the stage requested by the user. A schematic task does not authorize PCB work; placement does not authorize routing.

For overall schematic organization, PCB placement and routing, start with Copilot's dedicated tools and verify their result. Improve that result with scoped refinement; use native API edits when a direct local correction is clearly simpler, the DSL cannot express it, or attempts have stalled. For a self-contained edit inside EasyEDA, use `execute_js`. When refinement needs local Python/Node.js geometry, libraries or repeated read–calculate–apply cycles, prefer the [local SDK](execution/local-sdk.md#when-to-use-the-sdk) so calculations and API calls stay in one script. Reassess this choice when local computation enters an existing MCP workflow. Use a different approach when the user explicitly requests it. Native API access does not expand the authorized task.

## Start

1. If multiple EasyEDA windows may be connected, call `list_easyeda_instances` and select the intended instance.
2. Call `get_all_projects` when the project is unknown and switch with `open_document({ project_uuid })`; it saves all open design tabs before switching. Then call `get_current_project_info` once when the document tree or exact document is unknown.
3. Select one task mode below and read only its references.
4. Open the exact schematic page or PCB before inspecting or changing it.

Keep a short working record: target instance/document UUID, requested stage, exact scope, current operation or layout ID, and verification still needed. Read one stage guide and the relevant declaration sections; do not load the full API catalog. Follow the current tool schema for tool arguments and the stage's local `dsl.ts` for DSL syntax. The LLM and router-package references are intentionally maintained separately; consult the installed package when diagnosing a missing method or version mismatch.

| Task | Read | Stop when |
|---|---|---|
| Complete schematic-to-PCB project | `workflow.md`, then each stage reference when reached | requested final stage is checked |
| Create or organize schematic pages | `schematic/project-and-pages.md` | functional pages exist and are named |
| Create, modify, or beautify a schematic | `schematic/workflow.md`, `schematic/circuit-mod.md`; finish with `schematic/verification.md` | current-page readback is checked |
| Place or update PCB components | `pcb-layout/instructions.md`, `pcb-layout/dsl.ts`; finish with `pcb-layout/verification.md` | approved placement is assembled and checked; do not route |
| Change connectors, outline, holes, controls, displays, or antennas | placement docs plus `pcb-layout/mechanical-validation.md` | LLM and user approve mechanics |
| Apply layer count, rules, zones, copper, or routing | `pcb-routing/instructions.md`, `pcb-routing/dsl.ts`; finish with `pcb-routing/verification.md` | requested PCB operation is checked |
| Wait, cancel, or recover a long operation | `operations.md` | terminal result and current document state are checked |
| Inspect or verify without mutation | `verification.md` | requested evidence is reported |
| Read component datasheets during creation/review, substitutions or component-specific layout | `datasheets/SKILL.md` (standalone Node.js skill); reuse the `datasheet` URL from `component_search` | relevant facts, conditions and PDF pages are checked; preserve useful review notes |
| Simulate a circuit or verify analog behavior | `spice/SKILL.md` (standalone Node.js skill); obtain the actual schematic connections with existing read tools | numerical results, PNGs and model assumptions are reviewed |
| Execute JavaScript or make a focused API edit | `execution/instructions.md`, then the needed API reference | returned data or artifacts and the affected objects are checked |
| Use local Python/Node.js libraries with the native EDA API | `execution/local-sdk.md`, `execution/instructions.md`, then the needed API reference | local script results and affected objects are checked; SDK session is closed |
| Inspect or edit document File Source | `execution/instructions.md`, `execution/file-source.md` | intended records and the affected stage are verified; standard workflows remain the starting point |

## Required behavior

- New or substantially expanded schematics must use functional EasyEDA schematic pages.
- Use explicit, resolved components with real part UUIDs.
- Do not spend tool calls or visual-analysis tokens reviewing ordinary two-pin resistors, simple inductors/ferrite beads, fuses, or one-pin components. Skip symbol preview when all pin functions are already clear from their names, unless there is a concrete contradiction. Numeric/blank names or names identical to pin numbers do not establish function. For other components with any ambiguous pin (including capacitors, buttons, diodes, LEDs and unlabeled connectors), inspect only the selected candidate using its `preview_image_path` or `preview_component`; do not review every search result or repeat an already completed review of the same `part_uuid`. Capacitors are not exempt because polarity cannot be reliably inferred from search metadata. Images are local PNG files, not attached to tool responses. A symbol drawing is not proof of physical pin function or relay contact state; use the exact datasheet when uncertainty remains.
- `beautify_schematic_on_current_page` rebuilds the entire current page. Every current-page component must appear in exactly one functional block.
- After `import_pcb_changes`, stop and ask the user to confirm the EasyEDA import dialog. Do not continue until the user says it is complete.
- Open the target PCB before `make_pcb_layout`; this supplies its outline and component positions to `preserve(...)`.
- Treat placement and routing as one coupled physical problem: plan plausible signal, power, return, escape, and thermal paths before placement, then verify placement feasibility before routing. High density is valid when the intended layer and via strategy supports it.
- Placement preview is not applied. Assemble only a reviewed, completed final `layoutId` within the user's authorization; follow the placement guide's approval rules.
- Validate placement with [geometry and connectivity checks](pcb-layout/verification.md). Correct clear in-scope defects autonomously and continue [local refinement](pcb-layout/instructions.md#iterative-local-corrections) while it provides measurable improvement.
- Plan critical circuits and their return paths together. Ground uses pours by default: route a specific critical return segment early only when required, and use ordinary GND tracks only for connections the verified fill cannot provide after appropriate pour/via corrections. For simple spacious boards, a complete single-call attempt is appropriate; otherwise use scoped passes. See the [routing strategy](pcb-routing/instructions.md#plan-globally-route-in-manageable-transactions) for sequencing, net scope and verification.
- Managed mutations, placement and routing calls returning `running` require `wait_operation` until terminal. Use [operations.md](operations.md) to interpret results and retry a saved application; restarting MCP loses in-memory operations.
- Existing PCB copper and objects are preserved by placement assembly. Existing routing is preserved by the router unless `clearRouting(...)` explicitly selects copper to replace.
- For stack-dependent routing intent, use verified physical data, declare and report a reasonable provisional stack, or ask for the missing data. Do not silently omit the semantic constraint.
- After verification, decide whether to keep, repair, or restore the agent-applied result. Prefer a focused repair for a local error; restore a clearly invalid or broadly regressed result that cannot be repaired safely. Do not restore for a warning alone, and report the decision.
- Before `execute_js`, read `execution/instructions.md`. Identify the exact document and affected objects, retain the checkpoint ID returned for the edit, then verify both the intended change and preservation of relevant surrounding objects. Read-only executions also create checkpoints: never assume the latest checkpoint is the baseline to restore.
- A checkpoint covers the current document source, not the entire project or external state. A layout/refinement request does not authorize deleting projects, libraries or pages, clearing the whole design, or replacing unrelated content. Restore only a matching, explicit checkpoint after execution has finished and when doing so will not discard intervening user work; see [recovery](recovery.md).
- Managed MCP mutations return `operation_id` even when they finish within the initial 50-second wait. Use `list_operations` after losing an initial response, and `wait_operation` while running. Cancelling a wait does not cancel the operation; use `cancel_operation` explicitly. See [operation semantics](operations.md).
- `execute_js` has a 60-second execution budget and may outlive cancellation or timeout. Do not retry a mutation or restore while its execution outcome is unknown.
- `execute_js` returns small JSON inline; responses larger than 8 KiB, including execution errors, are saved to local artifacts. Binary results are always files. Read the relevant fields or file sections with local tools; do not dump the whole artifact back into context. See `execution/instructions.md` for formats and examples.

## Finish

Report changed documents, checks performed, unresolved findings, and the next requested stage. Do not suggest work beyond the user's requested boundary.
