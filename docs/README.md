# EasyEDA Copilot Docs

## Current MCP workflow

- [Install and configure MCP](../mcp/README.md)
- [Agent entry point: choose one task](../mcp/docs/SKILL.md)
- [Complete project workflow](../mcp/docs/workflow.md)
- [Operation results, waiting and recovery](../mcp/docs/operations.md)
- Verification: [schematic](../mcp/docs/schematic/verification.md), [placement](../mcp/docs/pcb-layout/verification.md), [routing](../mcp/docs/pcb-routing/verification.md)
- [Keep, repair or restore](../mcp/docs/recovery.md)
- [Focused JavaScript and API lookup](../mcp/docs/execution/instructions.md)

The agent entry point links to schematic, placement and routing guides. Read the selected guide and exact declarations as needed. The vendored API catalog is reference material, not a second MCP setup guide.

## Local development

- [Contributing and builds](../CONTRIBUTING.md)
- [Connect a local router checkout](local-router.md)
- [Separate backend, local development and release checks](local-development.md)
- [Backend extraction record](backend-integration-plan.md) — historical implementation scope

## Legacy built-in interface

These guides describe the integrated chat and its settings. They do not configure the external MCP client's model, keys, or tools.

- [Settings and shared extension permissions](settings.md)
- [Attaching circuits](attaching-circuits.md)
- [Assembling circuits](assembling-circuits.md)
