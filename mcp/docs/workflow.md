# Workflow

Every stage can start and finish independently.

```text
SCOPE -> SELECT INSTANCE -> OPEN DOCUMENT -> INSPECT -> MUTATE -> WAIT -> VERIFY -> DECIDE -> STOP
```

- Reuse known project and document IDs. Do not repeat unchanged discovery calls.
- Prefer coherent batched mutations, but split work when an intermediate check reduces risk.
- Call `sync_current_document` only when the editor state is stale; it saves, closes, and reopens the document.
- Use `cancel_operation` only when pending work is obsolete.
- After the stage's verification, choose `keep`, a focused repair, or checkpoint restore under [recovery](recovery.md). Report the decision.

## Full project

Use this composition only when the user requests a complete schematic-to-PCB workflow:

1. Read the project tree and plan functional schematic pages.
2. Create, name, and populate each requested page.
3. Beautify completed or structurally changed pages and perform [schematic verification](schematic/verification.md).
4. Create or open the linked BOARD and PCB documents. If both are missing, create the PCB first, then create the BOARD with the schematic UUID and returned PCB UUID. Reuse existing documents instead of duplicating them.
5. Call `import_pcb_changes` when synchronization is needed.
6. **Stop.** Tell the user that EasyEDA normally opens an import dialog and ask them to confirm it. Continue only after the user confirms completion.
7. Open the target PCB. Inspect complete connectivity once and derive a provisional placement-and-routing plan: logical signal paths, power flow, thermal needs, layer/via strategy, escape directions, and routing corridors. Then select the placement preservation mode.
8. If mechanics are affected, run the mechanical preview and obtain user approval.
9. Run full placement and perform [placement verification](pcb-layout/verification.md), including pad-level proximity and routing feasibility. Obtain final placement approval under the placement guide's authorization rules, then assemble the final `layoutId`.
10. Verify the live placement. Correct clear local defects autonomously, preserving the accepted placement elsewhere and following the [iteration loop](pcb-layout/instructions.md#iterative-local-corrections). Use [execute_js](execution/instructions.md) when a local move or block arrangement is clearly simpler to express directly or the DSL cannot achieve it. Continue while measurable improvements justify further work.
11. Plan layer count, DRC rules, critical circuits and their return paths for the whole board. A useful starting sequence is critical circuits (power, differential pairs, controlled impedance, matched lengths, resonators/clocks and other sensitive connections), auxiliary GND connections, ordinary circuits, then final pours and stitching. Adapt or combine passes according to the board's topology, stack, existing copper and observed results, preserving electrical requirements. Follow the [routing strategy](pcb-routing/instructions.md#plan-globally-route-in-manageable-transactions) for scope and preservation. If placement is the bottleneck, return to placement within the requested scope instead of repeating the same routing attempt.
12. Perform [routing verification](pcb-routing/verification.md) after final ground completion, including whole-board connectivity, actual filled copper, differential-pair geometry and current native DRC. Stop at the requested boundary.

If the user requests only one stage, start there and do not perform later stages.

## Create a linked BOARD and PCB

Use exact UUIDs returned by the tools:

```text
create_doc({ doc: { doc_type: "pcb", board_name: "MainBoard" } }) -> PCB_UUID
create_doc({ doc: { doc_type: "board", schematic_uuid: SCHEMATIC_UUID, pcb_uuid: PCB_UUID } })
get_current_project_info() -> verify the BOARD links both documents
```

If a suitable PCB or BOARD already exists, link or reuse it rather than creating another one. BOARD is the project relation; open the PCB document itself before placement, inspection, or routing.
