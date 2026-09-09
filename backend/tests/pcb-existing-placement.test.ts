import assert from 'node:assert/strict';
import test from 'node:test';
import { applyExistingBoard, applyExistingComponentPlacements, ensurePreservedComponentBlocks, resolvePreservedComponentDesignators } from '../src/pcb-layout/existing-placement.ts';
import { runPcbLayoutDsl } from '../src/pcb-layout/pcb-layout-dsl/spec.ts';
import { createPlacementReport } from './fixtures/auto-place.ts';
import { centeredBoard, defaultSolverOptions } from '../src/pcb-layout/pcb-auto-place/utils.ts';
import { validatePlacementRulesForCircuit } from '../src/pcb-layout/placement-input.ts';
import type { ExplainCircuit } from '../src/types/circuit.ts';
import type { ExistingPlacement, PcbComponent, PlacementInput } from '../src/types/pcb/layout-model.ts';

const existingPlacement: ExistingPlacement = {
    board: {
        polygon: [
            { x: -5, y: -5 },
            { x: 5, y: -5 },
            { x: 5, y: 5 },
            { x: -5, y: 5 },
        ],
    },
    components: [
        { designator: 'U1', x: 0, y: 0, rotate: 90, layer: 'bottom' },
        { designator: 'C1', x: 5, y: 0, rotate: 180, layer: 'top' },
        { designator: 'R1', x: 6, y: 0, rotate: 270, layer: 'top' },
    ],
};

test('parses preserve DSL', () => {
    const rules = runPcbLayoutDsl('preserve({ board: true, components: "all" });');
    assert.deepEqual(rules.preserve, { board: true, components: 'all' });
});

test('uses the existing board polygon when requested', () => {
    const rules = runPcbLayoutDsl(`
        board.rect(20, 10, { clearance: 0.8, edge: 1.2 });
        preserve({ board: true });
    `);
    const applied = applyExistingBoard(rules, existingPlacement);

    assert.equal(applied.board.type, 'polygon');
    assert.deepEqual('points' in applied.board ? applied.board.points : null, existingPlacement.board?.polygon);
    assert.equal(applied.board.componentClearance, 0.8);
    assert.equal(applied.board.edgeClearance, 1.2);
});

test('components all preserves only centers inside the existing board polygon', () => {
    const input = placementInput(['U1', 'C1', 'R1']);
    const applied = applyExistingComponentPlacements(
        input,
        { components: 'all' },
        existingPlacement,
    );

    assert.deepEqual(applied.components.find((component) => component.designator === 'U1')?.pcb.fixedPlacement, {
        x: 0,
        y: 0,
        rotate: 90,
        layer: 'bottom',
    });
    assert.deepEqual(applied.components.find((component) => component.designator === 'C1')?.pcb.fixedPlacement, {
        x: 5,
        y: 0,
        rotate: 180,
        layer: 'top',
    });
    assert.equal(applied.components.find((component) => component.designator === 'R1')?.pcb.fixedPlacement, undefined);
    assert.deepEqual(applied.board.allowedLayers, ['top', 'bottom']);
});

test('an explicit preserve list may select a component outside the board', () => {
    const applied = applyExistingComponentPlacements(
        placementInput(['R1']),
        { components: ['R1'] },
        existingPlacement,
    );

    assert.deepEqual(applied.components[0].pcb.fixedPlacement, {
        x: 6,
        y: 0,
        rotate: 270,
        layer: 'top',
    });
});

test('components all requires an existing board polygon', () => {
    assert.throws(
        () => applyExistingComponentPlacements(
            placementInput(['U1']),
            { components: 'all' },
            { components: existingPlacement.components },
        ),
        /requires existingPlacement\.board/,
    );
});

test('resolves only existing components for partial assembly', () => {
    assert.deepEqual(
        [...resolvePreservedComponentDesignators({ components: ['C1', 'MISSING'] }, existingPlacement)],
        ['C1'],
    );
});

test('converts a preserved source origin to the footprint body center', () => {
    const input = placementInput(['U1']);
    input.components[0].footprint.sourceOriginOffset = { x: 1, y: 2 };
    const applied = applyExistingComponentPlacements(
        input,
        { components: ['U1'] },
        { components: [{ designator: 'U1', x: 10, y: 20, rotate: 90, layer: 'top' }] },
    );

    assert.deepEqual(applied.components[0].pcb.fixedPlacement, {
        x: 12,
        y: 19,
        rotate: 90,
        layer: 'top',
    });
});

test('placement report includes fixed-to-fixed and movable-to-fixed overlaps', () => {
    const input = placementInput(['U1', 'C1', 'R1']);
    const applied = applyExistingComponentPlacements(
        input,
        { components: ['U1', 'C1'] },
        {
            components: [
                { designator: 'U1', x: 0, y: 0, rotate: 0, layer: 'top' },
                { designator: 'C1', x: 0, y: 0, rotate: 0, layer: 'top' },
            ],
        },
    );
    const report = createPlacementReport(applied, [
        { designator: 'U1', x: 0, y: 0, rotate: 0, layer: 'top', score: 0 },
        { designator: 'C1', x: 0, y: 0, rotate: 0, layer: 'top', score: 0 },
        { designator: 'R1', x: 0.6, y: 0, rotate: 0, layer: 'top', score: 0 },
    ]);

    assert.equal(report.ok, false);
    assert.deepEqual(report.overlaps.map(({ a, b }) => [a, b]), [
        ['U1', 'C1'],
        ['U1', 'R1'],
        ['C1', 'R1'],
    ]);
});

test('placement report ignores outside-board errors for fixed components', () => {
    const applied = applyExistingComponentPlacements(
        placementInput(['C1']),
        { components: ['C1'] },
        { components: [{ designator: 'C1', x: 6, y: 0, rotate: 0, layer: 'top' }] },
    );
    const report = createPlacementReport(applied, [
        { designator: 'C1', x: 6, y: 0, rotate: 0, layer: 'top', score: 0 },
    ]);

    assert.equal(report.ok, true);
    assert.deepEqual(report.outsideBoard, []);
});

test('uses compact placement clearance defaults', () => {
    assert.deepEqual(centeredBoard(10, 10).clearances, { component: 0.35, edge: 0.8 });
});

test('adds system block ownership only for unowned preserved components', () => {
    const rules = runPcbLayoutDsl(`
        block("existing", ["C1", "R1"], "generic", { allowDisconnected: true });
        preserve({ board: true, components: "all" });
    `);
    const applied = ensurePreservedComponentBlocks(circuit(['U1', 'C1', 'R1']), rules, existingPlacement);
    const systemBlocks = applied.blocks.filter((block) => block.name.startsWith('__preserved_'));

    assert.deepEqual(systemBlocks.map((block) => block.component_designators), [['U1']]);
    assert.ok(systemBlocks.every((block) => block.allowDisconnected === true));
    assert.doesNotThrow(() => validatePlacementRulesForCircuit(circuit(['U1', 'C1', 'R1']), applied));
});

function placementInput(designators: string[]): PlacementInput {
    return {
        board: centeredBoard(10, 10),
        boardHoles: [],
        constraintRegions: [],
        silkscreen: { designators: {} },
        blocks: [{
            name: 'main',
            description: 'main',
            component_designators: designators,
            role: 'generic',
        }],
        modules: [],
        components: designators.map(component),
        hints: [],
        solverOptions: { ...defaultSolverOptions },
    };
}

function component(designator: string): PcbComponent {
    return {
        designator,
        value: designator,
        pins: [],
        block_name: 'main',
        search_query: designator,
        part_uuid: null,
        footprint: {
            name: designator,
            width: 1,
            height: 1,
            pads: [],
        },
        pcb: {
            role: 'passive',
            allowedLayers: ['top'],
            allowedRotations: [0, 90, 180, 270],
        },
    };
}

function circuit(designators: string[]): ExplainCircuit {
    return {
        components: designators.map((designator) => ({
            designator,
            value: designator,
            pins: [],
            part_uuid: null,
            footprint_name: designator,
            footprint_uuid: null,
            block_name: null,
        })),
    };
}
