import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveConstraintRegions } from '../src/pcb-layout/placement-input.ts';
import { runPcbLayoutDsl } from '../src/pcb-layout/pcb-layout-dsl/spec.ts';
import { createPlacementReport } from './fixtures/auto-place.ts';
import type { PlacementInput } from '../src/types/pcb/layout-model.ts';

const footprint = {
    name: 'TEST',
    width: 1,
    height: 1,
    pads: [{ pin_number: '1', name: '1', x: 0, y: 0, width: 0.5, height: 0.5 }],
};

const board: PlacementInput['board'] = {
    coordinateSystem: 'centered',
    outline: { type: 'rect', width: 16, height: 20 },
    defaultLayer: 'top',
    allowedLayers: ['top', 'bottom'],
    clearances: { component: 0, edge: 0 },
};

test('normalizes mm constraint regions into board-space boxes', async () => {
    const rules = runPcbLayoutDsl(`
        board.rect(16, 20, { layers: ["top", "bottom"] });
        constraintRegion("antenna_clearance", {
            shape: region.rect({ anchor: anchor("board.top"), width: 16, height: 5 }),
            allow: { blocks: ["antenna"] }
        });
    `);

    const constraintRegions = resolveConstraintRegions(rules.constraintRegions, board);

    assert.deepEqual(constraintRegions, [{
        name: 'antenna_clearance',
        box: { left: -8, right: 8, top: -10, bottom: -5 },
        layers: ['top', 'bottom'],
        allowBlocks: ['antenna'],
    }]);
});

test('reports components placed inside forbidden constraint regions', async () => {
    const rules = runPcbLayoutDsl(`
        board.rect(16, 20, { layers: ["top", "bottom"] });
        constraintRegion("antenna_clearance", {
            shape: region.rect({ anchor: anchor("board.top"), width: 16, height: 5 }),
            allow: { blocks: ["antenna"] }
        });
    `);
    const input: PlacementInput = {
        board,
        boardHoles: [],
        constraintRegions: resolveConstraintRegions(rules.constraintRegions, board),
        blocks: [
            { name: 'antenna', description: 'antenna', component_designators: ['ANT1'], role: 'rf' },
            { name: 'mcu', description: 'mcu', component_designators: ['U1'], role: 'mcu' },
        ],
        modules: [],
        hints: [],
        solverOptions: {
            candidateRadii: [],
            candidateAngles: [],
            fallbackGridStep: 1,
            placementGridStep: 1,
            ignoredRatsnestSignals: [],
            localImproveIterations: 0,
            localImproveMinDelta: 0,
            hierarchicalBlocks: true,
        },
        components: [
            {
                designator: 'ANT1',
                value: 'ANT',
                pins: [{ pin_number: '1', name: '1', signal_name: 'ANT' }],
                block_name: 'antenna',
                search_query: '',
                part_uuid: null,
                footprint,
                pcb: { role: 'connector', allowedLayers: ['top'], allowedRotations: [0] },
            },
            {
                designator: 'U1',
                value: 'IC',
                pins: [{ pin_number: '1', name: '1', signal_name: 'ANT' }],
                block_name: 'mcu',
                search_query: '',
                part_uuid: null,
                footprint,
                pcb: { role: 'main_ic', allowedLayers: ['top'], allowedRotations: [0] },
            },
        ],
    };
    const report = createPlacementReport(input, [
        { designator: 'ANT1', x: 0, y: -7, rotate: 0, layer: 'top', score: 0 },
        { designator: 'U1', x: 0, y: -7, rotate: 0, layer: 'top', score: 0 },
    ]);

    assert.equal(report.ok, false);
    assert.deepEqual(report.constraintRegionViolations, [{
        designator: 'U1',
        region: 'antenna_clearance',
        block: 'mcu',
        overlap: 2.5,
    }]);
});
