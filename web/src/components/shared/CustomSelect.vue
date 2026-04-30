<template>
    <div class="custom-select-wrapper" ref="wrapper">
        <button :id="id" class="custom-select-button" :class="{ 'is-open': isOpen }" @click="toggleOpen"
            @keydown.escape="closeDropdown" @keydown.arrow-up="navigateUp" @keydown.arrow-down="navigateDown"
            @keydown.enter="selectCurrentOption">
            <span class="select-label">{{ selectedLabel }}</span>
            <Icon class="select-icon" name="ChevronUp" size="16" />
        </button>

        <transition name="dropdown">
            <div v-if="isOpen" class="custom-select-dropdown">
                <div class="dropdown-list">
                    <button v-for="(option, index) in props.options" :key="option.value" class="dropdown-item" :class="{
                        'is-selected': option.value === modelValue,
                        'is-hovered': index === hoveredIndex
                    }" @click="selectOption(option.value)" @mouseenter="hoveredIndex = index"
                        @mouseleave="hoveredIndex = -1">
                        <span class="item-label">{{ option.label }}</span>
                        <span v-if="option.value === modelValue" class="item-checkmark">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"
                                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                stroke-linejoin="round">
                                <Icon name="Check" size="12" />
                            </svg>
                        </span>
                    </button>

                    <span v-if="!props.options.length" class="item-label" style="margin: auto;">Empty</span>
                </div>
            </div>
        </transition>

        <!-- Невидимый инпут для совместимости с формами -->
        <input type="hidden" :value="modelValue" />
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import Icon from './Icon.vue';

const emit = defineEmits(['update:modelValue']);

const isOpen = ref(false);
const hoveredIndex = ref(-1);
const wrapper = ref(null);

const selectedLabel = computed(() => {
    const selected = props.options.find(opt => opt.value === props.modelValue);
    return selected ? selected.label : 'Select...';
});

const props = defineProps({
    id: {
        type: String,
        default: () => `select-${Math.random().toString(36).substr(2, 9)}`
    },
    modelValue: {
        type: String,
        required: true
    },
    options: {
        type: Array,
        required: true
    }
});

const toggleOpen = () => {
    isOpen.value = !isOpen.value;
    if (isOpen.value) {
        hoveredIndex.value = props.options.findIndex(opt => opt.value === props.modelValue);
    }
};

const closeDropdown = () => {
    isOpen.value = false;
    hoveredIndex.value = -1;
};

const selectOption = (value) => {
    emit('update:modelValue', value);
    closeDropdown();
};

const navigateUp = () => {
    if (!isOpen.value) {
        toggleOpen();
        return;
    }
    hoveredIndex.value = Math.max(0, hoveredIndex.value - 1);
};

const navigateDown = () => {
    if (!isOpen.value) {
        toggleOpen();
        return;
    }
    hoveredIndex.value = Math.min(props.options.length - 1, hoveredIndex.value + 1);
};

const selectCurrentOption = () => {
    if (isOpen.value && hoveredIndex.value >= 0) {
        selectOption(props.options[hoveredIndex.value].value);
    } else {
        toggleOpen();
    }
};

const handleClickOutside = (event) => {
    if (wrapper.value && !wrapper.value.contains(event.target)) {
        closeDropdown();
    }
};

onMounted(() => {
    document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.custom-select-wrapper {
    position: relative;
    display: inline-block;
    width: 100%;
}

.custom-select-button {
    width: 100%;
    padding: 7px 12px;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text);
    font-size: 0.9rem;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    z-index: 10;
}

.custom-select-button:hover {
    border-color: var(--color-border-light);
    background: var(--color-surface);
}

.custom-select-button:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(16, 163, 127, 0.1);
}

.custom-select-button.is-open {
    border-color: var(--color-primary);
    background: var(--color-surface);
    box-shadow: 0 0 0 3px rgba(16, 163, 127, 0.1);
}

.select-label {
    flex: 1;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.select-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--color-text-muted);
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s;
    transform: rotate(180deg);
}

.custom-select-button.is-open .select-icon {
    transform: rotate(0deg);
    color: var(--color-primary);
}

.custom-select-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 0.5rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    box-shadow:
        0 10px 25px -5px rgba(0, 0, 0, 0.3),
        0 10px 10px -5px rgba(0, 0, 0, 0.04);
    z-index: 20;
    overflow: hidden;
}

.dropdown-list {
    display: flex;
    flex-direction: column;
    max-height: 300px;
    overflow-y: auto;
    padding: 0.375rem 0;
}

.dropdown-item {
    width: 100%;
    padding: 0.75rem;
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
    gap: 0.75rem;
    transition: all 0.15s;
    position: relative;
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

.item-checkmark {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--color-primary);
    animation: scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Скролл для дропдауна */
.dropdown-list::-webkit-scrollbar {
    width: 8px;
}

.dropdown-list::-webkit-scrollbar-track {
    background: transparent;
}

.dropdown-list::-webkit-scrollbar-thumb {
    background: var(--color-border-light);
    border-radius: 4px;
    transition: background 0.2s;
}

.dropdown-list::-webkit-scrollbar-thumb:hover {
    background: var(--color-surface-active);
}

/* Анимации */
.dropdown-enter-active,
.dropdown-leave-active {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdown-enter-from {
    opacity: 0;
    transform: translateY(-8px);
}

.dropdown-leave-to {
    opacity: 0;
    transform: translateY(-8px);
}

@keyframes scaleIn {
    from {
        opacity: 0;
        transform: scale(0.8);
    }

    to {
        opacity: 1;
        transform: scale(1);
    }
}
</style>
