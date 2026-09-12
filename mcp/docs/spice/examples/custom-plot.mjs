// Run: node custom-plot.mjs <analysis-ac1.json> <output.png>
import { readFile } from 'node:fs/promises';
import { plot } from '../scripts/plot.mjs';
const data = JSON.parse(await readFile(process.argv[2], 'utf8'));
const input = data.vectors.find(v => v.name === 'v(in)');
const output = data.vectors.find(v => v.name === 'v(out)');
if (!input?.imaginary || !output?.imaginary) throw new Error('Expected complex AC vectors v(in) and v(out)');
await plot({
  title: 'RC filter transfer gain', x: data.vectors[0].real,
  xLabel: 'Frequency (Hz)', yLabel: 'Gain (dB)', logX: true,
  series: [{ name: 'V(out) / V(in)', values: output.real.map((value, i) =>
    20 * Math.log10(Math.hypot(value, output.imaginary[i]) / Math.hypot(input.real[i], input.imaginary[i]))) }],
  output: process.argv[3]
});
