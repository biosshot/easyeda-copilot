# easyeda-copilot-mcp

MCP server for EasyEDA Copilot.

It connects MCP clients such as Codex or Claude Code to EasyEDA Desktop through the EasyEDA Copilot extension. It supports schematic work, component search, PCB placement, assembly, routing, inspection, and DRC.

## Requirements

- EasyEDA Desktop V3.2.149.
- EasyEDA Copilot extension with `External Interactions` enabled.
- An MCP-capable client such as Codex or Claude Code.

## Usage

1. Add this MCP server to your MCP client.
2. Start the MCP client with this server enabled.
3. Open EasyEDA Desktop.
4. Open the target schematic or PCB document.
5. EasyEDA Copilot connects automatically. Use `Copilot -> MCP` only to pause or resume scanning.

## PCB Workflow

PCB features are available through MCP clients, not through the built-in Copilot chat.

The MCP integration can:

- generate board outline and component placement from a schematic;
- create mechanical and final placement previews before import;
- assemble approved placement into the opened EasyEDA PCB document;
- run the bundled auto-router and import the generated tracks;
- rebuild GND pours and stitching vias after auto-routing;
- clear existing routing when it must be regenerated;
- preview and inspect PCB objects, nets, and components;
- run EasyEDA PCB DRC and manage the copper-layer count.

Typical workflow: review mechanical preview, approve final placement, import it into the target PCB document, then route and run DRC. Existing tracks are preserved by default; clear routing before requesting a full reroute.

## Build

```bash
git clone https://github.com/biosshot/easyeda-copilot
cd easyeda-copilot/mcp
npm install
npm run build
```

## MCP Config With npx

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
