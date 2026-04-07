<template>
    <div class="history-list-container">
        <div class="history-header">
            <h3>{{ title }}</h3>
            <div class="history-header-actions">
                <IconButton v-if="items.length > 0" class="history-header-menu-btn" variant="ghost"
                    icon="MoreHorizontal" @click.stop="openHeaderMenu($event)" />
                <IconButton variant="ghost" v-if="items.length > 0" @click="$emit('close')" icon="X" />
            </div>
        </div>

        <div class="history-list">
            <div v-if="items.length === 0" class="empty-history">
                <p>{{ emptyMessage }}</p>
            </div>
            <div v-for="item in items" :key="item.id" class="history-item"
                :class="{ active: activeItemId && item.id === activeItemId }" @click="handleSelect(item.id)">
                <div class="history-item-content">
                    <slot name="item-content" :item="item">
                        <input v-if="editingItemId === item.id" v-model="editingTitle" class="history-item-title-input"
                            @click.stop @keydown.enter.stop.prevent="saveRename(item.id)"
                            @keydown.esc.stop.prevent="cancelRename" @blur="saveRename(item.id)" />
                        <span v-else class="history-item-title">{{ item.label || item.name || item.title }}</span>
                        <span v-if="item.count" class="history-item-count">{{ item.count }}</span>
                    </slot>
                </div>
                <div class="history-item-actions" @click.stop>
                    <slot name="item-actions" :item="item">
                        <IconButton class="history-item-menu-btn" variant="ghost" icon="MoreHorizontal"
                            @click.stop="openItemMenu($event, item.id)" />
                    </slot>
                </div>
            </div>
        </div>

        <ContextMenu ref="itemContextMenuComponent" :items="itemContextMenuItems" @close="onItemMenuClose" />
        <ContextMenu ref="headerContextMenuComponent" :items="headerContextMenuItems" @close="onHeaderMenuClose" />
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import IconButton from './IconButton.vue';
import ContextMenu, { type ContextMenuItem } from './ContextMenu.vue';

interface HistoryItem {
    id: string;
    label?: string;
    name?: string;
    title?: string;
    count?: number;
    [key: string]: any;
}

const props = defineProps<{
    title: string;
    items: HistoryItem[];
    emptyMessage?: string;
    activeItemId?: string | null;
}>();

const emit = defineEmits<{
    select: [id: string];
    delete: [id: string];
    duplicate: [id: string];
    close: [];
    clearAll: [];
    rename: [id: string, title: string];
}>();

const itemContextMenuComponent = ref<InstanceType<typeof ContextMenu> | null>(null);
const headerContextMenuComponent = ref<InstanceType<typeof ContextMenu> | null>(null);
const openedItemMenuId = ref<string | null>(null);
const editingItemId = ref<string | null>(null);
const editingTitle = ref('');

const itemContextMenuItems = computed<ContextMenuItem[]>(() => [
    {
        label: 'Duplicate',
        icon: 'Copy',
        click: () => {
            if (!openedItemMenuId.value) return;
            emit('duplicate', openedItemMenuId.value);
        }
    },
    {
        label: 'Rename',
        icon: 'Pencil',
        click: () => {
            if (!openedItemMenuId.value) return;
            startRename(openedItemMenuId.value);
        }
    },
    {
        divider: true
    },
    {
        label: 'Delete',
        icon: 'Trash2',
        danger: true,
        click: () => {
            if (!openedItemMenuId.value) return;
            handleDelete(openedItemMenuId.value);
        }
    }
]);

const headerContextMenuItems = computed<ContextMenuItem[]>(() => {
    if (props.items.length === 0) return [];

    return [
        {
            label: 'Clear all',
            icon: 'Trash2',
            danger: true,
            click: () => emit('clearAll')
        }
    ];
});

function openItemMenu(event: MouseEvent, id: string) {
    headerContextMenuComponent.value?.close();
    openedItemMenuId.value = id;
    itemContextMenuComponent.value?.open(event);
}

function openHeaderMenu(event: MouseEvent) {
    openedItemMenuId.value = null;
    itemContextMenuComponent.value?.close();
    headerContextMenuComponent.value?.open(event);
}

function handleDelete(id: string) {
    emit('delete', id);
}

function handleSelect(id: string) {
    if (editingItemId.value) return;
    emit('select', id);
}

function startRename(id: string) {
    const item = props.items.find(i => i.id === id);
    if (!item) return;
    editingItemId.value = id;
    editingTitle.value = String(item.label || item.name || item.title || '');
    itemContextMenuComponent.value?.close();
}

function saveRename(id: string) {
    if (editingItemId.value !== id) return;

    const title = editingTitle.value.trim();
    editingItemId.value = null;

    if (!title) {
        editingTitle.value = '';
        return;
    }

    emit('rename', id, title);
    editingTitle.value = '';
}

function cancelRename() {
    editingItemId.value = null;
    editingTitle.value = '';
}

function onItemMenuClose() {
    openedItemMenuId.value = null;
}

function onHeaderMenuClose() {
    openedItemMenuId.value = null;
}
</script>

<style scoped>
.history-list-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
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

.history-header-actions {
    display: flex;
    align-items: center;
    gap: 0.15rem;
}

.history-header-menu-btn {
    width: 24px;
    height: 24px;
}

.history-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 0.5rem 0.5rem 0.4rem;
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
    padding: 0.1rem 0.45rem;
    border-radius: 5px;
    cursor: pointer;
}

.history-item:hover {
    background: color-mix(in srgb, var(--color-background-secondary) 84%, transparent);
    border-color: var(--color-surface-active);
}

.history-item.active {
    background: color-mix(in srgb, var(--color-primary) 18%, var(--color-surface));
    border-color: transparent;
    color: var(--color-text);
    box-shadow: none;
}

.history-item-content {
    flex: 1;
    padding: 0;
    border: none;
    border-radius: 0;
    color: var(--color-text);
    text-align: left;
    font-size: 0.8rem;
    transition: color 0.2s ease;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
}

.history-item-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
}

.history-item-title-input {
    flex: 1;
    min-width: 0;
    border: 1px solid var(--color-primary);
    border-radius: 4px;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 0.78rem;
    padding: 0.15rem 0.35rem;
}

.history-item-title-input:focus {
    outline: none;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 30%, transparent);
}

.history-item-count {
    font-size: 0.7rem;
    color: inherit;
    opacity: 0.75;
    flex-shrink: 0;
}

.history-item-actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
}

.history-item-menu-btn {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    opacity: 0.78;
}

.history-item:hover .history-item-menu-btn,
.history-item.active .history-item-menu-btn {
    opacity: 1;
}
</style>
