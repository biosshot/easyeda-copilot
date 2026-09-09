import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    components: 'src/components.ts',
    schematic: 'src/schematic.ts',
    pcb: 'src/pcb.ts',
    types: 'src/types.ts',
    'run-pcb-layout.worker': 'src/pcb-layout/run-pcb-layout.worker.ts',
    'tree-subtree.worker': 'src/pcb-layout/pcb-auto-place-v2/tree-subtree.worker.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  clean: true,
  splitting: true,
  noExternal: ['@copilot/shared'],
  dts: { resolve: ['@copilot/shared'], entry: ['src/index.ts', 'src/components.ts', 'src/schematic.ts', 'src/pcb.ts', 'src/types.ts'] },
});
