import { ref, computed } from 'vue'
import { useMouse, useRefHistory, onKeyStroke } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'
import {
    useVueFlow,
    type Connection,
    type Edge,
    type Node,
    type XYPosition,
    Position,
    type NodeMouseEvent,
    type EdgeMouseEvent,
    type FlowImportObject,
    MouseTouchEvent,
} from '@vue-flow/core'
import { useBlockDiagramDigitization, type DigitizedBlock } from './useBlockDiagramDigitization'

export type BlockNode = Node<{ label: string; description: string }>
export type ClipboardState = { nodes: BlockNode[]; edges: Edge[] }

export type ContextMenuType = 'pane' | 'node' | 'edge' | null
export type ContextMenuState = {
    type: ContextMenuType
    nodeId: string | null
    edgeId: string | null
}

export function useBlockDiagramEditor() {
    const {
        onConnect,
        addEdges,
        setEdges,
        setNodes,
        addNodes,
        getNodes,
        getEdges,
        getSelectedNodes,
        getSelectedEdges,
        updateNodeData,
        fitView,
        zoomIn,
        zoomOut,
        screenToFlowCoordinate,
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        toObject,
        fromObject,
    } = useVueFlow({})

    const clone = <T>(obj: T) => JSON.parse(JSON.stringify(obj)) as T
    const flowState = ref({ nodes: clone([...nodes.value]), edges: clone([...edges.value]) })
    const mouse = useMouse()
    const showEditModal = ref(false)
    const editingBlock = ref<{ id: string; label: string; description: string }>({ id: '', label: '', description: '' })
    const clipboard = ref<ClipboardState | null>(null)
    const contextMenu = ref<ContextMenuState>({ type: null, nodeId: null, edgeId: null })

    const { isDigitizing, progressText, startDigitization, cancelDigitization } = useBlockDiagramDigitization()

    const getFlowMousePos = () => screenToFlowCoordinate({ x: mouse.x.value, y: mouse.y.value })

    const makeEdgeStyle = () => ({ stroke: 'var(--color-primary)', strokeWidth: 2 })
    const generateBlockId = () => `block-${uuidv4()}`
    const getCenterPosition = (): XYPosition => screenToFlowCoordinate({ x: window.innerWidth / 2, y: window.innerHeight / 2 })

    onEdgesChange((changes) => {
        if (!changes.length) return
        flowState.value = { nodes: clone([...nodes.value]), edges: clone([...edges.value]) }
    })

    onNodesChange((changes) => {
        if (!changes.length) return
        if (changes[0].type === 'position' && changes[0].dragging) return
        if (changes[0].type === 'dimensions' || changes[0].type === 'select') return
        flowState.value = { nodes: clone([...nodes.value]), edges: clone([...edges.value]) }
    })

    const history = useRefHistory(flowState, { capacity: 25 })

    const undo = () => {
        if (!history.canUndo.value) return
        history.undo()
        setNodes([...flowState.value.nodes])
        setEdges([...flowState.value.edges])
    }

    const redo = () => {
        if (!history.canRedo.value) return
        history.redo()
        setNodes([...flowState.value.nodes])
        setEdges([...flowState.value.edges])
    }

    const deleteSelected = () => {
        setEdges(edges.value.filter((n) => !getSelectedEdges.value.some((sn) => sn.id === n.id)))
        setNodes(nodes.value.filter((n) => !getSelectedNodes.value.some((sn) => sn.id === n.id)))
    }

    const addBlock = (position?: XYPosition) => {
        const resolvedPosition = position ?? getCenterPosition()
        const newNode: BlockNode = {
            id: generateBlockId(),
            position: { x: resolvedPosition.x, y: resolvedPosition.y },
            data: { label: 'New Block', description: '' },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
            selectable: true,
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
        edges.map((edge) => ({ ...edge, id: generateBlockId(), source: idMap[edge.source], target: idMap[edge.target] }))

    const pasteAt = (position: XYPosition) => {
        if (!clipboard.value) return
        const { nodes: cNodes, edges: cEdges } = clipboard.value
        const newNodes = cNodes.map((node) => ({
            ...node,
            id: generateBlockId(),
            position: { x: position.x + (cNodes[0].position.x - node.position.x), y: position.y + (cNodes[0].position.y - node.position.y) },
        }))
        const idMap = buildIdMap(cNodes, newNodes)
        const newEdges = remapEdges(cEdges, idMap)
        addNodes(newNodes)
        addEdges(newEdges)
    }

    const deleteEdge = () => {
        if (!contextMenu.value.edgeId) return
        const es = getEdges.value.filter((edge) => edge.id !== contextMenu.value.edgeId)
        setEdges(es)
    }

    const editSelected = () => {
        if (!getSelectedNodes.value.length) return
        const node = getSelectedNodes.value[0]
        editingBlock.value = { id: node.id, label: node.data.label, description: node.data.description }
        showEditModal.value = true
    }

    const saveBlock = () => {
        if (!editingBlock.value.id) return
        updateNodeData(editingBlock.value.id, { label: editingBlock.value.label, description: editingBlock.value.description })
        closeEditModal()
    }

    const closeEditModal = () => {
        showEditModal.value = false
        editingBlock.value = { id: '', label: '', description: '' }
    }

    const copySelected = () => {
        if (!getSelectedNodes.value.length) return
        const selectedNodeIds = [...getSelectedNodes.value.map((e) => e.id)]
        const nodesToCopy = new Set([...selectedNodeIds])
        const selectedNodes = getNodes.value.filter((node) => nodesToCopy.has(node.id))
        const idMap: Record<string, string> = {}
        selectedNodes.forEach((node) => {
            idMap[node.id] = generateBlockId()
        })
        const copiedNodes = selectedNodes.map((node) => ({ ...node, id: idMap[node.id], position: { ...node.position }, data: { ...node.data } }))
        const copiedEdges = getEdges.value
            .filter((edge) => nodesToCopy.has(edge.source) && nodesToCopy.has(edge.target))
            .map((edge) => ({ ...edge, id: generateBlockId(), source: idMap[edge.source], target: idMap[edge.target] }))
        clipboard.value = { nodes: copiedNodes, edges: copiedEdges }
    }

    const cutSelected = () => {
        copySelected()
        deleteSelected()
    }

    const handleNodeDoubleClick = ({ event }: NodeMouseEvent) => {
        event.stopPropagation()
        editSelected()
    }

    const handlePaneContextMenu = (event: MouseEvent) => {
        event.preventDefault()
        contextMenu.value = { type: 'pane', nodeId: null, edgeId: null }
    }

    const handleNodeContextMenu = ({ event, node }: NodeMouseEvent) => {
        event.preventDefault()
        contextMenu.value = { type: 'node', nodeId: node.id, edgeId: null }
    }

    const handleEdgeContextMenu = ({ event, edge }: EdgeMouseEvent) => {
        event.preventDefault()
        contextMenu.value = { type: 'edge', nodeId: null, edgeId: edge.id }
    }

    const contextMenuItems = computed(() => {
        if (contextMenu.value.type === 'pane') {
            return [
                { icon: 'Plus', label: 'Add Block Here', click: () => addBlock(getFlowMousePos()) },
                { divider: true },
                { icon: 'ClipboardCopy', label: 'Copy', click: copySelected },
                { icon: 'ClipboardPaste', label: 'Paste', click: () => pasteAt(getFlowMousePos()) },
                { divider: true },
                { icon: 'Scaling', label: 'Fit to View', click: () => fitView({ padding: 0.2 }) },
                { icon: 'Undo', label: 'Undo', click: undo },
                { icon: 'Redo', label: 'Redo', click: redo },
            ]
        }
        if (contextMenu.value.type === 'node') {
            return [
                { icon: 'Pencil', label: 'Edit Block', click: editSelected },
                { icon: 'ClipboardCopy', label: 'Copy', click: copySelected },
                { icon: 'Scissors', label: 'Cut', click: cutSelected },
                { divider: true },
                { icon: 'Trash2', label: 'Delete', danger: true, click: deleteSelected },
            ]
        }
        if (contextMenu.value.type === 'edge') {
            return [
                { icon: 'Trash2', label: 'Delete Connection', danger: true, click: deleteEdge },
            ]
        }
        return []
    })

    // Digitization helpers
    const triggerFileSelect = async () => {
        const file = await new Promise<File | null>((resolve) => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'image/*'
            input.onchange = () => resolve(input.files?.[0] ?? null)
            input.click()
        })
        if (!file) return
        await handleFile(file)
    }

    const onDrop = async (event: DragEvent) => {
        event.preventDefault()
        const dt = event.dataTransfer
        if (!dt) return
        const file = dt.files?.[0]
        if (!file) return
        await handleFile(file)
    }

    const handleFile = async (file: File) => {
        const res = await startDigitization(file)
        if (res && Array.isArray(res.blocks)) insertDigitizedBlocks(res.blocks)
    }

    const insertDigitizedBlocks = (blocks: DigitizedBlock[]) => {
        if (!blocks || !blocks.length) return
        const createdNodes: BlockNode[] = []
        const nameToId: Record<string, string> = {}

        for (const block of blocks) {
            const id = generateBlockId()
            const posX = (block.x ?? 0) * 1.5
            const posY = (block.y ?? 0) * 1.5
            const node: BlockNode = {
                id,
                position: { x: posX, y: posY },
                data: {
                    label: block.name ?? (block.description ? String(block.description).split('\n')[0] : 'Block'),
                    description: block.description ?? '',
                },
                sourcePosition: Position.Right,
                targetPosition: Position.Left,
                selectable: true,
            }
            createdNodes.push(node)
            if (block.name) nameToId[block.name] = id
        }

        addNodes(createdNodes)

        const createdEdges: Edge[] = []
        for (const block of blocks) {
            const sourceId = block.name ? nameToId[block.name] : undefined
            if (!sourceId) continue
            const nextNames: string[] = Array.isArray(block.next_block_names) ? block.next_block_names : []
            for (const nextName of nextNames) {
                const targetId = nameToId[nextName]
                if (!targetId) continue
                createdEdges.push({ id: generateBlockId(), source: sourceId, target: targetId, style: makeEdgeStyle() } as Edge)
            }
        }
        if (createdEdges.length) addEdges(createdEdges)
    }

    onConnect((params: Connection) => {
        addEdges([{ id: generateBlockId(), ...params, style: makeEdgeStyle() }])
    })

    // Keyboard shortcuts
    onKeyStroke((event) => !!(event.ctrlKey && event.code === 'KeyC' && getSelectedNodes.value.length), () => copySelected())
    onKeyStroke((event) => !!(event.ctrlKey && event.code === 'KeyX' && getSelectedNodes.value.length), () => cutSelected())
    onKeyStroke((event) => !!(event.ctrlKey && event.code === 'KeyV' && clipboard.value), () => pasteAt(getFlowMousePos()))
    onKeyStroke((event) => !!(event.ctrlKey && event.code === 'KeyZ' && history.canUndo.value), () => undo())
    onKeyStroke((event) => !!(event.ctrlKey && event.code === 'KeyY' && history.canRedo.value), () => redo())

    // External API
    const getData = () => toObject()
    const setData = (data: FlowImportObject) => fromObject(data)

    return {
        // state
        showEditModal,
        editingBlock,
        contextMenuItems,
        isDigitizing,
        progressText,

        // actions
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

        // data IO
        getData,
        setData,
    }
}
