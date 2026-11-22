---
name: pcb-analysis
description: Run electrical and thermal analysis of an open routed EasyEDA Pro PCB with the EasyEDA Copilot analysis DSL. Use for DC voltage drop and copper loss, thermal maps, power integrity, and routed-channel frequency response.
---

# PCB analysis

1. Verify the project and open the intended PCB document. Use the V2-capable Copilot extension and the same MCP process or [CLI daemon](../cli.md) throughout. Keep the board unchanged during capture because EasyEDA reads the primitives in sequence. Use `preview_pcb`, `inspect_net`, `inspect_component` and the schematic to identify rails, loads, pins and return paths.
2. Read the [analysis DSL declarations](dsl.ts) for the available builders, methods, parameters and result types. Write a trusted local JavaScript scenario using `analysis({board})`. Write the frequency range, source and load ports, models, units and budgets explicitly. The [examples](examples.md) show the minimum setup for the documented boards.
3. Run `run_pcb_analysis({file, wait_ms: 1000})` with an absolute file path. For `status: "running"`, retain `operation_id` and call `wait_operation({operation_id, wait_ms: 30000})` until terminal. Use `list_operations` to recover an operation ID after an interrupted wait. For cancellation call `cancel_operation` and wait for the terminal result. One PCB analysis can run per MCP process.
4. Open the scenario overview PNG first. Confirm the board, connections, source and load roles, reference layer, and any reported solved region. Gray copper has unknown coverage. Then read the calculation statuses and diagnostics in `summary.json`. Open the relevant field PNGs and consult selected data in `result.json` for the numbers. If the response is stored in a larger JSON artifact, follow its path. Save the image paths needed for the answer.
5. Report the verified scope, assumptions, calculations and their validity, followed by the values with units, layer, frequency or time. State which regions or points are unknown and why. Use the images to make coverage and peaks visible. Physical accuracy is unverified.

## Inputs and assumptions

| Input | Where to get it |
|---|---|
| Components, pad numbers, nets, routing and captured fills | Current PCB and linked schematic. Check the overview and export diagnostics for missing or uncertain copper. Use `export_pcb_routing_board` if you need to inspect the V2 capture itself. |
| Copper thickness, dielectric layers, via plating, conductivity, permittivity and loss | Fabricator stackup and material data for the intended board. Check layer order against the PCB. Ask the user when an unknown parameter changes the interpretation. |
| Source and load ports, DC or AC excitation, supply output impedance, ESR/ESL | Schematic, BOM, datasheets, measurements or operating conditions supplied by the user. Include both signal and return contacts and locate the actual decoupling parts. |
| Heat sources, ambient and cooling | Rated component loss or the accepted DC loss field, operating ambient and documented cooling. Use scenario assumptions only when the task supports an estimate and identify each one in the answer. |

State the source of each input that affects the conclusion. Author `cadFill: "snapshot"` only when the supplied fill snapshot is the intended analysis input. Use `idleNets` only when the scenario establishes zero DC current in those nets. Enter a PI target with `.targetImpedanceOhm(...)` when the user or design supplies one.

## Status and accuracy

| Status | Meaning for the answer |
|---|---|
| Scenario `complete` | The DSL finished. Check every calculation and check result individually. |
| Calculation `complete` | The calculation finished with its declared coverage. Its values can still be conditional. |
| Data `conditional` | The value depends on named assumptions or an approximation. Include those conditions. |
| Calculation `partial` | Some results, regions or frequencies are usable under the stated limits. Identify the gaps. |
| Data `unavailable` | There is no numerical result for this quantity or region. State the reason from diagnostics. |

The backend checks internal consistency such as residuals, power balance, passivity or convergence where the method supports it. Physical accuracy is unverified. Use the values to compare variants and estimate order of magnitude. Acceptance requires independent evidence.

## Time and memory

The readiness matrix recorded these times and memory peaks on the named boards. Actual runtime depends on the board, host and scenario. Use one heavy run at a time and start PI on a large board with one frequency. `wait_ms` controls the reply wait. Each run has a 75-minute scenario deadline and can be limited sooner by analysis-specific budgets.

| Scenario | Observed time | Observed peak memory |
|---|---:|---:|
| TPS63060DSCR DC → steady thermal (M4) | 6 s | 567 MiB |
| BandAmpV5 RF_IN / RF_OUT with cascade (M7a/M7b) | 29 / 23 s | 1,177 / 1,098 MiB |
| Channel with unresolved return path, TPS or NanoScope (M8/M9) | 14–18 min to refusal | 1,427–3,297 MiB |
| TPS63060DSCR PI full grid (M1) | about 45 min | 2,628 MiB |
| BandAmpV5 or STM32G0 PI full grid (M2/M3) | reached the one-hour budget | up to 4,192 MiB |
| BandAmpV5 or STM32G0 PI at one frequency (M2/M3) | about 12 / 8 min | up to about 4.2 GiB |

## Recover from diagnostics

| Code | Action |
|---|---|
| `LOCAL_MIXED_FOIL_BAND` | Read the reported maximum frequency and narrow the upper edge of the requested sweep to that range. |
| `LOCAL_DEADLINE` | Reduce the number of points or start with one frequency. Increase the DSL calculation budget after confirming the expected cost. |
| `THERMAL_LOSS_TRANSFER` | Read the reported reason. For excluded domains, resolve drive and return coverage, or declare verified zero-current nets with `idleNets` and rerun DC before transferring losses. Use the resulting map from the same board and scenario context. |
| `CHANNEL_RETURN_UNRESOLVED` | State that the calculation could not resolve the channel return path. Verify the intended physical return contacts and report the refusal if it persists. |
| `PI_UNMODELED_BRANCH` | This is a warning that lists undeclared branches treated as open. Declare component models supported by the DSL, then repeat the PI analysis. |
| `MACHINE_MEMORY` or `MEMORY_LIMIT` | Read the memory diagnostic, choose a supported smaller analysis scope or use a host with sufficient memory. Disclose any cropped region. |
| `TIMEOUT` or `ABORTED` | Use the operation and scenario statuses to distinguish the overall deadline from cancellation. Review retained results only where they are available. |
| Other code | Read the exact message, location and diagnostics. Resolve the reported missing input or unsupported condition before retrying. |

See [managed operations](../operations.md) for waiting and cancellation.
