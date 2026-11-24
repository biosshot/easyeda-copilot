import assert from 'node:assert/strict';
import test from 'node:test';

const empty = { getAll: async () => [] };
Object.assign(globalThis, {
    EPCB_LayerId: { TOP: 1, BOTTOM: 2, BOARD_OUTLINE: 11, 1: 'TOP', 2: 'BOTTOM', 11: 'BOARD_OUTLINE' },
    EPCB_PrimitivePadShapeType: { REGULAR_POLYGON: 'NGON' },
    EPCB_LayerType: { INTERNAL_ELECTRICAL: 'PLANE' },
    eda: {
        sys_Environment: { getEditorCurrentVersion: () => '3.2.206' },
        pcb_PrimitivePolyline: { getAll: async () => [{ getState_Layer: () => 11,
            getState_Polygon: () => ({ getSource: () => [0, 0, 'L', 100, 0, 100, 100, 0, 100] }) }] },
        pcb_PrimitiveComponent: empty, pcb_PrimitivePad: empty, pcb_PrimitiveVia: empty,
        pcb_PrimitiveArc: empty, pcb_PrimitivePour: empty, pcb_PrimitivePoured: empty, pcb_PrimitiveFill: empty,
        pcb_PrimitiveLine: { getAll: async () => { throw new Error('Native track read failed'); } },
        pcb_Layer: { getAllLayers: async () => [{ id: 1, layerStatus: 1 }, { id: 2, layerStatus: 1 }] },
    },
});

test('raw preview retains native R outline rotation, rounded corners and precision', async (t) => {
    const api = (globalThis as any).eda;
    const original = api.pcb_PrimitivePolyline.getAll;
    t.after(() => { api.pcb_PrimitivePolyline.getAll = original; });
    api.pcb_PrimitivePolyline.getAll = async () => [{ getState_Layer: () => 11,
        getState_Polygon: () => ({ getSource: () => ['R', 10, 20, 200, 100, 90, 15] }) }];
    const { getPcbRaw } = await import('../src/eda/pcb.ts');
    const points = (await getPcbRaw()).board!.polygon;
    assert.ok(points.length > 20);
    const bounds = [Math.min(...points.map(p => p.x)), Math.min(...points.map(p => p.y)),
        Math.max(...points.map(p => p.x)), Math.max(...points.map(p => p.y))];
    for (const [i, value] of [10, 20, 110, 220].entries()) assert.ok(Math.abs(bounds[i] - value * 0.0254) < 0.0001);
    const area = Math.abs(points.reduce((sum, p, i) => {
        const next = points[(i + 1) % points.length]; return sum + p.x * next.y - p.y * next.x;
    }, 0)) / 2;
    assert.ok(Math.abs(area - (20000 - (4 - Math.PI) * 15 ** 2) * 0.0254 ** 2) < 0.005);
});

test('all repeated ARC endpoints convert to mm in both preview and V2 captures', async (t) => {
    const api = (globalThis as any).eda;
    const originalFill = api.pcb_PrimitiveFill, originalLine = api.pcb_PrimitiveLine.getAll;
    t.after(() => { api.pcb_PrimitiveFill = originalFill; api.pcb_PrimitiveLine.getAll = originalLine; });
    api.pcb_PrimitiveLine.getAll = async () => [];
    api.pcb_PrimitiveFill = { getAll: async () => [{ getState_ComplexPolygon: () => ({ getSource: () => [100, 0, 'ARC', 90, 0, 100, 90, -100, 0] }),
        getState_Net: () => 'GND', getState_Layer: () => 1, getState_PrimitiveId: () => 'fill', getState_FillMode: () => 0, getState_LineWidth: () => 0 }] };
    const { getPcbRaw } = await import('../src/eda/pcb.ts');
    for (const routing of [false, true]) {
        const raw = await getPcbRaw(routing);
        assert.deepEqual(raw.polygons[0].sources, [[2.54, 0, 'ARC', 90, 0, 2.54, 90, -2.54, 0]]);
    }
});

test('V2 rejects failed native reads while the legacy raw read keeps its existing best-effort result', async () => {
    const { getPcbRaw } = await import('../src/eda/pcb.ts');
    await assert.rejects(getPcbRaw(true), /Native track read failed/);
    const legacy = await getPcbRaw();
    assert.equal(legacy.board?.polygon.length, 4);
    assert.deepEqual(legacy.tracks, []);
    assert.equal('routing' in legacy, false);
    assert.deepEqual(Object.keys(legacy).sort(), ['arcs', 'board', 'components', 'pads', 'polygons', 'tracks', 'vias']);
});

test('NGON side count stays dimensionless in preview and V2', async (t) => {
    const api = (globalThis as any).eda;
    const originalPad = api.pcb_PrimitivePad, originalLine = api.pcb_PrimitiveLine.getAll;
    t.after(() => { api.pcb_PrimitivePad = originalPad; api.pcb_PrimitiveLine.getAll = originalLine; });
    api.pcb_PrimitiveLine.getAll = async () => [];
    api.pcb_PrimitivePad = { getAll: async () => [{ getState_PrimitiveId: () => 'hex', getState_Pad: () => ['NGON', 100, 6],
        getState_X: () => 50, getState_Y: () => 50, getState_Net: () => 'GND', getState_PadNumber: () => '1',
        getState_Layer: () => 1, getState_Rotation: () => 0, getState_Hole: () => undefined,
        getState_Metallization: () => true, getState_SpecialPad: () => [] }] };
    const { getPcbRaw } = await import('../src/eda/pcb.ts');
    for (const routing of [false, true]) assert.deepEqual((await getPcbRaw(routing)).pads[0].shape, ['NGON', 2.54, 6]);
});
