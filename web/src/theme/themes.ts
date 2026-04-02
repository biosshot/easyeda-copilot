/**
 * Система управления темами приложения
 * Поддерживает темную и светлую темы с унифицированными цветами
 */

import { semanticColors, lightThemeColors } from './colors';

export type ThemeName = 'dark' | 'light';

export interface ThemeConfig {
    name: ThemeName;
    colors: Record<string, string>;
    cssVariables: Record<string, string>;
}

/**
 * Темная тема
 */
export const darkTheme: ThemeConfig = {
    name: 'dark',
    colors: semanticColors,
    cssVariables: {
        '--color-primary': semanticColors.primary,
        '--color-primary-light': semanticColors.primaryLight,
        '--color-primary-dark': semanticColors.primaryDark,

        '--color-secondary': semanticColors.secondary,
        '--color-success': semanticColors.success,
        '--color-error': semanticColors.error,
        '--color-warning': semanticColors.warning,
        '--color-info': semanticColors.info,

        '--color-background': semanticColors.background,
        '--color-background-secondary': semanticColors.backgroundSecondary,
        '--color-background-tertiary': semanticColors.backgroundTertiary,

        '--color-surface': semanticColors.surface,
        '--color-surface-hover': semanticColors.surfaceHover,
        '--color-surface-active': semanticColors.surfaceActive,

        '--color-border': semanticColors.border,
        '--color-border-dark': semanticColors.borderDark,
        '--color-border-light': semanticColors.borderLight,

        '--color-text': semanticColors.text,
        '--color-text-secondary': semanticColors.textSecondary,
        '--color-text-tertiary': semanticColors.textTertiary,
        '--color-text-muted': semanticColors.textMuted,

        '--color-text-on-primary': semanticColors.textOnPrimary,
        '--color-text-on-secondary': semanticColors.textOnSecondary,
        '--color-text-on-surface': semanticColors.textOnSurface,

        '--color-transparent': semanticColors.transparent,
        '--color-white': semanticColors.white,
        '--color-black': semanticColors.black,
    },
};

/**
 * Светлая тема (по умолчанию)
 */
export const lightTheme: ThemeConfig = {
    name: 'light',
    colors: lightThemeColors,
    cssVariables: {
        '--color-primary': lightThemeColors.primary,
        '--color-primary-light': lightThemeColors.primaryLight,
        '--color-primary-dark': lightThemeColors.primaryDark,

        '--color-secondary': lightThemeColors.secondary,
        '--color-success': lightThemeColors.success,
        '--color-error': lightThemeColors.error,
        '--color-warning': lightThemeColors.warning,
        '--color-info': lightThemeColors.info,

        '--color-background': lightThemeColors.background,
        '--color-background-secondary': lightThemeColors.backgroundSecondary,
        '--color-background-tertiary': lightThemeColors.backgroundTertiary,

        '--color-surface': lightThemeColors.surface,
        '--color-surface-hover': lightThemeColors.surfaceHover,
        '--color-surface-active': lightThemeColors.surfaceActive,

        '--color-border': lightThemeColors.border,
        '--color-border-dark': lightThemeColors.borderDark,
        '--color-border-light': lightThemeColors.borderLight,

        '--color-text': lightThemeColors.text,
        '--color-text-secondary': lightThemeColors.textSecondary,
        '--color-text-tertiary': lightThemeColors.textTertiary,
        '--color-text-muted': lightThemeColors.textMuted,

        '--color-text-on-primary': lightThemeColors.textOnPrimary,
        '--color-text-on-secondary': lightThemeColors.textOnSecondary,
        '--color-text-on-surface': lightThemeColors.textOnSurface,

        '--color-transparent': lightThemeColors.transparent,
        '--color-white': lightThemeColors.white,
        '--color-black': lightThemeColors.black,
    },
};

/**
 * Все доступные темы
 */
export const themes: Record<ThemeName, ThemeConfig> = {
    dark: darkTheme,
    light: lightTheme,
};

/**
 * Получить конфигурацию темы по названию
 */
export function getTheme(themeName: ThemeName): ThemeConfig {
    return themes[themeName] || lightTheme;
}

/**
 * Применить CSS переменные темы к документу
 */
export function applyThemeVariables(theme: ThemeConfig): void {
    const root = document.documentElement;

    Object.entries(theme.cssVariables).forEach(([key, value]) => {
        root.style.setProperty(key, value);
    });

    // Также установить атрибут data для CSS селекторов
    root.setAttribute('data-theme', theme.name);
}
