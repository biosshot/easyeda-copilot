import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { useSettingsStore } from './stores/settings-store';
import { startRelay } from './api/relay';
// @ts-ignore
import 'katex/dist/katex.min.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.mount('body');

// Auto-start relay if provider is 'local'
const settingsStore = useSettingsStore();
settingsStore.loadSettings();
if (settingsStore.getSetting('apiProvider') === 'local') {
    startRelay();
}
