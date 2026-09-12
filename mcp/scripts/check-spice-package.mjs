import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const skill = resolve(process.argv[2]);
const root = mkdtempSync(join(tmpdir(), 'standalone spice '));
const copy = join(root, 'skill');
cpSync(skill, copy, { recursive: true });
const env = { ...process.env };
for (const key of Object.keys(env)) if (/^(NODE_PATH|NODE_OPTIONS|SPICE_CACHE_DIR|SPICE_NGSPICE)$/i.test(key)) delete env[key];
assert.ok(process.env.SPICE_TEST_NGSPICE, 'Set SPICE_TEST_NGSPICE to test the installed skill');
for (const offline of [false, true]) {
  const output = join(root, offline ? 'offline results' : 'first results');
  const args = [join(copy, 'scripts/simulate.mjs'), join(copy, 'examples/rc-filter.cir'), '--out', output,
    '--ngspice', process.env.SPICE_TEST_NGSPICE, '--cache', join(root, 'cache'), ...(offline ? ['--no-install'] : [])];
  const run = spawnSync(process.execPath, args, { cwd: root, env, encoding: 'utf8', windowsHide: true, timeout: 180_000 });
  assert.ifError(run.error);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const result = JSON.parse(readFileSync(join(output, 'result.json'), 'utf8'));
  assert.equal(result.simulationStatus, 'ok');
  assert.equal(result.plotStatus, 'ok');
  assert.equal(result.analyses.length, 3);
  for (const analysis of result.analyses) {
    for (const file of [analysis.raw, analysis.csv, analysis.data]) assert.ok(existsSync(file), file);
    assert.ok(analysis.plots.length);
    assert.deepEqual([...readFileSync(analysis.plots[0]).subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  }
}
assert.ok(existsSync(join(root, 'cache/node-runtime/sharp-0.35.0/node_modules/sharp/package.json')), 'Standalone Sharp installation was bypassed');
console.log('Installed SPICE skill works independently: automatic Sharp install, OP/AC/transient, PNG, offline reuse.');
