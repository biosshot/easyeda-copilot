// Invoked only by the Linux tag workflow, after all build/package gates pass.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

assert.equal(process.platform, 'linux', 'Publishing runs on the Linux release runner');
const root = new URL('../', import.meta.url);
const packages = ['mcp'].map(dir => JSON.parse(readFileSync(new URL(`${dir}/package.json`, root))));
assert.equal(process.env.GITHUB_REF, `refs/tags/v${packages[0].version}`, 'Publish requires the matching release tag');
const artifacts = resolve(process.argv[2] ?? 'artifacts');
const pending = [];
// Only MCP is published here; backend has its own repository and release workflow. A retry can reuse identical bytes,
// but an existing version with different contents must never be silently skipped.
for (const pkg of packages) {
  const archive = resolve(artifacts, `${pkg.name}-${pkg.version}.tgz`);
  const integrity = 'sha512-' + createHash('sha512').update(readFileSync(archive)).digest('base64');
  const response = await fetch(`https://registry.npmjs.org/${pkg.name}/${pkg.version}`);
  if (response.status === 404) {
    pending.push(archive);
  } else {
    assert.ok(response.ok, `Registry check failed for ${pkg.name}: HTTP ${response.status}`);
    const published = await response.json();
    assert.equal(published.dist.integrity, integrity,
      `${pkg.name}@${pkg.version} already exists with different contents. Bump its version before releasing.`);
    console.log(`${pkg.name}@${pkg.version} already published with identical contents.`);
  }
}
for (const archive of pending) {
  const result = spawnSync('npm', ['publish', archive, '--access', 'public', '--provenance', '--registry=https://registry.npmjs.org'], { stdio: 'inherit' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `Publishing failed: ${archive}`);
}
