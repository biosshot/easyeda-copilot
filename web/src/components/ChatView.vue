<template>
  <div class="chat-view">
    <div class="messages" v-if="chatMessages?.length">
      <div v-for="msg in chatMessages" :class="['message', msg.role]">
        <div v-if="msg.role === 'ai'" class="avatar">
          <Icon name="Cpu" size="20" />
        </div>
        <div class="content">
          <ChatMessageContent :message="msg" />
        </div>
        <div v-if="msg.role === 'human'" class="avatar">
          <Icon name="User" size="20" />
        </div>
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

    <!-- Error banner shown when request failed -->
    <div class="error-banner" v-if="errorMessage">
      <p>{{ errorMessage }}</p>
    </div>

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
        <button @click="isLoading ? cancelRequest() : sendMessage()" :disabled="newMessage.trim() === '' && !isLoading">
          <Icon :name="isLoading ? 'CircleStop' : 'SendHorizonal'" size="20" :class="{ spin: isLoading }" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, provide } from 'vue';
import { useAppStore } from '../stores/appStore';
import { useChatHistoryStore } from '../stores/chatHistoryStore';
import Icon from './Icon.vue';
import { apiUrl, authorization, fetchWithTask } from '../fetchWithTask';
import ChatMessageContent from './ChatMessageContent.vue';
import { getSchematic } from '../eda/getSchematic';
import { isEasyEda } from '../utils';
import { useSettingsStore } from '../stores/settingsStore';

const store = useAppStore();
const settingsStore = useSettingsStore();
const historyStore = useChatHistoryStore();

const chatMessages = computed(() => historyStore.getCurrentChat()?.messages || []);
const newMessage = ref('');

// ref to the textarea element for autosize
const messageTextarea = ref(null);

// Loading and error states for requests
const isLoading = ref(false);
const errorMessage = ref('');

// Controller for cancellation of in-flight chat request
const currentController = ref(null);

onMounted(() => {
  nextTick(adjustTextareaHeight);
});

function adjustTextareaHeight() {
  const textarea = messageTextarea.value;
  if (!textarea) return;

  textarea.style.height = 'auto';
  const newHeight = Math.min(textarea.scrollHeight, 300);
  textarea.style.height = `${newHeight}px`;
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

const sendMessage = async () => {
  if (!newMessage.value.trim() || isLoading.value) return;

  // prepare message and options
  const message = newMessage.value;
  const userOptions = {};

  try {
    isLoading.value = true;
    errorMessage.value = '';

    // create abort controller for this request and store it so it can be cancelled
    const controller = new AbortController();
    currentController.value = controller;


    for (const opt of options.value) {
      if (!opt.value) continue;

      if (opt.id === 'Selected circuit' && isEasyEda()) {
        const primitiveIds = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId();
        if (primitiveIds.length) {
          userOptions[opt.id] = await getSchematic(primitiveIds);
        }
      } else {
        userOptions[opt.id] = opt.value;
      }
    }

    // add user message to chat immediately
    // store.addChatMessage({
    //   role: 'human',
    //   content: message,
    //   options: userOptions,
    // });

    // Save to chat history
    historyStore.addMessageToCurrentChat({
      role: 'human',
      content: message,
      options: userOptions,
    });

    const body = {
      context: chatMessages.value,
      llmSettings: {
        provider: settingsStore.getSetting('apiProvider'),
        apiKey: settingsStore.getSetting('apiKey'),
      }
    };

    // console.log(body)

    if (!body.llmSettings.apiKey) {
      throw new Error('API Key is not set. Please set it in Settings.');
    }

    if (!body.llmSettings.provider) {
      throw new Error('API Provider is not set. Please set it in Settings.');
    }

    console.log('[ChatView] Sending chat request:', body);

    // clear input and resize
    newMessage.value = '';
    nextTick(() => adjustTextareaHeight());

    const response = await fetchWithTask({
      url: `${apiUrl}/chat`,
      body: JSON.stringify(body),
      fetchOptions: {
        signal: currentController.value?.signal,
        headers: {
          'Authorization': authorization,
        }
      }
    });

    // validate response
    if (!response || !response.returnMessages?.length) {
      // sometimes server may return single ai message in response.messages
      if (response?.messages?.at?.(-1)?.role === 'ai') {
        if (response.messages.at(-1).content) {
          // store.addChatMessage(response.messages.at(-1));
          historyStore.addMessageToCurrentChat(response.messages.at(-1));
          return;
        }
      }

      const err = 'Failed to get response from chat API.';
      console.error(err, response);
      errorMessage.value = err;
      // also show an ai message so the user sees it in chat history
      const errorMsg = { role: 'ai', content: err };
      // store.addChatMessage(errorMsg);
      historyStore.addMessageToCurrentChat(errorMsg);
      return;
    }

    for (const msg of response.returnMessages) {
      // store.addChatMessage(msg);
      historyStore.addMessageToCurrentChat(msg);
    }
  } catch (e) {
    const isAbort = e?.message === 'Operation aborted' || e?.name === 'AbortError' || /aborted/i.test(e?.message || '');
    const errMsg = isAbort ? 'Request cancelled by user.' : (e?.message ? `Request failed: ${e.message}` : 'Request failed');
    console.error('[ChatView] Chat request error:', e);
    errorMessage.value = isAbort ? '' : errMsg;
    const aiMsg = { role: 'ai', content: errMsg };
    // store.addChatMessage(aiMsg);
    historyStore.addMessageToCurrentChat(aiMsg);
  } finally {
    isLoading.value = false;
    // clear controller
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
  errorMessage.value = 'Request cancelled by user.';
  currentController.value = null;
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
  max-width: 95%;
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

.content {
  background-color: var(--color-background-secondary);
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  max-width: 100%;
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

.error-banner {
  background: var(--color-error);
  color: var(--color-text-on-primary);
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  margin: 8px 0;
  font-size: 0.95rem;
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
</style>