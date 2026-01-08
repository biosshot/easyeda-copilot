<template>
  <div class="chat-view">
    <div class="messages" v-if="chatMessages?.length" ref="messagesContainer" @scroll="onScroll">
      <div v-for="(msg, idx) in chatMessages" :class="['message', msg.role]">
        <div v-if="msg.role === 'ai'" class="avatar">
          <Icon name="Cpu" size="20" />
        </div>

        <div>
          <ChatMessageContent :message="msg" />
          <div v-if="msg.role === 'ai'">
            <MessageBottomControls @retry-send="retrySend(idx)" />
          </div>
        </div>
        <div v-if="msg.role === 'human'" class="avatar">
          <Icon name="User" size="20" />
        </div>
      </div>
      <div v-if="isLoading" class="message ai typing-indicator">
        <div class="avatar">
          <Icon name="Cpu" size="20" />
        </div>
        <div class="typing-bubble">
          <div class="typing-dots">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
          <p v-if="progressStatus" class="progress-text">{{ progressStatus }}</p>
        </div>
      </div>
      <div v-if="errorMessage" class="error-container">
        <div class="error-banner">
          <div class="error-content">
            <Icon style="color: red;" name="CircleAlert" size="20" />
            <div class="error-text">{{ errorMessage }}</div>
          </div>

        </div>
        <MessageBottomControls @retry-send="retrySend(-1)" />
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

      <button class="scroll-to-bottom-btn" v-show="showScrollButton" @click="scrollToBottom">
        <Icon name="ChevronDown" size="20" />
      </button>

      <div class="input-container">
        <div class="input-options">
          <button class="input-option" v-for="opt in options" :key="opt.value"
            :class="['option-btn', { active: opt.value }]" @click="opt.value = !opt.value" :disabled="isLoading">
            <Icon :name="opt.icon" size="10" />
            <label>{{ opt.label }}</label>
          </button>

        </div>

        <div class="input-area">
          <textarea ref="messageTextarea" v-model="newMessage"
            placeholder="Ask about components, specifications, or circuits..." @input="onTextareaInput"
            @keydown="onTextareaKeydown"></textarea>
          <button @click="isLoading ? cancelRequest() : sendMessage()"
            :disabled="newMessage.trim() === '' && !isLoading">
            <Icon :name="isLoading ? 'CircleStop' : 'SendHorizonal'" size="20" :class="{ spin: isLoading }" />
          </button>
        </div>
      </div>
    </div>

  </div>

</template>

<script setup>
import { ref, computed, onMounted, nextTick, provide, watch } from 'vue';
import { useAppStore } from '../stores/appStore';
import { useChatHistoryStore } from '../stores/chatHistoryStore';
import Icon from './Icon.vue';
import { apiUrl, authorization, fetchWithTask } from '../fetchWithTask';
import ChatMessageContent from './ChatMessageContent.vue';
import { getSchematic } from '../eda/getSchematic';
import { isEasyEda, showToastMessage } from '../utils';
import { useSettingsStore } from '../stores/settingsStore';
import MessageBottomControls from './MessageBottomControls.vue';

const store = useAppStore();
const settingsStore = useSettingsStore();
const historyStore = useChatHistoryStore();

const chatMessages = computed(() => historyStore.getCurrentChat()?.messages || []);
const newMessage = ref('');
const messageTextarea = ref(null);
const messagesContainer = ref(null);
const showScrollButton = ref(false);
const isLoading = ref(false);
const progressStatus = ref('');
const errorMessage = ref('');
const currentController = ref(null);

const getUserAuth = () => {
  const userInfo = eda.sys_Environment.getUserInfo();

  return btoa(JSON.stringify({
    username: userInfo.username,
    uuid: userInfo.uuid
  }))
}

onMounted(() => {
  nextTick(() => {
    adjustTextareaHeight();
    if (chatMessages.value.length > 0) {
      scrollToBottom();
    }
  });
});

// Watch for changes in chatMessages to update scroll button visibility
watch(chatMessages, () => {
  errorMessage.value = '';
  nextTick(() => {
    onScroll();
  });
});

function adjustTextareaHeight() {
  const textarea = messageTextarea.value;
  if (!textarea) return;

  textarea.style.height = 'auto';
  const newHeight = Math.min(textarea.scrollHeight, 300);
  textarea.style.height = `${newHeight}px`;
}

function scrollToBottom() {
  const container = messagesContainer.value;
  if (container) {
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    showScrollButton.value = false;
  }
}

function onScroll() {
  const container = messagesContainer.value;

  if (container) {
    const { scrollTop, scrollHeight, clientHeight } = container;
    showScrollButton.value = scrollTop + clientHeight < scrollHeight - 1; // threshold 1px
  }
  else {
    showScrollButton.value = false;
  }
}

function onTextareaInput() {
  adjustTextareaHeight();
}

function onTextareaKeydown(e) {
  // Enter without Shift sends the message
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

const options = ref([
  { value: true, label: 'Upload selected', icon: 'BoxSelect', id: 'Selected circuit' },
]);

const sendMessage = async (retry = false, retryMesIdx = 0) => {
  if ((!newMessage.value.trim() && !retry) || isLoading.value) return;

  errorMessage.value = '';

  const message = newMessage.value;
  const userOptions = {};

  isLoading.value = true;
  progressStatus.value = '';

  const controller = new AbortController();
  currentController.value = controller;

  if (!retry) {
    for (const opt of options.value) {
      if (!opt.value) continue;

      if (opt.id === 'Selected circuit' && isEasyEda()) {
        const primitiveIds = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId().catch(e => []);
        if (primitiveIds.length) {
          userOptions[opt.id] = await getSchematic(primitiveIds);
          console.log('[ChatView] get sel schematic:', primitiveIds, userOptions[opt.id]);
        }
      } else {
        userOptions[opt.id] = opt.value;
      }
    }

    // Save to chat history
    historyStore.addMessageToCurrentChat({
      role: 'human',
      content: message,
      options: userOptions,
    });
  }
  else {
    // On retry, we resend the previous message at retryMesIdx
    if (chatMessages.value.length > retryMesIdx) {
      if (retryMesIdx !== -1)
        historyStore.setMessagesToCurrentChat(chatMessages.value.slice(0, retryMesIdx));
    }
    else {
      isLoading.value = false;
      console.log('Retry failed: original message not found.', chatMessages.value.length, retryMesIdx);
      showToastMessage('Retry failed: original message not found.', 'error');
      return;
    }
  }

  nextTick(() => scrollToBottom());

  const body = {
    context: chatMessages.value,
    llmSettings: {
      provider: settingsStore.getSetting('apiProvider'),
      apiKey: settingsStore.getSetting('apiKey'),
    }
  };

  try {
    // if (!body.llmSettings.apiKey) {
    //   throw new Error('API Key is not set. Please set it in Settings.');
    // }

    if (!body.llmSettings.provider) {
      throw new Error('API Provider is not set. Please set it in Settings.');
    }

    console.log('[ChatView] Sending chat request:', body);

    // clear input and resize
    newMessage.value = '';
    nextTick(() => adjustTextareaHeight());

    const response = await fetchWithTask({
      url: `${apiUrl}/v2/chat`,
      body: JSON.stringify(body),
      fetchOptions: {
        signal: currentController.value?.signal,
        headers: {
          'Authorization': authorization,
          'x-eda-user': getUserAuth(),
        }
      },
      onProgress: (status) => {
        console.log('[ChatView] Chat progress:', status);

        let newValue = null;

        if (typeof status === 'string') {
          newValue = status;
        }
        else if (status?.type === 'current_action' && status?.action) {
          newValue = status.action;
        }

        if (typeof newValue === 'string') {
          if (newValue.length > 320) {
            newValue = newValue.slice(0, 320) + '...';
          }
          else {
            progressStatus.value = newValue;
          }
        }
      }
    });

    // validate response
    if (!response || !response.returnMessages?.length) {
      if (response?.messages?.at?.(-1)?.role === 'ai') {
        if (response.messages.at(-1).content) {
          historyStore.addMessageToCurrentChat(response.messages.at(-1));
          return;
        }
      }

      const err = response.error ?? 'Failed to get response from chat API.';
      console.error(err, response);
      errorMessage.value = err;
      showToastMessage(err, 'error');
      return;
    }

    for (const msg of response.returnMessages) {
      historyStore.addMessageToCurrentChat(msg);
    }

    nextTick(() => scrollToBottom());
  } catch (e) {
    const isAbort = e?.message === 'Operation aborted' || e?.name === 'AbortError' || /aborted/i.test(e?.message || '');
    const errMsg = isAbort ? 'Request cancelled by user.' : (e?.message ? `Request failed: ${e.message}` : 'Request failed');
    console.error('[ChatView] Chat request error:', e);
    showToastMessage(isAbort ? e.message : errMsg, 'error');
    errorMessage.value = errMsg;
  } finally {
    isLoading.value = false;
    progressStatus.value = '';
    currentController.value = null;
  }
};

function cancelRequest() {
  if (!isLoading.value) return;
  console.log('Cancelling chat request...');
  // abort controller if exists
  try {
    currentController.value?.abort();
  } catch (e) {
    console.warn('Abort failed', e);
  }
  // set UI state immediately
  isLoading.value = false;
  progressStatus.value = '';
  showToastMessage('Request cancelled by user.', 'info');
  currentController.value = null;
}

function retrySend(messageIdx) {
  sendMessage(true, messageIdx);
}

// Expose isLoading for parent component
defineExpose({
  isLoading
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

.message {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  max-width: 100%;
}

.message.typing-indicator {
  align-items: center;
  opacity: 0.9;
}

.typing-bubble {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  background-color: var(--color-background-secondary);
  border-radius: 0.75rem;
  padding: 0.6rem 0.8rem;
  box-shadow: inset 0 0 0 1px var(--color-border);
  color: var(--color-text);
  font-size: 0.9rem;
}

.typing-bubble p {
  margin: 0;
  font-weight: 500;
}

.progress-text {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  font-weight: 400;
  white-space: pre-line;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
}

.typing-dots {
  display: flex;
  gap: 0.3rem;
}

.typing-dots .dot {
  width: 0.6rem;
  height: 0.6rem;
  background-color: var(--color-primary);
  border-radius: 50%;
  animation: typingPulse 1s infinite ease-in-out;
}

.typing-dots .dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dots .dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typingPulse {
  0% {
    transform: translateY(0);
    opacity: 0.35;
  }

  50% {
    transform: translateY(-2px);
    opacity: 0.9;
  }

  100% {
    transform: translateY(0);
    opacity: 0.35;
  }
}

.message.human {
  align-self: flex-end;
  flex-direction: row-reverse;
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

.message.human .avatar {
  background-color: var(--color-surface-hover);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-on-surface);
}

.text {
  margin-bottom: 0.25rem;
  word-break: break-word;
}

.timestamp {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  text-align: right;
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

.input-area textarea {
  flex: 1;
  padding: 0.1rem;
  background-color: transparent;
  border: none;
  /* border-radius: 0.5rem; */
  color: var(--color-text);
  font-size: 16px;
  max-height: 240px;
  resize: none;
  overflow: auto;
  outline: none;
  line-height: 1.2;
}

.input-area input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.input-area textarea:focus {
  border-color: var(--color-primary);
}

.input-area button {
  padding: 0.75rem;
  background-color: var(--color-primary);
  color: var(--color-text-on-primary);
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  max-height: 56px;
}

.input-area button:disabled {
  background-color: var(--color-surface-hover);
  color: var(--color-text-on-surface);
}

.input-area button:hover {
  background-color: var(--color-primary-dark);
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

.message.error .avatar {
  background-color: var(--color-error);
  border-radius: 50%;
  min-width: 32px;
  max-width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-on-primary);
}

.message.error {
  justify-content: center;
}

.error-banner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  border: 1px solid var(--color-border);
  color: var(--color-text-on-surface);
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.95rem;
  width: 95%;
  max-width: 600px;
  gap: 0.5rem;
}

.error-content {
  display: flex;
  align-items: center;
  justify-content: start;
  max-width: 100%;
}

.error-text {
  margin-left: 0.5rem;
  max-width: 90%;
  word-wrap: break-word;
}

.retry-btn:hover {}

.retry-btn:disabled {
  background-color: var(--color-surface-hover);
  color: var(--color-text-on-surface);
  cursor: not-allowed;
}

/* Disabled controls when loading */
button[disabled],
.input-option[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

textarea[disabled] {
  background-color: var(--color-background);
  opacity: 0.9;
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

.markdown-content {
  /* Базовые стили для Markdown */
  line-height: 1.6;
  font-size: 1rem;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;

  /* Предотвращаем вылет за границы */
  max-width: 100%;
  overflow-x: auto;

  /* Стили для заголовков, списков и т.д. */
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    font-weight: bold;
  }

  p {
    margin: 0.5em 0;
  }

  pre {
    background: var(--color-background-secondary);
    padding: 1em;
    border-radius: 4px;
    overflow-x: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  code {
    background: var(--color-background-secondary);
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-family: monospace;
  }

  img {
    max-width: 100%;
    height: auto;
  }

  blockquote {
    border-left: 4px solid var(--color-border);
    padding-left: 1em;
    margin-left: 0;
    color: var(--color-text-muted);
  }
}

.scroll-to-bottom-btn {
  position: absolute;
  margin-top: -45px;
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
</style>
