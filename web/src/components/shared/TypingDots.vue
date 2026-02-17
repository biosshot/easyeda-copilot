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
    max-width: 90%;
}

.progress-text {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    font-weight: 400;

    max-width: 350px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    position: relative;
}

.progress-text::before {
    content: '';
    position: absolute;
    left: -120%;
    top: 0;
    height: 100%;
    width: 120%;
    background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.7) 50%, transparent 100%);
    pointer-events: none;
    animation: wave 1.6s linear infinite;
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

@keyframes wave {
    0% {
        left: -120%;
    }

    100% {
        left: 120%;
    }
}
</style>