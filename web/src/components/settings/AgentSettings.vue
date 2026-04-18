<template>
    <div style="display: flex; flex-direction: row;">
        <label>{{ props.title }}</label>
        <div style="margin-left: auto;">
            <slot name="custom-header"></slot>
        </div>
    </div>

    <div class="setting-group">
        <div style="display: flex; align-items: center;">
            <label>{{ t('agentSettings.model') }}</label>
            <div style="margin-left: auto; display: flex; gap: 0.5rem; align-items: center;">
                <Icon v-if="props.modelFeatures?.includes('json')" name="CodeXml" :size="14"
                    :title="t('agentSettings.structuredOutput')" />
                <Icon v-if="props.modelFeatures?.includes('image')" name="Image" :size="14"
                    :title="t('agentSettings.imageVision')" />
                <Icon v-if="props.modelFeatures?.includes('tools')" name="Wrench" :size="14"
                    :title="t('agentSettings.tools')" />
            </div>
        </div>

        <ModelSelect :model-value="props.model" :provider="settingsStore.getSetting('apiProvider') as string"
            :api-key="settingsStore.getSetting('apiKey') as string"
            :base-url="settingsStore.getSetting('llmBaseUrl') as string"
            @update:llm-model="emits('modelChange', $event)" />
        <p class="hint">{{ props.desc }}</p>
    </div>

    <div class="setting-group">
        <label>{{ t('agentSettings.reasoningEffort') }}</label>
        <CustomSelect :model-value="reasoning" @update:model-value="emits('reasoningChange', $event)" :options="[{ label: t('agentSettings.minimal'), value: 'minimal' }, { label: t('agentSettings.low'), value: 'low' },
        { label: t('agentSettings.medium'), value: 'medium' }, { label: t('agentSettings.high'), value: 'high' }]" />
    </div>

    <slot name="custom-settings"></slot>
</template>


<script setup lang="ts">
import { useSettingsStore } from '../../stores/settings-store';
import CustomSelect from '../shared/CustomSelect.vue';
import Icon from '../shared/Icon.vue';
import ModelSelect from './ModelSelect.vue';
import { t } from '../../i18n';

const settingsStore = useSettingsStore();

const props = defineProps<{
    title: string,
    model: string,
    desc: string,
    reasoning: string,
    modelFeatures?: ('image' | 'tools' | 'json')[]
}>();

const emits = defineEmits<{
    modelChange: [string],
    reasoningChange: [string]
}>();

</script>

<style scoped>
@import url("./shared.css");

label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--color-text);
    font-size: 1.1rem;
}
</style>
