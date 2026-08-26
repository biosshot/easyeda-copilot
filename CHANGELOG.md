# Changelog

Fork of [biosshot/easyeda-copilot](https://github.com/biosshot/easyeda-copilot),
branched at `7f3b53a`.

## 2.5.0

### Added

- **`add_pcb_keepout_region` / `delete_pcb_keepout_regions`** — rectangular keepouts that
  copper respects. The placement DSL's `constraintRegion` only excludes other components,
  as its own documentation states, so a module antenna still ended up over the GND pour.

### Fixed

- **Suture vias accumulated on every pour.** `removeOldDefaultGroundSutureVias` called
  `pcb_PrimitiveVia.getAll(net, true)`, where the second parameter is `primitiveLock`
  rather than "include everything". Suture vias are created unlocked, so the cleanup
  matched none and each pour stacked a fresh layer on the old one: a board with 390 vias
  came back with 493 instead of 103. Only surfaced once re-pouring became possible at all.
- **`draw_blocks` never reached the plugin.** The server wraps its answer in a `circuit`
  key and the plugin reads that; the option was being attached one level above it.
- **ERC results were parsed with the PCB DRC shape.** The schematic returns a per-severity
  summary (`[{type:"warn",count:35}]`), not a list of violations, so a schematic with 35
  warnings was reported as clean. Now returns `errors`/`warnings` separately, and
  `show_in_editor` opens the panel where the individual entries live.
- **Duplicate reused blocks no longer merge their internal nets.** Two instances came back
  sharing `$1N59193` and `$1N64497`, shorting both channels into one. The edges are
  correct per instance, so the pins of each auto-generated net are split into connected
  groups and every group past the first is renamed. Verified on a two-relay board:
  `$1N59193` / `$1N59193_2` reach the PCB as separate nets.

## 2.1.0

### Added

- **Silkscreen in `preview_pcb`.** `getPcbRaw` now carries silkscreen text and images,
  and the renderer draws them. Placement can be checked from the rendered image instead
  of opening the GUI.
- **SVG converter understands whole documents.** Besides `<path>`: `rect` (including
  rounded corners), `circle`, `ellipse`, `polygon`, `polyline`, plus `transform` on
  shapes and on enclosing groups (`translate`, `scale`, `rotate`, `matrix`, `skewX`,
  `skewY`). Content inside `defs`, `clipPath`, `mask` and `symbol` is ignored. Covered
  by 20 offline tests: `npm test` in `mcp/`.
- **`draw_blocks` on `extract_circuit_on_current_page`.** The plugin UI has always sent
  `assembly_options`; the MCP path never did, so block rectangles could not be drawn
  through MCP at all.
- **The assembled circuit is saved to disk** and its path returned, so a bad assembly
  can be inspected rather than guessed at.
- Agent-facing docs: `pcb-silkscreen/instructions.md`, plus sections in `SKILL.md` and
  `pcb-layout/instructions.md` covering the traps found while using the tool.

## 2.0.0

### Added

- **`check_schematic_erc`** — the schematic counterpart of `check_pcb_drc`. `SCH_Drc`
  was symmetric with `pcb_Drc` in the API but never exposed, so a schematic could not
  be validated at all.
- **`find_pcb_free_space`** — an empty rectangle of a given size, from the editor's own
  bounding boxes. Component bodies are not a safe proxy: a USB-C receptacle's mounting
  tabs reach far beyond its body, and a label placed by arithmetic landed on them.
- **`pour_ground_and_suture_vias`** — re-pour GND and re-place stitching vias on a
  routed board without touching tracks. The plugin could already do this, but only as a
  side effect of importing autoroute results, so changing the stitching grid meant
  routing the whole board again.
- **`include_positions` on `get_current_page_schematic`** — component positions were
  stripped unconditionally.

### Changed

- The bridge re-opens the required document and retries once when a call fails with
  `Open PCB doc to fix`. The active document changes whenever the user clicks around the
  GUI. Only acts when the project contains exactly one candidate; with several boards it
  fails rather than guessing.

## 1.x

### Added

- **Silkscreen text**: `add_pcb_silkscreen_text`, `get_pcb_silkscreen_text`,
  `delete_pcb_silkscreen_text`. Only reference designators could be placed before.
- **Silkscreen logos**: `add_pcb_silkscreen_image`, `get_pcb_silkscreen_images`,
  `delete_pcb_silkscreen_images`, with an SVG-to-polygon converter.
- **`get_pcb_component_geometry`** — bounding boxes and per-pad coordinates.
  `get_current_pcb` reports pad names and nets but no positions, so a pin could not be
  labelled without guessing which end of the header pad 1 sits on.

### Fixed

- `getPcbRaw` computed a component's bounding box with `right: box.maxY` instead of
  `box.maxX`, which distorted `preview_pcb` output.
- PCB operations returned empty results instead of an error when a schematic was the
  active document, which read as "the board is empty". They now fail with
  `Open PCB doc to fix`.
- Silkscreen text was matched for updates by content alone, so two `GND` labels at
  different connectors collapsed into one. Matching now uses content *and* position.
- Bottom-layer silkscreen was mirrored by default. EasyEDA already flips that layer when
  rendering, so the artwork came out reversed. Verified visually on a real board.
- `add_pcb_silkscreen_image` placed artwork by the polygon coordinates, which the API
  ignores. Position comes from the `create` anchor, which lands the image's top-right
  corner; the anchor is now offset accordingly and the result measured and corrected.

## Known upstream defects, not fixed

- **Inserting the same reused block twice merges its internal nets.** Two instances of a
  relay driver came back sharing `$1N64497` and `$1N59193`, shorting both channels into
  one. The schematic looks correct; only matching `signal_name` values reveal it.
  Diagnosing this needs a captured assembly, which 2.1.0 now saves.
- **The schematic page size is not readable.** `getPageSize` looks for width/height in
  `titleBlockData`, which holds title-block fields rather than page geometry, and falls
  back to a fixed 1200x800. The only setter in the API,
  `modifySchematicPageTitleBlock`, writes title-block content, so the frame cannot be
  resized from an extension.
