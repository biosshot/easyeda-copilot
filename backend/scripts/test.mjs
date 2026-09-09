import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const files = ['tests', 'tests/patterns'].flatMap(dir => readdirSync(dir)
  .filter(name => name.endsWith('.test.ts') && name.startsWith(process.argv[2] ?? '')).map(name => `${dir}/${name}`));
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=2', ...files], {
  stdio: 'inherit', windowsHide: true,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
