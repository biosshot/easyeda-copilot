import { ref, computed, Ref } from 'vue';
import { fetchWithTask } from '../api';
import { getAllPrimitiveId, getSchematic } from '../eda/schematic';
import { useSettingsStore } from '../stores/settings-store';
import type { ExplainCircuit } from '../types/circuit';
import { isEasyEda, showToastMessage } from '../eda/utils';
import { formatError } from '../utils/error';
import { assembleCircuit } from '../eda/assemble-circuit';
import { makeLLmSettings } from '../utils/llm-settings';

export interface Suggestion {
    title: string;
    description: string;
    action?: string;
}

export function useCompletions() {
    const settingsStore = useSettingsStore();

    const suggestions = ref<Suggestion[]>([]);
    const selectedSuggestion = ref<number | null>(null);
    const customAction = ref('');
    const isLoading = ref(false);
    const progressStatus = ref('');
    const currentAbortController = ref<AbortController | null>(null);
    const errorMessage = ref<string>('');

    const canApply = computed(() => {
        return customAction.value.trim().length > 0 || selectedSuggestion.value !== null;
    });

    const generateCompletions = async () => {
        if (isLoading.value) return;

        isLoading.value = true;
        progressStatus.value = 'Loading circuit...';
        currentAbortController.value = new AbortController();
        errorMessage.value = '';

        try {
            const circuit: ExplainCircuit = await getSchematic(await getAllPrimitiveId());

            progressStatus.value = 'Generating suggestions...';

            const result = await fetchWithTask({
                url: '/v1/completions/list',
                body: {
                    circuit,
                    llmSettings: makeLLmSettings(settingsStore),
                },
                fetchOptions: { signal: currentAbortController.value.signal },
                onProgress: handleProgress,
            });

            if (result?.actions && Array.isArray(result.actions)) {
                suggestions.value = result.actions.map((action: any) => ({
                    title: action.title || action.name || 'Action',
                    description: action.description || '',
                    action: action.action || JSON.stringify(action),
                }));
                selectedSuggestion.value = null;
                customAction.value = '';
            }
        } catch (e) {
            errorMessage.value = formatError(e);
            showToastMessage(errorMessage.value, 'error');
        } finally {
            isLoading.value = false;
            progressStatus.value = '';
            currentAbortController.value = null;
        }
    };

    const applyAction = async () => {
        if (!canApply.value) return;

        isLoading.value = true;
        progressStatus.value = 'Processing action...';
        currentAbortController.value = new AbortController();
        errorMessage.value = '';

        try {
            const circuit = await getSchematic(await getAllPrimitiveId());

            let actionToApply = customAction.value.trim();
            if (
                selectedSuggestion.value !== null &&
                selectedSuggestion.value < suggestions.value.length
            ) {
                actionToApply =
                    suggestions.value[selectedSuggestion.value].action ||
                    suggestions.value[selectedSuggestion.value].title;
            }

            progressStatus.value = 'Sending request to server...';

            const result = await fetchWithTask({
                url: '/v1/completions/make',
                body: {
                    circuit,
                    promt: actionToApply, // Note: likely typo; should be "prompt"
                    llmSettings: makeLLmSettings(settingsStore),
                },
                fetchOptions: { signal: currentAbortController.value.signal },
                onProgress: handleProgress,
            });

            await assembleCircuit(result);

            // Reset & refresh
            customAction.value = '';
            selectedSuggestion.value = null;
            await generateCompletions();
        } catch (e) {
            errorMessage.value = formatError(e);
            showToastMessage(errorMessage.value, 'error');
        } finally {
            isLoading.value = false;
            progressStatus.value = '';
            currentAbortController.value = null;
        }
    };

    const selectSuggestion = (index: number) => {
        selectedSuggestion.value = selectedSuggestion.value === index ? null : index;
        if (selectedSuggestion.value !== null) {
            customAction.value = '';
        }
    };

    const cancelRequest = () => {
        currentAbortController.value?.abort();
        isLoading.value = false;
        progressStatus.value = '';
        currentAbortController.value = null;
    };

    const handleProgress = (status: string) => {
        progressStatus.value = status.length > 320 ? status.slice(0, 320) + '...' : status;
    };

    return {
        // State
        suggestions,
        selectedSuggestion,
        customAction,
        isLoading,
        progressStatus,
        errorMessage,

        // Computed
        canApply,

        // Methods
        generateCompletions,
        applyAction,
        selectSuggestion,
        cancelRequest,
    };
}