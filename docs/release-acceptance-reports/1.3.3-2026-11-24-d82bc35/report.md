# EasyEDA Copilot 1.3.3 targeted release acceptance

Date: 2026-11-24. Source baseline: `d82bc35`, with the release pins and test updates recorded in this report's commit.

The user approved using the earlier [Full Online and Half Offline acceptance](../1.3.2-2026-11-12-f4daa8d/report.md) as the baseline and asked for targeted checks with the updated backend and extension. The earlier run used backend 0.4.0. The full editor matrix was not rerun for 1.3.3.

| Check | Result |
| --- | --- |
| Release metadata and dependencies | Pass. All release manifests agree on 1.3.3. The lockfile pins the published backend 0.5.0 and router 0.3.2. The release check found all four native backend binaries. |
| Extension | Pass. 240 tests, zero failures. The 45-entry local `easyeda-copilot_v1.3.3.eext` has SHA-256 `864bbefe607828558d8c04519ce896da692ddb8bdbb76fbe5c8bce073bb441879`. |
| MCP and independent installation | Pass. Full MCP check, 14 RoutingBoardV2 and analysis cancellation tests, clean standalone MCP consumer and protocol checks. Two local ngspice cases skipped because ngspice was unavailable. The tagged workflow provisions ngspice. |
| Bundled local skill and editor bridge | Pass. Win32 x64 skill 1.3.3 ran backend 0.5.0 and router 0.3.2. The user installed the updated extension, the editor registered version 1.3.3, and the CLI discovered 41 tools. The test daemon stopped normally. |
| Read-only PCB analysis | Pass for the release smoke. `run_pcb_analysis` returned a managed operation, `wait_operation` returned the completed scenario, and the tool produced two JSON files and five PNGs without rendering errors. The independent steady-state thermal check passed at 55 °C. |
| PCB export and unchanged document | Pass. Two RoutingBoardV2 exports bracketing a repeat analysis had identical board payloads, including 53 components and 172 pads. |

The live geometry calculation was partial and conditional. The capture recorded uncertain contacts, copper with unknown net assignment, and missing stackup and physical models. The 55 °C value is the independent lumped-network control, separate from the PCB's physical temperature. PCB analysis remains beta for simple boards and its physical accuracy remains unverified. The live smoke did not establish DC, PI or channel accuracy.

The eight-platform tagged integration matrix is the final publication gate. It verifies the release configuration and produces the exact npm and extension archives uploaded by the release workflow.
