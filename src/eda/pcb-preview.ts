import type { PreviewPcbInput, PreviewPcbReply } from '@copilot/shared/types/pcb/preview';
import { base64 } from './execute-js';
import { mmToMil, VERSION_EDASYEDA } from './utils';

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

// Bound each awaited step so a stuck native promise cannot hold the MCP command
// queue indefinitely or resume the rest of the preview after its timeout.
function callsBefore(deadline: number) {
    return async <T>(action: () => T | Promise<T>): Promise<T> => {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new Error('Native PCB preview timed out.');
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            return await Promise.race([action(), new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error('Native PCB preview timed out.')), remaining);
            })]);
        } finally {
            if (timer !== undefined) clearTimeout(timer);
        }
    };
}
type NativeCall = ReturnType<typeof callsBefore>;

async function boardBounds(call: NativeCall): Promise<Bounds> {
    const outline = (await call(() => eda.pcb_PrimitivePolyline.getAll()))
        .filter(item => item.getState_Layer() === EPCB_LayerId.BOARD_OUTLINE);
    const bounds = outline.length ? await call(() => eda.pcb_Primitive.getPrimitivesBBox(outline.map(item => item.getState_PrimitiveId()))) : undefined;
    if (!bounds) throw new Error('Board outline is missing.');
    return bounds;
}

async function zoomBounds(zoom: PreviewPcbInput['zoom'], call: NativeCall): Promise<Bounds> {
    if (zoom.mode === 'full') return boardBounds(call);
    if (zoom.mode === 'bbox') {
        const box = zoom.bbox;
        if (box.unit === 'rel') {
            const board = await boardBounds(call);
            const width = board.maxX - board.minX, height = board.maxY - board.minY;
            return { minX: board.minX + box.x * width, minY: board.minY + box.y * height,
                maxX: board.minX + (box.x + box.width) * width, maxY: board.minY + (box.y + box.height) * height };
        }
        return { minX: mmToMil(box.x), minY: mmToMil(box.y),
            maxX: mmToMil(box.x + box.width), maxY: mmToMil(box.y + box.height) };
    }
    const primitives = zoom.mode === 'net'
        ? await call(() => eda.pcb_Net.getAllPrimitivesByNet(zoom.net))
        : (await call(() => eda.pcb_PrimitiveComponent.getAll())).filter(item => item.getState_Designator() === zoom.designator);
    const bounds = primitives.length ? await call(() => eda.pcb_Primitive.getPrimitivesBBox(primitives.map(item => item.getState_PrimitiveId()))) : undefined;
    // Preserve the legacy renderer's full-board fallback for a missing zoom target.
    return bounds ?? boardBounds(call);
}

export async function previewPcb(input: PreviewPcbInput, deadlineAt = Date.now() + 10_000): Promise<PreviewPcbReply> {
    if (VERSION_EDASYEDA[0] < 3) throw new Error(`EasyEda version required >= 3, current ${VERSION_EDASYEDA[0]}`);
    // Leave time for restoring presentation state and replying before the bridge timeout.
    const call = callsBefore(Math.min(Date.now() + 8_000, deadlineAt - 1_500));
    const document = await call(() => eda.dmt_SelectControl.getCurrentDocumentInfo());
    if (document?.documentType !== EDMT_EditorDocumentType.PCB) throw new Error('Open the target PCB document first.');
    const assertDocument = async () => {
        if ((await call(() => eda.dmt_SelectControl.getCurrentDocumentInfo()))?.uuid !== document.uuid) {
            throw new Error('Active PCB changed during preview; open the target PCB and retry.');
        }
    };
    const [bounds, layers, selected, currentLayer] = await Promise.all([
        zoomBounds(input.zoom, call), call(() => eda.pcb_Layer.getAllLayers()),
        call(() => eda.pcb_SelectControl.getAllSelectedPrimitives_PrimitiveId()), call(() => eda.pcb_Layer.getCurrentLayer()),
    ]);
    const available = layers.filter(layer => layer.layerStatus !== EPCB_LayerStatus.NOT_USED);
    const all = input.layers.includes('all');
    // Some 3.x builds expose layer methods but cannot report the active layer.
    // Do not claim a layer-specific image when native layer control is unavailable.
    if (!all && !currentLayer) throw new Error('Native layer-specific preview is unavailable: EasyEDA did not report the active PCB layer.');
    const requested = new Set(input.layers);
    requested.add('BOARD_OUTLINE');
    if (input.layers.some(layer => layer === 'TOP' || layer === 'BOTTOM' || layer.startsWith('INNER_'))) requested.add('MULTI');
    const visible = available.filter(layer => all || requested.has(EPCB_LayerId[layer.id] as typeof input.layers[number]));
    const ids = (items: IPCB_LayerItem[]) => items.map(layer => layer.id as TPCB_LayersInTheSelectable);
    const nets = [...new Set([...(input.highlight_net ? [input.highlight_net] : []), ...Object.keys(input.highlight_net_colors ?? {})])];
    const components = [...new Set([...(input.highlight_component ? [input.highlight_component] : []), ...Object.keys(input.highlight_component_colors ?? {})])];
    const padding = mmToMil(input.padding_mm);
    // A zero-sized relative bbox remains a valid point/line zoom target.
    const minX = bounds.minX - padding, minY = bounds.minY - padding;
    const maxX = Math.max(bounds.maxX + padding, minX + 1e-3), maxY = Math.max(bounds.maxY + padding, minY + 1e-3);
    await assertDocument();
    try {
        if (!await call(() => eda.pcb_Layer.setLayerVisible(ids(visible), true))) throw new Error('Could not set PCB preview layers.');
        await assertDocument();
        const active = !all ? visible.find(layer => EPCB_LayerId[layer.id] === input.layers[0]) : undefined;
        if (active) await call(() => eda.pcb_Layer.selectLayer(active.id as TPCB_LayersInTheSelectable));
        await assertDocument();
        await call(() => eda.pcb_SelectControl.clearSelected());
        if (nets.length || components.length) {
            // Native selection supplies the editor's own highlighting colors.
            if (!await call(() => eda.pcb_SelectControl.doCrossProbeSelect(components, [], nets, false, true))) {
                throw new Error('Could not select the requested PCB nets/components.');
            }
        }
        await assertDocument();
        if (!await call(() => eda.dmt_EditorControl.zoomToRegion(minX, maxX, maxY, minY, document.tabId))) {
            throw new Error('Could not zoom the PCB preview.');
        }
        await assertDocument();
        const image = await call(() => eda.dmt_EditorControl.getCurrentRenderedAreaImage(document.tabId));
        if (!image?.size) throw new Error('EasyEDA did not return a PCB preview image.');
        await assertDocument();
        return {
            renderer: 'native', base64: base64(new Uint8Array(await call(() => image.arrayBuffer()))), mime_type: image.type,
            notes: [
                'EasyEDA 3+ uses native selection colors. highlight_net_colors and highlight_component_colors cannot set individual colors; their keys are used as selection targets.',
                'The editor remains zoomed to the requested area; layer visibility and selection are restored.',
            ],
        };
    } finally {
        // Restore presentation state only while the same document is still active.
        const restore = callsBefore(Math.min(Date.now() + 1_000, deadlineAt - 250));
        if ((await restore(() => eda.dmt_SelectControl.getCurrentDocumentInfo()))?.uuid === document.uuid) {
            await restore(() => eda.pcb_SelectControl.clearSelected());
            if (selected.length) await restore(() => eda.pcb_SelectControl.doSelectPrimitives(selected));
            await restore(() => eda.pcb_Layer.setLayerVisible(ids(available.filter(layer => layer.layerStatus === EPCB_LayerStatus.SHOW)), true));
            if (currentLayer) await restore(() => eda.pcb_Layer.selectLayer(currentLayer.id as TPCB_LayersInTheSelectable));
        }
    }
}
