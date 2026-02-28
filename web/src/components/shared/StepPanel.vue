<template>
    <div v-if="isActive" class="stepper-panel">
        <slot :activate="activate" :current-value="currentValue"></slot>
    </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';

const props = defineProps<{
    value: string | number;
}>();

const stepper = inject<{
    currentStep: any;
    setCurrentStep: (value: string | number) => void;
}>('stepper-state');

if (!stepper) {
    throw new Error('StepPanel must be used within a Stepper component');
}

const isActive = computed(() => stepper.currentStep.value === props.value);
const currentValue = computed(() => stepper.currentStep.value);

const activate = (stepValue?: string | number) => {
    if (stepValue !== undefined) {
        stepper.setCurrentStep(stepValue);
    }
};
</script>

<style scoped>
.stepper-panel {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1rem;
    animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
