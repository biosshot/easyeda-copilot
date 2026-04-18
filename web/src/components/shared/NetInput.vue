<template>
    <label>{{ t('netInput.signalName') }}</label>
    <div class="group">
        <input type="text" v-model="model" :placeholder="t('netInput.placeholder')" />
        <IconButton @click="selNet" :icon="inSelProgress ? 'LoaderCircle' : 'Send'" :size="16" :class="{ 'rotating': inSelProgress }" />
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { waitForWireSelect } from '../../eda/schematic';
import { showToastMessage } from '../../eda/utils';
import IconButton from './IconButton.vue';
import { t } from '../../i18n';

const model = defineModel<string>();
const inSelProgress = ref<boolean>(false)

const selNet = async () => {
    inSelProgress.value = true;

    try {
        const net = await waitForWireSelect(AbortSignal.timeout(5000));
        if (!net) return showToastMessage(t('netInput.failGetNetNameNotSelected'), 'warn');;
        model.value = net;
    } catch (error) {
        showToastMessage(t('netInput.failGetNetName', { error: (error as Error).message }), 'warn');
    }

    inSelProgress.value = false;
}
</script>

<style scoped>
label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--color-text);
    font-size: 0.85rem;
}

input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(16, 163, 127, 0.1);
}

input::placeholder {
    color: var(--color-text-tertiary);
}

input {
    width: 100%;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    color: var(--color-text);
    font-size: 0.9rem;
    box-sizing: border-box;
    transition: border-color 0.2s;
}

.group {
    display: flex;
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
</style>
