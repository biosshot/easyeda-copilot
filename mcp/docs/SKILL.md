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

## Current PCB Model

`make_pcb_layout` is placement-only. It creates board outline, fixed mechanical objects, component placement, synthetic board pads, mounting holes, and reference text positions. It does not route tracks, create final copper pours, tune DRC rules, or replace EasyEDA v3 routing.

Normal PCB flow:

1. Write a local JavaScript DSL file using `pcb-layout/dsl.ts`.
2. Call `make_pcb_layout` with the file path.
3. Inspect the text report, `previewSvgPath` (preferred) or `previewImagePath`, and block/module debug SVGs when present.
4. If acceptable, open the correct PCB document and call `assemble_pcb_layout_on_current_pcbdoc` with `layoutId`.
5. Route and run DRC in EasyEDA v3/client tools on the assembled PCB.

For fast mechanical checks, use `solver({ preview: true, placeOnlyComponents: [...] })`. Preview results are marked in the report and must not be assembled as final boards.
