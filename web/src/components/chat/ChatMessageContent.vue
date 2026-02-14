<template>
    <div class="container">
        <div class="content" :class="props.message.role" v-if="!isEditing">
            <div class="mes-content" @dblclick="message.role === 'human' && startEditing()"
                :class="{ 'editable-text': message.role === 'human' }">
                <template v-if="message.role === 'human'">
                    <div v-html="safeHtml"></div>
                </template>
                <template v-else-if="message.role === 'ai'">
                    <ComponentViewer v-if="parsedMessage?.type === 'component_search_result'"
                        :result="parsedMessage.result"
                        @inline-buttons="emit('inline-buttons', { buttons: $event, idx })" />
                    <CircuitExplainViewer v-else-if="parsedMessage?.type === 'circuit_explain_result'"
                        :result="parsedMessage.result" />
                    <CircuitAgentResultViewer v-else-if="parsedMessage?.type === 'circuit_agent_result'"
                        :result="parsedMessage.result"
                        @inline-buttons="emit('inline-buttons', { buttons: $event, idx })" />
                    <PdfFileViewer v-else-if="parsedMessage?.type === 'pdf_file'" :result="parsedMessage.result" />
                    <div v-else ref="markdownElement" v-html="safeHtml"></div>
                </template>
            </div>
        </div>
        <div v-else class="content edit-mode" :class="props.message.role">
            <AdjTextarea v-model="editedContent" placeholder="Edit your message..." style="width: 100%;"
                :max-height="360" @enter="saveEdit" />
            <div class="edit-controls">
                <IconButton icon="PauseCircle" @click="cancelEdit" title="Stop edit message" />
                <IconButton icon="SendHorizonal" @click="saveEdit" title="Send message" />
            </div>
        </div>
        <div v-if="message.options && Object.keys(message.options).length > 0" class="message-options">
            <div v-for="(value, key) in message.options" :key="key" class="option-item">
                <label class="option-label">{{ key }}</label>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import { markdown } from '../../utils/markdown'
import ComponentViewer from './component/ComponentViewer.vue'
import CircuitExplainViewer from './circuit/CircuitExplainViewer.vue'
import CircuitAgentResultViewer from './circuit/CircuitAgentResultViewer.vue'
import PdfFileViewer from './pdf/PdfFileViewer.vue'
import type { Message } from '../../types/message'
import { InlineButton, InlineButtonsIdx } from '../../types/inline-button'
import AdjTextarea from './AdjTextarea.vue'
import IconButton from '../shared/IconButton.vue'

const props = defineProps<{ message: Message, isLast?: boolean, idx: number }>()
const emit = defineEmits<{
    'inline-buttons': [InlineButtonsIdx],
    'edit-message': [string]
}>();

const isEditing = ref(false);
const editedContent = ref('');

watch([() => props.message, () => props.idx],
    () => {
        isEditing.value = false;
        editedContent.value = '';
    },
    { deep: true }
);

// Парсим сообщение от ассистента один раз
const parsedMessage = computed(() => {
    if (props.message.role !== 'ai') return null;

    try {
        return JSON.parse(props.message.content);
    } catch (error) {
        return props.message.content;
    }
})

const safeHtml = computed(() => {
    const html = markdown(props.message.content)
    return DOMPurify.sanitize(html, {
        ADD_ATTR: ['target'],
        FORBID_TAGS: ['script', 'style', 'iframe'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick']
    })
})

function startEditing() {
    isEditing.value = true
    editedContent.value = props.message.content
}

function cancelEdit() {
    isEditing.value = false
    editedContent.value = ''
}

function saveEdit() {
    if (editedContent.value.trim()) {
        emit('edit-message', editedContent.value)
        isEditing.value = false
        editedContent.value = ''
    }
}

defineExpose({
    startEditing,
    toggleEdit: () => isEditing.value ? cancelEdit() : startEditing()
})

</script>
<style>
.mes-content {
    line-height: 1.6;
    font-size: 1rem;
    /* color: var(--color-text-secondary); */
    /* светлый текст на тёмном фоне */
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;

    max-width: 100%;
    overflow-x: hidden;
    box-sizing: border-box;

    /* Стили для заголовков */
    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
        margin-top: 1.5em;
        margin-bottom: 0.5em;
        font-weight: bold;
        color: var(--color-text-secondary);
        word-break: break-word;
    }

    p {
        margin: 0.5em 0;
    }

    ul,
    ol {
        padding-left: 1.5em;
        margin: 0.5em 0;
    }

    li {
        margin: 0.25em 0;
    }

    pre {
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border);
        padding: 1em;
        border-radius: 0.5rem;
        overflow-x: auto;
        white-space: pre-wrap;
        word-wrap: break-word;
        word-break: break-all;
        font-family: 'Fira Code', monospace;
        font-size: 0.9rem;
        max-width: 100%;
        box-sizing: border-box;
    }

    code {
        background: var(--color-surface-hover);
        padding: 0.2em 0.4em;
        border-radius: 3px;
        font-family: 'Fira Code', monospace;
        font-size: 0.9rem;
        color: #79c0ff;
        word-break: break-all;
        display: inline-block;
        max-width: 100%;
    }

    img {
        max-width: 100%;
        height: auto;
        border-radius: 0.5rem;
        margin: 0.5em 0;
    }

    blockquote {
        border-left: 4px solid var(--color-primary);
        padding-left: 1em;
        margin: 0.5em 0;
        color: var(--color-text-tertiary);
        font-style: italic;
        word-break: break-word;
    }

    a {
        color: var(--color-primary);
        text-decoration: underline;
        word-break: break-word;
    }

    .code-header {
        background: #30363d;
        padding: 0.5em 1em;
        border-top-left-radius: 0.5rem;
        border-top-right-radius: 0.5rem;
        font-size: 0.8rem;
        color: #a1a7b8;
        display: flex;
        align-items: center;
        gap: 0.5em;
        max-width: 100%;
        box-sizing: border-box;
    }

    .code-block {
        border-radius: 0.5rem;
        overflow: hidden;
        margin: 0.5em 0;
        max-width: 100%;
        box-sizing: border-box;
    }

    table {
        max-width: 100%;
        overflow-x: auto;
        display: block;
        border-collapse: collapse;
    }

    td,
    th {
        padding: 0.5em;
        border: 1px solid var(--color-border);
        word-break: break-word;
    }
}
</style>

<style scoped>
.content {
    background-color: var(--color-background-secondary);
    padding: 0.6rem 1rem;
    border-radius: 0.5rem;
    /* max-width: 85%; */
    overflow: hidden;
    box-sizing: border-box;
}

.content.ai {
    background-color: unset;
    padding: unset;
}

.container {
    display: flex;
    flex-direction: column;
    /* max-width: 95%; */
}

.mes-content.editable-text {
    cursor: text;
    transition: background-color 0.2s ease;
}

.mes-content.editable-text:hover {
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 0.25rem;
}

.edit-mode {
    width: 80vw;
}

.message-textarea {
    background-color: var(--color-background-secondary);
    border: 2px solid var(--color-primary);
    border-radius: 0.5rem;
    color: var(--color-text);
    padding: 0.75rem;
    font-family: inherit;
    font-size: 1rem;
    resize: none;
    /* min-height: 100px; */
    /* max-height: 300px; */
    box-sizing: border-box;
}

.edit-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
}

.message-textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2);
}

.edit-controls {
    display: flex;
    justify-content: flex-end;
}

.save-btn {
    background-color: var(--color-primary);
    color: var(--color-text-on-primary);
}

.save-btn:hover {
    background-color: var(--color-primary-dark);
    opacity: 0.9;
}

.cancel-btn {
    background-color: var(--color-surface-hover);
    color: var(--color-text);
    border: 1px solid var(--color-border);
}

.cancel-btn:hover {
    background-color: rgba(255, 255, 255, 0.1);
}

.message-options {
    margin-top: 5px;
    /* padding-top: 0.75em; */
    font-size: 0.7rem;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 5px;
    justify-items: end;
}

.option-item {
    background-color: var(--color-background-secondary);
    border-radius: 5px;
    cursor: pointer;
    border: 1px dashed var(--color-border);
    align-items: center;
    display: flex;
    padding: 0rem 0.3rem 0rem 0.3rem;
    color: var(--color-text);
    width: fit-content;
    max-width: 100%;
}

.option-label {
    padding: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>