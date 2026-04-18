import { ref, computed } from 'vue';
import en, { type TranslationKey } from './locales/en';
import ja from './locales/ja';
import ko from './locales/ko';
import ru from './locales/ru';
import zhHans from './locales/zh-Hans';

export type Locale = 'en' | 'ja' | 'ko' | 'ru' | 'zh-Hans';

const messages: Record<Locale, Record<string, string>> = {
  en,
  ja,
  ko,
  ru,
  'zh-Hans': zhHans,
};

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  ru: 'Русский',
  'zh-Hans': '简体中文',
};

const currentLocale = ref<Locale>('en');

function detectLocale(): Locale {
  const lang = navigator.language || '';
  if (lang.startsWith('ja')) return 'ja';
  if (lang.startsWith('ko')) return 'ko';
  if (lang.startsWith('ru')) return 'ru';
  if (lang.startsWith('zh')) return 'zh-Hans';
  return 'en';
}

export function initLocale(savedLocale?: string) {
  if (savedLocale && savedLocale in messages) {
    currentLocale.value = savedLocale as Locale;
  } else {
    currentLocale.value = detectLocale();
  }
}

export function setLocale(locale: Locale) {
  currentLocale.value = locale;
}

export function getLocale(): Locale {
  return currentLocale.value;
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const locale = currentLocale.value;
  let text = messages[locale]?.[key] || messages['en']?.[key] || key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }

  return text;
}

export function useI18n() {
  return {
    t,
    locale: computed(() => currentLocale.value),
    setLocale,
    availableLocales: Object.keys(messages) as Locale[],
    localeLabels,
  };
}

export type { TranslationKey };
