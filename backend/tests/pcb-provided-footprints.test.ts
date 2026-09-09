import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlacementInput } from '../src/pcb-layout/placement-input.ts';
import { runPcbLayoutDsl } from '../src/pcb-layout/pcb-layout-dsl/spec.ts';
import { FootprintSpecSchema, type FootprintSpec } from '../src/types/pcb/layout-model.ts';
import type { ExplainCircuit } from '../src/types/circuit.ts';

const footprintByPart: FootprintSpec = {
    name: 'PART_FOOTPRINT',
    width: 2,
    height: 1,
    pads: [{ pin_number: '1', x: 0, y: 0, width: 0.5, height: 0.5 }],
};

const footprintByUuid: FootprintSpec = {
    name: 'UUID_FOOTPRINT',
    width: 3,
    height: 2,
    pads: [{ pin_number: '1', x: 0.25, y: 0, width: 0.6, height: 0.6 }],
    sourceOriginOffset: { x: -0.25, y: 0 },
};

test('provided footprint_uuid wins over provided part_uuid before EasyEDA resolution', async () => {
    const circuit: ExplainCircuit = {
        components: [{
            designator: 'U1',
            value: 'LOCAL',
            pins: [{ pin_number: '1', name: '1', signal_name: 'GND' }],
            part_uuid: '11111111111111111111111111111111',
            footprint_uuid: 'kicad-footprint-instance',
            footprint_name: 'Local:Package',
        }],
    };
    const rules = runPcbLayoutDsl('board.rect(20, 10);');

    const input = await buildPlacementInput(circuit, rules, {
        [circuit.components[0].part_uuid!]: footprintByPart,
        [circuit.components[0].footprint_uuid!]: footprintByUuid,
    });

    assert.deepEqual(input.components[0].footprint, footprintByUuid);
});

test('provided part_uuid is used when footprint_uuid is absent', async () => {
    const circuit: ExplainCircuit = {
        components: [{
            designator: 'U1',
            value: 'LOCAL',
            pins: [{ pin_number: '1', name: '1', signal_name: 'GND' }],
            part_uuid: '22222222222222222222222222222222',
            footprint_uuid: null,
            footprint_name: 'Local:Package',
        }],
    };
    const rules = runPcbLayoutDsl('board.rect(20, 10);');

    const input = await buildPlacementInput(circuit, rules, {
        [circuit.components[0].part_uuid!]: footprintByPart,
    });

    assert.deepEqual(input.components[0].footprint, footprintByPart);
});

test('MCP footprint schema preserves the full internal footprint format', () => {
    const parsed = FootprintSpecSchema().parse({
        ...footprintByUuid,
        graphics: [{
            kind: 'path',
            layer: 'body',
            points: [{ x: -1, y: -1 }, { x: 1, y: 1 }],
            closed: false,
            strokeWidth: 0.1,
        }],
    });

    assert.deepEqual(parsed.sourceOriginOffset, footprintByUuid.sourceOriginOffset);
    assert.equal(parsed.graphics?.[0]?.kind, 'path');
});
