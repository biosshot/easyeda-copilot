# `face: "outward"` connector diagnostic

Twenty real connector footprints are placed along the left edge using only:

```js
component(designator).edgePlace("left", {
  inset: 2,
  y,
  face: "outward",
  layer: "top",
});
```

There is no explicit `faceAt0`, `faceTo`, `fixed`, or `rotate`. The test records
how `outward` compiles and which angle is selected from automatic pad-based face
inference.

Run from `backend`:

```powershell
node --import tsx tests/pcb-layout/CONNECTOR_OUTWARD/CONNECTOR_OUTWARD.ts
```

Review `placement.svg`, `outward-report.md`, and the per-connector `previews` in
`.test-output/pcb-layout/CONNECTOR_OUTWARD`.
