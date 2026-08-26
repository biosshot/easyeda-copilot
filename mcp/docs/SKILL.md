---
name: easyeda-copilot-mcp
description: Use when EasyEDA Copilot MCP tools are available. This local skill file is the entry point for EasyEDA schematic, PCB placement, assembly, DRC, preview, and routing workflows.
---

# EasyEDA Copilot MCP

Use this skill when an EasyEDA Copilot MCP server provides EasyEDA schematic and PCB tools.

The local files in this directory are the documentation source for MCP work. Do not fetch server prompt endpoints for MCP context. Read only the docs needed for the task.

## References

- `circuit-maker/instructions.md`: circuit creation and schematic modification rules.
- `pcb-layout/dsl.ts`: authoritative PCB placement DSL declarations. Use this before writing `make_pcb_layout` code.
- `pcb-layout/instructions.md`: PCB placement workflow, heuristics, anti-patterns, and examples.
- `pcb-layout/mcp-workflow.md`: MCP-specific flow for placement, async operation handling, assembly, preview, and DRC.
- `pcb-layout/examples/`: full reference layout files. Use them as patterns after reading `dsl.ts`; if an example conflicts with `dsl.ts`, `dsl.ts` wins.
- `pcb-drc/rules.md`: PCB DRC export/edit/apply workflow, including differential pair handling.
- `pcb-silkscreen/instructions.md`: free-form silkscreen text and logos, plus the geometry queries needed to place them.

## PCB Contract

`make_pcb_layout` creates placement only: outline, mechanical objects, components, synthetic pads, holes, and designator positions. It does not route tracks, create copper pours, or configure DRC. Read `pcb-layout/mcp-workflow.md` before calling it.

## Check your work, do not assume it

Two checks are cheap and catch problems that look fine on screen. Run them; do not
report a design as finished without them.

- `check_schematic_erc` after every circuit change and before importing into the PCB.
  It catches unconnected pins, outputs driving each other, duplicate designators, and
  separate circuits that ended up sharing one net.
- `check_pcb_drc` after routing, pouring or stitching. Trust it over the `routability`
  number returned by the router: a run once reported `routability: 1` while DRC found
  five disconnected GND pads.

## Measure instead of deriving

Where the API exposes actual geometry, read it rather than computing it from what you
believe the convention to be:

- `get_pcb_component_geometry` for pad positions and bounding boxes.
- `find_pcb_free_space` for somewhere to put a label.
- `getPrimitivesBBox`-backed `bbox` fields for where something really landed.

A stored coordinate reading back correctly only proves the value was saved, not that it
was applied.

## Copper pours and stitching vias

`pour_ground_and_suture_vias` re-pours GND and re-places stitching vias on an already
routed board, without touching the tracks. Use it to change the stitching grid instead
of clearing and routing the whole board again. It removes the previous pours and vias
first, so repeated calls do not stack.
