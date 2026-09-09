---
name: easyeda-copilot-mcp
description: Create, modify, place, route, or review EasyEDA schematics and PCBs with EasyEDA Copilot MCP tools. Execute JavaScript for focused API edits and operations not covered by the standard tools.
---

# EasyEDA Copilot MCP

Complete only the stage requested by the user. A schematic task does not authorize PCB work; placement does not authorize routing.

For overall schematic organization, PCB placement and routing, start with Copilot's dedicated tools and verify their result. Improve that result with scoped refinement; use `execute_js` for a specific correction or a missing API operation. Use a different approach when the user explicitly requests it. Access to JavaScript does not expand the authorized task.

## Start

1. If multiple EasyEDA windows may be connected, call `list_easyeda_instances` and select the intended instance.
2. Call `get_all_projects` when the project is unknown and switch with `open_document({ project_uuid })`; it saves all open design tabs before switching. Then call `get_current_project_info` once when the document tree or exact document is unknown.
3. Select one task mode below and read only its references.
4. Open the exact schematic page or PCB before inspecting or changing it.

| Task | Read | Stop when |
|---|---|---|
| Complete schematic-to-PCB project | `workflow.md`, then each stage reference when reached | requested final stage is checked |
| Create or organize schematic pages | `schematic/project-and-pages.md` | functional pages exist and are named |
| Create, modify, or beautify a schematic | `schematic/workflow.md`, `schematic/circuit-mod.md` | current-page readback is checked |
| Place or update PCB components | `pcb-layout/instructions.md`, `pcb-layout/dsl.ts` | approved placement is assembled and checked; do not route |
| Change connectors, outline, holes, controls, displays, or antennas | placement docs plus `pcb-layout/mechanical-validation.md` | LLM and user approve mechanics |
| Apply layer count, rules, zones, copper, or routing | `pcb-routing/instructions.md`, `pcb-routing/dsl.ts` | requested PCB operation is checked |
| Inspect or verify without mutation | `verification.md` | requested evidence is reported |
| Execute JavaScript or make a focused API edit | `execution/instructions.md`, then the needed API reference | returned data or artifacts and the affected objects are checked |

## Required behavior

- New or substantially expanded schematics must use functional EasyEDA schematic pages.
- `beautify_schematic_on_current_page` rebuilds the entire current page. Every current-page component must appear in exactly one functional block.
- After `import_pcb_changes`, stop and ask the user to confirm the EasyEDA import dialog. Do not continue until the user says it is complete.
- Open the target PCB before `make_pcb_layout`; this supplies its outline and component positions to `preserve(...)`.
- Treat placement and routing as one coupled physical problem: plan plausible signal, power, return, escape, and thermal paths before placement, then verify placement feasibility before routing. High density is valid when the intended layer and via strategy supports it.
- Placement preview is not applied. Assemble only a completed final `layoutId`, after user approval.
- Long placement and routing calls are complete only after `wait_operation` returns a terminal result. If calculation finished but applying its saved in-memory result failed, retry it with `apply_operation` instead of rerunning the calculation.
- Existing PCB copper and objects are preserved by placement assembly. Existing routing is preserved by the router unless `clearRouting(...)` explicitly selects copper to replace.
- For stack-dependent routing intent, use verified physical data, declare and report a reasonable provisional stack, or ask for the missing data. Do not silently omit the semantic constraint.
- After verification, decide whether to keep, repair, or restore the agent-applied result. Prefer a focused repair for a local error; restore a clearly invalid or broadly regressed result that cannot be repaired safely. Do not restore for a warning alone, and report the decision.
- Before `execute_js`, read `execution/instructions.md`. Identify the exact document and affected objects, retain the checkpoint ID returned for the edit, then verify both the intended change and preservation of relevant surrounding objects. Read-only executions also create checkpoints: never assume the latest checkpoint is the baseline to restore.
- A checkpoint covers the current document source, not the entire project or external state. A layout/refinement request does not authorize deleting projects, libraries or pages, clearing the whole design, or replacing unrelated content. Restore only a matching, explicit checkpoint after execution has finished and when doing so will not discard intervening user work; see `verification.md`.
- `execute_js` waits up to 60 seconds and does not cancel JavaScript on timeout. Do not retry a mutation or restore while its execution outcome is unknown.
- `execute_js` returns small JSON inline; responses larger than 16 KiB, including execution errors, are saved to local artifacts. Binary results are always files. Read the relevant fields or file sections with local tools; do not dump the whole artifact back into context. See `execution/instructions.md` for formats and examples.

## Finish

Report changed documents, checks performed, unresolved findings, and the next requested stage. Do not suggest work beyond the user's requested boundary.
