import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { WebSocket } from 'ws';

// Optional paths let the same protocol test exercise an isolated npm installation.
const entry = process.argv[2] ?? fileURLToPath(new URL('../dist/index.js', import.meta.url));
const fixtureFile = process.argv[3] ?? fileURLToPath(new URL('../../backend/tests/fixtures/api-fixtures.mjs', import.meta.url));
const fixtureUrl = pathToFileURL(resolve(fixtureFile)).href;
const { schematicInput, PART_UUID, FOOTPRINT_UUID } = await import(fixtureUrl);
const directory = await mkdtemp(join(tmpdir(), 'mcp-backend-tools-'));
const preload = join(directory, 'provider.mjs');
await writeFile(preload, 'import { installEasyEdaFixture } from ' + JSON.stringify(fixtureUrl) + '; installEasyEdaFixture();');
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const client = new Client({ name: 'local-backend-check', version: '1.0.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [entry],
  // workerpool filters execArgv; NODE_OPTIONS also installs fixtures inside its child processes.
  env: { ...process.env, NODE_OPTIONS: '--import=' + pathToFileURL(preload).href, EASYEDA_COPILOT_MCP_WS_PORT: String(port), EASYEDA_COPILOT_MCP_WS_HOST: '127.0.0.1', EDA_BACKEND_LOG_LEVEL: 'silent' },
  stderr: 'pipe',
});
let stderr = '';
transport.stderr?.on('data', bytes => { stderr += bytes; });
const requests = [];
let currentSchematic = { components: [] };
const pcbSchematic = { components: schematicInput.circuit.add_components.map((component, index) =>
  index === 0 ? { ...component, footprint_uuid: FOOTPRINT_UUID } : component) };
let heldSnapshot;
let releaseSnapshot;
async function editorRequest(event, body) {
  requests.push({ event, body });
  if (event === 'get-schematic') return currentSchematic;
  if (event === 'get-multi-page-schematic') { await heldSnapshot; return pcbSchematic; }
  if (event === 'get-pcb-existing-placement') return undefined;
  if (event === 'checkpoint-save') return { checkpointId: 'before-beautify' };
  if (event === 'assemble-circuit') return { sheetSpace: { freePercent: 8 } };
  if (['beautify-current-page', 'assemble-board'].includes(event)) return {};
  throw new Error('Unexpected bridge event: ' + event);
}
const call = async (name, input) => {
  const result = await client.callTool({ name, arguments: input });
  const text = result.content[0].text;
  if (result.isError) throw new Error(text);
  try { return JSON.parse(text); } catch { return text; }
};
let editor;
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  for (const name of ['component_search', 'search_reused_block', 'extract_circuit_on_current_page', 'beautify_schematic_on_current_page', 'get_pcb_component_sizes', 'make_pcb_layout', 'assemble_pcb_layout_on_current_pcbdoc', 'wait_operation', 'cancel_operation']) {
    assert.ok(tools.some(tool => tool.name === name), 'Missing MCP tool: ' + name);
  }
  editor = new WebSocket('ws://127.0.0.1:' + port);
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Test editor handshake timed out')), 5000);
    editor.once('error', error => { clearTimeout(timer); reject(error); });
    editor.on('message', async raw => {
      const { event, body: encoded } = JSON.parse(raw.toString());
      if (event === 'connected') {
        editor.send(JSON.stringify({ event: 'easyeda:hello', body: JSON.stringify({ instanceId: 'backend-check', projectName: 'Backend fixtures' }) }));
        editor.send(JSON.stringify({ event: 'ping', body: '{}' }));
      } else if (event === 'pong') {
        clearTimeout(timer);
        resolve();
      } else {
        const body = JSON.parse(encoded);
        try {
          const result = await editorRequest(event, body);
          editor.send(JSON.stringify({ event, body: JSON.stringify({ id: body.id, ok: true, result }) }));
        } catch (error) {
          editor.send(JSON.stringify({ event, body: JSON.stringify({ id: body.id, ok: false, error: error.message }) }));
        }
      }
    });
  });
  await ready;
  assert.deepEqual(await call('search_reused_block', { query: 'power' }), []);
  assert.ok((await call('component_search', { MPN: 'TEST-1K' })).components.length);
  assert.equal((await call('component_search', { part_uuid: PART_UUID })).bestComponent.part_uuid, PART_UUID);
  const extracted = await call('extract_circuit_on_current_page', schematicInput.circuit);
  assert.equal(extracted.sheetSpace.level, 'warning');
  assert.ok(requests.find(r => r.event === 'assemble-circuit').body.circuit.components.length);
  currentSchematic = { components: schematicInput.circuit.add_components };
  const beautified = await call('beautify_schematic_on_current_page', { blocks: { divider: ['R1', 'R2'] }, draw_block_box: true });
  assert.equal(beautified.checkpointId, 'before-beautify');
  const apply = requests.find(r => r.event === 'beautify-current-page');
  assert.equal(apply.body.checkpointId, 'before-beautify');
  assert.equal(apply.body.circuit.assembly_options.draw_blocks, true);
  await assert.rejects(call('extract_circuit_on_current_page', {
    ...schematicInput.circuit, add_reused_blocks: [{ block_uuid: 'disabled', parameters_to_recalc: [], ports: [] }],
  }), /Reusable blocks are not supported/);

  const sizes = await call('get_pcb_component_sizes', { includeAll: true });
  assert.match(sizes, /component_sizes/);
  assert.match(sizes, /selected: 2/);
  assert.match(sizes, /R1/);
  assert.match(sizes, /R2/);
  const file = join(directory, 'placement.js');
  await writeFile(file, [
    'board.rect(30, 20); block("divider", ["R1", "R2"], "generic");',
    'solderJumper("SJ1", { nets: ["A", "B"] });',
    'boardPad("debug", {',
    '  at: anchor("board.bottom"), offset: { x: 0, y: -2 }, layer: "multi", pitch: 1.27, rowPitch: 1.27,',
    '  pads: [[{ name: "GND", net: "GND", shape: "round", diameter: 1,',
    '    hole: { diameter: 0.3, offset: { x: 0.05, y: -0.02 } } }]],',
    '});',
  ].join('\n'));
  const result = await call('make_pcb_layout', { file, wait_ms: 55_000 });
  assert.equal(result.status, 'completed', JSON.stringify(result));
  assert.ok(result.operation_id);
  assert.ok(result.layoutId, JSON.stringify(result));
  assert.deepEqual([...await readFile(result.previewImagePath)].slice(0, 8), [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal((await call('wait_operation', { operation_id: result.operation_id, wait_ms: 1000 })).layoutId, result.layoutId);
  await call('assemble_pcb_layout_on_current_pcbdoc', { layoutId: result.layoutId });
  const board = requests.find(r => r.event === 'assemble-board').body.boardAssemble;
  assert.deepEqual(board.components.map(component => component.designator).sort(), ['R1', 'R2']);
  assert.deepEqual(board.pads.find(pad => pad.name === 'debug.GND').hole, { diameter: 0.3, x: 0.05, y: -0.02 });

  const invalidFile = join(directory, 'invalid.js');
  await writeFile(invalidFile, 'invalid_call();');
  const invalid = await call('make_pcb_layout', { file: invalidFile, wait_ms: 55_000 });
  assert.match(invalid.content, /invalid_call/);
  assert.equal(invalid.layoutId, undefined);

  heldSnapshot = new Promise(resolve => { releaseSnapshot = resolve; });
  const pending = await call('make_pcb_layout', { file, wait_ms: 1000 });
  assert.equal(pending.status, 'running');
  const cancelled = await call('cancel_operation', { operation_id: pending.operation_id });
  assert.equal(cancelled.status, 'cancel_requested');
  releaseSnapshot();
  heldSnapshot = undefined;
  await assert.rejects(call('wait_operation', { operation_id: pending.operation_id, wait_ms: 1000 }), /Operation cancelled/);
  const recovered = await call('make_pcb_layout', { file, wait_ms: 55_000 });
  assert.ok(recovered.layoutId, JSON.stringify(recovered));
} catch (error) {
  if (stderr) console.error(stderr);
  throw error;
} finally {
  releaseSnapshot?.();
  if (editor && editor.readyState !== WebSocket.CLOSED) {
    const closed = once(editor, 'close');
    editor.terminate();
    await closed;
  }
  await client.close();
}
console.log('MCP stdio + WebSocket: MPN/UUID search, schematic, beautify, footprint resolution, native PCB, preview, assembly, wait/cancel and recovery passed.');
