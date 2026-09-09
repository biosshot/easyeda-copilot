# Verification

Use only the checks relevant to the requested stage. A successful generator response is not sufficient evidence by itself.

## Schematic

- Re-read the affected page with `get_current_page_schematic` when exact component or net confirmation is needed.
- Confirm intended components, pins, signal names, and functional page ownership.
- Confirm that every component supplied to beautify appears in exactly one block.
- Review `sheetSpace` after extraction; below `10%` free is a page-splitting warning, not permission to keep packing unrelated circuitry.

## Placement and mechanics

- Treat the solver report and `previewSvgPath` as pre-assembly evidence.
- Confirm that every critical logical path remains physically ordered across series components and has a plausible continuous routing corridor. Check high-current copper space, return paths, dense-package escapes, via fields, and each reviewed thermal candidate; empty board area elsewhere is not evidence of routability.
- When `refineGroup` is used, verify each named designator's new pose and confirm that preserved components outside the group stayed fixed. For connectors or other mechanical parts, inspect orientation and access in the preview. A run with no accepted refinement move is valid.
- After assembly, use `inspect_component` for affected components.
- Use `preview_pcb` for connectors, mechanics, suspicious overlap, or a requested visual check; do not render every ordinary edit.
- On an already routed PCB, run `check_pcb_drc` after moving or adding components because the placement solver does not model all existing copper and board objects.

## Copper and routing

- Review the compact routing, copper, diagnostics, and `drc` summary. Use `check_pcb_drc` when violation details are needed.
- Distinguish a router/rule failure from a placement bottleneck. Do not keep retrying routing when component geometry blocks the only valid corridor or package escape; report the required placement change, and change placement only when the task scope permits it.
- Use `inspect_net` for a reported or critical net instead of inspecting every net.
- Do not immediately repeat `check_pcb_drc` when the router already returned current native DRC. Repeat it after later editor changes or when the returned result is incomplete.
- A DRC finding does not automatically require rollback and does not freeze the applied board. Repair one clear local tool-generated error with a focused follow-up transaction, then check the changed result.
- If violations remain, choose `keep` only for a non-blocking accepted condition, choose repair when the scope is safe and local, or restore when the result clearly violates requirements or causes a broad regression and the recovery conditions below are met. Ask the user when the acceptance requirement itself is unknown, not for routine restore permission.
- After a repair or restore, repeat the relevant analysis and current DRC. Report what was kept, repaired, or restored and why.

## Recovery conditions

- Retain the checkpoint ID associated with the change being evaluated and its document identity. Use that explicit ID, not an implicit latest snapshot; inspection scripts also create checkpoints.
- Before restoration, establish that the original execution has finished and the checkpoint matches the target document. A timeout is not cancellation. If execution is unconfirmed, do not retry the mutation or restore; follow `execution/instructions.md`.
- Compare current state with the known baseline and the agent's edits. Do not overwrite later user work with a blanket restore. Prefer a precise repair preserving it; when the intended version or intervening changes are unclear, stop conflicting edits and clarify what to retain.
- Document checkpoints do not restore deleted projects, other documents or external side effects. Verify a recovery method covering those changes before an explicitly requested operation; never infer that destructive cleanup is authorized by a request to improve placement or routing.
- After restoring, verify current readback and the relevant design checks. Report the restored checkpoint and any remaining limitation; the restore tool returning success alone is insufficient.

## Result classes

```text
PASS: requested evidence is present and no blocking issue remains
WARN: known limitation or accepted risk; state the reason
FAIL: a requested requirement or applied design check is not satisfied
```
