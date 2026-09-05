English | [简体中文](README.zh-CN.md) | [Русский](README.ru.md)

# <img src="images/logo.png" alt="" width="42"> EasyEDA Copilot

MCP-based engineering automation for native EasyEDA Pro and JLCEDA documents.

EasyEDA Copilot connects MCP-capable AI agents to real schematic and PCB data. It supports schematic generation and reorganization, component resolution, constraint-driven PCB placement, checkpoint-backed routing transactions, structured design inspection, recovery, and native EasyEDA DRC.

<p align="center">
  <a href="https://github.com/biosshot/easyeda-copilot/actions/workflows/build.yml">
    <img src="https://github.com/biosshot/easyeda-copilot/actions/workflows/build.yml/badge.svg" alt="Build status">
  </a>
  <a href="https://github.com/biosshot/easyeda-copilot/releases/latest">
    <img src="https://img.shields.io/github/v/release/biosshot/easyeda-copilot?label=release" alt="Latest release">
  </a>
  <a href="https://github.com/biosshot/easyeda-copilot/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  </a>
  <a href="https://discord.gg/AXCGjTDYkq">
    <img src="https://img.shields.io/badge/Discord-7289DA?logo=discord&logoColor=white" alt="Discord">
  </a>
  <a href="https://web.tribute.tg/d/PTf">
    <img src="https://img.shields.io/badge/Support%20development-Tribute-24A1DE" alt="Support EasyEDA Copilot development">
  </a>
</p>

<p align="center">
  <img src="docs/media/banner.gif" alt="EasyEDA Copilot creating and assembling an LDO schematic from a text specification">
</p>
<p align="center">
  <sub>Creating and assembling an LDO schematic from a text specification.</sub>
</p>

## Featured demonstration: BGA2869 2 GHz RF amplifier

A complete RF design workflow inside EasyEDA Pro: schematic organization, pin-level signal-path constraints, compact component placement, PCB routing, ground planes, and via stitching.

The RF ports are positioned on opposite board edges, the amplifier chain is kept ordered, and the bias network is placed close to the MMIC. The resulting components, tracks, vias, and copper zones remain editable as native EasyEDA objects.

https://github.com/user-attachments/assets/b3b3b25a-bc27-4654-8802-23775ff71735

## More demonstrations

These examples cover larger controller boards and existing-document workflows. Every result remains editable as a normal EasyEDA project rather than being exported as a rendered mockup.

### ESP32-C3 controller

A complete ESP32-C3 controller with power conversion, USB, CAN, RS-485, protected field I/O, external connectors, and antenna placement constraints.

The workflow demonstrates multi-page schematic generation, functional placement, board-edge and antenna constraints, power and signal routing, copper planes, via stitching, inspection, and DRC-driven repair.

<details open>
<summary><strong>Watch the ESP32-C3 workflow (69 seconds)</strong></summary>

https://github.com/user-attachments/assets/df1dd4e2-ee48-492c-badb-de2dc220ae41

</details>

### MIMXRT1011 controller

A dense four-layer microcontroller design demonstrating placement and routing around a high-pin-count MCU, multiple interfaces, decoupling groups, board-edge connectors, mounting holes, and mechanical access constraints.

<details open>
<summary><strong>Watch the MIMXRT1011 workflow (128 seconds)</strong></summary>

https://github.com/user-attachments/assets/757690b8-83cd-42c7-b88f-4db9ba2df010

</details>

### Schematic beautification

EasyEDA Copilot reads an existing schematic, identifies functional groups, saves a document checkpoint, and reassembles the page into named blocks while retaining its electrical connectivity and component identities.

<details open>
<summary><strong>Watch schematic beautification (13 seconds)</strong></summary>

https://github.com/user-attachments/assets/d77218e5-4f6f-42b8-bea4-7f7240f8f7f3

</details>

More editable examples are available on [OSHWLab](https://oshwlab.com/biosshot/edacopilotexamples).

## Quick start

### Requirements

- EasyEDA Pro Desktop;
- Node.js 20 or newer;
- an MCP-capable client such as Codex or Claude Code.

### 1. Install the EasyEDA extension

Download the latest `.eext` package from [GitHub Releases](https://github.com/biosshot/easyeda-copilot/releases/latest).

In EasyEDA Pro:

1. Open `Settings -> Extensions -> Extensions Manager`.
2. Select `Import Extensions`.
3. Choose the downloaded `.eext` file.
4. Enable `External Interactions`.

<p align="center">
  <a href="docs/media/params.png">
    <img src="docs/media/params.png" alt="Enable External Interactions for EasyEDA Copilot" width="560">
  </a>
</p>

### 2. Add the MCP server

Codex:

```bash
codex mcp add easyeda-copilot -- npx -y easyeda-copilot-mcp
```

Claude Code:

```bash
claude mcp add easyeda-copilot -- npx -y easyeda-copilot-mcp
```

For generic MCP configuration and local builds, see the [MCP package documentation](mcp/README.md).

### 3. Open a project

1. Start the MCP client with EasyEDA Copilot enabled.
2. Open EasyEDA Pro and the target schematic or PCB document.
3. Ask the agent to inspect the currently opened EasyEDA project and begin the design workflow.

The extension discovers the local MCP bridge automatically. `Copilot -> MCP` pauses or resumes the connection.

## Capabilities

| Area            | Capabilities                                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Schematics      | Inspect the current page, create and complete circuits, reorganize existing schematics into functional blocks, and annotate designators across multiple pages                                                |
| Components      | Resolve EasyEDA components by manufacturer MPN or part UUID and search reviewed reusable circuit blocks                                                                                                      |
| PCB placement   | Generate board geometry and constraint-driven placement using functional blocks, modules, pin proximity, ordered signal paths, edge placement, keepouts, mounting holes, thermal pads, and preserved objects |
| PCB routing     | Define net classes, signal and power nets, copper planes, differential pairs, matched groups, fanout, impedance intent, selective rerouting, and via stitching                                               |
| Inspection      | Render layer-aware PCB previews, highlight nets and components, and inspect routed length, track widths, layers, vias, pads, polygons, nearby components, and unrouted connections                           |
| Verification    | Read current DRC rules, run native EasyEDA DRC, inspect violations, and choose whether to keep, repair, or restore an applied result                                                                         |
| Project control | Inspect project trees, create and open projects or documents, synchronize editors, and select between multiple connected EasyEDA instances                                                                   |
| Long operations | Monitor, continue, reapply prepared results, or cancel long PCB placement and routing operations                                                                                                             |

## Checkpoints, transactions, and recovery

EasyEDA Copilot uses full-document checkpoints and explicit application boundaries to protect existing engineering work. Changes are previewed, applied to native EasyEDA documents, inspected, and then kept, repaired, or restored.

| Workflow                        | Protection and recovery behavior                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source-based schematic assembly | Saves a full document checkpoint before modification and restores it automatically if assembly fails                                              |
| Schematic beautification        | Saves a checkpoint before page replacement and restores it automatically if replacement fails                                                     |
| Multi-page annotation           | Saves a checkpoint for every affected page and rolls modified pages back if the annotation transaction fails                                      |
| PCB placement                   | Produces mechanical and final previews, preserves existing board work, and saves a checkpoint before assembly                                     |
| PCB routing                     | Applies DRC rules, selected copper replacement, new tracks, vias, zones, synchronization, and native DRC inside one checkpoint-backed transaction |
| Routing application failure     | Restores the pre-routing checkpoint automatically                                                                                                 |
| Manual recovery                 | Lists, saves, and restores checkpoints explicitly for the current EasyEDA document                                                                |

Checkpoints contain the complete EasyEDA document source, not only a list of agent actions. Existing tracks, vias, and copper zones are preserved by default and treated as fixed routing obstacles. Copper is replaced only when a routing program explicitly selects the affected nets and object types through `clearRouting(...)`.

A successfully applied partial routing result remains available for inspection and focused repair. An application exception restores the pre-routing checkpoint. Recovery protects the document from failed mutations; electrical and manufacturability review remains part of the normal engineering workflow.

## Schematic workflow

The schematic integration works with structured EasyEDA component, pin, net, and page data.

1. Inspect the current project and schematic page.
2. Resolve exact components or select reviewed reusable circuit blocks.
3. Save a document checkpoint.
4. Create a circuit, complete an existing fragment, replace selected components, or reorganize the page into named functional blocks.
5. Apply the result to the native EasyEDA document.
6. Save and inspect the result, then keep, revise, or restore it.

Schematic beautification covers the complete current page and preserves component identities through destructive reassembly. Multi-page annotation supports two modes: `preserve` repairs only duplicate or unnumbered designators, while `resequence` recalculates trailing numbers in page and position order. Multi-part components are renamed together.

Reusable blocks provide reviewed standard subcircuits whose topology remains stable while ports and passive values can be adapted. See the [reusable blocks documentation](docs/reusable-blocks.md).

## PCB workflow

PCB placement, routing, inspection, and DRC are provided through the MCP interface.

1. Synchronize the schematic with its linked PCB document.
2. Inspect the current board outline, footprints, placement, copper layers, and DRC rules.
3. Describe mechanical, functional, and electrical intent in the placement DSL.
4. Review the mechanical preview and the final placement preview.
5. Assemble the approved placement in the opened EasyEDA PCB document.
6. Define stack, routing rules, net classes, planes, special nets, fanout, and via stitching in the routing DSL.
7. Apply the routing program as one checkpoint-backed transaction.
8. Inspect critical nets, remaining connections, copper, and native DRC results.
9. Keep the result, apply a focused repair, or restore the previous checkpoint.

Existing placement can be retained with `preserve(...)`. Placement assembly preserves existing copper and unrelated board objects. Existing routing is preserved unless the routing DSL explicitly calls `clearRouting(...)` for a selected scope.

Long placement and routing operations return an operation ID. The MCP client can wait for completion, cancel the work, or retry application of an already prepared result without running the operation again.

Detailed placement and routing references:

- [PCB placement instructions](mcp/docs/pcb-layout/instructions.md)
- [PCB placement DSL](mcp/docs/pcb-layout/dsl.ts)
- [Mechanical validation](mcp/docs/pcb-layout/mechanical-validation.md)
- [PCB routing instructions](mcp/docs/pcb-routing/instructions.md)
- [PCB routing DSL](mcp/docs/pcb-routing/dsl.ts)
- [Verification and recovery](mcp/docs/verification.md)

<details>
<summary><strong>PCB comparison gallery: EasyEDA Copilot and Quilter</strong></summary>

Earlier side-by-side examples show the PCB results produced for the same RP2040, PICO Duck, and ESPower designs.

#### RP2040 board

<p align="center">
  <a href="docs/media/pcb-examples/rp2040_copilot_top.png"><img src="docs/media/pcb-examples/rp2040_copilot_top.png" alt="RP2040 PCB produced with EasyEDA Copilot, top layer" width="48%"></a>
  <a href="docs/media/pcb-examples/rp2040_quiliter_top.png"><img src="docs/media/pcb-examples/rp2040_quiliter_top.png" alt="RP2040 PCB produced with Quilter, top layer" width="48%"></a>
</p>
<p align="center">
  <a href="docs/media/pcb-examples/rp2040_copilot_bot.png"><img src="docs/media/pcb-examples/rp2040_copilot_bot.png" alt="RP2040 PCB produced with EasyEDA Copilot, bottom layer" width="48%"></a>
  <a href="docs/media/pcb-examples/rp2040_quiliter_bot.png"><img src="docs/media/pcb-examples/rp2040_quiliter_bot.png" alt="RP2040 PCB produced with Quilter, bottom layer" width="48%"></a>
</p>

#### PICO Duck compact board

<p align="center">
  <a href="docs/media/pcb-examples/pico_duck_copilot_top.png"><img src="docs/media/pcb-examples/pico_duck_copilot_top.png" alt="PICO Duck PCB produced with EasyEDA Copilot, top layer" width="48%"></a>
  <a href="docs/media/pcb-examples/pico_duck_quilter_top.png"><img src="docs/media/pcb-examples/pico_duck_quilter_top.png" alt="PICO Duck PCB produced with Quilter, top layer" width="48%"></a>
</p>
<p align="center">
  <a href="docs/media/pcb-examples/pico_duck_copilot_bot.png"><img src="docs/media/pcb-examples/pico_duck_copilot_bot.png" alt="PICO Duck PCB produced with EasyEDA Copilot, bottom layer" width="48%"></a>
  <a href="docs/media/pcb-examples/pico_duck_quilter_bot.png"><img src="docs/media/pcb-examples/pico_duck_quilter_bot.png" alt="PICO Duck PCB produced with Quilter, bottom layer" width="48%"></a>
</p>

#### ESPower board

<p align="center">
  <a href="docs/media/pcb-examples/espower_copilot_top.png"><img src="docs/media/pcb-examples/espower_copilot_top.png" alt="ESPower PCB produced with EasyEDA Copilot, top layer" width="48%"></a>
  <a href="docs/media/pcb-examples/espower_quiliter_top.png"><img src="docs/media/pcb-examples/espower_quiliter_top.png" alt="ESPower PCB produced with Quilter, top layer" width="48%"></a>
</p>
<p align="center">
  <a href="docs/media/pcb-examples/espower_copilot_bot.png"><img src="docs/media/pcb-examples/espower_copilot_bot.png" alt="ESPower PCB produced with EasyEDA Copilot, bottom layer" width="48%"></a>
  <a href="docs/media/pcb-examples/espower_quiliter_bot.png"><img src="docs/media/pcb-examples/espower_quiliter_bot.png" alt="ESPower PCB produced with Quilter, bottom layer" width="48%"></a>
</p>

</details>

## Compatibility

| EasyEDA Pro version | Status   |
| ------------------- | -------- |
| Desktop V3.2.149    | Verified |
| Desktop V2.2.47     | Verified |
| Desktop V2.2.45     | Verified |

PCB assembly, routing integration, inspection, and native DRC are verified primarily against EasyEDA Pro Desktop V3.2.149.

## MCP and the legacy built-in interface

MCP is the primary and actively developed EasyEDA Copilot interface. The original built-in interface remains available for its integrated chat and SPICE workflow.

| Capability                               | MCP     | Built-in interface   |
| ---------------------------------------- | ------- | -------------------- |
| Generate and modify schematics           | Yes     | Yes, legacy workflow |
| Component resolution and reusable blocks | Yes     | Yes                  |
| Checkpoints and automatic recovery       | Yes     | Limited              |
| Project and document management          | Yes     | No                   |
| PCB placement, preview, and assembly     | Yes     | No                   |
| PCB routing, inspection, layers, and DRC | Yes     | No                   |
| Multiple connected EasyEDA instances     | Yes     | No                   |
| Integrated chat and SPICE UI             | No      | Yes                  |
| Development priority                     | Primary | Limited maintenance  |

New workflows and bug reports should use MCP unless the issue is specific to the legacy interface.

<details>
<summary>Show the legacy built-in interface</summary>

The original interface provides an integrated chat workflow for schematic generation, circuit completion, component selection, reusable blocks, and SPICE simulation. These demonstrations use the legacy interface; MCP remains the recommended integration for new agent workflows.

<p align="center">
  <img src="docs/media/main.png" alt="EasyEDA Copilot legacy built-in interface">
</p>

#### Circuit generation and reusable blocks

Generate a structured schematic from a natural-language description and assemble reviewed reusable subcircuits directly in EasyEDA.

<p align="center">
  <img src="docs/media/use-reused.gif" alt="Generating an EasyEDA schematic with reusable circuit blocks">
</p>

#### Circuit completion

Read an existing schematic fragment, add the missing components, and complete its electrical connections.

<p align="center">
  <img src="docs/media/circuit-compl-ex1.gif" alt="Completing an existing EasyEDA schematic, example one" width="48%">
  <img src="docs/media/circuit-compl-ex2.gif" alt="Completing an existing EasyEDA schematic, example two" width="48%">
</p>

#### Component selection

Search the LCSC catalog from engineering requirements and compare candidate parts without leaving the design workflow.

<p align="center">
  <a href="docs/media/comp-search-ex1.png"><img src="docs/media/comp-search-ex1.png" alt="Component selection from an engineering request" width="32%"></a>
  <a href="docs/media/comp-search-ex2.png"><img src="docs/media/comp-search-ex2.png" alt="LCSC component search results in EasyEDA Copilot" width="32%"></a>
  <a href="docs/media/comp-search-ex3.png"><img src="docs/media/comp-search-ex3.png" alt="Selecting a component candidate in EasyEDA Copilot" width="32%"></a>
</p>

#### Exporting reusable blocks

Save an existing schematic fragment as a reusable circuit block for later generation workflows.

<p align="center">
  <img src="docs/media/export-reused.gif" alt="Exporting an EasyEDA schematic fragment as a reusable block">
</p>

#### SPICE simulation

Run a SPICE simulation from the built-in interface and inspect the selected component models together with the resulting plots.

<p align="center">
  <img src="docs/media/spice.gif" alt="Running a SPICE simulation in the EasyEDA Copilot built-in interface">
</p>

</details>

## Architecture and data processing

```text
Codex / Claude Code / another MCP client
                    |
                    | stdio
                    v
          easyeda-copilot-mcp
                    |
                    | WebSocket on 127.0.0.1:8787
                    v
        EasyEDA Copilot extension
                    |
                    v
          Open EasyEDA document
```

The EasyEDA extension, MCP bridge, document application logic, checkpoint system, inspection tools, and PCB routing package are open source. The MCP bridge communicates with the EasyEDA extension locally through `127.0.0.1`.

Hosted EasyEDA Copilot services are currently used for component and reusable-block lookup and for generating schematic and PCB placement plans. The resulting plans are applied, checkpointed, inspected, and DRC-checked through the EasyEDA extension. PCB routing is based on the open-source [`eda-copilot-router`](https://github.com/biosshot/eda-copilot-router) package.

## Documentation

- [MCP package and client configuration](mcp/README.md)
- [Complete MCP workflow](mcp/docs/workflow.md)
- [Schematic workflow](mcp/docs/schematic/workflow.md)
- [Schematic circuit modifications](mcp/docs/schematic/circuit-mod.md)
- [Project and page management](mcp/docs/schematic/project-and-pages.md)
- [Settings and permissions](docs/settings.md)
- [Attaching circuits to an AI agent](docs/attaching-circuits.md)
- [Assembling circuits from an AI agent](docs/assembling-circuits.md)
- [Reusable blocks](docs/reusable-blocks.md)

## Development

Build the extension and MCP package from source:

```bash
git clone https://github.com/biosshot/easyeda-copilot.git
cd easyeda-copilot
npm install
npm run build
npm run check --workspace=mcp
```

The standalone PCB routing package is developed in [`biosshot/eda-copilot-router`](https://github.com/biosshot/eda-copilot-router).

## Support

If EasyEDA Copilot saves you engineering time, you can [support its continued development through Tribute](https://web.tribute.tg/d/PTf). Contributions help maintain the extension, MCP integration, routing tools, documentation, and new design workflows.

## Community

Questions, bug reports, design examples, and contributions are welcome through [GitHub Issues](https://github.com/biosshot/easyeda-copilot/issues) and [Discord](https://discord.gg/AXCGjTDYkq).

## License

EasyEDA Copilot is distributed under the [MIT License](LICENSE).
