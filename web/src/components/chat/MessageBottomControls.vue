<template>
    <div class="message-controls">
        <IconButton v-if="props.show.includes('retry')" @click="emit('retry')" icon="RotateCw" :title="t('chatMessage.retryMessage')" />
        <IconButton v-if="props.show.includes('copy')" @click="emit('copy')" icon="Copy" :title="t('chatMessage.copyMessage')" />
        <IconButton v-if="props.show.includes('edit')" @click="emit('edit')" icon="Pencil" :title="t('chatMessage.editMessage')" />
        <IconButton v-if="props.show.includes('delete')" @click="emit('delete')" icon="Trash" :title="t('chatMessage.deleteMessage')" />
    </div>
</template>

<script setup lang="ts">
import IconButton from '../shared/IconButton.vue';
import { t } from '../../i18n';

const props = defineProps<{ show: ('retry' | 'edit' | 'delete' | 'copy')[] }>();
const emit = defineEmits(['retry', 'edit', 'delete', 'copy']);
</script>

<style scoped>
.message-controls {
    display: flex;
    flex-direction: row;
}
</style>