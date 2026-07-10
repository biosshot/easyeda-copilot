# PCB Layout MCP Workflow

For DSL signatures read `dsl.ts`. For placement heuristics and examples read `instructions.md`.

## Tool Responsibilities

`make_pcb_layout`:

- reads a local JavaScript DSL file;
- gets the current EasyEDA schematic through MCP;
- sends schematic + DSL to the layout server;
- returns a compact placement report as text;
- stores the board assembly payload in MCP memory;
- waits up to 60 seconds by default, then returns either a completed run or a pending `operationId`;
- returns `layoutId`, `previewImagePath`, `previewSvgPath`, and available block/module debug SVG paths in the `Run report` block.

`make_pcb_layout` does not assemble the board and does not route tracks.

`assemble_pcb_layout_on_current_pcbdoc`:

- takes a `layoutId` from a previous successful `make_pcb_layout` call;
- sends the stored BoardAssemble payload to the currently opened EasyEDA PCB document.

`wait_pcb_layout` and `cancel_pcb_layout`:

- wait for or cancel the pending operation identified by `operationId`;
- preserve the single active layout operation in the MCP process;
- return the same completed result shape as `make_pcb_layout` when work finishes.

The primary routing path is EasyEDA v3/client routing. The legacy MCP-side autorouter may still be installed for compatibility, but it is not the recommended PCB workflow and is not covered by this placement documentation.

## Placement Iteration Flow

1. Read `dsl.ts` and `instructions.md`. If the board resembles an existing pattern, read the relevant file in `examples/` as a reference.
2. Create or edit a local layout DSL file.
3. Call `make_pcb_layout({ file })`.
4. Read the compact text report.
5. Open `previewSvgPath` and visually inspect the layout. Use `previewImagePath` only where raster preview is more convenient.
6. When present, inspect `debugArtifacts` for the suspicious block, family, or module before changing the DSL.
7. If the result is pending, call `wait_pcb_layout({ operationId })`; otherwise edit the DSL and rerun `make_pcb_layout` as needed.
8. Stop iterating when placement has no fatal errors and the preview is mechanically/electrically reasonable.

Fix in this order:

1. Missing footprint / invalid DSL / invalid target refs.
2. Fatal overlaps and outside-board parts.
3. Disconnected blocks that should be split or marked `allowDisconnected`.
4. Bad fixed/edge connector orientation.
5. Oversized or sparse blocks/modules.
6. Long critical pairs.
7. Cosmetic density/shape/silkscreen issues.

Do not solve placement problems by fixing normal electrical components to coordinates. Change the block structure or constraints instead.

## Mechanical Preview Flow

Use `solver({ preview: true, placeOnlyComponents: [...] })` before full placement when the main risk is mechanical: connectors facing the wrong way, buttons/LEDs at the wrong edge, USB overhang, board pads, mounting holes, or keepout regions.

Preview rules:

1. Keep the DSL small: board shape, holes/regions/pads, and only the selected mechanical components.
2. `placeOnlyComponents` resolves and places only those designators, so preview is fast.
3. `ignoreComponents` can temporarily exclude parts, but do not combine it with `placeOnlyComponents`.
4. Read the report. A successful preview has `status: preview` and `PREVIEW ONLY: true`.
5. Do not call `assemble_pcb_layout_on_current_pcbdoc` for preview results. Rebuild the full DSL without the preview filter first.

## Assembly Flow

Before assembly, verify the target PCB document:

1. Call `get_current_project_info`.
2. Confirm the schematic used by `make_pcb_layout` belongs to a BOARD item.
3. Confirm that BOARD item has the PCB document you intend to modify.
4. Call `open_document` with that PCB document UUID.
5. Call `assemble_pcb_layout_on_current_pcbdoc({ layoutId })`.

Do not assemble into an unrelated PCB document or an ambiguous project structure.

## Routing And DRC Flow

After assembly:

1. Configure or import DRC rules if needed.
2. Configure the board stack and DRC rules in EasyEDA when required.
3. Route with EasyEDA v3/client tools.
4. Run `check_pcb_drc`.
5. Use `inspect_net`, `inspect_component`, and `preview_pcb` for targeted review.

Placement DSL deliberately contains no copper, polygon, stitching, width, via, differential-pair, or length-matching settings. Those belong to the EasyEDA routing/DRC stage.

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
  "previewImagePath": "C:\\Users\\...\\pcb-previews\\....png",
  "previewSvgPath": "C:\\Users\\...\\pcb-previews\\....svg",
  "debugArtifacts": [
    { "name": "mcu_core__family", "path": "C:\\Users\\...\\pcb-layout-debug\\...\\families\\mcu_core__family.svg" }
  ]
}
```

Use `layoutId` only for assembly. Prefer `previewSvgPath` for visual inspection and use `previewImagePath` as a PNG fallback. `debugArtifacts` are optional and identify the local primitive whose geometry should be reviewed. The full board payload is stored internally by the MCP server and is not shown to the agent by default.

For a pending run the result is instead:

```json
{
  "status": "pending",
  "operationId": "...",
  "progress": "solve_board: 85%",
  "nextTool": "wait_pcb_layout"
}
```
