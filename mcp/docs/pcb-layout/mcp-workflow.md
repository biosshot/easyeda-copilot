# PCB Layout MCP Workflow

Read `dsl.ts` for syntax and `instructions.md` for placement rules. `make_pcb_layout` is placement-only.

## Tools

- `make_pcb_layout({ file })` reads the local DSL and current schematic, runs placement, stores the BoardAssemble payload in MCP memory, and returns report + `layoutId` + preview paths.
- `wait_pcb_layout({ operationId })` is needed only when `make_pcb_layout` returns `status: "pending"` after its 60-second synchronous wait.
- `cancel_pcb_layout({ operationId })` stops an obsolete pending placement.
- `assemble_pcb_layout_on_current_pcbdoc({ layoutId })` imports a previously completed final placement into the currently open PCB document.

`previewSvgPath` is the primary review image. `previewImagePath` is PNG fallback. `debugArtifacts` are optional local SVGs for a visibly bad block, family, or module.

## Required Approval Flow

1. Write a small mechanical preview DSL: outline, holes, regions, pads, and mechanical/user-facing components.
2. Add `solver({ preview: true, placeOnlyComponents: [...] })` and call `make_pcb_layout`.
3. If the tool returns pending, wait. When it completes, open `previewSvgPath` and present the image to the user for mechanical approval.
4. Do not assemble or run full placement before approval.
5. After approval, write the complete placement DSL without preview filters and run `make_pcb_layout`.
6. Fix hard errors only. Warnings are not a requirement to reach an ideal score; change one only if it visibly harms an explicit requirement.
7. Open the final `previewSvgPath` and request final placement approval.
8. Open the intended PCB document and assemble using `layoutId`.
9. Route, configure DRC, and run checks in EasyEDA v3/client tools.

## Result Handling

Use a completed `layoutId` only for assembly. A preview result is never assembled. The board payload remains internal to MCP and is intentionally not shown to the agent.

Typical completed report:

```txt
placement_ok: true
components: 42
board: 42mm x 42mm
errors: 0

Run report:
{
  "layoutId": "...",
  "previewSvgPath": "C:\\Users\\...\\pcb-previews\\....svg",
  "previewImagePath": "C:\\Users\\...\\pcb-previews\\....png"
}
```
