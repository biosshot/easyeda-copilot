<template>
    <div class="controls-wrapper">
        <IconButton icon="ListRestart" @click="resetSettings" title="Reset settings to default" />
    </div>
</template>

<script setup lang="ts">

import { useSettingsStore } from '../stores/settingsStore';
import IconButton from './IconButton.vue';

const settingsStore = useSettingsStore();

const resetSettings = () => {
    if (confirm('Are you sure you want to reset all settings to default?')) {
        settingsStore.resetSettings();
    }
};

</script>

<style scoped>
.controls-wrapper {
    display: flex;
    gap: 0.25rem;
    align-items: center;
    position: relative;
}
</style>
