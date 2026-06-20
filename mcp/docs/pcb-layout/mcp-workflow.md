# PCB Layout MCP Workflow

<OUTPUT_EXPECTATIONS>
Call **make_pcb_layout** with a JavaScript DSL file to create PCB placement and optional routing from the current EasyEDA schematic.

The tool returns:
- a compact placement/routing report as text;
- previewImagePath for visual inspection of the generated PCB preview;
- layoutId when a board assembly payload is available for later assemble_pcb_layout_on_current_pcbdoc.

Use the report as the source of truth before retrying layout rules.
</OUTPUT_EXPECTATIONS>

<MCP_PCB_ASSEMBLY_WORKFLOW>
make_pcb_layout is iterative. Use it repeatedly to inspect placement/routing reports and previewImagePath. Do not assemble the PCB during intermediate attempts.

Final PCB assembly is allowed only after verifying the EasyEDA project structure:
1. Call get_current_project_info.
2. Confirm the schematic used for PCB layout belongs to a BOARD item and that the same BOARD item has a PCB document.
3. Before assembly, call open_document with that BOARD item PCB uuid. The PCB document must be opened first.
4. Only after open_document succeeds, call assemble_pcb_layout_on_current_pcbdoc with the final layoutId.

Do not call assemble_pcb_layout_on_current_pcbdoc for a standalone schematic, an unrelated PCB document, or an ambiguous project structure. Ask the user to select/create the correct board/PCB document instead.
</MCP_PCB_ASSEMBLY_WORKFLOW>
