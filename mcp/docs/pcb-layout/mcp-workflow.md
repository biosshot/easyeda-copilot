# PCB Layout MCP Workflow

For placement rules, examples, output format, and iteration rules see `instructions.md`.

`make_pcb_layout` reads a JavaScript DSL file and returns text with:

- the compact placement-only `pcb_tool_report` JSON from the layout server;
- a `Run report` JSON object with `layoutId` and `previewImagePath`.

`make_pcb_layout` does not route tracks, create copper polygons, or add stitching vias. Use `previewImagePath` for visual inspection after every non-trivial run. Do not assemble intermediate attempts.

<MCP_PCB_ASSEMBLY_WORKFLOW>
Only assemble a layout after verifying the EasyEDA project structure:

1. Call `get_current_project_info`.
2. Confirm the schematic used for layout belongs to a BOARD item with a PCB document.
3. Call `open_document` with that PCB UUID.
4. Call `assemble_pcb_layout_on_current_pcbdoc` with the `layoutId` returned by `make_pcb_layout`.
5. If routing is required, call `run_auto_route_on_current_pcbdoc` on the same opened PCB document or use EasyEDA v3 routing tools.

Do not assemble for a standalone schematic, an unrelated PCB, or an ambiguous project structure.
</MCP_PCB_ASSEMBLY_WORKFLOW>

<MCP_PCB_AUTOROUTE_WORKFLOW>
Use `run_auto_route_on_current_pcbdoc` after placement assembly when the board should be routed from the current EasyEDA PCB document.

The tool exports EasyEDA autoroute JSON, runs the bundled/custom router on the MCP side, imports the routed JSON back into EasyEDA, then can rebuild GND copper pours and add GND SUTURE vias.

Defaults are intentional:

- `ignore_nets: ["GND"]`: GND is served by copper pour/stitching, not routed as tracks.
- `pour_gnd: true`: creates full-board GND pours after routing.
- `suture_gnd: true`: creates GND stitching vias with `EPCB_PrimitiveViaType.SUTURE`.
- `suture_grid_mm: 4`, `suture_diameter_mm: 0.61`, `suture_drill_mm: 0.305`.

Only override these values when the user gives manufacturing, RF, power-layout, or DRC constraints.
</MCP_PCB_AUTOROUTE_WORKFLOW>
