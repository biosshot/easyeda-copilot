<template>
    <div class="timer">
        <span class="timer-text">{{ `${elapsed.toFixed(2)}s` }}</span>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';

const elapsed = ref(0); // in milliseconds
let intervalId: number | null = null;

const start = () => {
    if (intervalId !== null) return;
    const startTime = Date.now();
    intervalId = window.setInterval(() => {
        elapsed.value = (Date.now() - startTime) / 1000;
    }, 200);
};

const stop = () => {
    if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
    }
};

const reset = () => {
    stop();
    elapsed.value = 0;
};

defineExpose({
    start,
    stop,
    reset,
    elapsed,
});

onMounted(() => {
    start();
});

onUnmounted(() => {
    stop();
});
</script>

<style scoped>
.timer {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 5px;
}

.timer-text {
    font-size: 12px;
    color: var(--color-text);
}
</style>
