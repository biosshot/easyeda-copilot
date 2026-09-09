import assert from 'node:assert/strict';
import test from 'node:test';
import { autoPlacePcbWithReport, createPlacementReport, renderPlacementSvg } from './fixtures/auto-place.ts';
import { expandHints } from '../src/pcb-layout/pcb-auto-place/hints.ts';
import { buildPlacementGraph } from '../src/pcb-layout/pcb-auto-place/placement-graph.ts';
import { evaluateSignalPathTopology, signalPathBridgeDeltas } from '../src/pcb-layout/pcb-auto-place-v2/path-score.ts';
import type { PlacementPrimitive } from '../src/pcb-layout/pcb-auto-place-v2/primitives.ts';
import { runPcbLayoutDsl } from '../src/pcb-layout/pcb-layout-dsl/spec.ts';
import { buildPlacementInput, validatePlacementRulesForCircuit } from '../src/pcb-layout/placement-input.ts';
import type { ExplainCircuit } from '../src/types/circuit.ts';
import type { FootprintSpec, PlacementInput, PlacementRelation } from '../src/types/pcb/layout-model.ts';

test.describe('ordered signal-path placement', () => {
    test('compiles the DSL with existing pin aliases and per-segment overrides', () => {
        const rules = runPcbLayoutDsl(`
            signalPath("rf_main", [
                [pin("J1", "5"), pin("C1", "1"), { maxDistance: 18 }],
                [pin("C1", "2"), pin("U1", "1"), { maxDistance: 3, hard: true }],
                [pin("U1", "3"), pin("J2", "5")],
            ], { priority: "critical", shape: "straight", preferFacingPads: true, maxDistance: 20 });
        `);

        assert.equal(rules.paths.length, 1);
        assert.equal(rules.paths[0].id, 'rf_main');
        assert.equal(rules.paths[0].shape, 'straight');
        assert.deepEqual(Array.from(rules.paths[0].segments, (segment) => segment.maxDistance), [18, 3, 20]);
        assert.equal(rules.paths[0].segments[1].hard, true);
        assert.equal(rules.hints.length, 0, 'path expands into compatibility hints only after normalization');
    });

    test('rejects a path whose pad-to-pad segment does not follow one schematic net', () => {
        const circuit = pathCircuit();
        const rules = runPcbLayoutDsl(`${baseDsl()}
            signalPath("broken", [
                [pin("IN1", "2"), pin("C1", "2")],
            ]);
        `);

        assert.throws(
            () => validatePlacementRulesForCircuit(circuit, rules),
            /IN1\.2 is net "RF_IN", but C1\.2 is net "RF_A"/,
        );
    });

    test('normalizes path segments into scoped compatibility relations without creating an island', async () => {
        const circuit = pathCircuit();
        const rules = pathRules();
        validatePlacementRulesForCircuit(circuit, rules);
        const input = await buildPlacementInput(circuit, rules, footprintMap(circuit));
        const graph = buildPlacementGraph(input);
        const pathRelations = graph.relations.filter((relation) => relation.data?.pathId === 'rf_main');

        assert.equal(input.paths?.length, 1);
        assert.equal(pathRelations.length, 4);
        assert.equal(graph.report.islandKinds.line ?? 0, 0);
        assert.ok(pathRelations.some((relation) => relation.scope === 'tree:block:rf_core'));
        assert.ok(pathRelations.some((relation) => relation.scope === 'board'));
        assert.deepEqual(pathRelations.map((relation) => relation.data?.pathSegmentIndex), [0, 1, 2, 3]);
    });

    test('keeps omitted path limits soft and unbounded without changing criticalPair defaults', async () => {
        const circuit = pathCircuit();
        const rules = runPcbLayoutDsl(`${baseDsl()}
            signalPath("soft_path", [
                [pin("IN1", "2"), pin("C1", "1")],
                [pin("C1", "2"), pin("U1", "1")],
            ], { priority: "critical" });
            criticalPair(pin("U1", "3"), pin("C2", "1"));
        `);
        validatePlacementRulesForCircuit(circuit, rules);
        const input = await buildPlacementInput(circuit, rules, footprintMap(circuit));
        const expanded = expandHints(input);
        const pathRules = expanded.filter((rule) => rule.source.type === 'pin' && ['IN1', 'C1'].includes(rule.source.designator));
        const regularPair = expanded.find((rule) => rule.source.type === 'pin' && rule.source.designator === 'U1');

        assert.equal(pathRules.length, 2);
        assert.ok(pathRules.every((rule) => rule.max === undefined && rule.hard === false));
        assert.equal(regularPair?.max, 3);
        assert.equal(regularPair?.hard, true);
    });

    test('scores a straight ordered path below a folded/backtracking path', () => {
        const straight = pathPrimitive('straight', [
            [0, 0], [2, 0], [3, 0], [5, 0], [6, 0], [8, 0],
        ]);
        const folded = pathPrimitive('folded', [
            [0, 0], [2, 0], [2, 4], [5, 4], [5, 0], [8, 0],
        ]);
        const relation = pathRelation();
        const straightScore = evaluateSignalPathTopology([straight], [relation])[0];
        const foldedScore = evaluateSignalPathTopology([folded], [relation])[0];

        assert.ok(straightScore);
        assert.ok(foldedScore);
        assert.equal(straightScore.detour, 0);
        assert.equal(straightScore.backtrack, 0);
        assert.ok(foldedScore.penalty > straightScore.penalty + 100);
        assert.ok(foldedScore.turns > straightScore.turns);
    });

    test('generates a bridge candidate for a movable stage between two placed endpoints', () => {
        const moving = pathPrimitive('moving', [[0, 5], [2, 5]], 2);
        const before = pathPrimitive('before', [[-8, 0]], 0);
        const after = pathPrimitive('after', [[8, 0]], 4);
        const deltas = signalPathBridgeDeltas(moving, [before, after]);

        assert.ok(deltas.some((delta) => Math.abs(delta.y + 5) < 0.001), JSON.stringify(deltas));
    });

    test('places a cross-block RF-style path through movable pass-through components', async () => {
        const circuit = pathCircuit();
        const rules = pathRules();
        validatePlacementRulesForCircuit(circuit, rules);
        const input = await buildPlacementInput(circuit, rules, footprintMap(circuit));
        const result = autoPlacePcbWithReport(input);
        const path = result.report.signalPaths[0];

        assert.equal(result.report.ok, true);
        assert.equal(path.resolved, true);
        assert.equal(path.withinConstraints, true);
        assert.ok(path.detour !== null && path.detour <= 2.5, `unexpected path detour: ${JSON.stringify(path)}`);
        assert.ok(path.backtrack !== null && path.backtrack <= 0.5, `unexpected path backtrack: ${JSON.stringify(path)}`);
        assert.ok(path.turns !== null && path.turns <= 1.1, `unexpected path turns: ${JSON.stringify(path)}`);
        assert.ok(result.placements.every((placement) => placement.designator !== 'IN1' || placement.x !== -15), 'input endpoint must remain solver-movable');
        assert.match(renderPlacementSvg(input, result.placements), /data-signal-path="rf_main"/);

        const baselineInput: PlacementInput = { ...input, paths: [], hints: input.hints.filter((hint) => hint.relation !== 'critical_pair') };
        const baseline = autoPlacePcbWithReport(baselineInput);
        const baselinePath = createPlacementReport(input, baseline.placements).signalPaths[0];
        assert.ok(
            path.detour! + path.backtrack! <= baselinePath.detour! + baselinePath.backtrack!,
            `path-aware placement should be no worse than unconstrained packing: path=${JSON.stringify(path)} baseline=${JSON.stringify(baselinePath)}`,
        );
    });

    test('regression: band_v3_easyeda RF chain is placed as one through path', async () => {
        const circuit = bandV3Circuit();
        const rules = runPcbLayoutDsl(`
            board.roundedRect(42, 26, { radius: 2, segments: 10, layers: ["top"], defaultLayer: "top", clearance: 0.35, edge: 0.5 });
            boardHole.corners({ drill: 3, diameter: 3, keepout: 2.3, inset: 3.5, prefix: "MH" });
            block("rf_input_connector", ["J1"], "connector");
            block("rf_core", ["C1", "U1", "C2"], "rf");
            block("rf_output_connector", ["J2"], "connector");
            block("power_entry", ["J3", "C3"], "power");
            block("bias_feed", ["R1"], "power", null, { placement: "satellite", attachTo: "rf_core", anchor: pin("U1", "3") });
            component("J1").block("rf_input_connector").role("connector").top().edgeMount("left", { overhang: 6.5, align: "center", face: "outward", layer: "top" });
            component("J2").block("rf_output_connector").role("connector").top().edgeMount("right", { overhang: 6.5, align: "center", face: "outward", layer: "top" });
            component("J3").block("power_entry").role("connector").top().edgePlace("top", { inset: 0.5, align: "center", x: 0, face: "outward", layer: "top" });
            component("C1").block("rf_core").role("passive").top();
            component("U1").block("rf_core").role("main_ic").top();
            component("C2").block("rf_core").role("passive").top();
            component("C3").block("power_entry").role("decoupling_cap").top();
            component("R1").block("bias_feed").role("passive").top();
            signalPath("rf_main", [
                [pin("J1", "5"), pin("C1", "1"), { maxDistance: 19 }],
                [pin("C1", "2"), pin("U1", "1"), { maxDistance: 4, hard: true }],
                [pin("U1", "3"), pin("C2", "1"), { maxDistance: 4, hard: true }],
                [pin("C2", "2"), pin("J2", "5"), { maxDistance: 19 }],
            ], { priority: "critical", shape: "straight", preferFacingPads: true });
            criticalPair(pin("R1", "2"), pin("U1", "3"), { maxDistance: 4.5, preferFacingPads: true });
            criticalPair(pin("C3", "1"), pin("J3", "1"), { maxDistance: 4.5, preferFacingPads: true });
            near(comp("U1"), anchor("board.center"), "critical");
            solver({ grid: 0.5, ignoredSignals: ["GND"], compactness: "normal" });
        `);
        validatePlacementRulesForCircuit(circuit, rules);
        const input = await buildPlacementInput(circuit, rules, bandV3Footprints());
        const result = autoPlacePcbWithReport(input);
        const path = result.report.signalPaths[0];
        const u1 = result.placements.find((placement) => placement.designator === 'U1');
        const treeStage = result.stages.find((stage) => stage.name === '01-v2-tree');

        assert.equal(result.report.ok, true, JSON.stringify(result.report));
        assert.equal(path.resolved, true);
        assert.equal(path.withinConstraints, true, JSON.stringify(path));
        assert.ok(path.detour !== null && path.detour <= 3.5, JSON.stringify(path));
        assert.ok(path.backtrack !== null && path.backtrack <= 0.5, JSON.stringify(path));
        assert.ok(u1 && (u1.rotate === 90 || u1.rotate === 270), `MMIC should turn its input/output axis into the board RF axis: ${JSON.stringify(u1)}`);
        for (const designator of ['J1', 'J2']) {
            const solved = treeStage?.placements.find((placement) => placement.designator === designator);
            const final = result.placements.find((placement) => placement.designator === designator);
            assert.deepEqual(
                solved && final ? { x: solved.x, y: solved.y, rotate: solved.rotate } : solved,
                final ? { x: final.x, y: final.y, rotate: final.rotate } : final,
                `${designator} locked edgeMount placement must not move during board packing`,
            );
        }
    });
});

function pathRules() {
    return runPcbLayoutDsl(`${baseDsl()}
        signalPath("rf_main", [
            [pin("IN1", "2"), pin("C1", "1"), { maxDistance: 15 }],
            [pin("C1", "2"), pin("U1", "1"), { maxDistance: 4, hard: true }],
            [pin("U1", "3"), pin("C2", "1"), { maxDistance: 4, hard: true }],
            [pin("C2", "2"), pin("OUT1", "1"), { maxDistance: 15 }],
        ], { priority: "critical", shape: "straight", preferFacingPads: true });
    `);
}

function baseDsl() {
    return `
        board.rect(34, 18, { layers: ["top"], clearance: 0.5, edge: 1 });
        block("rf_input", ["IN1"], "connector");
        block("rf_core", ["C1", "U1", "C2"], "rf");
        block("rf_output", ["OUT1"], "connector");
        component("IN1").block("rf_input").role("connector").top().rotations(0);
        component("C1").block("rf_core").role("passive").top().rotations(0);
        component("U1").block("rf_core").role("main_ic").top().rotations(0);
        component("C2").block("rf_core").role("passive").top().rotations(0);
        component("OUT1").block("rf_output").role("connector").top().rotations(0);
        solver({ grid: 0.5, compactness: "normal", ignoredSignals: ["GND"] });
    `;
}

function pathCircuit(): ExplainCircuit {
    return {
        components: [
            circuitComponent('IN1', [['1', 'GND'], ['2', 'RF_IN']], '11111111111111111111111111111111'),
            circuitComponent('C1', [['1', 'RF_IN'], ['2', 'RF_A']], '22222222222222222222222222222222'),
            circuitComponent('U1', [['1', 'RF_A'], ['2', 'GND'], ['3', 'RF_B']], '33333333333333333333333333333333'),
            circuitComponent('C2', [['1', 'RF_B'], ['2', 'RF_OUT']], '44444444444444444444444444444444'),
            circuitComponent('OUT1', [['1', 'RF_OUT'], ['2', 'GND']], '55555555555555555555555555555555'),
        ],
    };
}

function bandV3Circuit(): ExplainCircuit {
    return {
        components: [
            circuitComponent('J1', [['1', 'GND'], ['2', 'GND'], ['3', 'GND'], ['4', 'GND'], ['5', 'RF_IN']], 'ed0ea9dc1b9e4f50ac3b0fe1181da4c4'),
            circuitComponent('J2', [['1', 'GND'], ['2', 'GND'], ['3', 'GND'], ['4', 'GND'], ['5', 'RF_OUT']], 'ed0ea9dc1b9e4f50ac3b0fe1181da4c4'),
            circuitComponent('C1', [['1', 'RF_IN'], ['2', 'RF_IN_AC']], 'a299e4f29fd2469688f76621c3d59c4d'),
            circuitComponent('C2', [['1', 'RF_OUT_DC'], ['2', 'RF_OUT']], 'a299e4f29fd2469688f76621c3d59c4d'),
            circuitComponent('C3', [['1', 'VCC_IN'], ['2', 'GND']], 'a299e4f29fd2469688f76621c3d59c4d'),
            circuitComponent('U1', [['1', 'RF_IN_AC'], ['2', 'GND'], ['3', 'RF_OUT_DC'], ['4', 'GND']], '3ed9f1344dfe438096a79e58bb09afe7'),
            circuitComponent('J3', [['1', 'VCC_IN'], ['2', 'GND']], 'bccdb43f6d7441a596e3e499d83bc6ba'),
            circuitComponent('R1', [['2', 'RF_OUT_DC'], ['1', 'VCC_IN']], '8df3b005e2c84e13b1460bb194e5b25a'),
        ],
    };
}

function bandV3Footprints(): Record<string, FootprintSpec> {
    return {
        ed0ea9dc1b9e4f50ac3b0fe1181da4c4: {
            name: 'ANT-TH_KH-SMA-K513-G', width: 15.644, height: 7.888, sourceOriginOffset: { x: -3.878, y: 0 },
            pads: [
                { pin_number: '1', x: -1.338, y: -2.54, width: 2.3, height: 2.3, mount: 'through_hole', drillDiameter: 1.3 },
                { pin_number: '2', x: -1.338, y: 2.54, width: 2.3, height: 2.3, mount: 'through_hole', drillDiameter: 1.3 },
                { pin_number: '3', x: -6.418, y: 2.54, width: 2.3, height: 2.3, mount: 'through_hole', drillDiameter: 1.3 },
                { pin_number: '4', x: -6.418, y: -2.54, width: 2.3, height: 2.3, mount: 'through_hole', drillDiameter: 1.3 },
                { pin_number: '5', x: -3.878, y: 0, width: 2.3, height: 2.3, mount: 'through_hole', drillDiameter: 1.3 },
            ],
        },
        a299e4f29fd2469688f76621c3d59c4d: {
            name: 'C0603', width: 2.7799, height: 1.4201, sourceOriginOffset: { x: 0.0001, y: 0 },
            pads: [
                { pin_number: '2', x: -0.7, y: 0, width: 0.8, height: 0.9, mount: 'smd' },
                { pin_number: '1', x: 0.7001, y: 0, width: 0.8, height: 0.9, mount: 'smd' },
            ],
        },
        '3ed9f1344dfe438096a79e58bb09afe7': {
            name: 'SEMI-SMD_MAR-8ASM', width: 6.4782, height: 6.536, sourceOriginOffset: { x: 0, y: 0.029 },
            pads: [
                { pin_number: '4', x: 2.0701, y: 0.0008, width: 1.83, height: 1.02, mount: 'smd' },
                { pin_number: '2', x: -2.0701, y: 0.0008, width: 1.83, height: 1.02, mount: 'smd' },
                { pin_number: '3', x: 0, y: 2.099, width: 1.02, height: 1.83, mount: 'smd' },
                { pin_number: '1', x: -0.0005, y: -2.041, width: 1.0223, height: 1.8325, mount: 'smd' },
            ],
        },
        bccdb43f6d7441a596e3e499d83bc6ba: {
            name: 'CONN-TH_P3.50_KF350-3.5-2P', width: 7.9001, height: 6.9002, sourceOriginOffset: { x: 0, y: -0.0499 },
            pads: [
                { pin_number: '1', x: 1.7499, y: -0.0499, width: 2, height: 2, mount: 'through_hole', drillDiameter: 1 },
                { pin_number: '2', x: -1.75, y: -0.0499, width: 2, height: 2, mount: 'through_hole', drillDiameter: 1 },
            ],
        },
        '8df3b005e2c84e13b1460bb194e5b25a': {
            name: 'R0603', width: 2.8212, height: 1.372,
            pads: [
                { pin_number: '2', x: -0.7534, y: 0, width: 0.8065, height: 0.864, mount: 'smd' },
                { pin_number: '1', x: 0.7534, y: 0, width: 0.8065, height: 0.864, mount: 'smd' },
            ],
        },
    };
}

function circuitComponent(designator: string, pins: Array<[string, string]>, partUuid: string): ExplainCircuit['components'][number] {
    return {
        designator,
        value: designator,
        pins: pins.map(([pin_number, signal_name]) => ({ pin_number, name: pin_number, signal_name })),
        part_uuid: partUuid,
        footprint_uuid: null,
        footprint_name: designator,
    };
}

function footprintMap(circuit: ExplainCircuit) {
    return Object.fromEntries(circuit.components.map((component) => [
        component.part_uuid!,
        component.designator === 'U1' ? icFootprint() : twoPinFootprint(component.designator),
    ]));
}

function twoPinFootprint(name: string): FootprintSpec {
    return {
        name,
        width: 2,
        height: 1.2,
        pads: [
            { pin_number: '1', x: -0.75, y: 0, width: 0.5, height: 0.8 },
            { pin_number: '2', x: 0.75, y: 0, width: 0.5, height: 0.8 },
        ],
    };
}

function icFootprint(): FootprintSpec {
    return {
        name: 'U1',
        width: 4,
        height: 3,
        pads: [
            { pin_number: '1', x: -2, y: 0, width: 0.5, height: 0.8 },
            { pin_number: '2', x: 0, y: 1.5, width: 0.5, height: 0.8 },
            { pin_number: '3', x: 2, y: 0, width: 0.5, height: 0.8 },
        ],
    };
}

function pathPrimitive(id: string, points: Array<[number, number]>, startOrder = 0): PlacementPrimitive {
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const bbox = { left: Math.min(...xs) - 0.5, right: Math.max(...xs) + 0.5, top: Math.min(...ys) - 0.5, bottom: Math.max(...ys) + 0.5 };
    return {
        id,
        kind: 'component',
        label: id,
        sourceNodeId: `tree:component:${id}`,
        canRotate: false,
        bbox,
        collisionBoxes: [bbox],
        width: bbox.right - bbox.left,
        height: bbox.bottom - bbox.top,
        placements: [{ designator: id, x: 0, y: 0, rotate: 0, layer: 'top', score: 0 }],
        connectionPoints: [],
        pathPorts: points.map(([x, y], index) => ({
            pathId: 'rf_main',
            order: startOrder + index,
            ref: `${id}.${index}`,
            role: index === 0 ? 'source' : index === points.length - 1 ? 'target' : index % 2 ? 'entry' : 'exit',
            x,
            y,
            normal: { x: index % 2 ? -1 : 1, y: 0 },
        })),
        children: [],
    };
}

function pathRelation(): PlacementRelation {
    return {
        id: 'path:rf_main:0',
        kind: 'critical_pair',
        from: 'pad:A.1',
        to: 'pad:B.1',
        priority: 'critical',
        scope: 'tree:board',
        effect: 'move_both',
        data: { pathId: 'rf_main', pathShape: 'straight' },
    };
}
