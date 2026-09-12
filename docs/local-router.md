# Use a local Copilot Router with EasyEDA Copilot

The MCP workspace imports `eda-copilot-router` at runtime. The EasyEDA extension does not bundle KRT. Rebuilding or relinking the router therefore requires a new MCP process; toggling the extension connection does not reload JavaScript in an existing process.

These commands assume sibling `copilot-router` and `easyeda-copilot` repositories. Run them from the EasyEDA Copilot repository root after installing and building its local backend as described in [CONTRIBUTING](../CONTRIBUTING.md).

```sh
npm --prefix ../copilot-router ci
npm --prefix ../copilot-router run build:package
npm run deps:local
npm run router:info --workspace=mcp
npm run check --workspace=mcp
```

`npm run deps:local` switches backend and router to sibling `file:` paths and updates the lockfile. `router:info` prints the actual resolved package path and managed KRT version. See [local development](local-development.md).

`mcp/docs/pcb-routing/dsl.ts` is the curated LLM reference. It is intentionally maintained separately from the router package's declarations. Review changed signatures and defaults during an upgrade; MCP builds do not overwrite this reference.

Use the local MCP entry in the client's server configuration:

```json
{
  "mcpServers": {
    "easyeda-copilot": {
      "command": "node",
      "args": ["/absolute/path/to/easyeda-copilot/mcp/dist/index.js"]
    }
  }
}
```

Finish or cancel active operations before restarting that MCP server in the client. Prepared operations are in memory and do not survive a restart. A new process uses the linked router; existing processes continue using their already loaded version. After reconnection, call `list_easyeda_instances` and `get_current_project_info` to verify the connection. An `npx easyeda-copilot-mcp` configuration uses its installed package, not this checkout.

`npm run check --workspace=mcp` verifies types, adapters, operations and MCP integration against test fixtures. The router repository's `npm run e2e:no-kicad:krt` separately exercises the native managed runtime, including ground routing. Neither check edits an open EasyEDA board or establishes that a particular live PCB passes native DRC.

The local upgrade uses KRT 0.22.0, includes ground in normal routing/recovery, removes forced QFN via-in-pad opt-in, and defaults plane stitching to `viaInPad: false`. It adds no positive `same-net-pad-clearance` override and does not guarantee that every native via avoids pads. `onlyNets` and `ignoreNets` remain explicit routing filters.

To return to published dependencies, finish active operations and run `npm run deps:release`, then rebuild and restart MCP. The switch requires both versions to exist in npm and regenerates the lockfile. `npm ci` alone does not switch dependency modes.
