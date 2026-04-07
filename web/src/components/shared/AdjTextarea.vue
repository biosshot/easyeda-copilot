<template>
    <div class="adj-textarea">
        <div class="textarea-stack" :style="`max-height: ${props.maxHeight ?? 240}px;`">
            <pre ref="highlightLayer" class="highlight-layer" aria-hidden="true" v-html="highlightedHtml"></pre>
            <textarea ref="textarea" v-model="model" :placeholder="props.placeholder"
                :style="`max-height: ${props.maxHeight ?? 240}px;`" :class="{ 'has-content': !!model?.length }"
                @keydown="onTextareaKeydown" @input="onTextareaInput" @click="updateSuggestions" @blur="onTextareaBlur"
                @scroll="onTextareaScroll"></textarea>
        </div>

        <div v-if="showSuggestions" ref="suggestionsEl" class="suggestions" :style="suggestionsStyle">
            <button v-for="(item, idx) in filteredSuggestions" :key="item" type="button"
                :class="['suggestion-item', { active: idx === activeSuggestionIndex }]"
                @mousedown.prevent="applySuggestion(idx)">
                #{{ item }}
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { getAllDesignators } from '../../eda/schematic';

const model = defineModel<string>();

const props = defineProps<{ placeholder: string, maxHeight?: number }>();
const textarea = ref<HTMLTextAreaElement | null>(null);
const highlightLayer = ref<HTMLElement | null>(null);
const suggestionsEl = ref<HTMLDivElement | null>(null);
const emit = defineEmits(['enter'])

const DESIGNATORS = ref<string[]>([]);
const showSuggestions = ref(false);
const filteredSuggestions = ref<string[]>([]);
const activeSuggestionIndex = ref(0);
const triggerStartIndex = ref<number | null>(null);
const suggestionsStyle = ref<Record<string, string>>({});
const designatorsSet = computed(() => new Set(DESIGNATORS.value.map(v => v.toLowerCase())));

function escapeHtml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

const highlightedHtml = computed(() => {
    const source = model.value ?? '';
    const escaped = escapeHtml(source);
    const highlighted = escaped.replace(
        /#[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*/g,
        (match) => designatorsSet.value.has(match.slice(1).toLowerCase())
            ? `<span class="token-designator">${match}</span>`
            : match
    );

    return highlighted + '\n';
});

function adjustTextareaHeight() {
    const textarea_ = textarea.value;
    if (!textarea_) return;

    const maxHeight = props.maxHeight ?? 240;
    textarea_.style.height = 'auto';
    const newHeight = Math.min(textarea_.scrollHeight, maxHeight);
    textarea_.style.height = `${newHeight}px`;

    syncHighlightLayout();
}

function syncHighlightLayout() {
    const textarea_ = textarea.value;
    const highlight = highlightLayer.value;
    if (!textarea_ || !highlight) return;

    const style = window.getComputedStyle(textarea_);
    const borderLeft = parsePx(style.borderLeftWidth);
    const borderRight = parsePx(style.borderRightWidth);
    const scrollbarWidth = Math.max(0, textarea_.offsetWidth - textarea_.clientWidth - borderLeft - borderRight);

    highlight.style.paddingTop = style.paddingTop;
    highlight.style.paddingBottom = style.paddingBottom;
    highlight.style.paddingLeft = style.paddingLeft;
    highlight.style.paddingRight = `calc(${style.paddingRight} + ${scrollbarWidth}px)`;
}

function closeSuggestions() {
    showSuggestions.value = false;
    filteredSuggestions.value = [];
    activeSuggestionIndex.value = 0;
    triggerStartIndex.value = null;
    suggestionsStyle.value = {};
}

function parsePx(value: string | null | undefined) {
    const n = Number.parseFloat(value ?? '0');
    return Number.isFinite(n) ? n : 0;
}

function getCaretCoordinates(textarea_: HTMLTextAreaElement, position: number) {
    const div = document.createElement('div');
    const style = window.getComputedStyle(textarea_);

    const properties = [
        'boxSizing', 'width', 'height', 'overflowX', 'overflowY', 'borderTopWidth', 'borderRightWidth',
        'borderBottomWidth', 'borderLeftWidth', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust', 'lineHeight',
        'fontFamily', 'textAlign', 'textTransform', 'textIndent', 'textDecoration', 'letterSpacing', 'wordSpacing'
    ] as const;

    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.left = '-9999px';

    for (const prop of properties) {
        div.style[prop] = style[prop];
    }

    div.textContent = textarea_.value.substring(0, position);

    if (textarea_.value.substring(0, position).endsWith('\n')) {
        div.textContent += '\u200b';
    }

    const span = document.createElement('span');
    span.textContent = textarea_.value.substring(position) || '\u200b';
    div.appendChild(span);

    document.body.appendChild(div);

    const borderTop = parsePx(style.borderTopWidth);
    const borderLeft = parsePx(style.borderLeftWidth);
    const top = span.offsetTop + borderTop - textarea_.scrollTop;
    const left = span.offsetLeft + borderLeft - textarea_.scrollLeft;

    document.body.removeChild(div);

    return { top, left };
}

function getSuggestionsWidth(textarea_: HTMLTextAreaElement, items: string[]) {
    const style = window.getComputedStyle(textarea_);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

    if (!ctx) return 220;

    ctx.font = font;
    const maxTextWidth = items.reduce((max, item) => {
        const metrics = ctx.measureText(`#${item}`);
        return Math.max(max, metrics.width);
    }, 0);

    return Math.ceil(maxTextWidth + 100);
}

function updateSuggestionsPosition(items: string[]) {
    const textarea_ = textarea.value;
    if (!textarea_) return;

    const text = model.value ?? '';
    const caretPos = textarea_.selectionStart ?? text.length;
    const caret = getCaretCoordinates(textarea_, caretPos);
    const rect = textarea_.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const viewportPadding = 8;
    const popupGap = 4;

    const lineHeight = parsePx(window.getComputedStyle(textarea_).lineHeight) || 19;
    const rawWidth = getSuggestionsWidth(textarea_, items);
    const width = Math.min(rawWidth, viewportWidth - viewportPadding * 2);

    const rawLeft = rect.left + caret.left;
    const left = Math.max(
        viewportPadding,
        Math.min(rawLeft, viewportWidth - width - viewportPadding)
    );

    const estimatedPopupHeight = Math.min(180, Math.max(36, items.length * 34));
    const caretTopViewport = rect.top + caret.top;
    const belowTop = caretTopViewport + lineHeight + popupGap;
    const aboveTop = caretTopViewport - estimatedPopupHeight - popupGap;

    const spaceBelow = viewportHeight - belowTop - viewportPadding;
    const spaceAbove = caretTopViewport - viewportPadding;

    const shouldOpenUp = spaceBelow < 120 && spaceAbove > spaceBelow;
    const top = shouldOpenUp
        ? Math.max(viewportPadding, aboveTop)
        : Math.min(belowTop, viewportHeight - viewportPadding - 40);

    const maxHeight = shouldOpenUp
        ? Math.max(72, Math.min(180, spaceAbove - popupGap))
        : Math.max(72, Math.min(180, spaceBelow));

    const zIndex = 2000;

    suggestionsStyle.value = {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        maxHeight: `${maxHeight}px`,
        zIndex: `${zIndex}`
    };
}

async function updateSuggestions() {
    const textarea_ = textarea.value;
    const text = model.value ?? '';
    const caretPos = textarea_?.selectionStart ?? text.length;
    const textBeforeCaret = text.slice(0, caretPos);
    const match = textBeforeCaret.match(/#([a-zA-Z0-9_]*)$/);
    const prevSelected = filteredSuggestions.value[activeSuggestionIndex.value];

    if (!match) {
        closeSuggestions();
        return;
    }

    if (showSuggestions.value === false) {
        DESIGNATORS.value = await getAllDesignators().catch(e => ['R1']);
    }

    const query = match[1].toLowerCase();
    const nextSuggestions = DESIGNATORS.value.filter(item => item.toLowerCase().startsWith(query));

    if (!nextSuggestions.length) {
        closeSuggestions();
        return;
    }

    showSuggestions.value = true;
    filteredSuggestions.value = nextSuggestions;
    const prevIdx = prevSelected ? nextSuggestions.indexOf(prevSelected) : -1;
    activeSuggestionIndex.value = prevIdx >= 0 ? prevIdx : 0;
    triggerStartIndex.value = caretPos - match[0].length;
    updateSuggestionsPosition(nextSuggestions);

    nextTick(() => ensureActiveSuggestionVisible());
}

function ensureActiveSuggestionVisible() {
    const root = suggestionsEl.value;
    if (!root) return;

    const activeItem = root.querySelector<HTMLButtonElement>('.suggestion-item.active');
    if (!activeItem) return;

    activeItem.scrollIntoView({ block: 'nearest' });
}

function applySuggestion(index: number) {
    const textarea_ = textarea.value;
    const triggerStart = triggerStartIndex.value;
    const selected = filteredSuggestions.value[index];

    if (!textarea_ || triggerStart === null || !selected) {
        closeSuggestions();
        return;
    }

    const text = model.value ?? '';
    const caretPos = textarea_.selectionStart ?? text.length;
    const before = text.slice(0, triggerStart);
    const after = text.slice(caretPos);
    const insertText = `#${selected} `;
    model.value = `${before}${insertText}${after}`;

    closeSuggestions();

    nextTick(() => {
        const newCaretPos = before.length + insertText.length;
        textarea_.focus();
        textarea_.setSelectionRange(newCaretPos, newCaretPos);
        adjustTextareaHeight();
    });
}

function onTextareaInput() {
    updateSuggestions();
}

function onTextareaScroll() {
    const textarea_ = textarea.value;
    const highlight = highlightLayer.value;
    if (!textarea_ || !highlight) return;

    syncHighlightLayout();
    highlight.scrollTop = textarea_.scrollTop;
    highlight.scrollLeft = textarea_.scrollLeft;
}

function onTextareaBlur() {
    setTimeout(() => closeSuggestions(), 100);
}

function onTextareaKeydown(e: KeyboardEvent) {
    if (showSuggestions.value && filteredSuggestions.value.length > 0) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeSuggestionIndex.value = (activeSuggestionIndex.value + 1) % filteredSuggestions.value.length;
            nextTick(() => ensureActiveSuggestionVisible());
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeSuggestionIndex.value =
                (activeSuggestionIndex.value - 1 + filteredSuggestions.value.length) % filteredSuggestions.value.length;
            nextTick(() => ensureActiveSuggestionVisible());
            return;
        }

        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            applySuggestion(activeSuggestionIndex.value);
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            closeSuggestions();
            return;
        }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        emit('enter');
    }

    nextTick(() => updateSuggestions());
}

onMounted(() => {
    window.addEventListener('resize', syncHighlightLayout);

    nextTick(() => {
        adjustTextareaHeight();
        onTextareaScroll();
    })
})

onBeforeUnmount(() => {
    window.removeEventListener('resize', syncHighlightLayout);
});

watch(model, () => {
    nextTick(() => {
        adjustTextareaHeight();
        updateSuggestions();
        onTextareaScroll();
    })
});

</script>

<style scoped>
.adj-textarea {
    position: relative;
    flex: 1;
}

.textarea-stack {
    position: relative;
    width: 100%;
}

textarea {
    flex: 1;
    position: relative;
    z-index: 1;
    width: 100%;
    box-sizing: border-box;
    padding: 0.1rem;
    background-color: transparent;
    border: none;
    color: var(--color-text);
    font-family: inherit;
    font-weight: inherit;
    letter-spacing: inherit;
    font-variant-ligatures: none;
    font-size: 16px;
    resize: none;
    overflow: auto;
    scrollbar-gutter: stable;
    outline: none;
    line-height: 1.2;
}

textarea.has-content {
    color: transparent;
    caret-color: var(--color-text);
}

.highlight-layer {
    position: absolute;
    inset: 0;
    z-index: 0;
    margin: 0;
    padding: 0.1rem;
    width: 100%;
    box-sizing: border-box;
    pointer-events: none;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    word-break: normal;
    overflow: hidden;
    color: var(--color-text);
    font-family: inherit;
    font-weight: inherit;
    letter-spacing: inherit;
    font-variant-ligatures: none;
    font-size: 16px;
    line-height: 1.2;
}

:deep(.token-designator) {
    color: var(--color-primary);
    background-color: rgb(from var(--color-primary) r g b / 12%);
}

textarea:focus {
    border-color: var(--color-primary);
}

textarea[disabled] {
    background-color: var(--color-background);
    opacity: 0.9;
}

.suggestions {
    position: fixed;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    max-height: 180px;
    overflow-y: auto;
    background: var(--color-background-secondary);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    z-index: 50;
}

.suggestion-item {
    display: block;
    width: 100%;
    text-align: left;
    border: none;
    background: transparent;
    color: var(--color-text);
    padding: 0.35rem 0.45rem;
    border-radius: 4px;
    cursor: pointer;
}

.suggestion-item:hover,
.suggestion-item.active {
    background: var(--color-surface-hover);
}
</style>