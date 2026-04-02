<template>
    <div v-if="(displayImage && !error) || (error && !disableError)" class="image-url-viewer">
        <template v-if="displayImage && !error">
            <img :src="displayImage" :alt="props.result.label || 'Image'" @error="handleError" />
            <div v-if="props.result.label" class="image-label">{{ props.result.label + `\n ATTENTION IMAGES ARE NOT SENT
                BETWEEN REQUESTS` }}</div>
        </template>
        <template v-else-if="!disableError">
            <ErrorBanner message="Failed to load image" />
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ErrorBanner from '../../shared/ErrorBanner.vue';

const props = defineProps<{ result: { image_url?: string, label?: string }, disableError?: boolean }>();
const displayImage = computed(() => props.result.image_url);

const error = ref(false);

function handleError() {
    error.value = true;
}

watch(displayImage, () => {
    error.value = false;
})

</script>

<style scoped>
.image-url-viewer {
    display: inline-block;
    max-width: 99%;
    height: fit-content;
    padding: 5px;
}

.image-url-viewer img {
    max-width: 99%;
    height: auto;
    border-radius: 0.5rem;
    border: 1px solid var(--color-border);
}

.image-label {
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: var(--color-text-tertiary);
    text-align: center;
}
</style>
