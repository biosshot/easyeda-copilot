# PCB Placement Instructions

`make_pcb_layout` is placement-only. EasyEDA v3/client tools perform routing, copper pours, DRC, and tuning after assembly.

## Source Of Truth

- `dsl.ts` defines the available DSL. Do not invent helpers or use hidden/stale options.
- Keep the schematic immutable: never rename its nets, pins, designators, `part_uuid`, or `footprint_uuid`.
- Coordinates are millimeters from board center; positive X is right and positive Y is down.
- `examples/` contains complete references. Copy the structure, then recheck every designator, pin, and net against the current schematic.

## Workflow

1. Read `dsl.ts`, this file, and the closest complete example.
2. Make a **mechanical preview** first: board outline, holes, constraint regions, board pads, connectors, buttons, displays, LEDs, and other edge-facing parts. Use `solver({ preview: true, placeOnlyComponents: [...] })`.
3. Open `previewSvgPath` and show that image to the user. Ask for explicit confirmation of the mechanics. A preview is never assembled.
4. After confirmation, remove preview filters and write the complete block/module/component layout.
5. Run full placement, inspect `previewSvgPath`, and fix fatal errors only.
6. Show the final placement to the user for approval. Assemble only after that approval.
7. Route and run DRC in EasyEDA v3/client tools.

If `make_pcb_layout` returns `status: "pending"`, call `wait_pcb_layout({ operationId })`. Otherwise use its completed result directly.

## Errors And Warnings

Fix before assembly:

- invalid DSL, invalid target references, or missing footprint;
- `fatal_overlap` and `outside_board`;
- disconnected physical blocks, unless the block intentionally has `allowDisconnected: true`.

Warnings are review context, not an optimization backlog. Fix one only when it visibly harms the requested result or violates an explicit requirement: e.g. a USB connector faces inward, a crystal/USB/RF/switch-loop critical path is obviously too long, or a block is visibly malformed. Make at most one focused revision. Do not chase zero warnings.

## Placement Defaults

Use `board.auto(...)` unless the board has fixed mechanical dimensions. For normal compact boards start with:

- `density: 0.4`;
- component `clearance: 0.35` mm, normally within `0.25-0.5` mm;
- board `edge: 2` mm unless mechanics require another value;
- `grid: 0.5` or `1` mm.

`clearance` is evaluated against placement footprint bounds, which include silkscreen/body geometry. Do not use old `1.3` mm placement clearance by default: it makes normal boards artificially sparse. Increase it only for intentional mechanical/routing space around large connectors or dense ICs.

For `capCluster`, start with `gap: 0.3` mm; use `0.25-0.4` mm unless an electrical or mechanical reason requires more. The footprint bounds already supply additional visible separation.

Use `compactness: "high"` only when board area is genuinely constrained.

## Structure

- Every real component belongs to exactly one block.
- A block is one physical island and normally shares at least one non-GND net. Set `allowDisconnected: true` only for intentional mechanical/same-role arrays.
- Keep blocks below roughly 12 components. Split by IC pin group, rail, side, or function.
- Do not mix top and bottom components in one block.
- Use a main block for an IC/core and small satellite blocks for clock, flash, decoupling, feedback, and similar local functions.
- Modules are soft macro groups. Do not create a giant sparse module containing connectors on distant board edges.

## Constraints

- Use `coreIsland` and a small number of hard `criticalPair` constraints for dominant paths only.
- Use `capCluster` for two or more capacitors sharing a power and return net. Use `bypass`, `veryNear`, or `criticalPair` for a single capacitor.
- Use `edgeMount` only for a part that must physically overhang the board. Use `edgePlace` for buttons, LEDs, and controls that remain inside the outline.
- Use `fixed` only for actual mechanical locks. Never fix normal ICs, passives, crystals, or inductors merely to improve a preview.
- Use `componentGrid` for existing header/test/indicator arrays and `boardPad` for new synthetic board pads.
- Use `constraintRegion` for placement-only antenna, display, USB-tongue, or mechanical exclusion areas. It is not a copper keepout.

## Avoid

- Full placement before the user confirms mechanical preview.
- Assembly before the user confirms final placement.
- One giant power/MCU block containing all support parts.
- Normal components without block ownership or mixed layers in one block.
- Manual coordinates to compensate for a bad electrical block structure.
- Routing, copper, polygon, via, width, differential-pair, or length-matching rules in this DSL.
