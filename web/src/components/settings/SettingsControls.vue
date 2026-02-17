<template>
    <div class="controls-wrapper">
        <IconButton icon="FileDown" @click="loadSettings" title="Load settings from file" />
        <IconButton icon="Save" @click="saveSettings" title="Save settings to file" />
        <IconButton icon="ListRestart" @click="resetSettings" title="Reset settings to default" />
    </div>
</template>

<script setup lang="ts">
import { showToastMessage } from '../../eda/utils';
import { useSettingsStore } from '../../stores/settings-store';
import IconButton from '../shared/IconButton.vue';
import { ref } from 'vue';

const settingsStore = useSettingsStore();
const fileInput = ref<HTMLInputElement | null>(null);

// Load settings from user-selected JSON file
const loadSettings = () => {
    if (!confirm('This will overwrite your current settings with data from the file. Continue?')) {
        return;
    }

    cleanupInput();

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';

    input.onchange = async (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];

        if (!file) {
            showToastMessage('No file selected.', 'error');
            cleanupInput();
            return;
        }

        // Security/validation: Check file size (<5MB) and type
        if (file.size > 5 * 1024 * 1024) {
            showToastMessage('File too large. Maximum size is 5MB.', 'error');
            cleanupInput();
            return;
        }

        if (!file.name.toLowerCase().endsWith('.json')) {
            showToastMessage('Invalid file type. Please select a JSON file.', 'error');
            cleanupInput();
            return;
        }

        try {
            const content = await file.text();
            const parsed = JSON.parse(content);

            // Optional: Validate structure if schema exists
            // if (!validateSettingsSchema(parsed)) throw new Error('Invalid settings structure');

            settingsStore.loadSettings(parsed); // Requires corresponding action in Pinia store
            settingsStore.saveSettings();

            showToastMessage('Settings loaded successfully!', 'success');
        } catch (error) {
            console.error('Settings load error:', error);
            showToastMessage(`Failed to load settings:\n${error instanceof Error ? error.message : 'Invalid JSON format'}`, 'error');
        } finally {
            cleanupInput();
        }
    };

    document.body.appendChild(input);
    fileInput.value = input;
    input.click();
};

// Save current settings to JSON file
const saveSettings = () => {
    try {
        // Use dedicated store getter for export-safe settings
        const exportData = settingsStore.getAllSettings;

        // Sanitize: Remove sensitive/internal properties if needed
        // delete exportData.internalToken;

        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `circuit-ai-settings-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();

        // Cleanup
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToastMessage('Settings saved successfully!', 'success');
    } catch (error) {
        console.error('Settings save error:', error);
        showToastMessage(`Failed to save settings:\n${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
};

// Reset confirmation (existing implementation)
const resetSettings = () => {
    if (confirm('Are you sure you want to reset all settings to default?')) {
        settingsStore.resetSettings();
        showToastMessage('Settings reset to default values.', 'success');
    }
};

// Helper: Clean up file input element
const cleanupInput = () => {
    if (fileInput.value) {
        document.body.removeChild(fileInput.value);
        fileInput.value = null;
    }
};

// Cleanup on component unmount
import { onUnmounted } from 'vue';
onUnmounted(cleanupInput);
</script>

<style scoped>
.controls-wrapper {
    display: flex;
    align-items: center;
    position: relative;
}
</style>