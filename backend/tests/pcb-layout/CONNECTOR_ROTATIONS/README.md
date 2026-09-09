# Connector rotation visual fixture

This fixture puts 20 different real EasyEDA connector parts on a 320 x 80 mm
test board. External openings and wire-entry faces point outwards; vertical and
internal connectors are kept in the middle at 0/90/180/270 degrees.

Run from `backend`:

```powershell
node --import tsx tests/pcb-layout/CONNECTOR_ROTATIONS/CONNECTOR_ROTATIONS.ts
```

Review:

- `.test-output/pcb-layout/CONNECTOR_ROTATIONS/placement.svg` — complete board;
- `.test-output/pcb-layout/CONNECTOR_ROTATIONS/previews/J1.svg` through `J20.svg`
  — close-ups with part name and applied rotation;
- `.test-output/pcb-layout/CONNECTOR_ROTATIONS/layout.json` — resolved real
  footprint geometry and mechanical-face constraints.

| Ref | Connector | Intended placement | Rotation |
| --- | --- | --- | ---: |
| J1 | KH-TYPE-C-16P | top edge, opening out | 0° |
| J2 | AF180QT1.0 USB-A | bottom edge, opening out | 180° |
| J3 | R-RJ45S08P-B000 | top edge, opening out | 180° |
| J4 | B2B-PH-K-S vertical JST-PH | internal | 0° |
| J5 | KF128-2.54-2P terminal | bottom edge, wire entry out | 0° |
| J6 | AFC07-S18ECA-00 FPC | top edge, cable entry out | 0° |
| J7 | TYPEC-304-BCP16 | bottom edge, opening out | 180° |
| J8 | Micro USB Type-B | bottom edge, opening out | 180° |
| J9 | SMA-KWE | top edge, opening out | 270° |
| J10 | U.FL-R-SMT(10) | internal | 90° |
| J11 | FPC-05F-40PH20 | bottom edge, cable entry out | 180° |
| J12 | DC-005H-D020 barrel jack | bottom edge, opening out | 90° |
| J13 | NC3MBH XLR-3 | top edge, opening out | 180° |
| J14 | CON-SMA-EDGE-S | bottom edge, opening out | 0° |
| J15 | 2.5mm_TRS | bottom edge, opening out | 0° |
| J16 | 10118193-0001LF Micro-USB | top edge, opening out | 0° |
| J17 | B2B-PH-SM4-TB JST-PH | internal comparison | 180° |
| J18 | BM04B-GHS-TBT JST-GH | top edge, cable entry out | 0° |
| J19 | DB128V-5.08-6P terminal | top edge, wire entry out | 0° |
| J20 | 1x8 2.54 mm header | internal | 270° |
