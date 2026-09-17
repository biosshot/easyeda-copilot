# Schematic groups

Call `get_current_page_schematic_groups({})` on the intended schematic page to inspect likely component groupings and direct drawn connections. It is read-only and returns the whole page inline. Use it alongside `get_current_page_schematic`, which supplies values, pin names and the electrical netlist.

```ts
interface SchematicGroups {
  maybe_blocks: string[];
  wires: { net: string | null; pins: string }[];
}
```

```json
{"maybe_blocks":["C1 C2 U8","C8 C9 U6"],"wires":[{"net":"3V3","pins":"C1.1 C2.1 U8.5"},{"net":"5V","pins":"C8.1 C9.1 U6.5"}]}
```

- Each `maybe_blocks` string contains space-separated component designators. The ordering does not identify an anchor. These are suggestions, not proven functional blocks or a complete partition: singletons and unresolved section identities may be omitted. Review and complete the grouping before supplying all components to beautify or PCB placement.
- Multipart members use `designator.subPartName`, for example `U21.2` or `U21.B`, even if only that section is on the page. Different sections of one package may belong to different blocks. In `wires`, `U21.7` still means physical pin 7 of U21, not a section; no third suffix is added. Resolve section references back to physical components and reconcile shared package ownership before passing groups to beautify or PCB placement.
- Each `wires` entry contains at least two distinct real pin references (`designator.pin_number`) on one continuous drawn wire island. Several Wire primitives and branches may form an island. Pins of the same component are never internally joined. Separate islands may have the same `net` and remain separate entries. `null` means the name could not be determined.
- Power flags, net labels and ports are not output components or pins. Shared resolved nets through these symbols can strengthen a **block** suggestion, but never create a direct **wire** connection.

No page IDs, scores, geometry, library UUIDs or duplicated pin names are returned. Empty results retain the same shape: `{"maybe_blocks":[],"wires":[]}`. A read failure is an error, not an empty successful result.