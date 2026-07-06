# PCB Layout Instructions

You are writing placement-only PCB layout DSL for `make_pcb_layout`.

The server places components and exports a board assembly payload. Routing, copper pours, DRC setup, length tuning, and final checks happen later in EasyEDA/client tools.

## Source Of Truth

- `dsl.ts` is authoritative for available functions and options.
- Do not invent DSL helpers, route rules, polygon rules, or hidden options.
- Treat the current schematic as immutable. Never rename nets, pins, designators, `part_uuid`, or `footprint_uuid`.
- Use millimeters. Board origin is the board center. Positive X is right, positive Y is down.

## Full Reference Examples

Full examples live in `examples/`. Read them when a new board resembles one of these patterns. Treat them as working style references, not as DSL authority: `dsl.ts` always wins if an example contains an older option or a local experiment.

- `examples/rp2040_base/rp2040.js`: medium-complex RP2040 board. Best reference for MCU + flash + crystal + USB connector + charger + buck regulator on one compact board. Shows how to split a dense MCU into `mcu_core`, `mcu_clock`, `mcu_flash`, USB series resistors, decoupling satellites, and button/reset support. Also shows buck switch-loop/core island and multi-module board organization.
- `examples/PICO_DUCK/PICO_DUCK.js`: very compact USB-stick-shaped board with a custom `board.polygon(...)`, USB tongue `constraintRegion`, disabled designator text, tight clearances, and many small RP2040 satellites. Best reference for tiny boards, unusual board outline, USB contacts, and compactness-driven layout.
- `examples/ELRS/ELRS.js`: tiny RF receiver layout. Best reference for RF/antenna placement, antenna clearance region, mixed top/bottom placement, RF matching chain, radio clock/decoupling satellites, and synthetic `boardPad(...)` IO pads.
- `examples/ESpower/ESpower.js`: dense ESP/power-style board. Best reference for a larger two-layer board with antenna keepout, mounting holes, fixed mechanical connectors, USB support/protection, charger, LDO, current sensing, and several macro modules.

When copying from examples:

- Copy block structure and intent, not designators blindly.
- Recheck every `pin(...)`, `powerNet`, `returnNet`, and `target` against the current schematic.
- Keep mechanical constraints such as `edgeMount`, `constraintRegion`, `boardPad`, and mounting holes only when they match the user's board.
- Do not copy old/experimental options that are not declared in `dsl.ts`.

## Standard Workflow

1. If footprint sizes or board size are uncertain, call `get_pcb_component_sizes` first.
2. Write a local `.js` DSL file.
3. Run `make_pcb_layout({ file })`.
4. Read the placement report and inspect `previewImagePath`.
5. Fix hard errors first: fatal overlaps, outside-board components, disconnected blocks, invalid capCluster/bypass targets, missing footprints.
6. Fix quality warnings next: long critical pairs, oversized blocks/modules, poor edge/face orientation.
7. Assemble only after the preview is acceptable.
8. Route and DRC in EasyEDA/client tools after assembly.

Do not assemble every attempt. Iterate placement from the preview and report.

## Mechanical Preview Mode

Use preview mode when you only need to check a few mechanical parts: USB connectors, buttons, LEDs, edge pads, board pads, mounting holes, antenna/display keepouts, or face orientation. This is much faster than placing the full board.

```js
board.roundedRect(50, 35, { radius: 2, layers: ["top", "bottom"], clearance: 1.0, edge: 2.0 });
solver({ preview: true, placeOnlyComponents: ["J2", "SW1", "LED1"], grid: 0.5 });

component("J2").role("connector").top().edgeMount("bottom", { overhang: 1.0, face: "outward" });
component("SW1").role("connector").top().edgePlace("right", { inset: 1.0, face: "outward" });
component("LED1").role("indicator").top().edgePlace("bottom", { inset: 1.0, face: "any" });
```

Preview behavior:

- `placeOnlyComponents` resolves footprints and places only the listed circuit/boardPad designators.
- `ignoreComponents` excludes listed designators and also enables preview mode. Do not combine it with `placeOnlyComponents`.
- Unrelated blocks, modules, hints, critical pairs, capClusters, and component rules are filtered out before placement.
- Selected components without explicit block ownership are put into an automatic `preview_auto` block, so a one-button preview can stay short.
- The report will show `status: preview` and `PREVIEW ONLY: true` when there are no hard placement errors.
- Never assemble or treat a preview as the final board. Use it to verify mechanics, then write the full DSL.

## Board Defaults

Prefer `board.auto(...)` unless exact mechanical dimensions are given.

Good default starting point:

```js
board.auto({
  aspectRatio: 1.45,
  density: 0.4,
  minWidth: 40,
  minHeight: 28,
  layers: ["top", "bottom"],
  defaultLayer: "top",
  clearance: 1.3,
  edge: 2.5
});
solver({ grid: 1, ignoredSignals: ["GND"] });
```

Rules:

- `clearance` is component body-to-body placement clearance, not wire/copper DRC clearance.
- `edge` is component body distance from the real board outline.
- Lower `density` gives more board area and easier routing.
- Use `solver({ compactness: "high" })` only for intentionally tiny boards where minimum occupied size matters more than electrical/aesthetic spacing.
- For exact mechanical boards use `board.rect`, `roundedRect`, `chamferedRect`, `notchedRect`, `circle`, `oval`, `L`, `inverseL`, or `polygon`.
- For non-rectangular boards, anchors still refer to the board bounding box, but placement/outside checks use the real outline.

## Component Ownership

Every real component should belong to exactly one block.

A block should be a physical placement island:

- Prefer one main block for the main IC/core component.
- Put support parts in small satellite blocks attached to the main block.
- Keep blocks under about 12 components. Split larger groups by function, side, pin group, or supply rail.
- A block should normally be connected by at least one non-GND net. If it is an intentional mechanical/same-role array, set `allowDisconnected: true`.
- Components in one block should be on one side/layer. Split top and bottom placement into different blocks.

Use modules as soft macro groups of blocks:

```js
module("mcu", ["mcu_core", "clock", "flash", "mcu_decoup_a", "mcu_decoup_b"], {
  anchor: anchor("board.center")
});
```

Do not use modules to force a giant sparse rectangle. If a module contains connectors on different edges, it may become too large and should be split.

## Main/Satellite Pattern

Use this pattern for dense ICs, regulators, sensors, and radios:

```js
block("mcu_core", ["U1"], "mcu");
block("clock", ["X1", "C12", "C13"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "20")
});
block("flash", ["U3", "C5"], "mcu", {
  placement: "satellite",
  attachTo: "mcu_core",
  anchor: pin("U1", "52")
});

component("U1").block("mcu_core").role("main_ic").top();
component("X1").block("clock").role("crystal").top();
component("C12").block("clock").role("decoupling_cap").top();
component("C13").block("clock").role("decoupling_cap").top();
component("U3").block("flash").role("main_ic").top();
component("C5").block("flash").role("decoupling_cap").top();
```

Do not add old solver hints such as `sidePreference`, `maxBboxWidth`, `familyMaxWidth`, or `allowInternalRefine`; they are not part of the public DSL.

## Electrical Intent

Use pin-level constraints. `pin(...)` is much better than `comp(...)` for electrical placement.

Use `criticalPair` for short dominant pad-to-pad paths:

```js
criticalPair(pin("U1", "1"), pin("L1", "1"), {
  maxDistance: 5.6,
  hard: true,
  weight: 12,
  preferFacingPads: true
});
```

Guidelines:

- Make only the truly dominant pair hard.
- Avoid many hard pairs to the same IC pin or same tiny area.
- Use realistic `maxDistance` based on actual footprint size and placement clearance.
- Use `coreIsland`/`corePairs` for 2-3 dominant components that must be packed before the rest.
- Use `veryNear` for important soft attraction.
- Use `near`/`cluster` for rough grouping.
- Use `blockClearance` when blocks are too close or need routing channels.

## Capacitors

Use `capCluster` for capacitor banks on the same power and return nets. It is bus-aware and chooses rotations so same-net pads face the shared bus.

```js
capCluster(["C5", "C6", "C7"], {
  powerNet: "+3V3",
  returnNet: "GND",
  target: pin("U1", "9"),
  maxRows: 1,
  maxPerRow: 5,
  gap: 0.65,
  priority: "critical"
});
```

Rules:

- `capCluster` requires at least 2 capacitors.
- Every capacitor in the cluster must have both `powerNet` and `returnNet` pads.
- `target` must be a pin on `powerNet`.
- For one capacitor or non-bank decoupling, use `bypass`, `veryNear`, or `criticalPair`.
- Do not use generic line placement for capacitor banks.

## Connectors, Edge Parts, And Mechanical Objects

For ports/connectors that physically protrude outside the board, use `edgeMount`. Do not use `edgeMount` for ordinary buttons, LEDs, or connectors that stay inside the board:

```js
component("J2")
  .block("usb_connector")
  .role("connector")
  .top()
  .edgeMount("bottom", { overhang: 1.0, face: "outward" });
```

For buttons, LEDs, side-access connectors, and controls that should stay inside the board but near an edge, use `edgePlace`:

```js
edgePlace(["SW1", "SW2"], { edges: ["top", "right"], inset: 1.0, face: "outward", layer: "top" });
component("LED1").block("status").role("indicator").top().edgePlace("bottom", { inset: 1.0, face: "any" });
```
Use `faceTo` when only the orientation matters:

```js
component("J1").block("input_connector").role("connector").top().faceTo("board.left");
```

Use `fixed` only for true mechanical locks such as connectors, test pads, USB contacts, displays, switches, and mounting-specific parts. Do not fix normal ICs, inductors, capacitors, crystals, flash, or passives just to improve quality.

Mounting holes:

```js
boardHole.corners({ inset: 3, drill: 3.2, diameter: 3.2, keepout: 4.5 });
```

Synthetic board pads/test pads/header pads:

```js
boardPad("debug_header", {
  at: anchor("board.bottom"),
  offset: { x: 0, y: -2 },
  pitch: 1.27,
  rowPitch: 1.27,
  layer: "top",
  pads: [[
    { name: "GND", net: "GND", shape: "rect", width: 2, height: 3 },
    { name: "5V", net: "+5V", shape: "rect", width: 2, height: 3 },
    { name: "TX", net: "TX", shape: "rect", width: 2, height: 3 },
    { name: "RX", net: "RX", shape: "rect", width: 2, height: 3 }
  ]]
});
```

For `layer: "multi"`, every pad must have a real hole diameter. Use top/bottom pads when you need copper only on one side.

Existing component arrays such as edge pads or repeated headers can use `componentGrid` instead of many hand-written `fixed(...)` calls:

```js
componentGrid("left_io", [
  ["9V", "5V1", "GND3", "GND4"],
  ["TX1", "RX1", "RX2", "TX5"]
], {
  at: anchor("board.left"),
  offset: { x: 2.5, y: -10 },
  columnPitch: 2.5,
  rowPitch: 2.7,
  block: "left_io",
  role: "connector",
  layer: "top",
  rotate: 0
});
```

Use `componentGrid` only for mechanical connector/test/header/indicator arrays, not for electrical islands or decoupling.

## Constraint Regions

Use `constraintRegion` for board areas where only selected blocks may enter. This is useful for antenna keepout, motor/mechanical keepout on one side, USB tongue areas, or display windows.

```js
constraintRegion("antenna_keepout", {
  allow: { blocks: ["radio_core", "antenna_match"] },
  layers: ["top", "bottom"],
  shape: region.rect({ anchor: anchor("board.top"), width: 16, height: 6 })
});
```

Constraint regions affect board-level placement only. They do not create copper keepouts or DRC rules; set those in EasyEDA/client tools.

## Reference Designators

Reference text is placed automatically on the same side as the component.

```js
silkscreen.designators({ height: 1.1, rotations: [0, 90], margin: 0.25 });
component("U1").designatorText({ height: 1.0, rotations: [0] });
component("LED1").designatorText({ enabled: false });
```

Use `[0, 90]` unless there is a reason to restrict it.

## Anti-Patterns

Avoid these:

- One huge `mcu` or `buck` block with every support component inside.
- Components not assigned to a block.
- Mixed top/bottom components inside one block.
- `fixed` on normal electrical components.
- Stale DSL options not declared in `dsl.ts`.
- `comp("block_name")`; use `block("block_name")` for block targets.
- Manual coordinate tuning after a bad preview. Change block structure, anchors, capCluster, critical pairs, clearances, board size, or constraint regions instead.
- Routing, copper polygon, stitching, wire width, or via rules in placement DSL. Board outline polygon via `board.polygon(...)` is allowed.

## Reference Patterns

### Buck/Buck-Boost Regulator

```js
board.roundedRect(35, 25, { radius: 1.8, layers: ["top", "bottom"], clearance: 0.6, edge: 1.8 });
solver({ grid: 0.5, ignoredSignals: ["GND"] });

block("input_connector", ["J1"], "connector", { placement: "main", anchor: anchor("board.left") });
block("output_connector", ["J2"], "connector", { placement: "main", anchor: anchor("board.right") });
block("regulator_core", ["U1", "L1"], "power", { placement: "main", anchor: anchor("board.center") });
block("input_caps", ["C2", "C3", "R2"], "power", { placement: "satellite", attachTo: "regulator_core", anchor: pin("U1", "2") });
block("output_caps", ["C5", "C6", "C7"], "power", { placement: "satellite", attachTo: "regulator_core", anchor: pin("U1", "9") });
block("feedback", ["R3", "R5", "C1", "C8"], "analog", { placement: "satellite", attachTo: "regulator_core", anchor: pin("U1", "8") });
block("auxiliary", ["C4", "R4"], "analog", { placement: "satellite", attachTo: "regulator_core", anchor: pin("U1", "6"), allowDisconnected: true });
module("regulator_family", ["regulator_core", "input_caps", "output_caps", "feedback", "auxiliary"], { anchor: anchor("board.center") });

component("J1").block("input_connector").role("connector").top().edgeMount("left", { overhang: 1.0, face: "outward" });
component("J2").block("output_connector").role("connector").top().edgeMount("right", { overhang: 1.0, face: "outward" });
component("U1").block("regulator_core").role("main_ic").top();
component("L1").block("regulator_core").role("passive").top();
component("C2").block("input_caps").role("decoupling_cap").top();
component("C3").block("input_caps").role("decoupling_cap").top();
component("C5").block("output_caps").role("decoupling_cap").top();
component("C6").block("output_caps").role("decoupling_cap").top();
component("C7").block("output_caps").role("decoupling_cap").top();
component("C1").block("feedback").role("decoupling_cap").top();
component("C8").block("feedback").role("decoupling_cap").top();
component("C4").block("auxiliary").role("decoupling_cap").top();
component("R2").block("input_caps").role("passive").top();
component("R3").block("feedback").role("passive").top();
component("R5").block("feedback").role("passive").top();
component("R4").block("auxiliary").role("passive").top();

coreIsland("switch_loop", ["U1", "L1"], {
  pairs: [[pin("U1", "1"), pin("L1", "1")], [pin("U1", "10"), pin("L1", "2")]],
  maxDistance: 5.6,
  hard: true,
  weight: 12,
  preferFacingPads: true
});
criticalPair(pin("U1", "2"), pin("C3", "2"), { maxDistance: 4.8, hard: true, weight: 10, preferFacingPads: true });
criticalPair(pin("U1", "9"), pin("C5", "2"), { maxDistance: 4.8, hard: true, weight: 10, preferFacingPads: true });
criticalPair(pin("U1", "8"), pin("R3", "2"), { maxDistance: 4.0, hard: true, weight: 9, preferFacingPads: true });

capCluster(["C2", "C3"], { powerNet: "BAT+", returnNet: "GND", target: pin("U1", "2"), maxRows: 1, gap: 0.65, priority: "critical" });
capCluster(["C5", "C6", "C7"], { powerNet: "+3V3", returnNet: "GND", target: pin("U1", "9"), maxRows: 1, maxPerRow: 5, gap: 0.65, priority: "critical" });
```

### Tiny USB Stick Board

```js
board.polygon([
  { x: -20, y: -6 }, { x: -10.5, y: -6 }, { x: -10.5, y: -9 }, { x: 20, y: -9 },
  { x: 20, y: 9 }, { x: -10.5, y: 9 }, { x: -10.5, y: 6 }, { x: -20, y: 6 }
], { layers: ["top", "bottom"], defaultLayer: "top", clearance: 0.1, edge: 0.1 });
solver({ grid: 0.5, ignoredSignals: ["GND"], compactness: "high" });
silkscreen.designators({ enabled: false });

constraintRegion("usb_tongue", {
  allow: { blocks: ["usb_contacts"] },
  shape: region.rect({ anchor: anchor("board.left"), width: 9.5, height: 12 })
});

block("usb_contacts", ["X1"], "connector");
block("mcu_core", ["U1"], "mcu");
block("flash", ["U3", "C5"], "mcu", { placement: "satellite", attachTo: "mcu_core", anchor: pin("U1", "52") });
block("clock", ["U4", "R5", "C2", "C3"], "mcu", { placement: "satellite", attachTo: "mcu_core", anchor: pin("U1", "20") });

component("X1").block("usb_contacts").role("connector").top().fixed({ x: -15, y: 0, layer: "top" }).faceTo("board.left");
component("U1").block("mcu_core").role("main_ic").top();
component("U3").block("flash").role("main_ic").top();
component("U4").block("clock").role("crystal").top();

criticalPair(pin("U3", "6"), pin("U1", "52"), { maxDistance: 10, priority: "critical", preferFacingPads: true });
criticalPair(pin("U4", "3"), pin("U1", "20"), { maxDistance: 7, priority: "critical", preferFacingPads: true });
```

