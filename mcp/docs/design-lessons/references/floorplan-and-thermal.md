# Floorplan, planes and heat: what to settle first

Placement goes wrong when it starts from the parts. Settle the decisions below in this order, write each one down, and only then write the placement DSL. Each step constrains the next, and the later ones are cheap to change while the earlier ones are not.

## The order

| # | Decide | Why it comes here | Output |
|---|---|---|---|
| 1 | Mechanical envelope | Fixed by the enclosure and the user, not by the circuit | Outline, holes, fixed connectors and user parts |
| 2 | Hazard and noise zones | Safety distances and antenna keep-outs eat area and split the board | Zone table and zone map |
| 3 | Layer and plane plan | Decides where return currents and isolation gaps can exist | One line per layer, plus plane cuts |
| 4 | Power and thermal budget | Decides copper areas, part spacing and whether the enclosure is enough | Dissipation list and rise estimates |
| 5 | Airflow and heat placement | Hot parts and sensitive parts compete for the same good positions | Hot and cold areas on the map |
| 6 | Blocks inside each zone | Only now do the parts matter | Placement DSL |

## 1. Mechanical envelope

- Board outline, mounting holes with their keep-outs (screw heads and standoffs), the enclosure's height limits per area, and walls or ribs.
- **Everything the user touches or sees, and every cable entry**: connectors, buttons, LEDs, displays and antennas, with their direction.
- **Fix these first**, as `fixed` parts or blocks in the DSL. Everything else is placed around them.
- **Cable entries decide where the noisy and exposed circuits go.** Protection, filters and isolation belong at the entry, so the entry positions set the zone map in step 2.

## 2. Zones, in priority order

Assign zones in this order, because each one takes area or constraints from the next. Derive them with evidence as in [RF, HV and zones](rf-hv-zones.md).

1. **High voltage and mains.**
   - They need creepage, clearance, slots and possibly an isolation barrier, so they decide how the board splits.
   - Put the HV zone against its own connector, on one side of the board; never in the middle with low-voltage circuits around it.
   - Place the barrier parts (transformer, isolator, optocoupler) straddling the gap, each side's pins facing its own zone.
2. **Antennas and RF.**
   - An integrated antenna goes in a corner or on an edge, overhanging or with a full copper keep-out on every layer, as the module's datasheet requires.
   - Keep metal, batteries, displays, screws and switching parts out of its near field.
   - The RF path from the transceiver to the antenna stays short and straight.
3. **Switching power**: next to the power entry, away from the antenna, the analog inputs and the crystal, with its hot loop small (see [placement](placement.md)).
4. **Analog and sensing**: next to its connector or sensor, away from switching power and clocks, with a quiet ground area.
5. **Digital core**: the MCU in the middle of the signal flow, with its crystal and decoupling, close to the interfaces it serves.
6. **Interfaces** (USB, RS485, Ethernet): each next to its connector, with protection between the connector and the IC.

**Arrange the zones in signal-flow order**, from input connectors through processing to outputs, so no zone's signals cross another zone. Noisy zones sit close to their own connectors; quiet zones sit far from noisy ones.

## 3. Layer and plane plan

- **Choose the layer count from the hardest constraint**: a fine-pitch part's fanout, a controlled-impedance interface needing an adjacent plane, or a dense board that will not route on two layers.
- **Write one line per layer**: for example L1 signals and parts, L2 solid ground, L3 power islands, L4 signals. On two layers: top for routing, bottom as ground pour with as few crossings as possible.
- **Ground**:
  - one continuous ground under RF, fast interfaces, the crystal and the analog front end;
  - no split unless there is a reason;
  - separate grounds only across an isolation barrier, each with its own planes, and nothing crossing the gap except the barrier parts.
- **Under the HV zone**: no low-voltage plane or pour underneath. Cut the planes back to the creepage distance on every layer, not only on the top.
- **Under the antenna**: no copper on any layer in the keep-out.
- **Chassis or shield ground**: at the connectors only, joined to signal ground where the datasheet or the EMC plan says (often through an RC or a single point).
- **Power**: islands per rail on an inner layer, as large as possible, or wide pours on two layers. Never route a fast signal over the edge between two islands.

## 4. Power and thermal budget

- **List every part that dissipates more than about 0.1 W** and estimate its loss:
  - **Linear regulator**: (Vin − Vout) × Iout + Vin × Iq. 12 V to 3.3 V at 200 mA is 1.7 W, already too much for a SOT-223 on a small board.
  - **Switching regulator**: Pout × (1/η − 1). 5 W at 90 % efficiency is about 0.55 W, shared between the IC, inductor and diode.
  - **Resistors**: I² × R, kept under about half their rating (0402 about 1/16 W, 0603 about 1/10 W, 0805 about 1/8 W, 1206 about 1/4 W).
  - **MOSFETs**: I² × Rds(on) at the hot Rds(on), plus switching loss.
  - **LEDs, heaters, motor drivers, and radios during transmit** (average over the duty cycle).
- **Junction temperature**: Tj ≈ Tambient + P × θJA. The datasheet's θJA assumes a standard JEDEC test board. Your board can be much worse (small copper, no inner planes) or better.
  - Give exposed pads a via array (for example 4–9 vias of 0.3 mm) into a ground or copper area on both sides.
  - Keep Tj at least 20–25 °C below the maximum at the highest ambient.
- **Enclosure rise**: a closed plastic box loses heat through its outer surface at roughly 5–10 W/m²·K.
  - So ΔT ≈ P / (h × A_surface).
  - Example: 2 W in a 100 × 60 × 40 mm box (about 0.025 m²) gives a rise of about 8–16 °C above the room.
  - A sealed outdoor box in the sun adds much more. If the rise is too high, add vents, a larger box, a metal wall bonded to the hot part, or cut the dissipation.
- **Consumption also sets the battery life and the regulator choice.** Write the active and standby budgets before the schematic (see [power and datasheets](power-and-datasheets.md)). Every always-on load (LEDs, dividers, pull-ups, regulator Iq) shows up in standby.

## 5. Airflow and heat placement

- **Natural convection rises.** In the enclosure's mounting orientation:
  - put hot parts high and near vents or the warmest wall;
  - put sensitive parts low, upstream of the airflow or far from heat.
  - Mount the board vertically if possible: a horizontal board in a closed box traps heat under it.
- **Keep heat away from parts that age or drift with temperature**:
  - electrolytic capacitors lose about half their life for every 10 °C;
  - batteries should stay below about 45 °C while charging;
  - also crystals and oscillators, voltage references, temperature and humidity sensors, and optocouplers (CTR drops with heat).
- **Do not block the airflow** to a hot part with tall connectors, electrolytics or transformers placed upstream.
- **Spread hot parts out** instead of grouping them, unless they share one heatsink or copper area designed for it.
- **Thermal isolation for sensors**: an ambient temperature or humidity sensor needs its own corner, away from regulators and the radio. A slot in the board around it, with a narrow neck for the traces, cuts heat conducted through the copper and FR-4.
- **Copper is the heatsink on small boards**:
  - large pours on both sides tied by vias under the hot pad;
  - no thermal-relief spokes on pads that must dump heat (keep spokes where hand soldering needs them);
  - 2 oz copper for high-current or hot boards.
- **Verify after the first power-up**: measure the hot parts with a thermocouple or IR camera at the highest expected load and ambient. Correct the budget if reality differs.

## 6. Blocks inside each zone

Only now place parts: anchor each block on its IC, satellites for decoupling, crystal and termination, and the rules in [placement](placement.md) and [electrical rules](electrical-rules.md). Before running the DSL, encode steps 1–5 as constraints:
- fixed parts and blocks;
- `constraintRegion` for each zone;
- `blockClearance(..., "critical")` between zones that need a hard distance;
- `away` for noise and heat separations that are preferences.
