# Electrical layout rules

These are the electrical rules that kept coming back while reviewing placements and routes made with this MCP. They are general engineering, not tool quirks. This file keeps them as decisions with numbers, and says where the tools help or fall short. The numbers are rules of thumb: the device datasheet and the fab's capabilities override them. For depth, see [Further reading](#further-reading).

## 1. Classify the nets before placement

- **Fast means a fast edge, not a high clock.** The knee frequency is about 0.35–0.5 / rise time, and about 2.5 × the bit rate for serial links. A 10 MHz SPI with 2 ns edges carries content up to about 250 MHz.
- **A net is a transmission line when it is long compared with the wavelength.** The usual threshold is a length above about λ/12 at the knee frequency. On FR-4, signals travel at roughly 150 mm/ns on inner layers and 175 mm/ns on outer layers, so:

| Knee frequency | λ on FR-4 | Treat as a line above |
|---|---|---|
| 50 MHz | ~3 m | ~250 mm |
| 100 MHz | ~1.5 m | ~125 mm |
| 500 MHz | ~300 mm | ~25 mm |
| 1 GHz | ~150 mm | ~12 mm |

- **Count any off-board cable in the length.** A short trace that continues into a 1 m cable is a long line.
- **Delay on FR-4** is about 5.7 ps/mm on outer layers and 6.7 ps/mm on inner layers (roughly 145 and 170 ps/in). Use it to turn skew budgets into length budgets: 1 mm of mismatch is about 6–7 ps.
- **Write the classification into the schematic before layout**: impedance class per net, `_P`/`_N` names for pairs, and which nets carry high current. The placement DSL and the router can only respect what the schematic declares.
- **Group each interface's parts on one schematic page** (Ethernet PHY and magnetics, USB connector and ESD), so the placement blocks follow function.

## 2. Impedance targets and stackup

- **Take the target from the datasheet of each interface.** Typical values, all ±10–15 %:

| Interface | Differential | Single-ended |
|---|---|---|
| USB 2.0 / 3.x | 90 Ω | 50 Ω |
| PCIe (gen 3 and later; earlier gens 100 Ω) | 85 Ω | 50 Ω |
| Ethernet (MDI), HDMI, MIPI D-PHY, SATA, LVDS | 100 Ω | 50 Ω |
| RS485 / CAN (termination; board traces short and not critical) | 120 Ω | — |
| RF lines, antennas | — | 50 Ω |
| Video (analog) | — | 75 Ω |

- **Compute widths and gaps with the fab's own stackup and calculator** (for JLCPCB, one of its listed stackups). Read the board layers with `get_pcb_stack_layers`. Do not assume a datasheet εr: the same coplanar geometry gave about 50 Ω on one board and 57–62 Ω on another.
- **Ask the fab for impedance control on those layers**: a target impedance per layer, checked with coupons, typically ±10 %. Asking only for "controlled dielectric" (thickness held to about ±10 %) does not guarantee the impedance.
- **Give controlled traces a width that no other trace uses** (for example 0.127 mm when the other signals use 0.15 mm), so the fab can identify them. List the target per layer in the fab notes.
- **Geometry sanity limits** that keep a pair buildable and predictable:
  - the gap inside a pair at most 2 × the trace width;
  - the trace width at most 2 × the height to the nearest plane;
  - signal layers within about 0.25 mm of their reference plane.
- **On four or more layers, every signal layer needs an adjacent solid plane.** Fast nets go on the layers next to ground. A common 4-layer order is signal, ground, power, signal, with the components on the side next to ground.
- **Stack the board symmetrically and keep its build simple**:
  - no more than about three prepreg types, each thinner than about 0.25 mm;
  - avoid high-glass, low-resin prepregs (7628, 2116) where impedance matters.
- **Choose the laminate by loss at the knee frequency**:
  - standard FR-4 is fine up to about 2.5–3 GHz;
  - mid-loss materials up to about 10 GHz;
  - low-loss or PTFE materials (Rogers class) above that, or for RF lines that must stay precise.
  - FR-4's εr falls with frequency (about 4.7 to about 4 above 5 GHz), which smears fast edges.
- **On fast pairs, open glass weave causes skew.** One line can sit over glass and the other over resin. Use a tight weave or spread glass, or route pairs at a small angle to the weave.

## 3. Placement

- **Place in this order**:
  1. Connectors and main ICs, as the mechanics and the signal flow require.
  2. Their crystal, decoupling and termination parts.
  3. Everything else.
  - Terminations placed last end up with stubs. Series resistors go right after the driver pin; parallel ones go at the receiver pin with the shortest stub.
- **Floorplan by function** (power, RF, digital, analog) so that no signal has to cross another block. Keep switching supplies away from RF and analog inputs. Never place one block's parts inside another block's area.
- **Keep fast parts and their nets away from the board edge and from unrelated connectors.** Impedance changes near the edge and connectors radiate. The exception is the connector's own interface.
- **Put protection parts at the connector they protect**, on the cable side, with no via between the connector and the clamp.
- **Align similar parts in the same direction**, and keep SMD parts on one side when possible. Both help assembly and the router.
- **Decide where heat goes** before placing a part that dissipates. The chain is: thermal pad, then vias, then a copper area on both sides, then airflow or the enclosure.
  - FR-4 conducts 0.2–0.5 W/m·K, against 386 W/m·K for copper: heat must travel through copper.
  - Keep tall parts out of the airflow to hot parts.
  - Consider a metal-core board for power LEDs and dense power stages.

## 4. Routing: the return path

- **For every fast net, check the reference under its whole length** with `inspect_net` and the layer fills.
  - A trace over a split, a slot or a row of via antipads forces the return current to detour, and the loop radiates.
  - Keep the plane at least 3 trace widths beyond each side of the trace.
- **Space vias about 0.4 mm apart in dense areas** so the plane passes between their antipads; a row of touching antipads is a slot.
- **When a fast net changes layer, put a ground via next to the signal via**, between the two vias of a pair if possible.
  - If the new reference is a different net (a power plane), put a 10–100 nF capacitor between the two references next to the crossing.
  - If both references are ground, a copper bridge under the trace is better than a capacitor.
- **Put ground vias at both ends of a fast net**, at the driver and at the receiver, so the return uses the plane and not a thin ground trace.
- **Prefer ground over power planes as reference.** When a power plane must serve, the decoupling capacitors at both ends double as return paths if they sit at the signal's entry and exit.
- **Crosstalk**:
  - keep about 3 trace widths between unrelated fast nets, more for clocks;
  - shorten parallel runs;
  - route adjacent layers crosswise;
  - keep traces close to their plane;
  - if a guard trace is needed, ground it with vias along its length, because a floating guard couples.
- **Avoid stubs**: route pull-ups and pull-downs on fast nets as a daisy chain through the resistor pad, and avoid T branches.
- **Use few bends, at 135° or arcs.** Avoid acute angles; 90° corners are a manufacturing issue more than an electrical one at these speeds.
- **One solid ground beats split grounds.** If a converter needs a quiet area, keep that area's traces from crossing the dividing line instead of cutting the plane. If the plane must be split, join the parts at one point near the converter (ferrite or 0 Ω) and route every crossing trace over that point.

## 5. Differential pairs

- **Keep both lines together, symmetric, on the same layer and with the same number of vias.**
  - Nothing goes between them, neither vias nor parts.
  - Keep pair-to-pair spacing at least 5 × the trace width, about 0.75 mm to other nets and about 1.25 mm to clocks.
- **Place AC-coupling and ESD parts symmetrically**, in the smallest package that suits (0402; avoid 0805 and arrays). Put a ground via next to each pair of layer-change vias.
- **Match length segment by segment**, close to the bend or via that creates the mismatch.
  - A match on the total length can hide a large mismatch in between, and DRC only checks the total.
  - Two opposite bends less than about 15 mm apart cancel each other.
  - Serpentines need a gap of at least 4 × the trace width between turns and straight segments of at least 1.5 × the width.
  - A symmetric breakout from the pads is better than any serpentine.
- **Check how the tool counts length**: some count the trace inside a pad, so give both lines the same pad entry.
- **A `diffPair` in `run_pcb_router_dsl` rewrites the DRC rules** (see [routing](routing-and-api.md)). Apply tight skew only where needed:

| Interface | Intra-pair skew to target |
|---|---|
| USB high speed (480 Mb/s) | ≤ ~1 mm (vendor limits range from about 0.15 to 1.25 mm) |
| Ethernet 100 Mb/s | ≤ ~1.25 mm |
| USB full speed (12 Mb/s), RS485, CAN | not critical |

  Check each value against the PHY or controller datasheet.

## 6. Decoupling and power delivery

- **The mounting loop matters more than the capacitor.** The internal ESL of an 0402 MLCC is about 0.5–1 nH, but its pads, traces and vias easily add a few nH.
  - Put the via to the plane at the pad, keep traces short and wide, and keep the power and ground planes close together.
  - Two vias spaced 1 mm apart through a 1.6 mm board add roughly 1.5 nH.
- **Each MLCC only helps around its self-resonance.** Typical values for 0402–0805:

| Value | Self-resonance |
|---|---|
| 10 µF | ~2–3 MHz |
| 1 µF | ~6–10 MHz |
| 100 nF | ~20–30 MHz |
| 10 nF | ~70–90 MHz |
| 1 nF | ~200–300 MHz |

  Smaller packages resonate higher. Several identical capacitors divide the ESL. Two different values in parallel create an impedance peak between their resonances; fill it with a third value or use one value. Very low ESR makes that peak higher.
- **For a large or fast digital load, size decoupling against a target impedance**: Z_target = rail voltage × allowed ripple / (0.5 × peak current).
  - Example: a 3.3 V rail with a 500 mA radio burst and 5 % ripple gives Z_target ≈ 0.66 Ω, easy with a few MLCCs and a bulk capacitor.
  - A 1.2 V core at 2 A and 3 % gives about 36 mΩ, which needs planes and many capacitors.
  - The regulator covers up to a few kHz, bulk capacitors from about 1 kHz to 100 kHz, MLCCs from about 100 kHz to 100 MHz, and a close plane pair the hundreds of MHz.
- **Check each capacitor's band against the target impedance.**
  - A bulk capacitor works below about √(Z_target² − ESR²) / (2π · ESL); above that it is inductive.
  - For MLCCs, the count needed is roughly the mounted ESL per capacitor divided by the ESL that meets the target at the top frequency.
  - Choose bulk ESR around half the target, not the lowest available.
- **A close power/ground plane pair is a capacitor**: about εr · 0.00885 · A / h pF, with A in mm² and h in mm. A 100 × 60 mm pair 0.1 mm apart gives about 2 nF, useful around 100–200 MHz.
- **Size tracks and vias for current and temperature rise** (IPC-2152), and check the voltage drop on long rails.
  - A plated via (standard plating, 5 °C rise) carries roughly 0.8 A with a 0.2 mm drill, 1.1 A with 0.3 mm and 1.6 A with 0.5 mm. Use several vias for power.
- **Filter at the board boundary.**
  - Interference below about 30 MHz is mostly conducted through cables and supplies: use a ferrite bead plus a capacitor on supply inputs, and filters on I/O lines.
  - Above about 30 MHz it is mostly radiated: keep loops small, edges slow and shields grounded.
  - Use the slowest logic edges that meet timing.

## 7. Vias and footprints

- **Smaller vias have less capacitance; short, wide vias have less inductance.** On fast lines, put the via at the pad or in it.
  - A via in a soldered pad must be filled and capped, or solder wicks away.
  - Under a BGA, every via in the pad array must be filled.
  - A QFN thermal pad needs vias, with the paste split into windows.
- **The unused part of a via barrel is a stub that resonates**: on multi-GHz lines, change layer to the far side or ask for back-drilling.
- **Keep aspect ratio within the fab's limit** (about 10:1 for through holes, 1:1 or less for microvias), and prefer staggered to stacked microvias.
- **Choose packages to suit fast lines.** For example, choose a package whose pads are close to the 50 Ω trace width, and keep pads no larger than the assembly needs, because extra copper adds capacitance.

## 8. Two-layer boards

- **Keep a solid ground under the most critical section** (radio, USB, switcher loop).
  - Route mostly on top, pour ground on both sides, and stitch the pours densely, every few millimetres along fast lines and around the RF section.
- **Decide before routing which long nets may cut the bottom pour** (see [routing](routing-and-api.md)).
- **Flag any fast interface that cannot get a continuous reference.** It is a design decision for the user, not something to hide in DRC.

## 9. Fab notes and release checks

- **Fab notes**:
  - IPC class (2 for most products, 3 for high reliability);
  - impedance per layer with the trace widths;
  - stackup with copper and dielectric per layer;
  - filled via-in-pad where used;
  - at least three fiducials for assembly.
- **Before ordering**:
  - DRC clean and routing complete;
  - every SMD pad has mask and paste openings;
  - polarity and pin 1 marked;
  - Gerbers inspected in a viewer (copper islands, mask and paste alignment);
  - BOM validated against part numbers.
  - See also [manufacturing](manufacturing.md).

## 10. Current, voltage drop and spacing

- **Trace current** from the IPC-2221 formula, for 1 oz (35 µm) copper. IPC-2152 refines it; inner layers are usually less critical than this table suggests when planes spread the heat.

| Width | Outer layer, +10 °C | Outer layer, +20 °C | Inner layer, +10 °C |
|---|---|---|---|
| 0.25 mm | ~0.9 A | ~1.2 A | ~0.45 A |
| 0.5 mm | ~1.45 A | ~2.0 A | ~0.7 A |
| 1.0 mm | ~2.4 A | ~3.2 A | ~1.2 A |
| 2.0 mm | ~4.0 A | ~5.4 A | ~2.0 A |
| 3.0 mm | ~5.3 A | ~7.2 A | ~2.6 A |

  2 oz copper carries roughly 1.6 times more at the same width. A 20 °C rise is acceptable for most boards, but not near temperature-sensitive parts or batteries.
- **Voltage drop**: 1 oz copper is about 0.5 mΩ per square, so R ≈ 0.5 mΩ × length / width.
  - Example: 2 A through 50 mm of a 1 mm trace is 50 squares, about 25 mΩ and 50 mV.
  - It matters for 3.3 V rails feeding radios and for sense or ground returns of ADCs.
- **Electrical spacing between conductors** (IPC-2221, sea level). This is functional insulation only; safety creepage and clearance between circuits follow the product standard (see [RF, HV and zones](rf-hv-zones.md)).

| Voltage between conductors | Inner layers | Outer, uncoated | Outer, under solder mask |
|---|---|---|---|
| 0–30 V | 0.05 mm | 0.1 mm | 0.05 mm |
| 31–100 V | 0.1 mm | 0.6 mm | 0.13 mm |
| 101–300 V | 0.2 mm | 1.25 mm (0.6 mm up to 150 V) | 0.4 mm |
| 301–500 V | 0.25 mm | 2.5 mm | 0.8 mm |

  Check the current IPC-2221 revision before relying on a value near a boundary, and keep the fab's minimum spacing as a floor.

## 11. Circuit-specific layout

- **Crystals and oscillators**:
  - crystal and load capacitors within a few millimetres of the oscillator pins, on the same layer, with no vias;
  - solid ground under them and no other signals routed beneath or between them;
  - the load capacitors' ground goes straight to the plane next to the IC's ground pin;
  - keep clocks and switching nodes away.
- **Switching regulators**:
  - make the hot loop as small as possible: for a buck, input capacitor, switch and the low-side switch or diode; for a boost, switch, diode and output capacitor;
  - keep the switch node copper only as large as current and heat require, since it radiates;
  - route the feedback divider from the output capacitor (Kelvin connection) and away from the switch node and inductor;
  - keep the inductor away from sensitive inputs and the antenna;
  - give the regulator's ground pad several vias to the plane.
- **ADCs and analog inputs**:
  - analog front end next to the ADC pins;
  - reference and supply decoupling at the pins, and a ferrite or RC filter from the digital rail;
  - no digital traces under the analog section;
  - when a sensor ground must be quiet, bring its return to the ADC's ground area, not across the digital section.
- **ESD and surge parts**:
  - at the connector, before any other part;
  - the clamp's ground path short and wide, straight to the plane or chassis;
  - the protected line passes through the clamp's pads (pad to pad) instead of branching to it with a stub.
- **USB**:
  - 90 Ω pair from the connector through ESD to the IC, symmetric;
  - the shield connected to ground through the connector's footprint as the datasheet recommends (often an RC to chassis);
  - VBUS with its own bulk capacitor and, where needed, current limiting.
- **RS485, CAN and long cables**:
  - termination resistor at the connector end (120 Ω);
  - transient suppression next to the connector;
  - bias resistors sized with the termination fitted (see [power and datasheets](power-and-datasheets.md));
  - split-termination capacitor to ground for CAN when EMC matters.
- **RF on two layers**:
  - a 50 Ω microstrip over a 1.6 mm board is about 3 mm wide, so use a grounded coplanar line, computed with the fab's calculator, to keep the line narrow;
  - stitch both sides of RF lines and the RF section's edges with ground vias no more than about λ/20 apart at the highest frequency that matters (about 3 mm at 2.4 GHz on FR-4).

## 12. Termination and edge control

- **Series termination**: a resistor at the driver pin, sized so that the driver's output impedance plus the resistor equals the line impedance. On 50 Ω lines with CMOS drivers that is typically 22–33 Ω.
  - Use it on clocks and fast single-ended lines longer than the threshold in section 1.
  - It also slows edges a little, which helps EMC.
- **Parallel termination**: at the receiver end; it draws static current. AC termination (R plus C) avoids that for clocks.
- **Slow edges deliberately where timing allows**: choose the lowest drive strength or slew-rate setting in the MCU configuration, or add a series resistor. Spread-spectrum clocking, where available, lowers peak emissions.

## 13. Decoupling placement rules of thumb

- **Per IC**: 100 nF at every power pin, with its via to the plane at the pad, plus 1–10 µF per IC or per small group on the same rail.
- **At each regulator**: the input and output capacitors from its datasheet, at its pins.
- **Where a rail enters a board section**: one bulk capacitor.
- **Placement**: the smallest value nearest the pin when values are mixed; the ground side of every decoupling capacitor goes straight to the plane, never through a thin shared trace.
- **Radio modules**: follow the module's datasheet for bulk at its supply pin (typically 10–22 µF plus 100 nF), because transmit bursts are short and large.

## 14. Testability and bring-up

- **Test points**: one per rail and per key signal (reset, boot or strap pins, UART TX/RX, SWD or JTAG), reachable from one side.
- **A way to measure each rail's current**: a 0 Ω link, a jumper or a shunt footprint (DNP), so standby current can be checked.
- **Debug access**: the programming and debug header, or pads, kept even on production boards when possible.
- **DNP footprints for tuning**: RF matching, filter options and termination options, marked as DNP in the BOM and CPL (see [manufacturing](manufacturing.md)).

## Further reading

These conclusions were cross-checked against general references. None of their text or tables is reproduced here:
- the IPC-2221/2152 family, for conductor and via sizing;
- Sierra Circuits, *High-Speed PCB Design Guide* (2020);
- N. Kardam, *Introduction to Printed Circuit Board Design and Layout using KiCad* (LWTech, 2024).
