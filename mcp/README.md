English | [简体中文](README.zh-CN.md) | [Русский](README.ru.md)
# easyeda-copilot-mcp

MCP server for EasyEDA Copilot.

It connects MCP clients such as Codex or Claude Code to EasyEDA Desktop through the EasyEDA Copilot extension. It supports schematic work, component search, PCB placement, assembly, routing, inspection, and DRC.

MCP is the recommended and actively developed EasyEDA Copilot interface. The built-in Interface remains available as a legacy workflow with fewer capabilities and limited maintenance.

## Requirements

- EasyEDA Desktop V3.2.149.
- EasyEDA Copilot extension with `External Interactions` enabled.
- An MCP-capable client such as Codex or Claude Code.
- Node.js >=20.19 and npm. Release targets: Windows x64, Linux x64 with glibc >=2.35, and macOS x64/arm64. Rust and C/C++ tools are not needed for npm installations. Routing downloads prebuilt KRT and, when needed, a private Python runtime and Python dependencies on first use; allow access to GitHub and PyPI. Linux ARM64, Windows ARM64 and Alpine/musl are not currently supported by the complete stack.

## Usage

1. Add this MCP server to your MCP client.
2. Start the MCP client with this server enabled.
3. Open EasyEDA Desktop.
4. Open the target schematic or PCB document.
5. EasyEDA Copilot connects automatically. Use `Copilot -> MCP` only to pause or resume scanning.

## PCB Workflow

PCB features are available through MCP clients, not through the built-in Copilot chat.

The MCP integration can:

- list the team/folder/project tree, create projects, and open a selected project;
- generate board outline and component placement from a schematic;
- preserve the opened PCB outline and selected existing component positions during incremental placement;
- create mechanical and final placement previews before import;
- assemble approved placement into the opened EasyEDA PCB document;
- run `eda-copilot-router` DSL programs through the managed Hybrid backend;
- create requested planes and stitching vias from the same routing DSL;
- replace selected existing copper only when the DSL explicitly calls `clearRouting(...)`;
- preview and inspect PCB objects, nets, and components;
- run EasyEDA PCB DRC and manage the copper-layer count.

Typical workflow: synchronize schematic changes, stop while the user confirms the EasyEDA import dialog, open the target PCB, review mechanical and final placement previews, assemble the approved placement, then run `run_pcb_router_dsl` and review native DRC. Existing placement can be retained with the placement DSL `preserve(...)`; existing copper is preserved by default and is replaced only when the routing DSL explicitly calls `clearRouting(...)`. Continue long placement and routing work with `wait_operation`.

## Build

```bash
git clone https://github.com/biosshot/eda-copilot-backend
git clone https://github.com/biosshot/eda-copilot-router copilot-router
git clone https://github.com/biosshot/easyeda-copilot
cd easyeda-copilot
npm ci
npm --prefix ../eda-copilot-backend ci
npm --prefix ../eda-copilot-backend run native:build
npm --prefix ../copilot-router ci
npm run deps:local
npm run build --workspace=easyeda-copilot-mcp
```

Backend and router are separate npm packages. For local development, keep sibling `eda-copilot-backend` and `copilot-router` repositories and use `npm run deps:local`. The MCP build rebuilds local dependencies; backend owns its runtime dependencies and native binaries. Use `npm run deps:release` to restore the published versions in `scripts/dependency-config.json`, then `npm run check:release`. No backend code is bundled into MCP. See [local development and release checks](../docs/local-development.md).

## MCP Config With npx

Codex:

```bash
codex mcp add easyeda-copilot -- npx -y easyeda-copilot-mcp
```

Claude Code:

```bash
claude mcp add easyeda-copilot -- npx -y easyeda-copilot-mcp
```

Generic MCP config:

```json
{
  "mcpServers": {
    "easyeda-copilot": {
      "command": "npx",
      "args": ["-y", "easyeda-copilot-mcp"]
    }
  }
}
```

## MCP Config With node

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
