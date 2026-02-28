<template>
    <div class="time-input">
        <input :id="id" type="number" :value="modelValue.value"
            @input="emit('update:modelValue', { value: Number(($event.target as HTMLInputElement).value), unit: modelValue.unit })"
            :placeholder="placeholder" :step="step" :min="min" />
        <CustomSelect class="time-unit" :model-value="modelValue.unit" :options="[
            { label: 'ns', value: 'ns' },
            { label: 'µs', value: 'us' },
            { label: 'ms', value: 'ms' },
            { label: 's', value: 's' }
        ]" @update:model-value="emit('update:modelValue', { value: modelValue.value, unit: $event })" />
    </div>
</template>

<script setup lang="ts">
import CustomSelect from './CustomSelect.vue';

interface TimeValue {
    value: number;
    unit: 'ns' | 'us' | 'ms' | 's';
}

const props = defineProps<{
    id?: string;
    modelValue: TimeValue;
    placeholder?: string;
    step?: string;
    min?: number;
}>();

const emit = defineEmits<{
    'update:modelValue': [value: TimeValue];
}>();
</script>

<style scoped>
.time-input {
    display: flex;
    gap: 0.5rem;
}

.time-input input {
    flex: 1;
    min-width: 0;
    width: 100%;
    padding: 0.6rem 0.75rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    color: var(--color-text);
    font-size: 0.9rem;
    box-sizing: border-box;
    transition: border-color 0.2s;
}

.time-input input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(16, 163, 127, 0.1);
}

.time-input input::placeholder {
    color: var(--color-text-tertiary);
}

.time-input :deep(.custom-select) {
    width: 80px;
    flex-shrink: 0;
}

.time-unit {
    width: auto;
}
</style>
