import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSchematicGroups, type SchematicGroupsSnapshot as Snapshot } from '../src/eda/schematic-groups';

type Component = Snapshot['components'][number];
const pin = (number: string, x: number, y: number, net: string | null = null) => ({ number, x, y, net });
const component = (designator: string, x: number, y: number, pins: Component['pins']): Component => ({ designator, x, y, pins });
const passive = (ref: string, x: number, y: number, nets: (string | null)[] = [null, null], vertical = false) =>
    component(ref, x, y, vertical
        ? [pin('1', x, y - 25, nets[0]), pin('2', x, y + 25, nets[1])]
        : [pin('1', x - 25, y, nets[0]), pin('2', x + 25, y, nets[1])]);
const endpoint = (ref: string, x: number, y: number, net: string | null = null) => component(ref, x, y, [pin('1', x, y, net)]);
const wire = (net: string | null, ...segments: number[][]): Snapshot['wires'][number] => ({ net, segments });
const blocks = (strings: string[]) => strings.map(s => s.split(' ').sort().join(' ')).sort();

function buttons(): Snapshot {
    return {
        components: [
            passive('R1', -90, -60, ['3V3', 'EN'], true),
            passive('C5', -160, 40, ['EN', 'GND'], true),
            passive('U4', -90, 40, ['EN', 'GND'], true),
            passive('R2', 90, -60, ['3V3', 'GPIO9'], true),
            passive('U5', 90, 40, ['GPIO9', 'GND'], true),
            passive('R12', -45, 260, ['GPIO2', '3V3']),
            passive('R13', 45, 260, ['3V3', 'GPIO8']),
        ],
        wires: [
            wire('3V3', [-90, -85, -90, -110], [-90, -110, 90, -110], [90, -110, 90, -85]),
            wire('EN', [-90, -35, -90, 15], [-90, -10, -160, -10], [-160, -10, -160, 15]),
            wire('GND', [-160, 65, -160, 90], [-160, 90, -90, 90], [-90, 90, -90, 65]),
            wire('GPIO9', [90, -35, 90, 15]),
            wire('3V3', [-20, 260, 20, 260]),
        ],
    };
}

function usb(): Snapshot {
    return {
        components: [
            component('U12', 0, 0, [
                pin('A1', -70, -90, 'GND'), pin('B12', 70, -90, 'GND'),
                pin('A4', -70, -65, 'VBUS'), pin('B9', 70, -65, 'VBUS'),
                pin('A5', -70, -35, 'CC1'), pin('B5', 70, 35, 'CC2'),
                pin('A6', -70, -10, 'D+'), pin('B6', 70, 10, 'D+'),
                pin('A7', -70, 10, 'D-'), pin('B7', 70, -10, 'D-'),
                pin('A9', -70, 65, 'VBUS'), pin('B4', 70, 65, 'VBUS'),
                pin('A12', -70, 90, 'GND'), pin('B1', 70, 90, 'GND'),
            ]),
            passive('R5', -145, -35, ['GND', 'CC1']),
            passive('R6', 145, 35, ['CC2', 'GND']),
            passive('D1', 0, -240, ['VBUS', 'VDC']),
            passive('R7', 0, 235, ['D-', 'USBD_N']),
            passive('R8', 0, 295, ['D+', 'USBD_P']),
        ],
        wires: [wire('CC1', [-120, -35, -70, -35]), wire('CC2', [70, 35, 120, 35])],
    };
}

function transform(input: Snapshot, scale: number, dx: number, dy: number): Snapshot {
    return {
        components: input.components.map(c => ({ ...c, x: c.x * scale + dx, y: c.y * scale + dy,
            pins: c.pins.map(p => ({ ...p, x: p.x * scale + dx, y: p.y * scale + dy })) })),
        wires: input.wires.map(w => ({ ...w, segments: w.segments.map(s => s.map((v, i) => v * scale + (i % 2 ? dy : dx))) })),
    };
}

test('empty page: only the two agreed keys', async () => {
    assert.deepEqual(await getSchematicGroups({ components: [], wires: [] }), { maybe_blocks: [], wires: [] });
});

test('chained Wire objects, unnamed intermediate segment and pin in segment interior', async () => {
    const result = await getSchematicGroups({
        components: [endpoint('U6', 0, 0, '5V'), endpoint('C8', 50, 0, '5V'), endpoint('C9', 100, 0, '5V')],
        wires: [wire('5V', [0, 0, 25, 0]), wire(null, [25, 0, 75, 0]), wire('5V', [75, 0, 100, 0])],
    });
    assert.deepEqual(result.wires, [{ net: '5V', pins: 'C8.1 C9.1 U6.1' }]);
});

test('an endpoint on another segment forms a T-junction', async () => {
    const result = await getSchematicGroups({
        components: [endpoint('A1', 0, 0), endpoint('A2', 100, 0), endpoint('A3', 50, 50)],
        wires: [wire(null, [0, 0, 100, 0]), wire(null, [50, 0, 50, 50])],
    });
    assert.deepEqual(result.wires, [{ net: null, pins: 'A1.1 A2.1 A3.1' }]);
});

test('mere crossings stay separate, even when both paths have the same net name', async () => {
    const result = await getSchematicGroups({
        components: [endpoint('A1', -50, 0, 'GND'), endpoint('A2', 50, 0, 'GND'),
            endpoint('B1', 0, -50, 'GND'), endpoint('B2', 0, 50, 'GND')],
        wires: [wire('GND', [-50, 0, 50, 0]), wire('GND', [0, -50, 0, 50])],
    });
    assert.deepEqual(result.wires, [{ net: 'GND', pins: 'A1.1 A2.1' }, { net: 'GND', pins: 'B1.1 B2.1' }]);
});

test('an explicit vertex at a crossing connects its branches', async () => {
    const result = await getSchematicGroups({
        components: [endpoint('A1', -50, 0), endpoint('A2', 50, 0), endpoint('B1', 0, -50), endpoint('B2', 0, 50)],
        wires: [wire(null, [-50, 0, 0, 0], [0, 0, 50, 0]), wire(null, [0, -50, 0, 50])],
    });
    assert.deepEqual(result.wires, [{ net: null, pins: 'A1.1 A2.1 B1.1 B2.1' }]);
});

test('overlapping collinear wires and reversed/duplicate segments do not duplicate pins', async () => {
    const result = await getSchematicGroups({
        components: [endpoint('A1', 0, 0), endpoint('A2', 100, 0)],
        wires: [wire(null, [0, 0, 60, 0]), wire(null, [100, 0, 40, 0], [40, 0, 100, 0])],
    });
    assert.deepEqual(result.wires, [{ net: null, pins: 'A1.1 A2.1' }]);
});

test('all pins sharing one coordinate are preserved', async () => {
    const result = await getSchematicGroups({
        components: [endpoint('U1', 0, 0), endpoint('C1', 0, 0), endpoint('C2', 50, 0)],
        wires: [wire(null, [0, 0, 50, 0])],
    });
    assert.equal(result.wires[0].pins, 'C1.1 C2.1 U1.1');
});

test('a visible sub-grid gap is not closed by snapping', async () => {
    const result = await getSchematicGroups({
        components: [endpoint('A1', 0, 0, '3V3'), endpoint('A2', 100, 0, '3V3')],
        wires: [wire('3V3', [0, 0, 49.99, 0]), wire('3V3', [50, 0, 100, 0])],
    });
    assert.deepEqual(result.wires, []);
});

test('no wire path through a resistor or through equal-name ports', async () => {
    const result = await getSchematicGroups({
        components: [endpoint('U1', -100, 0, 'D-'), passive('R7', 0, 0, ['D-', 'USBD_N']), endpoint('U2', 100, 0, 'USBD_N'),
            endpoint('U3', 500, 0, 'D-')],
        wires: [wire('D-', [-100, 0, -25, 0]), wire('USBD_N', [25, 0, 100, 0])],
    });
    assert.deepEqual(result.wires, [{ net: 'D-', pins: 'R7.1 U1.1' }, { net: 'USBD_N', pins: 'R7.2 U2.1' }]);
});

test('coincident pins without an actual wire are not reported as a wire path', async () => {
    assert.deepEqual((await getSchematicGroups({ components: [endpoint('A1', 0, 0), endpoint('A2', 0, 0)], wires: [] })).wires, []);
});

test('resolved pin names override stale wire metadata', async () => {
    const result = await getSchematicGroups({ components: [endpoint('A1', 0, 0, 'NEW'), endpoint('A2', 50, 0, 'NEW')],
        wires: [wire('OLD', [0, 0, 50, 0])] });
    assert.equal(result.wires[0].net, 'NEW');
});

test('missing/conflicting wire names stay null when no resolved net is available', async () => {
    const result = await getSchematicGroups({ components: [endpoint('A1', 0, 0), endpoint('A2', 100, 0)],
        wires: [wire('OLD', [0, 0, 50, 0]), wire('OTHER', [50, 0, 100, 0])] });
    assert.equal(result.wires[0].net, null);
});

test('contradictory resolved nets fail rather than fabricate a connection', async () => {
    await assert.rejects(getSchematicGroups({ components: [endpoint('A1', 0, 0, 'A'), endpoint('A2', 50, 0, 'B')],
        wires: [wire(null, [0, 0, 50, 0])] }), /Conflicting resolved nets/);
});

test('adjacent EN/boot button circuits form one possible block; lower straps remain separate', async () => {
    const result = await getSchematicGroups(buttons());
    assert.deepEqual(blocks(result.maybe_blocks), blocks(['R1 C5 U4 R2 U5', 'R12 R13']));
    assert.ok(result.wires.some(w => w.net === '3V3' && w.pins === 'R1.1 R2.1'));
    assert.ok(result.wires.some(w => w.net === '3V3' && w.pins === 'R12.2 R13.1'));
});

test('fragmented USB block includes diode/series resistors via shared nets, without invented wires', async () => {
    const result = await getSchematicGroups(usb());
    assert.deepEqual(blocks(result.maybe_blocks), blocks(['U12 R5 R6 D1 R7 R8']));
    assert.deepEqual(result.wires, [{ net: 'CC1', pins: 'R5.2 U12.A5' }, { net: 'CC2', pins: 'R6.1 U12.B5' }]);
});

test('separate power flags can associate a nearby bypass without a direct wire', async () => {
    const result = await getSchematicGroups({ components: [passive('U1', 0, 0, ['3V3', 'GND']), passive('C1', 0, 70, ['3V3', 'GND'])], wires: [] });
    assert.deepEqual(result, { maybe_blocks: ['C1 U1'], wires: [] });
});

test('a distant MCU is not swallowed through the USB series resistor', async () => {
    const input = usb();
    input.components.push(component('U1', 900, 0, [pin('1', 830, -90, 'USBD_N'), pin('2', 830, -60, 'USBD_P'), pin('3', 970, 90, 'GND')]));
    const result = await getSchematicGroups(input);
    assert.deepEqual(blocks(result.maybe_blocks), blocks(['U12 R5 R6 D1 R7 R8']));
});

test('one long ground wire does not force remote groups to merge', async () => {
    const input: Snapshot = { components: [passive('U1', 0, 0, ['S1', 'GND']), passive('C1', 0, 60, ['S1', 'GND']),
        passive('U2', 2000, 0, ['S2', 'GND']), passive('C2', 2000, 60, ['S2', 'GND'])],
        wires: [wire('GND', [25, 0, 25, -150], [25, -150, 2025, -150], [2025, -150, 2025, 0])] };
    const result = await getSchematicGroups(input);
    assert.deepEqual(blocks(result.maybe_blocks), blocks(['U1 C1', 'U2 C2']));
    assert.ok(result.wires.some(w => w.pins === 'U1.2 U2.2'));
});

test('wire path length, not just endpoint distance, affects possible grouping', async () => {
    const components = [passive('R1', 0, 0), passive('R2', 130, 0)];
    const short = await getSchematicGroups({ components, wires: [wire(null, [25, 0, 105, 0])] });
    const detour = await getSchematicGroups({ components, wires: [wire(null, [25, 0, 25, 2000], [25, 2000, 105, 2000], [105, 2000, 105, 0])] });
    assert.deepEqual(short.maybe_blocks, ['R1 R2']);
    assert.deepEqual(detour.maybe_blocks, []);
    assert.deepEqual(short.wires, detour.wires);
});

test('proximity chains cannot grow across a whole sheet', async () => {
    const input: Snapshot = { components: Array.from({ length: 40 }, (_, i) => passive(`R${i + 1}`, i * 80, 0, ['3V3', 'GND'])), wires: [] };
    const result = await getSchematicGroups(input);
    assert.ok(result.maybe_blocks.length > 1);
    assert.ok(result.maybe_blocks.every(b => b.split(' ').length < 20));
});

test('translation, axis reflection and uniform scaling preserve groups', async () => {
    for (const input of [buttons(), usb()]) {
        const expected = await getSchematicGroups(input);
        assert.deepEqual(await getSchematicGroups(transform(input, 3, 137, -417)), expected);
        assert.deepEqual(await getSchematicGroups(transform(input, -2, -37, 231)), expected);
    }
});

test('API enumeration, wire order and segment direction do not affect results; input is not mutated', async () => {
    const input = buttons(), before = structuredClone(input);
    const result = await getSchematicGroups(input);
    assert.deepEqual(input, before);
    input.components.reverse(); input.components.forEach(c => c.pins.reverse());
    input.wires.reverse(); input.wires.forEach(w => w.segments.reverse().forEach(s => s.push(...s.splice(0, 2))));
    assert.deepEqual(await getSchematicGroups(input), result);
});

test('repeated supply pins do not multiply common-net evidence', async () => {
    const input = usb(), expected = await getSchematicGroups(input);
    for (let i = 0; i < 50; i++) input.components[0].pins.push(pin(`V${i}`, -70, -65, 'VBUS'));
    assert.deepEqual((await getSchematicGroups(input)).maybe_blocks, expected.maybe_blocks);
});

test('multipart sections stay in their local blocks without merging distant geometry', async () => {
    for (const [first, second] of [['1', '2'], ['A', 'B']]) {
        const input: Snapshot = { components: [
            { ...passive('U1', 0, 0, ['A', 'GND']), subPartName: first },
            passive('C1', 0, 50, ['A', 'GND']),
            { ...component('U1', 3000, 0, [pin('5', 2975, 0, 'B'), pin('7', 3025, 0, 'GND')]), subPartName: second },
            passive('C2', 3000, 50, ['B', 'GND']),
        ], wires: [] };
        const expected = { maybe_blocks: [`C1 U1.${first}`, `C2 U1.${second}`], wires: [] };
        assert.deepEqual(await getSchematicGroups(input), expected);
        input.components.reverse();
        assert.deepEqual(await getSchematicGroups(input), expected);
    }
});

test('different sections in one block are not collapsed into the base designator', async () => {
    const result = await getSchematicGroups({ components: [
        { ...passive('U1', 0, 0, ['S', 'GND']), subPartName: '1' },
        { ...component('U1', 0, 50, [pin('5', -25, 50, 'S'), pin('7', 25, 50, 'GND')]), subPartName: '2' },
        passive('R1', 0, 100, ['S', 'GND']),
    ], wires: [] });
    assert.deepEqual(result, { maybe_blocks: ['R1 U1.1 U1.2'], wires: [] });
});

test('second amplifier sections survive remote first sections; wires keep physical pin numbers', async () => {
    const input: Snapshot = { components: [
        { ...component('U21', 0, 0, [pin('6', -25, -10, 'FB'), pin('5', -25, 10, 'AINB'), pin('7', 25, 0, 'BUFFER')]), subPartName: '2' },
        { ...component('U22', 100, 0, [pin('6', 75, -10, 'PWM'), pin('5', 75, 0, 'BUFFER'), pin('7', 125, 0, 'TRIGB')]), subPartName: '2' },
        passive('R13', 0, 50, ['FB', 'BUFFER']),
        { ...passive('U21', 2000, 0, ['AINA', 'OUTA']), subPartName: '1' },
        { ...passive('U22', 4000, 0, ['PWMA', 'TRIGA']), subPartName: '1' },
    ], wires: [
        wire('BUFFER', [25, 0, 75, 0], [25, 0, 25, 50]),
        wire('FB', [-25, -10, -50, -10], [-50, -10, -50, 50], [-50, 50, -25, 50]),
    ] };
    const expected = { maybe_blocks: ['R13 U21.2 U22.2'], wires: [
        { net: 'FB', pins: 'R13.1 U21.6' },
        { net: 'BUFFER', pins: 'R13.2 U21.7 U22.5' },
    ] };
    assert.deepEqual(await getSchematicGroups(input), expected);
    // Section suffixes must remain even when the other units live on a different page.
    input.components = input.components.slice(0, 3);
    assert.deepEqual(await getSchematicGroups(input), expected);
});

test('section names do not change shared-net prevalence or clustering', async () => {
    const input = usb();
    const expected = await getSchematicGroups(input);
    input.components[0].subPartName = 'B';
    const result = await getSchematicGroups(input);
    assert.deepEqual(result.wires, expected.wires);
    assert.deepEqual(result.maybe_blocks, expected.maybe_blocks.map(b => b.replace(/\bU12\b/g, 'U12.B')));
});

test('invalid geometry/identifiers fail explicitly', async () => {
    await assert.rejects(getSchematicGroups({ components: [endpoint('R 1', 0, 0)], wires: [] }), /invalid designator/);
    await assert.rejects(getSchematicGroups({ components: [endpoint('R1', NaN, 0)], wires: [] }), /non-finite/);
    await assert.rejects(getSchematicGroups({ components: [], wires: [wire(null, [0, 1, 2])] }), /four-coordinate/);
});

test('300+ components return the whole compact result without pagination or per-component metadata', async () => {
    const input: Snapshot = { components: [], wires: [] };
    for (let i = 0; i < 110; i++) {
        const x = i * 2000;
        input.components.push(passive(`U${i}`, x, 0, [`S${i}`, 'GND']), passive(`C${i}`, x, 60, [`S${i}`, 'GND']), passive(`R${i}`, x, 120, [`S${i}`, '3V3']));
        input.wires.push(wire(`S${i}`, [x - 25, 0, x - 25, 120]));
    }
    const result = await getSchematicGroups(input);
    assert.deepEqual(Object.keys(result), ['maybe_blocks', 'wires']);
    assert.equal(result.maybe_blocks.length, 110);
    assert.equal(new Set(result.maybe_blocks.flatMap(b => b.split(' '))).size, 330);
    assert.equal(result.wires.length, 110);
    assert.ok(result.wires.every(w => Object.keys(w).join(' ') === 'net pins'));
    assert.ok(JSON.stringify(result).length < 15000);
});
