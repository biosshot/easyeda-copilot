// composables/useChat.ts
import { ref, computed, onScopeDispose, nextTick } from 'vue';
import { fetchSSE, fetchWithTask } from '../api';
import { useChatHistoryStore } from '../stores/chat-history-store';
import { useSettingsStore } from '../stores/settings-store';
import { getAllPrimitiveId, getSchematic } from '../eda/schematic';
import { isEasyEda, showToastMessage } from '../eda/utils';
import type { InlineButton } from '../types/inline-button';
import { formatError } from '../utils/error';
import { makeLLmSettings } from '../utils/llm-settings';

export default function useChat() {
    const historyStore = useChatHistoryStore();
    const settingsStore = useSettingsStore();

    const chatMessages = computed(() => historyStore.getCurrentChat()?.messages || []);
    const newMessage = ref<string>('');
    const isLoading = ref(false);
    const progressStatus = ref<string>('');
    const errorMessage = ref<string>('');
    const inlineButtons = ref<InlineButton[]>([]);
    const currentController = ref<AbortController | null>(null);
    const lastInlineBtnIdx = ref(-1);

    const options = ref([
        { value: true, label: 'Upload selected', icon: 'BoxSelect', id: 'Selected circuit' },
        { value: false, label: 'Upload all', icon: 'BoxSelect', id: 'Selected circuit' },
    ]);

    function onInlineButtons(data: { idx: number; buttons: InlineButton[] }) {
        if (data.idx > lastInlineBtnIdx.value) {
            inlineButtons.value = data.buttons;
            lastInlineBtnIdx.value = data.idx;
        }
    }

    async function collectMessageOptions() {
        const userOptions: Record<string, unknown> = {};

        for (const opt of options.value) {

            if (!opt.value) continue;

            if (opt.label === 'Upload selected' && isEasyEda()) {
                try {
                    const primitiveIds = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId().catch(() => []);
                    if (primitiveIds.length) {
                        progressStatus.value = 'Upload selected...';
                        userOptions[opt.id] = await getSchematic(primitiveIds);
                    }
                } catch (e: unknown) {
                    const eMes = e instanceof Error ? e.message : 'Error';
                    console.warn('Failed to load selected circuit', e);
                    showToastMessage('Failed to load selected circuit: ' + eMes, 'error');
                }
            }
            else if (opt.label === 'Upload all' && isEasyEda()) {
                try {
                    const primitiveIds = await getAllPrimitiveId();
                    if (primitiveIds.length) {
                        progressStatus.value = 'Upload all...';
                        userOptions[opt.id] = await getSchematic(primitiveIds);
                    }
                } catch (e: unknown) {
                    const eMes = e instanceof Error ? e.message : 'Error';
                    console.warn('Failed to load all circuit', e);
                    showToastMessage('Failed to load all circuit: ' + eMes, 'error');
                }
            }
            else {
                // userOptions[opt.id] = opt.value;
                console.warn('Unknown option')
            }
        }

        return userOptions;
    }

    async function request(body: object, controller: AbortController) {
        const response = await fetchWithTask({
            url: '/v2/chat',
            body: body,
            fetchOptions: { signal: controller.signal },
            onProgress: (status) => {
                progressStatus.value = status as string;
            },
        });

        // Handle response
        if (!response || !response.returnMessages?.length) {
            // Fallback: check if AI message was returned directly
            const lastMsg = response?.messages?.at?.(-1);
            if (lastMsg?.role === 'ai' && lastMsg.content) {
                historyStore.addMessageToCurrentChat({ ...lastMsg, isReady: true });
                return;
            }

            const err = response?.error ?? 'Failed to get response from chat API.';
            throw new Error(err);
        }

        for (const msg of response.returnMessages) {
            historyStore.addMessageToCurrentChat({ ...msg, isReady: true });
        }
    }

    async function requestStream(body: object, controller: AbortController) {
        let writeToLastMessage = false;

        await fetchSSE({
            url: '/v2/chat/stream',
            body: body,
            signal: controller.signal,

            onmessage(ev) {
                switch (ev.event) {
                    case 'mes_chunk': {
                        let message;
                        if (writeToLastMessage) message = chatMessages.value.at(-1);
                        else {
                            historyStore.addMessageToCurrentChat({
                                content: '',
                                role: 'ai',
                                options: {},
                                isReady: false
                            });

                            message = chatMessages.value.at(-1);
                            writeToLastMessage = true;
                        }

                        if (message) message.content += ev.data;
                        break;
                    }
                    case 'message':
                        historyStore.addMessageToCurrentChat(JSON.parse(ev.data));
                        writeToLastMessage = false;
                        break;
                    case 'status':
                        progressStatus.value = ev.data;
                        break;
                    default:

                        break;
                }

            },

            onerror(err) {
                console.error(err)
            },
        }).finally(() => {
            if (writeToLastMessage) {
                const message = chatMessages.value.at(-1);
                if (message) message.isReady = true;
            }

            historyStore.saveToStorage();
            isLoading.value = false;
        });
    }

    async function sendMessage(retry = false, retryMesIdx = 0) {
        if ((!newMessage.value.trim() && !retry) || isLoading.value) return;

        errorMessage.value = '';
        isLoading.value = true;
        progressStatus.value = 'Load...';

        const controller = new AbortController();
        currentController.value = controller;

        try {
            if (!retry) {
                const userOptions = await collectMessageOptions();
                historyStore.addMessageToCurrentChat({
                    role: 'human',
                    content: newMessage.value,
                    options: userOptions,
                    isReady: true
                });
            } else {
                if (retryMesIdx !== -1)
                    historyStore.setMessagesToCurrentChat(chatMessages.value.slice(0, retryMesIdx));
            }

            const body = {
                context: historyStore.getCurrentChat()?.messages || [],
                llmSettings: makeLLmSettings(settingsStore),
            };

            if (!body.llmSettings.provider) {
                throw new Error('API Provider is not set. Please set it in Settings.');
            }

            newMessage.value = '';
            progressStatus.value = 'Sending...';

            // await request(body, controller);
            await requestStream(body, controller);

            // Auto-scroll after update
            await nextTick();
        } catch (e) {
            errorMessage.value = formatError(e);
            showToastMessage(errorMessage.value, 'error');
        }

        isLoading.value = false;
        progressStatus.value = '';
        currentController.value = null;
    }

    function cancelRequest() {
        if (!isLoading.value || !currentController.value) return;

        currentController.value.abort();
        isLoading.value = false;
        progressStatus.value = '';
        showToastMessage('Request cancelled by user.', 'info');
        currentController.value = null;
    }

    function retrySend(messageIdx: number) {
        if (chatMessages.value[messageIdx]?.role === 'human')
            ++messageIdx;

        sendMessage(true, messageIdx);
    }

    function deleteMessage(messageIdx: number) {
        if (chatMessages.value[messageIdx]?.role === 'human')
            historyStore.setMessagesToCurrentChat(chatMessages.value.slice(0, messageIdx));
    }

    return {
        // State
        chatMessages,
        newMessage,
        isLoading,
        progressStatus,
        errorMessage,
        inlineButtons,
        options,
        lastInlineBtnIdx,

        // Actions
        onInlineButtons,
        sendMessage,
        cancelRequest,
        retrySend,
        deleteMessage,
    };
}