<template>
    <div class="stepper">
        <StepList>
            <Step v-for="(step, index) in props.steps" :key="step.id" :value="index" :index="index">
                {{ step.label }}
            </Step>
        </StepList>

        <slot></slot>

        <div class="stepper-footer">
            <button v-if="currentStep > 0" class="back-button" @click="prevStep">
                <Icon name="ArrowLeft" size="16" />
                {{ t('stepper.back') }}
            </button>
            <span class="footer-spacer"></span>
            <button class="next-button" @click="nextStep">
                {{ isLastStep ? (props.finishButtonText || t('stepper.finish')) : t('stepper.next') }}
                <Icon :name="isLastStep ? (finishButtonIcon ?? 'ArrowRight') : 'ArrowRight'" size="16" />
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue';
import StepList from './StepList.vue';
import Step from './Step.vue';
import Icon from './Icon.vue';
import { t } from '../../i18n';

const props = defineProps<{
    steps: {
        id: string;
        label: string;
    }[],
    finishButtonText?: string,
    finishButtonIcon?: string,
}>();

const emit = defineEmits<{
    'change': [value: number];
    'finish': [value: number];
}>();

const isLastStep = computed(() => currentStep.value === props.steps.length - 1)

const currentStep = ref<number>(0);

const setCurrentStep = (value: number) => {
    currentStep.value = value;
    emit('change', value);
};


const prevStep = () => {
    if (currentStep.value > 0) {
        currentStep.value--;
    }
};

const nextStep = () => {
    if (currentStep.value < props.steps.length - 1) {
        currentStep.value++;
    }

    if (currentStep.value === props.steps.length - 1) emit('finish', currentStep.value);
};

provide('stepper-state', {
    currentStep,
    setCurrentStep
});
</script>

<style scoped>
.stepper {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
}


.stepper-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
    border-top: 1px solid var(--color-border);
    background: var(--color-background);
}

.footer-spacer {
    flex: 1;
}

.back-button,
.next-button,
.run-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 4px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
}

.back-button {
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text);
    padding: 0.2rem 0.8rem 0.2rem 0.3rem;
}

.back-button:hover {
    background: var(--color-surface-hover);
    border-color: var(--color-border-light);
}

.next-button {
    background: var(--color-primary);
    border: none;
    color: var(--color-text-on-primary);
    padding: 0.2rem 0.3rem 0.2rem 0.8rem;
}

.next-button:hover {
    opacity: 0.9;
}

.run-button {
    background: var(--color-primary);
    border: none;
    color: var(--color-text-on-primary);
    padding: 0.2rem 0.8rem 0.2rem 0.3rem;
}

.run-button:hover {
    opacity: 0.9;
}

.run-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
