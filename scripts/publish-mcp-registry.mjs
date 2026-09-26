import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { publishRegistry, TemporaryError } from './release-registry.mjs';

const executable = resolve(process.argv[2] ?? 'mcp-publisher');
const cwd = resolve(process.argv[3] ?? 'mcp');
const manifest = JSON.parse(readFileSync(resolve(cwd, 'server.json')));
await publishRegistry(manifest, async args => {
  try {
    const result = await promisify(execFile)(executable, args, { cwd, timeout: 60_000 });
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
  } catch (error) {
    const message = `${error.message}\n${error.stdout ?? ''}\n${error.stderr ?? ''}`;
    if (error.killed) throw new TemporaryError(message);
    throw new Error(message);
  }
});
console.log(`Verified active MCP Registry entry: ${manifest.name}@${manifest.version}`);
