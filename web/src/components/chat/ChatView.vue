<template>
  <div class="chat-view">
    <div class="messages" v-if="chatMessages?.length" ref="messagesContainer" @scroll="onScroll">
      <ChatMessage v-for="(msg, idx) in chatMessages" :msg="msg" :idx="idx" @retry-send="retrySend"
        @edit-message="onEditMessage" @inline-buttons="onInlineButtons" @delete-message="deleteMessage" />

      <div v-if="isLoading" class="message ai typing-indicator">
        <div class="avatar">
          <Icon name="Cpu" size="20" />
        </div>
        <TypingDots :status="progressStatus" />
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
          <IconButton class="input-option" v-for="opt in options" :key="opt.label" :icon="opt.icon" :size="10"
            :class="['option-btn', { active: opt.value }]" @click="opt.value = !opt.value" :disabled="isLoading">
            <label>{{ opt.label }}</label>
          </IconButton>
        </div>

        <div class="input-area">
          <AdjTextarea v-model="newMessage" placeholder="Ask about components, specifications, or circuits..."
            @enter="sendMessage" />

          <button @click="isLoading ? cancelRequest() : sendMessage()"
            :disabled="newMessage.trim() === '' && !isLoading">
            <Icon :name="isLoading ? 'Square' : 'SendHorizonal'" size="20" :class="{ spin: isLoading }" />
          </button>
        </div>
      </div>
    </div>

  </div>

</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch, onActivated } from 'vue';
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

const settingsStore = useSettingsStore();

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

.input-area button {
  padding: 0.75rem;
  color: var(--color-primary);
  background-color: transparent;
  /* background-color: var(--color-primary); */
  /* color: var(--color-text-on-primary); */
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  max-height: 54px;
}

.input-area button:disabled {
  color: var(--color-border-dark);
  /* background-color: var(--color-surface-hover); */
  /* color: var(--color-text-on-surface); */
}

.input-area button:hover {
  color: var(--color-primary-dark);
  /* background-color: var(--color-primary-dark); */
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
</style>
