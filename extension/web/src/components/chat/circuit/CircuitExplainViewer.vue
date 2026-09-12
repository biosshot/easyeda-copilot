<!-- ComponentViewer.vue -->
<template>
    <div v-html="html"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { markdown } from '../../../utils/markdown';
import DOMPurify from 'dompurify';

const props = defineProps<{ result: string }>();

// Fallback, если парсинг JSON провалился — отображаем как plain text или markdown
const html = computed(() => {
    const html = markdown(props.result)
    return DOMPurify.sanitize(html, {
        ADD_ATTR: ['target'],
        FORBID_TAGS: ['script', 'style', 'iframe'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick']
    })
});

</script>