import { useSettingsStore } from "../stores/settings-store"

export const makeLLmSettings = (settingsStore: ReturnType<typeof useSettingsStore>) => {
    const s = {
        provider: settingsStore.getSetting('apiProvider'),
        apiKey: settingsStore.getSetting('apiKey'),
        'base-url': settingsStore.getSetting('llmBaseUrl').toString().trim() || undefined,

        base: {
            model: settingsStore.getSetting('agentBaseModel') || undefined,
            reasoning: settingsStore.getSetting('agentBaseReasoning') || undefined,
        },
        'block-diagram': {
            model: settingsStore.getSetting('agentBlockDiagramModel') || undefined,
            reasoning: settingsStore.getSetting('agentBlockDiagramReasoning') || undefined,
        },
        chat: {
            model: settingsStore.getSetting('agentChatModel') || undefined,
            reasoning: settingsStore.getSetting('agentChatReasoning') || undefined,
        },
        'circuit-explainer': {
            model: settingsStore.getSetting('agentCircuitExplainerModel') || undefined,
            reasoning: settingsStore.getSetting('agentCircuitExplainerReasoning') || undefined,
        },
        'circuit-maker': {
            model: settingsStore.getSetting('agentCircuitMakerModel') || undefined,
            reasoning: settingsStore.getSetting('agentCircuitMakerReasoning') || undefined,
        },
        completions: {
            model: settingsStore.getSetting('agentCompletionsModel') || undefined,
            reasoning: settingsStore.getSetting('agentCompletionsReasoning') || undefined,
        },
        'completions-list': {
            model: settingsStore.getSetting('agentListCompletionsModel') || undefined,
            reasoning: settingsStore.getSetting('agentListCompletionsReasoning') || undefined,
        },
        'diagnostic-algoritm': {
            model: settingsStore.getSetting('agentDiagnosticAlgorithmModel') || undefined,
            reasoning: settingsStore.getSetting('agentDiagnosticAlgorithmReasoning') || undefined,
        },
        'pin-desc': {
            model: settingsStore.getSetting('agentPinDescriptionModel') || undefined,
            reasoning: settingsStore.getSetting('agentPinDescriptionReasoning') || undefined,
        },
        'lcsc-search': {
            model: settingsStore.getSetting('agentLcscSearchModel') || undefined,
            reasoning: settingsStore.getSetting('agentLcscSearchReasoning') || undefined,
        },
        'lcsc-most-rel-catalog': {
            model: settingsStore.getSetting('agentLcscCatalogModel') || undefined,
            reasoning: settingsStore.getSetting('agentLcscCatalogReasoning') || undefined,
        },

        'tavily-api-key': settingsStore.getSetting('tavilyApiKey') || undefined,
    };

    return s;
}