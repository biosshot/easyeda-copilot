<template>
    <div class="chat-controls-wrapper">
        <IconButton :disabled="newChatDisabled" @click="createNewChat" title="New chat" icon="Plus" />
        <IconButton @click="toggleChatHistory" title="Chat history" icon="History" />

        <!-- Chat history panel -->
        <div v-if="showChatHistory" class="chat-history-panel">
            <HistoryList title="Chat History" :items="historyItems" empty-message="No chats yet"
                :active-item-id="historyStore.currentChatId" @select="switchToChat" @delete="deleteChat"
                @clearAll="clearAllChats" @close="showChatHistory = false">
                <template #item-content="{ item }">
                    <span class="history-item-title">{{ item.label }}</span>
                    <span class="history-item-count">{{ item.count }}</span>
                </template>
            </HistoryList>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useChatHistoryStore } from '../../stores/chat-history-store';
import IconButton from '../shared/IconButton.vue';
import HistoryList from '../shared/HistoryList.vue';

const historyStore = useChatHistoryStore();
const allChats = computed(() => historyStore.getAllChats());

const props = defineProps<{ isLoading: boolean }>();

const historyItems = computed(() =>
    allChats.value.map(chat => ({
        id: chat.id,
        label: chat.title,
        count: chat.messages.length
    }))
);

const newChatDisabled = computed(() => {
    return props.isLoading || historyStore.isCurrentChatEmpty();
});

const showChatHistory = ref(false);

function toggleChatHistory() {
    showChatHistory.value = !showChatHistory.value;
}

function createNewChat() {
    if (props.isLoading) return;
    if (historyStore.isCurrentChatEmpty() && historyStore.getCurrentChat()) return;

    historyStore.createNewChat();
    showChatHistory.value = false;
}

function switchToChat(chatId: string) {
    if (props.isLoading) return;

    const success = historyStore.switchToChat(chatId);
    if (success) {
        showChatHistory.value = false;
    }
}

async function deleteChat(chatId: string) {
    if (props.isLoading) return;

    try {
        await historyStore.deleteChat(chatId);
    } catch (e) {
        console.error('Failed to delete chat:', e);
    }
}

async function clearAllChats() {
    if (props.isLoading) return;

    if (confirm('Are you sure you want to delete all chats?')) {
        try {
            await historyStore.clearAllChats();
        } catch (e) {
            console.error('Failed to clear all chats:', e);
        }

        showChatHistory.value = false;
    }
}
</script>

<style scoped>
.chat-controls-wrapper {
    display: flex;
    gap: 0.25rem;
    align-items: center;
    position: relative;
}

.chat-history-panel {
    position: absolute;
    top: 100%;
    right: 0;
    width: 280px;
    max-height: calc(100vh - 150px);
    margin-top: 0.25rem;
    z-index: 200;
}
</style>
