import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const mcp = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../package.json', import.meta.url));
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run with npm run test:package --workspace=mcp');
const artifacts = join(mcp, '.artifacts');
mkdirSync(artifacts, { recursive: true });
function run(args, cwd, env = process.env) {
  const result = spawnSync(process.execPath, args, { cwd, env, encoding: 'utf8', windowsHide: true, timeout: 180_000 });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
function pack(cwd) {
  const parsed = JSON.parse(run([npmCli, 'pack', '--ignore-scripts', '--json', '--pack-destination', artifacts], cwd));
  const [pkg] = Array.isArray(parsed) ? parsed : Object.values(parsed);
  return { ...pkg, archive: join(artifacts, pkg.filename) };
}
const manifest = JSON.parse(readFileSync(join(mcp, 'package.json'), 'utf8'));
assert.ok(!manifest.bundleDependencies && !manifest.bundledDependencies, 'Backend must not be bundled');
const archives = [];
for (const name of ['eda-copilot-backend', 'eda-copilot-router']) {
  const path = dirname(require.resolve(name + '/package.json'));
  const dependency = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
  const spec = manifest.dependencies[name];
  if (spec.startsWith('file:')) {
    archives.push(pack(path).archive);
    manifest.dependencies[name] = dependency.version;
  } else assert.equal(spec, dependency.version);
}
// Stage only distributable MCP files. Local file: specs become registry-version
// contracts here, without changing the developer's manifest or publishing anything.
const stage = mkdtempSync(join(tmpdir(), 'easyeda-mcp-pack-'));
for (const entry of ['dist', 'docs', 'README.md', 'LICENSE']) cpSync(join(mcp, entry), join(stage, entry), { recursive: true });
writeFileSync(join(stage, 'package.json'), JSON.stringify(manifest, null, 2));
const packed = pack(stage);
assert.ok(!packed.files.some(file => file.path.startsWith('node_modules/')), 'Unexpected bundled dependencies');
const consumer = mkdtempSync(join(tmpdir(), 'easyeda-mcp-consumer-'));
writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'mcp-consumer-check', private: true, type: 'module' }));
console.log('Installing MCP with separate backend/router packages outside all source checkouts...');
run([npmCli, 'install', '--ignore-scripts', '--no-audit', '--no-fund', '--fetch-timeout=30000', '--fetch-retries=0', '--registry=https://registry.npmjs.org', ...archives, packed.archive], consumer);
const installedRequire = createRequire(join(consumer, 'package.json'));
for (const name of ['eda-copilot-backend', 'eda-copilot-router']) {
  assert.ok(realpathSync(installedRequire.resolve(name + '/package.json')).startsWith(realpathSync(consumer)), 'Dependency escaped consumer: ' + name);
}
copyFileSync(join(mcp, 'tests/fixtures/api-fixtures.mjs'), join(consumer, 'fixtures.mjs'));
copyFileSync(join(mcp, 'scripts/check-local-backend.mjs'), join(consumer, 'smoke.mjs'));
const cleanEnv = { ...process.env };
for (const name of Object.keys(cleanEnv)) {
  if (/^(?:NODE_OPTIONS|NODE_PATH|PCB_BOARD_PACKER_NATIVE_PATH|COPILOT_ROUTER_.*|EASYEDA_COPILOT_SERVER_URL|KICAD_COPILOT_SERVER_URL|PYTHONPATH|PYTHONHOME)$/i.test(name)) delete cleanEnv[name];
}
process.stdout.write(run([join(consumer, 'smoke.mjs'), join(consumer, 'node_modules/easyeda-copilot-mcp/dist/index.js'), join(consumer, 'fixtures.mjs')], consumer, cleanEnv));
const installedDocs = join(consumer, 'node_modules/easyeda-copilot-mcp/docs');
for (const helper of ['download', 'pdf-outline']) {
  const result = JSON.parse(run([join(installedDocs, 'datasheets/scripts', helper + '.mjs'), '--help'], consumer, cleanEnv));
  assert.ok(result.usage, 'Packaged DataSheets helper must run: ' + helper);
}
process.stdout.write(run([join(mcp, 'scripts/check-docs.mjs'), installedDocs], consumer, cleanEnv));
if (process.env.SPICE_TEST_NGSPICE) {
  process.stdout.write(run([join(mcp, 'scripts/check-spice-package.mjs'), join(installedDocs, 'spice')], consumer, cleanEnv));
} else assert.ok(!process.env.SPICE_TEST_REQUIRED, 'SPICE package checks must not be skipped in CI');
writeFileSync(join(artifacts, 'package-check.json'), JSON.stringify({ mcp: packed.filename, dependencies: manifest.dependencies, consumer, checkedAt: new Date().toISOString() }, null, 2));
console.log('Separate-package MCP installation and protocol tests passed.');
