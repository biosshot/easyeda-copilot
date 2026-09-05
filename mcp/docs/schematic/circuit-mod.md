# Circuit modification rules

## Component search

Prefer the exact manufacturer MPN. A descriptive query such as `1k 1% 0805 resistor` may be used only to discover candidates when an exact MPN is not yet known. Select a real returned component and keep its exact `part_uuid` and manufacturer MPN.

Never invent an MPN or UUID. Confirm package, electrical ratings, tolerance, and relevant limits before selecting among candidates. Every added component requires a real non-null `part_uuid`.

When several library results are electrically and mechanically equivalent, prefer the symbol whose returned `pin_name` values are meaningful, such as `VIN`, `EN`, or `GND`, over one whose names are only `1`, `2`, and `3`. Exact MPN, ratings, and footprint remain higher priority. Numeric pin names are normal for symmetric passives and are not a reason to reject them.

## Functional blocks

Group components by a completed function and local signal path, not by component type.

- Keep an op-amp, transistor, regulator, or main IC with the input, feedback, gain, bias, compensation, and local filtering parts that make its stage work.
- Do not split one amplifier into separate `OpAmp` and `Resistors` blocks.
- A one- or two-component block is appropriate only for a self-contained function or endpoint, such as a connector, fuse, or LED with its resistor.
- If extraction produced fragmented block names, correct them in one final beautify call.

## Extraction

`extract_circuit_on_current_page` can add and remove components and change external connections on the opened page.

- Replace a component by removing it and adding the replacement with the same base designator.
- Use identical `signal_name` values for pins on the same net.
- For an intentionally unconnected pin, leave `signal_name` empty (`""`).
- Using `NC` as a signal name or net label is forbidden. Never use it as a no-connect marker or placeholder.
- Do not add unrelated protection, filtering, or future signals unless requested or required by the selected proven block.
- Combine known related changes, but do not force unrelated or risky work into one call merely to reduce tool count.
- Read the returned `sheetSpace`. When it warns that less than `10%` remains, continue substantial new work on the appropriate functional page instead of packing more independent circuitry onto the current page.

## Reused blocks

Search by function, inspect returned parameters and ports, and use the exact block UUID. Map every exposed port to an intentional signal name. A close but unsuitable reused block is not preferred over a correct explicit circuit.
