[English](README.md) | 简体中文 | [Русский](README.ru.md)

# <img src="images/logo.png" alt="" width="42"> EasyEDA Copilot

基于 MCP 的工程自动化工具，直接操作 EasyEDA Pro 和嘉立创 EDA 原生文档。

EasyEDA Copilot 将支持 MCP 的 AI 智能体连接到真实的原理图和 PCB 数据。它支持原理图生成与重组、元器件解析、约束驱动的 PCB 布局、基于检查点的布线事务、结构化设计检查、恢复以及 EasyEDA 原生 DRC。

<p align="center">
  <a href="https://github.com/biosshot/easyeda-copilot/actions/workflows/build.yml">
    <img src="https://github.com/biosshot/easyeda-copilot/actions/workflows/build.yml/badge.svg" alt="构建状态">
  </a>
  <a href="https://github.com/biosshot/easyeda-copilot/releases/latest">
    <img src="https://img.shields.io/github/v/release/biosshot/easyeda-copilot?label=release" alt="最新版本">
  </a>
  <a href="https://github.com/biosshot/easyeda-copilot/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue" alt="许可证">
  </a>
  <a href="https://discord.gg/AXCGjTDYkq">
    <img src="https://img.shields.io/badge/Discord-7289DA?logo=discord&logoColor=white" alt="Discord">
  </a>
  <a href="https://web.tribute.tg/d/PTf">
    <img src="https://img.shields.io/badge/Support%20development-Tribute-24A1DE" alt="支持 EasyEDA Copilot 开发">
  </a>
</p>

<p align="center">
  <img src="docs/media/banner.gif" alt="EasyEDA Copilot 根据文本规格创建并组装 LDO 原理图">
</p>
<p align="center">
  <sub>根据文本规格创建并组装 LDO 原理图。</sub>
</p>

## 重点演示：BGA2869 2 GHz 射频放大器

在 EasyEDA Pro 中完成完整的射频设计流程：原理图整理、引脚级信号路径约束、紧凑元器件布局、PCB 布线、接地平面和过孔缝合。

射频端口布置在电路板相对的两侧边缘，放大器链路保持有序，偏置网络靠近 MMIC 放置。生成的元器件、走线、过孔和覆铜区域均保留为可编辑的 EasyEDA 原生对象。

https://github.com/user-attachments/assets/b3b3b25a-bc27-4654-8802-23775ff71735

## 更多演示

这些示例涵盖更大型的控制器电路板以及已有文档的处理流程。每个结果仍是可正常编辑的 EasyEDA 项目，而不是导出的渲染图或静态模型。

### ESP32-C3 控制器

完整的 ESP32-C3 控制器设计，包含电源转换、USB、CAN、RS-485、受保护的现场 I/O、外部连接器以及天线布局约束。

该流程演示多页原理图生成、功能分区布局、板边与天线约束、电源和信号布线、覆铜平面、过孔缝合、设计检查以及基于 DRC 的修复。

<details open>
<summary><strong>观看 ESP32-C3 工作流（69 秒）</strong></summary>

https://github.com/user-attachments/assets/df1dd4e2-ee48-492c-badb-de2dc220ae41

</details>

### MIMXRT1011 控制器

一款高密度四层微控制器电路板，展示围绕高引脚数 MCU、多种接口、去耦电容组、板边连接器、安装孔以及机械操作空间约束进行的布局和布线。

<details open>
<summary><strong>观看 MIMXRT1011 工作流（128 秒）</strong></summary>

https://github.com/user-attachments/assets/757690b8-83cd-42c7-b88f-4db9ba2df010

</details>

### 原理图整理

EasyEDA Copilot 读取现有原理图，识别功能分组，保存文档检查点，并将页面重新组织为具名模块，同时保留电气连接和元器件标识。

<details open>
<summary><strong>观看原理图整理过程（13 秒）</strong></summary>

https://github.com/user-attachments/assets/d77218e5-4f6f-42b8-bea4-7f7240f8f7f3

</details>

更多可编辑示例可在 [OSHWLab](https://oshwlab.com/biosshot/edacopilotexamples) 查看。

## 快速开始

### 环境要求

- EasyEDA Pro 桌面版；
- Node.js 20 或更高版本；
- 支持 MCP 的客户端，例如 Codex 或 Claude Code。

### 1. 安装 EasyEDA 扩展

从 [GitHub Releases](https://github.com/biosshot/easyeda-copilot/releases/latest) 下载最新的 `.eext` 安装包。

在 EasyEDA Pro 中：

1. 打开 `Settings -> Extensions -> Extensions Manager`。
2. 选择 `Import Extensions`。
3. 选择下载的 `.eext` 文件。
4. 启用 `External Interactions`。

<p align="center">
  <a href="docs/media/params.png">
    <img src="docs/media/params.png" alt="为 EasyEDA Copilot 启用 External Interactions" width="560">
  </a>
</p>

### 2. 添加 MCP 服务器

Codex：

```bash
codex mcp add easyeda-copilot -- npx -y easyeda-copilot-mcp
```

Claude Code：

```bash
claude mcp add easyeda-copilot -- npx -y easyeda-copilot-mcp
```

通用 MCP 配置和本地构建说明请参阅 [MCP 软件包文档](mcp/README.zh-CN.md)。

### 3. 打开项目

1. 启动已启用 EasyEDA Copilot 的 MCP 客户端。
2. 在 EasyEDA Pro 中打开目标原理图或 PCB 文档。
3. 让智能体检查当前打开的 EasyEDA 项目并开始设计工作流。

扩展会自动发现本地 MCP 桥接服务。使用 `Copilot -> MCP` 可以暂停或恢复连接。

## 功能概览

| 领域     | 功能                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------ |
| 原理图   | 检查当前页面、创建和补全电路、将现有原理图重组为功能模块，并跨多个页面标注位号                                           |
| 元器件   | 通过制造商 MPN 或元件 UUID 解析 EasyEDA 元器件，并搜索经过审核的可复用电路模块                                           |
| PCB 布局 | 根据功能模块、模组、引脚邻近关系、有序信号路径、板边位置、禁布区、安装孔、散热焊盘和保留对象，生成板框并进行约束驱动布局 |
| PCB 布线 | 定义网络类、信号与电源网络、覆铜平面、差分对、等长组、扇出、阻抗意图、选择性重新布线和过孔缝合                           |
| 设计检查 | 渲染可区分层的 PCB 预览，突出显示网络和元器件，并检查已布线长度、线宽、层、过孔、焊盘、多边形、附近元器件和未布连接      |
| 验证     | 读取当前 DRC 规则，运行 EasyEDA 原生 DRC，检查违规项，并决定保留、修复或恢复已应用的结果                                 |
| 项目控制 | 检查项目树，创建和打开项目或文档，同步编辑器，并在多个已连接的 EasyEDA 实例之间进行选择                                  |
| 长时操作 | 监控、继续、重新应用已准备好的结果，或取消耗时较长的 PCB 布局和布线操作                                                  |

## 检查点、事务与恢复

EasyEDA Copilot 使用完整文档检查点和明确的应用边界来保护已有工程成果。变更会先预览，再应用到 EasyEDA 原生文档并接受检查，随后可以选择保留、修复或恢复。

| 工作流                 | 保护与恢复行为                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| 基于源描述的原理图组装 | 修改前保存完整文档检查点；若组装失败，则自动恢复                                              |
| 原理图整理             | 替换页面前保存检查点；若替换失败，则自动恢复                                                  |
| 多页标注               | 为每个受影响的页面保存检查点；若标注事务失败，则回滚已修改页面                                |
| PCB 布局               | 生成机械预览和最终预览，保留电路板上的现有工作，并在组装前保存检查点                          |
| PCB 布线               | 在一个由检查点保护的事务中应用 DRC 规则、选择性覆铜替换、新走线、过孔、区域、同步以及原生 DRC |
| 布线应用失败           | 自动恢复布线前的检查点                                                                        |
| 手动恢复               | 针对当前 EasyEDA 文档显式列出、保存和恢复检查点                                               |

检查点包含完整的 EasyEDA 文档源数据，而不仅是智能体操作列表。现有走线、过孔和覆铜区域默认会被保留，并作为固定的布线障碍处理。只有当布线程序通过 `clearRouting(...)` 明确选择受影响的网络和对象类型时，才会替换现有铜对象。

已成功应用的部分布线结果仍可用于检查和定向修复。若应用过程中发生异常，系统会恢复布线前的检查点。恢复机制可以保护文档免受失败变更的影响；电气审查和可制造性检查仍是正常工程流程的一部分。

## 原理图工作流

原理图集成基于结构化的 EasyEDA 元器件、引脚、网络和页面数据工作。

1. 检查当前项目和原理图页面。
2. 解析准确的元器件，或选择经过审核的可复用电路模块。
3. 保存文档检查点。
4. 创建电路、补全现有片段、替换所选元器件，或将页面重组为具名功能模块。
5. 将结果应用到 EasyEDA 原生文档。
6. 保存并检查结果，然后选择保留、修改或恢复。

原理图整理会处理当前完整页面，并在重组过程中保留元器件标识。多页标注支持两种模式：`preserve` 只修复重复或未编号的位号；`resequence` 则按照页面和位置顺序重新计算末尾编号。多单元器件的各单元会一起重命名。

可复用模块提供经过审核的标准子电路，其拓扑保持稳定，同时允许调整端口和无源器件参数。详情请参阅 [可复用模块文档](docs/reusable-blocks.md)。

## PCB 工作流

PCB 布局、布线、检查和 DRC 通过 MCP 接口提供。

1. 将原理图与其关联的 PCB 文档同步。
2. 检查当前板框、封装、布局、铜层和 DRC 规则。
3. 在布局 DSL 中描述机械、功能和电气意图。
4. 审查机械预览和最终布局预览。
5. 在已打开的 EasyEDA PCB 文档中组装获准的布局。
6. 在布线 DSL 中定义叠层、布线规则、网络类、平面、特殊网络、扇出和过孔缝合。
7. 将布线程序作为一个由检查点保护的事务应用。
8. 检查关键网络、剩余连接、铜对象以及原生 DRC 结果。
9. 保留结果、进行定向修复，或恢复上一个检查点。

可以使用 `preserve(...)` 保留现有布局。布局组装会保留现有铜对象和无关的电路板对象。除非布线 DSL 针对选定范围显式调用 `clearRouting(...)`，否则现有布线会被保留。

耗时较长的布局和布线操作会返回操作 ID。MCP 客户端可以等待操作完成、取消工作，或在不重新运行操作的情况下再次应用已经准备好的结果。

布局和布线的详细参考资料：

- [PCB 布局说明](mcp/docs/pcb-layout/instructions.md)
- [PCB 布局 DSL](mcp/docs/pcb-layout/dsl.ts)
- [机械验证](mcp/docs/pcb-layout/mechanical-validation.md)
- [PCB 布线说明](mcp/docs/pcb-routing/instructions.md)
- [PCB 布线 DSL](mcp/docs/pcb-routing/dsl.ts)
- [验证与恢复](mcp/docs/verification.md)

<details>
<summary><strong>PCB 对比图库：EasyEDA Copilot 与 Quilter</strong></summary>

以下较早的并排示例展示了针对相同 RP2040、PICO Duck 和 ESPower 设计生成的 PCB 结果。

#### RP2040 电路板

<p align="center">
  <a href="docs/media/pcb-examples/rp2040_copilot_top.png"><img src="docs/media/pcb-examples/rp2040_copilot_top.png" alt="由 EasyEDA Copilot 生成的 RP2040 PCB 顶层" width="48%"></a>
  <a href="docs/media/pcb-examples/rp2040_quiliter_top.png"><img src="docs/media/pcb-examples/rp2040_quiliter_top.png" alt="由 Quilter 生成的 RP2040 PCB 顶层" width="48%"></a>
</p>
<p align="center">
  <a href="docs/media/pcb-examples/rp2040_copilot_bot.png"><img src="docs/media/pcb-examples/rp2040_copilot_bot.png" alt="由 EasyEDA Copilot 生成的 RP2040 PCB 底层" width="48%"></a>
  <a href="docs/media/pcb-examples/rp2040_quiliter_bot.png"><img src="docs/media/pcb-examples/rp2040_quiliter_bot.png" alt="由 Quilter 生成的 RP2040 PCB 底层" width="48%"></a>
</p>

#### PICO Duck 紧凑型电路板

<p align="center">
  <a href="docs/media/pcb-examples/pico_duck_copilot_top.png"><img src="docs/media/pcb-examples/pico_duck_copilot_top.png" alt="由 EasyEDA Copilot 生成的 PICO Duck PCB 顶层" width="48%"></a>
  <a href="docs/media/pcb-examples/pico_duck_quilter_top.png"><img src="docs/media/pcb-examples/pico_duck_quilter_top.png" alt="由 Quilter 生成的 PICO Duck PCB 顶层" width="48%"></a>
</p>
<p align="center">
  <a href="docs/media/pcb-examples/pico_duck_copilot_bot.png"><img src="docs/media/pcb-examples/pico_duck_copilot_bot.png" alt="由 EasyEDA Copilot 生成的 PICO Duck PCB 底层" width="48%"></a>
  <a href="docs/media/pcb-examples/pico_duck_quilter_bot.png"><img src="docs/media/pcb-examples/pico_duck_quilter_bot.png" alt="由 Quilter 生成的 PICO Duck PCB 底层" width="48%"></a>
</p>

#### ESPower 电路板

<p align="center">
  <a href="docs/media/pcb-examples/espower_copilot_top.png"><img src="docs/media/pcb-examples/espower_copilot_top.png" alt="由 EasyEDA Copilot 生成的 ESPower PCB 顶层" width="48%"></a>
  <a href="docs/media/pcb-examples/espower_quiliter_top.png"><img src="docs/media/pcb-examples/espower_quiliter_top.png" alt="由 Quilter 生成的 ESPower PCB 顶层" width="48%"></a>
</p>
<p align="center">
  <a href="docs/media/pcb-examples/espower_copilot_bot.png"><img src="docs/media/pcb-examples/espower_copilot_bot.png" alt="由 EasyEDA Copilot 生成的 ESPower PCB 底层" width="48%"></a>
  <a href="docs/media/pcb-examples/espower_quiliter_bot.png"><img src="docs/media/pcb-examples/espower_quiliter_bot.png" alt="由 Quilter 生成的 ESPower PCB 底层" width="48%"></a>
</p>

</details>

## 兼容性

| EasyEDA Pro 版本 | 状态   |
| ---------------- | ------ |
| Desktop V3.2.149 | 已验证 |
| Desktop V2.2.47  | 已验证 |
| Desktop V2.2.45  | 已验证 |

PCB 组装、布线集成、设计检查和原生 DRC 主要基于 EasyEDA Pro Desktop V3.2.149 进行验证。

## MCP 与旧版内置界面

MCP 是 EasyEDA Copilot 的主要界面，也是当前积极开发的方向。原有内置界面仍可用于集成聊天和 SPICE 工作流。

| 功能                      | MCP      | 内置界面       |
| ------------------------- | -------- | -------------- |
| 生成和修改原理图          | 是       | 是，旧版工作流 |
| 元器件解析和可复用模块    | 是       | 是             |
| 检查点和自动恢复          | 是       | 有限支持       |
| 项目和文档管理            | 是       | 否             |
| PCB 布局、预览和组装      | 是       | 否             |
| PCB 布线、检查、层和 DRC  | 是       | 否             |
| 多个已连接的 EasyEDA 实例 | 是       | 否             |
| 集成聊天和 SPICE 界面     | 否       | 是             |
| 开发优先级                | 主要方向 | 有限维护       |

除非问题专门针对旧版界面，否则新工作流和缺陷报告应使用 MCP。

<details>
<summary>显示旧版内置界面</summary>

原有界面提供集成聊天工作流，可用于原理图生成、电路补全、元器件选择、可复用模块和 SPICE 仿真。以下演示使用旧版界面；对于新的智能体工作流，MCP 仍是推荐的集成方式。

<p align="center">
  <img src="docs/media/main.png" alt="EasyEDA Copilot 旧版内置界面">
</p>

#### 电路生成与可复用模块

根据自然语言描述生成结构化原理图，并在 EasyEDA 中直接组装经过审核的可复用子电路。

<p align="center">
  <img src="docs/media/use-reused.gif" alt="使用可复用电路模块生成 EasyEDA 原理图">
</p>

#### 电路补全

读取现有原理图片段，添加缺少的元器件，并完成其电气连接。

<p align="center">
  <img src="docs/media/circuit-compl-ex1.gif" alt="补全现有 EasyEDA 原理图，示例一" width="48%">
  <img src="docs/media/circuit-compl-ex2.gif" alt="补全现有 EasyEDA 原理图，示例二" width="48%">
</p>

#### 元器件选择

根据工程要求搜索 LCSC 目录并比较候选元器件，无需离开设计工作流。

<p align="center">
  <a href="docs/media/comp-search-ex1.png"><img src="docs/media/comp-search-ex1.png" alt="根据工程要求选择元器件" width="32%"></a>
  <a href="docs/media/comp-search-ex2.png"><img src="docs/media/comp-search-ex2.png" alt="EasyEDA Copilot 中的 LCSC 元器件搜索结果" width="32%"></a>
  <a href="docs/media/comp-search-ex3.png"><img src="docs/media/comp-search-ex3.png" alt="在 EasyEDA Copilot 中选择候选元器件" width="32%"></a>
</p>

#### 导出可复用模块

将现有原理图片段保存为可复用电路模块，以供后续生成工作流使用。

<p align="center">
  <img src="docs/media/export-reused.gif" alt="将 EasyEDA 原理图片段导出为可复用模块">
</p>

#### SPICE 仿真

从内置界面运行 SPICE 仿真，并结合生成的曲线检查所选元器件模型。

<p align="center">
  <img src="docs/media/spice.gif" alt="在 EasyEDA Copilot 内置界面中运行 SPICE 仿真">
</p>

</details>

## 架构与数据处理

```text
Codex / Claude Code / 其他 MCP 客户端
                    |
                    | stdio
                    v
          easyeda-copilot-mcp
                    |
                    | 127.0.0.1:8787 上的 WebSocket
                    v
        EasyEDA Copilot 扩展
                    |
                    v
        已打开的 EasyEDA 文档
```

EasyEDA 扩展、MCP 桥接服务、文档应用逻辑、检查点系统、设计检查工具以及 PCB 布线软件包均为开源。MCP 桥接服务通过 `127.0.0.1` 与 EasyEDA 扩展进行本地通信。

目前，EasyEDA Copilot 托管服务用于元器件和可复用模块检索，以及生成原理图与 PCB 布局方案。生成的方案通过 EasyEDA 扩展进行应用、检查点保存、检查和 DRC 验证。PCB 布线基于开源的 [`eda-copilot-router`](https://github.com/biosshot/eda-copilot-router) 软件包。

## 文档

- [MCP 软件包与客户端配置](mcp/README.zh-CN.md)
- [完整 MCP 工作流](mcp/docs/workflow.md)
- [原理图工作流](mcp/docs/schematic/workflow.md)
- [原理图电路修改](mcp/docs/schematic/circuit-mod.md)
- [项目和页面管理](mcp/docs/schematic/project-and-pages.md)
- [设置与权限](docs/settings.md)
- [将电路附加到 AI 智能体](docs/attaching-circuits.md)
- [从 AI 智能体组装电路](docs/assembling-circuits.md)
- [可复用模块](docs/reusable-blocks.md)

## 开发

从源代码构建扩展和 MCP 软件包：

```bash
git clone https://github.com/biosshot/easyeda-copilot.git
cd easyeda-copilot
npm install
npm run build
npm run check --workspace=mcp
```

独立的 PCB 布线软件包在 [`biosshot/eda-copilot-router`](https://github.com/biosshot/eda-copilot-router) 中开发。

## 支持项目

如果 EasyEDA Copilot 为你节省了工程时间，可以[通过 Tribute 支持项目的持续开发](https://web.tribute.tg/d/PTf)。你的支持将帮助维护扩展、MCP 集成、布线工具、文档以及新的设计工作流。

## 社区

欢迎通过 [GitHub Issues](https://github.com/biosshot/easyeda-copilot/issues) 和 [Discord](https://discord.gg/AXCGjTDYkq) 提交问题、缺陷报告、设计示例和代码贡献。

## 许可证

EasyEDA Copilot 根据 [MIT 许可证](LICENSE)发布。
