import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
// @ts-ignore
import './katex-lite.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.mount('body');