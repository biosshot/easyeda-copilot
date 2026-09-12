import { createRequire } from 'node:module';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { KRT_MANAGED_VERSION } from 'eda-copilot-router/backends/krt';

const require = createRequire(import.meta.url);
const path = require.resolve('eda-copilot-router/package.json');
const pkg = JSON.parse(await readFile(path, 'utf8'));
console.log(JSON.stringify({
  package: pkg.name,
  version: pkg.version,
  packagePath: path,
  realPackagePath: await realpath(path),
  managedKrtVersion: KRT_MANAGED_VERSION,
  dslPath: join(dirname(path), 'docs', 'routing-dsl.d.ts'),
}, null, 2));
