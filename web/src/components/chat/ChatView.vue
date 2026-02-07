<template>
  <div v-if="!showEditor" class="chat-view">
    <div class="messages" v-if="chatMessages?.length" ref="messagesContainer" @scroll="onScroll">
      <ChatMessage v-for="(msg, idx) in chatMessages" :key="cyrb53(msg.content)" :msg="msg" :idx="idx"
        @retry-send="retrySend" @edit-message="onEditMessage" @inline-buttons="onInlineButtons"
        @delete-message="deleteMessage" />

      <div v-if="isLoading" class="message ai typing-indicator">
        <div class="avatar">
          <Icon name="Cpu" size="20" />
        </div>
        <TypingDots dots-position="left" :status="progressStatus" />
        <Timer style="margin-left: auto;" />
      </div>

      <div v-if="errorMessage" class="error-container">
        <ErrorBanner :message="errorMessage" />
        <MessageBottomControls @retry="retrySend(-1)" :show="['retry']" />
      </div>

    </div>

    <!-- Empty placeholder shown when there are no chat messages -->
    <div class="messages placeholder" v-else>
      <div class="placeholder-content">
        <p class="empty-title">No messages</p>
        <p class="empty-sub">Please enter your message in the box below.</p>
        <p class="empty-hint">Hint: Enable "Upload selected" to attach the selected schema to the request.</p>
      </div>
    </div>

    <div class="input">
      <div v-if="settingsStore.getSetting('showInlineButtons') && inlineButtons.length" class="inline-buttons">
        <IconButton :size="10" class="inline-button" v-for="btn in inlineButtons" :key="btn.text" :icon="btn.icon"
          @click="btn.handler()">
          {{ btn.text }}
        </IconButton>
      </div>

      <IconButton class="scroll-to-bottom-btn" v-if="showScrollButton" @click="scrollToBottom" icon="ChevronDown"
        :size="20" />

      <div class="input-container">
        <div class="input-options">
          <IconButton class="input-option" v-for="opt in options.filter(o => o.showIfValue ? o.value : true)"
            :key="opt.label" :icon="opt.icon" :size="10" :class="['option-btn', { active: opt.value }]"
            @click="opt.value = !opt.value" :disabled="isLoading">
            <label>{{ opt.label }}</label>
          </IconButton>
        </div>

        <div class="input-area">
          <IconButton :size="16" icon="Paperclip" class="attach-btn" @click="handleAttachClick"></IconButton>

          <AdjTextarea v-model="newMessage" placeholder="Ask about components, specifications, or circuits..."
            @enter="sendMessage" />

          <IconButton class="send-btn" @click="isLoading ? cancelRequest() : sendMessage()"
            :disabled="newMessage.trim() === '' && !isLoading" :size="20"
            :icon="isLoading ? 'Square' : 'SendHorizonal'" />
        </div>

        <ContextMenu :show="attachMenu.show" :x="attachMenu.x" :y="attachMenu.y" :items="attachMenuItems"
          @close="attachMenu.show = false" />
      </div>
    </div>
  </div>

  <div v-else class="editor-overlay">
    <div class="editor-container">
      <div class="editor-main">
        <BlockDiagramEditor ref="blockDiagramEditor">
          <IconButton class="editor-btn" @click="toggleHistoryPanel" icon="History" :size="18" />
          <IconButton class="editor-btn" @click="attachBlockDiagram" icon="Check" :size="18" />
          <IconButton class="editor-btn" @click="showEditor = false" icon="X" :size="18" />
          <div v-if="showHistoryPanel" class="editor-history-panel">
            <BlockDiagramHistory ref="historyPanel" @load="loadDiagramFromHistory" @close="showHistoryPanel = false" />
          </div>
        </BlockDiagramEditor>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch, onActivated, onUnmounted } from 'vue';
import useChat from '../../composables/useChat';
import Icon from '../shared/Icon.vue';
import IconButton from '../shared/IconButton.vue';
import ChatMessageContent from './ChatMessageContent.vue';
import MessageBottomControls from './MessageBottomControls.vue';
import TypingDots from '../shared/TypingDots.vue';
import AdjTextarea from './AdjTextarea.vue';
import { useSettingsStore } from '../../stores/settings-store';
import ErrorBanner from '../shared/ErrorBanner.vue';
import Timer from '../shared/Timer.vue';
import ChatMessage from './ChatMessage.vue';
import { cyrb53 } from '../../utils/hash';
import BlockDiagramEditor from '../block-diagram/BlockDiagramEditor.vue';
import BlockDiagramHistory from '../block-diagram/BlockDiagramHistory.vue';
import ContextMenu from '../shared/ContextMenu.vue';
import { showToastMessage } from '../../eda/utils';
import { useBlockDiagramHistoryStore } from '../../stores/block-diagram-history-store';

const settingsStore = useSettingsStore();
const blockDiagramHistoryStore = useBlockDiagramHistoryStore();

const {
  chatMessages,
  newMessage,
  isLoading,
  progressStatus,
  errorMessage,
  inlineButtons,
  options,
  lastInlineBtnIdx,
  onInlineButtons,
  sendMessage,
  cancelRequest,
  retrySend,
  deleteMessage
} = useChat();

const messagesContainer = ref<HTMLElement | null>(null);
const showScrollButton = ref(false);
const showEditor = ref(false);
const showHistoryPanel = ref(false);
const blockDiagramEditor = ref<InstanceType<typeof BlockDiagramEditor> | null>(null);
const historyPanel = ref<InstanceType<typeof BlockDiagramHistory> | null>(null);
const attachMenu = ref({ show: false, x: 0, y: 0 });

onActivated(() => {
  nextTick(() => {
    if (chatMessages.value.length > 0) {
      scrollToBottom();
    }
  });
})

watch(chatMessages, () => {
  errorMessage.value = '';
  inlineButtons.value = [];
  lastInlineBtnIdx.value = -1;
  nextTick(() => { scrollToBottom(); onScroll(); });
});

function attachBlockDiagram() {
  if (!blockDiagramEditor.value) {
    showToastMessage("BlockDiagramEditor not found", 'error');
    return;
  }

  const data = blockDiagramEditor.value.getData();
  if (!data || !data.nodes.length) {
    showToastMessage("Block diagram is empty", 'error');
    return;
  }

  // Save to history with default name
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const defaultName = `Diagram - ${timestamp}`;
  blockDiagramHistoryStore.addOrUpdateEntry(defaultName, data);
  showToastMessage("Diagram saved to history", 'success');

  showEditor.value = false;
  showHistoryPanel.value = false;
  const opt = options.value.find(o => o.attachId === 'Block diagram')!;
  opt.value = data;
  console.log("blockDiagramEditor", data)
}

function loadDiagramFromHistory(data: any) {
  if (!blockDiagramEditor.value) {
    showToastMessage("BlockDiagramEditor not found", 'error');
    return;
  }

  blockDiagramEditor.value.setData(data);
  showHistoryPanel.value = false;
  showToastMessage("Diagram loaded from history", 'success');
}

function toggleHistoryPanel() {
  showHistoryPanel.value = !showHistoryPanel.value;
}

function scrollToBottom() {
  const container = messagesContainer.value;
  if (container) {
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    showScrollButton.value = false;
  }
  else {
    console.warn("Fail scroll to bottom")
  }
}

function onScroll() {
  const container = messagesContainer.value;
  if (container) {
    const { scrollTop, scrollHeight, clientHeight } = container;
    showScrollButton.value = scrollTop + clientHeight < scrollHeight - 10;
  } else {
    showScrollButton.value = false;
  }
}

function handleAttachClick(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();

  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  attachMenu.value = {
    show: true,
    x: rect.left,
    y: rect.top - 40
  };
}

const attachMenuItems = [
  {
    icon: 'Cuboid',
    label: 'Draw Block Diagram',
    click: () => {
      showEditor.value = true;
      attachMenu.value.show = false;
    }
  }
];

function closeAttachMenu(event: MouseEvent) {
  attachMenu.value.show = false;
}

onMounted(() => {
  window.addEventListener('click', closeAttachMenu);
  blockDiagramHistoryStore.initializeHistory();
})

onUnmounted(() => {
  window.removeEventListener('click', closeAttachMenu);
})

function onEditMessage(originalIdx: number, newContent: string) {
  // Update the message content and send as retry
  if (chatMessages.value.length > originalIdx) {
    // Replace the message content with edited version
    const message = chatMessages.value[originalIdx];
    if (message.role === 'human') {
      message.content = newContent;
      // Send as retry to the originalIdx (which will send from that message onwards)
      retrySend(originalIdx);
    }
  }
}

// Expose for parent
defineExpose({
  isLoading,
});
</script>

<style scoped>
.chat-view {
  padding: 0;
  background-color: var(--color-background);
  color: var(--color-text);
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  position: relative;
}

.messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  padding-right: 1rem;
}

/* Placeholder styles when there are no messages */
.messages.placeholder {
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.placeholder-content {
  text-align: center;
  color: var(--color-text-muted);
  max-width: 420px;
}

.empty-title {
  font-size: 1.25rem;
  color: var(--color-text);
  margin-bottom: 0.5rem;
}

.empty-sub {
  margin-bottom: 0.5rem;
}

.empty-hint {
  font-size: 0.9rem;
  color: var(--color-text-tertiary);
}

.input-area {
  display: flex;
  gap: 0.5rem;
}

.input-area input {
  flex: 1;
  padding: 0.75rem;
  background-color: var(--color-background-secondary);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  color: var(--color-text);
  font-family: inherit;
}

.input-area input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.input-area .send-btn {
  padding: 0.75rem;
  color: var(--color-primary);
  background-color: transparent;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  max-height: 54px;
}

.input-area .attach-btn {
  padding: 0;
  color: var(--color-text-on-surface);
  align-items: flex-start;
}

.input-area .send-btn:disabled {
  color: var(--color-border-dark);
}

.input-area .send-btn:hover {
  color: var(--color-primary-dark);
}

.input-container {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--color-border);
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  margin: 5px;
  border-radius: 5px;
}

/* Disabled controls when loading */
button[disabled],
.input-option[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

.input-options {
  display: flex;
  gap: 10px;
  flex-direction: row;
}

.input-option {
  font-size: 10px;
  background-color: var(--color-background-secondary);
  padding: 0.5rem 1rem;
  border-radius: 5px;
  cursor: pointer;
  border: 1px dashed var(--color-border);
  align-items: center;
  display: flex;
  padding: 0rem 0.5rem 0rem 0rem;
  color: var(--color-text);
}

.input-option.active {
  background-color: var(--color-primary);
  color: var(--color-text-on-primary);
  border-color: var(--color-primary);
}

.inline-buttons {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  margin-top: -25px;
  padding: 0 10px;
  position: absolute;
}

.inline-buttons .inline-button {
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  font-size: 10px;
  padding: 0px 10px 0px 0px;
  border: 1px solid var(--color-border);
}

.scroll-to-bottom-btn {
  position: absolute;
  margin-top: -75px;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background-color: var(--color-background);
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: background-color 0.2s ease, opacity 0.2s ease;
}

.scroll-to-bottom-btn:hover {
  background-color: var(--color-surface-hover);
}

.error-container {
  margin: 8px 0;
}

.message {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  max-width: 100%;
}

.message.ai .avatar {
  background-color: var(--color-primary);
  border-radius: 50%;
  min-width: 32px;
  max-width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-on-primary);
}

.open-editor-btn {
  position: absolute;
  right: 12%;
  margin-top: -75px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background-color: var(--color-background);
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 11;
}

.editor-overlay {
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 2000;
  display: flex;
  flex-direction: column;
}

.editor-container {
  display: flex;
  flex: 1;
  gap: 0;
}

.editor-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.editor-history-panel {
  position: absolute;
  top: 70px;
  right: 10px;
  width: 280px;
  max-height: calc(100vh - 150px);
  margin-top: 0.25rem;
  z-index: 200;
}

.editor-overlay-header {
  display: flex;
  justify-content: flex-end;
  padding: 10px;
}
</style>
