# PCB layout fixture bank

This is the original `copilot-server/tests/pcb-layout` bank: 20 runnable boards, their schematic JSON and placement DSL, assertions and visual previews. `Hanboo/Hamboo.json` is a data-only example, with no DSL or runner in the original repository. Alternate DSL files are preserved too.

Run from the EasyEDA Copilot repository root after building the backend and native addon:

```sh
npm run native:build --workspace=eda-copilot-backend
npm run build --workspace=eda-copilot-backend
npm run test:pcb-layout --workspace=eda-copilot-backend -- --list
npm run test:pcb-layout --workspace=eda-copilot-backend -- esp32c3
npm run test:pcb-layout --workspace=eda-copilot-backend -- H743 ELRS NanoDDS
npm run test:pcb-layout --workspace=eda-copilot-backend -- --all
```

The command selects fixture directory names, including `rp2040_base`, `CNTRL_ACESS_MAX` and `ThunderF722`, whose runner filenames differ. Each board runs in a separate process with a ten-minute timeout; a batch continues after failures and exits unsuccessfully if any fixture fails.

Results are written to `backend/.test-output/pcb-layout/<outputName>/`: `placement.svg`, board assembly, placement reports, intermediate stages and additional previews produced by the individual runners. The original assertions and DSL are preserved. A fixture without assertions reports placement errors but does not turn a non-clean layout into a failing process; inspect its report as with the original runner.

These examples resolve real footprints through the public EasyEDA API, so they need network access and are separate from the deterministic default tests. They do not call the Copilot server. Run the PCB unit tests with:

```sh
npm run test:pcb --workspace=eda-copilot-backend
```

The fixture bank and test tooling stay in the repository and are excluded from the published backend package.

During extraction verification on Windows x64, all 20 runners were exercised against real EasyEDA footprints: 11 reported clean placement, 5 produced layouts with placement errors, and 4 rejected their DSL:

| Fixtures | Result |
| --- | --- |
| ESpower, ICM20948, NanoDDS, USB_ISOL | DSL validation errors |
| CNTRL_ACESS_MAX, H743, PICO_DUCK, STEPPER_CONTROLLER, ThunderF722 | Layout generated with placement errors |

All nine problem cases were also run against the original server source at `412386a`, using the same native addon and captured footprints. Validation messages, placement coordinates and placement reports matched exactly. The original fixture inputs are preserved so these existing problems remain visible.
