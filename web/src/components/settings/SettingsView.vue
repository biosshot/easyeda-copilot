<template>
    <div class="settings-view-container">
        <div class="settings-view">
            <h1>Settings</h1>

            <!-- Dynamically generated sections -->
            <div v-for="section in settingsSections" :key="section.title" class="settings-section">
                <h2>{{ section.title }}</h2>
                <p v-if="section.description" class="section-description">{{ section.description }}</p>

                <!-- Dynamically generated settings -->
                <div v-for="setting in section.settings" :key="setting.key" class="setting-group">
                    <label :for="setting.key">{{ setting.label }}</label>

                    <!-- Text Input -->
                    <input v-if="setting.type === 'text' || setting.type === 'password'" :id="setting.key"
                        :value="settings[setting.key]" :type="setting.type" :placeholder="setting.placeholder"
                        @change="onSettingChange(setting.key, ($event.target as any).value as string)" />

                    <!-- Select Input -->
                    <CustomSelect v-else-if="setting.type === 'select'" :id="setting.key"
                        :model-value="settings[setting.key] as string" :options="setting.options"
                        @update:model-value="onSettingChange(setting.key, $event)" />

                    <!-- Checkbox Input -->
                    <input v-else-if="setting.type === 'checkbox'" :id="setting.key" type="checkbox"
                        :checked="settings[setting.key] as boolean"
                        @change="onSettingChange(setting.key, ($event.target as any).checked as boolean)" />

                    <p v-if="setting.hint" class="hint">{{ setting.hint }}</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { useSettingsStore } from '../../stores/settings-store';
import CustomSelect from '../shared/CustomSelect.vue';
import { showToastMessage } from '../../eda/utils';

const settingsStore = useSettingsStore();
const settingsSections = settingsStore.getSettingsSections;

const settings = computed(() => {
    return settingsStore.getAllSettings;
});

onMounted(() => {
    settingsStore.initSettings();
    Object.assign(settings, settingsStore.getAllSettings);
});

const onSettingChange = (key: string, value: string | number | boolean) => {
    settingsStore.setSetting(key, value);
    showToastMessage('Settings saved', 'success');
};
</script>

<style scoped>
.settings-view-container {
    padding: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
    box-sizing: border-box;
    position: relative;
    overflow: auto;
}

.settings-view {
    padding: 2rem;
}

h1 {
    margin: 0 0 2rem 0;
    font-size: 1.8rem;
    color: var(--color-text-secondary);
    text-align: center;
}

h2 {
    margin: 0 0 1.5rem 0;
    font-size: 1.2rem;
    color: var(--color-text);
    border-bottom: 2px solid var(--color-border);
    padding-bottom: 0.75rem;
}

.section-description {
    margin: 0 0 1.5rem 0;
    font-size: 0.9rem;
    color: var(--color-text-tertiary);
}

.settings-section {
    margin-bottom: 2rem;
}

.setting-group {
    margin-bottom: 1.5rem;
}

.setting-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--color-text);
    font-size: 0.95rem;
}

.setting-group input {
    width: 100%;
    padding: 0.75rem;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text);
    font-size: 0.9rem;
    transition: border-color 0.2s;
    box-sizing: border-box;
}

.setting-group input[type='checkbox'] {
    width: auto;
    cursor: pointer;
}

.setting-group input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(16, 163, 127, 0.1);
}

.setting-group input::placeholder {
    color: var(--color-text-muted);
}

.hint {
    margin: 0.5rem 0 0 0;
    font-size: 0.8rem;
    color: var(--color-text-tertiary);
}

.button-group {
    display: flex;
    gap: 1rem;
    margin-top: 2rem;
    margin-bottom: 1rem;
}

.btn-primary,
.btn-secondary {
    flex: 1;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-primary {
    background: var(--color-primary);
    color: var(--color-text-on-primary);
}

.btn-primary:hover {
    background: var(--color-primary-dark);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 163, 127, 0.4);
}

.btn-primary:active {
    transform: translateY(0);
}

.btn-secondary {
    background: var(--color-surface-hover);
    color: var(--color-text);
}

.btn-secondary:hover {
    background: var(--color-surface-active);
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
