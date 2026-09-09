export function extractAndNormalizeE24(valueStr: string) {
    // Ряд E24 (в омах, фарадах и генри — без приставок)
    const e24 = [
        1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0,
        2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3,
        4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1
    ];

    // Регулярное выражение для извлечения числа и следующей за ним буквы (единицы)
    const match = valueStr.match(/(\d+(?:\.\d+)?)([pnumkMG]?)([FfHhΩΩohm]?)/i);
    if (!match) return null;

    const num = parseFloat(match[1]);
    const prefix = (match[2] || '');
    const unitChar = (match[3] || '');

    // Определяем тип компонента по единице измерения
    // const isCapacitor = unitChar.includes('f');
    // const isInductor = unitChar.includes('h');
    // Если ни то, ни другое — считаем резистором

    // Преобразуем в базовые единицы (Ом, Фарад, Генри)
    const multipliers: Record<string, number> = {
        'p': 1e-12,
        'n': 1e-9,
        'u': 1e-6,
        'm': 1e-3,
        '': 1,
        'k': 1e3,
        'M': 1e6,
        'G': 1e9
    };

    const multiplier = multipliers[prefix] || 1;
    const baseValue = num * multiplier;

    // Для конденсаторов и индуктивностей часто используются не E24, но по условию — всё через E24
    // Найдём ближайший номинал в E24, масштабируя значение

    // Приведём значение к диапазону [1, 10) для сравнения с E24
    const exp = Math.floor(Math.log10(baseValue));
    const mantissa = baseValue / Math.pow(10, exp);

    // Найдём ближайший номинал в E24
    const closest = e24.reduce((prev, curr) =>
        Math.abs(curr - mantissa) < Math.abs(prev - mantissa) ? curr : prev
    );

    // Восстановим значение с найденным номиналом
    const normalizedValue = closest * Math.pow(10, exp);

    // Теперь выберем подходящую метрическую приставку для вывода
    const prefixes = [
        { symbol: 'G', value: 1e9 },
        { symbol: 'M', value: 1e6 },
        { symbol: 'k', value: 1e3 },
        { symbol: '', value: 1 },
        { symbol: 'm', value: 1e-3 },
        { symbol: 'u', value: 1e-6 },
        { symbol: 'n', value: 1e-9 },
        { symbol: 'p', value: 1e-12 }
    ];

    let outputSymbol = '';
    let outputValue = normalizedValue;

    for (const p of prefixes) {
        if (normalizedValue >= p.value || p.value === 1e-12) {
            const candidate = normalizedValue / p.value;
            // Проверим, что результат в разумных пределах (например, не 0.00123p)
            if (candidate >= 1 || p.value === 1e-12) {
                outputValue = candidate;
                outputSymbol = p.symbol;
                break;
            }
        }
    }

    // Форматируем число: убираем лишние нули
    const formattedValue = outputValue % 1 === 0 ? String(outputValue) : outputValue.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');

    return formattedValue + outputSymbol;
}

const ElementypeMap = [
    // Резисторы
    [/^R\d/, "Резисторы"],
    [/^RN\d/, "Резисторы"], // Резисторные сети
    [/^RP\d/, "Резисторы"], // Подстроечные резисторы (иногда)

    // Конденсаторы
    [/^C\d/, "Конденсаторы"],
    [/^CP\d/, "Конденсаторы"], // Подстроечные/переменные конденсаторы

    // Индуктивности
    [/^L\d/, "Индуктивности"],
    [/^T\d/, "Трансформатор"], // По ГОСТ T — трансформатор, но в международной практике часто L или T
    [/^TR\d/, "Трансформатор"], // Альтернативное обозначение
    [/^FB\d/, "Индуктивности"],

    // Диоды и полупроводники
    [/^D\d/, "Диоды"],
    [/^VD\d/, "Диоды"], // По ГОСТ
    [/^ZD\d/, "Стабилитроны"], // Иногда выделяют отдельно, но обычно входят в "Диоды"
    [/^LED\d/, "Светодиоды"],
    [/^VL\d/, "Светодиоды"], // По ГОСТ

    // Транзисторы
    [/^Q\d/, "Транзистор"],
    [/^VT\d/, "Транзистор"], // По ГОСТ
    [/^TR\d/, "Транзистор"], // Редко, но встречается

    // Микросхемы (ИМС)
    [/^U\d/, "Микросхемы"],
    [/^IC\d/, "Микросхемы"],
    [/^DD\d/, "Микросхемы"], // По ГОСТ — цифровые ИМС
    [/^DA\d/, "Микросхемы"], // По ГОСТ — аналоговые ИМС
    [/^DZ\d/, "Микросхемы"], // По ГОСТ — ИМС другого типа

    // Кварцевые резонаторы, кристаллы
    [/^X\d/, "Кварцевые резонаторы"],
    [/^Y\d/, "Кварцевые резонаторы"], // ANSI/IEEE: Y — crystal
    [/^XTAL\d/, "Кварцевые резонаторы"],

    // Разъемы
    [/^J\d/, "Разъемы"],
    [/^P\d/, "Разъемы"], // Plug (вилка) — ANSI
    [/^CN\d/, "Разъемы"],
    [/^CON\d/, "Разъемы"],
    [/^H\d/, "Разъемы"],
    [/^XP\d/, "Разъемы"], // По ГОСТ — штыревой разъём
    [/^XS\d/, "Разъемы"], // По ГОСТ — гнездовой разъём
    [/^USB\d/, "Разъемы"],
    [/^HDMI\d/, "Разъемы"],
    [/^JACK\d/, "Разъемы"],

    // Переключатели, кнопки
    [/^SW\d/, "Кнопки"],
    [/^S\d/, "Кнопки"], // Switch — ANSI
    [/^SB\d/, "Кнопки"], // По ГОСТ — кнопочные выключатели
    [/^SA\d/, "Переключатели"], // По ГОСТ — переключатели

    // Реле
    [/^K\d/, "Реле"],
    [/^RLY\d/, "Реле"],
    [/^KR\d/, "Реле"], // По ГОСТ

    // Предохранители
    [/^F\d/, "Предохранители"],
    [/^FU\d/, "Предохранители"], // По ГОСТ

    // Громкоговорители, зуммеры
    [/^SPK\d/, "Акустика"],
    [/^BZ\d/, "Зуммеры"],
    [/^HA\d/, "Акустика"], // По ГОСТ — звуковые излучатели

    // Антенны
    [/^ANT\d/, "Антенны"],
    [/^AE\d/, "Антенны"], // По ГОСТ
    [/^RF\d/, "Антенны"], // По ГОСТ

    // Источники питания, батареи
    [/^BT\d/, "Батареи"],
    [/^B\d/, "Батареи"],
    [/^G\d/, "Источники питания"], // По ГОСТ — генераторы, источники
    [/^PWR\d/, "Источники питания"],

    // Оптоэлектроника
    [/^OP\d/, "Оптоэлектроника"],
    [/^OK\d/, "Оптоэлектроника"], // По ГОСТ — оптрон

    // Печатные узлы, платы
    [/^PCB\d/, "Печатные платы"],
    [/^A\d/, "Устройства"], // По ГОСТ — сборочные единицы

    // Термисторы, варисторы и т.п.
    [/^TH\d/, "Термисторы"],
    [/^RV\d/, "Варисторы"],

    // Микрофоны
    [/^MIC\d/, "Микрофоны"],
    [/^BM\d/, "Микрофоны"], // По ГОСТ

    // Дисплеи
    [/^DS\d/, "Дисплеи"],
    [/^LCD\d/, "Дисплеи"],
    [/^OLED\d/, "Дисплеи"],

    // Прочее
    [/^TP\d/, "Контрольные точки"],
    [/^TEST\d/, "Контрольные точки"],
] as const;

export type DesignatorLabel = (typeof ElementypeMap)[number][1];

export const getDesignatorLabel = (designator: string): DesignatorLabel | null => {
    for (const [regex, name] of ElementypeMap)
        if (regex.test(designator.toUpperCase()))
            return name;
    return null; // или "Неизвестный элемент"
}

export const getPartIdFromDesignator = (designator: string) => {
    const partStr = designator.split('.').at(-1);
    let partId = 0;

    if (!partStr)
        partId = 0;
    else
        partId = Number(partStr) - 1;

    if (isNaN(partId)) partId = 0;

    return partId;
}