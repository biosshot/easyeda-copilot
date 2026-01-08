import { defineStore } from 'pinia';
import { defaultStorage } from './storage';
import { fetchEda, apiUrl, authorization } from '../fetchWithTask';

type SettingType = 'text' | 'password' | 'select' | 'checkbox';

interface SettingOption {
    label: string;
    value: string | number | boolean;
}

interface SettingBase {
    type: SettingType;
    key: string;
    label: string;
    hint?: string;
    required?: boolean;
    defaultValue: string | number | boolean;
}

export interface SettingText extends SettingBase {
    type: 'text' | 'password';
    placeholder: string;
    defaultValue: string;
}

export interface SettingSelect extends SettingBase {
    type: 'select';
    placeholder: string;
    defaultValue: string;
    options: SettingOption[];
}

export interface SettingCheckbox extends SettingBase {
    type: 'checkbox';
    defaultValue: boolean;
}

type SettingDefinition = SettingText | SettingSelect | SettingCheckbox;

export interface SettingsSection {
    title: string;
    description?: string;
    settings: SettingDefinition[];
}

export interface AllSettings {
    [key: string]: string | number | boolean;
}

const SETTINGS_STORAGE_KEY = 'app_settings';

export const settingsSections: SettingsSection[] = [
    {
        title: 'LLM API Configuration',
        description: 'Configure your LLM API provider and credentials',
        settings: [
            {
                key: 'apiProvider',
                label: 'API Provider',
                type: 'select',
                hint: 'Select your preferred LLM provider',
                options: [
                    { label: 'OpenAI', value: 'openai' },
                ],
                required: true,
                defaultValue: 'openai',
            } as SettingSelect,
            {
                key: 'apiKey',
                label: 'API Key',
                type: 'password',
                placeholder: 'Enter your API key',
                hint: 'Your API key will be saved locally in browser storage',
                required: true,
                defaultValue: '',
            } as SettingText,
            // {
            //     key: 'llmModel',
            //     label: 'LLM Model',
            //     type: 'select',
            //     options: [] as SettingOption[],
            //     hint: 'Your API key will be saved locally in browser storage',
            //     required: true,
            //     defaultValue: '',
            // } as SettingSelect,
        ],
    },
    {
        title: 'Theme',
        description: 'Customize the appearance',
        settings: [
            {
                key: 'theme',
                label: 'Theme',
                type: 'select',
                hint: 'Select your preferred theme',
                options: [
                    { label: 'Dark', value: 'dark' },
                    { label: 'Light', value: 'light' },
                ],
                defaultValue: 'dark',
            } as SettingSelect,
        ],
    },
];

const defaultSettings: AllSettings = settingsSections.reduce((acc, section) => {
    section.settings.forEach((setting) => {
        acc[setting.key] = setting.defaultValue;
    });
    return acc;
}, {} as AllSettings);

export const useSettingsStore = defineStore('settings', {
    state: () => ({
        settings: { ...defaultSettings } as AllSettings,
        modelsOptions: [] as SettingOption[],
    }),

    getters: {
        getAllSettings: (state) => state.settings,
        getSetting: (state) => (key: string) => state.settings[key],
        getSettingsSections: (state) => {
            const sections = structuredClone(settingsSections); // deep clone
            // const llmSection = sections[0]; // LLM API Configuration
            // const llmModelSetting = llmSection.settings.find((s: SettingDefinition) => s.key === 'llmModel');
            // if (llmModelSetting) {
            //     (llmModelSetting as SettingSelect).options = state.modelsOptions;
            // }
            return sections;
        },
    },

    actions: {
        async fetchModels() {
            // const provider = this.settings.apiProvider as string;
            // try {
            //     const response = await fetchEda(`${apiUrl}/models/${provider}`, {
            //         headers: { 'Authorization': authorization }
            //     });
            //     if (!response.ok) throw new Error('Failed to fetch models');
            //     const data = await response.json();
            //     this.modelsOptions = data.models.map((m: string) => ({ label: m, value: m }));
            //     // If no model selected or invalid, set to first available
            //     if (!this.modelsOptions.find(opt => opt.value === this.settings.llmModel)) {
            //         this.settings.llmModel = this.modelsOptions[0]?.value || '';
            //     }
            // } catch (e) {
            //     console.error('Failed to fetch models:', e);
            //     this.modelsOptions = [];
            // }
        },

        initSettings() {
            const stored = defaultStorage.getItem(SETTINGS_STORAGE_KEY);
            if (stored) {
                try {
                    this.settings = JSON.parse(stored);
                } catch (e) {
                    console.error('Failed to parse settings from storage:', e);
                    this.settings = { ...defaultSettings };
                }
            } else {
                this.settings = { ...defaultSettings };
            }
            this.fetchModels();
        },

        updateSettings(newSettings: Partial<AllSettings>) {
            this.settings = { ...this.settings, ...(newSettings as AllSettings) };
            this.saveSettings();
        },

        setSetting(key: string, value: string | number | boolean) {
            this.settings[key] = value;
            this.saveSettings();
            if (key === 'apiProvider') {
                this.fetchModels();
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
            this.settings = { ...defaultSettings };
            this.saveSettings();
        },
    },
});
