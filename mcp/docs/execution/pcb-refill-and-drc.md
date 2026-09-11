# Rebuild PCB pours and check native DRC

Use after authorized copper/keepout edits when fills are pending or stale. Reuse a router's completed native check when no subsequent edits occurred; a second DRC call is not inherently required. Operation completion, selected-net connectivity, whole-board connectivity and DRC clearance are separate results.

Copy [examples/pcb-refill-and-drc.js](examples/pcb-refill-and-drc.js) to a task file, replace `REPLACE_WITH_TARGET_PCB_UUID` with the observed PCB UUID, and call `execute_js({file_path: absolutePath})`. It rebuilds all existing pours sequentially, reports failures and undefined results separately, reads resulting fill counts, then returns the full native DRC. It does not create pours, alter routing/rules, save/reopen the PCB, or switch layers. Large results become artifacts.

Read `refill_confirmed` and `drc_passed` separately. A returned poured primitive confirms the API returned a rebuild result, not that every island is useful or connected. `undefined` is unconfirmed, not success; partial rebuilds remain applied on failure. A clean DRC cannot turn a failed refill into confirmed fresh copper.

Document UUID checks detect a different active document at the check points. They are not revision locking: the user can edit the same document or switch away and back. No atomic revision or dedicated ratsnest-refresh API is promised here. If connectivity appears stale, finish the script, call `sync_current_document` once (it saves, closes and reopens), obtain new references and repeat the needed checks. Never sync/retry while an execution is still unresolved.

Afterward inspect `preview_pcb` on the needed layers. Its polygons include native poured fills, but the rendering call itself provides no freshness guarantee. Resolve DRC primitive IDs through native getters; do not convert raw DRC positions as if they were standard PCB API coordinates.
