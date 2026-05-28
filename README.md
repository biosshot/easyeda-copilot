# EasyEDA Copilot

AI-powered assistant for EasyEDA Pro and JLCEDA. Generate schematics from natural language, complete existing circuits, search LCSC components by requirements, run SPICE simulations, and reuse proven circuit blocks directly inside your EDA workflow.

<p align="center">
  <a href="https://github.com/biosshot/easyeda-copilot/releases/latest">
    <img src="https://img.shields.io/github/v/release/biosshot/easyeda-copilot?label=release" alt="Latest release">
  </a>
  <a href="https://github.com/biosshot/easyeda-copilot/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  </a>
  <a href="https://discord.gg/AXCGjTDYkq">
    <img src="https://img.shields.io/badge/Discord-7289DA?logo=discord&logoColor=white" alt="Discord">
  </a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/main.png" alt="EasyEDA Copilot interface">
</p>

## What it does

EasyEDA Copilot adds an AI design layer to EasyEDA Pro:

- **Generate circuits from text**: describe the circuit you need and let the agent assemble a schematic proposal.
- **Complete existing schematics**: attach selected circuit fragments and ask Copilot to add, replace or connect parts.
- **Search LCSC components**: find parts from natural-language requirements and electrical characteristics.
- **Use reusable blocks**: insert reviewed standard subcircuits such as regulators, interfaces and protection blocks.
- **Explain and analyze circuits**: discuss schematic behavior, signal flow and design tradeoffs.
- **Run SPICE simulations**: simulate supported circuits and inspect selected models before trusting the result.

More examples are available on [Oshwlab](https://oshwlab.com/biosshot/edacopilotexamples).

## Installation

Download the latest `.eext` package from [Releases](https://github.com/biosshot/easyeda-copilot/releases/latest).

In EasyEDA Pro:

1. Open `Settings -> Extensions -> Extensions Manager`.
2. Click `Import Extensions`.
3. Select the downloaded `.eext` file.
4. Enable `External Interactions`.
5. Open a schematic and use `Copilot -> Interface`.

## Compatibility

| EasyEDA Pro version | Status   |
| ------------------- | -------- |
| Desktop V2.2.45     | Verified |
| Desktop V2.2.47     | Verified |

## Features

### Circuit generation

Generate schematics from natural-language descriptions. Copilot can plan the circuit, search components, create a structured result and expose an `Assemble circuit` action when the generated schematic is ready.

<p align="center">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/use-reused.gif" alt="Generate a circuit with reusable blocks">
</p>

### Circuit completions

Use Copilot on an existing schematic fragment. Ask it to complete a missing block, add components, connect signals or propose changes based on selected circuit context.

<p align="center">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/circuit-compl-ex1.gif" alt="Circuit completion example 1" width="48%">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/circuit-compl-ex2.gif" alt="Circuit completion example 2" width="48%">
</p>

### Component selection

Search LCSC by intent instead of manually tuning catalog filters. Examples:

- `find 5V relay`
- `Find DC-DC chip 5V and 10A current`
- `find capacitor 22uF Murata SMD 1210`

<p align="center">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/comp-search-ex1.png" alt="Find 5V relay" width="31%">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/comp-search-ex2.png" alt="Find DC-DC chip 5V and 10A current" width="31%">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/comp-search-ex3.png" alt="Find capacitor 22uF Murata SMD 1210" width="31%">
</p>

### Reusable blocks

Reusable blocks are reviewed schematic fragments that the agent can adapt and insert into generated circuits. They are useful for standard subcircuits where the topology stays stable and only ports or passive values change.

See [Reusable blocks documentation](docs/reusable-blocks.md).

### SPICE simulation

Copilot can run SPICE simulations and automatically select models from a component model library.

Always verify the SPICE models used for replacement components. The selected models are shown below the graph after simulation.

<p align="center">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/spice.gif" alt="SPICE simulation">
</p>

## MCP server

EasyEDA Copilot can connect to external MCP clients. Start the MCP server from your agent first, then connect EasyEDA to it.

Codex:

```bash
codex mcp add easyeda-copilot -- npx easyeda-copilot-mcp
```

Claude Code:

```bash
claude mcp add easyeda-copilot -- npx easyeda-copilot-mcp
```

Startup order:

1. Add the MCP server to your agent.
2. Start Codex, Claude Code, or another MCP client with this MCP server enabled.
3. Open a schematic in EasyEDA Pro.
4. Open the EasyEDA Copilot extension and start the MCP interface.

See [MCP package README](mcp/README.md)

## Documentation

- [Settings](docs/settings.md)
- [Attaching circuits to an AI agent](docs/attaching-circuits.md)
- [Assembling a circuit from an AI agent](docs/assembling-circuits.md)
- [Reusable blocks](docs/reusable-blocks.md)
