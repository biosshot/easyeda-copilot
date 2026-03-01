<template>
    <div class="message-controls">
        <IconButton v-if="props.show.includes('retry')" @click="emit('retry')" icon="RotateCw" title="Retry message" />
        <IconButton v-if="props.show.includes('edit')" @click="emit('edit')" icon="Pencil" title="Edit message" />
        <IconButton v-if="props.show.includes('delete')" @click="emit('delete')" icon="Trash" title="Delete message" />
    </div>
</template>

<script setup lang="ts">
import IconButton from '../shared/IconButton.vue';

const props = defineProps<{ show: ('retry' | 'edit' | 'delete')[] }>();
const emit = defineEmits(['retry', 'edit', 'delete']);
</script>

<style scoped>
.message-controls {
    display: flex;
    flex-direction: row;
}
</style>