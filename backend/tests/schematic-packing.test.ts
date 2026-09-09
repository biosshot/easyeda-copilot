import test from 'node:test';
import assert from 'node:assert/strict';
import { packSchematicRectangles, packingAffinity, SCHEMATIC_SHEET, type PackingItem, type PackingNet } from '../src/utils/schematic-packing.ts';
import { packDrawingIslands } from '../src/circuit-layout/refinement/pack-islands.ts';
import { overlaps, type Placed } from '../src/circuit-layout/refinement/geometry.ts';
import { refinedBlockBounds } from '../src/circuit-layout/index.ts';
import { mergeAmsCircuit } from '../src/utils/circuit-merge.ts';
import { component, createPatternFixtureCircuit } from './patterns/helpers.ts';
import type { CircuitAssembly } from '../src/types/circuit.ts';

function checkPacking(items: PackingItem[], result: ReturnType<typeof packSchematicRectangles>, gap: number) {
    const placed = items.map(b => ({ ...b, ...result.positions.get(b.id)! }));
    for (const [i, a] of placed.entries()) for (const b of placed.slice(i + 1)) assert(!overlaps(a, b, gap - 1e-5), `${a.id}/${b.id} overlap`);
    assert.equal(Math.max(...placed.map(b => b.x + b.width)) - Math.min(...placed.map(b => b.x)), result.width);
    assert.equal(Math.max(...placed.map(b => b.y + b.height)) - Math.min(...placed.map(b => b.y)), result.height);
    return placed;
}

test('four modules form a compact landscape sheet, using actual occupied bounds and padding', () => {
    const items = Array.from({ length: 4 }, (_, i) => ({ id: `B${i}`, width: 300, height: 200 }));
    const original = structuredClone(items), result = packSchematicRectangles(items, 36);
    checkPacking(items, result, 36);
    const padding = SCHEMATIC_SHEET.rootPadding + SCHEMATIC_SHEET.blockPadding;
    assert(Math.abs((result.width + padding * 2) / (result.height + padding * 2) - Math.SQRT2) < 0.04);
    assert(result.width * result.height < 300000, 'aspect is achieved by arranging modules, not empty margins');
    assert.deepEqual(items, original);
    const canonical = (r: typeof result) => [...r.positions].sort(([a], [b]) => a.localeCompare(b));
    assert.deepEqual(canonical(packSchematicRectangles(items.toReversed(), 36)), canonical(result));
});

test('small modules fill vertical gaps beside a tall module instead of reserving whole-height shelves', () => {
    const items = [{ id: 'U', width: 300, height: 600 }, ...Array.from({ length: 3 }, (_, i) => ({ id: `M${i}`, width: 260, height: 160 }))];
    const result = packSchematicRectangles(items, 36);
    const placed = checkPacking(items, result, 36);
    assert(result.width * result.height < 500000);
    const chip = placed.find(b => b.id === 'U')!;
    assert(placed.some(b => b.id !== 'U' && b.y > chip.y && b.y + b.height <= chip.y + chip.height));
});

test('terminal affinity brings modules near the matching faces without rotating their contents', () => {
    const items = [{ id: 'U', width: 300, height: 300 }, { id: 'A', width: 50, height: 100 }, { id: 'B', width: 50, height: 100 }];
    const nets: PackingNet[] = [
        { weight: 1, terminals: [{ id: 'U', points: [{ x: 0, y: 60 }], anchor: true }, { id: 'A', points: [{ x: 50, y: 50 }], anchor: false }] },
        { weight: 1, terminals: [{ id: 'U', points: [{ x: 300, y: 240 }], anchor: true }, { id: 'B', points: [{ x: 0, y: 50 }], anchor: false }] },
    ];
    const baseline = packSchematicRectangles(items, 36), result = packSchematicRectangles(items, 36, nets);
    checkPacking(items, result, 36);
    assert(packingAffinity(nets, result.positions) < packingAffinity(nets, baseline.positions) * 0.6);
    assert.equal(result.affinity, packingAffinity(nets, result.positions));
});

test('an indivisible module is not stretched or padded to pretend it has a page aspect ratio', () => {
    assert.equal(packSchematicRectangles([], 36).positions.size, 0);
    assert(Number.isFinite(packSchematicRectangles([{ id: 'empty', width: 0, height: 0 }], 36, [], 0).score));
    const result = packSchematicRectangles([{ id: 'single', width: 60, height: 600 }], 36);
    assert.equal(result.width, 60); assert.equal(result.height, 600);
    assert.deepEqual(result.positions.get('single'), { x: 0, y: 0 });
});

test('the exported __v_root__ reflects final landscape positions for disconnected named blocks', () => {
    const components = Array.from({ length: 4 }, (_, i) => component(`U${i}`, [], `Block_${i}`));
    const circuit = createPatternFixtureCircuit('landscape', '', components);
    circuit.blocks = components.map(c => ({ name: c.block_name, description: '', next_block_names: [] }));
    const nodes: Placed[] = components.map((c, i) => ({ id: c.designator, x: 40, y: i * 700, width: 300, height: 200, ports: [] }));
    const result = packDrawingIslands(nodes, [], new Map(), new Map(components.map(c => [c.designator, c.block_name])));
    const positioned = result.nodes.map(n => ({ designator: n.id, x: n.x, y: n.y, width: n.width, height: n.height, center: { x: n.width / 2, y: n.height / 2 }, rotate: 0 }));
    const exported = JSON.parse(JSON.stringify({ components: components.map((c, i) => ({ ...c, pos: positioned[i] })),
        blocks_rect: refinedBlockBounds(circuit, [], positioned, result.edges) }));
    const root = exported.blocks_rect.find((b: { name: string }) => b.name === '__v_root__');
    // Larger frame margins change the attainable ratio of four rigid modules.
    assert(Math.abs(root.width / root.height - Math.SQRT2) < 0.07);
    const framedBlocks = exported.blocks_rect.filter((b: { name: string }) => b.name !== '__v_root__');
    for (const [i, a] of framedBlocks.entries()) for (const b of framedBlocks.slice(i + 1)) assert(!overlaps(a, b, SCHEMATIC_SHEET.extraBlockGap));
    for (const { pos } of exported.components) assert(pos.x >= root.x && pos.y >= root.y && pos.x + pos.width <= root.x + root.width && pos.y + pos.height <= root.y + root.height);
    assert.deepEqual(nodes.map(n => n.y), [0, 700, 1400, 2100]);
});

test('merging saved assemblies uses true extents, keeps the main in place, and targets the same landscape ratio', () => {
    const make = (i: number): CircuitAssembly => ({ ...createPatternFixtureCircuit(`Saved_${i}`, '', []),
        blocks: [], components: [{ ...component('U1', [], `Saved_${i}`), pos: { designator: 'U1', x: i ? 4400 : -30, y: 1500 * i,
            width: 300, height: 200, center: { x: 150, y: 100 }, rotate: 0 } }], edges: [] });
    const circuits = Array.from({ length: 4 }, (_, i) => make(i)), original = structuredClone(circuits);
    const merged = mergeAmsCircuit(circuits[0], circuits.slice(1));
    const root = merged.blocks_rect!.find(b => b.name === '__v_root__')!;
    assert(Math.abs(root.width / root.height - Math.SQRT2) < 0.07);
    assert(root.width * root.height < 500000, 'old coordinate origins are not counted as module area');
    assert.deepEqual(circuits, original);
    assert.deepEqual(merged.components[0].pos, original[0].components[0].pos);
    for (const [i, c] of merged.components.entries()) for (const b of merged.components.slice(i + 1)) assert(!overlaps(c.pos, b.pos, 79));
});
