<template>
    <button>
        <Icon :name="props.icon" size="14" />
        <slot></slot>
    </button>
</template>

<script setup lang="ts">
import Icon from './Icon.vue';

const props = defineProps({
    icon: {
        type: String,
        required: true
    }
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
</style>