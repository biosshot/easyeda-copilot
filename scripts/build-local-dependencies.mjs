import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const mcp = fileURLToPath(new URL('../mcp/package.json', import.meta.url));
const pkg = JSON.parse(readFileSync(mcp, 'utf8'));
for (const name of ['eda-copilot-backend', 'eda-copilot-router']) {
  const spec = pkg.dependencies[name];
  if (!spec.startsWith('file:')) continue;
  const cwd = resolve(dirname(mcp), spec.slice(5));
  if (JSON.parse(readFileSync(resolve(cwd, 'package.json'), 'utf8')).name !== name) throw new Error(`Wrong dependency directory: ${cwd}`);
  if (!process.env.npm_execpath) throw new Error('Run via npm');
  const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', 'build'], { cwd, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
