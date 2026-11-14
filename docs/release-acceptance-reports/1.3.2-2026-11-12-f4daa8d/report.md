# EasyEDA Copilot release acceptance report

- Candidate: 1.3.2, commit `f4daa8dfc84d74417ba5ddc8664504edbbd17e59` (2026-11-12 run).
- Environment: Windows x64, Node 26.5.0, npm 12.0.1. The open editor window reports EasyEDA Pro 3.2.209.
- Intended release dependencies: `eda-copilot-backend@0.4.0`, `eda-copilot-router@0.3.2`.
- Candidate extension: `build/dist/easyeda-copilot_v1.3.2.eext`, SHA-256 `c31c6bcf41cdd7591a78281904cf29ff44590675977ce9dafad4af5467fa82c8`.
- Release decision: **Go, approved by the user**. The user accepted the recorded findings, including the native EasyEDA API failure when creating a project in Half Offline. The final Full Online beautify retest passed. Candidate CI and the exact installed extension archive remain unverified.

## Candidate checks

| Check | Status | Evidence |
| --- | --- | --- |
| Extension build | Pass | Built the candidate archive from the current checkout, with 45 entries. |
| Extension automated tests | Pass | [236 passed, 0 failed](evidence/extension-tests.log). |
| Initial release check in development checkout | Fail | [Release check log](evidence/release-check.log). The installed backend was a junction to a neighboring checkout missing the Windows native module. Bundled skill packaging from that dependency also failed. |
| Clean release dependencies | Pass | `npm ci` in a detached worktree of the same commit, followed by the [release check](evidence/release-check-clean.log). |
| Local skill build and CLI start | Pass | [Build](evidence/skill-build.log), [build metadata](evidence/skill-build-info.json), and [installation](evidence/skill-install.log). The lightweight build has no installation blockers. The generated CLI started on the real Windows session. |
| Extension registration | Pass for connectivity | [Instance registration](evidence/editor-registration.json) reports extension 1.3.2. User confirmation of the newly built archive is needed to distinguish it from other builds with the same version. |
| Local MCP integration and clean consumer package | Pass | [MCP checks](evidence/mcp-check-native.log) passed outside the Windows sandbox after its symlink restriction blocked the first attempt. [Package checks](evidence/package-check.log) passed with mock EasyEDA and a clean consumer. The two ngspice runtime cases were skipped because ngspice was unavailable. |
| Integration CI for this candidate | Pending | |

## Live acceptance

| Check | Full Online | Half Offline |
| --- | --- | --- |
| Candidate bridge, editor mode, and CLI inventory | Pass for connectivity and discovery. [Mode readback](evidence/full-editor-mode.json) confirms Full Online, editor 3.2.209. [CLI inventory](evidence/cli-tools-connected.json) contains 39 tools. | User switched modes. [Native readback](evidence/half-mode-and-metadata-warnings.json) confirms Half Offline, editor 3.2.209. [CLI inventory](evidence/half-cli-tools.json) captured after reconnect. |
| Disposable project and schematic | [Project creation](evidence/full-create-project.json) and both schematic pages passed. [Full enumeration](evidence/full-enumeration-recheck-decoded.json) included the fixture among 74 projects across two teams. | The native project-creation API [failed](evidence/half-create-project.json). The user chose a new [Board3](evidence/half-acceptance-board.json) in the existing local project. Both fixture pages assembled. |
| Same-page multi-part package | [Readback](evidence/full-verified-schematic.json) matched 32 pins and confirmed four sections across two packages after rebuild and annotation. | [Schematic readback](evidence/half-verified-schematic.json) matched 32 pin connections. The four sections preserved their identities through rebuild and annotation. |
| PCB import and pad map, placement, routing, and native DRC | [Import](evidence/full-first-import-verification.json) matched 32 pads. The approved [44 × 30 mm placement](evidence/full-apply-placement.json) was applied. Initial routing produced [six isolated GND islands](evidence/full-routing-native-drc.json). DRC was [clean after refill and reopen](evidence/full-routed-final-drc.json). | [Import](evidence/half-first-import-verification.json) matched all 32 pads. Placement matched the approved preview. Initial routing produced six isolated GND islands. Native DRC was [clean after refill and reopen](evidence/half-routed-final-drc.json). |
| User review of the minimal PCB changes after a scoped schematic edit | User confirmed the import. [Source comparison](evidence/full-repeat-import-verification.json) found one new C3 footprint and its metadata and pads. | The user confirmed the import. [Source comparison](evidence/half-repeat-import-verification.json) found only the new C3 footprint, attributes, and pad assignments. |
| Checkpoint and operation recovery | [Restore](evidence/full-recovery-readback.json) removed the temporary marker. [Cancellation](evidence/full-cancel-placement-terminal.json) and [reapplication](evidence/full-reapply-completed-router.json) preserved the PCB. | [Restore](evidence/half-recovery-readback.json) removed the marker. Wrong-document restore was rejected. [Cancellation and repeated application](evidence/half-controls-source-verification.json) preserved PCB records. |
| Scoped routing | [VREF-only](evidence/full-route-vref-only-terminal.json) reported zero open nets in scope and added no copper. Whole-board DRC still showed the open connections of the new C3. | [VREF-only](evidence/half-route-vref-only-terminal.json) passed native DRC with zero open nets and added no copper. |
| Placement of a new footprint on routed copper | The C3 solver returned a placement quality warning. The [targeted move](evidence/full-c3-placement-verification.json) preserved existing placement and copper. Native DRC after refill reported the open VCC connection to C3. | [C3 placement](evidence/half-c3-placement-verification.json) preserved 86 trace, via, pour-definition, and outline records. Native DRC after refill reported only the open VCC connection to C3. |
| Native JavaScript and live SDKs | Native writes passed. The stock SDK scripts hit a [native DOCUMENT-layer line error](evidence/full-native-document-line-probe.json). The targeted [Node.js placement](evidence/full-sdk-place-c3-result.json) and [Python refill](evidence/full-sdk-python-read-result.json) passed. | [Native write](evidence/half-recovery-edit.json), [Node.js write](evidence/half-sdk-node-write-result.json), and [Python write](evidence/half-sdk-python-write-result.json) passed. Node.js also placed C3 and Python refilled both pours. |

## Issue regressions

| Issue | Candidate evidence | Live verification |
| --- | --- | --- |
| [#75](https://github.com/biosshot/easyeda-copilot/issues/75) | Fix commit `12b265a` is present. The extension suite passed its 40 MB synthetic history case (ordinary saves do not scan history and paged lists load only selected records), AppDB compatibility, and rollback/restore cases. | Full Online [save](evidence/full-save-baseline.json), [first](evidence/full-checkpoint-offset-0.json) and [second](evidence/full-checkpoint-offset-1.json) one-record list pages, and [restore](evidence/full-restore-checkpoint.json) succeeded. Half Offline saved SDK checkpoints and read [offset 0](evidence/half-checkpoints-page0.json) and [offset 1](evidence/half-checkpoints-page1.json). [Restore on Board3](evidence/half-recovery-restore.json) also passed. The reporter's multi-GB macOS renderer scenario has not been reproduced in this Windows run. |
| [#79](https://github.com/biosshot/easyeda-copilot/issues/79) | Fix commit `7ef51f5` is present. [Mock project/document tool checks](evidence/mcp-project-tools.log) passed. | Half Offline enumeration [returned the active local project](evidence/half-issue79-project-list.json), and the [current project read](evidence/half-current-project-initial.json) succeeded. The native log returned zero metadata-refresh warnings [initially](evidence/half-mode-and-metadata-warnings.json) and [after additional refresh cycles](evidence/half-metadata-recheck.json). [Enumeration with PCB3 open](evidence/half-issue79-pcb-active.json) passed, with [zero warnings after two refresh intervals](evidence/half-issue79-pcb-log-end.json). |

GitHub issue status was left untouched.

The Full Online fixture PCB was [saved](evidence/full-c3-placement-save.json) with C3 placed.

## Half Offline project creation diagnosis

EasyEDA Pro 3.2.209 on Windows returned `undefined` from native `DMT_Project.createProject()`. Copilot forwards its documented name, team, folder, and description arguments to this call and converts a falsy result into `EasyEDA failed to create the project`. The same Copilot route [returned a project UUID in Full Online](evidence/full-create-project.json).

| Path | Half Offline result |
| --- | --- |
| MCP `create_doc` | [Generic failure](evidence/half-create-project.json) with a valid ASCII project slug. |
| Direct native `execute_js` | [Returned undefined](evidence/half-native-create-project-probe.json) with defaults and with the explicitly selected team that enumerated the active local project. [Returned undefined](evidence/half-create-with-explicit-format.json) for both `eprj2` and `eprj3` as the seventh argument. No exception or UUID. |
| Direct Node.js SDK proxy | [Returned undefined](evidence/half-sdk-create-project-result.json) with a unique ASCII slug. No matching creation errors appeared for the queried log phrases. |
| Node.js SDK file import | [Imported the repository EPRO](evidence/half-sdk-local-import.log) to an isolated local folder as `.eprj2` and [opened it by UUID](evidence/half-open-imported-project.json). The imported UUID [was absent from enumeration](evidence/half-imported-project-enumeration.json). |

The current [vendor API reference](https://prodocs.easyeda.com/en/api/reference/pro-api.dmt_project.createproject.html) documents `undefined` as creation failure and describes the optional format argument for offline modes, with `eprj3` as the default. The checked-in declaration lists six arguments. Neither explicit format resolved the failure on the installed client. The [vendor desktop FAQ](https://prodocs.easyeda.com/en/faq/client/) describes local project creation through the editor. The native failure is reproducible, while its internal cause and release history remain unverified. Computer Use did not approve access to the editor window, so the equivalent UI action was not tested.

## Half Offline acceptance on Board3

The user chose a new BOARD in the currently open local project. `create_doc({doc_type: "board"})` [created Board3 with a linked schematic and PCB](evidence/half-acceptance-board.json). An initial rename of the second schematic page returned `success: false`. [The retry after opening the page](evidence/half-rename-interfaces-retry.json) succeeded.

- Both fixture pages assembled using the same part UUIDs as in Full Online. [Readback](evidence/half-verified-schematic.json) matched all 32 pin connections across 10 physical components after beautification, annotation, save, and refresh. The four MAX942 sections preserved their section names and two physical IDs.
- [Native JavaScript](evidence/half-recovery-edit.json) created a temporary schematic marker. [Checkpoint restore](evidence/half-recovery-restore.json) succeeded, and [readback](evidence/half-recovery-readback.json) verified that the marker was absent on the same page. This completes the small live save, list, and restore check for #75 in Half Offline. The multi-GB macOS case remains untested.
- Both packaged SDKs passed live native writes and readback, removed their temporary markers, and preserved the original text IDs. Binary exchange and checkpoint scope also passed for [Node.js](evidence/half-sdk-node-write-result.json) and [Python](evidence/half-sdk-python-write-result.json).
- For #79, the current project was readable with PCB3 active and `get_all_projects` [included that project](evidence/half-issue79-pcb-active.json). The native log had zero metadata-refresh warnings at the [start](evidence/half-issue79-pcb-log-start.json) and [end](evidence/half-issue79-pcb-log-end.json) of a 23.75-second observation, covering two 10-second refresh intervals.
- The user confirmed the first import. [PCB readback](evidence/half-first-import-verification.json) matched all 32 pads on 10 unique footprints, including one eight-pad footprint per MAX942. [Placement and quality checks](evidence/half-placement-terminal.json) passed. The Half Offline preview matched the approved Full Online preview byte for byte, and the applied PCB matched its outline and component positions.
- The [first routing pass](evidence/half-routing-terminal.json) connected all eight selected nets and rebuilt two pours. Native DRC again found six isolated GND islands. After [disabling island retention and refilling](evidence/half-remove-ground-islands-result.json), the saved and reopened board returned [zero native DRC findings](evidence/half-routed-final-drc.json).
- [Reapplication](evidence/half-reapply-completed-router.json) returned `already_applied`. [The VREF-only pass](evidence/half-route-vref-only-terminal.json) left zero open nets and added no copper. [Cancellation](evidence/half-cancel-placement-terminal.json) stopped a separate placement solve. [Comparison](evidence/half-controls-source-verification.json) verified that the 313 PCB source records matched the baseline after all three checks.
- The user confirmed the C3-only import. [Source comparison](evidence/half-repeat-import-verification.json) found one new footprint, three associated attributes, two pad assignments, and zero modified or removed existing records. The schematic reported [a drawing-frame overlap](evidence/half-add-c3.json).
- The [C3-only solve](evidence/half-c3-placement-terminal.json) returned `Placement.ok: true` and `Quality.ok: false`. A [targeted Node.js SDK move](evidence/half-sdk-place-c3-result.json) placed C3 at (13.75, 4.25) mm. The [Python SDK](evidence/half-sdk-refill-result.json) rebuilt both GND pours. [Source comparison](evidence/half-c3-placement-verification.json) verified preservation of the other components, existing traces and vias, outline, and pour definitions. The [final DRC](evidence/half-c3-after-refill-drc.json) reported only the open VCC connection to C3, which was intentionally left unrouted for the placement check.
- The [wrong-document restore](evidence/half-reject-wrong-document.json) was rejected. The [invalid open request](evidence/half-invalid-open.json) returned input validation. [Deletion](evidence/half-delete-verification.json) removed only the disposable page. PCB3 was [saved](evidence/half-final-save.json), and the test daemon [stopped normally](evidence/acceptance-cli-stop.json).

## Tool coverage

| Tool | Full Online | Half Offline | Note |
| --- | --- | --- | --- |
| `list_easyeda_instances` | [Pass](evidence/editor-registration.json) | [Pass](evidence/half-list-instances.json) |  |
| `select_easyeda_instance` | [Pass](evidence/full-select.json) | [Pass](evidence/half-reselect-current.json) |  |
| `get_all_projects` | [Pass](evidence/full-enumeration-recheck-decoded.json) | [Pass](evidence/half-issue79-pcb-active.json) | The Full Online CLI response pointed to a file containing the complete project tree. |
| `get_current_project_info` | [Pass](evidence/full-project-after-import.json) | [Pass](evidence/half-acceptance-board.json) |  |
| `open_document` | [Pass](evidence/full-open-pcb.json) | [Pass](evidence/half-open-board3-pcb.json) |  |
| `create_doc` | [Pass](evidence/full-create-project.json) | [Partial](evidence/half-create-board.json) | Project creation failed in Half Offline. Board and page creation passed. |
| `modify_name` | [Pass](evidence/full-rename-page1.json) | [Pass after retry](evidence/half-rename-interfaces-retry.json) | Half Offline rename of a newly created page succeeded after opening it. |
| `save_doc` | [Pass](evidence/full-c3-placement-save.json) | [Pass](evidence/half-final-save.json) |  |
| `sync_current_document` | [Pass](evidence/full-routed-reopen.json) | [Pass](evidence/half-routed-reopen.json) |  |
| `delete_doc` | [Pass](evidence/full-project-after-delete.json) | [Pass](evidence/half-delete-verification.json) |  |
| `library_list` | [Pass](evidence/full-library-list.json) | [Pass](evidence/half-library-list.json) |  |
| `component_search` | [Pass](evidence/full-search-max942.json) | [Pass](evidence/half-search-max942.json) |  |
| `preview_component` | [Pass](evidence/full-preview-max942.json) | [Pass](evidence/half-preview-max942.json) |  |
| `get_schematic` | [Pass](evidence/full-verified-schematic.json) | [Pass](evidence/half-verified-schematic.json) |  |
| `get_schematic_groups` | [Pass](evidence/full-schematic-groups-after.json) | [Pass](evidence/half-schematic-groups-after.json) |  |
| `extract_circuit_on_current_page` | [Pass with warning](evidence/full-add-c3.json) | [Pass with warning](evidence/half-add-c3.json) | C3 connectivity was correct. Both runs reported a drawing-frame overlap. |
| `beautify_schematic_on_current_page` | [Pass](evidence/full-final-beautify-verification.json) | [Pass](evidence/half-beautify-amplifiers.json) | The Full Online retest included C3 and verified its connections and the identities of all units on the rebuilt page after reopening. |
| `annotate_designators` | [Partial](evidence/full-annotate-resequence.json) | [Partial](evidence/half-annotate-resequence.json) | Resequencing and preserving already-valid designators passed. A deliberately duplicate or unnumbered live designator was not exercised. |
| `import_pcb_changes` | [Pass](evidence/full-repeat-import-verification.json) | [Pass](evidence/half-repeat-import-verification.json) |  |
| `get_pcb_stack_layers` | [Pass](evidence/full-pcb-layers.json) | [Pass](evidence/half-pcb-layers.json) |  |
| `get_pcb_component_sizes` | [Pass](evidence/full-pcb-sizes.json) | [Pass](evidence/half-pcb-sizes.json) |  |
| `validate_pcb_dsl` | [Pass](evidence/full-validate-invalid.json) | [Pass](evidence/half-validate-invalid.json) |  |
| `make_pcb_layout` | [Partial](evidence/full-c3-placement-terminal.json) | [Partial](evidence/half-c3-placement-terminal.json) | Full placement passed. The scoped C3 solve reported a legal placement with Quality.ok false. |
| `assemble_pcb_layout_on_current_pcbdoc` | [Pass](evidence/full-apply-placement.json) | [Pass](evidence/half-apply-placement.json) |  |
| `run_pcb_router_dsl` | [Fail](evidence/full-routing-terminal.json) | [Fail](evidence/half-routing-terminal.json) | Selected nets routed. Native DRC found six isolated islands in each mode before the native workaround. |
| `preview_pcb` | [Pass](evidence/full-final-preview-TOP.json) | [Pass](evidence/half-final-preview-TOP.json) |  |
| `get_current_pcb` | [Pass](evidence/full-pcb-c3-placed.json) | [Pass](evidence/half-final-pcb.json) |  |
| `inspect_net` | [Pass](evidence/full-ground-inspection.json) | [Pass](evidence/half-ground-inspection.json) |  |
| `inspect_component` | [Pass](evidence/full-u1-inspection.json) | [Pass](evidence/half-u1-inspection.json) |  |
| `get_pcb_drc_rules` | [Pass](evidence/full-pcb-rules.json) | [Pass](evidence/half-pcb-rules.json) |  |
| `check_pcb_drc` | [Pass](evidence/full-routed-final-drc.json) | [Pass](evidence/half-routed-final-drc.json) |  |
| `save_checkpoint_for_current_page` | [Pass](evidence/full-save-baseline.json) | [Pass](evidence/half-save-baseline.json) |  |
| `list_checkpoints` | [Pass](evidence/full-checkpoint-offset-1.json) | [Pass](evidence/half-checkpoints-page1.json) |  |
| `restore_checkpoint_for_current_page` | [Pass](evidence/full-restore-checkpoint.json) | [Pass](evidence/half-recovery-restore.json) |  |
| `execute_js` | [Pass](evidence/full-recovery-edit.json) | [Pass](evidence/half-recovery-edit.json) |  |
| `list_operations` | [Pass](evidence/full-operations-after-cancel.json) | [Pass](evidence/half-operations-after-cancel.json) |  |
| `wait_operation` | [Pass](evidence/full-routing-terminal.json) | [Pass](evidence/half-routing-terminal.json) |  |
| `cancel_operation` | [Pass](evidence/full-cancel-placement-terminal.json) | [Pass](evidence/half-cancel-placement-terminal.json) |  |
| `apply_operation` | [Pass](evidence/full-reapply-completed-router.json) | [Pass](evidence/half-reapply-completed-router.json) |  |

Both inventories contained the same 39 tools. See the [inventory comparison](evidence/half-cli-tool-parity.json).

## Full Online enumeration correction

The original summary counted a CLI file-reference response as a team node and reported zero projects. On EasyEDA Pro 3.2.209, [the direct native probe](evidence/full-enumeration-native-probe.json) returned 68 and 6 project UUIDs for the two visible teams. [Reading the complete get_all_projects JSON artifact](evidence/full-enumeration-recheck-decoded.json) returned the same team counts and included the acceptance fixture. The earlier summary files retain the erroneous counts for traceability.

## Final beautify retest

In Full Online, [beautify rebuilt Amplifiers with C3 present](evidence/full-final-beautify.json). After save and reopen, [comparison](evidence/full-final-beautify-verification.json) verified the same 11 physical components and all 34 pin-to-net assignments across both pages. The nine native units on Amplifiers retained their section names and IDs. C3 remained connected to VCC and GND. The tool reported 52.2% sheet space available, with the earlier frame-overlap warning resolved.

