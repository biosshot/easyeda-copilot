import assert from 'node:assert/strict';
import test from 'node:test';
import { createPcbLayout } from '../src/pcb-layout/pcb-auto-place/layout.ts';
import { createBoardAssemble } from '../src/pcb-layout/board-assemble.ts';
import { runPcbLayoutDsl } from '../src/pcb-layout/pcb-layout-dsl/spec.ts';
import { buildPlacementInput } from '../src/pcb-layout/placement-input.ts';
import { BoardAssembleSchema } from '../src/types/pcb/board-assemble.ts';
import type { ExplainCircuit } from '../src/types/circuit.ts';

const circuit: ExplainCircuit = {
    components: [{
        designator: 'U1',
        value: 'RF IC',
        pins: [
            { pin_number: 'EP', name: 'EP', signal_name: 'GND' },
            { pin_number: 'RF', name: 'RF', signal_name: 'RF_ANT' },
            { pin_number: 'CFG', name: 'CFG', signal_name: 'CFG' },
        ],
        part_uuid: null,
        footprint_name: null,
    }],
};

test('compiles jumper and conditional thermal spreading before placement without changing BoardAssemble', async () => {
    const rules = runPcbLayoutDsl(`
        board.rect(60, 30, { layers: ["top", "bottom"] });
        block("core", ["U1"], "main_ic");
        component("U1").block("core").top().rotations([0]);

        solderJumper("SJ1", {
            nets: ["CFG", "GND"],
            usage: "configuration",
            block: "configuration"
        });
        primitive.thermalPad("U1_THERMAL", {
            at: pin("U1", "EP"),
            power: { dissipation: 2.4, maxTemperatureRise: 30 },
            thetaJC: 10,
            limits: { maxSize: { width: 8, height: 8 } }
        });
    `);
    const targetRule = rules.component_rules.find((rule) => rule.designator === 'U1');
    assert.ok(targetRule);
    targetRule.footprint = {
        name: 'QFN_EP_TEST',
        width: 6,
        height: 6,
        pads: [
            { pin_number: 'EP', name: 'EP', x: 0, y: 0, width: 3, height: 3, shape: 'rect', mount: 'smd' },
            { pin_number: 'RF', name: 'RF', x: 2.5, y: 0, width: 0.6, height: 1, shape: 'rect', mount: 'smd' },
            { pin_number: 'CFG', name: 'CFG', x: -2.5, y: 0, width: 0.6, height: 1, shape: 'rect', mount: 'smd' },
        ],
    };

    const input = await buildPlacementInput(circuit, rules);
    const u1 = input.components.find((component) => component.designator === 'U1');
    const jumper = input.components.find((component) => component.designator === 'SJ1');
    assert.ok(u1 && jumper);

    const thermalPads = u1.footprint.pads.filter((pad) => String(pad.pin_number).startsWith('__U1_THERMAL_V'));
    assert.equal(thermalPads.length, 9);
    assert.equal(u1.pins.filter((pin) => String(pin.pin_number).startsWith('__U1_THERMAL_V')).every((pin) => pin.signal_name === 'GND'), true);
    for (const pad of thermalPads) {
        const annularRadiusWithMargin = pad.width / 2 + 0.08;
        assert.ok(Math.abs(pad.x) + annularRadiusWithMargin <= 1.5);
        assert.ok(Math.abs(pad.y) + annularRadiusWithMargin <= 1.5);
        assert.equal(pad.mount, 'through_hole');
        assert.equal(pad.drillDiameter, 0.3);
    }
    assert.ok(u1.footprint.width > 6);
    assert.ok(u1.footprint.height > 6);
    assert.equal(jumper.syntheticBoardPad, undefined);
    assert.equal(jumper.pcb.syntheticFootprint?.kind, 'solder_jumper');
    assert.equal(jumper.footprint.pads.length, 2);
    assert.equal(u1.pcb.generatedGeometry?.[0]?.polygons.length, 1);
    assert.equal(u1.pcb.generatedGeometry?.[0]?.polygons[0]?.layer, 'opposite');
    assert.match(u1.pcb.generatedGeometry?.[0]?.diagnostics?.join('\n') ?? '', /thetaJC 10C\/W \(DSL\)/);

    const placements = [
        { designator: 'U1', x: 0, y: 0, rotate: 0, layer: 'top' as const, score: 0 },
        { designator: 'SJ1', x: -12, y: 7, rotate: 0, layer: 'top' as const, score: 0 },
    ];
    const layout = createPcbLayout(input, placements);
    const assemble = createBoardAssemble(layout);

    assert.doesNotThrow(() => BoardAssembleSchema().parse(assemble));
    assert.deepEqual(assemble.components?.map((component) => component.designator), ['U1']);
    assert.equal(assemble.pads?.filter((pad) => pad.name.startsWith('SJ1.')).length, 2);
    assert.equal(assemble.vias?.filter((via) => via.net === 'GND').length, 9);
    assert.equal(assemble.polygons?.filter((polygon) => polygon.net === 'GND' && polygon.layer === 'bottom').length, 1);
    assert.equal('proceduralFeatures' in assemble, false);
    assert.equal('routingKeepouts' in assemble, false);
});

test('omits extended bottom polygon when the via array meets the thermal budget', async () => {
    const rules = runPcbLayoutDsl(`
        board.rect(20, 20);
        component("U1").top();
        primitive.thermalPad("U1_THERMAL", {
            at: pin("U1", "EP"),
            power: { dissipation: 0.1, maxTemperatureRise: 30 },
            thetaJC: 5,
            limits: { maxSize: { width: 8, height: 8 } }
        });
    `);
    const targetRule = rules.component_rules.find((rule) => rule.designator === 'U1');
    assert.ok(targetRule);
    targetRule.footprint = {
        name: 'QFN_EP_TEST', width: 6, height: 6,
        pads: [{ pin_number: 'EP', name: 'EP', x: 0, y: 0, width: 3, height: 3, shape: 'rect', mount: 'smd' }],
    };

    const input = await buildPlacementInput(circuit, rules);
    const u1 = input.components.find((component) => component.designator === 'U1');
    assert.ok(u1);
    assert.equal(u1.pcb.generatedGeometry?.[0]?.vias.length, 1);
    assert.equal(u1.pcb.generatedGeometry?.[0]?.polygons.length, 0);
    assert.match(u1.pcb.generatedGeometry?.[0]?.diagnostics?.join('\n') ?? '', /no extended opposite-layer polygon generated/);
});

test('does not expose jumper assembled state or the experimental antenna compiler in DSL', () => {
    assert.throws(() => runPcbLayoutDsl(`
        board.rect(20, 20);
        solderJumper("SJ1", { nets: ["A", "B"], default: "closed" });
    `), /unknown key 'default'/);

    assert.throws(() => runPcbLayoutDsl(`
        board.rect(20, 20);
        primitive.antenna("ANT1", {
            net: "RF",
            performance: { centerFrequency: 2.45e9 }
        });
    `), /antenna.*not a function/);
});
