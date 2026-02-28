<template>
    <div style="display: flex; flex-direction: row;">
        <label>{{ props.title }}</label>
        <div style="margin-left: auto;">
            <slot></slot>
        </div>
    </div>

    <div class="setting-group">
        <div style="display: flex;">
            <label>Model</label>
            <div style="margin-left: auto;">
                <Icon v-if="props.modelFeatures?.includes('json')" name="CodeXml" :size="14"
                    title="The model must be able to use structured output" />
                <Icon v-if="props.modelFeatures?.includes('image')" name="Image" :size="14"
                    title="The model must be able to use image/vision" />
                <Icon v-if="props.modelFeatures?.includes('tools')" name="Wrench" :size="14"
                    title="The model must be able to use tools" />
            </div>
        </div>

        <input :value="props.model" type="text" placeholder="e.g., gpt-5.2"
            @change="emits('modelChange', ($event.target as HTMLInputElement).value)" />
        <p class="hint">{{ props.desc }}</p>
    </div>

    <div class="setting-group">
        <label>Reasoning effort</label>
        <CustomSelect :model-value="reasoning" @update:model-value="emits('reasoningChange', $event)" :options="[{ label: 'Minimal', value: 'minimal' }, { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' }, { label: 'High', value: 'high' }]" />
    </div>
</template>


<script setup lang="ts">
import CustomSelect from '../shared/CustomSelect.vue';
import Icon from '../shared/Icon.vue';

const props = defineProps<{ title: string, model: string, desc: string, reasoning: string, modelFeatures?: ('image' | 'tools' | 'json')[] }>();
const emits = defineEmits<{
    modelChange: [string],
    reasoningChange: [string]
}>();

</script>

<style scoped>
@import url("./shared.css");

label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--color-text);
    font-size: 1.1rem;
}
</style>
