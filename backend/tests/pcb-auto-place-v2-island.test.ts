import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlacementGraph } from '../src/pcb-layout/pcb-auto-place/placement-graph.ts';
import { solveBlockPrimitives } from '../src/pcb-layout/pcb-auto-place-v2/block-solver-engine.ts';
import { solvePlacementIslands } from '../src/pcb-layout/pcb-auto-place-v2/island-solver.ts';
import { solvePlacementTreeBottomUp } from '../src/pcb-layout/pcb-auto-place-v2/tree-solver.ts';
import type { PlacementPrimitive } from '../src/pcb-layout/pcb-auto-place-v2/primitives.ts';
import type { PcbComponent, Placement, PlacementInput } from '../src/types/pcb/layout-model.ts';

test.describe('pcb-auto-place-v2 island solver', () => {
    test('packs capCluster into a compact row with same-net pads aligned', () => {
        const input = baseInput([
            cap('C1'),
            cap('C2'),
            cap('C3'),
        ]);
        input.blocks = [{ ...block('caps', ['C1', 'C2', 'C3']), role: 'power' }];
        input.components.forEach((component) => component.block_name = 'caps');
        input.hints = [{
            relation: 'cap_cluster',
            capacitors: ['C1', 'C2', 'C3'],
            powerNet: '+3V3',
            returnNet: 'GND',
            target: { type: 'pin', designator: 'C1', pin_number: '1' },
            axis: 'x',
            maxRows: 1,
            maxPerRow: 3,
            gap: 0.5,
            rowGap: null,
            topology: 'edge_bus',
            priority: 'critical',
        }];

        const results = solvePlacementIslands(input, buildPlacementGraph(input), { grid: 0.5, clearance: 0.5 });
        assert.equal(results.length, 1);
        assert.equal(results[0].kind, 'cap_cluster');
        assert.equal(results[0].diagnostics.length, 0);
        assert.equal(results[0].placements.length, 3);
        assert.ok(results[0].width <= 4.1, `expected compact width, got ${results[0].width}`);
        assert.ok(results[0].height <= 2.1, `expected one compact row, got ${results[0].height}`);

        const powerY = results[0].placements.map((placement) => padWorld(input, placement, '1')?.y);
        const gndY = results[0].placements.map((placement) => padWorld(input, placement, '2')?.y);
        assert.ok(powerY.every((y) => y === powerY[0]), `power pads should align: ${powerY.join(',')}`);
        assert.ok(gndY.every((y) => y === gndY[0]), `return pads should align: ${gndY.join(',')}`);
        assert.notEqual(powerY[0], gndY[0]);
    });

    test('places bypass capacitors in a row with target-net pads on one side', () => {
        const input = baseInput([
            controllerWithPinNet('U1', '1', '+3V3'),
            cap('C1'),
            cap('C2'),
        ]);
        input.blocks = [{ ...block('regulator', ['U1', 'C1', 'C2']), role: 'power' }];
        input.components.forEach((component) => component.block_name = 'regulator');
        input.hints = [{
            relation: 'bypass',
            capacitors: ['C1', 'C2'],
            target: { type: 'pin', designator: 'U1', pin_number: '1' },
            axis: 'x',
            gap: 0.5,
            rotate: null,
            priority: 'critical',
        }];

        const results = solvePlacementIslands(input, buildPlacementGraph(input), { grid: 0.5, clearance: 0.5 });
        assert.equal(results.length, 1);
        assert.equal(results[0].kind, 'bypass');
        assert.equal(results[0].placements.length, 2);

        const c1 = results[0].placements.find((placement) => placement.designator === 'C1');
        const c2 = results[0].placements.find((placement) => placement.designator === 'C2');
        assert.ok(c1);
        assert.ok(c2);
        assert.equal(c1.rotate, c2.rotate, 'bypass capacitors should share rotation');

        const powerY1 = padWorld(input, c1, '1')?.y;
        const powerY2 = padWorld(input, c2, '1')?.y;
        assert.equal(typeof powerY1, 'number');
        assert.equal(typeof powerY2, 'number');
        assert.ok(Math.abs(powerY1! - powerY2!) < 0.001, `power pads should align: ${powerY1}, ${powerY2}`);

        const gndY1 = padWorld(input, c1, '2')?.y;
        const gndY2 = padWorld(input, c2, '2')?.y;
        assert.ok(Math.abs(gndY1! - gndY2!) < 0.001);
        assert.notEqual(Math.round(powerY1! * 1000), Math.round(gndY1! * 1000));

        // axis='x' => power pads should be perpendicular to row (non-zero y)
        assert.ok(Math.abs(powerY1!) > 0.2, 'target-net pads should point out of the row');

        const centersX = results[0].placements.map((placement) => placement.x).sort((a, b) => a - b);
        const pitch = centersX[1] - centersX[0];
        assert.ok(pitch >= 1.4 && pitch <= 1.6, `expected body+gap pitch ~1.5, got ${pitch}`);
    });

    test('places bypass capacitors with explicit rotate and gap', () => {
        const input = baseInput([
            controllerWithPinNet('U1', '1', '+3V3'),
            cap('C1'),
            cap('C2'),
        ]);
        input.blocks = [{ ...block('regulator', ['U1', 'C1', 'C2']), role: 'power' }];
        input.components.forEach((component) => component.block_name = 'regulator');
        input.hints = [{
            relation: 'bypass',
            capacitors: ['C1', 'C2'],
            target: { type: 'pin', designator: 'U1', pin_number: '1' },
            axis: 'y',
            gap: 1.0,
            rotate: 180,
            priority: 'critical',
        }];

        const results = solvePlacementIslands(input, buildPlacementGraph(input), { grid: 0.5, clearance: 0.5 });
        assert.equal(results.length, 1);
        assert.equal(results[0].kind, 'bypass');
        results[0].placements.forEach((placement) => assert.equal(placement.rotate, 180));

        const centersY = results[0].placements.map((placement) => placement.y).sort((a, b) => a - b);
        const pitch = centersY[1] - centersY[0];
        assert.ok(pitch >= 1.9 && pitch <= 2.1, `expected body+gap pitch ~2.0, got ${pitch}`);
    });

    test('packs capCluster into two rows with center_power_bus topology', () => {
        const input = baseInput([
            cap('C1'),
            cap('C2'),
            cap('C3'),
            cap('C4'),
        ]);
        input.blocks = [{ ...block('caps', ['C1', 'C2', 'C3', 'C4']), role: 'power' }];
        input.components.forEach((component) => component.block_name = 'caps');
        input.hints = [{
            relation: 'cap_cluster',
            capacitors: ['C1', 'C2', 'C3', 'C4'],
            powerNet: '+3V3',
            returnNet: 'GND',
            target: { type: 'pin', designator: 'C1', pin_number: '1' },
            axis: 'x',
            maxRows: 2,
            maxPerRow: 2,
            gap: 0.5,
            rowGap: 1.5,
            topology: 'center_power_bus',
            priority: 'critical',
        }];

        const results = solvePlacementIslands(input, buildPlacementGraph(input), { grid: 0.5, clearance: 0.5 });
        assert.equal(results.length, 1);
        assert.equal(results[0].kind, 'cap_cluster');
        assert.equal(results[0].placements.length, 4);

        const placementsByRow = new Map<number, Placement[]>();
        for (const placement of results[0].placements) {
            const row = Math.round(placement.y / 2);
            const list = placementsByRow.get(row) ?? [];
            list.push(placement);
            placementsByRow.set(row, list);
        }
        assert.equal(placementsByRow.size, 2, 'expected two rows');

        for (const rowPlacements of placementsByRow.values()) {
            assert.equal(rowPlacements.length, 2);
            const powerYs = rowPlacements.map((placement) => padWorld(input, placement, '1')?.y);
            const gndYs = rowPlacements.map((placement) => padWorld(input, placement, '2')?.y);
            assert.ok(powerYs.every((y) => typeof y === 'number'));
            assert.ok(Math.abs(powerYs[0]! - powerYs[1]!) < 0.001, 'power pads in a row should align');
            assert.ok(Math.abs(gndYs[0]! - gndYs[1]!) < 0.001, 'return pads in a row should align');
        }

        const avgY = (placements: Placement[]) => placements.reduce((sum, p) => sum + p.y, 0) / placements.length;
        const rowEntries = [...placementsByRow.entries()].sort((a, b) => avgY(a[1]) - avgY(b[1]));
        const topRow = rowEntries[0];
        const bottomRow = rowEntries[1];
        const topCenterY = avgY(topRow[1]);
        const bottomCenterY = avgY(bottomRow[1]);
        const topPowerY = padWorld(input, topRow[1][0], '1')!.y;
        const bottomPowerY = padWorld(input, bottomRow[1][0], '1')!.y;
        // top row power pads should be below row center (inward), bottom row power pads above row center
        assert.ok(topPowerY > topCenterY, 'top row power pads should face inward');
        assert.ok(bottomPowerY < bottomCenterY, 'bottom row power pads should face inward');
    });

    test('packs core pair components near their paired pads', () => {
        const input = baseInput([controller(), inductor()]);
        input.blocks = [{ ...block('switch_core', ['U1', 'L1']), role: 'power' }];
        input.components.forEach((component) => component.block_name = 'switch_core');
        input.hints = [
            {
                relation: 'critical_pair',
                source: { type: 'pin', designator: 'U1', pin_number: '1' },
                target: { type: 'pin', designator: 'L1', pin_number: '1' },
                priority: 'critical',
                maxDistance: 2.5,
                minDistance: null,
                weightMultiplier: null,
                hard: true,
                crossingPenalty: null,
                preferFacingPads: true,
                core: true,
                block: 'switch_loop',
            },
        ];

        const results = solvePlacementIslands(input, buildPlacementGraph(input), { grid: 0.5, clearance: 0.5 });
        assert.equal(results.length, 1);
        assert.equal(results[0].kind, 'core_pairs');
        assert.equal(results[0].diagnostics.length, 0);
        assert.ok(results[0].area <= 32, `expected compact core island, got area ${results[0].area}`);

        const u1 = results[0].placements.find((placement) => placement.designator === 'U1');
        const l1 = results[0].placements.find((placement) => placement.designator === 'L1');
        assert.ok(u1);
        assert.ok(l1);
        const uPad = padWorld(input, u1, '1');
        const lPad = padWorld(input, l1, '1');
        assert.ok(uPad);
        assert.ok(lPad);
        assert.ok(Math.hypot(uPad.x - lPad.x, uPad.y - lPad.y) <= 2.5);
    });

    test('solves two-component core pair islands by anchoring the main IC and balancing both paired pads', () => {
        const input = baseInput([switchController(), dualInductor()]);
        input.blocks = [{ ...block('switch_core', ['U1', 'L1']), role: 'power' }];
        input.components.forEach((component) => component.block_name = 'switch_core');
        input.hints = [
            {
                relation: 'critical_pair',
                source: { type: 'pin', designator: 'U1', pin_number: '1' },
                target: { type: 'pin', designator: 'L1', pin_number: '1' },
                priority: 'critical',
                maxDistance: 2.5,
                minDistance: null,
                weightMultiplier: null,
                hard: true,
                crossingPenalty: null,
                preferFacingPads: true,
                core: true,
                block: 'switch_loop',
            },
            {
                relation: 'critical_pair',
                source: { type: 'pin', designator: 'U1', pin_number: '10' },
                target: { type: 'pin', designator: 'L1', pin_number: '2' },
                priority: 'critical',
                maxDistance: 2.5,
                minDistance: null,
                weightMultiplier: null,
                hard: true,
                crossingPenalty: null,
                preferFacingPads: true,
                core: true,
                block: 'switch_loop',
            },
        ];

        const results = solvePlacementIslands(input, buildPlacementGraph(input), { grid: 0.5, clearance: 0.5 });
        assert.equal(results.length, 1);
        const u1 = results[0].placements.find((placement) => placement.designator === 'U1');
        const l1 = results[0].placements.find((placement) => placement.designator === 'L1');
        assert.ok(u1);
        assert.ok(l1);
        const first = distance(padWorld(input, u1, '1')!, padWorld(input, l1, '1')!);
        const second = distance(padWorld(input, u1, '10')!, padWorld(input, l1, '2')!);
        assert.ok(first <= 2.5, `expected first switch pair close, got ${first}`);
        assert.ok(second <= 2.5, `expected second switch pair close, got ${second}`);
        assert.ok(Math.abs(first - second) <= 0.75, `expected balanced switch pair distances, got ${first} and ${second}`);
    });

    test('solves lowest islands as primitives and defers parent-level islands', () => {
        const input = baseInput([controller(), cap('C1'), cap('C2')]);
        input.blocks = [
            { ...block('core', ['U1']), role: 'power' },
            { ...block('caps', ['C1', 'C2']), role: 'power', placement: 'satellite', attachTo: 'core' },
        ];
        input.components.find((component) => component.designator === 'U1')!.block_name = 'core';
        input.components.find((component) => component.designator === 'C1')!.block_name = 'caps';
        input.components.find((component) => component.designator === 'C2')!.block_name = 'caps';
        input.hints = [
            {
                relation: 'cap_cluster',
                capacitors: ['C1', 'C2'],
                powerNet: '+3V3',
                returnNet: 'GND',
                target: { type: 'pin', designator: 'C1', pin_number: '1' },
                axis: 'x',
                maxRows: 1,
                maxPerRow: 2,
                gap: 0.5,
                rowGap: null,
                topology: 'edge_bus',
                priority: 'critical',
            },
            {
                relation: 'critical_pair',
                source: { type: 'pin', designator: 'U1', pin_number: '1' },
                target: { type: 'pin', designator: 'C1', pin_number: '1' },
                priority: 'critical',
                maxDistance: 4,
                minDistance: null,
                weightMultiplier: null,
                hard: true,
                crossingPenalty: null,
                preferFacingPads: true,
                core: true,
                block: 'parent_core',
            },
        ];

        const graph = buildPlacementGraph(input);
        const result = solvePlacementTreeBottomUp(input, graph, { grid: 0.5, clearance: 0.5 });

        assert.ok(result.primitives.some((primitive) => primitive.kind === 'island' && primitive.label.startsWith('cap_cluster')));
        assert.ok(result.diagnostics.some((diagnostic) => diagnostic.message.includes('Deferred parent-level island')));
        assert.ok(result.root.placements.length > 0);
        assert.ok(result.root.connectionPoints.some((point) => point.ref === 'C1.1'));
    });

    test('places solved islands and standalone components together inside a block', () => {
        const input = baseInput([controller(), cap('C1'), cap('C2')]);
        input.blocks = [{ ...block('regulator', ['U1', 'C1', 'C2']), role: 'power' }];
        input.components.forEach((component) => component.block_name = 'regulator');
        input.hints = [
            {
                relation: 'cap_cluster',
                capacitors: ['C1', 'C2'],
                powerNet: '+3V3',
                returnNet: 'GND',
                target: { type: 'pin', designator: 'C1', pin_number: '1' },
                axis: 'x',
                maxRows: 1,
                maxPerRow: 2,
                gap: 0.5,
                rowGap: null,
                topology: 'edge_bus',
                priority: 'critical',
            },
            {
                relation: 'critical_pair',
                source: { type: 'pin', designator: 'U1', pin_number: '1' },
                target: { type: 'pin', designator: 'C1', pin_number: '1' },
                priority: 'critical',
                maxDistance: 4,
                minDistance: null,
                weightMultiplier: null,
                hard: true,
                crossingPenalty: null,
                preferFacingPads: true,
                core: false,
            },
        ];

        const result = solvePlacementTreeBottomUp(input, buildPlacementGraph(input), { grid: 0.5, clearance: 0.5 });
        const blockPrimitive = result.primitives.find((primitive) => primitive.sourceNodeId === 'tree:block:regulator');
        assert.ok(blockPrimitive);

        const designators = blockPrimitive.placements.map((placement) => placement.designator);
        assert.deepEqual([...new Set(designators)].sort(), ['C1', 'C2', 'U1']);
        assert.equal(designators.length, 3, `expected no duplicate component placements, got ${designators.join(',')}`);

        const u1 = blockPrimitive.placements.find((placement) => placement.designator === 'U1');
        const c1 = blockPrimitive.placements.find((placement) => placement.designator === 'C1');
        assert.ok(u1);
        assert.ok(c1);
        const uPad = padWorld(input, u1, '1');
        const cPad = padWorld(input, c1, '1');
        assert.ok(uPad);
        assert.ok(cPad);
        assert.ok(Math.hypot(uPad.x - cPad.x, uPad.y - cPad.y) <= 5, `expected U1/C1 critical pads close, got ${JSON.stringify({ uPad, cPad })}`);
    });

    test('places child blocks together inside a module by scoped relations', () => {
        const input = baseInput([controller(), cap('C1'), cap('C2')]);
        input.blocks = [
            { ...block('core', ['U1']), role: 'power' },
            { ...block('caps', ['C1', 'C2']), role: 'power' },
        ];
        input.modules = [{
            name: 'power_family',
            block_names: ['core', 'caps'],
            maxWidth: 12,
            maxHeight: 8,
        }];
        input.components.find((component) => component.designator === 'U1')!.block_name = 'core';
        input.components.find((component) => component.designator === 'C1')!.block_name = 'caps';
        input.components.find((component) => component.designator === 'C2')!.block_name = 'caps';
        input.hints = [
            {
                relation: 'cap_cluster',
                capacitors: ['C1', 'C2'],
                powerNet: '+3V3',
                returnNet: 'GND',
                target: { type: 'pin', designator: 'C1', pin_number: '1' },
                axis: 'x',
                maxRows: 1,
                maxPerRow: 2,
                gap: 0.5,
                rowGap: null,
                topology: 'edge_bus',
                priority: 'critical',
            },
            {
                relation: 'critical_pair',
                source: { type: 'pin', designator: 'U1', pin_number: '1' },
                target: { type: 'pin', designator: 'C1', pin_number: '1' },
                priority: 'critical',
                maxDistance: 6,
                minDistance: null,
                weightMultiplier: null,
                hard: true,
                crossingPenalty: null,
                preferFacingPads: true,
                core: false,
            },
        ];

        const result = solvePlacementTreeBottomUp(input, buildPlacementGraph(input), { grid: 0.5, clearance: 0.5 });
        const modulePrimitive = result.primitives.find((primitive) => primitive.sourceNodeId === 'tree:module:power_family');
        assert.ok(modulePrimitive);
        assert.ok(modulePrimitive.width <= 12, `expected compact module width, got ${modulePrimitive.width}`);

        const u1 = modulePrimitive.placements.find((placement) => placement.designator === 'U1');
        const c1 = modulePrimitive.placements.find((placement) => placement.designator === 'C1');
        assert.ok(u1);
        assert.ok(c1);
        const uPad = padWorld(input, u1, '1');
        const cPad = padWorld(input, c1, '1');
        assert.ok(uPad);
        assert.ok(cPad);
        assert.ok(Math.hypot(uPad.x - cPad.x, uPad.y - cPad.y) <= 6);
    });

    test('keeps components collision-free when cross-module electrical scores prefer overlap', () => {
        const input = baseInput([cap('C1'), cap('C2')]);
        input.blocks = [
            { ...block('left_caps', ['C1']), role: 'power' },
            { ...block('right_caps', ['C2']), role: 'power' },
        ];
        input.modules = [
            { name: 'left_module', block_names: ['left_caps'] },
            { name: 'right_module', block_names: ['right_caps'] },
        ];
        input.components.find((component) => component.designator === 'C1')!.block_name = 'left_caps';
        input.components.find((component) => component.designator === 'C2')!.block_name = 'right_caps';
        input.hints = Array.from({ length: 4 }, () => ({
            relation: 'critical_pair' as const,
            source: { type: 'pin' as const, designator: 'C1', pin_number: '1' },
            target: { type: 'pin' as const, designator: 'C2', pin_number: '1' },
            priority: 'critical' as const,
            maxDistance: 0.1,
            minDistance: null,
            weightMultiplier: 10,
            hard: true,
            crossingPenalty: null,
            preferFacingPads: true,
            core: false,
        }));

        const result = solvePlacementTreeBottomUp(input, buildPlacementGraph(input), { grid: 0.5, clearance: 0.5 });
        const c1 = result.root.placements.find((placement) => placement.designator === 'C1');
        const c2 = result.root.placements.find((placement) => placement.designator === 'C2');
        assert.ok(c1);
        assert.ok(c2);

        const c1Box = placementBox(input, c1);
        const c2Box = placementBox(input, c2);
        const xGap = Math.max(0, c2Box.left - c1Box.right, c1Box.left - c2Box.right);
        const yGap = Math.max(0, c2Box.top - c1Box.bottom, c1Box.top - c2Box.bottom);
        assert.ok(Math.hypot(xGap, yGap) >= 0.5, `expected component clearance to beat relation score: ${JSON.stringify({ c1Box, c2Box })}`);
    });

    test('searches the board when every anchor candidate has a hard collision', () => {
        const fixed = primitive('fixed', { left: -2, right: 2, top: -2, bottom: 2 }, true);
        const moving = primitive('moving', { left: -1, right: 1, top: -1, bottom: 1 });
        const blockedCenters = [
            [3.5, 0], [-3.5, 0], [0, 3.5], [0, -3.5],
            [3.5, 3.5], [3.5, -3.5], [-3.5, 3.5], [-3.5, -3.5],
        ];
        const obstacles = blockedCenters.map(([x, y]) => ({ left: x, right: x, top: y, bottom: y }));

        const solved = solveBlockPrimitives({
            node: {
                id: 'tree:board',
                kind: 'board',
                label: 'board',
                ref: 'board',
                data: {},
                children: [],
            },
            primitives: [fixed, moving],
            relations: [],
            options: {
                grid: 0.5,
                clearance: 0.5,
                bounds: { left: -5, right: 5, top: -5, bottom: 5 },
                obstacles,
            },
        });

        const placedMoving = solved.find((item) => item.id === 'moving');
        assert.ok(placedMoving);
        assert.equal(boxesOverlap(placedMoving.bbox, fixed.bbox, 0.5), false);
        assert.equal(obstacles.some((obstacle) => boxesOverlap(placedMoving.bbox, obstacle, 0.5)), false);
    });

    test('validates and moves a single board primitive away from obstacles', () => {
        const moving = primitive('moving', { left: -1, right: 1, top: -1, bottom: 1 });
        const obstacle = { left: -1.5, right: 1.5, top: -1.5, bottom: 1.5 };
        const solved = solveBlockPrimitives({
            node: {
                id: 'tree:board',
                kind: 'board',
                label: 'board',
                ref: 'board',
                data: {},
                children: [],
            },
            primitives: [moving],
            relations: [],
            options: {
                grid: 0.5,
                clearance: 0.5,
                bounds: { left: -5, right: 5, top: -5, bottom: 5 },
                obstacles: [obstacle],
            },
        });

        assert.equal(solved.length, 1);
        assert.equal(boxesOverlap(solved[0].bbox, obstacle, 0.5), false);
    });

    test('does not let placement grid reduce exact component clearance', () => {
        const fixed = primitive('fixed', { left: -1.8075, right: 1.8075, top: -1, bottom: 1 }, true);
        const moving = primitive('moving', { left: -0.432, right: 0.432, top: -0.4, bottom: 0.4 });
        const solved = solveBlockPrimitives({
            node: {
                id: 'tree:block:fractional',
                kind: 'block',
                label: 'fractional',
                ref: 'block:fractional',
                data: {},
                children: [],
            },
            primitives: [fixed, moving],
            relations: [],
            options: {
                grid: 0.5,
                clearance: 0.35,
            },
        });

        const placedMoving = solved.find((item) => item.id === 'moving');
        assert.ok(placedMoving);
        assert.equal(boxesOverlap(placedMoving.bbox, fixed.bbox, 0.35), false);
        assert.ok(boxGap(placedMoving.bbox, fixed.bbox) >= 0.35 - 0.000001);
    });

    test('keeps alternate module orders when greedy packing reaches a dead end', () => {
        const fixed = primitive('input_power', { left: -5.87, right: 8.35, top: 4.149, bottom: 26.2 }, true);
        const buck = primitive('buck', { left: -7.113, right: 7.113, top: -8.792, bottom: 8.792 });
        const mcu = primitive('rp2040', { left: -10.875, right: 10.875, top: -8.138, bottom: 8.138 });
        const solved = solveBlockPrimitives({
            node: {
                id: 'tree:board',
                kind: 'board',
                label: 'board',
                ref: 'board',
                data: {},
                children: [],
            },
            primitives: [fixed, buck, mcu],
            relations: [],
            options: {
                grid: 0.5,
                clearance: 0.9,
                bounds: { left: -22.8, right: 22.8, top: -22.8, bottom: 22.8 },
                collisionMode: 'hybrid',
                searchWidth: 64,
            },
        });

        for (let i = 0; i < solved.length; i += 1) {
            for (let j = i + 1; j < solved.length; j += 1) {
                assert.equal(
                    boxesOverlap(solved[i].bbox, solved[j].bbox, 0.9),
                    false,
                    `expected beam search to avoid ${solved[i].label}/${solved[j].label} overlap`,
                );
            }
        }
    });

    test('turns a leaf passive block with a dominant net into a compact synthetic island', () => {
        const input = baseInput([
            passive('R3', 'OUT', 'FB'),
            passive('R5', 'FB', 'GND'),
            passive('C8', 'FB', 'GND'),
            passive('C1', 'FB', 'AUX'),
        ]);
        input.blocks = [{ ...block('feedback', ['R3', 'R5', 'C8', 'C1']), role: 'analog' }];
        input.components.forEach((component) => component.block_name = 'feedback');

        const result = solvePlacementTreeBottomUp(input, buildPlacementGraph(input), { grid: 0.5, clearance: 0.5 });
        const synthetic = result.primitives.find((primitive) => primitive.label === 'passive_net:FB');
        assert.ok(synthetic);
        assert.deepEqual(synthetic.placements.map((placement) => placement.designator).sort(), ['C1', 'C8', 'R3', 'R5']);

        const fbPoints = synthetic.connectionPoints.filter((point) => point.net === 'FB');
        const xSpread = Math.max(...fbPoints.map((point) => point.x)) - Math.min(...fbPoints.map((point) => point.x));
        const ySpread = Math.max(...fbPoints.map((point) => point.y)) - Math.min(...fbPoints.map((point) => point.y));
        assert.ok(xSpread + ySpread <= 4.5, `expected compact FB pad cluster, got spread ${xSpread + ySpread}`);

        const r5 = synthetic.placements.find((placement) => placement.designator === 'R5');
        const c8 = synthetic.placements.find((placement) => placement.designator === 'C8');
        assert.ok(r5);
        assert.ok(c8);
        const r5Fb = padWorld(input, r5, '1');
        const c8Fb = padWorld(input, c8, '1');
        const r5Gnd = padWorld(input, r5, '2');
        const c8Gnd = padWorld(input, c8, '2');
        assert.ok(r5Fb);
        assert.ok(c8Fb);
        assert.ok(r5Gnd);
        assert.ok(c8Gnd);
        assert.ok(Math.hypot(r5Fb.x - c8Fb.x, r5Fb.y - c8Fb.y) <= 2.1, 'expected shared FB pads of R5/C8 to be close');
        assert.ok(Math.hypot(r5Gnd.x - c8Gnd.x, r5Gnd.y - c8Gnd.y) <= 2.1, 'expected shared GND pads of R5/C8 to be close');
        const r5Vector = normalize({ x: r5Gnd.x - r5Fb.x, y: r5Gnd.y - r5Fb.y });
        const c8Vector = normalize({ x: c8Gnd.x - c8Fb.x, y: c8Gnd.y - c8Fb.y });
        assert.ok(Math.hypot(r5Vector.x - c8Vector.x, r5Vector.y - c8Vector.y) <= 0.01, 'expected R5/C8 shared-net vectors to be parallel');
    });
});

function baseInput(components: PcbComponent[]): PlacementInput {
    return {
        board: {
            outline: { type: 'rect', width: 30, height: 20 },
            clearances: { component: 0.5, edge: 1 },
            allowedLayers: ['top'],
            defaultLayer: 'top',
        },
        boardHoles: [],
        components,
        blocks: [],
        modules: [],
        hints: [],
        solverOptions: {
            placementGridStep: 0.5,
            fallbackGridStep: 1,
            candidateRadii: [2, 4],
            candidateAngles: [0, 90, 180, 270],
            ignoredRatsnestSignals: [],
            localImproveIterations: 0,
            localImproveMinDelta: 0,
            hierarchicalBlocks: true,
        },
    };
}

function block(name: string, component_designators: string[]) {
    return {
        name,
        description: '',
        component_designators,
        role: 'generic' as const,
        placement: 'main' as const,
    };
}

function cap(designator: string): PcbComponent {
    return component(designator, [
        { pin_number: '1', name: '1', signal_name: '+3V3' },
        { pin_number: '2', name: '2', signal_name: 'GND' },
    ], {
        name: 'C0603',
        width: 2,
        height: 1,
        pads: [
            { pin_number: '1', name: '1', x: -0.5, y: 0, width: 0.5, height: 0.8 },
            { pin_number: '2', name: '2', x: 0.5, y: 0, width: 0.5, height: 0.8 },
        ],
    });
}

function passive(designator: string, pin1Net: string, pin2Net: string): PcbComponent {
    return component(designator, [
        { pin_number: '1', name: '1', signal_name: pin1Net },
        { pin_number: '2', name: '2', signal_name: pin2Net },
    ], {
        name: 'R0603',
        width: 2,
        height: 1,
        pads: [
            { pin_number: '1', name: '1', x: -0.5, y: 0, width: 0.5, height: 0.8 },
            { pin_number: '2', name: '2', x: 0.5, y: 0, width: 0.5, height: 0.8 },
        ],
    });
}

function controller(): PcbComponent {
    return component('U1', [
        { pin_number: '1', name: 'SW1', signal_name: 'SW' },
    ], {
        name: 'U',
        width: 4,
        height: 4,
        pads: [{ pin_number: '1', name: 'SW1', x: 2, y: 0, width: 0.4, height: 0.6 }],
    });
}

function controllerWithPinNet(designator: string, pin: string, net: string): PcbComponent {
    return component(designator, [
        { pin_number: pin, name: pin, signal_name: net },
    ], {
        name: 'U',
        width: 4,
        height: 4,
        pads: [{ pin_number: pin, name: pin, x: 2, y: 0, width: 0.4, height: 0.6 }],
    });
}

function inductor(): PcbComponent {
    return component('L1', [
        { pin_number: '1', name: '1', signal_name: 'SW' },
    ], {
        name: 'L',
        width: 3,
        height: 2,
        pads: [{ pin_number: '1', name: '1', x: -1, y: 0, width: 0.6, height: 0.8 }],
    });
}

function switchController(): PcbComponent {
    const value = component('U1', [
        { pin_number: '1', name: 'SW1', signal_name: 'SW1' },
        { pin_number: '10', name: 'SW2', signal_name: 'SW2' },
    ], {
        name: 'U',
        width: 4,
        height: 4,
        pads: [
            { pin_number: '1', name: 'SW1', x: 2, y: -0.8, width: 0.4, height: 0.6 },
            { pin_number: '10', name: 'SW2', x: 2, y: 0.8, width: 0.4, height: 0.6 },
        ],
    });
    value.pcb.role = 'main_ic';
    return value;
}

function dualInductor(): PcbComponent {
    return component('L1', [
        { pin_number: '1', name: '1', signal_name: 'SW1' },
        { pin_number: '2', name: '2', signal_name: 'SW2' },
    ], {
        name: 'L',
        width: 3,
        height: 2,
        pads: [
            { pin_number: '1', name: '1', x: -1, y: -0.5, width: 0.6, height: 0.8 },
            { pin_number: '2', name: '2', x: -1, y: 0.5, width: 0.6, height: 0.8 },
        ],
    });
}

function component(designator: string, pins: PcbComponent['pins'], footprint: PcbComponent['footprint']): PcbComponent {
    return {
        designator,
        value: designator,
        pins,
        block_name: '',
        search_query: '',
        part_uuid: null,
        footprint,
        pcb: {
            role: 'passive',
            allowedLayers: ['top'],
            allowedRotations: [0, 90, 180, 270],
        },
    };
}

function padWorld(input: PlacementInput, placement: Placement, pin: string) {
    const component = input.components.find((item) => item.designator === placement.designator);
    const pad = component?.footprint.pads.find((item) => String(item.pin_number) === pin);
    if (!pad) return null;
    const radians = placement.rotate * Math.PI / 180;
    return {
        x: placement.x + pad.x * Math.cos(radians) - pad.y * Math.sin(radians),
        y: placement.y + pad.x * Math.sin(radians) + pad.y * Math.cos(radians),
    };
}

function placementBox(input: PlacementInput, placement: Placement) {
    const component = input.components.find((item) => item.designator === placement.designator);
    assert.ok(component);
    const radians = placement.rotate * Math.PI / 180;
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    const halfWidth = (component.footprint.width * cos + component.footprint.height * sin) / 2;
    const halfHeight = (component.footprint.width * sin + component.footprint.height * cos) / 2;
    return {
        left: placement.x - halfWidth,
        right: placement.x + halfWidth,
        top: placement.y - halfHeight,
        bottom: placement.y + halfHeight,
    };
}

function primitive(id: string, bbox: { left: number; right: number; top: number; bottom: number }, locked = false): PlacementPrimitive {
    return {
        id,
        kind: 'component',
        label: id,
        sourceNodeId: `tree:component:${id}`,
        locked,
        canRotate: false,
        bbox,
        collisionBoxes: [bbox],
        width: bbox.right - bbox.left,
        height: bbox.bottom - bbox.top,
        placements: [{ designator: id, x: 0, y: 0, rotate: 0, layer: 'top', score: 0 }],
        connectionPoints: [],
        children: [],
    };
}

function boxesOverlap(
    a: { left: number; right: number; top: number; bottom: number },
    b: { left: number; right: number; top: number; bottom: number },
    clearance: number,
) {
    return Math.min(a.right + clearance - b.left, b.right + clearance - a.left) > 0
        && Math.min(a.bottom + clearance - b.top, b.bottom + clearance - a.top) > 0;
}

function boxGap(
    a: { left: number; right: number; top: number; bottom: number },
    b: { left: number; right: number; top: number; bottom: number },
) {
    const xGap = Math.max(0, b.left - a.right, a.left - b.right);
    const yGap = Math.max(0, b.top - a.bottom, a.top - b.bottom);
    return Math.hypot(xGap, yGap);
}

function normalize(point: { x: number; y: number }) {
    const length = Math.hypot(point.x, point.y);
    return length > 0 ? { x: point.x / length, y: point.y / length } : { x: 0, y: 0 };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
