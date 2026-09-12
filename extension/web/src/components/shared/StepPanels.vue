<template>
    <div class="stepper__panels">
        <slot></slot>
    </div>
</template>

<script setup lang="ts">
// StepPanels - контейнер для компонентов StepPanel
</script>

<style scoped>
.stepper__panels {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 0;
    flex-grow: 1;
}
</style>
