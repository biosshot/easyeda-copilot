import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { componentSearch, searchReusedBlock, extractCircuit, makePcbLayout, getPcbComponentSizes, disposeBackend } from '../dist/index.js';
import { installEasyEdaFixture, PART_UUID, pcbInput, schematicInput } from './fixtures/api-fixtures.mjs';

test('public component and schematic APIs work with provider fixtures and no private server', async () => {
  const transport = installEasyEdaFixture();
  try {
    assert.deepEqual(await searchReusedBlock({ query: 'power' }), []);
    await assert.rejects(extractCircuit({ circuit: { add_reused_blocks: [{}] } } as never), /Reusable blocks are not supported/);
    assert.equal(transport.requests.length, 0);
    const byMpn = await componentSearch({ MPN: 'TEST-1K' });
    assert.equal(byMpn.components?.[0].part_uuid, PART_UUID);
    assert.equal(byMpn.components?.[0].pins.length, 2);
    const byId = await componentSearch({ part_uuid: PART_UUID });
    assert.equal(byId.bestComponent?.name, 'TEST-1K');

    const input = structuredClone(schematicInput);
    const assembly = (await extractCircuit(input)).circuit;
    assert.deepEqual(input, schematicInput, 'the HTTP boundary previously protected the input from mutation');
    assert.deepEqual(assembly.components.filter(c => /^R/.test(c.designator)).map(c => c.designator).sort(), ['R1', 'R2']);
    assert.ok(assembly.edges?.length);
    assert.ok(assembly.components.every(c => Number.isFinite(c.pos?.x) && Number.isFinite(c.pos?.y)));
    assert.deepEqual(assembly.reused_blocks, []);

    const replacement = structuredClone(schematicInput);
    replacement.inputCircuit.components = schematicInput.circuit.add_components;
    replacement.circuit.add_components = [schematicInput.circuit.add_components[0]];
    replacement.circuit.rm_components = ['R1'];
    const replaced = (await extractCircuit(replacement)).circuit;
    assert.deepEqual(replaced.replace_components, ['R1']);
    assert.deepEqual(replaced.rm_components, ['R1']);

    const reconnect = structuredClone(schematicInput);
    reconnect.inputCircuit.components = schematicInput.circuit.add_components;
    reconnect.circuit.add_components = [];
    reconnect.circuit.external_rm_connect = [{ designator: 'R1', pin_number: '1' }];
    reconnect.circuit.external_connect = [{ designator: 'R1', pin_number: '1', signal_name: 'VNEW' }];
    const reconnected = (await extractCircuit(reconnect)).circuit;
    assert.ok(reconnected.rm_net?.some(n => n.designator === 'R1' && n.net === 'VIN'));
    assert.ok(reconnected.added_net?.some(n => n.designator === 'R1' && n.net === 'VNEW'));
  } finally {
    transport.restore();
  }
});

test('public PCB API runs the native worker, reports progress, preserves inputs and can be cancelled', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('PCB with provided footprints must not fetch'); };
  try {
    const sizes = await getPcbComponentSizes(pcbInput);
    assert.equal(sizes.report?.selected, 2);
    const input = structuredClone(pcbInput);
    const events: string[] = [];
    const result = await makePcbLayout(input, { onProgress: p => { events.push(p.stage); } });
    assert.deepEqual(input, pcbInput);
    assert.ok(result.pcb, result.content);
    assert.ok(result.preview_image_url?.startsWith('data:image/svg+xml'));
    assert.ok(result.placement_debug_artifacts?.items.length);
    assert.ok(events.includes('resolve_footprints'));
    assert.equal(events.at(-1), 'done');

    const invalid = await makePcbLayout({ ...pcbInput, code: 'invalid_call();' });
    assert.equal(invalid.pcb, undefined);
    assert.match(invalid.content, /invalid_call/);

    const controller = new AbortController();
    await assert.rejects(makePcbLayout(pcbInput, {
      signal: controller.signal,
      onProgress: p => { if (p.stage === 'parse_dsl') controller.abort(); },
    }), /abort/i);
    const alreadyAborted = AbortSignal.abort();
    await assert.rejects(makePcbLayout(pcbInput, { signal: alreadyAborted }), /abort/i);
    const afterCancel = await makePcbLayout(pcbInput);
    assert.ok(afterCancel.pcb, afterCancel.content);
  } finally {
    globalThis.fetch = originalFetch;
    await disposeBackend();
  }
});

test('native filename selection is strict across supported operating systems and architectures', () => {
  const { nativeFilename } = createRequire(import.meta.url)('../native/pcb-board-packer/platform.cjs');
  assert.equal(nativeFilename('win32', 'x64', {}), 'pcb-board-packer.win32-x64-msvc.node');
  assert.equal(nativeFilename('linux', 'x64', { header: { glibcVersionRuntime: '2.31' } }), 'pcb-board-packer.linux-x64-gnu.node');
  for (const arch of ['arm64', 'x64']) assert.equal(nativeFilename('darwin', arch, {}), `pcb-board-packer.darwin-${arch}.node`);
  assert.throws(() => nativeFilename('linux', 'x64', {}), /glibc/);
  assert.throws(() => nativeFilename('win32', 'ia32', {}), /architecture/);
});
