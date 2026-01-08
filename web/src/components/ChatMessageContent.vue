<template>
    <div class="container">
        <div class="content">
            <div class="mes-content">
                <template v-if="message.role === 'human'">
                    <div v-html="safeHtml"></div>
                </template>
                <template v-else-if="message.role === 'ai'">
                    <ComponentViewer v-if="parsedMessage?.type === 'component_search_result'"
                        :result="parsedMessage.result" />
                    <CircuitExplainViewer v-else-if="parsedMessage?.type === 'circuit_explain_result'"
                        :result="parsedMessage.result" />
                    <CircuitAgentResultViewer v-else-if="parsedMessage?.type === 'circuit_agent_result'"
                        :result="parsedMessage.result" />
                    <PdfFileViewer v-else-if="parsedMessage?.type === 'pdf_file'" :result="parsedMessage.result" />
                    <div v-else ref="markdownElement" v-html="safeHtml"></div>
                </template>
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
import { computed } from 'vue'
import DOMPurify from 'dompurify'
import { markdown } from '../utils.ts'
import ComponentViewer from './ComponentViewer.vue'
import CircuitExplainViewer from './CircuitExplainViewer.vue'
import CircuitAgentResultViewer from './CircuitAgentResultViewer.vue'
import PdfFileViewer from './PdfFileViewer.vue'
import type { Message } from '../types/message.ts'

const props = defineProps<{ message: Message }>()

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

</script>
<style>
.container {
    display: flex;
    flex-direction: column;
    /* max-width: 95%; */
}

.content {
    background-color: var(--color-background-secondary);
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    /* max-width: 85%; */
    overflow: hidden;
    box-sizing: border-box;
}

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
