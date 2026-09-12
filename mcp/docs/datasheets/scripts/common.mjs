import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const isMain = url => Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(url));
export const output = value => console.log(JSON.stringify(value, null, 2));
export function fail(error) { output({ status: 'error', message: error.message }); process.exitCode = 1; }
export function args(argv, allowed) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help') { result.help = true; continue; }
    if (!arg.startsWith('--')) { result._.push(arg); continue; }
    const key = arg.slice(2);
    if (!allowed.includes(key)) throw new Error(`Unknown option: ${arg}`);
    if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`Missing value: ${arg}`);
    result[key] = argv[++i];
  }
  return result;
}
