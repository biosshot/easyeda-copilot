import test from 'node:test';
import assert from 'node:assert/strict';
import type { ElkExtendedEdge } from 'elkjs';
import type { CircuitAssembly } from '../src/types/circuit.ts';
import { refinedBlockBounds } from '../src/circuit-layout/index.ts';
import { recalculateRootBlock, mergeAmsCircuit } from '../src/utils/circuit-merge.ts';
import { component, createPatternFixtureCircuit } from './patterns/helpers.ts';

const pos = (designator: string, x: number, y: number, width = 60, height = 28) =>
    ({ designator, x, y, width, height, rotate: 0, center: { x: width / 2, y: height / 2 } });
const wire = (from: string, to: string, points: { x: number; y: number }[]): ElkExtendedEdge => ({
    id: `${from}:${to}`, sources: [from], targets: [to], sections: [{ id: 'section',
        incomingShape: from, outgoingShape: to, startPoint: points[0], endPoint: points.at(-1)!, bendPoints: points.slice(1, -1) }],
});
const corners = (r: { x: number; y: number; width: number; height: number }) =>
    [{ x: r.x, y: r.y }, { x: r.x + r.width, y: r.y + r.height }];
function contains(rect: ReturnType<typeof pos> | NonNullable<CircuitAssembly['blocks_rect']>[number], points: { x: number; y: number }[]) {
    for (const p of points) assert(p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height,
        `${JSON.stringify(p)} outside ${JSON.stringify(rect)}`);
}

test('final block bounds include generated flags and wire bends, with a synthetic assembly root', () => {
    const resistor = component('R1', [[1, '1', 'IN'], [2, '2', 'OUT']], 'A');
    const chip = component('U1', [[1, 'IN', 'IN']], 'B');
    const flag = component('PORT', [[1, '1', 'OUT']], 'block_parl_generated');
    const circuit = createPatternFixtureCircuit('bounds', 'bounds', [resistor, chip]);
    circuit.blocks = ['A', 'B'].map(name => ({ name, description: name, next_block_names: [] }));
    const placed = [pos('R1', 100, 200), pos('U1', 700, -20, 100, 40), pos('PORT', 80, 300, 20, 20)];
    const local = [{ x: 160, y: 214 }, { x: 500, y: 214 }, { x: 500, y: 400 }, { x: 90, y: 400 }, { x: 90, y: 300 }];
    const external = [{ x: 100, y: 214 }, { x: -200, y: 214 }, { x: -200, y: -100 }, { x: 700, y: -100 }, { x: 700, y: 0 }];
    const edges = [wire('R1_pin_2', 'PORT_pin_1', local), wire('R1_pin_1', 'U1_pin_1', external)];
    const blocks = refinedBlockBounds(circuit, [flag], placed, edges);
    const a = blocks.find(b => b.name === 'block_A')!;
    contains(a, [...corners(placed[0]), ...corners(placed[2]), ...local]);
    assert(a.x > -200, 'inter-block wire must not enlarge an individual block');
    const roots = blocks.filter(b => b.name.includes('__v_root__'));
    assert.equal(roots.length, 1);
    contains(roots[0], [...placed.flatMap(corners), ...blocks.filter(b => b !== roots[0]).flatMap(corners), ...local, ...external]);
});

test('root follows final coordinates, shrinks stale ELK bounds and is stable on repeated recalculation', () => {
    const stale = { name: 'block___v_root__', description: 'keep', x: 0, y: 0, width: 9000, height: 9000 };
    const components = [{ pos: pos('LED_B1', 350, 100, 45, 60) }];
    const blocks = recalculateRootBlock([stale], components);
    assert.deepEqual(blocks, [{ name: stale.name, description: 'keep', x: 335, y: 85, width: 75, height: 90 }]);
    assert.deepEqual(recalculateRootBlock(blocks, components), blocks);
    assert.equal(stale.width, 9000, 'must not mutate an earlier assembly');
});

test('declared root is recalculated as the whole assembly rather than only its direct members', () => {
    const c = component('R1', [[1, '1', 'A']], 'child');
    const circuit = createPatternFixtureCircuit('root', 'root', [c]);
    circuit.blocks.push({ name: 'child', description: '', next_block_names: [] });
    const placed = [pos('R1', 600, 300)];
    const blocks = refinedBlockBounds(circuit, [], placed, []);
    assert.equal(blocks.filter(b => b.name.includes('__v_root__')).length, 1);
    contains(blocks.find(b => b.name.includes('__v_root__'))!, corners(placed[0]));
    assert.deepEqual(refinedBlockBounds({ ...circuit, components: [] }, [], [], []), []);
});

test('merging reused geometry without block rectangles still exports a root enclosing moved wires', () => {
    const make = (id: string): CircuitAssembly => ({
        ...createPatternFixtureCircuit(id, id, []),
        components: [{ ...component(id, [[1, '1', 'NET']]), pos: pos(id, 20, 30) }],
        edges: [{ container: '__v_root__', sources: [`${id}_pin_1`], targets: [`${id}_pin_1`], sections: [{ id,
            startPoint: { x: 20, y: 44 }, endPoint: { x: 20, y: 44 },
            bendPoints: [{ x: 20, y: 300 }, { x: 200, y: 300 }, { x: 200, y: 44 }] }] }],
    });
    const merged = mergeAmsCircuit(make('R1'), [make('R2')]);
    const root = merged.blocks_rect?.find(b => b.name.includes('__v_root__'));
    assert(root);
    contains(root, [...merged.components.flatMap(c => corners(c.pos!)),
        ...merged.edges.flatMap(e => e.sections.flatMap(s => [s.startPoint, ...(s.bendPoints ?? []), s.endPoint]))]);
});
