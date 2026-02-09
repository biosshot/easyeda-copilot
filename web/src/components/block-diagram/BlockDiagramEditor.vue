<template>
    <div class="schematic-editor">
        <div class="toolbar">
            <IconButton @click="addBlock()" icon="Plus"></IconButton>
            <IconButton @click="deleteSelected" icon="Trash2">
            </IconButton>
            <IconButton @click="editSelected" icon="Pencil"></IconButton>
            <div class="divider"></div>
            <IconButton @click="undo" icon="Undo" />
            <IconButton @click="redo" icon="Redo" />
            <div class="divider"></div>
            <IconButton @click="fitView({ padding: 0.2 })" icon="Scaling" />
            <div class="divider"></div>
            <IconButton @click="zoomIn" icon="Plus" />
            <IconButton @click="zoomOut" icon="Minus" />
            <div class="spacer"></div>
            <IconButton @click="triggerFileSelect" icon="Upload" />
            <slot></slot>
        </div>

        <VueFlow class="flow-container" @node-double-click="handleNodeDoubleClick" :delete-key-code="['Delete']"
            @pane-context-menu="onPaneMenu" @node-context-menu="onNodeMenu" @edge-context-menu="onEdgeMenu"
            @drop.prevent="onDrop" @dragover.prevent>
        </VueFlow>

        <ContextMenu ref="contextMenuComponent" :items="contextMenuItems" />

        <div v-if="isDigitizing" class="loading-overlay" @click.stop>
            <div class="loading-content">
                <TypingDots :status="progressText || 'Processing image…'" />
                <IconButton class="cancel-button" @click="cancelDigitization" :size="16" icon="CircleStop">
                    Cancel
                </IconButton>
            </div>
        </div>

        <div v-if="showEditModal" class="modal-overlay">
            <div class="modal-content" @click.stop>
                <div class="modal-header">
                    <h3>Edit Block</h3>
                    <button class="close-button" @click="closeEditModal">×</button>
                </div>

                <div class="modal-body">
                    <div class="form-group">
                        <label for="block-name">Block Name:</label>
                        <input type="text" id="block-name" v-model="editingBlock.label" class="input-field"
                            placeholder="Enter block name" @keyup.enter="saveBlock" />
                    </div>

                    <div class="form-group">
                        <label for="block-description">Description:</label>
                        <textarea id="block-description" v-model="editingBlock.description" class="input-field textarea"
                            placeholder="Enter block description" rows="3"></textarea>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="button secondary" @click="closeEditModal">Cancel</button>
                    <button class="button primary" @click="saveBlock">Save</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { EdgeMouseEvent, NodeMouseEvent, VueFlow } from '@vue-flow/core'
import IconButton from '../shared/IconButton.vue'
import ContextMenu from '../shared/ContextMenu.vue'
import TypingDots from '../shared/TypingDots.vue'
import { useBlockDiagramEditor } from '../../composables/useBlockDiagramEditor'

const contextMenuComponent = ref<InstanceType<typeof ContextMenu> | null>(null)

const {
    showEditModal,
    editingBlock,
    contextMenuItems,
    isDigitizing,
    progressText,

    addBlock,
    deleteSelected,
    editSelected,
    saveBlock,
    closeEditModal,
    undo,
    redo,
    fitView,
    zoomIn,
    zoomOut,
    handleNodeDoubleClick,
    handlePaneContextMenu,
    handleNodeContextMenu,
    handleEdgeContextMenu,
    triggerFileSelect,
    onDrop,
    pasteAt,
    cancelDigitization,

    getData,
    setData
} = useBlockDiagramEditor()

// Expose for parent
defineExpose({ getData: getData, setData: setData })

// Context menu wrappers to pass opener function
function onPaneMenu(event: MouseEvent) {
    handlePaneContextMenu(event);
    contextMenuComponent.value?.open(event);
}
function onNodeMenu(event: NodeMouseEvent) {
    handleNodeContextMenu(event);
    contextMenuComponent.value?.open(event.event)
}
function onEdgeMenu(event: EdgeMouseEvent) {
    handleEdgeContextMenu(event)
    contextMenuComponent.value?.open(event.event)
}

</script>

<style scoped>
.schematic-editor {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
    position: relative;
    background: var(--color-background);
    color: var(--color-text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

.toolbar {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border);
    z-index: 10;
    align-items: center;
}

.divider {
    width: 1px;
    height: 24px;
    background: var(--color-border-light);
    margin: 0 8px;
}

.spacer {
    flex: 1;
}

.flow-container {
    flex: 1;
    position: relative;
}

.loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
}

.loading-content {
    background: var(--color-surface);
    border: 1px solid var(--color-border-light);
    border-radius: 6px;
    padding: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    align-items: center;
    display: flex;
    justify-content: center;
    flex-direction: column;
}

.loading-actions {
    margin-top: 8px;
    display: flex;
    justify-content: center;
}

.modal-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    background: var(--color-surface);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    min-width: 400px;
    max-width: 90%;
    animation: modalSlideIn 0.2s ease-out;
}

@keyframes modalSlideIn {
    from {
        opacity: 0;
        transform: translateY(-20px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid var(--color-border-light);
}

.modal-header h3 {
    margin: 0;
    color: var(--color-text);
    font-size: 18px;
    font-weight: 600;
}

.close-button {
    background: none;
    border: none;
    font-size: 28px;
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s;
}

.close-button:hover {
    background: var(--color-surface-hover);
    color: var(--color-error);
}

.modal-body {
    padding: 20px;
}

.form-group {
    margin-bottom: 20px;
}

.form-group label {
    display: block;
    margin-bottom: 8px;
    color: var(--color-text);
    font-weight: 500;
    font-size: 14px;
}

.input-field {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-background-tertiary);
    color: var(--color-text);
    font-size: 14px;
    transition: border-color 0.2s;
    box-sizing: border-box;
}

.input-field:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
}

.input-field.textarea {
    resize: vertical;
    min-height: 80px;
    font-family: inherit;
}

.modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 20px;
    border-top: 1px solid var(--color-border-light);
}

.button {
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    min-width: 80px;
}

.button.primary {
    background: var(--color-primary);
    color: var(--color-text-on-primary);
}

.button.primary:hover {
    background: var(--color-primary-dark);
}

.button.secondary {
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-border);
}

.button.secondary:hover {
    background: var(--color-surface-hover);
}

/* Адаптивность */
@media (max-width: 768px) {
    .toolbar {
        flex-wrap: wrap;
        padding: 8px;
        gap: 4px;
    }

    .modal-content {
        min-width: 90%;
        margin: 20px;
    }
}

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
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.cancel-button {
    background: var(--color-error);
    color: white;
    padding: 5px 6px;
}

.cancel-button:hover {
    opacity: 0.9;
    transform: translateY(-1px);
}
</style>
<style>
/* import the required styles */
@import "@vue-flow/core/dist/style.css";

/* import the default theme (optional) */
@import "@vue-flow/core/dist/theme-default.css";
</style>