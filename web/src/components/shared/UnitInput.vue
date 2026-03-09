<template>
    <div class="time-input">
        <input :id="id" :value="localValue" @change="onValueInput" :placeholder="placeholder" :step="step" :min="min" />
        <CustomSelect class="time-unit" :model-value="modelValue.unit" :options="units"
            @update:model-value="onUnitChange" />
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import CustomSelect from './CustomSelect.vue';

export interface UnitValue {
    value: number;
    unit: 'n' | 'u' | 'm' | 'base' | 'k' | 'M' | 'G';
    valueInUnits?: { 'n': number, 'u': number, 'm': number, 'base': number, 'k': number, 'M': number, 'G': number }
}

const props = withDefaults(defineProps<{
    id?: string;
    modelValue?: UnitValue;
    placeholder?: string;
    step?: string;
    min?: number;
    variant: 'time' | 'voltage' | 'freq'
}>(), {
    modelValue: () => ({
        value: 10,
        unit: 'base' as const,
        valueInUnits: { 'n': 0, 'u': 0, 'm': 0, 'base': 0, 'k': 0, 'M': 0, 'G': 0 }
    })
});

const emit = defineEmits<{
    'update:modelValue': [value: UnitValue];
}>();

const localValue = ref(props.modelValue.value);

watch(() => props.modelValue.value, (newValue) => {
    localValue.value = newValue;
});

const unitMultipliers: Record<'n' | 'u' | 'm' | 'base' | 'k' | 'M' | 'G', number> = {
    'n': 1e-9,
    'u': 1e-6,
    'm': 1e-3,
    'base': 1,
    'k': 1e3,
    'M': 1e6,
    'G': 1e9,
};

const roundToPrecision = (value: number, precision: number = 12) => {
    if (value === 0) return 0;
    const multiplier = Math.pow(10, precision);
    return Math.round(value * multiplier) / multiplier;
};

const calculateValueInUnits = (value: number, currentUnit: 'n' | 'u' | 'm' | 'base' | 'k' | 'M' | 'G') => {
    const baseValue = value * unitMultipliers[currentUnit];

    return {
        'n': roundToPrecision(baseValue / unitMultipliers.n),
        'u': roundToPrecision(baseValue / unitMultipliers.u),
        'm': roundToPrecision(baseValue / unitMultipliers.m),
        'base': roundToPrecision(baseValue),
        'k': roundToPrecision(baseValue / unitMultipliers.k),
        'M': roundToPrecision(baseValue / unitMultipliers.M),
        'G': roundToPrecision(baseValue / unitMultipliers.G),
    };
};

const onValueInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const newValue = parseFloat(target.value) || 0;
    localValue.value = newValue;

    const valueInUnits = calculateValueInUnits(newValue, props.modelValue.unit);

    emit('update:modelValue', {
        value: newValue,
        unit: props.modelValue.unit,
        valueInUnits
    });
};

const onUnitChange = (newUnit: 'n' | 'u' | 'm' | 'base' | 'k' | 'M' | 'G') => {
    const valueInUnits = calculateValueInUnits(props.modelValue.value, newUnit);

    emit('update:modelValue', {
        value: props.modelValue.value,
        unit: newUnit,
        valueInUnits
    });
};

const units = computed(() => {
    if (props.variant === 'time') return [
        { label: 'nS', value: 'n' },
        { label: 'µS', value: 'u' },
        { label: 'mS', value: 'm' },
        { label: 'S', value: 'base' },
    ];
    else if (props.variant === 'voltage') return [
        { label: 'nV', value: 'n' },
        { label: 'µV', value: 'u' },
        { label: 'mV', value: 'm' },
        { label: 'V', value: 'base' },
    ];
    else return [
        { label: 'nHz', value: 'n' },
        { label: 'µHz', value: 'u' },
        { label: 'mHz', value: 'm' },
        { label: 'Hz', value: 'base' },
        { label: 'kHz', value: 'k' },
        { label: 'MHz', value: 'M' },
        { label: 'GHz', value: 'G' }
    ];
});

onMounted(() => {
    onUnitChange(props.modelValue.unit)
})
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
