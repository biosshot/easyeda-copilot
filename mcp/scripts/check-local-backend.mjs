import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { registerCircuitTools } from '../dist/tools/circuit.js';
import { registerPcbLayoutTools } from '../dist/tools/pcb/pcb-layout.js';
import { disposeBackend } from 'eda-copilot-backend/pcb';
import { installEasyEdaFixture, schematicInput } from '../../backend/tests/fixtures/api-fixtures.mjs';

const handlers = new Map();
const server = { registerTool(name, _schema, handler) { handlers.set(name, handler); } };
const requests = [];
let currentSchematic = { components: [] };
const bridge = {
  async requestEasyEda(event, body) {
    requests.push({ event, body });
    if (event === 'get-schematic') return structuredClone(currentSchematic);
    if (event === 'get-multi-page-schematic') return { components: [] };
    if (event === 'get-pcb-existing-placement') return undefined;
    if (event === 'checkpoint-save') return { checkpointId: 'before-beautify' };
    if (event === 'assemble-circuit') return { sheetSpace: { freePercent: 8 } };
    if (['beautify-current-page', 'assemble-board'].includes(event)) return {};
    throw new Error(`Unexpected bridge event: ${event}`);
  },
};
const call = async (name, input) => {
  const result = await handlers.get(name)(input);
  const text = result.content[0].text;
  try { return JSON.parse(text); } catch { return text; }
};
registerCircuitTools(server, bridge);
registerPcbLayoutTools(server, bridge);
const transport = installEasyEdaFixture();
try {
  assert.deepEqual(await call('search_reused_block', { query: 'power' }), []);
  assert.ok((await call('component_search', { MPN: 'TEST-1K' })).components.length);
  const extracted = await call('extract_circuit_on_current_page', schematicInput.circuit);
  assert.equal(extracted.sheetSpace.level, 'warning');
  assert.ok(requests.find(r => r.event === 'assemble-circuit').body.circuit.components.length);
  currentSchematic = { components: schematicInput.circuit.add_components };
  const beautified = await call('beautify_schematic_on_current_page', { blocks: { divider: ['R1', 'R2'] }, draw_block_box: true });
  assert.equal(beautified.checkpointId, 'before-beautify');
  const apply = requests.find(r => r.event === 'beautify-current-page');
  assert.equal(apply.body.checkpointId, 'before-beautify');
  assert.equal(apply.body.circuit.assembly_options.draw_blocks, true);
  await assert.rejects(call('extract_circuit_on_current_page', { ...schematicInput.circuit, add_reused_blocks: [{}] }), /Reusable blocks are not supported/);

  const directory = fileURLToPath(new URL('../.test-data/backend/', import.meta.url));
  await mkdir(directory, { recursive: true });
  const file = `${directory}/placement.js`;
  // A procedural board needs no network in the worker; full footprint placement is tested by backend fixtures.
  await writeFile(file, `
    board.rect(20, 12);
    solderJumper("SJ1", { nets: ["A", "B"] });
    boardPad("debug", {
      at: anchor("board.bottom"), offset: { x: 0, y: -2 }, layer: "multi", pitch: 1.27, rowPitch: 1.27,
      pads: [[{ name: "GND", net: "GND", shape: "round", diameter: 1,
        hole: { diameter: 0.3, offset: { x: 0.05, y: -0.02 } } }]],
    });
  `);
  const result = await call('make_pcb_layout', { file, wait_ms: 55_000 });
  assert.equal(result.status, 'completed', JSON.stringify(result));
  assert.ok(result.operation_id);
  assert.ok(result.layoutId, JSON.stringify(result));
  assert.deepEqual([...await readFile(result.previewImagePath)].slice(0, 8), [137, 80, 78, 71, 13, 10, 26, 10]);
  await call('assemble_pcb_layout_on_current_pcbdoc', { layoutId: result.layoutId });
  const board = requests.find(r => r.event === 'assemble-board').body.boardAssemble;
  assert.ok(board);
  assert.deepEqual(board.pads.find(pad => pad.name === 'debug.GND').hole, { diameter: 0.3, x: 0.05, y: -0.02 });
  const sizes = await call('get_pcb_component_sizes', { includeAll: true });
  assert.match(sizes, /component_sizes/);
} finally {
  transport.restore();
  await disposeBackend();
}
console.log('Local MCP backend: search, schematic, beautify, native PCB, preview and assembly passed.');
