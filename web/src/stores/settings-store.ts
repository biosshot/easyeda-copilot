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

    useStreamApi: true,

    // Agent Models - Base
    agentBaseModel: 'gpt-5-mini',

    // Agent Models - Specialized
    agentBlockDiagramModel: 'gpt-5.2',
    agentChatModel: 'gpt-5-mini',
    agentCircuitExplainerModel: 'gpt-5.2',
    agentCircuitMakerModel: 'gpt-5.2',
    agentCompletionsModel: 'gpt-5.2',
    agentListCompletionsModel: 'gpt-5-mini',
    agentDiagnosticAlgorithmModel: 'gpt-5.2',
    agentPinDescriptionModel: 'gpt-5.2',
    agentLcscSearchModel: 'gpt-5-mini',
    agentLcscCatalogModel: 'gpt-5-mini',

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

    tavilyApiKey: '',
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