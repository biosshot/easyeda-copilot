import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('dependency switching removes same-version links, restores local mode and preserves files on validation failure', () => {
  const npmCli = process.env.npm_execpath;
  assert.ok(npmCli, 'Run through npm run test:dependencies');
  const directory = mkdtempSync(join(tmpdir(), 'copilot-dependency-switch-'));
  const root = join(directory, 'app');
  const local = join(directory, 'local-router');
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'mcp'));
  mkdirSync(local);
  const write = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2));
  write(join(local, 'package.json'), { name: 'eda-copilot-router', version: '0.3.1', type: 'module' });
  write(join(root, 'package.json'), {
    name: 'dependency-switch-test', private: true, workspaces: ['mcp'],
    scripts: { local: 'node scripts/dependencies.mjs local', release: 'node scripts/dependencies.mjs release' },
  });
  write(join(root, 'mcp/package.json'), { name: 'switch-mcp', version: '1.0.0', dependencies: { 'eda-copilot-router': 'file:../../local-router' } });
  write(join(root, 'package-lock.json'), { name: 'dependency-switch-test', lockfileVersion: 3, packages: {} });
  const config = { 'eda-copilot-router': { version: '0.3.1', local: '../../local-router' } };
  write(join(root, 'scripts/dependency-config.json'), config);
  copyFileSync(new URL('dependencies.mjs', import.meta.url), join(root, 'scripts/dependencies.mjs'));
  const run = mode => spawnSync(process.execPath, [npmCli, 'run', mode], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 180_000 });
  const ok = mode => { const result = run(mode); assert.equal(result.status, 0, result.stdout + result.stderr); };
  ok('local');
  assert.equal(realpathSync(join(root, 'node_modules/eda-copilot-router')), realpathSync(local));
  ok('release');
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
  assert.equal(lock.packages['node_modules/eda-copilot-router'].version, '0.3.1');
  assert.ok(!lock.packages['node_modules/eda-copilot-router'].link);
  assert.notEqual(realpathSync(join(root, 'node_modules/eda-copilot-router')), realpathSync(local));
  ok('local');
  assert.equal(realpathSync(join(root, 'node_modules/eda-copilot-router')), realpathSync(local));
  const before = ['mcp/package.json', 'package-lock.json'].map(path => readFileSync(join(root, path), 'utf8'));
  config['eda-copilot-router'].local = '../../missing-router';
  write(join(root, 'scripts/dependency-config.json'), config);
  assert.notEqual(run('local').status, 0);
  assert.deepEqual(['mcp/package.json', 'package-lock.json'].map(path => readFileSync(join(root, path), 'utf8')), before);
});
