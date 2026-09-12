# Changelog

## 1.2.0 - Unreleased

- Use separately published backend and router packages, with native backend binaries and local dependency switching for development.
- Move the editor extension into its own workspace while retaining root build commands.
- Add standalone SPICE simulation and DataSheets skills and adapt the EasyEDA API reference for Copilot.
- Verify packaged MCP installation, documentation and simulations across Windows, Linux and macOS with Node 20/24.
- Select native AGND/PGND symbols by net name, keep their cached templates separate, and handle missing ground pins safely.

## 1.1.9 - 2026-09-08

- Use native EasyEDA ground and power symbols, and native net ports in desktop mode, with consistent rotations when creating and cloning schematic components.
- Preserve global net names from flags and ports when reading schematics, including names absent from wire attributes.
- Refine the schematic modification guide and refresh the English, Russian, and Chinese documentation with new examples and demos.

## 1.1.8 - 2026-09-01

- Improved automatic PCB component placement and added `refineGroup` support for controlled post-placement refinement.
- Improved autorouting stability and integrated the npm-published Copilot Router, significantly expanding routing support with differential pairs, stackup-aware impedance-controlled traces, coplanar gaps, and matched-length groups.
- Added topology-aware schematic patterns for more consistent component placement and cleaner generated schematics.
- Expanded and refined the MCP skill documentation, improving the reliability and quality of schematic, PCB placement, routing, and general MCP workflows.
