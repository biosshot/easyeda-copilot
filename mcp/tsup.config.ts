import { defineConfig } from 'tsup';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sdkDistDir = dirname(dirname(require.resolve('@modelcontextprotocol/sdk/package.json')));

const sdkEsmPath = (...parts: string[]) =>
    join(sdkDistDir, 'esm', ...parts);

export default defineConfig({
    entry: [
        'src/index.ts',
        'src/pcb-preview/cli.ts',
        'src/pcb-preview/index.ts',
        'src/operations/manager.ts',
        'src/routing/routing-operation.ts',
        'src/routing/easyeda-autoroute-adapter.ts',
        'src/routing/easyeda-drc-adapter.ts',
        'src/tools/projects.ts',
        'src/tools/docs.ts',
        'src/tools/execute-js.ts',
    ],
    format: ['esm'],
    clean: true,
    dts: false,
    sourcemap: false,
    // Keep eda-copilot-router and eda-copilot-backend external so their assets remain
    // discoverable after easyeda-copilot-mcp is installed from npm.
    noExternal: ['@modelcontextprotocol/sdk', '@copilot/shared'],
    esbuildPlugins: [
        {
            name: 'mcp-sdk-extensionless-imports',
            setup(build) {
                build.onResolve({ filter: /^@modelcontextprotocol\/sdk\/server\/mcp$/ }, () => ({
                    path: sdkEsmPath('server', 'mcp.js'),
                }));

                build.onResolve({ filter: /^@modelcontextprotocol\/sdk\/server\/stdio$/ }, () => ({
                    path: sdkEsmPath('server', 'stdio.js'),
                }));
            },
        },
    ],
});
