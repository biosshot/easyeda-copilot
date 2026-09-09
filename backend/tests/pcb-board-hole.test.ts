import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlacementInput } from '../src/pcb-layout/placement-input.ts';
import { runPcbLayoutDsl } from '../src/pcb-layout/pcb-layout-dsl/spec.ts';
import { createPlacementReport } from './fixtures/auto-place.ts';
import type { ExplainCircuit } from '../src/types/circuit.ts';
import type { PlacementRules } from '../src/types/pcb/layout-rules.ts';

const circuit: ExplainCircuit = {
    components: [{
        designator: 'C1',
        value: '100nF',
        pins: [{ pin_number: '1', name: '1', signal_name: 'VCC' }],
        part_uuid: null,
        footprint_name: null,
    }],
};

const testFootprint = {
    name: 'C_TEST',
    width: 1,
    height: 1,
    pads: [{ pin_number: '1', name: '1', x: 0, y: 0, width: 0.5, height: 0.5 }],
};

function withTestFootprint(rules: PlacementRules) {
    rules.component_rules.push({
        designator: 'C1',
        block_name: null,
        role: null,
        footprint: testFootprint,
        allowedLayers: null,
        allowedRotations: null,
        fixedPlacement: null,
        boardOverflow: null,
        edgeMount: null,
        mechanicalFaceAt0: null,
        faceTo: null,
        designatorText: null,
    });
    return rules;
}

test.describe('PCB boardHole DSL', () => {
    test('resolves corner holes before placement input is built', async () => {
        const rules = withTestFootprint(runPcbLayoutDsl(`
            board.rect(20, 10, { clearance: 0.5 });
            boardHole.corners({ inset: 2, drill: 3.2, keepout: 4 });
        `));

        const input = await buildPlacementInput(circuit, rules);

        assert.deepEqual(input.boardHoles, [
            { name: 'MH1', x: -8, y: -3, drill: 3.2, diameter: 3.2, keepout: 4 },
            { name: 'MH2', x: 8, y: -3, drill: 3.2, diameter: 3.2, keepout: 4 },
            { name: 'MH3', x: 8, y: 3, drill: 3.2, diameter: 3.2, keepout: 4 },
            { name: 'MH4', x: -8, y: 3, drill: 3.2, diameter: 3.2, keepout: 4 },
        ]);
    });

    test('reports components placed inside board hole keepout', async () => {
        const rules = withTestFootprint(runPcbLayoutDsl(`
            board.rect(20, 10, { clearance: 0.5 });
            boardHole("MH1", { at: anchor("board.center"), drill: 3.2, keepout: 4 });
        `));
        const input = await buildPlacementInput(circuit, rules);

        const report = createPlacementReport(input, [{ designator: 'C1', x: 0, y: 0, rotate: 0, layer: 'top', score: 0 }]);

        assert.equal(report.ok, false);
        assert.deepEqual(report.boardHoleViolations, [{ designator: 'C1', hole: 'MH1', gap: 0, required: 4.5 }]);
    });

    test('resolves corner holes from real chamfered outline', async () => {
        const rules = withTestFootprint(runPcbLayoutDsl(`
            board.chamferedRect(20, 10, { chamfer: 4, clearance: 0.5 });
            boardHole.corners({ inset: 1, drill: 2, keepout: 3 });
        `));

        const input = await buildPlacementInput(circuit, rules);

        assert.equal(input.board.outline.type, 'polygon');
        assert.equal(input.boardHoles.length, 4);
        assert.ok(input.boardHoles[0].x > -8);
        assert.ok(input.boardHoles[0].y > -4);
        assert.ok(input.boardHoles[1].x < 8);
        assert.ok(input.boardHoles[1].y > -4);
    });
});
