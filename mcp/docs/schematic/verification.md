# Schematic verification

Check the affected page before finishing or continuing to PCB work. Reuse current readback; call `get_current_page_schematic` when exact components or connectivity have not yet been confirmed after the edit.

- Confirm intended parts, values, packages, pins and net names. Trace changed connections through the functional circuit, including supply and return connections and intentionally unconnected pins.
- Confirm that unrelated circuitry and functional page ownership are preserved.
- After beautify, confirm every current-page component belongs to exactly one functional block and that electrical connectivity is preserved. Inspect the presentation when visual organization was requested.
- Review extraction's `sheetSpace`; below `10%` free is a reason to put substantial independent circuitry on another functional page.

Repair a concrete omission or wrong connection on the affected page, then reread it. Use [recovery](../recovery.md) when the applied result is invalid and a safe local repair is unavailable. A purely aesthetic preference follows the user's requested style.

Report the affected pages, what was checked and any remaining issue. Schematic readback verifies the captured design; it does not establish electrical ratings, stability or other behavior that needs a datasheet or simulation.
