<template>
    <div class="container">
        <div class="typing-dots" :style="{ marginLeft: dotsPosition === 'left' ? 0 : undefined }">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
        </div>
        <p v-if="props.status" class="progress-text">{{ status }}</p>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ status: string, dotsPosition?: 'left' }>();

const status = computed(() => {
    const MAX = 320;
    if (props.status.length > MAX)
        return props.status.slice(0, MAX) + '...'
    return props.status;
})

</script>

<style scoped>
.container {
    display: flex;
    flex-direction: column;
    padding: 0.6rem 0.8rem;
    color: var(--color-text);
    font-size: 0.9rem;
    max-width: 60%;
}

.progress-text {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    font-weight: 400;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.typing-dots {
    margin: 0 auto;
    margin-bottom: -4px;
    height: 12px;
    display: flex;
    gap: 4px;
}

.dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-primary);
    animation: typing 1.4s infinite;
}

.dot:nth-child(1) {
    animation-delay: 0s;
}

.dot:nth-child(2) {
    animation-delay: 0.2s;
}

.dot:nth-child(3) {
    animation-delay: 0.4s;
}

@keyframes typing {

    0%,
    60%,
    100% {
        transform: translateY(0);
        opacity: 0.7;
    }

    30% {
        transform: translateY(-8px);
        opacity: 1;
    }
}
</style>