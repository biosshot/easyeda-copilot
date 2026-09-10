# Keep, repair or restore

After the stage's verification, keep a satisfactory result or an explicitly accepted non-blocking limitation. Prefer a focused repair for a concrete local defect. Restore a clearly invalid or broadly regressed agent-applied result when a safe repair is unavailable. Report the decision and remaining findings; a warning alone does not require rollback.

Before checkpoint restoration:

- Retain the checkpoint ID associated with the change and its exact document UUID/baseline. Inspection scripts also create checkpoints; the latest checkpoint may already contain the defect.
- Establish that the original execution/application has finished. A timeout is not cancellation. Follow [operation results](operations.md) or [execute_js timeout recovery](execution/instructions.md#errors-and-timeout) when the outcome is unknown.
- Confirm the checkpoint matches the target document. Use `list_checkpoints` and an explicit `id` with `restore_checkpoint_for_current_page`; `isCurrentPage` alone does not establish PCB document identity.
- Preserve intervening user work. Prefer a precise repair if a blanket restore would overwrite it. Clarify only when the intended version or changes to retain are unclear.

A checkpoint covers one document's source. It does not recover deleted projects/libraries, other documents, project relationships or external effects, and it is not a permanent backup. For explicitly requested work outside that coverage, establish an appropriate recovery method. A placement/routing request does not authorize destructive project cleanup.

After repair or restoration, verify current readback and the affected [schematic](schematic/verification.md), [placement](pcb-layout/verification.md) or [routing](pcb-routing/verification.md) checks. Tool success alone does not establish that the recovered design is correct.
