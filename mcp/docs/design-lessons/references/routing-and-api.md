# Routing and EasyEDA API lessons

## Router

- **KRT discards the whole result if it changes fixed copper of nets outside the transaction** (`KRT_FIXED_COPPER_CHANGED`). Include neighbouring nets in the same transaction; one board had to route all signal nets in one transaction (ground excluded) instead of block by block. Footprint vias without a net also trigger it (see [library parts](schematic-and-library.md#library-parts-and-footprints)).
- **Each `run_pcb_router_dsl` rewrites the board's DRC rules with that transaction's rules.** A `diffPair` created a 10-mil skew rule that failed slow interfaces (USB full speed, RS485, 50 Hz inputs). Keep a rules script and re-apply it after routing; relax rules that do not fit an interface on purpose and in writing.
- **Grid stitching (`viaStitch`) ignores native pours** and drops vias into antenna and isolation keep-outs and onto isolated islands. After every pour, delete vias inside keep-outs, or compute via sites from `getPourFills()` where both layers are ground with margin.
- **On 2-layer boards decide before routing which long nets may use the bottom layer.** Long control lines across the board cut the bottom pour into strips and isolated 88 small ground pads. The fix was dedicated vias, re-routing about ten signals, rotating small passives so both pads land on the main pour island, and later moving the line drivers next to the MCU.
- **When routing around an MCU does not converge, reassign its GPIOs by geometry** so each function faces its destination. Repeating passes with more permissions made it worse; reassignment took open nets from 3–10 to 0 on the first try.
- **When the router cannot close the last nets, use local geometry tools**: export copper and real fills, compute ground islands, run a fine-grid A* with per-class clearance, rip up blocking neighbours, then smooth. On a dense fine-pitch analog area this routed clean where the router left 11 nets open. See the [local SDK](../../execution/local-sdk.md) and [Shapely geometry](../../execution/shapely-geometry.md).
- **Check router output for vias in pads and vias crowding pads without a net** (NC pins).
- **Widen power tracks after routing with a clearance-aware script**: give each segment the widest width that keeps clearance, limited to pad width on small SMD pads, nets in priority order, then set net-class minimums to the achieved width and estimate the voltage drop.
- **Treat a same-net pour fragment as an open until its connection is proven.** On a 2-layer board, long signal lines cut the bottom pour and left 88 ground pads on islands while the pour still looked continuous. After every refill, check each fragment of a plane net reaches the main area through real copper or stitching vias.
- **After saving and refilling, check that every via kept its net.** Footprint vias without a net never joined the pour, and the router treated them as foreign copper. `get_current_pcb` lists vias without `net`.
- **Leave plane around ground vias** (~0.25 mm); a via surrounded by other vias' antipads ended up isolated.
- **After rip-up, net changes or NC'ing pads, delete stray stubs**; tracks had used module pads as ground pass-throughs. Run a dangling-track check and confirm the plane still connects.
- **Adding parts to a dense routed board**: find free spots by script (Shapely over pads, tracks and vias with rule clearance) and route only the affected nets (`onlyNets(...)` respected existing copper). Put test points on the net's own track or a short stub and exclude them from BOM and placement files.
- *Uncertain, check in the current version:* repeated `runAll()` with `plane()` added duplicate pours (11 identical zones on one layer). Declare each plane once.

## EasyEDA API behaviour

- **`setState_*` does not persist until `done()`.** The same object shows the new value; a fresh `get()` shows the old one. Verify with a new `get()` or the document source. Enums such as `ESCH_PrimitiveComponentType` are not globals in `execute_js`; compare with the string value (`'part'`).
- **Call `sync_current_document` after API edits, before DRC or readback.** API-created tracks showed false connection errors, and designator moves stayed invisible, until sync.
- **Refill pours before trusting DRC** ([refill and DRC](../../execution/pcb-refill-and-drc.md)).
- **EasyEDA counts tangent copper joins as connected.** A track end that only touched another track's edge passed DRC, but the Gerber's copper islands showed the net split. Check T-joins for real overlap, or analyse Gerber islands before ordering.
- **`preview_pcb` was unusable for planes in reviews** (cropped, no tracks or fills), and the board outline from `get_current_pcb` was once incomplete. Rely on `inspect_net`, polygon data and native DRC, or render the canvas natively.
- **Restore checkpoints only by explicit ID**; read-only scripts also create checkpoints.
- **Instances can be stale.** After an extension update two instances were connected; select the newer one. Instance names refresh only after a project is opened there.
- **`import_pcb_changes` may not open its dialog the first time**; retry with `schematic_uuid` and confirm the components are on the PCB before placing.
