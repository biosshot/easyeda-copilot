import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

// Package self-resolution works both in the checkout and in an installed tarball.
const packageRoot = dirname(createRequire(import.meta.url).resolve('eda-copilot-backend/package.json'));
export const backendResource = (...parts: string[]) => join(packageRoot, ...parts);
