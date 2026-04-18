<template>
  <HistoryList :title="t('blockDiagram.history')" :items="diagramItems" :empty-message="t('blockDiagram.noSavedDiagrams')"
    :show-duplicate="false" @select="loadDiagram" @delete="deleteDiagram" @rename="renameDiagram"
    @clearAll="clearAllHistory" @close="$emit('close')" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useBlockDiagramHistoryStore } from '../../stores/block-diagram-history-store';
import HistoryList from '../shared/HistoryList.vue';
import { t } from '../../i18n';

const emit = defineEmits<{
  load: [data: any];
  close: [];
}>();

const historyStore = useBlockDiagramHistoryStore();

const diagramItems = computed(() =>
  historyStore.getHistory.map(entry => ({
    id: entry.id,
    label: entry.name,
    count: entry.data?.nodes?.length ?? 0,
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

const renameDiagram = (id: string, title: string) => {
  const nextTitle = title.trim();
  if (!nextTitle) return;
  historyStore.renameEntry(id, nextTitle);
};

const deleteDiagram = (id: string) => {
  historyStore.removeEntry(id);
};

const clearAllHistory = () => {
  if (confirm(t('blockDiagram.confirmClearHistory'))) {
    historyStore.clearHistory();
  }
};

defineExpose({
  historyStore
});
</script>
