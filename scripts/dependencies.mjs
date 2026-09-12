import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const mcpFile = join(root, 'mcp/package.json');
const lockFile = join(root, 'package-lock.json');
const config = JSON.parse(readFileSync(new URL('dependency-config.json', import.meta.url), 'utf8'));
const mcp = JSON.parse(readFileSync(mcpFile, 'utf8'));
const mode = process.argv[2];
assert.ok(['local', 'release', 'status'].includes(mode), 'Use npm run deps:local, deps:release or deps:status');
if (mode === 'status') {
  for (const name of Object.keys(config)) console.log(`${name}: ${mcp.dependencies[name]}`);
  process.exit(0);
}
// Validate everything before touching manifests or the lockfile.
for (const [name, target] of Object.entries(config)) {
  if (mode === 'local') {
    const path = resolve(dirname(mcpFile), target.local, 'package.json');
    assert.equal(JSON.parse(readFileSync(path, 'utf8')).name, name, `Wrong local package: ${path}`);
  } else {
    assert.match(target.version, /^\d+\.\d+\.\d+$/, `Pin a release version for ${name}`);
    const response = await fetch(`https://registry.npmjs.org/${name}/${target.version}`, { signal: AbortSignal.timeout(30_000) });
    assert.ok(response.ok, `${name}@${target.version} is not available in npm (HTTP ${response.status}). Publish this dependency first. Local files were not changed.`);
    assert.equal((await response.json()).version, target.version);
  }
}
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run this script through npm');
const beforeManifest = readFileSync(mcpFile);
const beforeLock = readFileSync(lockFile);
for (const [name, target] of Object.entries(config)) mcp.dependencies[name] = mode === 'local' ? `file:${target.local}` : target.version;
// npm can retain a same-version workspace link when changing file: to registry.
const lock = JSON.parse(beforeLock);
for (const [name, target] of Object.entries(config)) {
  const localKey = relative(root, resolve(dirname(mcpFile), target.local)).replaceAll('\\', '/');
  for (const key of Object.keys(lock.packages)) {
    if (key === localKey || key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`)) delete lock.packages[key];
  }
}
writeFileSync(mcpFile, JSON.stringify(mcp, null, 2) + '\n');
writeFileSync(lockFile, JSON.stringify(lock, null, '\t') + '\n');
const result = spawnSync(process.execPath, [npmCli, 'install', '--ignore-scripts', '--no-audit', '--no-fund'], {
  cwd: root, stdio: 'inherit', windowsHide: true,
});
if (result.error || result.status !== 0) {
  writeFileSync(mcpFile, beforeManifest);
  writeFileSync(lockFile, beforeLock);
  throw new Error(`Dependency switch failed; manifests restored. Rerun npm install to restore node_modules. ${result.error?.message ?? ''}`);
}
console.log(`MCP dependencies switched to ${mode}.`);
if (mode === 'local') console.log('Build sibling libraries with npm run deps:build; build the backend native solver once in its own repository.');
