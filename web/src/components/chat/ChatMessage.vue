<template>
    <div :class="['message', msg.role]">
        <!-- <div v-if="msg.role === 'ai' && isFirstInGroup" class="avatar">
            <Icon name="Cpu" size="20" />
        </div>
        <div v-else-if="msg.role === 'ai' && !isFirstInGroup" class="avatar-placeholder"></div> -->

        <div class="message-content-wrapper">
            <div class="content-inner">
                <div v-if="msg.attachments && msg.attachments.length > 0" class="attachments">
                    <div v-for="file in msg.attachments" :key="file.id" class="attachment">
                        <div class="attachment-preview" v-if="file.type === 'image'">
                            <img :src="file.content" :alt="file.name" />
                        </div>
                        <div class="attachment-icon" v-else>
                            <Icon name="FileText" size="24" />
                        </div>
                        <div class="attachment-info">
                            <span class="attachment-name">{{ file.name }}</span>
                            <span class="attachment-size">{{ formatFileSize(file.size) }}</span>
                        </div>
                    </div>
                </div>

                <Collapsible v-if="msg.thinking" title="Thinking" :default-open="false">
                    <p class="thinking">{{ msg.thinking }}</p>
                </Collapsible>

                <ChatMessageContent :message="msg" :idx="idx" @inline-buttons="onInlineButtons"
                    @edit-message="onEditMessage" ref="content" />
                <div v-if="msg.role === 'human'">
                    <MessageBottomControls class="bottom-cnt" @retry="emit('retry-send', idx)"
                        @edit="content?.toggleEdit()" @delete="emit('delete-message', idx)" @copy="copy()"
                        :show="['edit', 'retry', 'delete', 'copy']" />
                </div>
                <div v-if="msg.role === 'ai'">
                    <!-- for showing only if msg.isReady === false -->
                    <MessageBottomControls v-if="!(msg.isReady === false) && isLastInGroup" class="bottom-cnt"
                        @retry="emit('retry-send', firstInGroupIdx)" @copy="copy()" :show="['retry', 'copy']" />
                </div>

            </div>

            <div v-if="msg.role === 'human' && msg.checkpoint" class="backwards-nav">
                <span class="line"></span>
                <IconButton @click="restoreCheckpoint" icon="Bookmark" class="backward" :size="11">Restore checkpoint
                </IconButton>
                <span class="line"></span>
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
import { formatFileSize } from '../../utils/file-size';
import IconButton from '../shared/IconButton.vue';
import "@copilot/shared/types/eda";
import { isEasyEda, showToastMessage } from '../../eda/utils';
import { checkpointer } from '../../eda/checkpointer';

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

const restoreCheckpoint = () => {
    if (isEasyEda())
        if (props.msg.checkpoint)
            checkpointer.restore(props.msg.checkpoint)
        else
            showToastMessage('Checkpoint not found', 'error');
    else
        showToastMessage('Checkpointer not allowed', 'error');
}

const copy = async () => {
    try {
        await navigator.clipboard.writeText(props.msg.content);
        showToastMessage('Copied', 'success')
    } catch (err) {
        showToastMessage('Error with copy', 'warn')
    }
}

</script>

<style scoped>
.message {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    max-width: 100%;
    width: 100%;

    .bottom-cnt {
        visibility: hidden;
    }
}

.message:hover {
    .bottom-cnt {
        visibility: visible;
    }
}

.attachments {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.attachment {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    max-width: 200px;
}

.attachment-preview {
    width: 40px;
    height: 40px;
    border-radius: 0.25rem;
    overflow: hidden;
    flex-shrink: 0;
}

.attachment-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.attachment-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--color-surface);
    border-radius: 0.25rem;
    flex-shrink: 0;
    color: var(--color-text);
}

.attachment-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
}

.attachment-name {
    font-size: 0.85rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--color-text);
}

.attachment-size {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
}

.message.human {
    justify-content: flex-end;
    /* align-self: flex-end; */
}

.message-content-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
}

.message.human .message-content-wrapper {
    align-items: flex-end;
}

.content-inner {
    width: fit-content;
    max-width: 100%;
}

.message.ai .avatar {
    background-color: var(--color-primary);
    border-radius: 50%;
    min-width: 32px;
    max-width: 32px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-on-primary);
}

.message.ai .content-inner {
    width: 100%;
}

.avatar-placeholder {
    min-width: 32px;
    max-width: 32px;
}

.message.human .avatar {
    background-color: var(--color-surface-hover);
    border-radius: 50%;
    min-width: 32px;
    max-width: 32px;
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

.backwards-nav {
    width: 100%;
    display: flex;
    align-items: center;
    z-index: 5;
}

.backward {
    font-size: 11px;
    color: #888;
}

.line {
    flex-grow: 1;
    border-top: 1px dashed var(--color-border-dark);
    margin-left: 8px;
}
</style>
