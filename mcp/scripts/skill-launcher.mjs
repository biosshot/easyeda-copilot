#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const runtime = fileURLToPath(new URL('./runtime/', import.meta.url));
const info = JSON.parse(readFileSync(new URL('../build-info.json', import.meta.url), 'utf8'));
if (!existsSync(new URL('./runtime/node_modules/', import.meta.url))) {
    console.error(`Dependencies are not installed. The agent must run npm install --omit=dev in "${runtime}". Read install-guide.md first.`);
    if (info.installationBlockers?.length) console.error(`Installation is blocked until these packages are published:\n${info.installationBlockers.join('\n')}`);
    process.exitCode = 1;
} else {
    import('./runtime/dist/cli.js').catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
