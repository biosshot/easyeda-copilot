<template>
    <IconButton class="cancel-button" @click="cancelDigitization" :size="16" icon="Square">
        Cancel
    </IconButton>
</template>

<script setup>
import IconButton from './IconButton.vue';

</script>

<style scoped>
.cancel-button {
    padding: 4px 8px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 14px 5px 10px;
    margin: auto;
    background: var(--color-error);
    color: white;
    padding: 6px 16px 6px 10px;
}

.cancel-button:hover {
    opacity: 0.9;
}
</style>