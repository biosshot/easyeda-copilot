import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, stat, readdir, cp, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { rank, search } from '../docs/spice/scripts/search.mjs';
import { library, unpackModels, inside, run, readModel } from '../docs/spice/scripts/common.mjs';
import { copyModel } from '../docs/spice/scripts/copy-model.mjs';
import { simulate } from '../docs/spice/scripts/simulate.mjs';
import { readRaw } from '../docs/spice/scripts/raw.mjs';
import { svgPlot } from '../docs/spice/scripts/plot.mjs';
import { ngspice } from '../docs/spice/scripts/ngspice.mjs';

const model = (name, status = 'compiled') => ({ name, path: `${name}.lib`, aliases: [], description: 'dual operational amplifier', validation: { status } });
test('MPN ranking separates exact, substring, fuzzy and reviewed models', () => {
  const models = [model('LM358N'), model('LM358'), model('LM358A', 'needs_review'), model('LM358B')];
  assert.equal(rank(models, 'LM358')[0].name, 'LM358');
  assert.equal(rank(models, 'LM358').length, 3);
  assert.equal(rank(models, 'LM358', true).length, 4);
  assert.equal(rank(models, 'LM-358')[0].match, 'normalized');
  assert.equal(rank(models, 'LM359')[0].match, 'similar-name-not-equivalent');
  assert.equal(rank(models, 'operational amplifier')[0].match, 'description');
  assert.equal(rank(models, 'nonexistent').length, 0);
});
test('archive installation, cache reuse, traversal and checksum rejection', async () => {
  const root = await mkdtemp(join(tmpdir(), 'spice-test-'));
  const index = { schemaVersion: 1, version: 'test', models: [model('LM358'), model('ДИОД')] };
  const records = [{ path: 'index.json', text: JSON.stringify(index) }, { path: 'LM358.lib', text: '* µA, Ω, русский текст\n.subckt LM358 1 2 3\n.ends\n' }, { path: 'ДИОД.lib', text: '* Ω\n.model D D(Is=1e-9)\n' }];
  const archive = join(root, 'models.gz');
  const bytes = gzipSync(records.map(x => JSON.stringify(x)).join('\r\n'));
  await writeFile(archive, bytes);
  const manifest = join(root, 'manifest.json');
  await writeFile(manifest, JSON.stringify({ version: 'test', archive, sha256: createHash('sha256').update(bytes).digest('hex') }));
  const options = { manifest, cache: join(root, 'cache'), _: ['LM358'] };
  const results = await Promise.all([search(options), search(options)]);
  assert.equal(results[0].results[0].modelText, records[1].text);
  assert.equal((await search({ ...options, _: ['missing'] })).totalMatches, 0);
  const cached = await library({ ...options, 'no-install': true });
  assert.equal(cached.index.models.length, 2);
  assert.deepEqual((await readdir(cached.root)).sort(), ['index.json', 'library.jsonl']);
  assert.equal(await readModel(cached.root, cached.index.models[1]), records[2].text);
  assert.equal(results[0].results[0].modelId, 'LM358.lib');
  assert.equal(results[0].results[0].path, undefined);
  const copyOptions = { ...options, _: [results[0].results[0].modelId], out: join(root, 'selected models') };
  const copied = await copyModel(copyOptions);
  assert.equal(await readFile(copied.path, 'utf8'), records[1].text);
  assert.equal((await readdir(copyOptions.out)).length, 1);
  assert.match(copied.include, /^\.include "/);
  assert.equal((await copyModel(copyOptions)).reused, true);
  await writeFile(copied.path, '* user edit');
  await assert.rejects(copyModel(copyOptions), /refusing to overwrite/);
  await assert.rejects(copyModel({ ...copyOptions, _: ['LM358'] }), /Unknown modelId/);
  await assert.rejects(readModel(cached.root, { ...cached.index.models[0], offset: cached.index.models[1].offset, length: cached.index.models[1].length }), /does not match/);
  await assert.rejects(readModel(cached.root, { ...cached.index.models[0], length: 256 * 1024 ** 2 + 1 }), /Invalid model byte range/);
  await writeFile(manifest, JSON.stringify({ version: 'bad', archive, sha256: '0'.repeat(64) }));
  await assert.rejects(library(options), /SHA-256/);
  await writeFile(archive, gzipSync(JSON.stringify({ path: '../escape', text: 'bad' }) + '\n'));
  await assert.rejects(unpackModels(archive, join(root, 'unsafe')), /Unsafe/);
  await writeFile(archive, gzipSync(records.map(x => JSON.stringify(x)).join('\n')).subarray(0, 30));
  await assert.rejects(unpackModels(archive, join(root, 'truncated')));
  assert.throws(() => inside(root, 'C:/outside'), /Unsafe/);
});
test('plot rejects absent data and escapes labels', () => {
  assert.throws(() => svgPlot({ x: [], series: [] }), /No plot data/);
  assert.match(svgPlot({ title: '<script>', x: [1, 2], series: [{ name: 'a', values: [2, 3] }] }), /&lt;script&gt;/);
});
test('process timeout is reported', async () => {
  const r = await run(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeout: 50 });
  assert.equal(r.timedOut, true);
});
test('standalone CLI entrypoints work through directory symlinks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'spice linked CLI '));
  const original = join(root, 'original'), linked = join(root, 'linked');
  await cp(fileURLToPath(new URL('../docs/spice/', import.meta.url)), original, { recursive: true });
  await symlink(original, linked, process.platform === 'win32' ? 'junction' : 'dir');
  for (const name of ['search', 'copy-model', 'simulate', 'plot']) {
    const result = await run(process.execPath, [join(linked, 'scripts', `${name}.mjs`), '--help']);
    assert.equal(result.code, 0, result.stderr);
    assert.ok(JSON.parse(result.stdout).usage, `${name} did not enter its CLI`);
  }
});
test('an invalid explicit ngspice path cannot silently select another runtime', async () => {
  const root = await mkdtemp(join(tmpdir(), 'spice missing runtime '));
  await assert.rejects(ngspice({ ngspice: join(root, 'missing-executable'), cache: root }), /ENOENT|ngspice executable/);
});
const executable = process.env.SPICE_TEST_NGSPICE;
assert.ok(!process.env.SPICE_TEST_REQUIRED || executable, 'SPICE_TEST_REQUIRED requires SPICE_TEST_NGSPICE; real simulations must not be skipped in CI');
test('ngspice: RC frequency response, transient, OP and PNG', { skip: !executable }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'spice integration '));
  const result = await simulate({ _: [fileURLToPath(new URL('../docs/spice/examples/rc-filter.cir', import.meta.url))], ngspice: executable, out: join(root, 'result'), 'no-install': true });
  assert.equal(result.simulationStatus, 'ok', JSON.stringify(result.errors));
  assert.equal(result.plotStatus, 'ok');
  assert.equal(result.analyses.length, 3);
  const ac = await readRaw(result.analyses.find(a => a.analysis === 'AC Analysis').raw);
  const voltage = ac.vectors.find(v => v.name === 'v(out)');
  for (const i of [0, 200, 300, 500]) {
    const expected = 1 / Math.hypot(1, 2 * Math.PI * ac.vectors[0].real[i] * .0001);
    assert.ok(Math.abs(Math.hypot(voltage.real[i], voltage.imaginary[i]) - expected) < 1e-8);
  }
  const png = await readFile(result.analyses[0].plots[0]);
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  await assert.rejects(simulate({ _: [result.input], ngspice: executable, out: result.outputDirectory }), /EEXIST/);
});
test('ngspice: nested model snapshots and DC sweep; broken models fail', { skip: !executable }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'spice nested '));
  await mkdir(join(root, 'models with spaces'));
  await writeFile(join(root, 'models with spaces', 'diode.lib'), '.include "inner.lib"\n');
  await writeFile(join(root, 'models with spaces', 'inner.lib'), '.model demo D(Is=2n N=1.8)\n');
  const circuit = join(root, 'diode circuit.cir');
  await writeFile(circuit, 'Diode\n.include "models with spaces/diode.lib"\nV1 in 0 0\nR1 in out 1k\nD1 out 0 demo\n.save v(out)\n.dc V1 0 5 0.1\n.end\n');
  const result = await simulate({ _: [circuit], ngspice: executable, out: join(root, 'dc output'), 'no-install': true });
  assert.equal(result.simulationStatus, 'ok', JSON.stringify(result.errors));
  assert.equal(result.modelDependencies.length, 3);
  const data = await readRaw(result.analyses[0].raw);
  const last = data.vectors.find(v => v.name === 'v(out)').real.at(-1);
  assert.ok(last > .5 && last < .9);
  await writeFile(join(root, 'models with spaces', 'inner.lib'), '.model demo D(Is=2n N=1.8)\n.control\nquit\n.endc\n');
  await assert.rejects(simulate({ _: [circuit], ngspice: executable, out: join(root, 'model control') }), /runner owns \.control/);
  await writeFile(circuit, 'Broken\nD1 out 0 missing_model\nV1 out 0 1\n.op\n.end\n');
  const broken = await simulate({ _: [circuit], ngspice: executable, out: join(root, 'broken'), 'no-plot': true });
  assert.equal(broken.simulationStatus, 'error');
  assert.ok((await stat(broken.log)).size > 0);
});
