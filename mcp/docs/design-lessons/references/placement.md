# Placement lessons

## DSL

- **Never assume rotation or axis semantics; check every fixed part in the preview.** DSL Y points down; native coordinates are mil with Y up and counter-clockwise rotation. A transformer fixed at `rotate: 180` came out with its pins reversed. An ESP32-S3-WROOM-1 at DSL rotation 0 has its antenna toward +Y (down). Look at the preview's ratsnest before assembling.
- **Satellites of a `fixed` block can land on other blocks.** A level translator attached to a fixed modem landed on the SIM parts; make such parts free blocks linked with `near`.
- **The solver may not close tight power loops or dense mixed-signal fronts.** With a 12 × 12 mm inductor it did not close an asynchronous buck loop even with `coreIsland` or `localLayout`, and it left measurement channels and a crystal far from their pins. Correct locally: rotate the IC so SW faces the inductor and place the diode, input capacitor and bootstrap around it (the loop shrank from 10.7 to 2.9 mm), or `preserve` and place channel strips by script in the connector's order.
- **Do not compact a 2-layer board before checking routing corridors.** At density 0.60 routing did not close; it did with 10 mm more per axis, after moving a USB connector out of an SPI bus path and putting each Ethernet chip by its connector.
- **Verify the cable-entry direction of terminal blocks and jacks** with a native canvas render (`dmt_EditorControl.getCurrentRenderedAreaImage`); preview images were not reliable for this. To turn a part that faces inward, flip the symbol in the schematic and rotate the footprint 180° about its centre: each net stays on the same physical pad.
- **Plan ground access explicitly.** Ground nets weigh very little in placement scoring, so the solver will not shorten ground connections for you.
- **Split dense ICs into satellites of fewer than 12 parts** (decoupling, crystal, reset and boot), and iterate on one block with `solver({ previewBlock })`.
- *Uncertain, check in the current version:* `boardHole.corners` added another set of holes on every placement run (six per corner after several passes); `edgePlace([list], { x })` put every listed part at the same X.

## After placement

- **Measure support parts pad to pin** with `inspect_component` and a radius against the device guidance: switcher loop (input capacitor, IC, diode, output capacitor) within ~25 mm², decoupling and inductors within a few mm, ESD parts within ~10 mm of their connector.
- **Check real courtyards and solder mask, not only DRC.** A tantalum case overlapped an inductor pad; test pads 0.05 mm from module pads merged their mask openings; a pad 0.21 mm from a large through-hole pad was legal but left no margin.
- **Check silkscreen and value fields**: rotated or overlapping designators, silkscreen on pads or off the board, unresolved value templates (`={Manufacturer Part}`).
- **Record every manual pose change** so the next DSL run can reproduce it with `fixed` or `preserve`.
