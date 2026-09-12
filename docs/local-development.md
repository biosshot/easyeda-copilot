# Отдельные backend/router и локальная разработка

Рабочая структура:

```text
projects/
  easyeda-copilot/       # расширение EasyEDA, UI, MCP
  eda-copilot-backend/   # самостоятельная библиотека, собственные типы и Rust
  copilot-router/       # npm-пакет eda-copilot-router
```

Backend больше не является workspace EasyEDA Copilot и не включается в архив MCP. Он самостоятельно объявляет зависимости, собирается, тестируется и публикуется. Его типы скопированы из `copilot-server/src/types`; зависимость backend от `@copilot/shared` удалена. Workspace `shared` остаётся внутри EasyEDA Copilot для расширения/UI/MCP.

## Разработка

Из корня EasyEDA Copilot:

```sh
npm --prefix ../eda-copilot-backend ci
npm --prefix ../eda-copilot-backend run native:build
npm --prefix ../copilot-router ci
npm run deps:local
npm run check --workspace=mcp
npm run test:package --workspace=mcp
```

`deps:local` проверяет соседние package.json, устанавливает `file:../../eda-copilot-backend` и `file:../../copilot-router` в `mcp/package.json`, обновляет lockfile и устанавливает зависимости. Пути считаются относительно `mcp/package.json`. `npm ci` воспроизводит выбранный режим, но не переключает его.

`npm run deps:status` показывает режим каждого пакета. Пути и точные релизные версии хранятся в `scripts/dependency-config.json`; их можно менять под своё расположение папок.

`npm run deps:build` пересобирает только локальные библиотеки. MCP вызывает его автоматически перед сборкой. В backend есть `npm run dev` для наблюдения за TypeScript; Rust после изменений пересобирается отдельно через `npm run native:build`. После изменения библиотек перезапустите процесс MCP: уже загруженный код не обновляется при переподключении расширения.

Для локального запуска используйте `node /absolute/path/easyeda-copilot/mcp/dist/index.js`. `npx easyeda-copilot-mcp` запускает опубликованный пакет, а не рабочую копию.

## Переход к релизу без публикации

```sh
npm run deps:release
npm run check --workspace=mcp
npm run test:package --workspace=mcp
npm run check:release
```

Эти команды ничего не публикуют. `deps:release` сначала проверяет наличие обоих номеров версий в npm. Если версия ещё не опубликована, команда завершается до изменения манифеста и lockfile. При ошибке установки оба файла восстанавливаются; `node_modules` при необходимости восстанавливается повторным `npm install`.

`check:release` и `prepack` запрещают локальные зависимости и bundling backend, проверяют согласованность номеров версий, lockfile и наличие всех четырёх платформенных бинарников в установленном backend. `test:package` в локальном режиме создаёт отдельные backend/router/MCP-архивы, переводит зависимости временной копии MCP в версионные ссылки и устанавливает их в чистый consumer. Исходные манифесты не меняются, публикации нет. Проверки используют имитацию EasyEDA.

Backend `0.1.0` и router `0.3.1` опубликованы в npm. Основная ветка использует эти точные версии; для совместной разработки переключайтесь через `deps:local`, а перед коммитом возвращайтесь через `deps:release`. При обновлении библиотек измените версии в конфигурации и повторите проверки выше. Изменённый MCP нельзя публиковать как `1.1.9`, поскольку этот номер уже занят.

## CI и будущая публикация

Backend имеет собственные `ci.yml` и `publish.yml`: сборка/проверка Windows x64, Linux x64 (glibc, Ubuntu 22.04), macOS Intel/Apple Silicon, сбор всех бинарников в один npm-пакет. Публикация запускается только новым `v*`-тегом в репозитории backend через настроенный npm Trusted Publisher (OIDC): `biosshot/eda-copilot-backend`, workflow `publish.yml`. Первая версия `0.1.0` опубликована вручную; реальная публикация через OIDC ещё не проверена.

EasyEDA Copilot проверяет интеграцию на тех же четырёх платформах и Node 20/24. В локальном режиме CI клонирует соседние backend/router и собирает их; в релизном устанавливает обычные npm-зависимости. Сборка Rust для релизных потребителей MCP не выполняется.

Backend-репозиторий создан на GitHub: [biosshot/eda-copilot-backend](https://github.com/biosshot/eda-copilot-backend). CI использует его для локальных file-зависимостей. Если имя или доступность remote изменятся, обновите checkout в integration.yml; для приватного remote потребуется отдельный read-доступ.

Linux ARM64, Windows ARM64 и Alpine/musl пока не входят в поддерживаемую полную цепочку. Локальный Windows-прогон не заменяет результаты CI Linux/macOS. При первой трассировке router может загружать KRT/Python и зависимости из сети.
