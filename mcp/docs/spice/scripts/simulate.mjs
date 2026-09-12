import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { args, output, fail, run } from './common.mjs';
import { ngspice } from './ngspice.mjs';
import { readRaw, csv } from './raw.mjs';
import { plot } from './plot.mjs';

async function snapshot(input, out) {
  const seen = new Map(), dependencies = [];
  let total = 0;
  async function copy(source, relative) {
    source = resolve(source);
    if (seen.has(source)) return seen.get(source);
    seen.set(source, relative);
    if (seen.size > 5000) throw new Error('Too many model dependencies');
    let body = await readFile(source, 'utf8');
    total += Buffer.byteLength(body);
    if (total > 512 * 1024 ** 2) throw new Error('Model dependencies exceed 512 MiB');
    dependencies.push({ source, snapshot: relative, sha256: createHash('sha256').update(body).digest('hex') });
    const lines = body.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(\s*)\.(include|inc|lib)\s+(?:"([^"]+)"|'([^']+)'|(\S+))(.*)$/i);
      if (!match || (match[2].toLowerCase() === 'lib' && !match[6].trim())) continue;
      const file = match[3] || match[4] || match[5];
      if (/[${}]/.test(file)) throw new Error(`Dynamic include paths are unsupported; resolve this path explicitly: ${file}`);
      const dependency = resolve(dirname(source), file);
      const target = seen.get(dependency) || `models/model-${seen.size}.lib`;
      await copy(dependency, target);
      lines[i] = `${match[1]}.${match[2]} "${target}"${match[6]}`;
    }
    await mkdir(dirname(join(out, relative)), { recursive: true });
    await writeFile(join(out, relative), lines.join('\n'));
    return relative;
  }
  await copy(input, 'circuit.cir');
  return dependencies;
}
export async function simulate(o) {
  if (!o._[0]) throw new Error('Supply circuit.cir');
  const input = resolve(o._[0]), text = await readFile(input, 'utf8');
  if (/^\s*\.control\b/im.test(text)) throw new Error('Use declarative .op/.dc/.ac/.tran directives; the runner owns .control and result export.');
  const expected = [...text.matchAll(/^\s*\.(op|dc|ac|tran|noise|pz|tf|sens|disto)\b/gim)].map(m => m[1].toLowerCase());
  if (!expected.length) throw new Error('No analysis directive in netlist');
  const timeout = Number(o.timeout || 60) * 1000;
  if (!Number.isFinite(timeout) || timeout < 1000) throw new Error('Timeout must be at least one second');
  const runtime = await ngspice(o);
  const out = resolve(o.out || join(dirname(input), 'spice-results', `${basename(input, '.cir')}-${Date.now()}`));
  // Never mix fresh results with old results or overwrite a user's research.
  await mkdir(dirname(out), { recursive: true });
  await mkdir(out);
  const dependencies = await snapshot(input, out);
  const driver = [
    'SPICE skill driver', '.control', 'set ngbehavior=ltpsa', 'set filetype=ascii', 'set numdgt=15',
    'source circuit.cir', 'run',
    'foreach p $plots', 'setplot $p',
    'write analysis-{$p}.raw all', 'end', 'quit', '.endc', '.end', ''
  ].join('\n');
  const driverPath = join(out, 'driver.cir');
  await writeFile(driverPath, driver);
  const execution = await run(runtime.path, ['-n', '-b', driverPath], { cwd: out, timeout, log: join(out, 'ngspice.log') });
  const log = `${execution.stdout}\n${execution.stderr}`;
  const errors = log.split(/\r?\n/).filter(l => !/\bwarning\b/i.test(l) && /\berror\b|fatal|timestep too small|doanalyses:|simulation.*aborted/i.test(l));
  const warnings = log.split(/\r?\n/).filter(l => /\bwarning\b/i.test(l));
  if (runtime.version !== '45.2') warnings.push(`Library bulk validation used ngspice 45.2; current engine is ${runtime.version}.`);
  const result = {
    status: 'ok', simulationStatus: 'ok', plotStatus: o['no-plot'] ? 'skipped' : 'ok',
    engine: runtime, compatibility: 'ltpsa', input,
    inputSha256: createHash('sha256').update(text).digest('hex'), workingDirectory: out,
    command: [runtime.path, '-n', '-b', driverPath], outputDirectory: out,
    exitCode: execution.code, timedOut: execution.timedOut, warnings, errors, analyses: [],
    log: join(out, 'ngspice.log'),
    modelDependencies: dependencies
  };
  const files = (await readdir(out)).filter(f => f.endsWith('.raw') && f !== 'analysis-const.raw');
  for (const file of files) {
    try {
      const raw = join(out, file), data = await readRaw(raw), stem = basename(file, '.raw');
      const csvPath = join(out, `${stem}.csv`), dataPath = join(out, `${stem}.json`);
      await writeFile(csvPath, csv(data)); await writeFile(dataPath, JSON.stringify(data));
      const entry = { analysis: data.analysis, points: data.points, raw, csv: csvPath, data: dataPath, plots: [] };
      result.analyses.push(entry);
      if (!o['no-plot']) {
        try {
          const isOp = /operating point/i.test(data.analysis);
          const scale = data.vectors[0];
          const signals = (isOp ? data.vectors : data.vectors.slice(1));
          // Separate quantities and phase to avoid a graph mixing amperes, volts and degrees.
          for (const type of [...new Set(signals.map(v => v.type))]) {
            const group = signals.filter(v => v.type === type);
            for (let offset = 0; offset < group.length; offset += 6) {
              const chunk = group.slice(offset, offset + 6);
              for (const mode of data.complex ? ['magnitude', 'phase'] : ['value']) {
                const config = {
                  title: `${data.analysis}: ${mode}`, x: isOp ? [0] : scale.real,
                  xLabel: isOp ? 'Operating point' : `${scale.name} (${scale.type === 'time' ? 's' : scale.type === 'frequency' ? 'Hz' : scale.type})`,
                  yLabel: mode === 'phase' ? 'Phase (degrees)' : `${type}${mode === 'magnitude' ? ' magnitude (linear)' : ''}`,
                  logX: scale.type === 'frequency' && !isOp,
                  series: chunk.map(v => ({ name: v.name, values: mode === 'magnitude' ? v.real.map((x, i) => Math.hypot(x, v.imaginary[i])) : mode === 'phase' ? v.real.map((x, i) => Math.atan2(v.imaginary[i], x) * 180 / Math.PI) : v.real })),
                  output: join(out, `${stem}-${type.replace(/[^a-z0-9]/gi, '_')}-${offset}-${mode}.png`)
                };
                entry.plots.push(await plot(config, o));
              }
            }
          }
        } catch (e) { result.plotStatus = 'error'; warnings.push(`PNG rendering failed: ${e.message}`); }
      }
    } catch (e) { errors.push(`${file}: ${e.message}`); }
  }
  if (execution.code !== 0 || execution.timedOut || errors.length || !result.analyses.length) result.simulationStatus = 'error';
  for (const type of expected) {
    const prefix = { tran: 'tran', op: 'op', ac: 'ac', dc: 'dc', noise: 'noise', pz: 'pz', tf: 'tf', sens: 'sens', disto: 'disto' }[type];
    if (!files.some(f => f.startsWith(`analysis-${prefix}`))) {
      errors.push(`No output for requested .${type} analysis`); result.simulationStatus = 'error';
    }
  }
  result.status = result.simulationStatus === 'error' || result.plotStatus === 'error' ? 'error' : warnings.length ? 'warning' : 'ok';
  await writeFile(join(out, 'result.json'), JSON.stringify(result, null, 2));
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const o = args();
  if (o.help) output({ usage: 'node simulate.mjs circuit.cir [--out NEW-directory] [--timeout seconds] [--ngspice absolute-path] [--cache directory] [--no-install] [--no-plot]' });
  else simulate(o).then(r => { output(r); if (r.status === 'error') process.exitCode = 1; }).catch(fail);
}
