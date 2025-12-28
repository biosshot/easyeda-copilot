<template>
  <div id="app">
    <Navbar>
      <template #controls v-if="activeTab === 'chat'">
        <ChatControls :is-loading="chatViewRef?.isLoading || false" />
      </template>
      <template #controls v-else-if="activeTab === 'settings'">
        <SettingsControls />
      </template>
    </Navbar>

    <main>
      <!-- <GenerateView v-if="activeTab === 'generate'" /> -->
      <ChatView v-if="activeTab === 'chat'" ref="chatViewRef" />
      <SettingsView v-else-if="activeTab === 'settings'" />
    </main>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watchEffect } from 'vue';
import { useAppStore } from './stores/appStore.ts';
import { setTheme } from './composables/useTheme.ts';
import Navbar from './components/Navbar.vue';
import ChatView from './components/ChatView.vue';
import ChatControls from './components/ChatControls.vue';
import SettingsView from './components/SettingsView.vue';
import './theme/theme-variables.css';
import { useSettingsStore } from './stores/settingsStore.ts';
import SettingsControls from './components/SettingsControls.vue';


const store = useAppStore();
// window.store = store;

const activeTab = computed(() => store.activeTab);
const chatViewRef = ref(null);

// Инициализировать тему при загрузке приложения
onMounted(() => {
  const settingsStore = useSettingsStore();
  settingsStore.initSettings();
  setTheme(settingsStore.getSetting('theme') || 'light');

  watchEffect(() => {
    const theme = settingsStore.getSetting('theme') || 'light';
    setTheme(theme);
  });
});
</script>

<style>
body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: var(--color-background);
  color: var(--color-text);
}

html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
  /* блокируем прокрутку на body/html */
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  /* или 100%, но vh надёжнее */
}

#app>main {
  flex: 1;
  /* занимает всё оставшееся пространство */
  overflow: auto;
  /* прокрутка только внутри main, если нужно */
}

/* === Стили для скроллбара === */

/* Chrome, Edge, Safari */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
  background: transparent;

}

::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 10px;
}

::-webkit-scrollbar-thumb {
  background: var(--scrollbar-bg);
  border-radius: 10px;
  border: 2px solid var(--scrollbar-border);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-hover);
}

::-webkit-scrollbar-corner {
  background: transparent;
}

/* Дополнительно: при наведении на область прокрутки — улучшаем вид */
*::-webkit-scrollbar-thumb:active {
  background: var(--scrollbar-active);
}
</style>