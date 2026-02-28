// composables/useChat.ts
import { ref, computed, onScopeDispose, nextTick } from 'vue';
import { fetchSSE, fetchSSETask, fetchWithTask } from '../api';
import { ChatMessage, useChatHistoryStore } from '../stores/chat-history-store';
import { useSettingsStore } from '../stores/settings-store';
import { getAllPrimitiveId, getSchematic } from '../eda/schematic';
import { isEasyEda, showToastMessage } from '../eda/utils';
import type { InlineButton } from '../types/inline-button';
import { formatError } from '../utils/error';
import { makeLLmSettings } from '../utils/llm-settings';
import { FlowExportObject } from '@vue-flow/core';
import { CircuitBlocks } from '../types/circuit';

function transformFlowToBlocks(flowData: FlowExportObject): CircuitBlocks['blocks'] {
    const { nodes, edges } = flowData;

    // Создаем маппинг: id узла -> его данные
    const nodeMap = new Map<string, typeof nodes[0]>();
    nodes.forEach(node => {
        nodeMap.set(node.id, node);
    });

    // Создаем маппинг: исходный узел -> массив целевых узлов
    const adjacencyMap = new Map<string, string[]>();

    edges.forEach(edge => {
        const sourceId = edge.source;
        const targetId = edge.target;

        if (!adjacencyMap.has(sourceId)) {
            adjacencyMap.set(sourceId, []);
        }

        const targets = adjacencyMap.get(sourceId)!;
        if (!targets.includes(targetId)) {
            targets.push(targetId);
        }
    });

    // Преобразуем узлы в блоки
    const blocks: CircuitBlocks['blocks'][0][] = nodes.map(node => {
        const nextNodeIds = adjacencyMap.get(node.id) || [];

        const nextBlockNames = nextNodeIds
            .map(targetId => {
                const targetNode = nodeMap.get(targetId);
                return targetNode ? targetNode.data.label : null;
            })
            .filter((name): name is string => name !== null);

        return {
            name: node.data.label,
            description: node.data.description,
            next_block_names: nextBlockNames
        };
    });

    return blocks;
}

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
    const todos = ref<{
        status: "pending" | "in_progress" | "completed";
        content: string;
    }[]>([]);

    const options = ref<{
        value: unknown;
        showIfValue: boolean;
        label: string;
        icon: string;
        attachId: 'Selected circuit' | 'Block diagram';
    }[]>([
        { value: true, showIfValue: false, label: 'Upload selected', icon: 'BoxSelect', attachId: 'Selected circuit' },
        { value: false, showIfValue: false, label: 'Upload all', icon: 'BoxSelect', attachId: 'Selected circuit' },
        { value: undefined, showIfValue: true, label: 'Block diagram', icon: 'Cuboid', attachId: 'Block diagram' },
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
                        userOptions[opt.attachId] = await getSchematic(primitiveIds);
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
                        userOptions[opt.attachId] = await getSchematic(primitiveIds);
                    }
                } catch (e: unknown) {
                    const eMes = e instanceof Error ? e.message : 'Error';
                    console.warn('Failed to load all circuit', e);
                    showToastMessage('Failed to load all circuit: ' + eMes, 'error');
                }
            }
            else if (opt.attachId === 'Block diagram' && opt.value && typeof opt.value === 'object') {
                const blocks = transformFlowToBlocks(opt.value as FlowExportObject);
                if (blocks.length) {
                    progressStatus.value = 'Upload block diagram...';
                    userOptions[opt.attachId] = blocks;
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

    async function requestStream(body: object, controller: AbortController, streamid?: string, eventid?: string) {
        let writeToLastMessage = false;

        if (streamid) {
            const last = chatMessages.value.at(-1);
            if (last?.role === 'ai' && !last.isReady) writeToLastMessage = true;
        }

        let saveInterval: ReturnType<typeof setInterval> | null = null;
        let lastEventId: string | undefined;

        const saveProgress = () => {
            localStorage.setItem('chat-last-eventid', lastEventId ?? '');
            historyStore.saveToStorage();
        };

        const startAutoSave = () => {
            if (saveInterval) return;
            saveInterval = setInterval(() => {
                saveProgress();
            }, 8000);
        };

        const stopAutoSave = () => {
            if (saveInterval) {
                clearInterval(saveInterval);
                saveInterval = null;
            }
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                saveProgress();
            }
        };

        const handleBeforeUnload = () => {
            saveProgress();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);

        await fetchSSETask({
            url: '/v2/chat/s/stream',
            body: body,
            signal: controller.signal,
            prevStreamId: streamid,
            prevLastEventId: eventid,

            onmessage(ev) {
                if (ev.id) lastEventId = ev.id;

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

                        if (message) {
                            message.content += ev.data;
                        }
                        break;
                    }
                    case 'think_chunk': {
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

                        if (message) {
                            if (!message.thinking) message.thinking = '';
                            message.thinking += ev.data;
                        }
                        break;
                    }
                    case 'message':
                        historyStore.addMessageToCurrentChat(JSON.parse(ev.data));
                        writeToLastMessage = false;
                        break;
                    case 'status':
                        progressStatus.value = ev.data;
                        break;

                    case 'update-todos':
                        todos.value = JSON.parse(ev.data);
                        break;

                    case 'end':
                        localStorage.setItem('chat-last-streamid', '');
                        localStorage.setItem('chat-last-eventid', '');
                        break;

                    default:

                        break;
                }

            },

            async onopen(response, streamId) {
                localStorage.setItem('chat-last-streamid', streamId ?? '');
                startAutoSave();
            },

            onerror(err) {
                console.error(err)
            },
        }).finally(() => {
            if (writeToLastMessage) {
                const message = chatMessages.value.at(-1);
                if (message) message.isReady = true;
            }

            stopAutoSave();
            historyStore.saveToStorage();

            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);

            isLoading.value = false;
            localStorage.setItem('chat-last-streamid', '');
            localStorage.setItem('chat-last-eventid', '');
        });
    }

    const prepareContext = (messages: ChatMessage[]) => {
        messages = messages.slice(0, 128);
        const newmessages = [] as ChatMessage[];

        const process = (msg: ChatMessage): ChatMessage => {
            try {
                const json = JSON.parse(msg.content);

                if (json.type === 'circuit_agent_result' && json.result) {
                    return {
                        ...msg,
                        content: JSON.stringify({
                            ...json,
                            result: {
                                circuit: {
                                    ...json.result.circuit,
                                    edges: undefined,
                                    blocks_rect: undefined,
                                    components: json.result.circuit.components?.map((comp: object) => ({
                                        ...comp,
                                        pos: undefined
                                        // @ts-ignore
                                    }))?.filter((comp: object) => !comp?.designator?.includes('|') && comp?.designator?.length < 10)
                                },
                                blockDiagram: undefined
                            }
                        }),
                    }
                }
            } catch (error) {
                return msg;
            }

            return msg;
        }

        for (const msg of messages) {
            newmessages.push(process(msg))
        }

        return newmessages;
    }

    async function sendMessage(retry = false, retryMesIdx = 0, continue_ = false) {
        if ((!newMessage.value.trim() && !retry && !continue_) || isLoading.value) return;

        errorMessage.value = '';
        isLoading.value = true;
        progressStatus.value = 'Load...';

        const controller = new AbortController();
        currentController.value = controller;

        try {
            if (!continue_) {
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
            }

            const body = {
                context: prepareContext(historyStore.getCurrentChat()?.messages || []),
                llmSettings: makeLLmSettings(settingsStore),
            };

            if (!body.llmSettings.provider) {
                throw new Error('API Provider is not set. Please set it in Settings.');
            }

            newMessage.value = '';
            progressStatus.value = 'Sending...';

            let eventid;
            let streamid;

            if (continue_) {
                streamid = localStorage.getItem('chat-last-streamid') || undefined;
                eventid = localStorage.getItem('chat-last-eventid') || undefined;
            }

            if ((continue_ && streamid) || !continue_)
                await requestStream(body, controller, streamid, eventid);

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

    function onEditMessage(originalIdx: number, newContent: string) {
        if (chatMessages.value.length > originalIdx) {
            const message = chatMessages.value[originalIdx];
            if (message.role === 'human') {
                message.content = newContent;
                retrySend(originalIdx);
            }
        }
    }

    // continue last stream
    sendMessage(undefined, undefined, true)

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
        todos,

        // Actions
        onInlineButtons,
        sendMessage,
        cancelRequest,
        retrySend,
        deleteMessage,
        onEditMessage
    };
}