// Uses the exact archive produced by integration CI, including on recovery runs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { archiveIntegrity, checkNpm, npmVersion, retry, waitForNpm } from './release-registry.mjs';

assert.equal(process.platform, 'linux', 'Publishing runs on the Linux release runner');
const source = resolve(process.argv[3] ?? '.');
const pkg = JSON.parse(readFileSync(resolve(source, 'mcp/package.json')));
assert.equal(process.env.RELEASE_TAG ?? process.env.GITHUB_REF?.replace('refs/tags/', ''),
  `v${pkg.version}`, 'Publish requires the matching release tag');
const archive = resolve(process.argv[2] ?? 'artifacts', `${pkg.name}-${pkg.version}.tgz`);
const integrity = archiveIntegrity(readFileSync(archive));
const published = await retry('npm preflight', () => npmVersion(pkg));
if (published) {
  checkNpm(pkg, integrity, published);
  console.log(`${pkg.name}@${pkg.version} already published with identical contents.`);
} else {
  const result = spawnSync('npm', ['publish', archive, '--access', 'public', '--provenance', '--registry=https://registry.npmjs.org'],
    { stdio: 'inherit', timeout: 180_000 });
  // Never repeat a potentially committed npm write; reconcile the exact version.
  if (result.error || result.status !== 0) console.warn('npm publish did not confirm success; verifying registry state.');
}
await waitForNpm(pkg, integrity);
console.log(`${pkg.name}@${pkg.version} is available with the tested archive integrity.`);
