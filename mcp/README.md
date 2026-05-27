# easyeda-copilot-mcp

MCP server for EasyEDA Copilot.

## Usage

1. Open a schematic in EasyEDA Pro.
2. Open the EasyEDA Copilot extension and start the MCP interface.
3. Connect your MCP client.

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
