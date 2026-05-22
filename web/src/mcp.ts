import { createApp } from 'vue';
import Mcp from './Mcp.vue';
import { createPinia } from 'pinia';

const app = createApp(Mcp)
const pinia = createPinia();

app.use(pinia);
app.mount('body');