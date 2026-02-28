<template>
    <div class="stepper__list">
        <slot></slot>
    </div>
</template>

<script setup lang="ts">
// StepList - контейнер для компонентов Step
</script>

<style scoped>
.stepper__list {
    display: flex;
    justify-content: center;
    padding: 1.5rem 1rem;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-background);
}
</style>
