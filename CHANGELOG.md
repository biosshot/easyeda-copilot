# Changelog

## Unreleased

### Release automation

- Wait for the tested npm version and SHA-512 integrity to become visible before publishing its MCP Registry entry.
- Retry temporary registry/network failures and npm propagation delays, verify the active published manifest, and reconcile already accepted writes without duplicating publication.
- Recover partially published releases from the original tag's CI archives after verifying all eight integration gates; preserve the tag and publish the full changelog as GitHub release notes.

## 1.3.0 - 2026-09-26

### CLI and local SDK

- Add `easyeda-copilot-cli` with daemon IDs, `start`, `status`, tool discovery, schema help, tool calls and `stop`/`stop --force`.
- Support omitted arguments as `{}`, JSON files, inline JSON and raw MCP responses. CLI daemons retain independent EasyEDA window selection and coexist with stdio MCP through the existing local bridge.
- Cancel abandoned CLI requests when their calling process closes; keep registered managed operations available for explicit recovery or cancellation.
- Add local standalone skill builds derived from the compiled MCP package and the same documentation: lightweight builds install production dependencies from npm, while optional bundled builds include platform-specific native dependencies.
- Give Node.js SDK connections one automatic checkpoint scope for the script, with an explicit opt-out. Explicit scopes can share that baseline, and closing the session releases the scope.
- Report extension/runtime version mismatches through CLI and MCP diagnostics, and limit optional version diagnostics to ten seconds so they cannot block a tool result indefinitely.

### MCP operations and editor execution

- Add explicit effect annotations to all exposed tools, distinguishing document mutations, read-only inspection, checkpoint snapshots and session selection.
- Run schematic extraction/beautification, PCB assembly, designator annotation and arbitrary JavaScript as discoverable managed mutations. Quick results include `operation_id`; slower calls return an operation that can be waited on.
- Add `list_operations` to recover IDs and target metadata after an interrupted initial wait. Retain `wait_operation`, `cancel_operation` and `apply_operation` for observing, cancelling or applying prepared work.
- Bind operations and application to their original EasyEDA instance and document; reject changes of target and share one application execution between concurrent callers.
- Separate cancellation of an MCP wait from cancellation of its registered operation. Propagate direct request aborts and timeouts to the matching editor command; use `cancel_operation` to stop managed work cooperatively.
- Unify MCP, CLI, SDK and extension command budgets: 120 seconds for ordinary commands, 300 seconds for long editor commands, 60 seconds for JavaScript and a 50-second initial managed-mutation wait.
- Bound the extension command queue, reject expired queued commands, release the queue after timeout and suppress late success replies from abandoned work.
- Add cancellation checks throughout schematic/PCB assembly, designator annotation and checkpoint saving to stop subsequent mutation steps after an abort.
- Keep checkpoint save/restore as direct commands and reuse the shared checkpoint and DRC handling paths.
- Rename `get_current_page_schematic_groups` to `get_schematic_groups`; current-page and full-schematic inspection use the same tool with `get_full_schematic_groups`.
- Refresh the connected project name and extension version in heartbeat metadata. Tolerate incomplete board-to-schematic/PCB links when reading project trees.

### Component libraries and symbol previews

- Accept library-qualified EasyEDA parts as `{ uuid, libraryUuid }` alongside legacy LCSC UUIDs, and expose library discovery through `library_list`.
- Preserve the original library reference on placed components and recover public device references from project-local device metadata when reading an existing design.
- Default omitted circuit modification lists to empty arrays or `null`, so callers can submit only the requested changes; synchronize MCP schemas with extension handling.
- Add automatic local PNG previews for components with ambiguous pin names. Skip single-pin parts, ordinary two-pin resistors, simple inductors/ferrites/fuses and components whose pin names are clear; capacitors are not exempt.
- Return preview file paths instead of attaching images to every search response. Report preview errors alongside the component without dropping the search result.
- Add `preview_component` for explicit symbol inspection, including multipart symbols. Move pin labels outside leads, separate vertical names from numbers, reserve room between columns and prevent PNG enlargement beyond symbol scale.

### Schematic assembly, ports and drawing sheets

- Preserve the base designator and section identity of multipart source components during assembly.
- Render per-connection `in`, `out` and `bi` net ports, preserve existing port styles during readback/reassembly and use bidirectional ports by default, with legacy fallback.
- Exclude net symbols from detached-component pin recovery and remove obsolete replacement short symbols that no longer have connections.
- Finalize source-assembled components after placement and preserve coordinate conventions for cached templates, including components whose source Y coordinate is zero.
- Force missing cross-page signal ports during extraction and beautification. Treat cross-page lookup as an optional hint so a lookup failure does not stop current-page assembly.
- Report unresolved port counts and actionable pin/net details, keep error messages bounded and tolerate schematic save failures without obscuring the assembly result.
- Beautify named-wire port stubs with consistent preferred lengths, label-dependent spacing, inward label alignment and short-stub/vertical fallbacks.
- Automatically choose the smallest standard drawing sheet that fits the layout inside its frame and title block, allowing both shrinking and growth. Preserve custom sheet sizes when they already fit.
- Respect cancellation while replacing a drawing sheet and avoid continuing assembly after a cancelled resize.
- Add an execution example for replacing a custom drawing sheet and update schematic/operation guidance for these workflows.

### PCB placement, backend and release validation

- Update the pinned `eda-copilot-backend` dependency from 0.2.0 to 0.3.5; retain `eda-copilot-router` 0.3.2.
- Include backend improvements to independent schematic block placement, deterministic refinement, long-link routing, short connectors, dense pin/wire-label clearance, resistor pull banks, passive ladders and power branches.
- Enable parallel PCB subtree placement and complete native Rust post-placement refinement, with one native call for the search and parallel candidate evaluation.
- Cap process/native placement concurrency at half available CPUs and at most eight workers; environment overrides can reduce concurrency.
- Adapt native refinement to component/pad complexity with a 3–16-pass limit and a cooperative 30-second budget, retaining the best completed placement.
- Hide Windows console windows for placement workers through backend 0.3.5.
- Align installed-package preview regressions with the selective-preview policy; run component preview and optional cross-page lookup tests in the mandatory MCP check.
- Keep the timeout regression fixture alive on Node 20 while its deliberately unresponsive version check waits for an unreferenced abort timer.
- Synchronize root, extension, MCP and registry metadata at 1.3.0 and verify published dependency versions, extension builds and isolated MCP installation before publication.

## 1.2.0 - 2026-09-19

- Use separately published backend and router packages, with native backend binaries and local dependency switching for development.
- Move the editor extension into its own workspace while retaining root build commands.
- Include the root README, changelog, logo and banner metadata in the packaged
  `.eext` archive for extension registries.
- Add checkpoint-backed `execute_js` with local input files and bounded tool-result artifacts.
- Add local Node.js and Python EasyEDA proxy SDKs with checkpoint scopes, unit helpers and Shapely geometry examples.
- Add named checkpoints without migrating existing checkpoint records.
- Add native PCB preview, compact net inspection and DRC output, routing progress, refill verification and conservative native pad-arc handling.
- Add compact read-only schematic group inspection for the current page or complete schematic, including multipart components, partial-result diagnostics and ground-island filtering.
- Add standalone SPICE simulation and DataSheets skills and adapt the EasyEDA API reference for Copilot.
- Verify packaged MCP installation, documentation and simulations across Windows, Linux and macOS with Node 20/24.
- Select native AGND/PGND symbols by net name, keep their cached templates separate, and handle missing ground pins safely.
- Reject document-specific MCP commands early when the required schematic or PCB document is not open.

## 1.1.9 - 2026-09-08

- Use native EasyEDA ground and power symbols, and native net ports in desktop mode, with consistent rotations when creating and cloning schematic components.
- Preserve global net names from flags and ports when reading schematics, including names absent from wire attributes.
- Refine the schematic modification guide and refresh the English, Russian, and Chinese documentation with new examples and demos.

## 1.1.8 - 2026-09-01

- Improved automatic PCB component placement and added `refineGroup` support for controlled post-placement refinement.
- Improved autorouting stability and integrated the npm-published Copilot Router, significantly expanding routing support with differential pairs, stackup-aware impedance-controlled traces, coplanar gaps, and matched-length groups.
- Added topology-aware schematic patterns for more consistent component placement and cleaner generated schematics.
- Expanded and refined the MCP skill documentation, improving the reliability and quality of schematic, PCB placement, routing, and general MCP workflows.
