# Schematic groups

Call `get_current_page_schematic_groups({})` on the intended schematic page to inspect likely component groupings and direct drawn connections. It is read-only and returns the whole page inline. Use it alongside `get_current_page_schematic`, which supplies values, pin names and the electrical netlist.

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

- Each `maybe_blocks` string contains space-separated component designators. The ordering does not identify an anchor. These are suggestions, not proven functional blocks or a complete partition: singletons and unresolved section identities may be omitted. Review and complete the grouping before supplying all components to beautify or PCB placement.
- Block references append only the ASCII alphanumeric suffix after the **last dot** of the part name: `MAX942CSA+.2` → `U21.2`, `.B` → `U21.B`. Missing, empty or non-alphanumeric suffixes use the base designator, without an error. This is not multipart detection: `FRC0603J104 TS.1` or `470uF 25V 8*12.1` may belong to single-part devices and still produce `R5.1` or `C1.1`. No library lookup is performed. Different sections may belong to different blocks; suffixes do not change geometry or scoring. In `wires`, `U21.7` remains physical pin 7, not a section. Resolve block references back to physical components and reconcile shared package ownership before beautify or PCB placement.
- Each `wires` entry contains at least two distinct real pin references (`designator.pin_number`) on one continuous drawn wire island. Several Wire primitives and branches may form an island. Pins of the same component are never internally joined. Separate islands may have the same `net` and remain separate entries. `null` means the name could not be determined.
- Power flags, net labels and ports are not output components or pins. Shared resolved nets through these symbols can strengthen a **block** suggestion, but never create a direct **wire** connection.

No page IDs, scores, geometry, library UUIDs or duplicated pin names are returned. Empty results retain the same shape: `{"maybe_blocks":[],"wires":[]}`. Local read/geometry failures preserve the usable remainder and add `errors` only when needed: at most 10 deduplicated messages, each capped at 200 characters. With more than 10 distinct issues, the tenth message counts the remainder; details go to the editor log. The limit never stops analysis.

Unreadable pins can leave a component available for position-only grouping; unavailable nets disable their shared-net evidence. Bad wire segments are skipped, and persistently contradictory paths are omitted after one fresh live read (also excluded from direct-wire scoring). Remaining `wires` may be incomplete: missing entries or separate returned fragments do **not** prove electrical isolation. Normal unknown net names use `null`. An unreadable component list, wrong document type or page change remains a fatal error rather than mixed-page or fabricated output.
