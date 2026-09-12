# Keep, repair or restore

Save meaningful milestones with `save_checkpoint_for_current_page({name: "Schematic verified, before property changes"})`. Use verified facts in names; a name does not itself prove verification. Names are optional (up to 200 characters) and need not be unique. `list_checkpoints({limit: 100})` returns names and IDs, newest first (default 16, maximum 512). Older unnamed checkpoints get an English date-based display name without rewriting stored records. Automatic checkpoints use English operation names. Always restore by ID. Both the MCP server and extension must be updated for names and configurable limits. Naming does not pin a checkpoint or exempt it from automatic pruning.

After the stage's verification, keep a satisfactory result or an explicitly accepted non-blocking limitation. Prefer a focused repair for a concrete local defect. Restore a clearly invalid or broadly regressed agent-applied result when a safe repair is unavailable. Report the decision and remaining findings; a warning alone does not require rollback.

Before checkpoint restoration:

- Retain the checkpoint ID associated with the change and its exact document UUID/baseline. Inspection scripts also create checkpoints; the latest checkpoint may already contain the defect.
- Establish that the original execution/application has finished. A timeout is not cancellation. Follow [operation results](operations.md) or [execute_js timeout recovery](execution/instructions.md#errors-and-timeout) when the outcome is unknown.
- Confirm the checkpoint matches the target document. Use `list_checkpoints` and an explicit `id` with `restore_checkpoint_for_current_page`; `isCurrentPage` alone does not establish PCB document identity.
- Preserve intervening user work. Prefer a precise repair if a blanket restore would overwrite it. Clarify only when the intended version or changes to retain are unclear.

A checkpoint covers one document's source. It does not recover deleted projects/libraries, other documents, project relationships or external effects, and it is not a permanent backup. For explicitly requested work outside that coverage, establish an appropriate recovery method. A placement/routing request does not authorize destructive project cleanup.

After repair or restoration, verify current readback and the affected [schematic](schematic/verification.md), [placement](pcb-layout/verification.md) or [routing](pcb-routing/verification.md) checks. Tool success alone does not establish that the recovered design is correct.
