<template>
    <div class="settings-view-container">
        <div class="settings-view">
            <div style="margin-bottom: 1rem;">
                <ErrorBanner v-if="showWebSearchWarn" type="warn"
                    message='Web search may not work because the "Tavily API Key" is not specified and the provider does not support native web search.'>
                </ErrorBanner>
            </div>
            <!-- LLM API Configuration Section -->
            <div class="settings-section">
                <h2>LLM API Configuration</h2>
                <p class="section-description">Configure your LLM API provider and credentials</p>

                <!-- API Provider -->
                <div class="setting-group">
                    <label for="apiProvider">API Provider</label>
                    <CustomSelect id="apiProvider" :value="settings.apiProvider"
                        :model-value="String(settings['apiProvider'])" :options="[
                            { label: 'OpenAI', value: 'openai' },
                            { label: 'OpenRouter', value: 'openrouter' },
                            { label: 'Anthropic', value: 'anthropic' },
                            { label: 'DeepSeek', value: 'deepseek' },
                            { label: 'Ollama (cloud)', value: 'ollamacloud' },
                            { label: 'ZAI', value: 'zai' },
                            { label: 'Moonshot (Kimi)', value: 'kimi' },
                            { label: 'Local', value: 'local' },
                        ]" @update:model-value="onSettingChange('apiProvider', $event)" />
                    <p class="hint">Select your preferred LLM provider. <br>
                        <strong> If the provider you need is not listed here, openai compatible api url in a field "Base
                            URL"</strong>
                    </p>
                </div>

                <!-- API Key -->
                <div class="setting-group">
                    <label for="apiKey">API Key</label>
                    <input id="apiKey" :value="settings.apiKey" type="text" placeholder="Enter your API key"
                        @input="onSettingInput('apiKey', ($event.target as HTMLInputElement).value)" />
                    <p class="hint">Your API key will be saved locally in browser storage</p>
                </div>

                <Collapsible title="Advenced" :default-open="true">
                    <div class="setting-group">
                        <label for="llmBaseUrl">Base URL</label>
                        <input id="llmBaseUrl" :value="settings.llmBaseUrl" type="text"
                            placeholder="https://api.example.com/v1"
                            @input="onSettingInput('llmBaseUrl', ($event.target as HTMLInputElement).value)" />
                        <p class="hint">Override default API endpoint. Leave empty for provider defaults</p>
                    </div>

                    <div class="setting-group">
                        <label for="tavilyApiKey">Tavily Api Key</label>
                        <input id="tavilyApiKey" :value="settings.tavilyApiKey" type="text" placeholder="Tavily Api Key"
                            @input="onSettingInput('tavilyApiKey', ($event.target as HTMLInputElement).value)" />
                        <p class="hint">If the key is not specified and the provider is openai or Anthropic without a
                            custom base URL, OpenAi or Anthropic's web_search will be used. If the key is tavily,
                            Tavily's web search will be used.</p>
                    </div>

                    <div class="setting-group">
                        <label for="maxToolParallel">Max Tool Parallel</label>
                        <input id="maxToolParallel" :value="settings.maxToolParallel" type="number" min="1" max="10"
                            placeholder="3"
                            @change="onSettingChange('maxToolParallel', Math.max(1, Math.min(25, Number(($event.target as HTMLInputElement).value))))" />
                        <p class="hint">Maximum number of tools that can run in parallel.</p>
                    </div>

                    <div class="setting-group">
                        <label for="maxToolParallel">Context management</label>
                        <ContextManagementSettings :settings="settings"
                            @setting-change="(key, value) => onSettingChange(key, value)" />
                    </div>
                </Collapsible>

                <Collapsible title="Agents" :default-open="true">

                    <p class="hint" style="margin-bottom: 1rem;">
                        Here you can configure the models to be used. How does it work? Chat loads the skill and
                        simultaneously changes the LLM to the specified one. This is to reduce costs. <br>
                        <strong>!ATTENTION! IF YOU DO NOT SPECIFY A MODEL, OPENAI MODELS WILL BE USED</strong>
                    </p>

                    <AgentSettings title="Base Agent" :model="settings.agentBaseModel as string"
                        :reasoning="settings.agentBaseReasoning as string"
                        @reasoning-change="onSettingChange('agentBaseReasoning', $event)"
                        @model-change="onSettingChange('agentBaseModel', $event)"
                        :model-features="['json', 'tools', 'image']"
                        desc="Fallback model used when specific agent models are not configured. Recommended: balanced-performance model like gpt-5-mini.">

                        <template #custom-header>
                            <button @click="applyBaseAgentToAll" class="apply-to-all-btn"
                                title="Copy base model settings to all specialized agents">
                                Apply to all
                            </button>
                        </template>
                    </AgentSettings>

                    <!-- Specialized Agent Configurations -->
                    <Collapsible title="Block Diagram" :default-open="false">
                        <AgentSettings title="Block Diagram" :model="settings.agentBlockDiagramModel as string"
                            :reasoning="settings.agentBlockDiagramReasoning as string"
                            @reasoning-change="onSettingChange('agentBlockDiagramReasoning', $event)"
                            @model-change="onSettingChange('agentBlockDiagramModel', $event)"
                            :model-features="['tools', 'json']"
                            desc="Generates structural diagrams, system architectures, and visual block representations. Recommended: gpt-5.4 for complex diagram logic.">
                        </AgentSettings>
                    </Collapsible>

                    <Collapsible title="Chat" :default-open="false">
                        <AgentSettings title="Chat" :model="settings.agentChatModel as string"
                            @model-change="onSettingChange('agentChatModel', $event)"
                            :reasoning="settings.agentChatReasoning as string" :model-features="['tools']"
                            @reasoning-change="onSettingChange('agentChatReasoning', $event)"
                            desc="Handles general conversations, contextual queries, and iterative design discussions. Recommended: gpt-5-mini for responsive dialogue.">
                        </AgentSettings>
                    </Collapsible>

                    <Collapsible title="Circuit Explainer" :default-open="false">
                        <AgentSettings title="Circuit Explainer" :model="settings.agentCircuitExplainerModel as string"
                            @model-change="onSettingChange('agentCircuitExplainerModel', $event)"
                            :reasoning="settings.agentCircuitExplainerReasoning as string"
                            @reasoning-change="onSettingChange('agentCircuitExplainerReasoning', $event)"
                            desc="Analyzes and explains circuit functionality, signal flow, and component interactions. Recommended: gpt-5.4 for deep technical analysis.">

                            <template #custom-settings>
                                <div class="setting-group">
                                    <label for="agentCircuitExplainerUseSpice">
                                        <input id="agentCircuitExplainerUseSpice" type="checkbox"
                                            :checked="settings.agentCircuitExplainerUseSpice as boolean"
                                            @change="onSettingChange('agentCircuitExplainerUseSpice', ($event.target as HTMLInputElement).checked)" />
                                        Add spice-simulation to agent tools
                                    </label>

                                    <p class="hint">Adds a spice-simulation tool to the agent and the ability to display
                                        simulation results. REQUIRES VISION</p>
                                </div>
                            </template>
                        </AgentSettings>
                    </Collapsible>

                    <Collapsible title="Circuit Maker" :default-open="false">
                        <AgentSettings title="Circuit Maker" :model="settings.agentCircuitMakerModel as string"
                            @model-change="onSettingChange('agentCircuitMakerModel', $event)"
                            :reasoning="settings.agentCircuitMakerReasoning as string"
                            @reasoning-change="onSettingChange('agentCircuitMakerReasoning', $event)"
                            :model-features="['tools', 'json']"
                            desc="Creates new schematics, modifies existing circuits. Recommended: gpt-5.4 for precision and complexity handling.">
                        </AgentSettings>
                    </Collapsible>

                    <Collapsible title="Completions" :default-open="false">
                        <AgentSettings title="Completions" :model="settings.agentCompletionsModel as string"
                            @model-change="onSettingChange('agentCompletionsModel', $event)"
                            :reasoning="settings.agentCompletionsReasoning as string"
                            @reasoning-change="onSettingChange('agentCompletionsReasoning', $event)"
                            :model-features="['tools', 'json']" desc="Collects the completions. Recommended: gpt-5.4.">
                        </AgentSettings>
                    </Collapsible>

                    <Collapsible title="List Completions" :default-open="false">
                        <AgentSettings title="Completions" :model="settings.agentListCompletionsModel as string"
                            @model-change="onSettingChange('agentListCompletionsModel', $event)"
                            :reasoning="settings.agentListCompletionsReasoning as string" :model-features="['json']"
                            @reasoning-change="onSettingChange('agentListCompletionsReasoning', $event)"
                            desc="Model for generating a list of possible additions. Recommended: gpt-5-mini for low-latency inference.">
                        </AgentSettings>
                    </Collapsible>


                    <Collapsible title="Diagnostic Algorithms" :default-open="false">
                        <AgentSettings title="Diagnostic Algorithms"
                            :model="settings.agentDiagnosticAlgorithmModel as string"
                            :model-features="['tools', 'json']"
                            @model-change="onSettingChange('agentDiagnosticAlgorithmModel', $event)"
                            :reasoning="settings.agentDiagnosticAlgorithmReasoning as string"
                            @reasoning-change="onSettingChange('agentDiagnosticAlgorithmReasoning', $event)"
                            desc="Generates fault-finding procedures, test sequences, and troubleshooting workflows. Recommended: gpt-5.4 for logical flow generation.">
                        </AgentSettings>
                    </Collapsible>

                    <Collapsible title="Pin Descriptions" :default-open="false">
                        <AgentSettings title="Pin Descriptions" :model="settings.agentPinDescriptionModel as string"
                            @model-change="onSettingChange('agentPinDescriptionModel', $event)"
                            :reasoning="settings.agentPinDescriptionReasoning as string"
                            :model-features="['json', 'image']"
                            @reasoning-change="onSettingChange('agentPinDescriptionReasoning', $event)"
                            desc="Sometimes in LCSC pins are designated only by numbers and in order to determine the correct names of pins and their functions, a vision model is required. Recommended: gpt-5.4.">
                        </AgentSettings>
                    </Collapsible>

                    <Collapsible title="LCSC Component Search" :default-open="false">
                        <AgentSettings title="LCSC Component Search" :model="settings.agentLcscSearchModel as string"
                            @model-change="onSettingChange('agentLcscSearchModel', $event)"
                            :reasoning="settings.agentLcscSearchReasoning as string" :model-features="['json', 'tools']"
                            @reasoning-change="onSettingChange('agentLcscSearchReasoning', $event)"
                            desc="Translates design requirements into precise LCSC catalog queries and filters results. Recommended: gpt-5-mini query optimization.">

                            <template #custom-settings>
                                <div class="setting-group">
                                    <label for="agentLcscSearchUsePrefetch">
                                        <input id="agentLcscSearchUsePrefetch" type="checkbox"
                                            :checked="settings.agentLcscSearchUsePrefetch as boolean"
                                            @change="onSettingChange('agentLcscSearchUsePrefetch', ($event.target as HTMLInputElement).checked)" />
                                        Performs a preliminary web search
                                    </label>
                                </div>
                            </template>
                        </AgentSettings>
                    </Collapsible>

                    <Collapsible title="LCSC Catalog Matcher" :default-open="false">
                        <AgentSettings title="LCSC Catalog Matcher" :model="settings.agentLcscCatalogModel as string"
                            @model-change="onSettingChange('agentLcscCatalogModel', $event)"
                            :reasoning="settings.agentLcscCatalogReasoning as string" :model-features="['json']"
                            @reasoning-change="onSettingChange('agentLcscCatalogReasoning', $event)"
                            desc="Identifies the most relevant directories for searching complex components. Recommended: gpt-5-mini.">
                        </AgentSettings>
                    </Collapsible>
                </Collapsible>

            </div>

            <!-- Theme Section (остается без изменений) -->
            <div class="settings-section">
                <h2>Theme</h2>
                <p class="section-description">Customize the appearance</p>

                <!-- Theme Select -->
                <div class="setting-group">
                    <label for="theme">Theme</label>

                    <CustomSelect id="theme" :value="settings.theme" :model-value="String(settings['theme'])" :options="[
                        { label: 'Dark', value: 'dark' },
                        { label: 'Light', value: 'light' },
                    ]" @update:model-value="onSettingChange('theme', $event)" />

                    <p class="hint">Select your preferred theme</p>
                </div>

                <!-- Show Inline Buttons -->
                <div class="setting-group">
                    <label for="showInlineButtons">
                        <input id="showInlineButtons" type="checkbox" :checked="settings.showInlineButtons as boolean"
                            @change="onSettingChange('showInlineButtons', ($event.target as HTMLInputElement).checked)" />
                        Show Inline Buttons
                    </label>
                    <p class="hint">Display action buttons above the input area for the latest AI messages</p>
                </div>
            </div>

            <div class="settings-section">
                <h2>Circuit Assembly</h2>

                <div class="setting-group">
                    <label for="assembleDrawRects">
                        <input id="assembleDrawRects" type="checkbox" :checked="Boolean(settings.assembleDrawRects)"
                            @change="onSettingChange('assembleDrawRects', ($event.target as HTMLInputElement).checked)" />
                        Draw structural blocks and their descriptions
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
import { getRelayConnection, startRelay, stopRelay } from '../../api/relay';
import CustomSelect from '../shared/CustomSelect.vue';
import Collapsible from '../shared/Collapsible.vue';
import AgentSettings from './AgentSettings.vue';
import ErrorBanner from '../shared/ErrorBanner.vue';
import ContextManagementSettings from './ContextManagementSettings.vue';

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
}, { immediate: true });

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
        showToastMessage('Settings saved', 'success');
    }, 1000);
};

const onSettingChange = (key: string, value: string | boolean | number) => {
    settingsStore.setSetting(key, value);
    showToastMessage('Settings saved', 'success');
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

    showToastMessage('Applied base model settings to all agents', 'success');
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