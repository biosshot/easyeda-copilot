import assert from 'node:assert/strict';

export const PART_UUID = '11111111111111111111111111111111';
export const SYMBOL_UUID = '22222222222222222222222222222222';
export const FOOTPRINT_UUID = '33333333333333333333333333333333';
const footprintData = [
  ['DOCTYPE', 'FOOTPRINT'], ['ATTR', 0, 0, 'Name', 'R_0603'],
  ...[-27.56, 27.56].map((x, index) => ['PAD', 'pad' + index, 0, '', 1, String(index + 1), x, 0, 0, null, ['RECT', 23.62, 31.5, 0], [], 0, 0, 0, 1, 0, null, null, null, null, 0]),
].map(line => JSON.stringify(line)).join('\n');
export const symbolData = [
  ['DOCTYPE', 'SYMBOL', '1.1'], ['HEAD', { symbolType: 2, originX: 0, originY: 0 }],
  ['PART', 'RESISTOR.1', { BBOX: [-10, -5, 10, 5] }],
  ['PIN', 'p1', 1, null, -20, 0, 10, 0, null, 0, 0, 1],
  ['ATTR', 'p1n', 'p1', 'NAME', '1'], ['ATTR', 'p1num', 'p1', 'NUMBER', '1'],
  ['PIN', 'p2', 1, null, 20, 0, 10, 180, null, 0, 0, 1],
  ['ATTR', 'p2n', 'p2', 'NAME', '2'], ['ATTR', 'p2num', 'p2', 'NUMBER', '2'],
].map(line => JSON.stringify(line)).join('\n');

export const schematicInput = {
  circuit: {
    add_components: [
      { designator: 'R1', value: '1k', part_uuid: PART_UUID, search_query: '1k resistor', block_name: 'divider',
        pins: [{ pin_number: '1', name: '1', signal_name: 'VIN' }, { pin_number: '2', name: '2', signal_name: 'MID' }] },
      { designator: 'R2', value: '1k', part_uuid: PART_UUID, search_query: '1k resistor', block_name: 'divider',
        pins: [{ pin_number: '1', name: '1', signal_name: 'MID' }, { pin_number: '2', name: '2', signal_name: 'GND' }] },
    ],
    add_reused_blocks: [], rm_components: null, external_rm_connect: null, external_connect: null,
  },
  inputCircuit: { components: [] },
};

export const footprint = {
  name: 'R_0603', width: 2, height: 1,
  pads: [
    { pin_number: '1', name: '1', x: -0.7, y: 0, width: 0.6, height: 0.8, shape: 'rect', mount: 'smd' },
    { pin_number: '2', name: '2', x: 0.7, y: 0, width: 0.6, height: 0.8, shape: 'rect', mount: 'smd' },
  ],
};

export const pcbInput = {
  code: 'board.rect(20, 12); block("divider", ["R1", "R2"], "generic");',
  circuit: { components: schematicInput.circuit.add_components },
  footprints: { [PART_UUID]: footprint },
};

/** Strict fixture transport: any request to the old server (or an unexpected provider) fails. */
export function installEasyEdaFixture() {
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'pro.easyeda.com', `Unexpected network dependency: ${url.hostname}`);
    requests.push({ path: url.pathname, body: String(init?.body ?? '') });
    if (url.pathname === '/api/v2/eda/product/search') {
      return Response.json({ code: 200, result: { pageInfo: { totalPage: 1 }, productList: [{
        manufacturer: 'Fixture', price: [[1, '0.01']],
        device_info: { uuid: PART_UUID, description: 'Fixture resistor',
          attributes: { 'Manufacturer Part': 'TEST-1K', Datasheet: 'https://example.invalid/resistor.pdf', Designator: 'R?' },
          footprint_info: { title: 'R_0603' }, symbol_info: { dataStr: symbolData } },
      }] } });
    }
    if (url.pathname === `/api/devices/${PART_UUID}`) {
      return Response.json({ success: true, result: { symbol: { uuid: SYMBOL_UUID }, footprint: { uuid: FOOTPRINT_UUID }, product_code: 'C111', uuid: PART_UUID } });
    }
    if (url.pathname === `/api/v2/components/${SYMBOL_UUID}`) {
      return Response.json({ success: true, result: { dataStr: symbolData } });
    }
    if (url.pathname === `/api/v2/components/${FOOTPRINT_UUID}`) {
      return Response.json({ success: true, result: { uuid: FOOTPRINT_UUID, title: 'R_0603', dataStr: footprintData } });
    }
    throw new Error(`Unexpected fixture request: ${url.pathname}`);
  };
  return { requests, restore() { globalThis.fetch = original; } };
}
