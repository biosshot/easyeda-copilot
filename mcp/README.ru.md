[English](README.md) | [简体中文](README.zh-CN.md) | Русский
# easyeda-copilot-mcp
MCP-сервер для EasyEDA Copilot.

Он подключает MCP-клиенты, такие как Codex или Claude Code, к EasyEDA Desktop через расширение EasyEDA Copilot. Поддерживается работа со схемами, поиск компонентов, размещение на печатной плате, сборка, трассировка, инспекция и DRC.

MCP — рекомендуемый и активно развиваемый интерфейс EasyEDA Copilot. Встроенный Interface остаётся доступным как legacy workflow с меньшим набором возможностей и ограниченной поддержкой.

## Требования
- EasyEDA Desktop V3.2.149.
- Расширение EasyEDA Copilot с включёнными внешними взаимодействиями (`External Interactions`).
- MCP-клиент, такой как Codex или Claude Code.

## Использование
1. Добавьте этот MCP-сервер в ваш MCP-клиент.
2. Запустите MCP-клиент с включённым данным сервером.
3. Откройте EasyEDA Desktop.
4. Откройте целевую схему или документ PCB.
5. EasyEDA Copilot подключится автоматически. Используйте `Copilot -> MCP` только для приостановки или возобновления сканирования.

## Работа с PCB
Функции PCB доступны только через MCP-клиенты, а не через встроенный чат Copilot.

Интеграция MCP позволяет:
- создавать контур платы и размещение компонентов на основе схемы;
- сохранять контур открытой PCB и позиции выбранных существующих компонентов при инкрементальном размещении;
- формировать предварительные просмотры механических ограничений и окончательного размещения перед импортом;
- собирать утверждённое размещение в открытый документ PCB в EasyEDA;
- выполнять DSL `eda-copilot-router` через управляемый Hybrid backend;
- создавать заданные DSL полигоны и сшивающие переходные отверстия;
- заменять выбранную существующую медь только при явном вызове `clearRouting(...)` в DSL;
- просматривать и инспектировать объекты PCB, цепи и компоненты;
- запускать EasyEDA PCB DRC и управлять количеством слоёв меди.

Типичный рабочий процесс: синхронизация изменений схемы, остановка до ручного подтверждения пользователем диалога импорта EasyEDA, открытие целевой PCB, проверка механического и окончательного preview, сборка утверждённого размещения, затем `run_pcb_router_dsl` и проверка native DRC. Существующее размещение сохраняется через `preserve(...)` в placement DSL; существующая медь сохраняется по умолчанию и заменяется только при явном `clearRouting(...)` в routing DSL. Долгие операции продолжаются через `wait_operation`.

## Сборка
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

Backend и router — отдельные npm-пакеты. Для локальной разработки нужны соседние репозитории `eda-copilot-backend` и `copilot-router`; подключение переключается командой `npm run deps:local`. Сборка MCP пересобирает локальные библиотеки. Backend сам объявляет свои зависимости и содержит нативные бинарники. `npm run deps:release` возвращает опубликованные версии из `scripts/dependency-config.json`, а `npm run check:release` проверяет готовность к релизу. Backend не встраивается в MCP. Подробности: [локальная разработка](../docs/local-development.md).

Для установки релиза через npm нужны Node.js >=20.19 и npm, без Rust и компилятора C/C++. Целевые платформы: Windows x64, Linux x64 с glibc >=2.35 и macOS x64/arm64. При первой трассировке загружаются готовый KRT и, при необходимости, отдельный Python с зависимостями; нужен доступ к GitHub и PyPI. Linux ARM64, Windows ARM64 и Alpine/musl пока не поддерживаются полной цепочкой инструментов.

## Конфигурация MCP с использованием npx

Codex:

```bash
codex mcp add easyeda-copilot -- npx -y easyeda-copilot-mcp
```

Claude Code:

```bash
claude mcp add easyeda-copilot -- npx -y easyeda-copilot-mcp
```

Общая конфигурация MCP:

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

## Конфигурация MCP с использованием node

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
