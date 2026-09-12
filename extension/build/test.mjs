import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
// Node 20 on Windows does not expand test globs; pass real filenames on every OS.
const tests = readdirSync(join(root, 'tests')).filter(name => name.endsWith('.test.ts')).sort();
if (!tests.length) throw new Error('No extension tests found');
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...tests.map(name => join(root, 'tests', name))], {
    cwd: root, stdio: 'inherit', windowsHide: true,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
