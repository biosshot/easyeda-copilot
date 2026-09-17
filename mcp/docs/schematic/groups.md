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

- Each `maybe_blocks` string contains space-separated component designators. The ordering does not identify an anchor. These are suggestions, not proven functional blocks or a complete partition: singletons and ambiguous multi-part ownership are omitted. Review and complete the grouping before supplying all components to beautify or PCB placement.
- Each `wires` entry contains at least two distinct real pin references (`designator.pin_number`) on one continuous drawn wire island. Several Wire primitives and branches may form an island. Pins of the same component are never internally joined. Separate islands may have the same `net` and remain separate entries. `null` means the name could not be determined.
- Power flags, net labels and ports are not output components or pins. Shared resolved nets through these symbols can strengthen a **block** suggestion, but never create a direct **wire** connection.

No page IDs, scores, geometry, library UUIDs or duplicated pin names are returned. Empty results retain the same shape: `{"maybe_blocks":[],"wires":[]}`. A read failure is an error, not an empty successful result.

## Implementation notes

`extension/src/eda/schematic-groups.ts` owns collection and analysis; the MCP client only dispatches to it. No library searches, editor writes, saved grouping state or backend service are required. The existing schematic reader supplies resolved nets without part UUID extraction. Wire geometry is normalized using the existing EasyEDA-version helper.

Wire analysis splits segments at existing wire vertices and real pin contacts, including T-junctions and overlaps. It deliberately does not add a junction at an interior/interior crossing, even when both wires have the same net name. A connected crossing must be represented by a vertex/contact in the editor geometry. Geometry not representing that distinction needs live-editor verification; net equality alone cannot establish it. Numerical tolerance is `1e-4` native coordinate units, not the drawing grid. Conflicting resolved names on a physical path cause one fresh read and then an error, rather than invented connectivity.

Grouping uses symbol/pin bounding boxes, bounded shortest drawn-wire paths and shared resolved nets. Shared-net evidence is counted once per net and reduced by the number of distinct attached components; ground and supply names have smaller, nonzero weights. It does not recognize USB or any specific part number. A scale derived from typical symbol size makes spacing relative to the drawing.

Agglomerative merging uses symmetric mean nearest-link support, a spatial-growth penalty and a maximum local extent. This supports peripheral components connected by ports while limiting single-link chains and long global power lines. Coefficients are initial heuristics, not calibrated probabilities. Multi-part symbols retain separate geometry; a designator spanning separate final clusters is omitted from suggestions instead of forcing a cross-page-sized bounding box.

Offline fixtures cover adjacent button circuits, a USB connector with disconnected-by-ports peripheral parts, wire segmentation/crossings, stale net names, layout transforms, chain growth and 330 components. These are synthetic fixtures based on the examples, not captures of actual editor primitives. Check representative real pages in EasyEDA before treating this first-version grouping as tuned for all schematic styles.
