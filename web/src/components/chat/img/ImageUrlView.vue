<template>
    <div class="image-url-viewer">
        <template v-if="imageUrl && !error">
            <img :src="imageUrl" :alt="props.result.label || 'Image'" @error="handleError" />
            <div v-if="props.result.label" class="image-label">{{ props.result.label + `\n ATTENTION IMAGES ARE NOT SENT
                BETWEEN REQUESTS` }}</div>
        </template>
        <template v-else>
            <div class="error-state">
                <Icon name="CircleAlert" size="20" class="error-icon" />
                <span>Failed to load image</span>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Icon from '../../shared/Icon.vue'

const props = defineProps<{ result: { image_url?: string, label?: string } }>();

const imageUrl = ref(props.result.image_url);
const error = ref(false);

function handleError() {
    error.value = true;
}
</script>

<style scoped>
.image-url-viewer {
    display: inline-block;
    max-width: 99%;
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

.error-state {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-error-border, #e53e3e);
    border-radius: 0.5rem;
    color: var(--color-error, #e53e3e);
    font-size: 0.9rem;
}

.error-icon {
    flex-shrink: 0;
}
</style>
