# Schematic workflow

Use this workflow without continuing to PCB work unless the user explicitly asks for it.

## Create or modify

1. Resolve the target schematic and functional page.
2. Open that page and read it with `get_current_page_schematic`.
3. Search only unknown parts with `component_search` and use explicit, resolved components.
4. Apply related changes with `extract_circuit_on_current_page`. Prefer one coherent call per page; multiple calls are allowed when staged checking is safer.
   - Inspect the returned `sheetSpace`.
   - If less than `10%` remains, finish the current function and continue substantial independent work on another functional page.
5. Run `beautify_schematic_on_current_page`:
   - required after removal, replacement, or connection reassignment;
   - recommended after completing a new AI-generated page;
   - requires every component on the current page, grouped exactly once.
   - Keep `draw_block_box: false` unless the user wants Copilot-managed functional boxes and labels.
6. Follow [schematic verification](verification.md); reread the page when exact connectivity readback is needed.
7. Report the affected page and stop at the schematic boundary.

Beautify creates a checkpoint and restores it automatically if destructive page replacement fails. A successful beautify still changes the visual placement of the entire page. Warn the user first when preserving a manually arranged page matters.

## Beautify only

1. Read the current page.
2. Group all components by completed electrical function.
3. Call beautify once.
4. Apply [schematic verification](verification.md) to current-page readback.
5. If verification proves the result electrically incomplete or wrong and a safe revision is unavailable, restore it. For a purely aesthetic preference, keep, revise, or restore according to the user's stated preference.
