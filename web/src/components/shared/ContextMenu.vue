<template>
    <div v-if="show" class="context-menu" :style="{ left: x + 'px', top: y + 'px' }">
        <template v-for="(item, index) in items" :key="index">
            <div v-if="item.divider" class="context-menu-divider"></div>
            <div v-else class="context-menu-item" :class="{ danger: item.danger }" @click="handleClick(item)">
                <Icon v-if="item.icon" :name="item.icon" :size="14" />
                {{ item.label }}
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import Icon from './Icon.vue'

export interface ContextMenuItem {
    label?: string
    icon?: string
    danger?: boolean
    divider?: boolean
    click?: () => void
}

interface Props {
    show: boolean
    x: number
    y: number
    items: ContextMenuItem[]
}

defineProps<Props>()

const emit = defineEmits<{
    close: []
}>()

const handleClick = (item: ContextMenuItem) => {
    item.click?.()
    emit('close')
}
</script>

<style scoped>
.context-menu {
    position: fixed;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 180px;
    z-index: 2000;
    padding: 4px;
    font-size: 13px;
}

.context-menu-item {
    display: flex;
    align-items: center;
    cursor: pointer;
    color: var(--color-text);
    transition: all 0.2s;
    border-radius: 4px;
}

.context-menu-item:hover {
    background: var(--color-surface-hover);
    color: var(--color-primary);
}

.context-menu-item.danger:hover {
    background: var(--color-error);
    color: var(--color-white);
}

.context-menu-divider {
    height: 1px;
    background: var(--color-border-light);
    margin: 4px 0;
}
</style>
