# PCB layer count, rules, copper, and routing

Use `run_pcb_router_dsl` after opening the exact target EasyEDA PCB. Read the local [dsl.ts](dsl.ts) as the LLM syntax reference. The router package has a separate reference, intentionally maintained independently; use the path reported by the tool when diagnosing an unsupported method or version mismatch. Do not invent helpers. Dimensions in this DSL are millimeters; routing layers are `TOP`, `BOTTOM`, and `INNER_n`. `preview_pcb` also uses uppercase layer names such as `TOP` and `BOTTOM`; its special all-layer selector is lowercase `all`. Placement DSL layer names use lowercase `top`/`bottom`.

Each file is JavaScript statements with exactly one terminal call. Write it to an absolute path on the MCP host, then pass that path as `file`. Do not put TypeScript declarations, imports, shell commands, or KRT CLI flags in the file.

Use the DSL for the routing plan and scoped repairs. For a precise native edit or a missing feature, such as a copper keepout, follow [execute_js](../execution/instructions.md). Use it when DSL attempts cannot resolve a diagnosed problem or when the local edit is clearly simpler to express directly. Check the result with [routing verification](verification.md).

This workflow may start from an existing placement, but placement and routing are one coupled physical problem. Before full routing, verify that the placement offers plausible critical-signal, power, return, dense-package escape, via, and thermal paths under the intended stack. A routing-only request does not authorize moving components: when placement is the root cause, report the exact bottleneck or return to the placement workflow only when the requested scope allows it. Do not conceal a bad placement with repeated routing attempts.

## Plan globally, route in manageable transactions

For new or full-board routing, plan the complete board before splitting work. Establish:

- copper-layer structure;
- fabrication and DRC limits;
- power-net currents;
- controlled impedance and length/skew requirements when verified physical data exists;
- planes, required polygons, and required via stitching;
- routing scope, net importance, and via preferences.

Plan critical routes and their return paths together. The following is a **recommended starting sequence**. Adapt, combine or reorder passes to suit the board's topology, stack, return paths, existing copper and observed routing results. A board with adequate ground copper may need no auxiliary GND pass; an incremental task may need only a local repair. Choose the sequence that satisfies the actual design requirements.

```text
Suggested order (adapt to the board):
CRITICAL CIRCUITS -> AUXILIARY GND CONNECTIONS -> ORDINARY CIRCUITS -> POUR/STITCHING -> FINAL CHECKS
```

1. **Critical circuits.** Usually begin with power paths, differential pairs, controlled-impedance signals, length-matched groups, crystal/resonator and clock connections, RF paths and sensitive analog/feedback circuits. Critical means that current capacity, coupling, impedance, timing, noise or local loop geometry constrains the route. Give these requirements priority when choosing and evaluating the routing strategy.
2. **Auxiliary GND connections.** Where a ground passage needs protection, reserve it with legal narrow tracks and useful vias while preserving useful critical copper. In this suggested sequence, the reservation precedes ordinary routing. Plan the eventual pour at the outset; a critical return branch retains its current and loop requirements and is not reduced to an auxiliary minimum-width track.
3. **Ordinary circuits.** Route the remaining unconstrained connections while preserving critical copper and necessary ground passages. Repair local failures within their scope.
4. **Pour and stitching.** Finalize the chosen ground pours, useful stitching and remaining ground connections once the relevant routing stabilizes. Earlier reference copper can remain when it supports the chosen strategy.
5. **Final checks.** Verify whole-board connectivity, actual filled copper, critical constraints and native DRC. Recheck affected critical routes after any later repair.

Each transaction is one DSL file and one `run_pcb_router_dsl` call with exactly one terminal. `runAll()` applies the intent declared in that transaction; it does not require routing the entire board in one call. Split transactions when stage boundaries help control scope or inspect progress; combine work when the board permits it. When a particular order matters, express it through scoped calls; `priority` alone does not guarantee that order across the whole board.

Use `onlyNets(...)` for a selected group or `ignoreNets(...)` for nets deliberately deferred to another stage. Keep both legs of a differential pair, every member of a length-matched group and the relevant segments of a constrained logical path together. Include the rules and physical stack data needed by each transaction; do not assume that an earlier call persisted the full physical stack.

Smaller transactions are a normal option when they make progress easier to inspect or a large attempt is too slow or unsuccessful. Reduce the next scope to a functional group or the remaining problem nets instead of repeatedly submitting the same large job. Preserve successful copper, but account for it as a fixed obstacle in later calls; use scoped `clearRouting(...)` when a diagnosed blocker must be replaced. The router still performs its own internal stages within each call.

While `status: "running"`, call `wait_operation`. Its `progress.log_tail`, when available, shows recent router activity, including stage or remaining connections when the engine reports them. Follow [operation results](../operations.md) to interpret progress and terminal results. If abandoning a large attempt to split it, use `cancel_operation` and establish that it has finished before starting another mutation on that PCB. Inspect any applied partial result before choosing the next scope. Do not run competing routing transactions in parallel.

## Ground: preserve passages, finish with connected copper

Prefer a continuous, connected ground pour as the main GND conductor and reference. Use `plane({ net, layers, region: board() })` for a board-wide pour; use `polygon(...)` for targeted copper. Auxiliary tracks preserve needed passages; vias connect pads and ground copper across layers and provide local return connections.

Identify the actual nets from connectivity, including `/GND`, `VSS`, `AGND`, or `PGND` when present. Names are not interchangeable. Preserve intentional separate grounds and their defined connection points.

1. **Plan ground with the critical circuits.** Locate narrow passages, isolated ground pads, high-current returns and signals that need a continuous reference. Choose ground layers and reserve the necessary space in the plan before routing critical circuits.
2. **Reserve vulnerable passages when useful.** In the suggested staged approach, do this after the most constrained critical routes and before ordinary routing; adjust the timing to the board's needs. Set auxiliary GND tracks to the minimum allowed by fabrication and effective DRC, normally `0.127 mm` for this workflow. Allow useful layer transitions; use ground vias wherever pads, pours or return paths need connections between layers.
3. **Continue routing while retaining useful critical and ground connections.** Existing GND tracks reserve their own copper and clearance; inspect that the useful pour corridor still exists. Add required local return vias at the stage that needs them.
4. **Finalize the ground pour and required stitching.** Once the relevant routing repairs stabilize, rebuild the planned fill as needed. Resolve remaining ground connections, inspect the filled result, and verify the entire requested scope.

The `0.127 mm` preference is for auxiliary ground routing, not a blanket width for every return current. Read `get_pcb_drc_rules` before requesting it. `runAll()` enforces a track-width floor of at least `0.127 mm`; use a wider width when fabrication or effective DRC requires it. Do not lower fabrication limits or add `minTrackWidthMm: 0.127` merely to make the example pass. A high-current ground branch or a ground connection that will remain the only conductor needs appropriate current-derived geometry.

Example auxiliary GND transaction for a plan that reserves ground after critical routing. **Confirm that GND exists and its effective minimum permits 0.127 mm**:

```js
onlyNets("GND");
signalNet("GND", {
  trackWidthMm: 0.127,
  priority: "high",
});
runAll();
```

`signalNet` supplies routing preferences for the named net; it does not change GND's electrical identity. This example scopes the whole GND net and retains the imported routable layers. Add `allowedLayers` only when the proposed layers still let every selected pad reach its ground connection, including package escapes; verify that the resulting tracks protect the intended pour passage. For a dedicated reservation pass that defers the pour, leave the plane declaration out of this file. An imported filled plane may already connect ground pads; inspect existing copper before expecting additional routes. Continue with the chosen remaining scope, retaining useful critical routes and auxiliary GND copper.

A narrow GND track guarantees neither enough width for the eventual pour nor a low-impedance reference. After filling, inspect actual copper continuity and bottlenecks. A connected ratline graph with a long thin ground neck is not sufficient evidence of a good reference plane. If the corridor is still blocked, reroute the obstructing local signal copper or revise the layer strategy within the authorized scope.

Protect only passages that need it: ground reservations can force a later ordinary signal into a longer detour. Compare the resulting signal path, ground continuity and return geometry. Preserve critical routes when adjusting local placement, auxiliary ground connections or the layer plan; do not give a ground reservation precedence over a critical circuit's requirements.

Later ground routing through vias can also connect separated islands while retaining a shorter signal route. Check whether that connection meets the current and return-path requirements: electrically connected islands still do not form a continuous reference plane on the split layer.

## Choose the ground-pour layers

Choose layers from the actual stack, signal reference needs, routing density, keepouts and component guidance. Explain the choice briefly; routine layer selection within the requested routing task does not need another approval.

- On a two-layer board, one relatively continuous ground layer can be the main reference. Add a pour on the other layer when it improves connections, return paths or shielding and can be connected usefully.
- `TOP`, `BOTTOM`, or `OUTER` can each be appropriate. `OUTER` means both external layers; it is the runtime default, not a requirement. Write `layers` explicitly so the choice is intentional.
- On a board with four or more layers, choose the reference layers from the stack. Do not pour every layer automatically.
- Respect antenna/RF copper exclusions, isolation gaps, and intentional ground partitions. Extra fill is useful only when its electrical role and connectivity are sound.

Example final pour for a board whose ground plan selects BOTTOM:

```js
plane({ net: "GND", layers: "BOTTOM", region: board() });
runCopper();
```

Use `runCopper()` when only copper generation is needed. If remaining connections also require routed tracks, declare the plane, select the actual ground net with `onlyNets(...)`, and use `runAll()`. One `plane(...)` declaration is one logical zone; `zones: 1` does not identify how many physical layers were filled.

`onlyNets(...)` and `ignoreNets(...)` select routing scope, not the scope of copper declarations or deletion. Usually defer final GND pours and broad stitching until the relevant routes stabilize; retain or create earlier reference copper when the board needs it. For a new impedance reference, follow the [reference-plane guidance](#copper-layers-and-physical-assumptions). If existing zones or vias obstruct a later repair, use scoped cleanup for the diagnosed blockers.

## Board-wide GND stitching

Use stitching where it connects useful GND copper on different layers or provides a required return connection. Do not add a board-wide grid solely because the net is named GND. A broad grid is usually best added during final ground completion; add required return vias whenever the routing strategy needs them.

Choose positions and pitch from ground-island connectivity, return-current transitions, RF requirements and clearances. Place required local return vias near the relevant transitions even when a broad grid exists. The `pitchMm: 3` below is an illustrative grid spacing, not a universal electrical rule; the same reasoning applies to `plane(...).stitching.gridMm`.

```js
viaStitch("GND_GRID", {
  mode: "grid",
  net: "GND",
  region: board(),
  pitchMm: 3,
  via: "drc-min",
});
```

## Fanout is a retry

Do not call `fanout(...)` in the first routing attempt unless the user explicitly requires it. Let normal routing escape the package first. Add fanout only when the no-fanout result shows an escape problem at a dense QFN/QFP or specific pad.

Use the smallest target: prefer `pad(...)` when only some pads fail, and use `component(...)` only when the whole dense package needs the same escape policy. Prefer `method: "auto"`; request `underpad` directly only with a clear reason. A successful fanout is committed before main routing and can consume useful routing corridors.

Keep vias off pads unless the board explicitly requires via-in-pad. Plane stitching defaults to `viaInPad: false`. Inspect generated fanout and pad/via geometry; the default does not establish a universal geometric prohibition in every routing path.

## Describe electrical intent

Let the router derive geometry from the effective rules and declared physical assumptions:

- Use `powerNet("VBUS", { maxCurrentA: 2 })` instead of calculating track width. Add temperature rise, power pads, or tap constraints only when known.
- Use `priority: "critical"` on eligible `signalNet` or `powerNet` declarations when routing priority is needed for a critical circuit. Keep its semantic constraints too: priority does not replace `powerNet` current intent, `diffPair` coupling, impedance or `matchedGroup` length requirements. Use `high` for secondary preference within a stage and leave ordinary nets at `normal`.
- Use `viaPreference: "avoid"` for short or sensitive nets where a planar route is strongly preferred. `forbid` is a prohibitive routing preference, not a replacement for a fabrication/DRC rule.
- Use semantic impedance in `signalNet` or `diffPair` only with verified stack/reference information.
- Use `diffPair` for differential pairs and `matchedGroup` for independent nets that require matched lengths; see below.
- Use `drc(...)` and `netClass(...)` for real fabrication limits, not guessed geometry.

A logical high-speed or differential path may cross series resistors, AC-coupling capacitors, ferrite beads, or common-mode chokes and therefore use different physical net names on each side. Trace the complete logical path and apply the appropriate intent to every routed segment; a net-name boundary does not make the downstream segment ordinary. Do not extend the path through shunt or protection branches.

Use semantic intent to derive current and impedance geometry. Explicit auxiliary GND width is supported by the ground workflow above; other explicit dimensions should come from the user, fabricator, pad geometry, or a verified requirement.

## Differential pairs and matched lengths

Declare a differential pair with `diffPair`: the two legs need adjacent, coupled routing as well as acceptable skew. Keep both legs in the same routing transaction. For example, after confirming these actual net names:

```js
onlyNets("USB_D+", "USB_D-");
diffPair("USB", { positive: "USB_D+", negative: "USB_D-" });
runAll();
```

Add `impedance`, `gapMm`, `maxSkewMm`, and `maxUncoupledLengthMm` from the actual interface requirements and physical stack. The example declares the pair relation; it does not establish an impedance target or sign off its geometry. Verify that both tracks follow the same corridor with suitable spacing, short uncoupled escapes, compatible transitions and a continuous reference.

Use `matchedGroup` for independent nets whose lengths must match, such as related bus signals. It constrains length without requiring adjacency: equally long routes can traverse opposite sides of the board. It cannot replace `diffPair`. When a differential path crosses series components, declare each physical pair segment and review the complete logical path.

## Existing DRC relations

Before changing existing net-class, differential-pair, or matched-length membership, call `get_pcb_drc_rules` once. It returns the compact authoritative relation state.

- `netClass`, `diffPair`, and `matchedGroup` upsert complete definitions and may replace membership.
- Use `assignNetsToNetClass`, `removeNetsFromNetClass`, or `unassignNetClass` for a targeted class edit.
- Use `addNetsToMatchedGroup`, `removeNetsFromMatchedGroup`, or `moveNetsToMatchedGroup` for a targeted matched-group edit.
- Use `deleteNetClass`, `deleteDiffPair`, or `deleteMatchedGroup` only when deletion is intended.

Do not reconstruct unrelated relations from memory or from a large PCB dump.

## Copper layers and physical assumptions

For a new or full routing transaction, declare the intended copper-layer structure with `stack(...)`. Resolve missing physical values instead of silently dropping stack-dependent intent:

1. Use the user's or fabricator's verified stack when available.
2. For an ordinary non-impedance prototype with no contrary evidence, a provisional `1.6 mm` FR-4 board and `1 oz` copper is a reasonable assumption. Declare it and report it to the user.
3. Ask for the fabricator stack when controlled impedance, flex construction, unusual thickness, inner-layer current capacity, or another requirement depends on dielectric or copper geometry.
4. Never omit `powerNet`, impedance, or another requested semantic method merely because stack data is missing. Either state a provisional stack or ask for the missing data.

Ordinary two-layer provisional example:

```js
stack({
  boardThicknessMm: 1.6,
  fallbackCopperThicknessOz: 1,
  layers: [
    { kind: "copper", name: "TOP" },
    { kind: "copper", name: "BOTTOM" },
  ],
});
```

EasyEDA accepts an even copper-layer count from 2 to 32. The routing transaction applies this count before validating routed layers. EasyEDA does not persist dielectric thickness, material, permittivity, copper thickness, or other full physical stack properties; it returns `EASYEDA_STACKUP_LAYER_COUNT_ONLY` when only the layer count is applied.

`fallbackCopperThicknessOz` is used for current-derived `powerNet` width when a layer has no explicit copper thickness. Impedance calculation requires usable copper and dielectric geometry, permittivity, and a reference plane; a board-thickness number alone is not enough. Report all provisional values and that only the copper-layer count is written to EasyEDA.

For the first controlled-impedance transaction, identify the reference plane before routing. The current compiler needs a solid imported reference or a `plane(...)` declaration as well as the physical stack; a reference-net name alone is insufficient. A declared plane is also generated after that transaction's routing, so it is not a planning-only statement. Retain the resulting zone when it supports the chosen routing strategy. If it blocks a necessary later route, temporarily remove the identified obstructing zone using scoped cleanup, preserve useful critical copper and rebuild the required pour afterward. Clearing a zone solely to follow the suggested stage order is unnecessary. Do not drop the impedance requirement to bypass missing reference data.

## Preserve and clear

Existing tracks, vias, and zones are fixed obstacles and are preserved by default. To replace existing copper, declare the exact scope in the same DSL:

```js
clearRouting({ nets: ["USB_D+", "USB_D-"], items: ["tracks", "vias"] });
```

Before repairing signals blocked by existing ground fill or stitching, inspect the affected ground copper and clear the obstructing object types in the repair transaction. For example, when both GND zones and vias can be regenerated:

```js
clearRouting({ nets: ["GND"], items: ["zones", "vias"] });
```

This selects **all zones and all vias on GND**, not only stitching vias. The selector has no stitching-only or local-region filter. Use `items: ["zones"]` when only pours obstruct the repair; include `vias` only after accounting for ordinary ground connections that must be rebuilt. Add `tracks` only when ground tracks also need replacement. Use the actual net names and preserve unrelated copper. If the net-wide selection would remove ground connections that must stay, use a precise [execute_js edit](../execution/instructions.md) of identified objects instead.

Keep deferred ground copper declarations out of the repair transaction so they do not immediately refill the cleared space. Retain passage-protecting GND tracks whenever possible. After signal repairs, rebuild removed ground connections, pours and stitching, then verify the complete board again.

Do not add `clearRouting({ nets: "all" })` by habit. A separate clear tool is not part of this workflow.

## Select one terminal

End every DSL file with exactly one terminal:

- `applyDrcRules()` for rules only;
- `applyStackup()` for copper-layer count only;
- `runCopper()` for selected polygons, planes, or stitching without KRT routing. `along` can follow retained existing tracks and `return` can use retained existing signal vias; if the required source routing does not exist, use `runRouting()` or `runAll()`;
- `runRouting()` for routing without applying DSL DRC changes;
- `runAll()` for the transaction's rules, layer count, copper, and routing intent.

## Run and verify

1. Open the target PCB and call `get_pcb_stack_layers` when current layers affect the decision.
2. For full-board routing, review complete connectivity once and classify every connected net; use targeted inspection for a partial operation. Confirm that the placement and intended layers provide plausible corridors and package escapes before starting the router.
3. Write the next DSL transaction for the chosen board-specific strategy and call `run_pcb_router_dsl({ file })`. Use the suggested critical/GND/ordinary sequence as a starting point, adapting scope and order as needed. Preserve useful copper and verify affected requirements as work advances.
4. If it returns `status: "running"`, call `wait_operation({ operation_id })` until terminal and use its progress to follow the attempt. Follow [operation results](../operations.md) for completion, cancellation, and application errors.
5. Apply [routing verification](verification.md) to the result. A useful `partial` result is already applied; diagnose its remaining work before choosing a repair.
6. Repair a concrete blocker using the procedure below, then recheck the affected scope. For full-board work, continue remaining groups and final ground completion. Stop at the requested boundary and report the verified result and unresolved findings.

## When routing does not converge

1. Identify the failing nets and location from diagnostics, progress, `inspect_net` and a focused `preview_pcb`. Distinguish an incomplete connection, a rule conflict, obstructing copper and a blocked package escape.
2. Correct the cause with a scoped DSL transaction. Preserve useful copper, include both legs of a pair and clear only diagnosed blockers. Keep actual fabrication and electrical limits.
3. Use [execute_js](../execution/instructions.md) when a precise native edit is clearly simpler or the DSL cannot express the needed repair. Examples include a local copper keepout or editing one identified obstructing object. Inspect native geometry and API semantics first; a placement exclusion is not a copper keepout. Rebuild affected pours and repeat [routing checks](verification.md) afterward.
4. If routing still cannot make progress, review the [placement](../pcb-layout/verification.md): component orientation, local density, pad escape and corridor width may be the cause. Identify the specific component or local block that needs moving. Revise it through the [placement workflow](../pcb-layout/instructions.md#iterative-local-corrections), including a focused script where appropriate, when the requested scope permits placement changes. For routing-only work, report the proposed layout change before expanding scope.

Continue targeted attempts while they produce measurable progress, such as fewer unconnected pads or blocking violations without breaking successful routes. Change the hypothesis or approach when the same failure repeats or fixes oscillate. There is no fixed attempt count; respect any user time budget and stop when requirements are met or no justified next correction remains. Report a remaining blocker with its net, location and required change.

The routing apply step uses one EasyEDA checkpoint recovery boundary and restores automatically on an application exception. A useful incomplete result remains applied, as does a successfully applied result with non-catastrophic DRC diagnostics, until the agent chooses to keep, repair, or restore it after verification. EasyEDA currently applies through vias and copper zones without holes.

The compact router response currently does not expose the automatic checkpoint ID. When manual restoration may be needed, save and retain an explicit checkpoint before the transaction; do not guess its baseline from the latest checkpoint afterward.

Ground-reference background: [TI, High-Speed Layout Guidelines (SCAA082A)](https://www.ti.com/lit/pdf/SCAA082A) explains why gaps in a reference plane disrupt signal return paths. The narrow-track passage strategy above is a workflow choice; it does not replace evaluating the final reference copper.
