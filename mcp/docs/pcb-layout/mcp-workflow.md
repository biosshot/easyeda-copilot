# PCB Layout MCP Workflow

For DSL signatures read `dsl.ts`. For placement heuristics and examples read `instructions.md`.

## Tool Responsibilities

`make_pcb_layout`:

- reads a local JavaScript DSL file;
- gets the current EasyEDA schematic through MCP;
- sends schematic + DSL to the layout server;
- returns a compact placement report as text;
- stores the board assembly payload in MCP memory;
- returns `layoutId` and `previewImagePath` in the `Run report` block.

`make_pcb_layout` does not assemble the board and does not route tracks.

`assemble_pcb_layout_on_current_pcbdoc`:

- takes a `layoutId` from a previous successful `make_pcb_layout` call;
- sends the stored BoardAssemble payload to the currently opened EasyEDA PCB document.

`run_auto_route_on_current_pcbdoc`:

- works only after a PCB document is open and placement is assembled;
- exports EasyEDA PCB autoroute JSON;
- runs the MCP-side router;
- imports the routed JSON back into EasyEDA;
- can rebuild GND pours and add GND stitching vias.

EasyEDA v3/client routing may be preferred when available.

## Placement Iteration Flow

1. Read `dsl.ts` and `instructions.md`. If the board resembles an existing pattern, read the relevant file in `examples/` as a reference.
2. Create or edit a local layout DSL file.
3. Call `make_pcb_layout({ file })`.
4. Read the compact text report.
5. Open `previewImagePath` and visually inspect the layout.
6. If needed, edit the DSL and rerun `make_pcb_layout`.
7. Stop iterating when placement has no fatal errors and the preview is mechanically/electrically reasonable.

Fix in this order:

1. Missing footprint / invalid DSL / invalid target refs.
2. Fatal overlaps and outside-board parts.
3. Disconnected blocks that should be split or marked `allowDisconnected`.
4. Bad fixed/edge connector orientation.
5. Oversized or sparse blocks/modules.
6. Long critical pairs.
7. Cosmetic density/shape/silkscreen issues.

Do not solve placement problems by fixing normal electrical components to coordinates. Change the block structure or constraints instead.

## Assembly Flow

Before assembly, verify the target PCB document:

1. Call `get_current_project_info`.
2. Confirm the schematic used by `make_pcb_layout` belongs to a BOARD item.
3. Confirm that BOARD item has the PCB document you intend to modify.
4. Call `open_document` with that PCB document UUID.
5. Call `assemble_pcb_layout_on_current_pcbdoc({ layoutId })`.

Do not assemble into an unrelated PCB document or an ambiguous project structure.

## Routing Flow

After assembly:

1. Configure or import DRC rules if needed.
2. Call `get_pcb_stack_layers` if layer selection matters.
3. If the user asks for a different board stack, call `set_pcb_copper_layer_count`, then call `get_pcb_stack_layers` again.
4. Run EasyEDA v3/client routing, or call `run_auto_route_on_current_pcbdoc`.
5. Run `check_pcb_drc`.
6. Use `inspect_net`, `inspect_component`, and `preview_pcb` for targeted review.

MCP router defaults are intentionally conservative:

- `ignore_nets: ["GND"]`: GND is expected to be served by copper pour/stitching.
- `route_layers` omitted: use the routing layer set exported by EasyEDA autoroute JSON. If provided, use layer names returned by `get_pcb_stack_layers`, such as `["TOP"]`, `["BOTTOM"]`, or `["TOP", "BOTTOM", "INNER_1"]`.
- `pour_gnd: true`: rebuilds GND copper pours after routing.
- `suture_gnd: true`: adds GND stitching vias.
- `suture_grid_mm: 4`, `suture_diameter_mm: 0.61`, `suture_drill_mm: 0.305`.

Only override defaults when the user gives manufacturing, RF, power-layout, or DRC constraints.

## Result Shape

`make_pcb_layout` returns plain text similar to:

```txt
placement_ok: true
components: 42
board: 42mm x 42mm
errors: 0
diagnostics: 3
- critical_pair U1.9<->C5.2: distance 5.98mm expected -..4.8mm

Run report:
{
  "layoutId": "...",
  "previewImagePath": "C:\\Users\\...\\pcb-previews\\....png"
}
```

Use `layoutId` only for assembly. Use `previewImagePath` for visual inspection. The full board payload is stored internally by the MCP server and is not shown to the agent by default.
