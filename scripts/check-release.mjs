import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const root = new URL('../', import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const mcp = read('mcp/package.json');
const config = read('scripts/dependency-config.json');
assert.ok(!mcp.bundleDependencies && !mcp.bundledDependencies, 'Backend must be an external npm dependency');
for (const [name, target] of Object.entries(config)) {
  assert.equal(mcp.dependencies[name], target.version, name + ': run npm run deps:release before packaging a release');
}
for (const [name, spec] of Object.entries(mcp.dependencies)) {
  assert.ok(!/^(?:file:|link:|workspace:|git|https?:|\.\.?[\\/])/.test(spec), name + ': non-registry dependency');
}
for (const [path, entry] of Object.entries(read('package-lock.json').packages)) {
  assert.ok(!path.startsWith('../'), 'External lockfile path: ' + path);
  if (entry.link) assert.ok(!entry.resolved.startsWith('../'), 'External lockfile link: ' + path);
}
const registry = read('mcp/server.json');
assert.equal(registry.version, mcp.version);
assert.equal(registry.packages[0].version, mcp.version);
assert.equal(read('package.json').version, mcp.version);
assert.equal(read('extension.json').version, mcp.version);
const runtime = readFileSync(new URL('mcp/src/index.ts', root), 'utf8').match(/name: 'easyeda-copilot',\s*version: '([^']+)'/);
assert.equal(runtime?.[1], mcp.version, 'MCP runtime version differs');
if (process.env.GITHUB_REF?.startsWith('refs/tags/')) assert.equal(process.env.GITHUB_REF, 'refs/tags/v' + mcp.version);
const require = createRequire(new URL('mcp/package.json', root));
for (const [name, target] of Object.entries(config)) {
  const installed = JSON.parse(readFileSync(require.resolve(name + '/package.json'), 'utf8'));
  assert.equal(installed.version, target.version, 'Installed dependency differs: ' + name);
}
const backend = dirname(require.resolve('eda-copilot-backend/package.json'));
for (const platform of ['win32-x64-msvc', 'linux-x64-gnu', 'darwin-x64', 'darwin-arm64']) {
  assert.ok(statSync(join(backend, 'native/pcb-board-packer', 'pcb-board-packer.' + platform + '.node')).size > 0, 'Missing backend binary: ' + platform);
}
console.log('Release versions, registry dependency specs, lockfile and installed backend native coverage verified.');
