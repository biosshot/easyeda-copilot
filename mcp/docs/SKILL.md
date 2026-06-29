---
name: easyeda-copilot-mcp
description: Use when EasyEDA Copilot MCP tools are available. This local skill file is the MCP documentation entry point; read it and the referenced local docs before creating circuits, modifying schematics, generating PCB layout DSL, or assembling PCB layout results.
---

# EasyEDA Copilot MCP

Use this skill when an EasyEDA Copilot MCP server provides EasyEDA schematic and PCB tools.

Treat the local files as the documentation source for MCP work. Do not fetch or rely on server prompt endpoints for MCP context.

## References

- `circuit-maker/instructions.md`: circuit modification rules.
- `pcb-layout/instructions.md`: PCB layout workflow and heuristics.
- `pcb-layout/dsl.ts`: authoritative PCB layout DSL declarations and examples.
- `pcb-layout/mcp-workflow.md`: MCP-specific PCB assembly workflow.
- `pcb-drc/rules.md`: PCB DRC rule export/edit/apply workflow, including differential pair handling.
