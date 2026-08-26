[English](README.md) | 简体中文 | [Русский](README.ru.md)
# easyeda-copilot-mcp
EasyEDA Copilot 的 MCP 服务器。

它通过 EasyEDA Copilot 扩展将 Codex 或 Claude Code 等 MCP 客户端连接到 EasyEDA Desktop。支持原理图设计、元器件搜索、PCB 布局、组装、布线、检查以及 DRC。

MCP 是 EasyEDA Copilot 推荐且持续积极开发的接口。内置 Interface 仍作为 legacy 工作流保留，但功能较少且仅提供有限维护。

## 系统要求
- EasyEDA Desktop V3.2.149。
- 已启用“外部交互”（`External Interactions`）的 EasyEDA Copilot 扩展。
- 支持 MCP 的客户端，如 Codex 或 Claude Code。

## 使用方法
1. 将此 MCP 服务器添加到您的 MCP 客户端。
2. 启动启用了此服务器的 MCP 客户端。
3. 打开 EasyEDA Desktop。
4. 打开目标原理图或 PCB 文档。
5. EasyEDA Copilot 将自动连接。仅在需要暂停或恢复扫描时使用 `Copilot -> MCP`。

## PCB 工作流
PCB 功能仅可通过 MCP 客户端使用，无法通过内置的 Copilot 聊天窗口使用。

MCP 集成可以实现：
- 从原理图生成板框轮廓和元件布局；
- 在导入前创建机械约束和最终布局预览；
- 将确认的布局组装到已打开的 EasyEDA PCB 文档中；
- 运行内置的自动布线器并导入生成的走线；
- 在自动布线后重建接地铺铜（GND pours）和缝合过孔（stitching vias）；
- 在需要重新生成时清除现有布线；
- 预览和检查 PCB 对象、网络（nets）和元件；
- 运行 EasyEDA PCB DRC 并管理铜层数量。

典型工作流：查看机械预览，确认最终布局，将其导入目标 PCB 文档，然后进行布线并运行 DRC。默认情况下会保留现有走线；在请求完全重新布线前，请先清除现有布线。

## 构建
```bash
git clone https://github.com/biosshot/easyeda-copilot
cd easyeda-copilot/mcp
npm install
npm run build
```

## 使用 npx 配置 MCP

Codex:

```bash
codex mcp add easyeda-copilot -- npx -y easyeda-copilot-mcp
```

Claude Code:

```bash
claude mcp add easyeda-copilot -- npx -y easyeda-copilot-mcp
```

通用 MCP 配置：

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

## 使用 node 配置 MCP

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
