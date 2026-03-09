/**
 * Унифицированная палетка цветов для приложения
 * Используется для всех тем и обеспечивает простоту переключения между ними
 */

export const semanticColors = {
    // Основные цвета
    primary: '#10a37f', // Зеленый основной цвет
    primaryLight: '#10b981', // Светло-зеленый
    primaryDark: '#088860', // Темно-зеленый

    // Дополнительные цвета
    secondary: '#3b82f6', // Синий
    success: '#10b981', // Зеленый (успех)
    error: '#ef4444', // Красный (ошибка)
    warning: '#f59e0b', // Оранжевый (предупреждение)
    info: '#0ea5e9', // Голубой (информация)

    // Нейтральные цвета (основные для темной темы)
    background: '#0d1117', // Фон главный
    backgroundSecondary: '#161b22', // Фон вторичный
    backgroundTertiary: '#21262d', // Фон третичный (для элементов)

    surface: '#161b22', // Поверхность элементов
    surfaceHover: '#30363d', // Поверхность при наведении
    surfaceActive: '#40454f', // Поверхность активного состояния

    // Границы и разделители
    border: '#30363d', // Граница стандартная
    borderDark: '#161b22', // Граница темная
    borderLight: '#40454f', // Граница светлая

    // Текст и иконки
    text: '#ececf1', // Основной текст
    textSecondary: '#c9d1d9', // Вторичный текст
    textTertiary: '#a1a7b8', // Третичный текст
    textMuted: '#7d8590', // Приглушенный текст

    // Для светлого текста на цветном фоне
    textOnPrimary: '#ffffff', // Текст на основном цвете
    textOnSecondary: '#ffffff', // Текст на вторичном цвете
    textOnSurface: '#ececf1', // Текст на поверхности

    // Прозрачность
    transparent: 'transparent',
    white: '#ffffff',
    black: '#000000',
};

/**
 * Палетка для светлой темы (опционально)
 */
export const lightThemeColors = {
    primary: '#5588ff',          // Ваш новый основной цвет
    primaryLight: '#88aaff',     // Светлее
    primaryDark: '#3366cc',      // Насыщеннее

    secondary: '#4444bc',        // Глубокий синий для контраста
    success: '#16a34a',
    error: '#dc2626',
    warning: '#ea580c',
    info: '#5588ff',             // Инфо теперь совпадает с primary

    background: '#ffffff',
    backgroundSecondary: '#f9fafb',
    backgroundTertiary: '#f3f4f6',

    surface: '#f9fafb',
    surfaceHover: '#f3f4f6',
    surfaceActive: '#e5e7eb',

    border: '#e5e7eb',
    borderDark: '#d1d5db',
    borderLight: '#f3f4f6',

    text: '#1f2937',
    textSecondary: '#4b5563',
    textTertiary: '#6b7280',
    textMuted: '#9ca3af',

    textOnPrimary: '#ffffff',
    textOnSecondary: '#ffffff',
    textOnSurface: '#1f2937',

    transparent: 'transparent',
    white: '#ffffff',
    black: '#000000',
};

/**
 * Получить цвет по названию для текущей темы
 */
export function getColor(colorName: keyof typeof semanticColors, isDark: boolean = true) {
    const colors = isDark ? semanticColors : lightThemeColors;
    return colors[colorName];
}
