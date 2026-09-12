<template>
    <button :class="[`is-${props.variant}`]">
        <Icon :name="props.icon" :size="props.size ?? 14" />
        <slot></slot>
    </button>
</template>

<script setup lang="ts">
import Icon from './Icon.vue';

interface Props {
    icon: string,
    size?: number,
    variant?: 'primary' | 'ghost' | 'remove' | 'cancel';
}

const props = withDefaults(defineProps<Props>(), {
    variant: 'ghost'
});

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
}

button:disabled {
    opacity: 0.5;
    cursor: unset;
}

.is-primary {
    background-color: var(--color-primary);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: var(--color-text-on-primary);
    padding: 0.2rem 0.8rem 0.2rem 0.5rem;
}

button:hover:not(:disabled) {
    opacity: 0.94;
}

.is-remove {
    color: var(--color-text-muted);
}

.is-remove:hover:not(:disabled) {
    color: var(--color-error);
}

.is-cancel {
    border: none;
    font-weight: 500;
    font-size: 0.9rem;
    background: var(--color-error);
    color: white;
    padding: 6px 16px 6px 10px;
}

.is-primary:hover:not(:disabled) {
    background-color: var(--color-primary-light);
}

.is-primary:active {
    background-color: var(--color-primary-dark);
}
</style>