<template>
    <div v-if="show" ref="menuRef" class="context-menu" :style="{ left: x + 'px', top: y + 'px' }">
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
import { nextTick, onUnmounted, ref } from 'vue'
import Icon from './Icon.vue'
import { onMounted } from 'vue'
import { MouseTouchEvent } from '@vue-flow/core'

export interface ContextMenuItem {
    label?: string
    icon?: string
    danger?: boolean
    divider?: boolean
    click?: () => void
}

interface Props {
    items: ContextMenuItem[]
}

const props = defineProps<Props>()

const show = ref<boolean>(false);
const x = ref<number>(0);
const y = ref<number>(0);
const menuRef = ref<HTMLElement | null>(null);

const emit = defineEmits<{
    close: []
}>()

const handleClick = (item: ContextMenuItem) => {
    item.click?.()
    close()
}

const close = () => {
    if (!show.value) return;
    show.value = false;
    emit('close')
}

const handlePointerDownOutside = (event: PointerEvent) => {
    if (!show.value) return;

    const target = event.target as Node | null;
    if (!target) return;

    if (menuRef.value?.contains(target)) return;
    close();
}

defineExpose({
    open: async (event: any) => {
        const viewportPadding = 8;
        const clientX = typeof event?.clientX === 'number' ? event.clientX : viewportPadding;
        const clientY = typeof event?.clientY === 'number' ? event.clientY : viewportPadding;

        x.value = clientX;
        y.value = clientY;
        show.value = true;

        await nextTick();

        const menuEl = menuRef.value;
        if (!menuEl) return;

        const menuWidth = menuEl.offsetWidth;
        const menuHeight = menuEl.offsetHeight;

        const maxX = window.innerWidth - menuWidth - viewportPadding;
        const maxY = window.innerHeight - menuHeight - viewportPadding;

        x.value = Math.max(viewportPadding, Math.min(clientX, maxX));
        y.value = Math.max(viewportPadding, Math.min(clientY, maxY));
    },

    close
})

onMounted(() => {
    window.addEventListener('pointerdown', handlePointerDownOutside, true);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
})

onUnmounted(() => {
    window.removeEventListener('pointerdown', handlePointerDownOutside, true);
    window.removeEventListener('click', close);
    window.removeEventListener('scroll', close, true);
    window.removeEventListener('resize', close);
})
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
    height: 25px;
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
