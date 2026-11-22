# PCB analysis examples

These templates use benchmark boards and explicitly authored hypotheses. Confirm the board, pad designators and physical inputs before reuse. Read [the workflow](SKILL.md) before running a scenario.

| Example | Intended board and result |
|---|---|
| [DC copper loss to steady thermal](examples/tps63060-dc-thermal.js) | TPS63060DSCR, J1 input and U1 output supply paths, DC copper and barrel losses transferred to a steady-state thermal model. Verify the VAUX and PG zero-current assumptions. |
| [Channel frequency response](examples/bandamp-rf-in.js) | BandAmpV5, RF1.2 → C1.1, with authored reference contacts, sampled from 10 MHz to 1 GHz. Check the approximation and joint warnings. |
| [PI at a single frequency](examples/tps63060-pi.js) | TPS63060DSCR, VOUT at 1 MHz, with explicit VRM and decoupling models. To plot a design target, add `.targetImpedanceOhm(...)` with the target supplied for this rail. |

Copy the selected example to a local file, adapt the assumptions and pass its absolute path to `run_pcb_analysis`. The bundled examples refer to the same fixtures as P7 readiness rows M4, M7a and M1. The PI example uses one frequency in place of the M1 grid.
