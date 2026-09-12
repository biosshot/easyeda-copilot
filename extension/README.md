# Extension workspace

This private workspace contains the EasyEDA editor integration and the legacy Vue interface. MCP lives in `../mcp`; shared contracts remain in `../shared`. Install dependencies with `npm ci` from the repository root; there is one root lockfile.

| Path | Purpose |
| --- | --- |
| `src/` | Editor commands, MCP bridge, inspection and document application |
| `web/` | Vue interface and Vite pages |
| `images/`, `locales/` | Installed extension assets |
| `extension.json` | EasyEDA manifest, menus, identity and version |
| `config/`, `build.mjs`, `vite.config.ts` | Editor bundling and UI builds |
| `build/packaged.ts` | `.eext` packaging |
| `tests/` | Editor-logic regression tests |

Run from the repository root:

```sh
npm run dev
npm run build
npm run test:extension
npm run check --workspace=mcp
```

The existing `compile`, `build:vite`, `dev:export-reused` and `eslint` commands also remain available at the root. To pass workspace-specific arguments, use `npm run dev --workspace=@copilot/extension -- --port 4002`.

Generated JavaScript and UI files stay in `extension/dist/` and `extension/iframe/`. The final archive retains its existing root location: `build/dist/easyeda-copilot_v<VERSION>.eext`. Its internal paths remain `extension.json`, `dist/`, `iframe/`, `images/`, `locales/` and `LICENSE`, so installed extension URLs do not change. The packager uses this explicit list and validates required outputs; `.edaignore` is no longer used. Source files, workspace dependencies and MCP are excluded.

`npm run build` builds and packages the extension; it does not build or publish MCP. `npm run check --workspace=mcp` builds and checks MCP. CI builds the extension and runs editor tests on Windows x64, Linux x64 and both macOS architectures with Node 20/24. No release is triggered without a version tag.

Keep the root, MCP, extension workspace and EasyEDA manifest versions consistent; `npm run check:release` checks them along with registry metadata and MCP's runtime version.
