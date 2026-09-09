import assert from 'node:assert/strict';
import test from 'node:test';
import { refinePostPlacement } from '../src/pcb-layout/pcb-auto-place-v2/post-place-refiner.ts';
import { runPcbLayoutDsl } from '../src/pcb-layout/pcb-layout-dsl/spec.ts';
import { defaultSolverOptions } from '../src/pcb-layout/pcb-auto-place/utils.ts';
import type { FootprintSpec, PcbComponent, Placement, PlacementInput } from '../src/types/pcb/layout-model.ts';

test.describe('post-place refinement', () => {
    test('compiles explicit refine groups and keeps rotations relative', () => {
        const rules = runPcbLayoutDsl(`
            refineGroup("headers", ["H1", "H2"], { swap: true, rotateBy: [180] });
        `);

        assert.deepEqual(rules.refineGroups, [{
            name: 'headers',
            component_designators: ['H1', 'H2'],
            swap: true,
            rotateBy: [180],
        }]);
        assert.throws(
            () => runPcbLayoutDsl('refineGroup("bad", ["H1", "H2"], { rotateBy: [90] });'),
            /only the relative 180 degree post-placement flip/,
        );
    });

    test('automatically accepts an atomic swap plus 180-degree rotation inside one block', () => {
        const input = pairInput();
        const before = pairPlacements();
        const result = refinePostPlacement(input, before);
        const a = placement(result.placements, 'A');
        const b = placement(result.placements, 'B');

        assert.equal(a.x, 5);
        assert.equal(b.x, -5);
        assert.ok(result.moves[0]?.description.includes('A<->B'));
        assert.ok(result.moves[0]?.description.includes('+=180'), result.moves[0]?.description);
        assert.ok(result.scoreAfter < result.scoreBefore);
        assert.ok(result.moves.every((move) => move.scoreAfter < move.scoreBefore));
    });

    test('does not mutate fixed poses without permission and reports the opportunity', () => {
        const input = pairInput({ fixed: true });
        const before = pairPlacements();
        const result = refinePostPlacement(input, before);

        assert.deepEqual(result.placements, before);
        assert.equal(result.moves.length, 0);
        assert.equal(result.diagnostics.length, 1);
        assert.match(result.diagnostics[0].message, /blocked by fixed placement/);
        assert.match(result.diagnostics[0].message, /refineGroup\("post_A_B"/);
    });

    test('reports a fixed single-component rotation despite an unrelated existing hard violation', () => {
        const input = pairInput({ fixed: true });
        for (const designator of ['B', 'LEFT', 'RIGHT']) {
            componentByDesignator(input, designator).pcb.edgeMount = { edge: 'left' };
        }
        input.hints.push({
            relation: 'critical_pair',
            source: { type: 'pin', designator: 'LEFT', pin_number: '1' },
            target: { type: 'pin', designator: 'RIGHT', pin_number: '1' },
            priority: 'critical',
            maxDistance: 1,
            hard: true,
        });

        const result = refinePostPlacement(input, pairPlacements());

        assert.deepEqual(result.placements, pairPlacements());
        assert.equal(result.moves.length, 0);
        assert.equal(result.diagnostics.length, 1);
        assert.match(result.diagnostics[0].message, /A rotate \+= 180/);
        assert.match(result.diagnostics[0].message, /refineGroup\("post_A", \["A"\], \{ rotateBy: \[180\] \}\)/);
    });

    test('allows a fixed pose exchange only through an explicit refine group', () => {
        const input = pairInput({ fixed: true, refineGroup: true });
        const result = refinePostPlacement(input, pairPlacements());

        assert.equal(placement(result.placements, 'A').x, 5);
        assert.equal(placement(result.placements, 'B').x, -5);
        assert.equal(result.diagnostics.length, 0);
        assert.ok(result.moves.some((move) => move.description.startsWith('headers: A<->B')));
    });

    test('rejects a score improvement that introduces a hard collision', () => {
        const input = pairInput();
        input.components[0].footprint = footprint('large', 3, 1, -0.35);
        input.components[0].pcb.allowedRotations = [0];
        input.components[1].pcb.allowedRotations = [0];
        input.components.push(component('OBS', 'obstacle', 'OBS', footprint('obstacle', 1, 1, 0)));
        input.blocks.push(block('obstacle', ['OBS']));
        const before = [...pairPlacements(), pose('OBS', 6.2, 0)];

        const result = refinePostPlacement(input, before);

        assert.deepEqual(result.placements, before);
        assert.equal(result.moves.length, 0);
    });

    test('recognizes equivalent footprint geometry with a different library base angle', () => {
        const input = pairInput();
        input.components[0].part_uuid = null;
        input.components[1].part_uuid = null;
        input.components[0].footprint_uuid = null;
        input.components[1].footprint_uuid = null;
        input.components[0].pcb.allowedRotations = [0, 90, 180, 270];
        input.components[1].pcb.allowedRotations = [0, 90, 180, 270];
        input.components[0].footprint = {
            name: 'horizontal', width: 2, height: 1,
            pads: [{ pin_number: '1', x: 0.6, y: 0, width: 0.4, height: 0.2 }],
        };
        input.components[1].footprint = {
            name: 'vertical', width: 1, height: 2,
            pads: [{ pin_number: '1', x: 0, y: 0.6, width: 0.2, height: 0.4 }],
        };

        const result = refinePostPlacement(input, pairPlacements());

        assert.equal(placement(result.placements, 'A').x, 5);
        assert.equal(placement(result.placements, 'B').x, -5);
        assert.ok(result.moves.some((move) => move.kind === 'swap'));
    });
});

function pairInput(options: { fixed?: boolean; refineGroup?: boolean } = {}): PlacementInput {
    const pairFootprint = footprint('pair', 1, 1, -0.35);
    const components = [
        component('A', 'pair', 'RIGHT', pairFootprint, options.fixed),
        component('B', 'pair', 'LEFT', pairFootprint, options.fixed),
        component('LEFT', 'left-end', 'LEFT', footprint('left-end', 1.2, 1, 0), true),
        component('RIGHT', 'right-end', 'RIGHT', footprint('right-end', 1.4, 1, 0), true),
    ];
    return {
        board: {
            coordinateSystem: 'centered',
            outline: { type: 'rect', width: 40, height: 20 },
            defaultLayer: 'top',
            allowedLayers: ['top'],
            clearances: { component: 0.1, edge: 0.1 },
        },
        boardHoles: [],
        constraintRegions: [],
        components,
        blocks: [
            block('pair', ['A', 'B']),
            block('left-end', ['LEFT']),
            block('right-end', ['RIGHT']),
        ],
        modules: [],
        hints: [],
        paths: [],
        refineGroups: options.refineGroup ? [{
            name: 'headers',
            componentDesignators: ['A', 'B'],
            swap: true,
            rotateBy: [180],
        }] : [],
        solverOptions: {
            ...defaultSolverOptions,
            ignoredRatsnestSignals: [],
            localImproveIterations: 8,
            localImproveMinDelta: 0.001,
        },
    };
}

function component(
    designator: string,
    blockName: string,
    signal: string,
    componentFootprint: FootprintSpec,
    fixed = false,
): PcbComponent {
    return {
        designator,
        value: designator,
        pins: [{ pin_number: '1', name: '1', signal_name: signal }],
        block_name: blockName,
        search_query: '',
        part_uuid: blockName === 'pair' ? 'same-part' : null,
        footprint_uuid: null,
        footprint: componentFootprint,
        pcb: {
            role: 'passive',
            allowedLayers: ['top'],
            allowedRotations: [0, 180],
            ...(fixed ? { fixedPlacement: {} } : {}),
        },
    };
}

function footprint(name: string, width: number, height: number, padX: number): FootprintSpec {
    return {
        name,
        width,
        height,
        pads: [{ pin_number: '1', name: '1', x: padX, y: 0, width: 0.25, height: 0.25 }],
    };
}

function block(name: string, componentDesignators: string[]): PlacementInput['blocks'][number] {
    return { name, description: name, component_designators: componentDesignators, role: 'generic' };
}

function pairPlacements(): Placement[] {
    return [pose('A', -5, 0), pose('B', 5, 0), pose('LEFT', -9, 0), pose('RIGHT', 9, 0)];
}

function pose(designator: string, x: number, y: number): Placement {
    return { designator, x, y, rotate: 0, layer: 'top', score: 0 };
}

function placement(placements: Placement[], designator: string) {
    const result = placements.find((item) => item.designator === designator);
    assert.ok(result, `${designator} must be placed`);
    return result;
}

function componentByDesignator(input: PlacementInput, designator: string) {
    const result = input.components.find((component) => component.designator === designator);
    assert.ok(result, `${designator} must exist`);
    return result;
}
