<template>
    <button>
        <Icon :name="props.icon" :size="props.size ?? 14" />
        <slot></slot>
    </button>
</template>

<script setup lang="ts">
import Icon from './Icon.vue';

const props = defineProps<{ icon: string, size?: number }>();

</script>

<style scoped>
button {
    background-color: transparent;
    border: none;
    border-radius: 4px;
    color: var(--color-text-on-surface);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 0.2rem 0.8rem 0.2rem 0.5rem;
}
</style>