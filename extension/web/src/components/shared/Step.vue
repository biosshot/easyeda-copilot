<template>
    <div class="step" :class="{
        'step--active': isActive,
        'step--completed': isCompleted
    }" @click="activate">
        <div class="step__circle">
            <span class="step__number">{{ index + 1 }}</span>
        </div>
        <span class="step__label">
            <slot></slot>
        </span>
    </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';

const props = defineProps<{
    value: string | number;
    index: number;
}>();

const stepper = inject<{
    currentStep: any;
    setCurrentStep: (value: string | number) => void;
}>('stepper-state');

if (!stepper) {
    throw new Error('Step must be used within a Stepper component');
}

const isActive = computed(() => stepper.currentStep.value === props.value);
const isCompleted = computed(() => {
    const currentIndex = stepper.currentStep.value;
    if (typeof currentIndex === 'number' && typeof props.value === 'number') {
        return currentIndex > props.value;
    }
    return false;
});

const activate = () => {
    stepper.setCurrentStep(props.value);
};
</script>

<style scoped>
.step {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    padding: 0 1.5rem;
    position: relative;
    width: 64px;
}

.step:not(:last-child)::after {
    content: '';
    position: absolute;
    top: 19%;
    left: 50%;
    width: 100%;
    height: 2px;
    background: var(--color-border);
    z-index: 0;
}

.step--completed:not(:last-child)::after {
    background: var(--color-primary);
}

.step__circle {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 12px;
    z-index: 1;
    transition: all 0.2s;
}

.step--active .step__circle {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-text-on-primary);
}

.step--completed .step__circle {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-text-on-primary);
}

.step__label {
    margin-top: 0.5rem;
    font-size: 0.65rem;
    color: var(--color-text);
    font-weight: 500;
    text-align: center;
}

.step--active .step__label {
    color: var(--color-primary);
}

.step--completed .step__label {
    color: var(--color-text);
}
</style>
