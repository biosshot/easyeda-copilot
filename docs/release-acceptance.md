# EasyEDA Copilot pre-release acceptance checklist

Run this checklist for each release candidate. Copy the [report template](release-acceptance-reports/TEMPLATE.md) to `docs/release-acceptance-reports/<version>-<YYYY-MM-DD>-<short-sha>/report.md`. Keep inputs, screenshots, tool responses, and logs under `evidence/` in that directory or link to durable CI artifacts. Remove secrets and unrelated project data from evidence.

When a CLI response gives a file path for a large result, read the referenced file and validate its structure before counting or comparing records.

## 1. Identify the release candidate

- [ ] Record the commit, MCP/CLI and `.eext` versions, artifact checksums, resolved backend/router versions, EasyEDA Pro version, OS, and Node version.
- [ ] Record the candidate's integration CI results and any uncovered platforms. The [integration workflow](../.github/workflows/integration.yml) covers dependency, extension, MCP, package, release metadata, and build checks.
- [ ] Build a fresh local skill from the candidate checkout with `npm ci` and `npm run build:skill`. For a self-contained build on the test platform, package the compiled MCP with `npm run pack:skill --workspace=easyeda-copilot-mcp -- --bundled`. Follow the [skill build and setup guide](../mcp/docs/install-guide.md) for the selected distribution. Verify `skill/build-info.json` and record the distribution, platform, version, and resolved dependencies.
- [ ] Install the matching candidate `.eext` with external interaction enabled. Run the generated `skill/scripts/easyeda-copilot-cli.js` with Node, start the daemon, retain its ID, and check `status` and `tools list`. Use this launcher for all live tool calls in both modes. Stop the test daemon after the run and record the result. The skill and the stdio MCP entry point use the same MCP server factory.
- [ ] Prepare a two-page low-voltage test circuit with a connector, passives, and two instances of a verified library device with at least two separately placeable units. Keep all units of each physical package, including any separate power unit, on a single page. Include a cross-page signal between components. Record exact component and library IDs, unit names, expected pin-to-net mapping, expected physical designators, and PCB footprint/pad mapping. Use the same circuit, expected connectivity, and board constraints for both modes.

## 2. Run the same live checks in both editor modes

Run sections 3–6 from a fresh disposable project in **Full Online**, then repeat them from a separate fresh disposable project in **Half Offline**. The user switches modes in EasyEDA. Finish pending operations and save evidence before the handoff. Resume when the user confirms the switch and the bridge reconnects to the intended instance. Record the mode from the editor or a read-only `eda.sys_Environment` check (`isOnlineMode()`, `isHalfOfflineMode()`, `isOfflineMode()`) and verify the active project UUID before editing.

Use the libraries normally available in each mode. For library access, record which source supplied the fixture component and whether it required a local import or cache. If a tool or input is expected to be unavailable in a mode, cite the candidate's documented behavior, exercise the unavailable path, and verify that the response explains the limitation and leaves the document consistent. Treat unexpected gaps as failures or blockers.

## 3. Create and verify the schematic

- [ ] Exercise project creation with `create_doc` and open the disposable project. If the editor's experimental project API is unavailable, record its response and create the disposable project in the editor to continue the run. Exercise project and document discovery, create and rename the schematic and pages, and verify the resulting tree and active document. Test deleting a separate throwaway page and confirm the fixture pages survive.
- [ ] List libraries, search for the exact fixture parts, and preview the multi-part device. Verify the selected library, symbol units, and footprint against the fixture. Include a search with no match and verify the reported result.
- [ ] Build the schematic in EasyEDA using resolved parts. Read it back per page and across the full schematic. Verify pin numbers, nets, cross-page connectivity, and functional grouping against the fixture. Extract and beautify each page, then compare component identities and connectivity before and after. Save and reopen to verify persistence. Exercise `sync_current_document` on a disposable page and verify its identity and contents after refresh.
- [ ] **Multi-part regression.** Assemble the units of one physical package together on the same page and give them different signal nets. Where the device has a separate power unit, place and wire it on that page too. Exercise `annotate_designators` in `preserve` and `resequence` modes, with a duplicate or unnumbered designator in the fixture. After annotation, beautification, and reopen, verify that all units share the same physical designator, retain their individual unit identifiers and pin numbers, and preserve all nets and power pins. Verify that a second instance of the same library device has a different physical designator and its own unit-to-net mapping. Treat splitting a single package across pages as exploratory until end-to-end support is verified.

## 4. Create, place, and route the PCB from that schematic

- [ ] Create the PCB and link it to the schematic through a BOARD document. Verify the UUIDs in the project tree. Open the PCB and call `import_pcb_changes`. Have the user confirm the native import dialog before continuing.
- [ ] Verify **one footprint per physical multi-part package**, with a unique reference per package and all unit and power nets on the expected physical pads. Record the initial PCB pad readback.
- [ ] **User review of schematic-to-PCB changes.** On the existing PCB, capture the baseline before making one scoped schematic edit with a known expected PCB change. Run `import_pcb_changes`. The user reviews the proposed change list in EasyEDA and confirms the import. Compare the PCB before and after and show the user the actual changes. The user verifies that the PCB reflects the schematic edit and that the changes are limited to the affected footprints, pads, nets, and any directly affected copper. Verify that unrelated footprint identities, placement, routing, and board geometry are preserved and that the import creates no duplicate footprints. Record the expected change, actual change, and user's verdict in both modes.
- [ ] Read stack layers, footprint dimensions, and initial DRC rules. Validate the placement DSL with a valid fixture and a deliberately invalid constraint. Run placement, verify that its preview leaves the live PCB untouched, and apply the completed layout. Check outline, component count, orientation, clearances, and intended preservation against PCB readback and top/bottom previews.
- [ ] Route the fixture using the router DSL and rebuild the required copper pours. Record operation IDs, outcomes, elapsed times, and any repairs. Verify the live board with component and net inspection, current rules, filled copper, and native DRC. The fixture must have zero unintended opens or shorts and zero unresolved DRC violations. Save and reopen the PCB and verify connectivity and key geometry again.
- [ ] Run a scoped routing pass on the saved board and verify that copper outside the selected scope survives. Where the release changes routing, placement, or copper handling, also rerun a representative existing project that exercises the changed behavior. Include any workaround in the report and retain the original tool result.
- [ ] Place the newly imported footprint on the existing routed board. Compare before and after source snapshots for the board outline, existing footprints, tracks, vias, and pour definitions. Record the new footprint's pose and native DRC findings. Report any connections still open after placement.

## 5. Exercise recovery and error paths

- [ ] Save and list an explicit checkpoint. Use `execute_js` for a read and a small, scoped edit on a disposable document. Restore the checkpoint and verify the baseline and document identity by readback. Where a supported previous release created checkpoints, verify that the candidate can list and restore one from that release in the same supported editor context.
- [ ] Run both shipped [Node.js and Python SDKs](../mcp/docs/execution/local-sdk.md) against the live editor in each mode. Use the candidate's packaged SDK with the running broker. Bind each session to the expected instance and document, read native primitives through the proxy, verify the result against the fixture, exercise binary transfer and checkpoint scope, then close each session. Record both results separately from the native `execute_js` tool.
- [ ] Observe a managed operation via `list_operations` and `wait_operation` through its terminal result. Cancel a disposable running operation, wait for terminal status, and read back the affected document. Test `apply_operation` with a retained result after a recoverable application failure or exercise its already-applied path on a supported result. Verify that applying does not rerun the calculation or duplicate edits. Use a controlled fixture for failure injection when needed.
- [ ] Check a wrong document or unavailable instance and an invalid tool input. Verify clear errors, no unintended changes, and successful subsequent calls after reconnecting or reopening the correct document. Exercise selection with a second instance where supported, and verify target UUIDs before and after selection.

## 6. Account for every available tool

In each mode, save the generated skill's complete CLI `tools list` output. In the report, create one row per tool in the union of both inventories and record the result and evidence for each mode. Include tools expected in the candidate but missing from discovery. Exercise each discovered tool with a mode-appropriate input. A workflow call can count if the tool's expected response and side effects are checked explicitly. Add cases for tools introduced by the candidate and reconcile the total before sign-off.

| Area | Current MCP tools to cover | Case |
| --- | --- | --- |
| Instance and project discovery | `list_easyeda_instances`, `select_easyeda_instance`, `get_all_projects`, `get_current_project_info` | 2, 3, 5 |
| Document lifecycle | `open_document`, `create_doc`, `modify_name`, `save_doc`, `sync_current_document`, `delete_doc` | 3, 4 |
| Libraries | `library_list`, `component_search`, `preview_component` | 3 |
| Schematic readback and edits | `get_schematic`, `get_schematic_groups`, `extract_circuit_on_current_page`, `beautify_schematic_on_current_page`, `annotate_designators` | 3 |
| PCB import and placement | `import_pcb_changes`, `get_pcb_stack_layers`, `get_pcb_component_sizes`, `validate_pcb_dsl`, `make_pcb_layout`, `assemble_pcb_layout_on_current_pcbdoc` | 4 |
| PCB routing, inspection, and DRC | `run_pcb_router_dsl`, `preview_pcb`, `get_current_pcb`, `inspect_net`, `inspect_component`, `get_pcb_drc_rules`, `check_pcb_drc` | 4 |
| Checkpoints and execution | `save_checkpoint_for_current_page`, `list_checkpoints`, `restore_checkpoint_for_current_page`, `execute_js` | 2, 5 |
| Managed operations | `list_operations`, `wait_operation`, `cancel_operation`, `apply_operation` | 5 |

Use the [workflow guide](../mcp/docs/workflow.md) for schematic-to-PCB sequencing and the [operations guide](../mcp/docs/operations.md) for cancellation and recovery. Run the candidate CI/package tests for shipped helpers outside MCP tool discovery, such as the SDK, SPICE, and datasheets. For a release that changes a helper, also exercise its documented entry point in each applicable live mode and record the evidence.

## 7. Decide and archive

- [ ] Record `Pass`, `Fail`, `Blocked`, or `N/A` for each case and tool in each mode. Use `N/A` only for an established mode or platform limitation and cite evidence. Missing coverage stays `Blocked`.
- [ ] Record `Go` only when the candidate's automated gates and both live mode runs pass all applicable checks, including schematic-to-PCB and multi-part integrity. Record `No-Go` for a required failure, blocker, or unverified required case. A board repaired through a workaround can pass final DRC while the original tool case remains failed.
- [ ] Record defects with a minimal reproduction, mode, affected build, observed versus expected result, and evidence. Retest fixes on the new candidate and link its report to the previous run. Save the report before proceeding to [publication](releasing.md).
