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
            <slot></slot>
        </div>

        <VueFlow class="flow-container" @node-double-click="handleNodeDoubleClick" :delete-key-code="['Delete']"
            @pane-context-menu="handlePaneContextMenu" @node-context-menu="handleNodeContextMenu"
            @edge-context-menu="handleEdgeContextMenu">
        </VueFlow>

        <ContextMenu :show="contextMenu.show" :x="contextMenu.x" :y="contextMenu.y" :items="contextMenuItems"
            @close="hideContextMenu" />

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
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { VueFlow, useVueFlow, type Connection, type Edge, type Node, type XYPosition, Position, NodeMouseEvent, EdgeMouseEvent, FlowImportObject } from '@vue-flow/core'
import { v4 as uuidv4 } from 'uuid'
import IconButton from '../shared/IconButton.vue'
import Icon from '../shared/Icon.vue'
import ContextMenu, { type ContextMenuItem } from '../shared/ContextMenu.vue'
import { useMouse, useRefHistory } from '@vueuse/core';

type BlockNode = Node<{ label: string; description: string }>;
type ClipboardState = { nodes: BlockNode[]; edges: Edge[] }

type ContextMenuType = 'pane' | 'node' | 'edge' | null
type ContextMenuState = {
    show: boolean
    type: ContextMenuType
    x: number
    y: number
    nodeId: string | null
    edgeId: string | null
}
type EditingBlock = { id: string; label: string; description: string }

const {
    onConnect,
    addEdges,
    setEdges,
    setNodes,
    addNodes,
    getNodes,
    getEdges,
    getSelectedNodes,
    getSelectedElements,
    getSelectedEdges,
    updateNodeData,
    fitView,
    zoomIn,
    zoomOut,
    screenToFlowCoordinate,
    setMinZoom,
    setMaxZoom,
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    toObject,
    fromObject,
} = useVueFlow({});

const clone = (obj: any) => JSON.parse(JSON.stringify(obj))
const flowState = ref({ nodes: clone([...nodes.value]), edges: clone([...edges.value]) });
const mouse = useMouse();
const showEditModal = ref(false)
const editingBlock = ref<EditingBlock>({ id: '', label: '', description: '' })
const clipboard = ref<ClipboardState | null>(null)
const contextMenu = ref<ContextMenuState>({
    show: false,
    type: null,
    x: 0,
    y: 0,
    nodeId: null,
    edgeId: null
})

const getFlowMousePos = () => screenToFlowCoordinate({ x: mouse.x.value, y: mouse.y.value })

const contextMenuItems = computed<ContextMenuItem[]>(() => {
    if (contextMenu.value.type === 'pane') {
        return [
            {
                icon: 'Plus',
                label: 'Add Block Here',
                click: () => addBlock(getFlowMousePos())
            },
            { divider: true },
            {
                icon: 'ClipboardCopy',
                label: 'Copy',
                click: copySelected
            },
            {
                icon: 'ClipboardPaste',
                label: 'Paste',
                click: () => pasteAt(getFlowMousePos())
            },
            { divider: true },
            {
                icon: 'Scaling',
                label: 'Fit to View',
                click: () => fitView({ padding: 0.2 })
            },
            {
                icon: 'Undo',
                label: 'Undo',
                click: undo
            },
            {
                icon: 'Redo',
                label: 'Redo',
                click: redo
            }
        ]
    }

    if (contextMenu.value.type === 'node') {
        return [
            {
                icon: 'Pencil',
                label: 'Edit Block',
                click: editSelected
            },
            {
                icon: 'ClipboardCopy',
                label: 'Copy',
                click: copySelected
            },
            {
                icon: 'Scissors',
                label: 'Cut',
                click: cutSelected
            },
            { divider: true },
            {
                icon: 'Trash2',
                label: 'Delete',
                danger: true,
                click: deleteSelected
            }
        ]
    }

    if (contextMenu.value.type === 'edge') {
        return [
            {
                icon: 'Trash2',
                label: 'Delete Connection',
                danger: true,
                click: deleteEdge
            }
        ]
    }

    return []
})

onEdgesChange((changes) => {
    if (!changes.length) return

    flowState.value = {
        nodes: clone([...nodes.value]),
        edges: clone([...edges.value])
    }
})

// Синхронизируем flowState с актуальными nodes/edges
onNodesChange((changes) => {
    if (!changes.length) return

    if (changes[0].type === 'position' && changes[0].dragging) {
        return
    }
    if (changes[0].type === 'dimensions' || changes[0].type === 'select') {
        return
    }

    flowState.value = {
        nodes: clone([...nodes.value]),
        edges: clone([...edges.value])
    }
})

const history = useRefHistory(flowState, {
    capacity: 25,
});

const undo = () => {
    if (!history.canUndo.value) return;
    history.undo()
    setNodes([...flowState.value.nodes])
    setEdges([...flowState.value.edges])
}

const redo = () => {
    if (!history.canRedo.value) return;
    history.redo()
    setNodes([...flowState.value.nodes])
    setEdges([...flowState.value.edges])
}

const generateBlockId = () => `block-${uuidv4()}`
const getCenterPosition = (): XYPosition =>
    screenToFlowCoordinate({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
const makeEdgeStyle = () => ({
    stroke: 'var(--color-primary)',
    strokeWidth: 2
})

const deleteSelected = () => {
    setEdges(edges.value.filter(n => !getSelectedEdges.value.some(sn => sn.id === n.id)))
    setNodes(nodes.value.filter(n => !getSelectedNodes.value.some(sn => sn.id === n.id)))
}

const addBlock = (position?: XYPosition) => {
    const resolvedPosition = position ?? getCenterPosition()
    hideContextMenu()

    const newNode = {
        id: generateBlockId(),
        position: { x: resolvedPosition.x, y: resolvedPosition.y },
        data: {
            label: 'New Block',
            description: ''
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        selectable: true
    }

    addNodes([newNode])
}

const buildIdMap = (nodes: BlockNode[], newNodes: BlockNode[]) => {
    const idMap: Record<string, string> = {}
    nodes.forEach((node, index) => {
        idMap[node.id] = newNodes[index].id
    })
    return idMap
}

const remapEdges = (edges: Edge[], idMap: Record<string, string>): Edge[] =>
    edges.map((edge) => ({
        ...edge,
        id: generateBlockId(),
        source: idMap[edge.source],
        target: idMap[edge.target]
    }))

const pasteAt = (position: XYPosition) => {
    if (!clipboard.value) {
        hideContextMenu()
        return
    }

    hideContextMenu()

    const { nodes, edges } = clipboard.value

    const newNodes = nodes.map((node) => ({
        ...node,
        id: generateBlockId(),
        position: {
            x: position.x + (nodes[0].position.x - node.position.x),
            y: position.y + (nodes[0].position.y - node.position.y),
        }
    }))

    const idMap = buildIdMap(nodes, newNodes)
    const newEdges = remapEdges(edges, idMap)

    addNodes(newNodes)
    addEdges(newEdges)
}

const deleteEdge = () => {
    if (!contextMenu.value.edgeId) return

    const edges = getEdges.value.filter((edge) => edge.id !== contextMenu.value.edgeId)
    setEdges(edges)
    hideContextMenu()
}

const editSelected = () => {
    if (!getSelectedNodes.value.length) return

    const node = getSelectedNodes.value[0];

    editingBlock.value = {
        id: node.id,
        label: node.data.label,
        description: node.data.description
    }
    showEditModal.value = true
}

const saveBlock = () => {
    if (!editingBlock.value.id) return

    updateNodeData(editingBlock.value.id, {
        label: editingBlock.value.label,
        description: editingBlock.value.description
    })

    closeEditModal()
}

const closeEditModal = () => {
    showEditModal.value = false
    editingBlock.value = { id: '', label: '', description: '' }
}

const copySelected = () => {
    if (!getSelectedNodes.value.length) return

    const selectedNodeIds = [...getSelectedNodes.value.map(e => e.id)];
    const nodesToCopy = new Set([...selectedNodeIds])

    const selectedNodes = getNodes.value.filter(node => nodesToCopy.has(node.id))

    const idMap: Record<string, string> = {}
    selectedNodes.forEach(node => {
        idMap[node.id] = generateBlockId()
    })

    const copiedNodes = selectedNodes.map(node => ({
        ...node,
        id: idMap[node.id],
        position: { ...node.position },
        data: { ...node.data }
    }))

    const copiedEdges = getEdges.value.filter(edge =>
        nodesToCopy.has(edge.source) && nodesToCopy.has(edge.target)
    ).map(edge => ({
        ...edge,
        id: generateBlockId(),
        source: idMap[edge.source],
        target: idMap[edge.target]
    }))


    clipboard.value = {
        nodes: copiedNodes,
        edges: copiedEdges
    }
}

const cutSelected = () => {
    copySelected()
    deleteSelected();
}

const handleNodeDoubleClick = ({ event, node }: NodeMouseEvent) => {
    event.stopPropagation()
    editSelected()
}

const handlePaneContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    const target = event.target as Element | null
    if (!target) return

    contextMenu.value = {
        show: true,
        type: 'pane',
        x: event.clientX,
        y: event.clientY,
        nodeId: null,
        edgeId: null
    }
}

const handleNodeContextMenu = ({ event, node }: NodeMouseEvent) => {
    event.preventDefault()

    contextMenu.value = {
        show: true,
        type: 'node',
        x: (event as any).clientX,
        y: (event as any).clientY,
        nodeId: node.id,
        edgeId: null
    }
}

const handleEdgeContextMenu = ({ event, edge }: EdgeMouseEvent) => {
    event.preventDefault()

    contextMenu.value = {
        show: true,
        type: 'edge',
        x: (event as any).clientX,
        y: (event as any).clientY,
        nodeId: null,
        edgeId: edge.id
    }
}

onConnect((params: Connection) => {
    addEdges([{
        id: generateBlockId(),
        ...params,
        style: makeEdgeStyle()
    }])
})

const handleKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey && event.code === 'KeyC' && getSelectedNodes.value.length) {
        event.preventDefault()
        copySelected()
    }

    if (event.ctrlKey && event.code === 'KeyX' && getSelectedNodes.value.length) {
        event.preventDefault()
        cutSelected()
    }

    if (event.ctrlKey && event.code === 'KeyV' && clipboard.value) {
        event.preventDefault()
        pasteAt(getFlowMousePos())
    }

    if (event.ctrlKey && event.code === 'KeyZ' && history.canUndo.value) {
        event.preventDefault()
        undo()
    }

    if (event.ctrlKey && event.code === 'KeyY' && history.canRedo.value) {
        event.preventDefault()
        redo()
    }
}

onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('click', hideContextMenu)

    setMinZoom(0.1);
    setMaxZoom(4);
})

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('click', hideContextMenu);
})

const hideContextMenu = () => {
    contextMenu.value.show = false;
}

defineExpose({
    getData: () => {
        return toObject();
    },

    setData: (data: FlowImportObject) => {
        fromObject(data)
    }
})

</script>

<style scoped>
.schematic-editor {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
    background: var(--color-background);
    color: var(--color-text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

.toolbar {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
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
    background: var(--color-background-secondary);
    position: relative;
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
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
</style>
<style>
/* import the required styles */
@import "@vue-flow/core/dist/style.css";

/* import the default theme (optional) */
@import "@vue-flow/core/dist/theme-default.css";
</style>