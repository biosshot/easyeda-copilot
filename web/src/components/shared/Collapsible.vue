<template>
    <div class="collapsible-section">
        <div class="collapsible-header" @click="isOpen = !isOpen">
            <span>{{ props.title }}</span>
            <icon class="arrow" name="ChevronUp" size="16" :class="{ 'rotated': isOpen }" />
        </div>
        <div v-show="isOpen" class="collapsible-content">
            <slot></slot>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Icon from '../shared/Icon.vue';

const props = defineProps<{ title: string, defaultOpen?: boolean }>();
const isOpen = ref(props.defaultOpen ?? false);

</script>

<style scoped>
.collapsible-section {
    margin-top: 0.35rem;
    margin-bottom: 0.35rem;

    border-radius: 8px;
    /* border: 1px solid var(--color-border); */
}

.collapsible-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    font-weight: 600;
    color: var(--color-text);
    transition: background-color 0.2s;
}

.arrow {
    font-size: 0.9rem;
    transition: transform 0.3s ease;
    transform: rotate(90deg);
}

.arrow.rotated {
    transform: rotate(180deg);
}

.collapsible-content {
    padding: 0 0;
    padding-top: 0.5rem;
    padding-left: 0.4rem;
    border-left: 2px solid var(--color-border);
}

/* Анимация сворачивания */
.collapse-enter-active,
.collapse-leave-active {
    transition: max-height 0.35s ease, opacity 0.35s ease;
    overflow: hidden;
}

.collapse-enter,
.collapse-leave-to {
    max-height: 0;
    opacity: 0;
    padding-top: 0;
    padding-bottom: 0;
}

.collapse-enter-to,
.collapse-leave {
    max-height: 500px;
    /* Достаточно для всех полей */
    opacity: 1;
}

/* Адаптация отступов для вложенных групп */
.collapsible-content .setting-group {
    margin-bottom: 1.25rem;
}

.collapsible-content .setting-group:last-child {
    margin-bottom: 0;
}
</style>