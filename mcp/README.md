# easyeda-copilot-mcp

MCP server for EasyEDA Copilot.

It connects MCP clients such as Codex or Claude Code to EasyEDA Pro through the EasyEDA Copilot extension and exposes tools for schematic extraction, circuit modification, PCB placement, PCB assembly, preview, DRC, and routing helpers.

## Usage

1. Add this MCP server to your agent.
2. Start the MCP client with this server enabled.
3. Open EasyEDA Pro.
4. Open the target schematic or PCB document.
5. EasyEDA Copilot connects automatically. Use `Copilot -> MCP` only to pause or resume scanning.

## Local Docs

The package ships local docs in `mcp/docs`. The MCP server exposes the local `SKILL.md` path through the `easyeda_copilot_mcp_skill` resource/prompt.

Agents should read:

- `docs/SKILL.md` first.
- `docs/pcb-layout/dsl.ts` before writing `make_pcb_layout` DSL.
- `docs/pcb-layout/instructions.md` for placement heuristics and examples.
- `docs/pcb-layout/mcp-workflow.md` for placement, assembly, preview, and routing flow.
- `docs/pcb-drc/rules.md` for DRC export/apply/check workflows.

## PCB Flow

`make_pcb_layout` is placement-only. It returns a compact text report plus:

- `layoutId`: stored MCP-side board assembly payload id.
- `previewImagePath`: local PNG preview path.

Then open the correct PCB document and call `assemble_pcb_layout_on_current_pcbdoc({ layoutId })`.

Routing is done after assembly in EasyEDA/client tools. The MCP also provides `clear_routing`, `run_auto_route_on_current_pcbdoc`, `check_pcb_drc`, `inspect_net`, `inspect_component`, and `preview_pcb`.

`run_auto_route_on_current_pcbdoc` does not clear existing tracks/vias first and does not route nets that are already routed in EasyEDA's exported autoroute JSON. Call `clear_routing` first when old routing should be replaced.

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
