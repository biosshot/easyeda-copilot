# Schematic and library lessons

## Copilot assembly and readback

- **Verify every pin after `extract_circuit_on_current_page`.** One LCSC connector symbol was placed without error but its pins stayed unconnected. Compare `get_schematic` pin by pin with the generator data; if a symbol rejects connections, use an equivalent part.
- **Treat every single-pin net as an error until explained, and check for duplicate designators after each page.** This found missing test points and orphan labels. On an inherited design, two orphan nets were pre-wired spare GPIOs worth reusing.
- **Do not put personal-library parts in an extraction payload.** The call failed (`Cannot read properties of undefined (reading 'x')`) and placed nothing. Extract the rest, then place those parts natively (`sch_PrimitiveComponent.create` plus named wires or flags).
- **Pins that already have a wire conflict with extraction** ("wire conflict"). Connect through a net flag or port at the wire end, or create the part and wires natively.
- **To change a part into a different one, remove it and add the new one in two calls.** A single call that removed and re-added the same designator failed with `Unsafe replacement … diagonal pin mismatch`. *Uncertain* whether this depends on the version.
- **Native schematic edits have traps; diff the netlist after each one.** `sch_PrimitiveWire.modify({ net })` does not rename a net. Flags and ports cannot be moved with `modify`: delete and recreate them. Named wires do not accept `modify({ line })`: recreate them with `create(line, net)`. Deleting one flag once left a duplicate of the old net.
- **After edits or beautify, check that nothing sits outside the drawing frame.**
- **Confirm the open project is the current one** (be suspicious of "copy" or date-stamped names) and compare component counts and values between schematic and PCB before working.
- **A read-only review must not switch projects with `open_document`** (it saves every open tab) and must not run `execute_js` without permission.

## Searching parts

- `component_search` matches ordering codes: a module family name returned nothing until the full ordering code was used. Some categories (high-voltage magnetics) cannot be found by text at all; use the distributor's category browser.
- Distributor descriptions are not specifications. A modem variant was listed with two radio technologies; the manufacturer's variant table listed one. Read the manufacturer's ordering table before proposing a substitute.
- `get_schematic` has no MPN, LCSC code or footprint, and `component_search` gives MPN and datasheet but no stock or LCSC code. `eda.lib_Device.search(name)` in `execute_js` returns `supplierId` (the LCSC C-code); stock comes from the distributor.

## Library parts and footprints

- **Check footprints of modules and power ICs for vias without a net.** The ESP32-S3-WROOM-1 LCSC footprint (12 vias of 0.40/0.25 mm, on every board that used it) and a buck converter's exposed pad both had them. Without a net the pour does not connect, DRC reports via and clearance errors, the router discards its result (`KRT_FIXED_COPPER_CHANGED`), and the vias miss the fab's annular-ring minimum. `get_current_pcb` lists vias without `net`; assign one with `pcb_PrimitiveVia.modify(id, { net: 'GND' })`, or better, fix the project footprint (≥0.5/0.3 mm). Some footprints split the exposed pad into sub-pads joined by these vias: keep the ground tracks that join them.
- **Wire by pin number from the manufacturer's pin table, not by the symbol's pin names.** A cellular module's symbol carried a sibling module's names (a power key labelled as a wake pin, a function labelled reserved). A chip antenna's symbol labelled a mounting pad as the feed; the real feed was found by comparing footprint pad coordinates with the maker's reference layout.
- **An attribute-only swap (MPN, LCSC code, value) keeps the old symbol and footprint.** An LED swapped this way kept a footprint with pin 1 = anode while the new device has pin 1 = cathode: six LEDs could have been assembled reversed. After any swap, fetch the new `part_uuid` with `component_search` and compare pinout, package and polarity with what is placed.
- **A "pin-compatible, same footprint" substitute can still differ.** One footprint came rotated 90°; a sibling charger had a different function on one pin (one must not float, the other must stay unconnected) and a lower over-voltage limit. Read the substitute's datasheet, then re-place and re-route if needed. Classify the substitute before accepting it (exact drop-in, bounded change, redesign, reject); `qualify-pcba-sourcing` in [pcba-design-skills](https://github.com/Keitark/pcba-design-skills) has a complete gate.
- **Re-importing schematic changes (`import_pcb_changes`) can move replaced parts off the board and change their footprint** (a tantalum capacitor came back 180° reversed), and it drops pad edits made on the board instance. Restore poses from the previous placement data and recheck polarity and pad edits after every import.
- **Personal-library parts are not supported end to end.** The placer cannot resolve their footprint (`Missing real footprint`), even with `preserve`, and every schematic component needs a block. Build a proper device (symbol plus footprint), or remove those parts temporarily, place and assemble, then re-add and place them natively. Editing a footprint with `lib_Footprint.updateDocumentSource` moved it to the personal library without a device.
- **Compare module footprints with the manufacturer's land pattern** and add keep-outs the footprint lacks. One module's pads were 0.3 mm too far outward; neither footprint checked had the module's no-copper area next to its antenna pins.
- **Check generic public parts before use**: the public test-point part was a 0.5 mm through-hole, not the SMD pad wanted.
