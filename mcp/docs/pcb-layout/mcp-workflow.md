# PCB Layout MCP Workflow

For output format and iteration rules see `instructions.md`.

<MCP_PCB_ASSEMBLY_WORKFLOW>
Only assemble a layout after verifying the EasyEDA project structure:

1. Call `get_current_project_info`.
2. Confirm the schematic used for layout belongs to a BOARD item with a PCB document.
3. Call `open_document` with that PCB UUID.
4. Call `assemble_pcb_layout_on_current_pcbdoc` with the `layoutId` returned by `make_pcb_layout`.

Do not assemble for a standalone schematic, an unrelated PCB, or an ambiguous project structure.
</MCP_PCB_ASSEMBLY_WORKFLOW>
