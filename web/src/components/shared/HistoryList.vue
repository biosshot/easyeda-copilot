<template>
    <div class="history-list-container">
        <div class="history-header">
            <h3>{{ title }}</h3>
            <IconButton v-if="items.length > 0" @click="$emit('close')" icon="X" />
        </div>

        <div class="history-list">
            <div v-if="items.length === 0" class="empty-history">
                <p>{{ emptyMessage }}</p>
            </div>
            <div v-for="item in items" :key="item.id" class="history-item">
                <div class="history-item-content" :class="{ active: activeItemId && item.id === activeItemId }"
                    @click="$emit('select', item.id)">
                    <slot name="item-content" :item="item">
                        <span class="history-item-title">{{ item.label || item.name || item.title }}</span>
                        <span v-if="item.count" class="history-item-count">{{ item.count }}</span>
                    </slot>
                </div>
                <slot name="item-actions" :item="item">
                    <IconButton @click="$emit('delete', item.id)" icon="Trash2" />
                </slot>
            </div>
        </div>

        <div v-if="items.length > 0" class="history-footer">
            <button class="clear-all-btn" @click="$emit('clearAll')">Clear all</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import IconButton from './IconButton.vue';

interface HistoryItem {
    id: string;
    label?: string;
    name?: string;
    title?: string;
    count?: number;
    [key: string]: any;
}

defineProps<{
    title: string;
    items: HistoryItem[];
    emptyMessage?: string;
    activeItemId?: string | null;
}>();

defineEmits<{
    select: [id: string];
    delete: [id: string];
    close: [];
    clearAll: [];
    rename: [id: string];
}>();
</script>

<style scoped>
.history-list-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    z-index: 1000;
    overflow: hidden;
    max-height: 70vh;
}

.history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
}

.history-header h3 {
    margin: 0;
    font-size: 0.9rem;
    color: var(--color-text);
}

.history-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.empty-history {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100px;
    color: var(--color-text-muted);
    font-size: 0.85rem;
}

.empty-history p {
    margin: 0;
}

.history-item {
    display: flex;
    gap: 0.25rem;
    align-items: center;
}

.history-item-content {
    flex: 1;
    padding: 0.4rem 0.5rem;
    background-color: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: 0.3rem;
    color: var(--color-text);
    cursor: pointer;
    text-align: left;
    font-size: 0.8rem;
    transition: all 0.2s ease;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
}

.history-item-content:hover {
    background-color: var(--color-background-secondary);
    border-color: var(--color-surface-active);
}

.history-item-content.active {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-text-on-primary);
}

.history-item-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
}

.history-item-count {
    font-size: 0.7rem;
    color: inherit;
    opacity: 0.7;
    flex-shrink: 0;
}

.history-footer {
    padding: 0.5rem;
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
}

.clear-all-btn {
    width: 100%;
    padding: 0.4rem;
    background-color: var(--color-error);
    border: 1px solid var(--color-error);
    color: var(--color-text-on-primary);
    border-radius: 0.3rem;
    cursor: pointer;
    font-size: 0.8rem;
    transition: all 0.2s ease;
}

.clear-all-btn:hover {
    background-color: #ff6b6b;
    border-color: var(--color-error);
    color: var(--color-text-on-primary);
}

/* Scrollbar styling */
.history-list::-webkit-scrollbar {
    width: 6px;
}

.history-list::-webkit-scrollbar-track {
    background: transparent;
}

.history-list::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
}

.history-list::-webkit-scrollbar-thumb:hover {
    background: var(--color-border-dark);
}
</style>
