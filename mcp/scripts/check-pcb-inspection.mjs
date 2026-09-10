import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { build } from 'esbuild';
import ts from 'typescript';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../package.json', import.meta.url));
// Bundle the production reader and DRC adapter. Only replace utils' editor/bootstrap
// dependencies, retaining its exact unit conversions and string handling.
const utils = ts.createSourceFile('utils.ts', await readFile(root + 'src/eda/utils.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const helpers = utils.statements.filter(node => ['round', 'milToMm', 'mmToMil', 'safeString'].includes(node.name?.text))
  .map(node => node.getText(utils)).join('\n');
const bundled = await build({
  stdin: { contents: 'export * from "./src/eda/pcb"; export * from "./shared/types/pcb/explain";', resolveDir: root },
  bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'native-reader-fixture', setup(builder) {
    builder.onLoad({ filter: /[\\/]src[\\/]eda[\\/]utils\.ts$/ }, () => ({
      contents: helpers + '\nexport const VERSION_EDASYEDA = [3, 2, 149];', loader: 'ts',
    }));
  } }],
});

const states = values => Object.fromEntries(Object.entries(values).map(([key, value]) => ['getState_' + key, () => value]));
const layers = { TOP: 1, BOTTOM: 2, MULTI: 12, INNER_1: 15, BOARD_OUTLINE: 11 };
Object.assign(layers, Object.fromEntries(Object.entries(layers).map(([key, value]) => [value, key])));
let board, serial = 0, checks = 0;
function reset() {
  board = { components: [], pads: [], lines: [], arcs: [], vias: [], pours: [], fills: [], drc: [], doc: 'pcb-fixture', drcCalls: 0 };
}
function pad(x, y = 0, extra = {}) {
  return states({ PrimitiveId: 'pad-' + serial++, PadNumber: '1', Net: 'TEST', X: x, Y: y,
    Layer: 1, Pad: ['ELLIPSE', 20, 20], Rotation: 0, Metallization: false, Hole: null, ...extra });
}
function component(designator, pins) {
  board.pads.push(...pins);
  const c = { ...states({ Designator: designator, X: pins[0].getState_X(), Y: pins[0].getState_Y(),
    Layer: pins[0].getState_Layer(), Pads: pins.map(p => ({ primitiveId: p.getState_PrimitiveId(), padNumber: p.getState_PadNumber(), net: p.getState_Net() })),
    OtherProperty: { Value: 'fixture' }, Footprint: { name: 'fixture' } }), getAllPins: async () => pins };
  board.components.push(c);
  return c;
}
function line(x1, y1, x2, y2, layer = 1, width = 10) {
  const l = states({ PrimitiveId: 'line-' + serial++, Net: 'TEST', Layer: layer, StartX: x1, StartY: y1, EndX: x2, EndY: y2, LineWidth: width });
  board.lines.push(l);
  return l;
}
function via(x, y, diameter = 24) {
  board.vias.push(states({ PrimitiveId: 'via-' + serial++, Net: 'TEST', X: x, Y: y, Diameter: diameter, HoleDiameter: 12 }));
}
const item = (type, obj1, obj2) => ({ errorType: type, obj1: { suffix: obj1 }, obj2: obj2 ? { suffix: obj2 } : undefined,
  explanation: { str: 'Distance {distance}', param: { distance: '0.1mm' } } });
const group = (name, items, category = 'Connection Error') => ({ name: category, list: [{ name, list: items }] });
const eda = {
  dmt_SelectControl: { getCurrentDocumentInfo: async () => ({ documentType: 3, uuid: board.doc }) },
  pcb_PrimitiveComponent: { getAll: async () => board.components },
  pcb_PrimitivePad: { getAll: async () => board.pads },
  pcb_Primitive: { getPrimitivesByPrimitiveId: async ids => board.pads.filter(p => ids.includes(p.getState_PrimitiveId())) },
  pcb_PrimitivePolyline: { getAll: async () => [] },
  pcb_PrimitiveLine: { getAll: async () => { if (board.lineError) throw new Error('native line read failed'); return board.lines; } },
  pcb_PrimitiveArc: { getAll: async () => board.arcs },
  pcb_PrimitiveVia: { getAll: async () => board.vias },
  pcb_PrimitivePour: { getAll: async () => board.pours },
  pcb_PrimitiveFill: { getAll: async () => board.fills },
  pcb_Layer: { getAllLayers: async () => [1, 2, 15].map(id => ({ id, layerStatus: 1, type: 'SIGNAL' })) },
  pcb_Drc: { check: async (...args) => {
    assert.deepEqual(args, [true, false, true]);
    board.drcCalls++;
    if (board.switchDocument) board.doc = 'different-board';
    if (board.drcError) throw new Error('native DRC failed');
    return board.drc;
  } },
};
const module = { exports: {} };
vm.runInNewContext(bundled.outputFiles[0].text, { module, exports: module.exports, require, console, eda,
  EPCB_LayerId: layers, EPCB_LayerType: { SIGNAL: 'SIGNAL' }, EDMT_EditorDocumentType: { PCB: 3 },
  EPCB_PrimitivePadShapeType: { POLYLINE_COMPLEX_POLYGON: 'POLYGON', REGULAR_POLYGON: 'NGON' },
});
const { getPcb, inspectNet, InspectPcbNetSchema, ExplainPcbSchema } = module.exports;
const plain = value => JSON.parse(JSON.stringify(value));
const inspect = async (net = 'TEST', limit = 24) => plain(InspectPcbNetSchema().parse(await inspectNet(net, limit)));
const pcb = async () => plain(ExplainPcbSchema().parse(await getPcb()));
const test = async (name, callback) => { reset(); await callback(); checks++; console.log('PASS ' + name); };


await test('net totals use mm once and retain all native copper', async () => {
  component('J1', [pad(0)]); component('J2', [pad(1000)]); component('J3', [pad(3000)]);
  line(0, 0, 1000, 0);
  board.drc = [group('TEST', [item('Connection Error', '(TEST): J3_1')])];
  const r = await inspect();
  assert.deepEqual(r.pads, ['J1.1', 'J2.1', 'J3.1']);
  assert.equal(r.length, 25.4);
  assert.deepEqual(r.width, { min: 0.254, max: 0.254 });
  assert.deepEqual(r.bbox, { left: -0.127, right: 25.527, top: 0.127, bottom: -0.127 });
  assert.equal(r.drc.violations[0].obj1, '(TEST): J3_1');
  for (const removed of ['units', 'document_uuid', 'connected_pads', 'unconnected_pads', 'connectivity', 'direct_distance', 'detour_ratio']) {
    assert.equal(removed in r, false);
  }
});
await test('unrouted net still runs DRC; net filtering precedes truncation', async () => {
  component('J1', [pad(0)]); component('J2', [pad(1000)]);
  board.drc = [group('Clearance', [
    ...Array.from({ length: 40 }, () => item('Clearance Error', '(OTHER): U9_1')),
    item('Clearance Error', '(TEST): J1_1', '(OTHER): U9_1'),
  ], 'Clearance Error'), group('TEST', [item('Connection Error', '(TEST): J1_1'), item('Connection Error', '(TEST): J2_1')])];
  const r = await inspect('TEST', 1);
  assert.equal(r.found, true);
  assert.equal(r.segments, 0); assert.equal(r.length, 0); assert.equal(r.width, null);
  assert.equal(board.drcCalls, 1);
  assert.equal(r.drc.violation_count, 3);
  assert.equal(r.drc.violations.length, 1);
  assert.equal(r.drc.truncated, true);
  assert.equal(r.drc.violations[0].message, 'Distance 0.1mm');
  const full = await inspect('TEST', 200);
  assert.equal(full.drc.truncated, false);
  assert.equal(full.drc.violations[2].obj1, '(TEST): J2_1');
});
await test('one net summary covers separate tracks on different layers without tracing islands', async () => {
  line(0, 0, 1000, 0); line(3000, 0, 3500, 0, 2, 20); line(0, 0, 100, 0, 15, 5);
  via(9000, 9000); // Count vias by net even when far from every track.
  const r = await inspect();
  assert.equal(r.length, 40.64);
  assert.equal(r.segments, 3); assert.equal(r.vias, 1);
  assert.deepEqual(r.layer, ['TOP', 'BOTTOM', 'INNER_1', 'MULTI']);
  assert.deepEqual(r.width, { min: 0.127, max: 0.508 });
  assert.equal((await pcb()).wires.length, 1);
});
await test('pad shapes and pad-contact APIs are not read', async () => {
  const p = pad(0);
  p.getState_Pad = () => { throw new Error('Unexpected pad geometry read'); };
  component('J1', [p]);
  line(0, 0, 1000, 0);
  const r = await inspect();
  assert.deepEqual(r.pads, ['J1.1']); assert.equal(r.length, 25.4);
});
await test('arcs contribute circular length and one native segment without tessellation', async () => {
  board.arcs.push(states({ PrimitiveId: 'arc', Net: 'TEST', Layer: 1, StartX: 0, StartY: 0, EndX: 100, EndY: 100, ArcAngle: 90, LineWidth: 10 }));
  const r = await inspect();
  assert.equal(r.length, 3.9898); assert.equal(r.segments, 1);
  assert.deepEqual(r.bbox, { left: -0.127, right: 2.667, top: 2.667, bottom: -0.127 });
});
await test('arc bounds include extrema between endpoints', async () => {
  board.arcs.push(states({ PrimitiveId: 'arc', Net: 'TEST', Layer: 2, StartX: -100, StartY: 0, EndX: 100, EndY: 0, ArcAngle: 180, LineWidth: 10 }));
  assert.deepEqual((await inspect()).bbox, { left: -2.667, right: 2.667, top: 0.127, bottom: -2.667 });
  board.arcs[0].getState_ArcAngle = () => -180;
  assert.deepEqual((await inspect()).bbox, { left: -2.667, right: 2.667, top: 2.667, bottom: -0.127 });
});
await test('source pour outlines do not suppress tracks or claim pad connections', async () => {
  component('J1', [pad(0)]); line(0, 0, 1000, 0);
  const outline = [-50, 50, 'L', 1050, 50, 1050, -50, -50, -50];
  board.pours = [states({ Net: 'TEST', Layer: 1, ComplexPolygon: { getSource: () => outline } }),
    states({ Net: 'TEST', Layer: 15, ComplexPolygon: { getSource: () => outline } })];
  const r = await inspect();
  assert.equal(r.length, 25.4);
  assert.equal(r.polygons.length, 2);
  assert.equal('geometry' in r.polygons[0], false);
  assert.equal(r.polygons[0].connects, undefined);
  assert.equal(r.polygons[0].pads_in_outline, undefined);
});
await test('pad membership is unique and includes standalone PCB pads', async () => {
  component('J1', [pad(0), pad(1000)]);
  const standalone = pad(3000); board.pads.push(standalone);
  assert.deepEqual((await inspect()).pads, ['J1.1', 'pad:' + standalone.getState_PrimitiveId()]);
});
await test('footprint-local pad IDs do not duplicate component pads as standalone pads', async () => {
  const p = pad(0, 0, { PrimitiveId: 'component-e15' });
  const c = component('J1', [p]);
  c.getState_Pads = () => [{ primitiveId: 'e15', padNumber: '1', net: 'TEST' }];
  board.pads.push(pad(100, 0, { PrimitiveId: 'e15' }));
  assert.deepEqual((await inspect()).pads, ['J1.1', 'pad:e15']);
});
await test('via-only net has a count, bounds and no invented track width', async () => {
  via(100, 0);
  const r = await inspect();
  assert.equal(r.found, true); assert.equal(r.vias, 1); assert.equal(r.segments, 0); assert.equal(r.width, null);
  assert.deepEqual(r.bbox, { left: 2.2352, right: 2.8448, top: 0.3048, bottom: -0.3048 });
});
await test('missing net and single-pad net remain distinguishable without connectivity verdicts', async () => {
  const missing = await inspect('MISSING');
  assert.equal(missing.found, false); assert.equal(missing.drc.violation_count, 0);
  component('J1', [pad(0)]);
  assert.equal((await inspect()).found, true);
});
await test('native connection references are preserved without pad-name parsing', async () => {
  board.drc = [group('TEST_OTHER', [item('Connection Error', '(TEST_OTHER): J1_1')]),
    group('TEST', [item('Connection Error', '(TEST): e45'), item('Connection Error', ': e46')])];
  const r = await inspect();
  assert.equal(r.drc.violation_count, 2);
  assert.equal(r.drc.violations[0].obj1, '(TEST): e45');
  assert.equal(r.drc.violations[1].obj1, ': e46');
});
await test('net names with parentheses match literally, including the second DRC object', async () => {
  board.drc = [group('Clearance', [item('Clearance Error', '(OTHER): U1_1', '(A(B)): U2_1'),
    item('Clearance Error', '(A(B)_OTHER): U3_1')], 'Clearance Error')];
  assert.equal((await inspect('A(B)')).drc.violation_count, 1);
});
await test('non-copper graphics and other nets are excluded from statistics', async () => {
  line(0, 0, 1000, 0, 11);
  line(0, 0, 1000, 0).getState_Net = () => 'OTHER';
  const r = await inspect();
  assert.equal(r.found, false); assert.equal(r.length, 0); assert.equal(r.width, null);
});
for (const value of [true, false, null, { success: true }]) await test('malformed native DRC cannot become a clean result: ' + JSON.stringify(value), async () => {
  board.drc = value;
  await assert.rejects(inspect(), /did not return detailed results/);
});
await test('native read and DRC failures are propagated', async () => {
  board.lineError = true; await assert.rejects(inspect(), /native line read failed/);
  board.lineError = false; board.drcError = true; await assert.rejects(inspect(), /native DRC failed/);
});
await test('changing the active document rejects mixed-board evidence', async () => {
  board.switchDocument = true;
  await assert.rejects(inspect(), /Active PCB changed/);
});
console.log('PCB inspection checks passed (' + checks + ').');
