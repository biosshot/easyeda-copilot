import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const backend = fileURLToPath(new URL('../', import.meta.url));
const directory = join(backend, 'tests/pcb-layout');
const cases = new Map(readdirSync(directory, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .flatMap(entry => {
    const runners = readdirSync(join(directory, entry.name)).filter(name => name.endsWith('.ts'));
    return runners.map(file => [entry.name, join(directory, entry.name, file)]);
  }));
const names = process.argv.slice(2);
if (!names.length || names.includes('--list')) {
  console.log('PCB layout fixtures:\n' + [...cases.keys()].join('\n'));
  console.log('\nHanboo contains source JSON only, as in the original test bank.');
  console.log('Run: npm run test:pcb-layout --workspace=eda-copilot-backend -- <name> [name ...]');
  console.log('Run every fixture: npm run test:pcb-layout --workspace=eda-copilot-backend -- --all');
} else {
  const selected = names.includes('--all') ? [...cases.keys()] : names;
  for (const name of selected) {
    if (!cases.has(name)) throw new Error('Unknown PCB fixture: ' + name + '. Use --list.');
  }
  const failed = [];
  for (const name of selected) {
    console.log('\nRunning PCB fixture: ' + name);
    const result = spawnSync(process.execPath, ['--import', 'tsx', cases.get(name)], {
      cwd: backend, stdio: 'inherit', windowsHide: true, timeout: 600_000,
    });
    if (result.error || result.status !== 0) {
      if (result.error) console.error(result.error.message);
      failed.push(name);
    }
  }
  console.log('\nPCB fixture runners: ' + (selected.length - failed.length) + ' completed, ' + failed.length + ' failed.');
  if (failed.length) console.error('Failed: ' + failed.join(', '));
  process.exitCode = failed.length ? 1 : 0;
}
