<template>
    <div :class="['error-banner', `error-banner--${props.type}`]" :key="props.message" role="alert" aria-live="polite">
        <div class="error-content">
            <Icon class="error-icon" :name="iconName" size="20" :aria-label="ariaLabel" />
            <div class="error-text">{{ props.message }}</div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import Icon from './Icon.vue';

const props = withDefaults(defineProps<{
    message: string;
    type?: 'error' | 'warn';
}>(), {
    type: 'error'
});

// Динамические параметры в зависимости от типа
const iconName = computed(() =>
    props.type === 'warn' ? 'TriangleAlert' : 'CircleAlert'
);

const ariaLabel = computed(() =>
    props.type === 'warn' ? 'Предупреждение' : 'Ошибка'
);
</script>

<style scoped>
.error-banner {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    border: 1px solid var(--color-border);
    color: var(--color-text-on-surface);
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.95rem;
    width: 95%;
    max-width: 600px;
    gap: 0.5rem;
    background-color: var(--color-surface, #ffffff);
    transition: border-color 0.2s ease;
}

/* Режим ошибки */
.error-banner--error {
    animation: wiggle-in 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
    border-color: var(--color-error-border, #e53e3e);
}

.error-banner--error .error-icon {
    color: var(--color-error, #e53e3e);
}

/* Режим предупреждения */
.error-banner--warn {
    animation: fade-in 0.3s ease-in-out both;
    border-color: var(--color-warn-border, #dd6b20);
}

.error-banner--warn .error-icon {
    color: var(--color-warn, #dd6b20);
}

/* Иконка */
.error-icon {
    flex-shrink: 0;
}

/* Контент и текст */
.error-content {
    display: flex;
    align-items: center;
    justify-content: start;
    max-width: 100%;
    gap: 0.5rem;
}

.error-text {
    max-width: 90%;
    word-wrap: break-word;
    line-height: 1.4;
}

/* Анимации */
@keyframes wiggle-in {
    0% {
        opacity: 0;
        transform: translateX(0);
    }

    10%,
    30%,
    50%,
    70%,
    90% {
        transform: translateX(-2px);
    }

    20%,
    40%,
    60%,
    80% {
        transform: translateX(2px);
    }

    100% {
        opacity: 1;
        transform: translateX(0);
    }
}

@keyframes fade-in {
    0% {
        opacity: 0;
        transform: translateY(-3px);
    }

    100% {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Адаптивность */
@media (prefers-reduced-motion: reduce) {
    .error-banner {
        animation: none !important;
        transition: none;
    }
}
</style>