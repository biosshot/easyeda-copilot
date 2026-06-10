# easyeda-copilot-mcp

MCP server for EasyEDA Copilot.

## Usage

1. Add this MCP server to your agent.
2. Start Codex, Claude Code, or another MCP client with this MCP server enabled.
3. Open a schematic in EasyEDA Pro.
4. EasyEDA Copilot will connect automatically. Use `Copilot -> MCP` only to pause or resume scanning.

## Local docs

On startup the MCP server syncs docs from the EasyEDA Copilot server into a local cache. It exposes the local `SKILL.md` path through MCP, and agents should read that file instead of loading prompt text from the server.

Default cache location:

- Windows: `%LOCALAPPDATA%\easyeda-copilot-mcp\docs`
- macOS/Linux: `~/.cache/easyeda-copilot-mcp/docs`

Override the cache directory with:

```bash
EASYEDA_COPILOT_MCP_DOCS_DIR=/absolute/path/to/docs
```

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
