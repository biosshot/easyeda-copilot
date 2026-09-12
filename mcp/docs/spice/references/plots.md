# PNG plots and reusable data

`simulate.mjs` preserves ngspice's ASCII `.raw`, full precision CSV and JSON arrays. Complex AC data keeps real and imaginary components. Default AC PNGs show linear magnitude and phase in degrees; quantities of different types are plotted separately. Logs contain `.meas` output. No data rounding is applied to saved vectors; only drawing is reduced for large series, retaining bucket extrema.

Use `examples/custom-plot.mjs` for transfer gain in dB. Copy this example into the research directory and point its import to this skill's `scripts/plot.mjs`. Define the exact transfer function (e.g. Vout/Vin), rather than labeling absolute output voltage as gain. Phase wrapping is preserved by default; unwrap explicitly if needed.

The exported `plot(config, options)` takes:

```js
await plot({
  title: 'Output transient',
  x: [0, 0.001, 0.002],
  series: [{ name: 'v(out)', values: [0, 0.63, 0.86] }],
  xLabel: 'Time (s)', yLabel: 'Voltage (V)',
  logX: false,
  output: '/absolute/path/to/output.png'
});
```

Change ranges by filtering x and each corresponding series together. Use no more than six series per figure for readable legends. `width` and `height` can set image size. Saved PNGs are the visual output; SVG is an internal rendering step and is not required to view results.
