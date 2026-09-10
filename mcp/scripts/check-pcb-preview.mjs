import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { build } from 'esbuild';
import ts from 'typescript';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(root + 'package.json');
const utils = ts.createSourceFile('utils.ts', await readFile(root + 'src/eda/utils.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const helpers = utils.statements.filter(node => ['round', 'milToMm', 'mmToMil'].includes(node.name?.text))
    .map(node => node.getText(utils)).join('\n');
const bundled = await build({ entryPoints: [root + 'src/eda/pcb-preview.ts'], bundle: true, write: false,
    platform: 'node', format: 'cjs', plugins: [{ name: 'native-preview-fixture', setup(builder) {
        builder.onLoad({ filter: /[\\/]src[\\/]eda[\\/]utils\.ts$/ }, () => ({
            contents: helpers + '\nexport const VERSION_EDASYEDA = globalThis.testVersion;', loader: 'ts',
        }));
    } }] });
const png = await sharp({ create: { width: 3, height: 2, channels: 4, background: '#4f86c6' } }).png().toBuffer();
const version = [3, 2, 149];
const layerIds = { TOP: 1, BOTTOM: 2, TOP_SILKSCREEN: 3, BOARD_OUTLINE: 11, MULTI: 12, INNER_1: 15 };
// Model an EasyEDA runtime enum with only name-to-ID entries.
let state, count = 0;
const reset = () => {
    version[0] = 3;
    state = { document: 'pcb', selected: ['previous-selection'], current: 2, calls: [],
        layers: [1, 2, 3, 11, 12, 15].map(id => ({ id, layerStatus: id === 15 ? 0 : id === 3 ? 2 : 1 })) };
};
const primitive = (id, extra = {}) => ({ getState_PrimitiveId: () => id, ...extra });
const eda = {
    dmt_SelectControl: { getCurrentDocumentInfo: async () => ({ uuid: state.document, tabId: 'pcb-tab', documentType: 3 }) },
    pcb_PrimitivePolyline: { getAll: async () => [primitive('outline', { getState_Layer: () => 11 })] },
    pcb_PrimitiveComponent: { getAll: async () => [primitive('component', { getState_Designator: () => 'U1' })] },
    pcb_Net: { getAllPrimitivesByNet: async net => net === 'GND' ? [primitive('net-pad'), primitive('net-track')] : [] },
    pcb_Primitive: { getPrimitivesBBox: async ids => {
        assert.ok(ids.every(id => typeof id === 'string'), 'Use native primitive IDs');
        state.calls.push(['bounds', ...ids]);
        return ids[0] === 'outline' ? { minX: 0, minY: 0, maxX: 1000, maxY: 500 }
            : ids[0] === 'component' ? { minX: 20, minY: 10, maxX: 80, maxY: 60 }
                : { minX: 100, minY: 200, maxX: 300, maxY: 400 };
    } },
    pcb_Layer: {
        getAllLayers: async () => state.layers.map(layer => ({ ...layer })),
        getCurrentLayer: async () => state.missingLayer ? undefined : ({ id: state.current }),
        setLayerVisible: async (ids, hideOthers) => {
            state.calls.push(['layers', [...ids], hideOthers]);
            state.layers.forEach(layer => { if (layer.layerStatus) layer.layerStatus = ids.includes(layer.id) ? 1 : hideOthers ? 2 : layer.layerStatus; });
            return true;
        },
        selectLayer: async id => { state.current = id; return true; },
    },
    pcb_SelectControl: {
        getAllSelectedPrimitives_PrimitiveId: async () => [...state.selected],
        clearSelected: async () => { state.selected = []; return true; },
        doCrossProbeSelect: async (...args) => { state.calls.push(['select', ...args]); state.selected = ['preview-selection']; return true; },
        doSelectPrimitives: async ids => { state.selected = [...ids]; return true; },
    },
    dmt_EditorControl: {
        zoomToRegion: async (...args) => {
            state.calls.push(['zoom', ...args]);
            if (state.hangZoom) await new Promise(resolve => { state.releaseZoom = resolve; });
            return true;
        },
        getCurrentRenderedAreaImage: async tab => {
            state.calls.push(['image', tab]);
            state.capturedActiveLayer = state.current;
            if (state.hangImage) await new Promise(resolve => { state.releaseImage = resolve; });
            state.capturedLayers = state.layers.filter(layer => layer.layerStatus === 1).map(layer => layer.id);
            if (state.switchDocument) state.document = 'other-pcb';
            return state.emptyImage ? undefined : new Blob([png], { type: 'image/png' });
        },
    },
};
const module = { exports: {} };
vm.runInNewContext(bundled.outputFiles[0].text, { module, exports: module.exports, require, eda, Blob, setTimeout, clearTimeout, testVersion: version,
    EDMT_EditorDocumentType: { PCB: 3 }, EPCB_LayerId: layerIds, EPCB_LayerStatus: { SHOW: 1, HIDDEN: 2, NOT_USED: 0 } });
const { previewPcb } = module.exports;
const input = overrides => ({ layers: ['all'], zoom: { mode: 'full' }, padding_mm: 2, ...overrides });
const plain = value => JSON.parse(JSON.stringify(value));
const test = async (name, run) => { reset(); await run(); count++; console.log('PASS ' + name); };
const restored = () => {
    assert.deepEqual(state.selected, ['previous-selection']); assert.equal(state.current, 2);
    assert.deepEqual(state.layers.map(layer => layer.layerStatus), [1, 1, 2, 1, 1, 0]);
};

await test('EasyEDA 3 captures native bytes, selects color-map keys and restores presentation state', async () => {
    const r = await previewPcb(input({ layers: ['TOP'], highlight_net: 'GND', highlight_net_colors: { GND: '#00ff00' },
        highlight_component: 'U1', highlight_component_colors: { U1: '#ff0000' } }));
    assert.equal(r.renderer, 'native'); assert.deepEqual(Buffer.from(r.base64, 'base64'), png);
    assert.match(r.notes.join(' '), /highlight_net_colors.*highlight_component_colors/);
    assert.deepEqual(plain(state.calls.find(call => call[0] === 'select')), ['select', ['U1'], [], ['GND'], false, true]);
    assert.deepEqual(state.capturedLayers, [1, 11, 12]);
    assert.deepEqual(state.calls.find(call => call[0] === 'zoom'), ['zoom', -78.7402, 1078.7402, 578.7402, -78.7402, 'pcb-tab']);
    restored();
});
await test('EasyEDA below 3 keeps the existing version error', async () => {
    version[0] = 2;
    await assert.rejects(previewPcb(input()), /version required >= 3, current 2/);
    assert.deepEqual(state.calls, []);
});
await test('future major versions also use the official renderer', async () => {
    version[0] = 4;
    assert.equal((await previewPcb(input())).renderer, 'native');
});
await test('bottom layer includes through copper and board outline', async () => {
    await previewPcb(input({ layers: ['BOTTOM'] }));
    assert.equal(state.capturedActiveLayer, 2);
    assert.deepEqual(state.capturedLayers, [2, 11, 12]); restored();
});
await test('missing current-layer value does not block native capture', async () => {
    state.missingLayer = true;
    const result = await previewPcb(input({ layers: ['TOP'] }));
    assert.equal(result.renderer, 'native');
    assert.equal(state.capturedActiveLayer, 1);
    assert.deepEqual(state.capturedLayers, [1, 11, 12]);
    assert.equal(state.current, 1);
    assert.deepEqual(state.selected, ['previous-selection']);
    assert.deepEqual(state.layers.map(layer => layer.layerStatus), [1, 1, 2, 1, 1, 0]);
    assert.match(result.notes.join(' '), /requested layer remains active/);
});
for (const getter of [undefined, async () => { throw new Error('Unsupported getter'); }]) {
    await test('absent or unsupported current-layer getter permits native capture', async () => {
        const original = eda.pcb_Layer.getCurrentLayer;
        eda.pcb_Layer.getCurrentLayer = getter;
        try { assert.equal((await previewPcb(input({ layers: ['TOP'] }))).renderer, 'native'); }
        finally { eda.pcb_Layer.getCurrentLayer = original; }
    });
}
await test('failed layer selection rejects capture and restores state', async () => {
    const original = eda.pcb_Layer.selectLayer;
    eda.pcb_Layer.selectLayer = async id => id === 1 ? false : original(id);
    try {
        await assert.rejects(previewPcb(input({ layers: ['TOP'] })), /Could not select/);
        assert.equal(state.calls.some(call => call[0] === 'image'), false);
        restored();
    } finally { eda.pcb_Layer.selectLayer = original; }
});
await test('absolute bbox preserves mm coordinates and padding', async () => {
    await previewPcb(input({ zoom: { mode: 'bbox', bbox: { x: 1, y: -2, width: 3, height: 4, unit: 'mm' } }, padding_mm: 0 }));
    assert.deepEqual(state.calls.find(call => call[0] === 'zoom'), ['zoom', 39.3701, 157.4803, 78.7402, -78.7402, 'pcb-tab']);
});
await test('relative bbox uses the board bounds in native coordinates', async () => {
    await previewPcb(input({ zoom: { mode: 'bbox', bbox: { x: 0.25, y: 0.1, width: 0.5, height: 0.3, unit: 'rel' } }, padding_mm: 0 }));
    assert.deepEqual(state.calls.find(call => call[0] === 'zoom'), ['zoom', 250, 750, 200, 50, 'pcb-tab']);
});
for (const [zoom, expected] of [
    [{ mode: 'net', net: 'GND' }, [100, 300, 400, 200]],
    [{ mode: 'component', designator: 'U1' }, [20, 80, 60, 10]],
    [{ mode: 'net', net: 'MISSING' }, [0, 1000, 500, 0]],
]) await test('native bounds for ' + JSON.stringify(zoom), async () => {
    await previewPcb(input({ zoom, padding_mm: 0 }));
    assert.deepEqual(state.calls.find(call => call[0] === 'zoom'), ['zoom', ...expected, 'pcb-tab']);
});
await test('failed native capture restores layers and selection without falling back to a synthetic image', async () => {
    state.emptyImage = true;
    await assert.rejects(previewPcb(input({ layers: ['BOTTOM'], highlight_net: 'GND' })), /did not return a PCB preview image/);
    restored();
});
await test('document switch rejects the image without restoring settings onto a different board', async () => {
    state.switchDocument = true;
    await assert.rejects(previewPcb(input({ layers: ['BOTTOM'] })), /Active PCB changed/);
    assert.equal(state.calls.filter(call => call[0] === 'layers').length, 1);
});
for (const stage of ['Zoom', 'Image']) await test('hung native ' + stage + ' releases the command and does not resume after a late response', async () => {
    state['hang' + stage] = true;
    // A near bridge deadline exercises the same timeout path without waiting eight seconds.
    await assert.rejects(previewPcb(input({ layers: ['TOP'] }), Date.now() + 1_600), /timed out/);
    restored();
    const callsAfterTimeout = state.calls.length;
    state['release' + stage]();
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(state.calls.length, callsAfterTimeout, 'Late native completion must not resume the preview');
});
await test('already expired preview does not call EasyEDA', async () => {
    await assert.rejects(previewPcb(input(), Date.now()), /timed out/);
    assert.deepEqual(state.calls, []);
});
console.log('Native PCB preview checks passed (' + count + ').');
