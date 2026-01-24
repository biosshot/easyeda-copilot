<template>
    <div :class="['message', msg.role]">
        <div v-if="msg.role === 'ai'" class="avatar">
            <Icon name="Cpu" size="20" />
        </div>

        <div>
            <ChatMessageContent :message="msg" :idx="idx" @inline-buttons="onInlineButtons"
                @edit-message="onEditMessage" ref="content" />
            <div v-if="msg.role === 'human'">
                <MessageBottomControls @retry="emit('retry-send')" @edit="content?.toggleEdit()"
                    :show="['edit', 'retry']" />
            </div>
            <div v-if="msg.role === 'ai'">
                <MessageBottomControls @retry="emit('retry-send')" :show="['retry']" />
            </div>
        </div>

        <div v-if="msg.role === 'human'" class="avatar">
            <Icon :name="getUserInfo()?.avatar ?? 'User'" fail-name="User" size="20" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ChatMessage } from '../../stores/chat-history-store';
import { InlineButtonsIdx } from '../../types/inline-button';
import ChatMessageContent from './ChatMessageContent.vue';
import MessageBottomControls from './MessageBottomControls.vue';
import Icon from '../shared/Icon.vue';
import { getUserInfo } from '../../eda/user';

const props = defineProps<{ msg: ChatMessage, idx: number }>();
const content = ref<typeof ChatMessageContent | null>(null);

const emit = defineEmits<{
    'inline-buttons': [InlineButtonsIdx],
    'edit-message': [number, string],
    'retry-send': [],
}>()

const onInlineButtons = (btns: InlineButtonsIdx) => {
    emit('inline-buttons', btns)
}

const onEditMessage = (newContent: string) => {
    emit('edit-message', props.idx, newContent);
}

</script>

<style scoped>
.message {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    max-width: 100%;
}

.message.human {
    align-self: flex-end;
}

.message.ai .avatar {
    background-color: var(--color-primary);
    border-radius: 50%;
    min-width: 32px;
    max-width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-on-primary);
}

.message.human .avatar {
    background-color: var(--color-surface-hover);
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-on-surface);
}
</style>
