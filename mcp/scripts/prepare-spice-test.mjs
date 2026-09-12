import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ngspice } from '../docs/spice/scripts/ngspice.mjs';

const cache = await mkdtemp(join(tmpdir(), 'spice runtime test '));
const original = { ...process.env };
let runtime;
try {
  delete process.env.SPICE_NGSPICE;
  if (process.platform === 'win32') {
    // Exercise first-use installation without a preinstalled ngspice or 7-Zip.
    for (const key of Object.keys(process.env)) if (/^(path|programfiles)$/i.test(key)) delete process.env[key];
    process.env.PATH = [dirname(process.execPath), join(original.SystemRoot || 'C:/Windows', 'System32')].join(';');
    process.env.ProgramFiles = cache;
  }
  runtime = await ngspice({ cache });
  assert.ok(runtime?.version, 'ngspice installation did not produce a working runtime');
  assert.deepEqual(await ngspice({ cache, 'no-install': true }), runtime, 'Offline runtime reuse failed');
  if (process.platform === 'win32') assert.ok(runtime.path.startsWith(cache), 'Managed Windows installation was bypassed');
} finally {
  for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
  Object.assign(process.env, original);
}
const artifacts = fileURLToPath(new URL('../.artifacts/', import.meta.url));
await mkdir(artifacts, { recursive: true });
await writeFile(join(artifacts, 'spice-runtime.json'), JSON.stringify({ ...runtime, cache }, null, 2));
if (process.env.GITHUB_ENV) await appendFile(process.env.GITHUB_ENV, `SPICE_TEST_NGSPICE=${runtime.path}\nSPICE_TEST_REQUIRED=1\n`);
console.log(`ngspice ${runtime.version} prepared and reusable offline: ${runtime.path}`);
