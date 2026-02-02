<template>
    <div class="settings-view-container">
        <div class="settings-view">
            <h1>Settings</h1>

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
                    </AgentSettings>

                    <!-- Specialized Agent Configurations -->
                    <Collapsible title="Block Diagram" :default-open="false">
                        <AgentSettings title="Block Diagram" :model="settings.agentBlockDiagramModel as string"
                            :reasoning="settings.agentBlockDiagramReasoning as string"
                            @reasoning-change="onSettingChange('agentBlockDiagramReasoning', $event)"
                            @model-change="onSettingChange('agentBlockDiagramModel', $event)"
                            :model-features="['tools', 'json']"
                            desc="Generates structural diagrams, system architectures, and visual block representations. Recommended: gpt-5.2 for complex diagram logic.">
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
                            desc="Analyzes and explains circuit functionality, signal flow, and component interactions. Recommended: gpt-5.2 for deep technical analysis.">
                        </AgentSettings>
                    </Collapsible>

                    <Collapsible title="Circuit Maker" :default-open="false">
                        <AgentSettings title="Circuit Maker" :model="settings.agentCircuitMakerModel as string"
                            @model-change="onSettingChange('agentCircuitMakerModel', $event)"
                            :reasoning="settings.agentCircuitMakerReasoning as string"
                            @reasoning-change="onSettingChange('agentCircuitMakerReasoning', $event)"
                            :model-features="['tools', 'json']"
                            desc="Creates new schematics, modifies existing circuits. Recommended: gpt-5.2 for precision and complexity handling.">
                        </AgentSettings>
                    </Collapsible>

                    <Collapsible title="Completions" :default-open="false">
                        <AgentSettings title="Completions" :model="settings.agentCompletionsModel as string"
                            @model-change="onSettingChange('agentCompletionsModel', $event)"
                            :reasoning="settings.agentCompletionsReasoning as string"
                            @reasoning-change="onSettingChange('agentCompletionsReasoning', $event)"
                            :model-features="['tools', 'json']" desc="Collects the completions. Recommended: gpt-5.2.">
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
                            desc="Generates fault-finding procedures, test sequences, and troubleshooting workflows. Recommended: gpt-5.2 for logical flow generation.">
                        </AgentSettings>
                    </Collapsible>

                    <Collapsible title="Pin Descriptions" :default-open="false">
                        <AgentSettings title="Pin Descriptions" :model="settings.agentPinDescriptionModel as string"
                            @model-change="onSettingChange('agentPinDescriptionModel', $event)"
                            :reasoning="settings.agentPinDescriptionReasoning as string"
                            :model-features="['json', 'image']"
                            @reasoning-change="onSettingChange('agentPinDescriptionReasoning', $event)"
                            desc="Sometimes in LCSC pins are designated only by numbers and in order to determine the correct names of pins and their functions, a vision model is required. Recommended: gpt-5.2.">
                        </AgentSettings>
                    </Collapsible>

                    <Collapsible title="LCSC Component Search" :default-open="false">
                        <AgentSettings title="LCSC Component Search" :model="settings.agentLcscSearchModel as string"
                            @model-change="onSettingChange('agentLcscSearchModel', $event)"
                            :reasoning="settings.agentLcscSearchReasoning as string" :model-features="['json', 'tools']"
                            @reasoning-change="onSettingChange('agentLcscSearchReasoning', $event)"
                            desc="Translates design requirements into precise LCSC catalog queries and filters results. Recommended: gpt-5-mini query optimization.">
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
                    <select id="theme" :value="settings.theme"
                        @change="onSettingChange('theme', ($event.target as HTMLSelectElement).value)">
                        <option value="dark">Dark</option>
                        <option value="light">Light</option>
                    </select>
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
                <h2>Other</h2>

                <!-- Show Inline Buttons -->
                <div class="setting-group">
                    <label for="useStreamApi">
                        <input id="useStreamApi" type="checkbox" :checked="settings.useStreamApi"
                            @change="onSettingChange('useStreamApi', ($event.target as HTMLInputElement).checked)" />
                        Use streaming api
                    </label>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useSettingsStore } from '../../stores/settings-store';
import { showToastMessage } from '../../eda/utils';
import CustomSelect from '../shared/CustomSelect.vue';
import Collapsible from './Collapsible.vue';
import AgentSettings from './AgentSettings.vue';

const settingsStore = useSettingsStore();
const settings = computed(() => settingsStore.getAllSettings);

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

const onSettingChange = (key: string, value: string | boolean) => {
    settingsStore.setSetting(key, value);
    showToastMessage('Settings saved', 'success');
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
</style>