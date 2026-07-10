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

## PCB Contract

`make_pcb_layout` creates placement only: outline, mechanical objects, components, synthetic pads, holes, and designator positions. It does not route tracks, create copper pours, or configure DRC. Read `pcb-layout/mcp-workflow.md` before calling it.
