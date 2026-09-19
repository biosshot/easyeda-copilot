# Schematic groups

Call `get_current_page_schematic_groups({})` on the intended schematic page to inspect likely component groupings and direct non-ground wire connections. Set `get_full_schematic_groups: true` to read every page and concatenate their page-local results. The full mode restores the previously active document and does not invent cross-page groups or wire islands. The tool is read-only. Use it alongside `get_schematic`, which supplies values, pin names and the electrical netlist.

```ts
interface SchematicGroups {
  maybe_blocks: string[];
  wires: { net: string | null; pins: string }[];
  errors?: string[];
}
```

```json
{"maybe_blocks":["C1 C2 U8","C8 C9 U6"],"wires":[{"net":"3V3","pins":"C1.1 C2.1 U8.5"},{"net":"5V","pins":"C8.1 C9.1 U6.5"}]}
```

- `maybe_blocks` contains space-separated component references. The groups are suggestions, not a complete or authoritative partition; singletons and ambiguous components may be omitted.
- A valid ASCII alphanumeric suffix after the last dot of a part name is appended to its block reference (`MAX942CSA+.2` → `U21.2`). A lone `.1` uses the base designator; `.1` is retained when multiple sections with the same designator are present on the page. Missing or invalid suffixes also use the base designator. No library lookup is performed. In `wires`, `U21.7` always means physical pin 7.
- Each `wires` entry describes one continuous drawn wire island with at least two distinct pin references. Separate islands remain separate even when their net names match. Names recognized as ground, such as `GND`, `AGND`, `DGND` and `PGND`, are omitted. `null` means the net name is unknown.
- Power flags, net labels and ports are not returned as components or pins. They may strengthen a block suggestion through resolved nets, but do not create a direct wire connection.

The response excludes page IDs, scores, geometry and library UUIDs. Full-mode arrays follow schematic page order, so repeated references from different pages are not deduplicated. Empty results are `{"maybe_blocks":[],"wires":[]}`. Optional `errors` are bounded, non-fatal diagnostics for a partial result; missing wires do not prove electrical isolation. An unreadable component list, wrong document type or page change remains a fatal error.
