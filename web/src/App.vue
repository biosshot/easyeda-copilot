<template>
  <div id="app">
    <Navbar>
      <template #controls v-if="activeTab === 'chat'">
        <ChatControls :is-loading="chatViewRef?.isLoading || false" />
      </template>
      <template #controls v-else-if="activeTab === 'simulate'"></template>
      <template #controls v-else-if="activeTab === 'completions'"></template>
      <template #controls v-else-if="activeTab === 'settings'">
        <SettingsControls />
      </template>
    </Navbar>

    <div v-if="hasRecorder" class="backwards-nav">
      <span class="line"></span>
      <IconButton @click="backward" icon="Bookmark" class="backward" :size="11">Cancel last changes</IconButton>
      <span class="line"></span>
    </div>

    <main>
      <KeepAlive>
        <ChatView v-if="activeTab === 'chat'" ref="chatViewRef" />
      </KeepAlive>
      <KeepAlive>
        <CompletionsView v-if="activeTab === 'completions'" />
      </KeepAlive>
      <KeepAlive>
        <SettingsView v-if="activeTab === 'settings'" />
      </KeepAlive>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watchEffect, Component, reactive, onScopeDispose } from 'vue';
import { useAppStore } from './stores/app-store';
import { setTheme } from './composables/useTheme';
import Navbar from './components/layout/Navbar.vue';
import ChatView from './components/chat/ChatView.vue';
import CompletionsView from './components/completions/CompletionsView.vue';
import ChatControls from './components/chat/ChatControls.vue';
import SettingsView from './components/settings/SettingsView.vue';
import { useSettingsStore } from './stores/settings-store';
import SettingsControls from './components/settings/SettingsControls.vue';
import { __MODE__ } from './mode';
import { ThemeName } from './theme/themes';
import IconButton from './components/shared/IconButton.vue';
import { isEasyEda } from './eda/utils';

declare global {
  interface EDA {
    lastChangesRecorder?: {
      backwards: () => void;
      isEnded: () => boolean;
    },
  }
}
const recorderRef = ref<EDA['lastChangesRecorder']>(undefined);

let intervalId: number | null = null;

if (isEasyEda()) {
  intervalId = window.setInterval(() => {
    recorderRef.value = eda.lastChangesRecorder;
  }, 200);

  onScopeDispose(() => {
    if (intervalId) clearInterval(intervalId);
  });
}

const hasRecorder = computed(() => isEasyEda() && recorderRef.value);

const backward = () => {
  if (hasRecorder.value)
    eda.lastChangesRecorder?.backwards();
}

const store = useAppStore();
const settingsStore = useSettingsStore();

const activeTab = computed(() => store.activeTab);
const chatViewRef = ref<typeof ChatView | null>(null);

// Инициализировать тему при загрузке приложения
onMounted(() => {
  settingsStore.loadSettings();
  setTheme((settingsStore.getSetting('theme') || 'light') as ThemeName);

  watchEffect(() => {
    const theme = settingsStore.getSetting('theme') || 'light';
    setTheme(theme as ThemeName);
  });
});

if (__MODE__ === 'DEV') {
  const title = document.querySelector('title');
  if (title)
    title.textContent += ' DEV';
}

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
  overflow: hidden;
  max-width: 900px;
  margin: 0 auto;
  margin: 0 auto;
  width: 100%;
}

.placeholder {
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.placeholder-content {
  text-align: center;
  color: var(--color-text-muted);
  max-width: 420px;
}

.empty-title {
  font-size: 1.25rem;
  color: var(--color-text);
  margin-bottom: 0.5rem;
}

.empty-sub {
  margin-bottom: 0.5rem;
}

.empty-hint {
  font-size: 0.9rem;
  color: var(--color-text-tertiary);
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
  background: var(--color-border);
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-hover);
}

::-webkit-scrollbar-corner {
  background: transparent;
}

/* Дополнительно: при наведении на область прокрутки — улучшаем вид */
*::-webkit-scrollbar-thumb:active {
  background: var(--color-border-light);
}

.backwards-nav {
  width: 100%;
  display: flex;
  position: absolute;
  top: 35px;
  align-items: center;
  z-index: 5;
}

.backward {
  font-size: 11px;
  color: #888;
}

.line {
  flex-grow: 1;
  border-top: 1px dashed var(--color-border-dark);
  margin-left: 8px;
}
</style>