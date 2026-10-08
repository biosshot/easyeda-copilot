# PCB DSL intent validation

Before `make_pcb_layout` and after changing placement intent, open the target PCB and call `validate_pcb_dsl` with the same DSL file:

```json
{ "file": "/absolute/path/to/layout.js" }
```

The tool reads the file, captures the current PCB outline and component positions, and extracts the full linked schematic from EasyEDA in the same way as `make_pcb_layout`. Pass only the file path. The current PCB supplies the context for `preserve(...)`.

Full schematic groups and direct wire islands are also read automatically. The EasyEDA adapter parses compact strings and multipart references into the backend's `PcbSchematicGroups` contract: `{ groups: [{ components: ["U1", "C1"] }] }`, with optional `wireIslands` containing a net and structured pin references, and `incomplete: true` for partial reads. Physical component designators and actual pin identities are passed; editor strings and error text are not forwarded. Wire pin references and symbol-section references use different parsers. There is no LLM argument or switch for this. Differences between suggested schematic groups and PCB functional families produce info only; a root block and all its attached descendants are one family. Oversized or ambiguous groups are skipped, and a failed group read adds coverage info without preventing DSL validation.

The validator uses explicit capacitor assignments and functional families to avoid borrowing every capacitor on a shared supply rail. A small dedicated family can satisfy ordinary supply locality. Critical loops and assignments to separate supply pins remain stricter, and equivalent capacitor choices produce one finding for a complete alternative.

A small direct-wire island with one active core can identify an otherwise unassigned rail passive before family filtering. Explicit DSL assignments remain authoritative, with conflicting wire evidence reported as info. Large power buses, multiple owners, return islands and incomplete context do not determine ownership. Identical net names do not merge separate wire islands, and wire connectivity never substitutes for PCB pad locality.

The tool calls backend `validatePcbLayoutIntent` directly. It does not run AutoPlace, fetch footprints or apply placement. Rules requiring verified device/application knowledge or footprint geometry may report limited coverage. Review those limits together with the actual schematic and datasheets.

## Result and follow-up

The result is the backend JSON array, with `code`, `severity`, an English `message`, and optional `context.components` and `context.locations` (DSL line/column). `[]` means no findings for the available evidence. Large arrays use the standard response artifact; read the returned file path.

- `error`: fix invalid DSL, references or contradictory intent before placement.
- `warning`: inspect the indicated circuit or placement intent and correct a real problem. Connector binding and distance from the board edge are advisory warnings.
- `info`: review coverage limits and advisory mechanics findings. Missing mounting holes produce info, allowing a board intentionally secured another way.

Diagnostic errors are validation results, not MCP transport failures. CLI exit status alone does not tell you whether the array contains errors. Correct the DSL file, reopen the target PCB if schematic extraction changed the active document, and rerun validation before placement. The validator does not certify solved geometry, routing, electrical behavior or manufacturing correctness; complete the [placement checks](verification.md) after AutoPlace.
