[English](README.md) | [简体中文](README.zh-CN.md) | Русский
# EasyEDA Copilot
Ассистент для EasyEDA Pro и JLCEDA на базе ИИ. Подключает MCP-агента к EasyEDA для создания и изменения схем, поиска компонентов, проектирования и трассировки PCB, инспекции результатов и запуска DRC.

> [!IMPORTANT]
> **MCP — рекомендуемый и активно развиваемый интерфейс EasyEDA Copilot.** Он надёжнее для агентных сценариев и предоставляет полный набор возможностей, включая работу с PCB, checkpoints, документами, инспекцией и DRC. Встроенный Interface остаётся доступным для тех, кому нравится этот способ работы, но теперь считается legacy и получает ограниченную поддержку.

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
  <img src="docs/media/banner.gif" alt="Работа EasyEDA Copilot через MCP: управление EasyEDA из внешнего AI-агента">
</p>

## Возможности Copilot
EasyEDA Copilot добавляет новый уровень AI-проектирования в EasyEDA Pro:
- **Генерация схем по текстовому описанию**: опишите нужную схему и позвольте MCP-агенту собрать предложенный вариант.
- **Доработка существующих схем**: агент читает открытую страницу и может добавлять, заменять, соединять и перегруппировывать компоненты.
- **Поиск компонентов в LCSC**: находит элементы из текстового запроса по нужным характеристикам и требованиям.
- **Применение переиспользуемых блоков**: включает проверенные типовые подсхемы, такие как стабилизаторы, интерфейсы и блоки защиты.
- **Объяснение и анализ схем**: объясняет поведение схем, прохождение сигнала и компромиссы при проектировании.
- **Проектирование печатных плат**: формирует и показывает размещение, собирает плату, выполняет трассировку, проверяет результат и запускает DRC.
- **Безопасное изменение проекта**: сохраняет и восстанавливает checkpoints, откатывает неудачную перегруппировку схемы и контролирует длительные PCB-операции.
- **Управление проектом**: читает дерево проекта, открывает и синхронизирует документы, выбирает целевое окно при нескольких подключённых экземплярах EasyEDA.

Больше примеров доступно на [Oshwlab](https://oshwlab.com/biosshot/edacopilotexamples).

## Быстрый старт с MCP
Загрузите `.eext` последней сборки из [Releases](https://github.com/biosshot/easyeda-copilot/releases/latest).

В EasyEDA Pro:
1. Откройте `Settings -> Extensions -> Extensions Manager`.
2. Нажмите `Import Extensions`.
3. Выберите скачанный `.eext` файл.
4. Разрешите `External Interactions`, как показано в разделе [Разрешения расширения](docs/settings.md#extension-permissions).

<p align="center">
  <a href="docs/media/params.png">
    <img src="docs/media/params.png" alt="Включение External Interactions для EasyEDA Copilot" width="560">
  </a>
</p>

Добавьте MCP-сервер к агенту:

Codex:
```bash
codex mcp add easyeda-copilot -- npx -y easyeda-copilot-mcp
```

Claude Code:

```bash
claude mcp add easyeda-copilot -- npx -y easyeda-copilot-mcp
```

Затем:

1. Запустите Codex, Claude Code или другой MCP-клиент с включённым сервером.
2. Откройте целевую схему или документ PCB в EasyEDA Pro.
3. Попросите агента работать с открытым документом EasyEDA.

Расширение сканирует `ws://127.0.0.1:8787` каждые 5 секунд и подключается автоматически, когда MCP-сервер доступен. `Copilot -> MCP` не открывает отдельный интерфейс — этот пункт только приостанавливает или возобновляет сканирование.

Общая JSON-конфигурация, локальная сборка и подробный PCB workflow описаны в [README пакета MCP](mcp/README.ru.md).

## MCP и встроенный Interface (legacy)

| Возможность | MCP | Встроенный Interface |
| --- | --- | --- |
| Генерация и изменение схем | Да | Да, legacy workflow |
| Поиск компонентов и reusable blocks | Да | Да |
| Checkpoints и автоматическое восстановление | Да | Ограниченно |
| Управление проектом и документами | Да | Нет |
| Размещение, preview и сборка PCB | Да | Нет |
| Трассировка, инспекция, слои и DRC | Да | Нет |
| Несколько подключённых экземпляров EasyEDA | Да | Нет |
| Приоритет разработки | Основной | Ограниченная поддержка |

Во встроенный Interface вложено много сил, и он остаётся полезным для пользователей, которым нравится интегрированный чат и UI для SPICE. Он доступен через `Copilot -> Interface (Legacy)`. Новым пользователям и при воспроизведении ошибок рекомендуется начинать с MCP: в нём больше возможностей, а соединение, очереди команд, тайм-ауты и восстановление обрабатываются надёжнее.

<p align="center">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/main.png" alt="Встроенный legacy-интерфейс EasyEDA Copilot">
</p>

## Работа с PCB (только через MCP)

Размещение компонентов на печатной плате доступно только через внешний MCP-клиент, такой как Codex или Claude Code. Эта функция недоступна во встроенном чате Copilot.

MCP формирует размещение: контур платы, механические ограничения, компоненты, монтажные отверстия, контактные площадки и позиционные обозначения. Оцените механический предварительный просмотр, утвердите окончательное размещение, а затем импортируйте его в EasyEDA. После сборки MCP может запустить встроенный автотрассировщик, проверить объекты печатной платы и запустить DRC EasyEDA на открытом документе рабочего стола.

Сборка печатных плат, предварительный просмотр и поддержка трассировки через клиент проверяются с помощью **EasyEDA Desktop V3.2.149**.

### Плата RP2040: Copilot и Quilter

<p align="center">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/pcb-examples/rp2040_copilot_top.png" alt="RP2040 Copilot, top layer" width="48%">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/pcb-examples/rp2040_quiliter_top.png" alt="RP2040 Quilter, top layer" width="48%">
</p>
<p align="center">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/pcb-examples/rp2040_copilot_bot.png" alt="RP2040 Copilot, bottom layer" width="48%">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/pcb-examples/rp2040_quiliter_bot.png" alt="RP2040 Quilter, bottom layer" width="48%">
</p>

### Компактная плата PICO Duck: Copilot и Quilter

<p align="center">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/pcb-examples/pico_duck_copilot_top.png" alt="PICO Duck Copilot, top layer" width="48%">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/pcb-examples/pico_duck_quilter_top.png" alt="PICO Duck Quilter, top layer" width="48%">
</p>
<p align="center">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/pcb-examples/pico_duck_copilot_bot.png" alt="PICO Duck Copilot, bottom layer" width="48%">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/pcb-examples/pico_duck_quilter_bot.png" alt="PICO Duck Quilter, bottom layer" width="48%">
</p>

### Плата ESPower: Copilot и Quilter

<p align="center">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/pcb-examples/espower_copilot_top.png" alt="ESPower Copilot, top layer" width="48%">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/pcb-examples/espower_quiliter_top.png" alt="ESPower Quilter, top layer" width="48%">
</p>
<p align="center">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/pcb-examples/espower_copilot_bot.png" alt="ESPower Copilot, bottom layer" width="48%">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/pcb-examples/espower_quiliter_bot.png" alt="ESPower Quilter, bottom layer" width="48%">
</p>

## Совместимость

| Версии EasyEDA Pro  | Статус    |
| ------------------- | --------- |
| Desktop V3.2.149    | Проверено |
| Desktop V2.2.45     | Проверено |
| Desktop V2.2.47     | Проверено |

## Особенности

### Генерация схем

Формирует схему на основе текстового описания. Copilot может планировать схему, искать компоненты, создавать структурированный результат и предоставлять действие `Assemble circuit`, когда генерируемая схема готова.

<p align="center">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/use-reused.gif" alt="Generate a circuit with reusable blocks">
</p>

### Доработка схемы

Используйте Copilot для работы с уже существующим фрагментом схемы. Позвольте ему исправить пропущенный блок, добавить компоненты, соединить сигналы или запросите предложения по доработке схемы на основе выбранного контекста.

<p align="center">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/circuit-compl-ex1.gif" alt="Circuit completion example 1" width="48%">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/circuit-compl-ex2.gif" alt="Circuit completion example 2" width="48%">
</p>

### Выбор компонентов

Поиск в LCSC по смыслу запроса вместо ручной настройки фильтров каталога. Примеры:

- `find 5V relay`
- `Find DC-DC chip 5V and 10A current`
- `find capacitor 22uF Murata SMD 1210`

<p align="center">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/comp-search-ex1.png" alt="Find 5V relay" width="31%">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/comp-search-ex2.png" alt="Find DC-DC chip 5V and 10A current" width="31%">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/comp-search-ex3.png" alt="Find capacitor 22uF Murata SMD 1210" width="31%">
</p>

### Переиспользуемые блоки

Переиспользуемые блоки — это проверенные фрагменты схем, которые агент может адаптировать и вставлять в генерируемые схемы. Они полезны для стандартных подсхем, в которых топология остается неизменной, а меняются только выводы или номиналы пассивных элементов.

Читайте [Документацию по переиспользуемым блокам](docs/reusable-blocks.md).

### SPICE-симуляция

Copilot может выполнять SPICE-симуляцию и автоматически выбирать модели из библиотеки моделей компонентов.

Всегда проверяйте SPICE-модели, используемые для заменяемых компонентов. Выбранные модели отображаются под графиком после завершения моделирования.

<p align="center">
  <img src="https://raw.githubusercontent.com/biosshot/easyeda-copilot/refs/heads/main/docs/media/spice.gif" alt="SPICE simulation">
</p>

## Документация

- [Настройки](docs/settings.md)
- [Прикрепление схем к AI-агенту](docs/attaching-circuits.md)
- [Сборка схемы от AI-агента](docs/assembling-circuits.md)
- [Переиспользуемые блоки](docs/reusable-blocks.md)
