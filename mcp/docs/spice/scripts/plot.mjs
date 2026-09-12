import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { args, cacheRoot, exists, locked, run, json, output, fail } from './common.mjs';

export async function sharpRuntime(options = {}) {
  try { return createRequire(import.meta.url)('sharp'); } catch { /* standalone skill */ }
  const root = join(cacheRoot(options), 'node-runtime', 'sharp-0.35.0');
  const load = () => createRequire(join(root, 'package.json'))('sharp');
  try { return load(); } catch { /* prepare dependency */ }
  if (options['no-install']) throw new Error('Sharp is unavailable; rerun without --no-install or install sharp@0.35.0 next to the skill.');
  await locked(dirname(root), 'sharp-0.35.0', async () => {
    try { load(); return; } catch { /* install */ }
    await mkdir(root, { recursive: true });
    await writeFile(join(root, 'package.json'), JSON.stringify({ private: true, dependencies: { sharp: '0.35.0' } }));
    const candidates = [process.env.npm_execpath, join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), join(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')].filter(Boolean);
    const cli = (await Promise.all(candidates.map(async p => await exists(p) ? p : null))).find(Boolean);
    if (!cli) throw new Error(`npm CLI not found. Install sharp@0.35.0 in ${root}, then retry.`);
    console.error('Installing Sharp for PNG output...');
    const result = await run(process.execPath, [cli, 'install', '--no-audit', '--no-fund', '--cache', join(cacheRoot(options), 'npm-cache')], { cwd: root, timeout: 180000 });
    if (result.code !== 0) throw new Error(`Sharp installation failed: ${result.stderr}`);
    load();
  });
  return load();
}
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
export function svgPlot({ title = 'SPICE simulation', x, series, xLabel = 'X', yLabel = 'Value', logX = false, width = 1400, height = 850 }) {
  if (!x.length || !series.length) throw new Error('No plot data');
  const tx = x.map(v => logX ? (v > 0 ? Math.log10(v) : NaN) : v);
  const range = values => {
    let min = Infinity, max = -Infinity;
    for (const value of values) if (Number.isFinite(value)) { min = Math.min(min, value); max = Math.max(max, value); }
    if (!Number.isFinite(min)) throw new Error('No finite plot values');
    if (min === max) { min -= Math.abs(min) * .05 || .5; max += Math.abs(max) * .05 || .5; }
    return [min, max];
  };
  const [xmin, xmax] = range(tx), [ymin, ymax] = range(series.flatMap(s => s.values));
  const left = 120, top = 85, w = width - 180, h = height - 235;
  const sx = v => left + (v - xmin) / (xmax - xmin) * w, sy = v => top + h - (v - ymin) / (ymax - ymin) * h;
  const colors = ['#2563eb', '#dc2626', '#059669', '#9333ea', '#d97706', '#0891b2'];
  const elements = [`<rect width="100%" height="100%" fill="white"/>`, `<text x="${left}" y="38" font-size="24">${escape(title)}</text>`];
  for (let i = 0; i <= 5; i++) {
    const xv = xmin + (xmax - xmin) * i / 5, yv = ymin + (ymax - ymin) * i / 5;
    elements.push(`<path d="M${sx(xv)},${top}v${h} M${left},${sy(yv)}h${w}" stroke="#e2e8f0"/>`, `<text x="${sx(xv)}" y="${top + h + 28}" text-anchor="middle">${(logX ? 10 ** xv : xv).toPrecision(4)}</text>`, `<text x="${left - 10}" y="${sy(yv) + 5}" text-anchor="end">${yv.toPrecision(4)}</text>`);
  }
  series.forEach((s, index) => {
    if (s.values.length !== x.length) throw new Error(`Mismatched vector length: ${s.name}`);
    let d = '', pen = false;
    // Preserve all data in CSV/RAW; only render at most ~6000 buckets, retaining extrema.
    const step = Math.max(1, Math.ceil(x.length / 6000));
    for (let i = 0; i < x.length; i += step) {
      let lo = i, hi = i;
      for (let j = i; j < Math.min(i + step, x.length); j++) { if (s.values[j] < s.values[lo]) lo = j; if (s.values[j] > s.values[hi]) hi = j; }
      for (const j of [...new Set([i, lo, hi, Math.min(i + step - 1, x.length - 1)])].sort((a, b) => a - b)) {
        if (!Number.isFinite(tx[j]) || !Number.isFinite(s.values[j])) { pen = false; continue; }
        d += `${pen ? 'L' : 'M'}${sx(tx[j]).toFixed(2)},${sy(s.values[j]).toFixed(2)} `; pen = true;
      }
    }
    const color = colors[index % colors.length];
    elements.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="2"/>`);
    if (x.length === 1) elements.push(`<circle cx="${sx(tx[0])}" cy="${sy(s.values[0])}" r="5" fill="${color}"/>`);
    elements.push(`<text x="${left + (index % 3) * 390}" y="${height - 65 + Math.floor(index / 3) * 24}" fill="${color}">${escape(s.name)}</text>`);
  });
  elements.push(`<text x="${left + w / 2}" y="${top + h + 65}" text-anchor="middle">${escape(xLabel)}</text>`, `<text transform="translate(24 ${top + h / 2}) rotate(-90)" text-anchor="middle">${escape(yLabel)}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="sans-serif" font-size="16" fill="#172033">${elements.join('')}</svg>`;
}
export async function plot(config, options = {}) {
  const sharp = await sharpRuntime(options);
  await mkdir(dirname(resolve(config.output)), { recursive: true });
  await sharp(Buffer.from(svgPlot(config))).png().toFile(config.output);
  return resolve(config.output);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const o = args();
  if (o.help) output({ usage: 'node plot.mjs <plot-config.json> [--cache directory] [--no-install]; config: {output,title,x,series:[{name,values}],xLabel,yLabel,logX}' });
  else json(o._[0]).then(config => plot(config, o)).then(path => output({ status: 'ok', png: path })).catch(fail);
}
