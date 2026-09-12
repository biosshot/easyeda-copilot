<template>
    <div class="model-select-wrapper">
        <div class="model-input-container" ref="wrapper">
            <input ref="inputRef" :value="inputValue" type="text"
                :placeholder="props.placeholder || 'Select or type model name'" @input="onInput" @change="onChange"
                @focus="openDropdown" @keydown.arrow-down="navigateDown" @keydown.arrow-up="navigateUp"
                @keydown.enter="selectCurrent" @keydown.escape="closeDropdown" @keydown.tab="closeDropdown"
                class="model-input" />
            <button class="dropdown-toggle" @click="toggleDropdown" tabindex="-1">
                <Icon name="ChevronUp" size="16" :class="{ 'is-open': isDropdownOpen }" />
            </button>

            <transition name="dropdown">
                <div v-if="isDropdownOpen" class="model-dropdown">
                    <div class="dropdown-list">
                        <button v-for="(model, index) in filteredModels" :key="model.id" class="dropdown-item"
                            :class="{ 'is-selected': model.id === modelValue, 'is-hovered': index === hoveredIndex }"
                            @click="selectModel(model.id)" @mouseenter="hoveredIndex = index">
                            <span class="item-label">{{ model.name }}</span>
                            <span v-if="model.contextLength" class="item-context">{{
                                formatContextLength(model.contextLength) }}</span>
                            <Icon v-if="model.id === modelValue" name="Check" size="14" class="item-checkmark" />
                        </button>
                        <div v-if="filteredModels.length === 0 && models.length > 0" class="dropdown-empty">
                            No models match "{{ inputValue }}"
                        </div>
                        <div v-if="models.length === 0 && !isLoading" class="dropdown-empty">
                            No models.
                        </div>
                        <div v-if="isLoading" class="dropdown-loading">
                            <Icon name="LoaderCircle" size="14" class="rotating" />
                            Loading...
                        </div>
                    </div>
                </div>
            </transition>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import Icon from '../shared/Icon.vue';
import { fetchModelsCached, PROVIDER_CONFIGS } from './model-сache';

export interface LlmModel {
    id: string;
    name: string;
    contextLength?: number | null;
}

const props = defineProps<{
    modelValue: string;
    provider: string;
    baseUrl?: string;
    apiKey: string;
    label?: string;
    placeholder?: string;
}>();

const emit = defineEmits<{
    'update:llm-model': [string];
}>();

const isDropdownOpen = ref(false);
const hoveredIndex = ref(-1);
const isLoading = ref(false);
const models = ref<LlmModel[]>([]);
const wrapper = ref<HTMLDivElement | null>(null);

const inputValue = ref(props.modelValue);

watch(() => props.modelValue, (newVal) => {
    inputValue.value = newVal;
});

const filteredModels = computed(() => {
    const query = inputValue.value.toLowerCase().trim();
    if (!query) return models.value;
    return models.value.filter(m =>
        m.name.toLowerCase().includes(query) ||
        m.id.toLowerCase().includes(query)
    );
});

async function loadModels() {
    // @ts-ignore
    const config = PROVIDER_CONFIGS[props.provider];
    if (config?.staticModels) {
        models.value = config.staticModels;
        return;
    }

    if (!props.apiKey) return;

    isLoading.value = true;
    try {
        models.value = await fetchModelsCached(props.provider, props.baseUrl, props.apiKey);
    } catch (err) {
        models.value = [];
    } finally {
        isLoading.value = false;
    }
}

const openDropdown = () => {
    isDropdownOpen.value = true;
    hoveredIndex.value = filteredModels.value.findIndex(m => m.id === props.modelValue);
};

const closeDropdown = () => {
    isDropdownOpen.value = false;
    hoveredIndex.value = -1;
};

const toggleDropdown = () => {
    if (isDropdownOpen.value) closeDropdown();
    else openDropdown();
};

const selectModel = (modelId: string) => {
    inputValue.value = modelId;
    emit('update:llm-model', modelId);
    closeDropdown();
};

const onInput = (event: Event) => {
    const value = (event.target as HTMLInputElement).value;
    inputValue.value = value;
};

const onChange = (event: Event) => {
    const value = (event.target as HTMLInputElement).value;
    emit('update:llm-model', value);
};

const navigateUp = () => {
    if (!isDropdownOpen.value) {
        openDropdown();
        return;
    }
    hoveredIndex.value = Math.max(0, hoveredIndex.value - 1);
};

const navigateDown = () => {
    if (!isDropdownOpen.value) {
        openDropdown();
        return;
    }
    hoveredIndex.value = Math.min(filteredModels.value.length - 1, hoveredIndex.value + 1);
};

const selectCurrent = () => {
    if (isDropdownOpen.value && hoveredIndex.value >= 0 && filteredModels.value[hoveredIndex.value]) {
        selectModel(filteredModels.value[hoveredIndex.value].id);
    } else {
        if (inputValue.value) {
            emit('update:llm-model', inputValue.value);
        }
        closeDropdown();
    }
};

const formatContextLength = (length: number) => {
    if (length >= 1000000) return `${(length / 1000000).toFixed(1)}M`;
    if (length >= 1000) return `${(length / 1000).toFixed(0)}K`;
    return length.toString();
};

const handleClickOutside = (event: MouseEvent) => {
    if (wrapper.value && !wrapper.value.contains(event.target as Node)) {
        closeDropdown();
    }
};

watch(() => [props.provider, props.baseUrl, props.apiKey], () => {
    loadModels();
}, {
    immediate: true
});

onMounted(() => {
    document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
});

defineExpose({ loadModels });
</script>

<style scoped>
@import url("./shared.css");

.model-select-wrapper {
    width: 100%;
}

.rotating {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

.model-input-container {
    position: relative;
    display: flex;
    align-items: center;
}

.model-input {
    width: 100%;
    padding: 7px 40px 7px 12px;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text);
    font-size: 0.9rem;
    font-family: inherit;
    transition: all 0.2s;
    box-sizing: border-box;
}

.model-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(16, 163, 127, 0.1);
}

.model-input::placeholder {
    color: var(--color-text-tertiary);
}

.dropdown-toggle {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
}

.dropdown-toggle:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
}

.dropdown-toggle .is-open {
    transform: rotate(180deg);
}

.model-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    z-index: 100;
    overflow: hidden;
}

.dropdown-list {
    display: flex;
    flex-direction: column;
    max-height: 280px;
    overflow-y: auto;
}

.dropdown-item {
    width: 100%;
    padding: 0.625rem 0.75rem;
    background: transparent;
    border: none;
    color: var(--color-text);
    font-size: 0.9rem;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.15s;
}

.dropdown-item:hover,
.dropdown-item.is-hovered {
    background: var(--color-surface-hover);
}

.dropdown-item.is-selected {
    color: var(--color-primary);
    font-weight: 500;
}

.item-label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.item-context {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
    flex-shrink: 0;
}

.dropdown-empty,
.dropdown-loading {
    padding: 1rem;
    text-align: center;
    color: var(--color-text-tertiary);
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
}
</style>