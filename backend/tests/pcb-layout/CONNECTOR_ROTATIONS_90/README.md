# `faceTo("left")` connector diagnostic

This fixture is intentionally **not** a golden connector layout. It asks the
runtime to orient 20 different real EasyEDA connector footprints using only:

```js
component(designator)
  .faceTo("left")
  .fixed({ x, y, layer: "top" });
```

Neither `faceAt0` nor `rotate` is supplied. This forces the current pad-based
`faceAt0` inference to choose every rotation. The board is vertical simply to
fit all connectors in one left-facing column without overlap.

Run from `backend`:

```powershell
node --import tsx tests/pcb-layout/CONNECTOR_ROTATIONS_90/CONNECTOR_ROTATIONS_90.ts
```

Review these generated artifacts:

- `.test-output/pcb-layout/CONNECTOR_ROTATIONS_90/placement.svg` — full column;
- `auto-face-report.md` — inferred `faceAt0` and selected angle for all parts;
- `previews/J1.svg` through `J20.svg` — enlarged footprint views.

Expected outcome: placement is geometry-clean, but some connector openings may
not actually face left. Those visual mismatches identify footprints for which
pad geometry cannot describe the mechanical mating direction.
