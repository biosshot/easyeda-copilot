import assert from 'node:assert/strict';

export const PART_UUID = '11111111111111111111111111111111';
export const SYMBOL_UUID = '22222222222222222222222222222222';
export const FOOTPRINT_UUID = '33333333333333333333333333333333';
export const RELAY_UUID = '44444444444444444444444444444444';
export const RELAY_SYMBOL_UUID = '55555555555555555555555555555555';
export const PREVIEW_FAIL_UUID = '66666666666666666666666666666666';
export const NAMED_UUID = '77777777777777777777777777777777';
export const NAMED_SYMBOL_UUID = '88888888888888888888888888888888';
export const CAPACITOR_UUID = '99999999999999999999999999999999';
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
const namedSymbolData = symbolData.split('\n').map(line => {
  const row = JSON.parse(line);
  if (row[0] === 'ATTR' && row[3] === 'NAME') row[4] = row[2] === 'p1' ? 'A' : 'B';
  return JSON.stringify(row);
}).join('\n');
export const relaySymbolData = [
  ['DOCTYPE', 'SYMBOL', '1.1'],
  ['PART', 'RELAY.COIL', { BBOX: [-12, -10, 12, 10] }],
  ['RECT', 'coil-body', -12, -10, 12, 10],
  ['PIN', 'coil-1', 1, null, -22, 0, 10, 0],
  ['ATTR', 'coil-1-name', 'coil-1', 'NAME', '1'], ['ATTR', 'coil-1-number', 'coil-1', 'NUMBER', '1'],
  ['PIN', 'coil-2', 1, null, 22, 0, 10, 180],
  ['ATTR', 'coil-2-name', 'coil-2', 'NAME', '2'], ['ATTR', 'coil-2-number', 'coil-2', 'NUMBER', '2'],
  ['PART', 'RELAY.CONTACT', { BBOX: [-15, -10, 15, 10] }],
  ['POLY', 'switch', [-15, -10, 0, 0, 15, 10]],
  ['PIN', 'contact-3', 1, null, -25, -10, 10, 0],
  ['ATTR', 'contact-3-name', 'contact-3', 'NAME', '3'], ['ATTR', 'contact-3-number', 'contact-3', 'NUMBER', '3'],
  ['PIN', 'contact-4', 1, null, 25, 10, 10, 180],
  ['ATTR', 'contact-4-name', 'contact-4', 'NAME', '4'], ['ATTR', 'contact-4-number', 'contact-4', 'NUMBER', '4'],
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
      const keyword = new URLSearchParams(init?.body).get('keyword');
      const productList = [{
        manufacturer: 'Fixture', price: [[1, '0.01']],
        device_info: { uuid: PART_UUID, description: 'Fixture resistor',
          attributes: { 'Manufacturer Part': 'TEST-1K', Datasheet: 'https://example.invalid/resistor.pdf', Designator: 'R?' },
          footprint_info: { title: 'R_0603' }, symbol_info: { dataStr: symbolData } },
      }];
      if (keyword === 'NAMED') {
        productList[0].device_info.uuid = NAMED_UUID;
        productList[0].device_info.attributes.Designator = 'C?';
        productList[0].device_info.symbol_info.dataStr = namedSymbolData;
      }
      if (keyword === 'CAPACITOR' || keyword === 'PREVIEW_FAIL') {
        productList[0].device_info.uuid = keyword === 'CAPACITOR' ? CAPACITOR_UUID : PREVIEW_FAIL_UUID;
        productList[0].device_info.description = 'Fixture capacitor';
        productList[0].device_info.attributes.Designator = 'C?';
      }
      if (keyword === 'MULTI') productList.push({
        manufacturer: 'Fixture', price: [[1, '0.02']],
        device_info: { uuid: RELAY_UUID, description: 'Fixture relay',
          attributes: { 'Manufacturer Part': 'TEST-RELAY', Datasheet: 'https://example.invalid/relay.pdf', Designator: 'K?' },
          footprint_info: { title: 'RELAY' }, symbol_info: { dataStr: relaySymbolData } },
      });
      return Response.json({ code: 200, result: { pageInfo: { totalPage: 1 }, productList } });
    }
    if (url.pathname === `/api/devices/${PART_UUID}`) {
      return Response.json({ success: true, result: { symbol: { uuid: SYMBOL_UUID }, footprint: { uuid: FOOTPRINT_UUID }, product_code: 'C111', uuid: PART_UUID } });
    }
    if (url.pathname === `/api/devices/${CAPACITOR_UUID}`) {
      return Response.json({ success: true, result: { symbol: { uuid: SYMBOL_UUID }, footprint: { uuid: FOOTPRINT_UUID }, product_code: 'C999', uuid: CAPACITOR_UUID, attributes: { Designator: 'C?' } } });
    }
    if (url.pathname === `/api/devices/${RELAY_UUID}`) {
      return Response.json({ success: true, result: { symbol: { uuid: RELAY_SYMBOL_UUID }, footprint: { uuid: FOOTPRINT_UUID }, product_code: 'C444', uuid: RELAY_UUID } });
    }
    if (url.pathname === `/api/devices/${PREVIEW_FAIL_UUID}`) {
      return Response.json({ success: true, result: { symbol: {}, footprint: { uuid: FOOTPRINT_UUID }, product_code: 'C666', uuid: PREVIEW_FAIL_UUID } });
    }
    if (url.pathname === `/api/devices/${NAMED_UUID}`) {
      return Response.json({ success: true, result: { symbol: { uuid: NAMED_SYMBOL_UUID }, footprint: { uuid: FOOTPRINT_UUID }, product_code: 'C777', uuid: NAMED_UUID } });
    }
    if (url.pathname === `/api/v2/components/${SYMBOL_UUID}`) {
      return Response.json({ success: true, result: { dataStr: symbolData } });
    }
    if (url.pathname === `/api/v2/components/${RELAY_SYMBOL_UUID}`) {
      return Response.json({ success: true, result: { dataStr: relaySymbolData } });
    }
    if (url.pathname === `/api/v2/components/${NAMED_SYMBOL_UUID}`) {
      return Response.json({ success: true, result: { dataStr: namedSymbolData } });
    }
    if (url.pathname === `/api/v2/components/${FOOTPRINT_UUID}`) {
      return Response.json({ success: true, result: { uuid: FOOTPRINT_UUID, title: 'R_0603', dataStr: footprintData } });
    }
    throw new Error(`Unexpected fixture request: ${url.pathname}`);
  };
  return { requests, restore() { globalThis.fetch = original; } };
}
