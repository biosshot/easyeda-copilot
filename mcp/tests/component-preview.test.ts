import assert from 'node:assert/strict';
import { test } from 'node:test';
import { needsSymbolPreview } from '../src/utils/component-preview';
import { renderComponentSymbol } from '../src/component-symbol-preview';

const part = (designatorPattern: string, names: string[], description = '') => ({
    designatorPattern, description, pins: names.map((name, i) => ({ name, pin_number: String(i + 1) })),
    name: 'test', manufacturer: '', price: 0, part_uuid: '00000000000000000000000000000000', datasheet: null, footprintName: null,
});

test('skip interchangeable terminals and clearly named pins', () => {
    for (const prefix of ['R', 'L', 'FB', 'F', 'FU']) assert.equal(needsSymbolPreview(part(`${prefix}?`, ['1', '2'])), false);
    assert.equal(needsSymbolPreview(part('TP?', [''])), false);
    assert.equal(needsSymbolPreview(part('D?', ['Anode', 'Cathode'])), false);
    assert.equal(needsSymbolPreview(part('U?', ['GND', 'VCC', 'OUT'])), false);
});

test('review polarity, contacts, mixed names and non-simple passives', () => {
    for (const prefix of ['C', 'D', 'LED', 'J', 'SW']) assert.equal(needsSymbolPreview(part(`${prefix}?`, ['1', '2'])), true);
    assert.equal(needsSymbolPreview(part('U?', ['GND', '2', ''])), true);
    assert.equal(needsSymbolPreview(part('R?', ['1', '2', '3'])), true);
    assert.equal(needsSymbolPreview(part('L?', ['1', '2'], 'coupled inductor')), true);
    const connector = part('J?', ['C1', 'C2']);
    connector.pins.forEach((pin, i) => { pin.pin_number = `C${i + 1}`; });
    assert.equal(needsSymbolPreview(connector), true);
});

test('vertical names sit above numbers with room for neighboring columns', () => {
    const data = [
        ['PART', 'SIM-01A.1', { BBOX: [0, 0, 70, 50] }],
        ['RECT', 'body', 0, 0, 70, 50],
        ...['GND', 'VCC', 'VPP', 'RST', 'IO', 'CLK'].flatMap((name, i) => [
            ['PIN', `p${i}`, null, null, 10 + i * 10, -20, 20, 90],
            ['ATTR', `n${i}`, `p${i}`, 'NUMBER', `C${i + 1}`],
            ['ATTR', `a${i}`, `p${i}`, 'NAME', name],
        ]),
    ].map(row => JSON.stringify(row)).join('\n');
    const { svg } = renderComponentSymbol(data);
    const labels = [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*>([^<]+)<\/text>/g)];
    const positions = new Map(labels.map(match => [match[3], [Number(match[1]), Number(match[2])]]));
    for (const [i, name] of ['GND', 'VCC', 'VPP', 'RST', 'IO', 'CLK'].entries()) {
        assert.equal(positions.get(name)![0], positions.get(`C${i + 1}`)![0]);
        assert.equal(positions.get(`C${i + 1}`)![1] - positions.get(name)![1], 20);
    }
    assert.ok(positions.get('VCC')![0] - positions.get('GND')![0] >= 33);
    const height = Number(svg.match(/<svg[^>]*height="(\d+)"/)![1]);
    assert.ok(positions.get('C1')![1] + 7 < height);
});
