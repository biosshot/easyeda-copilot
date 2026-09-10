# Placement and routing operation results

Use the exact `operation_id` returned by the tool, in the same MCP process. IDs and prepared results are held in memory; restarting the server loses them. Finished operations may be evicted after newer operations accumulate.

| Response | Next action |
|---|---|
| `status: "running"` | Call `wait_operation({ operation_id, wait_ms: 30000 })`. Repeat while running. Do not submit the same job again. |
| Placement returns a final `layoutId` | Inspect the preview and diagnostics; assemble only the approved final layout. A mechanical preview is never assembled. |
| Router returns `status: "complete"` or `"partial"`, `applied: true` | Copper is already applied. Read `routing`, `drc`, and `diagnostics`; verify the requested scope. `partial` can be useful but is not full-board completion. |
| `cancel_operation` returns `"cancel_requested"` | Cancellation is pending. Wait for the terminal cancellation result, then inspect the PCB before another mutation. Cancellation is not rollback. |
| Calculation completed but applying its prepared result failed | Establish that application has finished, inspect the current document, then use `apply_operation` only when replaying that saved result is still valid for this document. |
| `apply_operation` returns `"applied"` or `"already_applied"` | Inspect `apply_result` and current PCB checks. It does not rerun calculation. A later `wait_operation` may still report the original application error. |
| MCP error / `isError: true` | Read the message. Failed and cancelled operations are reported as errors, not necessarily JSON status objects. A failure may occur after edits; inspect before retrying. |
| `Operation not found` | Check the ID and MCP process. After a restart or eviction, inspect actual document state before deciding to calculate again. |

`wait_ms` (1,000–55,000 ms) controls how long a call waits for a reply, not the total calculation time. Keep the target document open throughout the operation. Avoid competing mutations, including from another MCP client.

While routing is running, `wait_operation` includes `progress` when a router log is available: `log_file`, `updated_at`, and up to 10 recent `log_tail` lines. Read this tail to follow the current stage, ongoing work and remaining connections when the engine reports them. There is no separate guaranteed percentage or remaining-count field; do not infer one from elapsed time. Missing or unchanged log output is not proof of failure. Read a specific log section only when needed for diagnosis; do not repeatedly dump the full log or cancel a job solely because one wait interval produced no new lines.

Router completion describes the selected routing scope. It does not prove whole-board connectivity or native DRC success. `drc: "passed"` is the returned native check; `"failed"` requires reviewing violations, and `"not-run"` is missing evidence. Inspect `artifacts_directory` when diagnostics or net names are omitted from the compact response; read selected fields from `routing-result.json` rather than dumping it.

`execute_js` has a different lifecycle: it has no operation ID and no wait/apply/cancel support. After its timeout, follow [execution recovery](execution/instructions.md#errors-and-timeout).
