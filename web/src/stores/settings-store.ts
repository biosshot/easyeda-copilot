import { defineStore } from 'pinia';
import { defaultStorage } from './storage';

export interface AllSettings {
    [key: string]: string | number | boolean;
}

// Явные значения по умолчанию
const DEFAULT_SETTINGS = {
    // API Configuration
    apiProvider: 'openai',
    apiKey: '',
    llmBaseUrl: '',

    // UI Preferences
    theme: 'light',
    showInlineButtons: true,

    // Agent Models - Base
    agentBaseModel: 'gpt-5.4-mini',

    // Agent Models - Specialized
    agentBlockDiagramModel: 'gpt-5.4',
    agentChatModel: 'gpt-5.4-mini',
    agentCircuitExplainerModel: 'gpt-5.4',
    agentCircuitMakerModel: 'gpt-5.4',
    agentCompletionsModel: 'gpt-5.4',
    agentListCompletionsModel: 'gpt-5.4-mini',
    agentDiagnosticAlgorithmModel: 'gpt-5.4',
    agentPinDescriptionModel: 'gpt-5.4',
    agentLcscSearchModel: 'gpt-5.4-mini',
    agentLcscCatalogModel: 'gpt-5.4-mini',

    agentBaseReasoning: 'medium',

    agentBlockDiagramReasoning: 'medium',
    agentChatReasoning: 'low',
    agentCircuitExplainerReasoning: 'medium',
    agentCircuitMakerReasoning: 'medium',
    agentCompletionsReasoning: 'low',
    agentListCompletionsReasoning: 'low',
    agentDiagnosticAlgorithmReasoning: 'medium',
    agentPinDescriptionReasoning: 'low',
    agentLcscSearchReasoning: 'low',
    agentLcscCatalogReasoning: 'minimal',

    agentCircuitExplainerUseSpice: false,
    agentLcscSearchUsePrefetch: true,

    tavilyApiKey: '',

    maxToolParallel: 3,

    // Context Management
    contextManagementMode: 'disable',
    contextSummarizeKeepLastMessages: 16,
    contextSummarizeThreshold: 64000,
    contextTrimThreshold: 128,
    contextSaveFirstMessages: 5,
    contextMaxNumberAttachedCircuit: 8,

    assembleDrawRects: true
};

type SettingsKey = keyof typeof DEFAULT_SETTINGS | (string & {});

const SETTINGS_STORAGE_KEY = 'app_settings';

export const useSettingsStore = defineStore('settings', {
    state: () => ({
        settings: { ...DEFAULT_SETTINGS } as AllSettings,
    }),

    getters: {
        getAllSettings: (state) => state.settings,
        getSetting: (state) => (key: SettingsKey) => state.settings[key],
    },

    actions: {
        loadSettings(stored?: string | { [key: string]: unknown }) {
            if (!stored) stored = defaultStorage.getItem(SETTINGS_STORAGE_KEY) ?? undefined;

            if (stored) {
                try {
                    let parsed;

                    if (typeof stored === 'string') parsed = JSON.parse(stored);
                    else parsed = stored;

                    this.settings = Object.keys(DEFAULT_SETTINGS).reduce((acc, key) => {
                        // @ts-ignore
                        acc[key] = key in parsed ? parsed[key] : DEFAULT_SETTINGS[key];
                        return acc;
                    }, {} as AllSettings);
                } catch (e) {
                    console.error('Failed to parse settings from storage:', e);
                    this.settings = { ...DEFAULT_SETTINGS };
                }
            } else {
                this.settings = { ...DEFAULT_SETTINGS };
            }
        },

        updateSettings(newSettings: AllSettings) {
            this.settings = { ...this.settings, ...newSettings };
            this.saveSettings();
        },

        setSetting(key: SettingsKey, value: string | number | boolean) {
            if (key in DEFAULT_SETTINGS) {
                this.settings[key] = value;
                this.saveSettings();
            } else {
                console.warn(`Unknown setting key: ${key}`);
            }
        },

        saveSettings() {
            try {
                defaultStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
            } catch (e) {
                console.error('Failed to save settings to storage:', e);
            }
        },

        resetSettings() {
            this.settings = { ...DEFAULT_SETTINGS };
            this.saveSettings();
        },
    },
});