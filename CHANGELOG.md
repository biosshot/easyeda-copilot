# Changelog

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
