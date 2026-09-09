import { test } from 'node:test';
import assert from 'node:assert/strict';
import { terminalAwareEdges, terminalTopologySignature, seriesOrientations, namedSupplyNets } from '../src/circuit-layout/graph-order.ts';
import type { ElkNode } from 'elkjs';
import type { SymbolWithMeta } from '../src/types/symbol.ts';
import { component } from './patterns/helpers.ts';
import { createComponentElkNode } from '../src/circuit-layout/index.ts';

test('graph direction follows fixed pin faces, independently of endpoint insertion order', () => {
    const root: ElkNode = { id: 'root', layoutOptions: { 'org.eclipse.elk.direction': 'RIGHT' }, children: [
        { id: 'U1', width: 100, height: 100, ports: [{ id: 'in', x: 0, y: 30 }, { id: 'out', x: 100, y: 30 }, { id: 'unused', x: 100, y: 60 }] },
        { id: 'A', width: 40, height: 20, ports: [{ id: 'a', x: 40, y: 10 }] },
        { id: 'B', width: 40, height: 20, ports: [{ id: 'b', x: 0, y: 10 }] },
    ] };
    const end = (nodeId: string, portId: string) => ({ nodeId, portId, blockName: 'sheet' });
    const signals = { IN: [end('U1', 'in'), end('A', 'a')], OUT: [end('B', 'b'), end('U1', 'out')] };
    const edges = terminalAwareEdges(root, signals);
    assert.deepEqual(edges.map(e => [e.sources[0], e.targets[0]]), [['a', 'in'], ['out', 'b']]);
    assert.deepEqual(terminalAwareEdges(root, { OUT: signals.OUT.toReversed(), IN: signals.IN.toReversed() }), edges);
    const reversed = { ...root, edges: edges.map(e => ({ ...e, sources: e.targets, targets: e.sources })) };
    assert.equal(terminalTopologySignature({ ...root, edges }), terminalTopologySignature(reversed));
    reversed.edges[0].targets = ['unused'];
    assert.notEqual(terminalTopologySignature({ ...root, edges }), terminalTopologySignature(reversed));
});

test('series orientation uses unique IC geometry, abstains on ambiguous attachments and never rotates ICs', () => {
    const u = component('U1', [[1, 'unimportant', 'X'], [2, 'unimportant', 'Y']]);
    const series = component('L9', [[1, '1', 'X'], [2, '2', 'Z']]);
    const ambiguous = component('C8', [[1, '1', 'X'], [2, '2', 'Y']]);
    const branch = component('R9', [[1, '1', 'X'], [2, '2', 'GND']]);
    const symbols: SymbolWithMeta[] = [u, series, ambiguous, branch].map(c => ({ designator: c.designator, block_name: c.block_name,
        symbol: { width: 40, height: 60, center: { x: 20, y: 30 }, pins: c.pins.map((p, i) => ({ num: p.pin_number, name: p.name,
            signal_name: p.signal_name, x: c === u ? 40 : 20, y: c === u ? 20 + i * 20 : i * 60, part: '' })) } }));
    const choices = seriesOrientations([u, series, ambiguous, branch], symbols, new Set());
    assert.deepEqual(choices.map(c => 'designator' in c ? c.designator : ''), ['L9']);
    assert.notEqual(choices[0].type === 'rotate' ? choices[0].rotate % 180 : 0, 0);
    assert.deepEqual(seriesOrientations([u, series], symbols, new Set(['L9'])), []);
});

test('explicit supply pins can identify SYS without changing or conflating net names', () => {
    const u = component('U1', [[1, 'VIN', 'SYS'], [2, 'SW', 'SWITCH'], [3, 'VIN_SENSE', 'SENSE'], [4, 'VSS', 'AGND']]);
    const connector = component('J1', [[1, 'VIN', 'USER_DATA']]);
    assert.deepEqual([...namedSupplyNets([u, connector], [])].sort(), ['AGND', 'SYS']);
    assert.equal(u.pins[0].signal_name, 'SYS');
});

test('repeated ground pins share a local marker on one face but not across the IC body', () => {
    const symbol: SymbolWithMeta = { designator: 'U1', block_name: 'sheet', symbol: { width: 100, height: 100,
        center: { x: 50, y: 50 }, pins: [
            { num: '1', name: 'GND', signal_name: 'GND', x: 0, y: 20, part: '' },
            { num: '2', name: 'GND', signal_name: 'GND', x: 0, y: 60, part: '' },
            { num: '3', name: 'GND', signal_name: 'GND', x: 100, y: 20, part: '' },
            { num: '4', name: 'VCC', signal_name: 'SYS', x: 50, y: 0, part: '' },
            { num: '5', name: 'EN', signal_name: 'SYS', x: 100, y: 60, part: '' },
        ] } };
    const signals: Record<string, { nodeId: string; portId: string; blockName: string }[]> = {};
    createComponentElkNode(symbol, signals, 'sheet', (net, _block, region) => `${net}:${region ?? 'one'}`);
    assert.deepEqual(signals['GND:WEST'].map(p => p.portId), ['U1_pin_1', 'U1_pin_2']);
    assert.deepEqual(signals['GND:EAST'].map(p => p.portId), ['U1_pin_3']);
    assert.deepEqual(signals['SYS:one'].map(p => p.portId), ['U1_pin_4', 'U1_pin_5'], 'a two-pin strap keeps one shared marker');
    assert(symbol.symbol.pins.slice(0, 3).every(p => p.signal_name === 'GND'));
});
