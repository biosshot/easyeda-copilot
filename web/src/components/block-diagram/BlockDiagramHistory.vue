<template>
  <HistoryList title="Block Diagram History" :items="diagramItems" empty-message="No saved diagrams yet"
    @select="(id) => loadDiagram(id)" @delete="deleteConfirmDiagram" @clearAll="clearAllHistory"
    @close="$emit('close')">
    <template #item-content="{ item }">
      <span class="item-name">{{ item.label }}</span>
      <span class="item-meta">{{ item.meta }}</span>
    </template>

    <template #item-actions="{ item }">
      <IconButton icon="ClipboardCopy" :size="14" @click="duplicateDiagram(item)" title="Duplicate" />
      <IconButton icon="Pencil" :size="14" @click="handleStartRename(item.id)" title="Rename" />
      <IconButton icon="Trash2" :size="14" @click="deleteConfirmDiagram(item.id)" title="Delete" class="btn-danger" />

      <div v-if="renamingId === item.id" class="rename-input" @click.stop>
        <input v-model="renameValue" type="text" @keyup.enter="saveRename(item.id)" @keyup.escape="cancelRename"
          @click.stop autofocus />
        <IconButton icon="Check" :size="14" @click="saveRename(item.id)" />
        <IconButton icon="X" :size="14" @click="cancelRename" />
      </div>
    </template>
  </HistoryList>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useBlockDiagramHistoryStore, type BlockDiagramEntry } from '../../stores/block-diagram-history-store';
import IconButton from '../shared/IconButton.vue';
import HistoryList from '../shared/HistoryList.vue';

const emit = defineEmits<{
  load: [data: any];
  close: [];
}>();

const historyStore = useBlockDiagramHistoryStore();
const renamingId = ref<string | null>(null);
const renameValue = ref('');

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
};

const diagramItems = computed(() =>
  historyStore.getHistory.map(entry => ({
    id: entry.id,
    label: entry.name,
    meta: formatDate(entry.updatedAt),
    data: entry.data,
    entry
  }))
);

const loadDiagram = (id: string) => {
  const item = diagramItems.value.find(i => i.id === id);
  if (item) {
    emit('load', item.data);
  }
};

const duplicateDiagram = (item: any) => {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const newName = `${item.label} (copy - ${timestamp})`;
  historyStore.addOrUpdateEntry(newName, item.data);
};

const handleStartRename = (id: string) => {
  const entry = historyStore.getHistoryById(id);
  if (entry) {
    renamingId.value = id;
    renameValue.value = entry.name;
  }
};

const saveRename = (id: string) => {
  if (renameValue.value.trim()) {
    historyStore.renameEntry(id, renameValue.value.trim());
  }
  renamingId.value = null;
  renameValue.value = '';
};

const cancelRename = () => {
  renamingId.value = null;
  renameValue.value = '';
};

const deleteConfirmDiagram = (id: string) => {
  if (confirm('Are you sure you want to delete this diagram?')) {
    historyStore.removeEntry(id);
  }
};

const clearAllHistory = () => {
  if (confirm('Are you sure you want to clear all history? This cannot be undone.')) {
    historyStore.clearHistory();
  }
};

defineExpose({
  historyStore
});
</script>

<style scoped>
.item-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s;
  flex: 1;
  display: block;
  min-width: 0;
}

.item-meta {
  font-size: 11px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.rename-input {
  position: absolute;
  inset: 0;
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 8px;
  background: var(--color-surface);
  border-radius: 6px;
  z-index: 10;
}

.rename-input input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--color-primary);
  border-radius: 4px;
  background: var(--color-background-tertiary);
  color: var(--color-text);
  font-size: 12px;
}

.rename-input input:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.btn-danger:hover {
  background-color: rgba(239, 68, 68, 0.1);
}
</style>
