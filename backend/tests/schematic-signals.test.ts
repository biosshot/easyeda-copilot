import test from 'node:test';
import assert from 'node:assert/strict';
import type { ElkNode } from 'elkjs';
import type { CircuitComponent } from '../src/types/circuit.ts';
import type { SymbolWithMeta } from '../src/types/symbol.ts';
import { autoPlaceCircuitWithHierarchy } from '../src/circuit-layout/index.ts';
import { sharedSupplyNets } from '../src/circuit-layout/graph-order.ts';
import { component, createPatternFixtureCircuit } from './patterns/helpers.ts';

function geometry(c: CircuitComponent): SymbolWithMeta {
    const chip = /^U/.test(c.designator);
    return { designator: c.designator, block_name: c.block_name, symbol: {
        width: 100, height: 100, center: { x: 50, y: 50 },
        pins: c.pins.map((p, i) => ({ num: p.pin_number, name: p.name, signal_name: p.signal_name, part: '',
            x: chip ? (i % 2) * 100 : 50, y: chip ? 20 + Math.floor(i / 2) * 20 : i * 100 })),
    } };
}
const leaves = (n: ElkNode): ElkNode[] => n.children ? n.children.flatMap(leaves) : [n];

test('NC never creates external aliases, pattern connections or ports; physical pins remain', async () => {
    const cs = [component('U1', [[1, 'NC', 'NC'], [2, 'IO', ' nc '], [3, 'IO', 'NC_VALID']], 'A'),
        component('U2', [[1, 'NC', 'NC'], [2, 'IO', ' nc '], [3, 'IO', 'NC_VALID']], 'B')];
    const circuit = createPatternFixtureCircuit('nc', 'nc', cs);
    circuit.blocks = ['A', 'B'].map(name => ({ name, description: name, next_block_names: [] }));
    const symbols = cs.map(geometry), snapshot = structuredClone({ circuit, symbols });
    let checked = false;
    const result = await autoPlaceCircuitWithHierarchy(circuit, symbols, { elkLayoutFinish(graph) {
        checked = true;
        for (const c of cs) for (const pin of [1, 2]) {
            const id = `${c.designator}_pin_${pin}`;
            assert(leaves(graph).some(n => n.ports?.some(p => p.id === id)), 'keep the unused physical pin');
            assert(!graph.edges?.some(e => [...e.sources, ...e.targets].includes(id)), 'NC has no wire');
        }
        return graph;
    } }, { layoutRefinement: true, externalSignals: ['NC', ' nc ', 'NC_VALID'] });
    assert(checked);
    assert(result.addedSymbol.some(c => c.pins[0].signal_name === 'NC_VALID'), 'exact NC only, not a substring');
    assert(result.addedSymbol.every(c => !/^nc$/i.test(c.pins[0].signal_name.trim())));
    assert.deepEqual({ circuit, symbols }, snapshot);
});

test('small LDO and protection chain stay physically connected, including single decoupling capacitors', async () => {
    const cs = [component('J1', [[1, '1', 'VIN_RAW'], [2, '2', 'GND']]),
        component('F1', [[1, '1', 'VIN_RAW'], [2, '2', 'VIN_FUSED']]),
        component('D1', [[1, 'A', 'VIN_FUSED'], [2, 'K', 'VIN_PROT']]),
        component('D2', [[1, 'A', 'GND'], [2, 'K', 'VIN_PROT']]),
        component('U1', [[1, 'IN', 'VIN_PROT'], [2, 'OUT', '3V3'], [3, 'GND', 'GND'], [4, 'NC', 'NC'],
            [5, 'NC', 'NC'], [6, 'NC', 'NC'], [7, 'NC', 'NC']]),
        component('C1', [[1, '1', 'VIN_PROT'], [2, '2', 'GND']]), component('C2', [[1, '1', '3V3'], [2, '2', 'GND']])];
    for (const layoutPatterns of [false, true]) {
        // Inspect physical wires after pattern expansion, without joining
        // disconnected markers by name. Seven IC pins trigger old bank nesting.
        const r = await autoPlaceCircuitWithHierarchy(createPatternFixtureCircuit('ldo', 'ldo', cs), cs.map(geometry), undefined,
            { layoutRefinement: true, layoutPatterns });
        const owner = new Map(r.renderGraph!.children!.flatMap(n => (n.ports ?? []).map(p => [p.id, n.id])));
        const reached = new Set(['U1']);
        for (let pass = 0; pass < r.positioned.length; pass++) for (const e of r.edges) {
            const ids = [...e.sources, ...e.targets].map(p => owner.get(p)!);
            if (ids.some(id => reached.has(id))) ids.forEach(id => reached.add(id));
        }
        for (const c of cs) assert(reached.has(c.designator), `${c.designator}, patterns=${layoutPatterns}`);
    }
});

test('supply localization is per block, preserves series protection and permits large-block decoupling', () => {
    const cs = [component('U1', [[1, 'VIN', 'SYS'], [2, 'VDD', '3V3']]),
        component('F1', [[1, '1', 'VIN_RAW'], [2, '2', 'VIN_FUSED']]),
        component('D1', [[1, 'A', 'VIN_FUSED'], [2, 'K', 'SYS']]),
        component('C1', [[1, '1', '3V3'], [2, '2', 'GND']])];
    const symbols = cs.map(geometry), shared = () => sharedSupplyNets(cs, symbols).get('__v_root__')!;
    assert(shared().has('3V3'));
    symbols[0].symbol.pins.push(...Array.from({ length: 14 }, (_, i) => ({ num: i + 3, name: 'NC', signal_name: '', part: '', x: 0, y: i })));
    assert(!shared().has('3V3'), 'large IC allows local decoupling flags');
    for (const net of ['VIN_RAW', 'VIN_FUSED', 'SYS']) assert(shared().has(net), `keep ${net} series path`);
    assert(!shared().has('GND'), 'ground remains local without aliasing separate ground domains');
    const small = component('C9', [[1, '1', '3V3'], [2, '2', 'GND']], 'small');
    cs.push(small); symbols.push(geometry(small));
    assert(sharedSupplyNets(cs, symbols).get('small')!.has('3V3'), 'large neighbour block does not detach this capacitor');
});

test('sixteen real components permit supply localization while fifteen stay wired', () => {
    const cs = [component('U1', [[1, 'VDD', '3V3']]), component('C1', [[1, '1', '3V3'], [2, '2', 'GND']]),
        ...Array.from({ length: 13 }, (_, i) => component(`R${i + 1}`, [[1, '1', `N${i}`], [2, '2', 'GND']]))];
    const shared = () => sharedSupplyNets(cs, cs.map(geometry)).get('__v_root__')!;
    assert(shared().has('3V3'));
    cs.push(component('R14', [[1, '1', 'N14'], [2, '2', 'GND']]));
    assert(!shared().has('3V3'));
});
