<template>
    <div class="message-controls">
        <IconButton @click="emit('retrySend')" class="retry-btn" icon="RotateCw" />
    </div>
</template>

<script setup lang="ts">
import IconButton from './IconButton.vue';

const emit = defineEmits(['retrySend']);
</script>

<style scoped></style>