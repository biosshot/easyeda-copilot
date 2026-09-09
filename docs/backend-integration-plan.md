# Интеграция EDA Copilot Backend

Дата: 2026-09-09. Ветка: `fit/mcp-extract-backend`. Локальная реализация для review; публикация и интеграция на сервере отложены.

## Принятые границы

- Исходники `eda-copilot-backend` находятся в корневом workspace `backend/`.
- Общие типы перенесены из `packages/shared/` в `shared/`. Каталог `packages/` удалён.
- MCP вызывает backend напрямую. Vue legacy-интерфейс, sibling-репозиторий сервера и `eda-copilot-router` не меняются.
- Пакеты не публикуются. Коммиты остаются в локальной ветке. Серверная интеграция выполняется отдельно после review и выпуска пакета.

## Что перенесено

| Вход пакета | Использование MCP | Реализация |
| --- | --- | --- |
| `componentSearch` | `component_search` | Поиск MPN/UUID через публичный EasyEDA API, преобразование устройств и символов, повторы запросов и существующий кеш |
| `extractCircuit` | Изменение и beautify схемы | Проверка UUID, поиск замен, удаление/добавление внешних связей, размещение и `CircuitAssembly` |
| `getPcbComponentSizes` | `get_pcb_component_sizes` | Разрешение footprints, размеры и отчёт |
| `makePcbLayout` | `make_pcb_layout` | DSL, existing placement, footprints, Rust solver, preview, диагностика, workers, прогресс и отмена |
| `searchReusedBlock` | `search_reused_block` | Заглушка `[]`; непустой `add_reused_blocks` отвергается до запросов и размещения |
| `disposeBackend` | Завершение MCP | Освобождение PCB worker pool |

Перенесены только зависимости этих путей. LangGraph заменён последовательными вызовами async-функций. Для MCP сохраняется требование реальных UUID: серверный LLM-поиск, embeddings, базы, reusable-block resolver и агентная инфраструктура не включены. Тела алгоритмов размещения сохранены с адаптацией импортов и типов.

Checkpoint, документы, применение сборки и проверка свободного места на листе остаются в MCP/расширении. Существующий OperationManager управляет локальной PCB-операцией; удалённый operation ID и HTTP polling удалены. Трассировка и DRC продолжают использовать прежний router.

## Устройство пакета

`backend/src` содержит публичные входы, алгоритмы схемы/PCB, провайдер EasyEDA и небольшие runtime-адаптеры. `backend/native/pcb-board-packer` содержит Rust-исходники и платформенный loader. `backend/tests` содержит регрессионные тесты и fixtures.

Сборка создаёт ESM и TypeScript declarations, включая используемые shared-типы. Установка артефакта не требует отдельного `@copilot/shared`. Доступны subpath exports `/components`, `/schematic`, `/pcb`, `/types`.

Workers, документ DSL и native-библиотека разрешаются относительно установленного пакета. Runtime не зависит от рабочей директории, соседнего сервера или его `.env`. Можно передавать готовые footprints; отдельный универсальный CAD abstraction layer в этот перенос не входит.

## Проверка перед review

```sh
npm ci
npm run native:build --workspace=eda-copilot-backend
npm run check --workspace=eda-copilot-backend
npm run check --workspace=mcp
npm run build
npm run test:package --workspace=eda-copilot-backend
```

Регрессионные тесты проверяют схемы, PCB и native solver. Публичные API проверяются на provider fixtures: поиск, замена компонентов, внешние связи, неизменность входа, прогресс, ошибки DSL и отмена. MCP-проверка использует тестовый bridge и реальный backend, включая генерацию PNG и применение платы.

`test:package` создаёт локальные npm-архивы, устанавливает backend и MCP во временный проект вне репозитория и проверяет публичные API, worker/native-ресурсы, declarations и запуск MCP через stdio. Этот шаг ничего не публикует.

Локально проверяется native-сборка Windows x64. CI добавляет сборку и проверки на Windows, Linux glibc и macOS с Node 20/24. Loader различает x64/arm64 и явно сообщает об отсутствующем бинарнике. Проверка имени платформы не заменяет запуск на этой платформе.

## После review — отдельная работа

Перед первым публичным выпуском нужно получить результаты CI и собрать в распространяемый артефакт бинарники всех заявленных платформ. Текущие локальные архивы содержат бинарник своей машины; публикация и сборка общего release-артефакта не автоматизированы.

После одобренного выпуска backend можно переключить сервер на этот пакет и убрать дублирующиеся реализации. Сейчас сервер остаётся без изменений. Пользовательская документация MCP и Vue-интерфейс сохраняются.
