<template>
    <div v-if="todos.length" class="todos-section" :class="{ 'collapsed': !showTodos }">
        <div class="todos-header" @click="showTodos = !showTodos">
            <IconButton :size="12" :icon="showTodos ? 'ChevronUp' : 'ChevronDown'" class="collapse-btn" />
            <span>Todos ({{ todos.length }})</span>
        </div>
        <div v-if="showTodos" class="todos-list">
            <div v-for="(todo, idx) in todos" :key="idx" class="todo-item" :class="['status-' + todo.status]">
                <!-- <div class="todo-status-indicator"></div> -->
                <Icon v-if="todo.status === 'pending'" :size="11" name="CircleDashed" class="todo-status-indicator" />
                <Icon v-else-if="todo.status === 'completed'" :size="11" name="CircleCheck"
                    class="todo-status-indicator" />
                <Icon v-else-if="todo.status === 'in_progress'" :size="11" name="LoaderCircle"
                    class="todo-status-indicator" />

                <div class="todo-content">{{ todo.content }}</div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import IconButton from './IconButton.vue';
import Icon from './Icon.vue';

const showTodos = ref<boolean>(false);
const props = defineProps<{
    todos: {
        status: "pending" | "in_progress" | "completed";
        content: string;
    }[]
}>()

</script>

<style scoped>
.todos-section {
    z-index: 100;
    max-height: 200px;
    display: flex;
    flex-direction: column;
    transition: max-height 0.2s ease;
    background-color: var(--color-background);
}

.todos-section.collapsed {
    max-height: 32px;
}

.todos-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--color-text);
    cursor: pointer;
}

.todos-header:hover {}

.collapse-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    /* width: 18px; */
    /* min-width: 18px; */
    padding: 0;
}

.todos-list {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    flex: 1;
    padding: 0.5rem 0.75rem;
    min-height: 0;
}

.todo-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.8rem;
    color: var(--color-text);
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

.todo-item.status-pending .todo-status-indicator {
    color: #fbbf24;
    animation: spin 2s linear infinite;
}

.todo-item.status-in_progress .todo-status-indicator {
    color: #60a5fa;
    animation: spin 1s linear infinite;
}

.todo-item.status-completed .todo-status-indicator {
    color: #34d399;
}

.todo-content {
    flex: 1;
    /* white-space: nowrap; */
    overflow: hidden;
    /* text-overflow: ellipsis; */
    line-height: 1.4;
}
</style>