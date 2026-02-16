<template>
    <div :class="['message', msg.role]">
        <div v-if="msg.role === 'ai' && isFirstInGroup" class="avatar">
            <Icon name="Cpu" size="20" />
        </div>
        <div v-else-if="msg.role === 'ai' && !isFirstInGroup" class="avatar-placeholder"></div>

        <div>
            <Collapsible v-if="msg.thinking" title="Thinking" :default-open="false">
                <p class="thinking">{{ msg.thinking }}</p>
            </Collapsible>

            <ChatMessageContent :message="msg" :idx="idx" @inline-buttons="onInlineButtons"
                @edit-message="onEditMessage" ref="content" />
            <div v-if="msg.role === 'human'">
                <MessageBottomControls class="bottom-cnt" @retry="emit('retry-send', idx)" @edit="content?.toggleEdit()"
                    @delete="emit('delete-message', idx)" :show="['edit', 'retry', 'delete']" />
            </div>
            <div v-if="msg.role === 'ai'">
                <!-- for showing only if msg.isReady === false -->
                <MessageBottomControls v-if="!(msg.isReady === false) && isLastInGroup" class="bottom-cnt"
                    @retry="emit('retry-send', firstInGroupIdx)" :show="['retry']" />
            </div>
        </div>

        <div v-if="msg.role === 'human'" class="avatar">
            <Icon :name="getUserInfo()?.avatar ?? 'User'" fail-name="User" size="20" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ChatMessage } from '../../stores/chat-history-store';
import { InlineButtonsIdx } from '../../types/inline-button';
import ChatMessageContent from './ChatMessageContent.vue';
import MessageBottomControls from './MessageBottomControls.vue';
import Icon from '../shared/Icon.vue';
import { getUserInfo } from '../../eda/user';
import Collapsible from '../shared/Collapsible.vue';

const props = defineProps<{ msg: ChatMessage, idx: number, isFirstInGroup: boolean, isLastInGroup: boolean, firstInGroupIdx: number }>();
const content = ref<typeof ChatMessageContent | null>(null);

const emit = defineEmits<{
    'inline-buttons': [InlineButtonsIdx],
    'edit-message': [number, string],
    'retry-send': [number],
    'delete-message': [number]
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

    .bottom-cnt {
        visibility: hidden;
    }
}

.message:hover {
    .bottom-cnt {
        visibility: visible;
    }
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

.avatar-placeholder {
    min-width: 32px;
    max-width: 32px;
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

.thinking {
    max-height: 400px;
    overflow-y: auto;
    overflow-x: hidden;
    white-space: pre-line;
    color: var(--color-text-muted);
}
</style>
