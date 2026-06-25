# easyeda-copilot-mcp

MCP server for EasyEDA Copilot.

## Usage

1. Add this MCP server to your agent.
2. Start Codex, Claude Code, or another MCP client with this MCP server enabled.
3. Open a schematic in EasyEDA Pro.
4. EasyEDA Copilot will connect automatically. Use `Copilot -> MCP` only to pause or resume scanning.

## Local docs

The MCP package ships its own local docs in `mcp/docs`. The server exposes the local `SKILL.md` path through MCP, and agents should read that file before using schematic or PCB tools.

## Build

```bash
git clone https://github.com/biosshot/easyeda-copilot
cd easyeda-copilot/mcp
npm install
npm run build
```

## MCP config with npx

Codex:

```bash
codex mcp add easyeda-copilot -- npx easyeda-copilot-mcp
```

Claude Code:

```bash
claude mcp add easyeda-copilot -- npx easyeda-copilot-mcp
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

## MCP config with node

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
