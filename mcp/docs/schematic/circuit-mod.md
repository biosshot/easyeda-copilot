# Circuit modification rules

## Component search

Prefer the exact manufacturer MPN. A descriptive query such as `1k 1% 0805 resistor` may be used only to discover candidates when an exact MPN is not yet known. Select a real returned component and keep its exact `part_uuid` and manufacturer MPN.

Never invent an MPN or UUID. Confirm package, electrical ratings, tolerance, and relevant limits before selecting among candidates. Every added component requires a real non-null `part_uuid`.

Keep `part_uuid` exactly as returned by `component_search`. LCSC devices use the legacy UUID string. Other EasyEDA Pro libraries use `{ "uuid": "...", "libraryUuid": "..." }`, so schematic placement and PCB footprint resolution use the same device and library. Search and exact resolution accept an alias returned by `library_list` or an explicit accessible public-library UUID; public aliases are canonicalized to the component owner's library UUID before assembly.

Copilot stores the original reference in the component's `EasyEDA Copilot Part Ref` property for both LCSC and public devices. EasyEDA v3 assigns project-local device IDs after placement. Existing LCSC components retain supplier-code lookup as their first recovery path. Only remaining unresolved local IDs trigger recovery from the project's DEVICE `META.source`, waiting at most 20 seconds. Missing APIs, export failures and timeouts do not fail schematic readback: unresolved components retain `part_uuid: null`. Locally authored devices without an original public source still require a resolvable library reference.

When several library results are electrically and mechanically equivalent, prefer the symbol whose returned `pin_name` values are meaningful, such as `VIN`, `EN`, or `GND`, over one whose names are only `1`, `2`, and `3`. Exact MPN, ratings, and footprint remain higher priority. Numeric pin names are normal for symmetric passives and are not a reason to reject them.

## Functional blocks

Group components by a completed function and local signal path, not by component type.

- Keep an op-amp, transistor, regulator, or main IC with the input, feedback, gain, bias, compensation, and local filtering parts that make its stage work.
- Do not split one amplifier into separate `OpAmp` and `Resistors` blocks.
- A one- or two-component block is appropriate only for a self-contained function or endpoint, such as a connector, fuse, or LED with its resistor.
- If extraction produced fragmented block names, correct them in one final beautify call.

## Extraction

`extract_circuit_on_current_page` can add and remove components and change external connections on the opened page.

Pass circuit fields directly, or provide `file_path` to a UTF-8 JSON file containing the same circuit modification object. Do not combine both input modes.
Omitted change lists are treated as empty, so include only the changes the call needs.

- Replace a component by removing it and adding the replacement with the same base designator.
- Use identical `signal_name` values for pins on the same net.
- Optionally set `port_style` to `in`, `out`, or `bi` on a pin when its generated net port needs that appearance. The style belongs to this connection, not to the whole block or net. Omit it when no direction is intended; power and ground symbols take priority.
- For an intentionally unconnected pin, leave `signal_name` empty (`""`).
- Using `NC` as a signal name or net label is forbidden. Never use it as a no-connect marker or placeholder.
- Do not add unrelated protection, filtering, or future signals unless requested or required by the selected proven block.
- Combine known related changes, but do not force unrelated or risky work into one call merely to reduce tool count.
- Read the returned `sheetSpace`. When it warns that less than `10%` remains, continue substantial new work on the appropriate functional page instead of packing more independent circuitry onto the current page.

`extract_circuit_on_current_page` mutates the current schematic page as a managed operation. It waits up to 50 seconds and always includes `operation_id` after registration; use `wait_operation` while running and `list_operations` if the initial response was lost. Quick completed responses retain their previous fields and include `checkpointId`.
