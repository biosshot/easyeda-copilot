# Workflow

Every stage can start and finish independently.

```text
SCOPE -> SELECT INSTANCE -> OPEN DOCUMENT -> INSPECT -> MUTATE -> WAIT -> VERIFY -> DECIDE -> STOP
```

- Reuse known project and document IDs. Do not repeat unchanged discovery calls.
- Prefer coherent batched mutations, but split work when an intermediate check reduces risk.
- Call `sync_current_document` only when the editor state is stale; it saves, closes, and reopens the document.
- Use `cancel_operation` only when pending work is obsolete.
- After verification, choose `keep`, a focused repair, or checkpoint restore under the recovery conditions in `verification.md`. Restore an agent-applied result when it clearly violates the request or causes a broad regression and restoration preserves intervening user work. Do not restore for a warning alone; report the decision.

## Full project

Use this composition only when the user requests a complete schematic-to-PCB workflow:

1. Read the project tree and plan functional schematic pages.
2. Create, name, and populate each requested page.
3. Beautify completed or structurally changed pages and verify current-page readback.
4. Create or open the linked BOARD and PCB documents. If both are missing, create the PCB first, then create the BOARD with the schematic UUID and returned PCB UUID. Reuse existing documents instead of duplicating them.
5. Call `import_pcb_changes` when synchronization is needed.
6. **Stop.** Tell the user that EasyEDA normally opens an import dialog and ask them to confirm it. Continue only after the user confirms completion.
7. Open the target PCB. Inspect complete connectivity once and derive a provisional placement-and-routing plan: logical signal paths, power flow, thermal needs, layer/via strategy, escape directions, and routing corridors. Then select the placement preservation mode.
8. If mechanics are affected, run the mechanical preview and obtain user approval.
9. Run full placement, verify it remains realistically routable under that plan, obtain final placement approval, and assemble the approved `layoutId`.
10. Run targeted live-PCB checks and confirm that critical signal, power, return, escape, and thermal paths remain feasible. Correct local findings with scoped refinement, preserving the accepted placement elsewhere. For a correction without a suitable dedicated tool, follow `execution/instructions.md` and use focused JavaScript; a local finding does not justify clearing or regenerating the whole design.
11. Apply requested layer count, DRC rules, copper, and routing as one complete router DSL transaction by default. If placement is the routing bottleneck, return to placement when the requested scope allows it; do not hide the problem with repeated routing attempts.
12. Review router diagnostics and native DRC, then stop at the requested boundary.

If the user requests only one stage, start there and do not perform later stages.

## Create a linked BOARD and PCB

Use exact UUIDs returned by the tools:

```text
create_doc({ doc: { doc_type: "pcb", board_name: "MainBoard" } }) -> PCB_UUID
create_doc({ doc: { doc_type: "board", schematic_uuid: SCHEMATIC_UUID, pcb_uuid: PCB_UUID } })
get_current_project_info() -> verify the BOARD links both documents
```

If a suitable PCB or BOARD already exists, link or reuse it rather than creating another one. BOARD is the project relation; open the PCB document itself before placement, inspection, or routing.
