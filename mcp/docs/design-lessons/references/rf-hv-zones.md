# RF, high voltage and zones

The placer does not know what an antenna or a high-voltage node is; it only enforces the separations and regions written in the DSL. Antenna-region and isolation-domain detection were deliberately left out of validation because the input cannot establish their purpose or safety distance. **The agent derives the zones, with evidence, and writes them with the existing DSL.**

## Deriving zones

1. Classify nets from the full schematic: peak voltage of every rail and every node above ~50 V (transformer secondaries, multipliers, boost outputs, mains and primaries); RF pins, antenna feeds, RF connectors and modules with integrated antennas; every ground name (GND, AGND, PGND, isolated grounds, earth) and where they join, if they do; switching nodes; high-impedance or low-level analog inputs.
2. Read the datasheets for: the module's antenna keep-out and orientation; clearance, creepage and isolation voltage of optocouplers, isolators, relays and transformers; voltage ratings of every part in the high zone.
3. Write a zone table: zone, type, blocks/components, voltage or reason, evidence, which zones it must be separated from, distance and its source.
4. **Barrier parts** (transformer, opto, isolator, the top resistor of a divider, a gas discharge tube) belong to the boundary, with each side's pins facing their own zone. A block never mixes zones.
5. **Never invent safety distances.** If high voltage and logic share one ground, the separation is functional (against arcing and tracking), not galvanic isolation. Distances that protect people come from the isolation component's datasheet or a standard the user names; functional tables are not safety tables. If neither exists, ask. If the distance does not fit, enlarge the zone or the board; never reduce it.

## Writing zones in the DSL

| Need | DSL | Note |
|---|---|---|
| Hard separation between zones | `blockClearance("hv_a", "logic", 10, "critical")` | Only `critical` is hard; `high` is a preference. Apply it between every block of one zone and each neighbouring block of the other |
| Hard separation for one part | `clearance(comp("J2"), comp("J1"), 15, "critical")` | Body to body, including silkscreen |
| Reserve an area | `constraintRegion("hv_zone", { shape: region.rect({ anchor: anchor("board.top_right"), width: 46, height: 66 }), allow: { blocks: ["hv_a", "hv_b"] } })` | Keeps other blocks out; does not pull the allowed blocks in and gives no distance |
| Confine a zone | Cover the rest of the board with regions that allow only the other zone's blocks | Otherwise an allowed block can still land outside |
| Soft separation (noise) | `away(block("driver"), block("sense"), "high")` | Not for safety |

What happened on a high-voltage board: the first placement put the divider outside the HV zone (regions only keep others out), and the separation was written with priority `high`, so the measured distance came from the search and was not guaranteed. Measure every inter-zone distance after placement.

Placement clearance is not copper creepage. As separate steps: HV net classes with DRC clearance, slots (interior cutouts on the outline layer), ground-plane cuts under the HV zone, and conformal coating.

## High voltage

- Check per-part voltage ratings: 1206 resistors are rated about 200 V each; a short across an output resistor string overstressed them.
- Protect the sense path with a series resistor and a clamp before the MCU or comparator. One divider feeding both firmware and a hardware cutoff is a common-mode failure: firmware needs a plausibility check (drive running but sense near zero, stop).
- Any bridge or switch driving magnetics needs a hardware defence against a stuck input (a PWM stuck high put DC into a small transformer, under the driver's current limit): a series blocking capacitor or a retriggerable enable, plus watchdogs.
- Pluggable low-voltage terminal blocks are not acceptable on a kilovolt output; give the output a surge path.
- Isolated interfaces: PoE needs 1500 Vrms and some RJ45 jacks are rated 500 V shield to contacts; Bob Smith terminations need series capacitors; isolated DC-DCs have minimum loads.

## Antennas and RF

- **A module with an integrated PCB antenna goes in a board corner with the antenna overhanging.** Centred on an edge with ground pours beside it, it was flagged against the maker's guide on three boards; the fix was a copper-free strip across the full board width on both layers. Make that strip a native region with no pours or fills; a placement `constraintRegion` is not a copper keep-out. Delete stitching vias that land inside.
- **Fix the RF module's pose yourself.** The solver did not turn a cellular module's RF pin toward the antenna feed even with a strict `criticalPair`. Fix the block with `fixed: { reference, x, y, rotate }` computed from a preview, and keep the series parts of the RF path inline.
- **Compute 50 Ω lines with the fab's stackup and calculator.** The same coplanar geometry was recorded as ~50 Ω on one board and recalculated as 57–62 Ω on another. Never put unverified impedance numbers in an order.
- **Around RF connectors clear copper only around the centre pin**, sized to the outer conductor. Large no-pour regions left RF lines without adjacent ground. Stitch both sides of the line at ≤ λ/20.
- **Provide tuning access**: reference matching assumes the maker's ground-plane size. A pi network (0 Ω plus two DNP parts) and an RF test point (DNP u.FL, or the pads of a DNP shunt capacitor).
- An active GNSS antenna's bias comes from a regulated, switchable rail through a current-limiting resistor; check the antenna's minimum voltage after the drop.
- A module with a u.FL connector has no RF pin and can never feed a PCB trace: decide this when choosing the module.
- The router treats exported keep-outs as blocking tracks too: route RF segments that cross an antenna strip by hand (straight, no vias).
