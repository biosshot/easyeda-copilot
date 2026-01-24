<template>
    <div class="message-controls">
        <IconButton v-if="props.show.includes('retry')" @click="emit('retry')" class="retry-btn" icon="RotateCw"
            title="Retry message" />
        <IconButton v-if="props.show.includes('edit')" @click="emit('edit')" class="edit-btn" icon="Pencil"
            title="Edit message" />
    </div>
</template>

<script setup lang="ts">
import IconButton from '../shared/IconButton.vue';

const props = defineProps<{ show: ('retry' | 'edit')[] }>();
const emit = defineEmits(['retry', 'edit']);
</script>

<style scoped>
.message-controls {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
}
</style>