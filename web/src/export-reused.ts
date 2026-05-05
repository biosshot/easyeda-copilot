import { createApp } from 'vue';
import ReusedBlocks from './ReusedBlocks.vue';
import { createPinia } from 'pinia';

const app = createApp(ReusedBlocks);
const pinia = createPinia();

app.use(pinia);
app.mount('body');