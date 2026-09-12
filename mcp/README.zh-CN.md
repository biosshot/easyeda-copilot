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
- 在增量布局时保留已打开 PCB 的板框和选定现有元件的位置；
- 在导入前创建机械约束和最终布局预览；
- 将确认的布局组装到已打开的 EasyEDA PCB 文档中；
- 通过托管 Hybrid 后端运行 `eda-copilot-router` DSL；
- 从同一个布线 DSL 创建指定的铺铜和缝合过孔；
- 仅在 DSL 明确调用 `clearRouting(...)` 时替换选定的现有铜箔；
- 预览和检查 PCB 对象、网络（nets）和元件；
- 运行 EasyEDA PCB DRC 并管理铜层数量。

典型工作流：同步原理图更改，暂停并等待用户在 EasyEDA 导入对话框中手动确认，打开目标 PCB，检查机械和最终布局预览，组装已确认的布局，然后运行 `run_pcb_router_dsl` 并检查原生 DRC。布局 DSL 可通过 `preserve(...)` 保留现有布局；默认保留现有铜箔，只有布线 DSL 明确调用 `clearRouting(...)` 时才会替换。长时间运行的操作通过 `wait_operation` 继续等待。

## 构建
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

Backend 和 router 是独立的 npm 包。本地开发需要相邻的 `eda-copilot-backend` 和 `copilot-router` 仓库，使用 `npm run deps:local` 切换。MCP 构建会重新构建本地依赖。Backend 自行声明运行时依赖并携带原生二进制文件，不再打包进 MCP。`npm run deps:release` 恢复 `scripts/dependency-config.json` 中的已发布版本；`npm run check:release` 验证发布条件。参见[本地开发指南](../docs/local-development.md)。

npm 发布包需要 Node.js >=20.19 和 npm，无需 Rust 或 C/C++ 编译器。目标平台：Windows x64、Linux x64（glibc >=2.35）、macOS x64/arm64。首次布线会下载预编译 KRT，必要时还会下载独立 Python 及其依赖，需要访问 GitHub 和 PyPI。完整工具链暂不支持 Linux ARM64、Windows ARM64 或 Alpine/musl。

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
