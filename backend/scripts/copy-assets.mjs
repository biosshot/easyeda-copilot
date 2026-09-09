import { copyFile } from 'node:fs/promises';

await copyFile(new URL('../src/pcb-layout/pcb-layout-dsl/spec-doc.d.ts', import.meta.url),
  new URL('../dist/spec-doc.d.ts', import.meta.url));
