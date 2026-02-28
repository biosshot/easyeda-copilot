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
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
</style>
