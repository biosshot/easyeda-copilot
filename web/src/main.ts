import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
// @ts-ignore
import 'katex/dist/katex.min.css';
import { initLocale } from './i18n';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);

app.config.errorHandler = (err, instance, info) => {
  console.error('Unhandled Vue error:', err, info);
};

// Initialize locale from saved settings or browser detection
try {
  const raw = localStorage.getItem('app_settings');
  const saved = raw ? JSON.parse(raw) : null;
  initLocale(saved?.language);
} catch {
  initLocale();
}

app.mount('body');