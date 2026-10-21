---
name: design-lessons
description: Field lessons from real boards designed end to end with EasyEDA Copilot (schematic generation, library parts, datasheet checks, power and low-power design, RF, high voltage and zones, placement DSL, routing, EasyEDA API behaviour and JLCPCB ordering). Read the section for the current stage before acting, especially before writing a placement DSL, routing, swapping parts or preparing an order.
---

# Design lessons from real boards

These are mistakes that happened, or nearly happened, on real boards built with this MCP, and the practices that fixed them. They complement the stage guides in [SKILL.md](../SKILL.md): read the matching stage guide first, then this checklist. Items marked *uncertain* were seen once or may depend on the version; verify them before relying on them.

## Rules that apply to every stage

1. **Evidence, not impression.** Every claim cites its source: net and pins (`get_schematic`, `inspect_net`), a datasheet page, a DRC rule, or a calculation with the values substituted. Mark inferences as inferences.
2. **Re-check earlier notes against the datasheet before reusing them.** On several boards a later datasheet pass overturned earlier conclusions (an OVP that did exist, resistor values inside a digital transistor, miscalculated thresholds). Write corrections back and say they are corrections.
3. **Ask once about intent, and only for decisions the user owns**: prototype or production, field or bench, hand soldering or assembly, a substitute part or the original, an output behaviour. Then apply the answer.
4. **Keep the design as code.** Generate schematic pages from a per-component (pin, name, net) list, keep the placement and routing DSL files, and keep repair scripts. Readback against the generator found every error on the page where it was made, and the generators were reusable on the next board.
5. **After manual live corrections, the live PCB is the source of truth.** Encode moved parts as `fixed`/`preserve` before running the DSL again; never reassemble an older `layoutId` over them.
6. **Accept known findings one at a time, in writing, with the reason** (for example a module footprint's own DRC errors), so any new finding stands out.
7. **End every review or stage with its limits**: datasheets not read, pours not refilled, visual checks not possible, stock not checked.

## By stage

| Stage | Read |
|---|---|
| Schematic pages, Copilot assembly, native schematic edits | [schematic-and-library.md](references/schematic-and-library.md) |
| Library parts, footprints, part swaps and substitutes | [schematic-and-library.md](references/schematic-and-library.md#library-parts-and-footprints) |
| Datasheet numbers, power tree, protection, standby current | [power-and-datasheets.md](references/power-and-datasheets.md) |
| Antennas, RF paths, high voltage, isolation and zones | [rf-hv-zones.md](references/rf-hv-zones.md) |
| Floorplan order before the DSL: enclosure, HV/RF/power zones, layer and plane plan, power and thermal budget, airflow | [floorplan-and-thermal.md](references/floorplan-and-thermal.md) |
| Fast nets, impedance, return paths, differential pairs, decoupling, current and heat | [electrical-rules.md](references/electrical-rules.md) |
| Placement DSL and checks after placement | [placement.md](references/placement.md) |
| Routing, pours, stitching and native API behaviour | [routing-and-api.md](references/routing-and-api.md) |
| BOM, CPL, stock and fabrication limits | [manufacturing.md](references/manufacturing.md) |

## Related skills

[pcba-design-skills](https://github.com/Keitark/pcba-design-skills) (MIT) is an EDA-neutral, evidence-gated suite for the same lifecycle. This skill keeps only what is specific to EasyEDA Copilot and its tools; for the stages it covers in more depth, use it alongside:

- `qualify-pcba-sourcing`: substitution classification (exact drop-in, bounded change, redesign, reject) with a pin-by-pin and package comparison.
- `operate-jlcpcb-order`: calibrating the imported CPL against several asymmetric reference parts and reviewing every placed body in the assembler preview.
- `pcb-layout-review`: layout gates and reusable routing lessons.

For a large review, split it by subsystem (power, MCU and interfaces, radio, BOM and stock), give each reviewer its own netlist extract and datasheets, then triage once: real, likely false positive, accepted trade-off (cite the decision), or unresolved (say what evidence is missing). Independent reviewers finding the same fault from opposite sides is strong evidence.
