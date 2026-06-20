---
name: easyeda-copilot-mcp
description: Use when EasyEDA Copilot MCP tools are available. This local skill file is the MCP documentation entry point; read it and the referenced local docs before creating circuits, modifying schematics, generating PCB layout DSL, or assembling PCB layout results.
---

# EasyEDA Copilot MCP

Use this skill when an EasyEDA Copilot MCP server provides EasyEDA schematic and PCB tools.

The MCP server caches this file and the referenced docs locally at startup. Treat the local files as the documentation source for MCP work. Do not fetch or rely on server prompt endpoints for MCP context.

## Workflow

1. Treat the attached circuit or PCB data as the source of truth; do not invent components, pins, nets, or part UUIDs.
2. For schematic creation or modification, read `circuit-maker/instructions.md` and `circuit-maker/mcp-output.md`.
3. For PCB placement/routing, read `pcb-layout/instructions.md`, `pcb-layout/dsl.ts`, and `pcb-layout/mcp-workflow.md`.
4. Prefer compact tool inputs. Do not duplicate attached circuit JSON in prose.
5. After PCB layout runs, use the JSON tool report as the source of truth for overlaps, outside-board issues, block violations, critical pair violations, and unrouted nets.

## Key MCP Tools

- `get_current_page_schematic`: inspect the current schematic.
- `component_search`: resolve exact parts by MPN or part_uuid.
- `search_reused_block`: find reusable validated circuit blocks.
- `extract_circuit_on_current_page`: apply schematic changes to EasyEDA.
- `create_board`, `delete_board`: create or delete board items in the current project.
- `create_pcb`, `modify_pcb_name`: create or rename PCB documents.
- `import_pcb_changes`: import schematic changes into the currently opened PCB document.
- `sync_current_document`: force EasyEDA to save, close, wait, and reopen the current schematic or PCB document when EasyEDA UI/API state is out of sync.
- `get_pcb_component_sizes`: inspect footprint sizes before compact layout.
- `make_pcb_layout`: generate PCB placement/routing and preview.
- `get_current_project_info`, `open_document`, `assemble_pcb_layout_on_current_pcbdoc`: verify and assemble final PCB layout.

## References

- `circuit-maker/instructions.md`: circuit modification rules.
- `circuit-maker/mcp-output.md`: MCP-specific circuit tool output rules.
- `pcb-layout/instructions.md`: PCB layout workflow and heuristics.
- `pcb-layout/dsl.ts`: authoritative PCB layout DSL declarations and examples.
- `pcb-layout/mcp-workflow.md`: MCP-specific PCB assembly workflow.
