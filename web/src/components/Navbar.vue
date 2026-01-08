<template>
  <div class="navbar">
    <div class="tabs">
      <IconButton :class="['tab', { active: activeTab === 'chat' }]" @click="store.setActiveTab('chat')"
        icon="MessageSquare">
        <span>Chat</span>
      </IconButton>

      <IconButton :class="['tab', { active: activeTab === 'settings' }]" @click="store.setActiveTab('settings')"
        icon="Settings">
        <span>Settings</span>
      </IconButton>
    </div>

    <div class="nav-controls" @click.stop>
      <slot name="controls"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../stores/appStore';
import IconButton from './IconButton.vue';

const store = useAppStore();

const activeTab = computed(() => store.activeTab);

</script>

<style scoped>
.navbar {
  background-color: var(--color-background);
  display: flex;
  border-bottom: 1px solid var(--color-border);
  min-height: 32px;
  max-height: 32px;
  align-items: center;
}

.nav-controls {
  display: flex;
  align-items: center;
  margin-left: auto;
  padding: 0.5rem;
  gap: 0.5rem;
}

.tabs {
  display: flex;
  gap: 1.5rem;
}

.tab {
  padding: 1px 10px;
  border-radius: 0;
}

.tab.active {
  color: var(--color-primary);
  border-bottom: 2px solid var(--color-primary);
}
</style>