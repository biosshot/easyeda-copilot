# Validate PCB DSL

Open the target PCB and call `validate_pcb_dsl` before `make_pcb_layout`, or after changing placement intent. Use the same DSL file:

```json
{ "file": "/absolute/path/to/layout.js" }
```

The tool reads the linked schematic and current PCB automatically. It checks the DSL without placing or moving components.

Results are a JSON array with `code`, `severity`, `message`, and optional component or DSL location context. If the response points to a file, read that file. `[]` means no findings from the available data, not a guarantee of a correct layout.

- `error`: invalid DSL, references, or contradictory constraints; resolve these before placement.
- `warning`: a possible layout risk or missing explicit intent, not a confirmed placement defect.
- `info`: additional context, uncertainty, or an advisory observation.

Do not automatically change the DSL to silence warnings or info. Evaluate each finding against the circuit, design requirements, existing constraints, and placement results. Change the intent only when there is a clear reason; otherwise keep it and take the finding into account.

For example, a connector without `fixed()` or an edge constraint may still be placed appropriately. Add a constraint only if the mechanical requirements or resulting placement justify it.

The goal is a suitable layout, not an empty findings array. After AutoPlace, perform the [placement checks](verification.md).
