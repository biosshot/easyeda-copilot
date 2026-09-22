# Managed operation results

MCP annotations describe effects on the connected EasyEDA project, checkpoint store and session selection. Read-only inspection/search/preview tools have `readOnlyHint: true`; document edits and arbitrary JavaScript have `readOnlyHint: false`. Annotations are hints, not permissions or guarantees of rollback.

Managed mutations are `extract_circuit_on_current_page`, `beautify_schematic_on_current_page`, `assemble_pcb_layout_on_current_pcbdoc`, `annotate_designators`, `save_checkpoint_for_current_page`, `restore_checkpoint_for_current_page`, and `execute_js`. They wait up to **50 seconds** initially. A quick result keeps its normal fields and adds `operation_id`; a slower call returns `status: "running"` and `operation_id`. Use `wait_operation` for the final result. The ID is returned even for quick successful completion. Input errors before registration have no operation ID.

`extract_circuit_on_current_page` changes only the current schematic page; it is not an extraction/read tool. `component_search` only searches the component catalog and has no current-page mutation. Beautify also operates on the current schematic page. `annotate_designators` retains its existing multi-page scope.

`run_pcb_router_dsl` is already managed and defaults to a 50-second initial wait; read-only `make_pcb_layout` keeps its configurable initial wait. Document management (`open_document`, `save_doc`, `sync_current_document`, `modify_name`, `create_doc`, `delete_doc`), instance selection and the native import dialog (`import_pcb_changes`) remain direct commands. `apply_operation` reuses an existing operation and waits up to 50 seconds rather than creating another job.

Cancelling an initial MCP request or `wait_operation` stops only that wait after the operation has registered. Use `list_operations` to recover IDs after an interrupted initial wait; it returns tool/kind, status, stage and target metadata for active and retained operations. Use `cancel_operation` to request cancellation of the operation itself. Cancellation remains cooperative at every stage, including application; it is not deferred until assembly finishes. Native actions may outlive cancellation. Do not retry or restore while the outcome is unknown.

Operations are bound to their original EasyEDA instance and document. Open the original document before application or retry; a different active document is rejected. Concurrent application calls share one execution, and the document resource remains reserved during application. Routing application has its own 300-second command budget, independent of time spent waiting or routing. Automatic schematic/PCB assembly and routing results include `checkpointId`.

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

MCP `execute_js` is a managed mutation because arbitrary code can edit the document. Its execution budget remains 60 seconds; the initial wait is 50 seconds. The local Node/Python SDK has its own direct-call lifecycle and does not return MCP operation IDs. For unknown outcomes follow [execution recovery](execution/instructions.md#errors-and-timeout).
