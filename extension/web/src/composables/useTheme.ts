/**
 * Composable для управления темой приложения
 * Обеспечивает реактивность при изменении темы и сохранение в localStorage
 */

import { ref, computed, watch } from 'vue';
import { getTheme, applyThemeVariables, type ThemeName } from '../theme/themes';

const THEME_STORAGE_KEY = 'app-theme';

// Реактивное состояние текущей темы
const currentTheme = ref<ThemeName>('light');

// Установить новую тему
export function setTheme(themeName: ThemeName): void {
    currentTheme.value = themeName;
    const theme = getTheme(themeName);
    applyThemeVariables(theme);

    try {
        localStorage.setItem(THEME_STORAGE_KEY, themeName);
    } catch (e) {
        console.warn('Failed to save theme to localStorage:', e);
    }
}

// Composable hook
export function useTheme() {
    const theme = computed(() => getTheme(currentTheme.value));

    return {
        // Состояние
        currentTheme: computed(() => currentTheme.value),
        theme,

        // Методы
        setTheme,
    };
}
