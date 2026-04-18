<template>
    <div class="settings-view-container">
        <div class="settings-view">
            <div style="margin-bottom: 1rem;">
                <ErrorBanner v-if="showWebSearchWarn" type="warn"
                    :message="t('settings.webSearchWarn')">
                </ErrorBanner>
            </div>
            <!-- LLM API Configuration Section -->
            <div class="settings-section">
                <h2>{{ t('settings.llmApiConfig') }}</h2>
                <p class="section-description">{{ t('settings.llmApiConfigDesc') }}</p>

                <!-- API Provider -->
                <div class="setting-group">
                    <label for="apiProvider">{{ t('settings.apiProvider') }}</label>
                    <CustomSelect id="apiProvider" :value="settings.apiProvider"
                        :model-value="String(settings['apiProvider'])" :options="[
                            { label: 'OpenAI', value: 'openai' },
                            { label: 'OpenRouter', value: 'openrouter' },
                            { label: 'Anthropic', value: 'anthropic' },
                            { label: 'DeepSeek', value: 'deepseek' },
                            { label: 'Ollama (cloud)', value: 'ollamacloud' },
                            { label: 'ZAI', value: 'zai' },
                            { label: 'Moonshot (Kimi)', value: 'kimi' },
                            { label: 'Local (Beta)', value: 'local' },
                        ]" @update:model-value="onSettingChange('apiProvider', $event)" />
                    <p class="hint">{{ t('settings.apiProviderHint') }} <br>
                        <strong>{{ t('settings.apiProviderHintExtra') }}</strong>
                    </p>
                </div>

                <!-- API Key -->
                <div class="setting-group">
                    <label for="apiKey">{{ t('settings.apiKey') }}</label>
                    <input id="apiKey" :value="settings.apiKey" type="text" :placeholder="t('settings.apiKeyPlaceholder')"
                        @input="onSettingInput('apiKey', ($event.target as HTMLInputElement).value)" />
                    <p class="hint">{{ t('settings.apiKeyHint') }}</p>
                </div>

                <Collapsible :title="t('settings.advanced')" :default-open="true">
                    <div class="setting-group">
                        <label for="llmBaseUrl">{{ t('settings.baseUrl') }}</label>
                        <input id="llmBaseUrl" :value="settings.llmBaseUrl" type="text"
                            placeholder="https://api.example.com/v1"
                            @input="onSettingInput('llmBaseUrl', ($event.target as HTMLInputElement).value)" />
                        <p class="hint">{{ t('settings.baseUrlHint') }}</p>
                    </div>

                    <div class="setting-group">
                        <label for="tavilyApiKey">{{ t('settings.tavilyApiKey') }}</label>
                        <input id="tavilyApiKey" :value="settings.tavilyApiKey" type="text" :placeholder="t('settings.tavilyApiKey')"
                            @input="onSettingInput('tavilyApiKey', ($event.target as HTMLInputElement).value)" />
                        <p class="hint">{{ t('settings.tavilyApiKeyHint') }}</p>
                    </div>

                    <div class="setting-group">
                        <label for="maxToolParallel">{{ t('settings.maxToolParallel') }}</label>
                        <input id="maxToolParallel" :value="settings.maxToolParallel" type="number" min="1" max="10"
                            placeholder="3"
                            @change="onSettingChange('maxToolParallel', Math.max(1, Math.min(25, Number(($event.target as HTMLInputElement).value))))" />
                        <p class="hint">{{ t('settings.maxToolParallelHint') }}</p>
                    </div>

                    <div class="setting-group">
                        <label for="maxToolParallel">{{ t('settings.contextManagement') }}</label>
                        <ContextManagementSettings :settings="settings"
                            @setting-change="(key, value) => onSettingChange(key, value)" />
                    </div>
                </Collapsible>

                <Collapsible :title="t('settings.agents')" :default-open="true">

                    <p class="hint" style="margin-bottom: 1rem;">
                        {{ t('settings.agentsDesc') }} <br>
                        <strong>{{ t('settings.agentsWarning') }}</strong>
                    </p>

                    <AgentSettings :title="t('settings.baseAgent')" :model="settings.agentBaseModel as string"
                        :reasoning="settings.agentBaseReasoning as string"
                        @reasoning-change="onSettingChange('agentBaseReasoning', $event)"
                        @model-change="onSettingChange('agentBaseModel', $event)"
                        :model-features="['json', 'tools', 'image']"
                        :desc="t('settings.baseAgentDesc')">

                        <template #custom-header>
                            <button @click="applyBaseAgentToAll" class="apply-to-all-btn"
                                :title="t('settings.applyToAll')">
                                {{ t('settings.applyToAll') }}
                            </button>
                        </template>
                    </AgentSettings>

                    <!-- Specialized Agent Configurations -->
                    <Collapsible :title="t('settings.blockDiagram')" :default-open="false">
                        <AgentSettings :title="t('settings.blockDiagram')" :model="settings.agentBlockDiagramModel as string"
                            :reasoning="settings.agentBlockDiagramReasoning as string"
                            @reasoning-change="onSettingChange('agentBlockDiagramReasoning', $event)"
                            @model-change="onSettingChange('agentBlockDiagramModel', $event)"
                            :model-features="['tools', 'json']"
                            :desc="t('settings.blockDiagramDesc')">
                        </AgentSettings>
                    </Collapsible>

                    <Collapsible :title="t('nav.chat')" :default-open="false">
                        <AgentSettings :title="t('nav.chat')" :model="settings.agentChatModel as string"
                            @model-change="onSettingChange('agentChatModel', $event)"
                            :reasoning="settings.agentChatReasoning as string" :model-features="['tools']"
                            @reasoning-change="onSettingChange('agentChatReasoning', $event)"
                            :desc="t('settings.chatDesc')">
                        </AgentSettings>
                    </Collapsible>

                    <Collapsible :title="t('settings.circuitExplainer')" :default-open="false">
                        <AgentSettings :title="t('settings.circuitExplainer')" :model="settings.agentCircuitExplainerModel as string"
                            @model-change="onSettingChange('agentCircuitExplainerModel', $event)"
                            :reasoning="settings.agentCircuitExplainerReasoning as string"
                            @reasoning-change="onSettingChange('agentCircuitExplainerReasoning', $event)"
                            :desc="t('settings.circuitExplainerDesc')">

                            <template #custom-settings>
                                <div class="setting-group">
                                    <label for="agentCircuitExplainerUseSpice">
                                        <input id="agentCircuitExplainerUseSpice" type="checkbox"
                                            :checked="settings.agentCircuitExplainerUseSpice as boolean"
                                            @change="onSettingChange('agentCircuitExplainerUseSpice', ($event.target as HTMLInputElement).checked)" />
                                        {{ t('settings.addSpiceTool') }}
                                    </label>

                                    <p class="hint">{{ t('settings.addSpiceToolHint') }}</p>
                                </div>
                            </template>
                        </AgentSettings>
                    </Collapsible>

                    <Collapsible :title="t('settings.circuitMaker')" :default-open="false">
                        <AgentSettings :title="t('settings.circuitMaker')" :model="settings.agentCircuitMakerModel as string"
                            @model-change="onSettingChange('agentCircuitMakerModel', $event)"
                            :reasoning="settings.agentCircuitMakerReasoning as string"
                            @reasoning-change="onSettingChange('agentCircuitMakerReasoning', $event)"
                            :model-features="['tools', 'json']"
                            :desc="t('settings.circuitMakerDesc')">
                        </AgentSettings>
                    </Collapsible>

                    <Collapsible :title="t('nav.completions')" :default-open="false">
                        <AgentSettings :title="t('nav.completions')" :model="settings.agentCompletionsModel as string"
                            @model-change="onSettingChange('agentCompletionsModel', $event)"
                            :reasoning="settings.agentCompletionsReasoning as string"
                            @reasoning-change="onSettingChange('agentCompletionsReasoning', $event)"
                            :model-features="['tools', 'json']" :desc="t('settings.completionsDesc')">
                        </AgentSettings>
                    </Collapsible>

                    <Collapsible :title="t('settings.listCompletions')" :default-open="false">
                        <AgentSettings :title="t('nav.completions')" :model="settings.agentListCompletionsModel as string"
                            @model-change="onSettingChange('agentListCompletionsModel', $event)"
                            :reasoning="settings.agentListCompletionsReasoning as string" :model-features="['json']"
                            @reasoning-change="onSettingChange('agentListCompletionsReasoning', $event)"
                            :desc="t('settings.listCompletionsDesc')">
                        </AgentSettings>
                    </Collapsible>


                    <Collapsible :title="t('settings.diagnosticAlgorithms')" :default-open="false">
                        <AgentSettings :title="t('settings.diagnosticAlgorithms')"
                            :model="settings.agentDiagnosticAlgorithmModel as string"
                            :model-features="['tools', 'json']"
                            @model-change="onSettingChange('agentDiagnosticAlgorithmModel', $event)"
                            :reasoning="settings.agentDiagnosticAlgorithmReasoning as string"
                            @reasoning-change="onSettingChange('agentDiagnosticAlgorithmReasoning', $event)"
                            :desc="t('settings.diagnosticAlgorithmsDesc')">
                        </AgentSettings>
                    </Collapsible>

                    <Collapsible :title="t('settings.pinDescriptions')" :default-open="false">
                        <AgentSettings :title="t('settings.pinDescriptions')" :model="settings.agentPinDescriptionModel as string"
                            @model-change="onSettingChange('agentPinDescriptionModel', $event)"
                            :reasoning="settings.agentPinDescriptionReasoning as string"
                            :model-features="['json', 'image']"
                            @reasoning-change="onSettingChange('agentPinDescriptionReasoning', $event)"
                            :desc="t('settings.pinDescriptionsDesc')">
                        </AgentSettings>
                    </Collapsible>

                    <Collapsible :title="t('settings.lcscSearch')" :default-open="false">
                        <AgentSettings :title="t('settings.lcscSearch')" :model="settings.agentLcscSearchModel as string"
                            @model-change="onSettingChange('agentLcscSearchModel', $event)"
                            :reasoning="settings.agentLcscSearchReasoning as string" :model-features="['json', 'tools']"
                            @reasoning-change="onSettingChange('agentLcscSearchReasoning', $event)"
                            :desc="t('settings.lcscSearchDesc')">

                            <template #custom-settings>
                                <div class="setting-group">
                                    <label for="agentLcscSearchUsePrefetch">
                                        <input id="agentLcscSearchUsePrefetch" type="checkbox"
                                            :checked="settings.agentLcscSearchUsePrefetch as boolean"
                                            @change="onSettingChange('agentLcscSearchUsePrefetch', ($event.target as HTMLInputElement).checked)" />
                                        {{ t('settings.prefetchWebSearch') }}
                                    </label>
                                </div>
                            </template>
                        </AgentSettings>
                    </Collapsible>

                    <Collapsible :title="t('settings.lcscCatalog')" :default-open="false">
                        <AgentSettings :title="t('settings.lcscCatalog')" :model="settings.agentLcscCatalogModel as string"
                            @model-change="onSettingChange('agentLcscCatalogModel', $event)"
                            :reasoning="settings.agentLcscCatalogReasoning as string" :model-features="['json']"
                            @reasoning-change="onSettingChange('agentLcscCatalogReasoning', $event)"
                            :desc="t('settings.lcscCatalogDesc')">
                        </AgentSettings>
                    </Collapsible>
                </Collapsible>

            </div>

            <!-- Theme Section (остается без изменений) -->
            <div class="settings-section">
                <h2>{{ t('settings.theme') }}</h2>
                <p class="section-description">{{ t('settings.themeDesc') }}</p>

                <!-- Theme Select -->
                <div class="setting-group">
                    <label for="theme">{{ t('settings.theme') }}</label>

                    <CustomSelect id="theme" :value="settings.theme" :model-value="String(settings['theme'])" :options="[
                        { label: 'Dark', value: 'dark' },
                        { label: 'Light', value: 'light' },
                    ]" @update:model-value="onSettingChange('theme', $event)" />

                    <p class="hint">{{ t('settings.selectTheme') }}</p>
                </div>

                <!-- Show Inline Buttons -->
                <div class="setting-group">
                    <label for="showInlineButtons">
                        <input id="showInlineButtons" type="checkbox" :checked="settings.showInlineButtons as boolean"
                            @change="onSettingChange('showInlineButtons', ($event.target as HTMLInputElement).checked)" />
                        {{ t('settings.showInlineButtons') }}
                    </label>
                    <p class="hint">{{ t('settings.showInlineButtonsDesc') }}</p>
                </div>

                <!-- Language Select -->
                <div class="setting-group">
                    <label for="language">{{ t('settings.language') }}</label>
                    <CustomSelect id="language" :value="(settings.language as string) || ''"
                        :model-value="String(settings.language || '')"
                        :options="[
                            { label: 'Auto', value: '' },
                            ...Object.entries(localeLabels).map(([value, label]) => ({ label, value }))
                        ]"
                        @update:model-value="onLanguageChange($event)" />
                    <p class="hint">{{ t('settings.languageHint') }}</p>
                </div>
            </div>

            <div class="settings-section">
                <h2>{{ t('settings.circuitAssembly') }}</h2>

                <div class="setting-group">
                    <label for="assembleDrawRects">
                        <input id="assembleDrawRects" type="checkbox" :checked="Boolean(settings.assembleDrawRects)"
                            @change="onSettingChange('assembleDrawRects', ($event.target as HTMLInputElement).checked)" />
                        {{ t('settings.drawStructuralBlocks') }}
                    </label>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useSettingsStore } from '../../stores/settings-store';
import { showToastMessage } from '../../eda/utils';
import { startRelay, stopRelay } from '../../api/relay';
import CustomSelect from '../shared/CustomSelect.vue';
import Collapsible from '../shared/Collapsible.vue';
import AgentSettings from './AgentSettings.vue';
import ErrorBanner from '../shared/ErrorBanner.vue';
import ContextManagementSettings from './ContextManagementSettings.vue';
import { t, setLocale, localeLabels, type Locale } from '../../i18n';

const settingsStore = useSettingsStore();
const settings = computed(() => settingsStore.getAllSettings);

// Relay status
const relayConnected = ref(false);
const relayError = ref<string | null>(null);

watch(() => settingsStore.getSetting('apiProvider') as string, (provider) => {
    if (provider === 'local') {
        startRelay();
    } else {
        stopRelay();
        relayConnected.value = false;
        relayError.value = null;
    }
});

const showWebSearchWarn = computed(() =>
    !settingsStore.getSetting('tavilyApiKey') &&
    !(((settingsStore.getSetting('apiProvider') as string) === 'openai' || (settingsStore.getSetting('apiProvider') as string) === 'anthropic') && !settingsStore.getSetting('llmBaseUrl'))
)

// Дебаунс для текстовых полей
let saveTimeout: number | null = null;

const onSettingInput = (key: string, value: string) => {
    settingsStore.setSetting(key, value);
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = window.setTimeout(() => {
        settingsStore.saveSettings();
        showToastMessage(t('settings.settingsSaved'), 'success');
    }, 1000);
};

const onSettingChange = (key: string, value: string | boolean | number) => {
    settingsStore.setSetting(key, value);
    showToastMessage(t('settings.settingsSaved'), 'success');
};

const onLanguageChange = (value: string) => {
    settingsStore.setSetting('language', value);
    setLocale(value as Locale);
    showToastMessage(t('settings.settingsSaved'), 'success');
};

const applyBaseAgentToAll = () => {
    const baseModel = settingsStore.getSetting('agentBaseModel') as string;
    const baseReasoning = settingsStore.getSetting('agentBaseReasoning') as string;

    const agentKeys: string[] = [
        'agentBlockDiagramModel',
        'agentBlockDiagramReasoning',
        'agentChatModel',
        'agentChatReasoning',
        'agentCircuitExplainerModel',
        'agentCircuitExplainerReasoning',
        'agentCircuitMakerModel',
        'agentCircuitMakerReasoning',
        'agentCompletionsModel',
        'agentCompletionsReasoning',
        'agentListCompletionsModel',
        'agentListCompletionsReasoning',
        'agentDiagnosticAlgorithmModel',
        'agentDiagnosticAlgorithmReasoning',
        'agentPinDescriptionModel',
        'agentPinDescriptionReasoning',
        'agentLcscSearchModel',
        'agentLcscSearchReasoning',
        'agentLcscCatalogModel',
        'agentLcscCatalogReasoning'
    ];

    agentKeys.forEach(key => {
        if (key.endsWith('Model')) {
            settingsStore.setSetting(key, baseModel);
        } else {
            settingsStore.setSetting(key, baseReasoning);
        }
    });

    showToastMessage(t('settings.appliedBaseModel'), 'success');
};

onMounted(() => {
    settingsStore.loadSettings();
});
</script>

<style scoped>
@import url("./shared.css");

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

.apply-to-all-btn {
    padding: 0.3rem 0.6rem;
    font-size: 0.65rem;
    background-color: var(--color-primary);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: var(--color-text-on-primary);
}

.relay-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
    background: var(--color-bg-secondary, #f0f0f0);
}

.relay-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
}

.relay-status--connected .relay-status-dot {
    background: #4caf50;
}

.relay-status--disconnected .relay-status-dot {
    background: #9e9e9e;
}

.relay-status--error .relay-status-dot {
    background: #f44336;
}

.relay-status--connected {
    color: #4caf50;
}

.relay-status--error {
    color: #f44336;
}
</style>