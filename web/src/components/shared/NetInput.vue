<template>
    <label>Signal Name / Node</label>
    <div class="group">
        <input type="text" v-model="model" placeholder="e.g., VCC, INP_SIN" />
        <!-- <IconButton @click="selNet" icon="Send" :size="20" /> -->
    </div>
</template>

<script setup lang="ts">
import { getSelectedWireName } from '../../eda/schematic';
import { showToastMessage } from '../../eda/utils';
import IconButton from './IconButton.vue';

const model = defineModel<string>();

const selNet = async () => {
    try {
        const net = await getSelectedWireName();
        if (!net) return showToastMessage('Fail get net name not selected', 'warn');;
        model.value = net;
    } catch (error) {
        showToastMessage('Fail get net name ' + (error as Error).message, 'warn');
    }

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
    background: var(--color-surface);
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
</style>
