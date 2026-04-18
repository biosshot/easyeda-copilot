<template>
    <div class="setting-group">
        <label for="contextManagementMode">{{ t('contextManagement.mode') }}</label>
        <CustomSelect id="contextManagementMode" :model-value="String(settings['contextManagementMode'])" :options="[
            { label: t('contextManagement.disable'), value: 'disable' },
            { label: t('contextManagement.summarization'), value: 'summarize' },
            { label: t('contextManagement.trimming'), value: 'trim' },
        ]" @update:model-value="onChange('contextManagementMode', $event)" />
    </div>

    <template v-if="String(settings['contextManagementMode']) === 'summarize'">
        <div class="setting-group">
            <label for="contextSummarizeKeepLastMessages">{{ t('contextManagement.keepLastMessages') }}</label>
            <input id="contextSummarizeKeepLastMessages" :value="Number(settings['contextSummarizeKeepLastMessages'])"
                type="number" min="1" max="64"
                @change="onChange('contextSummarizeKeepLastMessages', ($event.target as HTMLInputElement).value)" />
            <p class="hint">{{ t('contextManagement.keepLastMessagesHint') }}</p>
        </div>

        <div class="setting-group">
            <label for="contextSummarizeThreshold">{{ t('contextManagement.summarizeThreshold') }}</label>
            <input id="contextSummarizeThreshold" :value="Number(settings['contextSummarizeThreshold'])" type="number"
                min="2" max="256"
                @change="onChange('contextSummarizeThreshold', ($event.target as HTMLInputElement).value)" />
            <p class="hint">{{ t('contextManagement.summarizeThresholdHint') }}</p>
        </div>
    </template>

    <template v-else-if="String(settings['contextManagementMode']) === 'trim'">
        <div class="setting-group">
            <label for="contextTrimThreshold">{{ t('contextManagement.trimThreshold') }}</label>
            <input id="contextTrimThreshold" :value="Number(settings['contextTrimThreshold'])" type="number" min="1"
                max="256" @change="onChange('contextTrimThreshold', ($event.target as HTMLInputElement).value)" />
            <p class="hint">{{ t('contextManagement.trimThresholdHint') }}</p>
        </div>

        <div class="setting-group">
            <label for="contextSaveFirstMessages">{{ t('contextManagement.saveFirstMessages') }}</label>
            <input id="contextSaveFirstMessages" :value="Number(settings['contextSaveFirstMessages'])" type="number"
                min="2" max="256"
                @change="onChange('contextSaveFirstMessages', ($event.target as HTMLInputElement).value)" />
            <p class="hint">{{ t('contextManagement.saveFirstMessagesHint') }}</p>
        </div>
    </template>

    <div class="setting-group">
        <label for="contextMaxNumberAttachedCircuit">{{ t('contextManagement.maxAttachedCircuit') }}</label>
        <input id="contextMaxNumberAttachedCircuit" :value="Number(settings['contextMaxNumberAttachedCircuit'])"
            type="number" min="1" max="256"
            @change="onChange('contextMaxNumberAttachedCircuit', clampInt(($event.target as HTMLInputElement).value, 0, Infinity))" />
        <p class="hint">{{ t('contextManagement.maxAttachedCircuitHint') }}</p>
    </div>
</template>

<script setup lang="ts">
import CustomSelect from '../shared/CustomSelect.vue';
import { t } from '../../i18n';

type SettingsLike = Record<string, string | number | boolean>;

const props = defineProps<{
    settings: SettingsLike;
}>();

const emit = defineEmits<{
    settingChange: [key: string, value: string | number | boolean];
}>();

const clampInt = (value: string, min: number, max: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return min;
    return Math.max(min, Math.min(max, Math.floor(parsed)));
};

const onChange = (key: string, value: string | number | boolean) => {
    emit('settingChange', key, value);
};
</script>

<style scoped>
@import url("./shared.css");

.context-management-settings {
    margin-top: 1rem;
}

h3 {
    margin: 0 0 0.5rem 0;
    color: var(--color-text);
}
</style>