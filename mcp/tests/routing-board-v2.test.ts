import assert from 'node:assert/strict';
import test from 'node:test';
import type { RawPcb, RawPcbPolygon } from '@copilot/shared/types/pcb/raw';
import { importEasyEdaBoardV2, nativeCopperPolygons } from '../src/routing/easyeda-board-v2';
import { parsePolygonSource } from '../src/pcb-preview/parser';
import { readEasyEdaBlindViaSpan, readEasyEdaPourRefillRules } from '../src/routing/easyeda-drc-adapter';
import { registerPcbRoutingTools } from '../src/tools/pcb/pcb-routing';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerPcbAnalysisTools } from '../src/tools/pcb/pcb-analysis';
import { operationManager } from '../src/operations/manager';
import { operationToolResult } from '../src/operations/tool-result';
import { TEMP_DIR } from '../src/utils/dirs';

const source = {
    boardOutline: { path: [[0, 0], [20, 0], [20, 10], [0, 10], [0, 0]] },
    layers: { route: [1, 2] }, components: {}, footprints: {},
    nets: [{ net: 'SIG', safeClearance: 'cls', trackWidth: 'cls', viaSize: 'cls' }],
    rules: { safeClearances: { cls: [{ trackToTrack: 0.2, trackToBoardOutline: 0.5 }] },
        trackWidths: { cls: [{ trackWidth: [0.2, 0.25, 0.3] }] }, viaSizes: { cls: [0.6, 0.3] } },
};
const drc = { ruleConfiguration: {}, netRules: [] };
const ring = (x: number, y: number, w: number, h: number) => [x, y, 'L', x + w, y, x + w, y + h, x, y + h, 'Z'];
const raw = (): RawPcb => ({ components: [{ id: 'c1', designator: 'U1', x: 5, y: 6, rotate: 90, layer: 'BOTTOM', value: 'IC', footprintName: 'QFN' }],
    pads: [{ id: 'p1', component: 'U1', padNumber: '1', x: 5, y: 6, rotation: Math.PI / 2, layer: 'MULTI', net: 'SIG',
        shape: ['POLYGON', [ring(4, 5, 2, 2)]], plated: true,
        hole: { data: ['SLOT', 0.5, 1], offsetX: 0.2, offsetY: 0.3, rotation: Math.PI / 4 } },
    { id: 'standalone', padNumber: '', x: 2, y: 2, rotation: 0, layer: 'MULTI', net: '', shape: ['ELLIPSE', 2, 2], plated: false,
        hole: { data: ['ROUND', 1], offsetX: 0, offsetY: 0, rotation: 0 } }],
    tracks: [{ id: 't', net: '', layer: 'TOP', x1: 1, y1: 2, x2: 2, y2: 2, width: 0.2 },
        { id: 'silk', net: '', layer: 'TOP_SILKSCREEN', x1: 1, y1: 1, x2: 2, y2: 2, width: 0.2 }],
    arcs: [{ id: 'a', net: 'SIG', layer: 'BOTTOM', x1: 1, y1: 0, x2: -1, y2: 0, arcAngle: 180, width: 0.2 }],
    vias: [{ id: 'v', viaType: 0, x: 3, y: 4, diameter: 0.6, drill: 0.3 }], polygons: [],
    routing: { layers: ['TOP', 'BOTTOM'], planeLayers: [], polylines: [], outlines: [ring(0, 0, 20, 10)], pours: [] },
});
const poly = (sources: (string | number)[][], lineWidth = 0, fill = true): RawPcbPolygon => ({ net: '', layer: 'TOP', sources, lineWidth, fill });
const ringArea = (ring: readonly { x: number; y: number }[]) => Math.abs(ring.reduce((a, p, i) => {
    const q = ring[(i + 1) % ring.length]; return a + p.x * q.y - p.y * q.x;
}, 0)) / 2;
const area = (regions: ReturnType<typeof nativeCopperPolygons>) => regions.reduce((a, p) => a + ringArea(p.outer) - (p.holes ?? []).reduce((s, h) => s + ringArea(h), 0), 0);

test('native pads, absolute polygon shapes, bottom transforms, slots and netless copper survive V2', () => {
    const { board } = importEasyEdaBoardV2(source, raw(), drc);
    assert.deepEqual(board.components[0].at, { x: 5, y: -6 });
    assert.equal(board.components[0].side, 'bottom');
    assert.equal(board.components[0].value, 'IC');
    const pad = board.pads[0];
    assert.equal(pad.rotationDeg, -90);
    assert.equal(pad.shape.kind, 'polygon');
    if (pad.shape.kind === 'polygon') assert.ok(pad.shape.polygon.outer.every(p => Math.abs(p.x) <= 1.000001 && Math.abs(p.y) <= 1.000001));
    assert.deepEqual(pad.hole, { shape: 'slot', diameterMm: 0.5, slotLengthMm: 1, offset: { x: 0.2, y: -0.3 }, rotationDeg: -45, plated: true });
    assert.equal(board.pads[1].component, undefined);
    assert.equal(board.pads[1].hole?.plated, false);
    assert.deepEqual(board.pads[1].layers, ['TOP', 'BOTTOM']);
    assert.equal(board.copper.fixed.tracks.length, 2);
    assert.equal(board.copper.fixed.tracks[0].net, undefined);
    assert.deepEqual(board.copper.fixed.tracks[0].points, [{ x: 1, y: -2 }, { x: 2, y: -2 }]);
    assert.ok(board.copper.fixed.tracks[1].points.some(p => p.y < -0.99));
    assert.equal(board.copper.fixed.vias[0].net, undefined);
    assert.equal(board.copper.fixed.vias[0].toLayer, 'BOTTOM');
    assert.deepEqual(board.copper.editable, { tracks: [], vias: [], zones: [] });
});

test('V2 omits API holes on TOP/BOTTOM POLYGON pads with a diagnostic and preserves raw evidence', () => {
    for (const layer of ['TOP', 'BOTTOM'] as const) {
        const data = raw();
        data.pads[0].layer = layer;
        data.pads[0].hole!.data = ['ROUND', 0.5334];
        const before = structuredClone(data);
        const { board, diagnostics } = importEasyEdaBoardV2(source, data, drc);
        assert.equal('hole' in board.pads[0], false);
        assert.deepEqual(board.pads[0].layers, [layer]);
        assert.equal(board.pads[0].shape.kind, 'polygon');
        const warnings = diagnostics.filter(d => d.code === 'EASYEDA_V2_SINGLE_LAYER_POLYGON_HOLE_IGNORED');
        assert.equal(warnings.length, 1);
        assert.equal(warnings[0].severity, 'warning');
        assert.match(warnings[0].message, /U1\.1 \(p1\)/);
        assert.ok(warnings[0].message.includes(layer));
        assert.deepEqual(data, before);
        delete data.pads[0].hole;
        assert.equal(importEasyEdaBoardV2(source, data, drc).diagnostics.some(d => d.code === warnings[0].code), false);
    }
});

test('V2 hole workaround preserves multilayer polygon and non-polygon round/slot drills', () => {
    for (const shape of [['POLYGON', [ring(4, 5, 2, 2)]], ['RECT', 2, 2, 0]] as RawPcb['pads'][number]['shape'][]) {
        for (const hole of [['ROUND', 0.5], ['SLOT', 0.5, 1]]) {
            const data = raw();
            data.pads[0].shape = shape;
            data.pads[0].layer = shape?.[0] === 'POLYGON' ? 'MULTI' : 'TOP';
            data.pads[0].hole!.data = hole;
            const { board, diagnostics } = importEasyEdaBoardV2(source, data, drc);
            assert.deepEqual(board.pads[0].hole, {
                shape: hole[0] === 'ROUND' ? 'round' : 'slot', diameterMm: 0.5,
                ...(hole[0] === 'SLOT' ? { slotLengthMm: 1 } : {}),
                offset: { x: 0.2, y: -0.3 }, rotationDeg: -45, plated: true,
            });
            assert.equal(board.pads[1].hole?.plated, false);
            assert.equal(board.copper.fixed.vias[0].drillMm, 0.3);
            assert.equal(diagnostics.some(d => d.code === 'EASYEDA_V2_SINGLE_LAYER_POLYGON_HOLE_IGNORED'), false);
        }
    }
});

test('nested islands and very small holes are retained without preview filtering', () => {
    const regions = nativeCopperPolygons(poly([ring(0, 0, 10, 10), ring(2, 2, 0.2, 0.2), ring(2.05, 2.05, 0.1, 0.1)]));
    assert.equal(regions.length, 2);
    assert.equal(regions.reduce((s, p) => s + (p.holes?.length ?? 0), 0), 1);
    assert.ok(Math.abs(area(regions) - 99.97) < 1e-8);
});

test('circle, rounded rectangle and native Q curves use bounded sampling; preview keeps its defaults', () => {
    const circle = nativeCopperPolygons(poly([['CIRCLE', 0, 0, 5]]));
    assert.ok(Math.abs(area(circle) - 25 * Math.PI) < 0.03);
    const rectangle = nativeCopperPolygons(poly([['R', 0, 0, 4, 2, 37, 0.5]]));
    assert.ok(Math.abs(area(rectangle) - (8 - (4 - Math.PI) * 0.25)) < 0.005);
    const q = parsePolygonSource([0, 0, 'Q', 1, 2, 3, 4], {}, 0.001);
    assert.deepEqual(q[0].at(-1), { x: 3, y: 4 });
    assert.equal(parsePolygonSource(['CIRCLE', 0, 0, 5])[0].length, 24);
    assert.throws(() => nativeCopperPolygons(poly([[0, 0, 'L', 1, 0, 'BOGUS', 2, 2]])), /Unsupported polygon commands|Unexpected native/);
});

test('native strokes become copper area, preserving interior holes', () => {
    const regions = nativeCopperPolygons(poly([ring(0, 0, 10, 10)], 0.2, false));
    assert.ok(area(regions) > 7.99 && area(regions) < 8.01);
    assert.equal(regions[0].holes?.length, 1);
    assert.ok(Math.abs(area(nativeCopperPolygons(poly([ring(0, 0, 10, 10).slice(0, -1)], 0.2, false))) - area(regions)) < 1e-8);
    const combined = nativeCopperPolygons(poly([ring(0, 0, 10, 10), ring(2, 2, 1, 1)], 0.2));
    assert.ok(area(combined) > 103 && area(combined) < 104);
});

test('missing Poured and verified empty Poured are different states; Fill is independent', () => {
    const data = raw();
    data.routing!.pours = ['missing', 'empty'].map(id => ({ ...poly([ring(0, 0, 2, 2)]), id, priority: 3, preserveIslands: false, pouredIds: id === 'empty' ? ['native-poured'] : [] }));
    data.polygons = [{ ...poly([ring(3, 0, 1, 1)]), id: 'fill' }];
    const { board } = importEasyEdaBoardV2(source, data, drc);
    const zones = board.copper.fixed.zones;
    assert.equal(zones[0].kind, 'pour');
    assert.equal(zones[0].filledPolygons[0].status, 'missing');
    assert.deepEqual(zones[1].filledPolygons[0], { layer: 'TOP', source: 'cad', status: 'available', freshness: 'unknown', nativePrimitiveIds: ['native-poured'], polygons: [] });
    assert.equal(zones[2].kind, 'fill');
    data.polygons[0].fillMode = 1;
    assert.equal(importEasyEdaBoardV2(source, data, drc).board.copper.fixed.zones[2].filledPolygons[0].status, 'unsupported');
});

test('special pad shapes and suture vias cover physical layers; unresolved via spans fail', () => {
    const data = raw();
    data.routing!.layers = ['TOP', 'INNER_1', 'BOTTOM'];
    data.routing!.planeLayers = ['INNER_1'];
    data.pads[1].specialPad = [[1, 15, ['RECT', 3, 4, 0]]];
    const { board, diagnostics } = importEasyEdaBoardV2(source, data, drc);
    assert.deepEqual(board.pads[1].shapesByLayer?.INNER_1, { kind: 'rect', widthMm: 3, heightMm: 4 });
    assert.equal(board.pads[1].shapesByLayer?.BOTTOM.kind, 'circle');
    assert.ok(diagnostics.some(d => d.code === 'EASYEDA_V2_PLANE_COPPER_UNAVAILABLE'));
    data.vias[0] = { id: 'suture', viaType: 2, blindViaRule: '', net: 'SIG', x: 3, y: 4, diameter: 0.6, drill: 0.3 };
    assert.deepEqual(importEasyEdaBoardV2(source, data, drc).board.copper.fixed.vias[0], {
        id: 'suture', net: 'SIG', at: { x: 3, y: -4 }, diameterMm: 0.6, drillMm: 0.3,
        type: 'through', fromLayer: 'TOP', toLayer: 'BOTTOM',
    });
    delete data.vias[0].blindViaRule;
    assert.equal(importEasyEdaBoardV2(source, data, drc).board.copper.fixed.vias[0].type, 'through');
    data.vias[0].blindViaRule = 'unresolved';
    assert.throws(() => importEasyEdaBoardV2(source, data, drc), /Unresolved via span/);
    delete data.vias[0].blindViaRule;
    for (const viaType of [1, 3, undefined]) {
        data.vias[0].viaType = viaType;
        assert.throws(() => importEasyEdaBoardV2(source, data, drc), /Unresolved via span/);
    }
    delete data.routing;
    assert.throws(() => importEasyEdaBoardV2(source, data, drc), /Reload the extension/);
});

test('Pour rules read both pad groups and reject a nonuniform scalar clearance', () => {
    const bundle = { netRules: [], ruleConfiguration: {
        Spacing: { 'Copper Safe Spacing': { preset: { isSetDefault: true, table: [{ content: [[0.2, 0.3]] }] } } },
        Plane: { 'Copper Zone': { preset: { isSetDefault: true, singleLayerPadModel: { connectMode: 0, lineClearance: 0.2, lineWidth: 0.3, lineAngle: 45 }, multiLayerPadModel: { connectMode: 1 } } } },
    } };
    const rules = readEasyEdaPourRefillRules(bundle, 'SIG');
    assert.equal(rules.status, 'partial');
    assert.equal(rules.clearanceMm, undefined);
    assert.deepEqual(rules.padConnection?.singleLayer, { mode: 'thermal', thermalGapMm: 0.2, spokeWidthMm: 0.3, spokeAngleDeg: 45 });
    assert.equal(rules.padConnection?.multiLayer?.mode, 'solid');
    assert.ok(rules.unresolved.some(r => r.includes('nonuniform')));
});

test('blind/buried via rules resolve native keys and names in physical layer order', () => {
    const data = raw();
    data.routing!.layers = ['TOP', 'INNER_1', 'INNER_2', 'INNER_3', 'INNER_4', 'BOTTOM'];
    const table = [
        { key: 'blind0', name: 'top blind', startLayer: 1, endLayer: 15, used: false },
        { key: 'blind1', name: 'bottom blind', startLayer: 2, endLayer: 18 },
        { key: 'blind2', name: 'buried', startLayer: 17, endLayer: 15 },
        { key: 'blind3', name: 'through', startLayer: 2, endLayer: 1 },
    ];
    const rules = { ruleConfiguration: { Physics: { 'Blind/Buried Via': {
        blindVia: { isSetDefault: true, table },
        custom: { table: [{ key: 'blind0', startLayer: 16, endLayer: 17 }] },
    } } }, netRules: [{ type: 'net' as const, name: 'SIG', 'Blind/Buried Via': 'custom' }] };
    data.vias = ['blind0', 'bottom blind', 'blind2', 'blind3'].map((blindViaRule, i) => ({
        ...data.vias[0], id: `v${i}`, viaType: 1, blindViaRule,
    }));
    const vias = importEasyEdaBoardV2(source, data, rules).board.copper.fixed.vias;
    assert.deepEqual(vias.map(v => [v.type, v.fromLayer, v.toLayer]), [
        ['blind-buried', 'TOP', 'INNER_1'], ['blind-buried', 'INNER_4', 'BOTTOM'],
        ['blind-buried', 'INNER_1', 'INNER_3'], ['through', 'TOP', 'BOTTOM'],
    ]);
    assert.deepEqual(vias[0], { id: 'v0', at: { x: 3, y: -4 }, diameterMm: 0.6, drillMm: 0.3,
        type: 'blind-buried', fromLayer: 'TOP', toLayer: 'INNER_1' });
    data.vias[0].net = 'SIG';
    const selected = importEasyEdaBoardV2(source, data, rules).board.copper.fixed.vias[0];
    assert.deepEqual([selected.fromLayer, selected.toLayer], ['INNER_2', 'INNER_3']);
    for (const viaType of [0, 2]) {
        data.vias[0].viaType = viaType;
        assert.equal(importEasyEdaBoardV2(source, data, rules).board.copper.fixed.vias[0].type, 'blind-buried');
    }
    delete data.vias[0].net;
    data.vias[1].blindViaRule = 'blind1';
    table[1].name = 'blind0';
    assert.equal(importEasyEdaBoardV2(source, data, rules).board.copper.fixed.vias[0].fromLayer, 'INNER_4');
    table[1].name = 'bottom blind';
    data.vias[0].blindViaRule = 'missing';
    assert.throws(() => importEasyEdaBoardV2(source, data, rules), /Unresolved via span v0/);
    data.vias[0].blindViaRule = 'blind0';
    for (const endLayer of [1, 19, 3, 15.5, NaN]) {
        table[0].endLayer = endLayer;
        assert.throws(() => importEasyEdaBoardV2(source, data, rules), /Unresolved via span v0/);
    }
    table[0] = { key: 'blind0', name: 'top blind', startLayer: 1, endLayer: 15, used: false };
    table.push({ ...table[0] });
    assert.throws(() => importEasyEdaBoardV2(source, data, rules), /Unresolved via span v0/);
    rules.netRules[0]['Blind/Buried Via'] = 'missing';
    data.vias[0].net = 'SIG';
    assert.throws(() => importEasyEdaBoardV2(source, data, rules), /Unresolved via span v0/);
    const inherited = { ...rules, netRules: [{ type: 'netClass' as const, name: 'signals',
        'Blind/Buried Via': 'custom', sub: [{ type: 'net' as const, name: 'SIG' }] }] };
    assert.deepEqual(readEasyEdaBlindViaSpan(inherited, 'blind0', 'SIG'), { startLayer: 16, endLayer: 17 });
});

test('export tool requests V2, saves native evidence and never applies routing', async () => {
    const handlers = new Map<string, (...args: any[]) => Promise<any>>();
    const events: string[] = [];
    const data = raw();
    const bridge = {
        getSelectedEasyEdaInstance: async () => ({ instanceId: 'test-instance' }),
        getVersionWarning: async () => undefined,
        requestEasyEda: async (event: string, body?: Record<string, unknown>) => {
            events.push(event);
            if (event === 'get-command-target') return { documentUuid: 'test-pcb' };
            assert.equal(event, 'export-routing-input');
            assert.deepEqual(body, { version: 2 });
            return { text: JSON.stringify(source), pcb: data, drc };
        },
    };
    registerPcbRoutingTools({ registerTool: (name: string, _definition: unknown, handler: (...args: any[]) => Promise<any>) => handlers.set(name, handler) } as never, bridge as never);
    const directory = await mkdtemp(join(tmpdir(), 'routing-board-v2-'));
    const file = join(directory, 'board.json');
    try {
        const handler = handlers.get('export_pcb_routing_board')!;
        await handler({ file }, { signal: new AbortController().signal });
        const result = JSON.parse(await readFile(file, 'utf8'));
        assert.equal(result.board.pads[0].id, 'p1');
        assert.equal(result.capture.pcb.pads[0].id, 'p1');
        assert.deepEqual(events, ['get-command-target', 'export-routing-input']);
        data.vias[0].viaType = 1;
        await assert.rejects(handler({ file }, { signal: new AbortController().signal }), /Unresolved via span/);
        assert.ok(JSON.parse(await readFile(file, 'utf8')).capture, 'native evidence survives a conversion failure');
    } finally {
        assert.ok(directory.startsWith(join(tmpdir(), 'routing-board-v2-')));
        await rm(directory, { recursive: true, force: true });
    }
});

test('independent drills are not duplicated as copper pads; copper circles remain closed tracks', () => {
    const data = raw();
    delete data.pads[1].shape;
    data.routing!.polylines = [{ ...poly([['CIRCLE', 2, 3, 1]], 0.2, false), id: 'circle' }];
    const { board } = importEasyEdaBoardV2(source, data, drc);
    assert.equal(board.pads.length, 1);
    assert.equal(board.holes?.length, 1);
    assert.deepEqual(board.holes?.[0].at, { x: 2, y: -2 });
    const circle = board.copper.fixed.tracks[0];
    assert.equal(circle.id, 'circle');
    assert.deepEqual(circle.points[0], circle.points.at(-1));
});

test('analysis tools save the scenario, summary and PNGs and return a backend refusal', async () => {
    const { handlers, requests } = analysisToolFixture();
    const input = await mkdtemp(join(tmpdir(), 'analysis-tool-input-'));
    const output: string[] = [];
    try {
        const file = join(input, 'scenario.js');
        await writeFile(file, "const a=analysis({board}); a.plot({title:'V2 capture',kind:'bar',data:[board.components.length,board.pads.length,board.layers.length,board.copper.fixed.tracks.length]});");
        const run = handlers.get('run_pcb_analysis')!;
        const extra = { signal: new AbortController().signal };
        const settled = await analysisToolTerminal(await run({ file, wait_ms: 1_000 }, extra));
        assert.equal(settled.result.isError, undefined);
        assert.equal(settled.body.status, 'complete');
        assert.match(settled.body.operation_id, /^pcb-analysis:[0-9a-f]{8}$/);
        output.push(settled.body.artifacts_directory);
        assert.deepEqual(requests, ['get-command-target', 'export-routing-input']);
        assert.ok(settled.body.images.some((image: { kind: string }) => image.kind === 'bar'));
        const result = JSON.parse(await readFile(settled.body.result_path, 'utf8'));
        assert.deepEqual(result.reports[0].plots[0].data, [1, 2, 2, 2]);
        const summary = JSON.parse(await readFile(settled.body.summary_path, 'utf8'));
        assert.equal(summary.physicalAccuracy, 'unverified');
        assert.deepEqual(summary.images, settled.body.images);
        assert.equal((await readFile(summary.images[0].image_path)).subarray(1, 4).toString(), 'PNG');

        await writeFile(file, "analysis({board}); throw new Error('fixture refusal');");
        const failed = await analysisToolTerminal(await run({ file, wait_ms: 1_000 }, extra));
        output.push(failed.body.artifacts_directory);
        assert.equal(failed.result.isError, true);
        assert.equal(failed.body.status, 'failed');
        assert.ok(failed.body.diagnostic_codes.includes('RUNTIME_ERROR'));
        assert.equal(JSON.parse(await readFile(failed.body.result_path, 'utf8')).error.code, 'RUNTIME_ERROR');
    } finally {
        for (const directory of output) {
            assert.ok(directory.startsWith(join(TEMP_DIR, 'pcb-analysis-')));
            await rm(directory, { recursive: true, force: true });
        }
        await rm(input, { recursive: true, force: true });
    }
});

test('analysis cancellation exits the worker and releases a process-wide slot', async () => {
    const { handlers, changeDocument } = analysisToolFixture();
    const directory = await mkdtemp(join(tmpdir(), 'analysis-tool-input-'));
    const file = join(directory, 'loop.js');
    let id: string | undefined;
    let output: string | undefined;
    try {
        const extra = { signal: new AbortController().signal };
        const run = handlers.get('run_pcb_analysis')!;
        await writeFile(file, 'analysis({board}); while (true) {}');
        const first = JSON.parse((await run({ file, wait_ms: 1_000 }, extra)).content[0].text);
        id = first.operation_id;
        assert.equal(first.status, 'running');
        assert.equal(first.stage, 'analyzing');
        changeDocument('another-pcb');
        await assert.rejects(run({ file, wait_ms: 1_000 }, extra), /PCB analysis is already running/);
        await operationManager.cancel(id!);
        await assert.rejects(operationManager.wait(id!, 10_000), /cancelled/i);
        await writeFile(file, 'analysis({board});');
        const second = await analysisToolTerminal(await run({ file, wait_ms: 1_000 }, extra));
        output = second.body.artifacts_directory;
        assert.equal(second.body.status, 'complete');
    } finally {
        if (id) await operationManager.cancel(id);
        if (output) {
            assert.ok(output.startsWith(join(TEMP_DIR, 'pcb-analysis-')));
            await rm(output, { recursive: true, force: true });
        }
        await rm(directory, { recursive: true, force: true });
    }
});

function analysisToolFixture() {
    const handlers = new Map<string, (...args: any[]) => Promise<any>>();
    const requests: string[] = [];
    let document = 'test-pcb';
    const bridge = {
        getSelectedEasyEdaInstance: async () => ({ instanceId: 'analysis-test-instance' }),
        getVersionWarning: async () => undefined,
        requestEasyEda: async (event: string, body?: Record<string, unknown>) => {
            requests.push(event);
            if (event === 'get-command-target') return { documentUuid: document };
            assert.equal(event, 'export-routing-input');
            assert.deepEqual(body, { version: 2 });
            return { text: JSON.stringify(source), pcb: raw(), drc };
        },
    };
    registerPcbAnalysisTools({ registerTool: (name: string, _spec: unknown, handler: (...args: any[]) => Promise<any>) => handlers.set(name, handler) } as never, bridge as never);
    return { handlers, requests, changeDocument: (value: string) => { document = value; } };
}

async function analysisToolTerminal(initial: { content: { text: string }[]; isError?: boolean }) {
    let result = initial;
    let body = JSON.parse(result.content[0].text);
    if (body.status === 'running') {
        result = await operationToolResult(await operationManager.wait(body.operation_id, 15_000)) as typeof result;
        body = JSON.parse(result.content[0].text);
    }
    assert.notEqual(body.status, 'running');
    return { result, body };
}
