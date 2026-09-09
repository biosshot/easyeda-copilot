import assert from 'node:assert/strict';
import test from 'node:test';
import { autoPlacePcbWithReport, fakePcbPlacementExample } from './fixtures/auto-place.ts';
import { createPcbLayout } from '../src/pcb-layout/pcb-auto-place/layout.ts';
import { createBoardAssemble } from '../src/pcb-layout/board-assemble.ts';
import { buildPlacementInput } from '../src/pcb-layout/placement-input.ts';
import { runPcbLayoutDsl } from '../src/pcb-layout/pcb-layout-dsl/spec.ts';
import { BoardAssembleSchema } from '../src/types/pcb/board-assemble.ts';

test.describe('PCB board assemble adapter', () => {
    test('exports flat placement without server-routed copper or holes field', () => {
        const { layout } = autoPlacePcbWithReport(fakePcbPlacementExample);

        const assemble = createBoardAssemble(layout);

        assert.deepEqual(assemble.board, {
            polygon: [
                { x: -layout.board.outline.width / 2, y: -layout.board.outline.height / 2 },
                { x: layout.board.outline.width / 2, y: -layout.board.outline.height / 2 },
                { x: layout.board.outline.width / 2, y: layout.board.outline.height / 2 },
                { x: -layout.board.outline.width / 2, y: layout.board.outline.height / 2 },
            ],
        });
        assert.ok(assemble.components?.some((component) => component.designator === 'U1'));
        assert.equal(assemble.tracks, undefined);
        assert.equal(assemble.polygons, undefined);
        assert.equal(assemble.vias, undefined);
        assert.equal('holes' in assemble, false);
        assert.equal('metadata' in assemble, false);
        assert.equal('schema' in assemble, false);
        assert.equal('patches' in assemble, false);
    });

    test('omits preserved board and components from partial assembly', () => {
        const { layout } = autoPlacePcbWithReport(fakePcbPlacementExample);
        const preserved = layout.components[0].designator;

        const assemble = createBoardAssemble(layout, {
            preserveBoard: true,
            preservedComponents: new Set([preserved]),
        });

        assert.equal('board' in assemble, false);
        assert.equal(assemble.components?.some((component) => component.designator === preserved), false);
        assert.equal(assemble.components?.length, layout.components.length - 1);
    });

    test('does not export footprint through-hole pads as board vias', () => {
        const { layout } = autoPlacePcbWithReport(fakePcbPlacementExample);
        const component = layout.components.find((item) => item.designator === 'J1') ?? layout.components[0];
        component.rotate = 0;
        component.footprint = {
            ...component.footprint,
            sourceOriginOffset: { x: 0, y: 1.25 },
            pads: [
                ...component.footprint.pads,
                {
                    pin_number: 'MH1',
                    name: 'MH1',
                    x: 1,
                    y: 0,
                    width: 0.65,
                    height: 0.65,
                    mount: 'through_hole',
                    drillDiameter: 0.65,
                },
            ],
        };

        const assemble = createBoardAssemble(layout);
        const placed = assemble.components?.find((item) => item.designator === component.designator);

        assert.equal(assemble.vias, undefined);
        assert.equal(placed?.x, component.x);
        assert.equal(placed?.y, -(component.y + 1.25));
    });

    test('converts component placement to EasyEDA y-up coordinates', () => {
        const { layout } = autoPlacePcbWithReport(fakePcbPlacementExample);
        const component = layout.components[0];
        component.x = 3;
        component.y = -4;
        component.rotate = 90;

        const assemble = createBoardAssemble(layout);
        const placed = assemble.components?.find((item) => item.designator === component.designator);

        assert.equal(placed?.x, 3);
        assert.equal(placed?.y, 4);
        assert.equal(placed?.rotate, 90);
    });

    test('exports bottom component rotation in EasyEDA bottom-side coordinates', () => {
        const { layout } = autoPlacePcbWithReport(fakePcbPlacementExample);
        const component = layout.components[0];
        component.x = 0;
        component.y = 3;
        component.rotate = 90;
        component.layer = 'bottom';

        const assemble = createBoardAssemble(layout);
        const placed = assemble.components?.find((item) => item.designator === component.designator);

        assert.equal(placed?.x, 0);
        assert.equal(placed?.y, -3);
        assert.equal(placed?.rotate, 270);
        assert.equal(placed?.layer, 'bottom');
    });

    test('exports board holes as unnetted vias', () => {
        const { layout } = autoPlacePcbWithReport(fakePcbPlacementExample);
        layout.boardHoles = [{
            name: 'MH1',
            x: -9,
            y: -9,
            drill: 3.2,
            diameter: 3.2,
            keepout: 4,
        }];

        const assemble = createBoardAssemble(layout);

        assert.deepEqual(assemble.vias, [{
            x: -9,
            y: 9,
            diameter: 3.2,
            drill: 3.2,
        }]);
    });

    test('exports synthetic boardPad groups as board assemble pads', async () => {
        const rules = runPcbLayoutDsl(`
            board.rect(20, 20, { layers: ["top", "bottom"] });
            boardPad("debug", {
                at: anchor("board.bottom"),
                offset: { x: 0, y: -2 },
                pitch: 1.27,
                rowPitch: 1.27,
                layer: "multi",
                pads: [[
                    { name: "GND", net: "GND", shape: "round", diameter: 0.9, hole: { diameter: 0.35 } },
                    { name: "3V3", net: "+3V3", shape: "rect", width: 1.1, height: 0.8, hole: { diameter: 0.3, offset: { x: 0.05, y: -0.02 } } }
                ], [
                    { name: "TX", net: "TX", shape: "oval", width: 1.2, height: 0.7, hole: { diameter: 0.25 } }
                ]]
            });
        `);
        const input = await buildPlacementInput({ components: [] }, rules);
        const layout = createPcbLayout(input, [{ designator: 'debug', x: 0, y: 8, rotate: 0, layer: 'top', score: 0 }]);

        const assemble = createBoardAssemble(layout);

        assert.equal(assemble.components, undefined);
        assert.deepEqual(assemble.pads, [
            { name: 'debug.GND', net: 'GND', x: -0.61, y: -7.415, layer: 'multi', shape: 'round', diameter: 0.9, hole: { diameter: 0.35 } },
            { name: 'debug.3V3', net: '+3V3', x: 0.66, y: -7.415, layer: 'multi', shape: 'rect', width: 1.1, height: 0.8, hole: { diameter: 0.3, offset: { x: 0.05, y: -0.02 } } },
            { name: 'debug.TX', net: 'TX', x: -0.61, y: -8.685, layer: 'multi', shape: 'oval', width: 1.2, height: 0.7, hole: { diameter: 0.25 } },
        ]);
    });

    test('exports non-rectangular board polygon from layout outline', () => {
        const base = autoPlacePcbWithReport(fakePcbPlacementExample);
        const layout = structuredClone(base.layout);
        layout.board.outline = {
            type: 'polygon',
            width: 20,
            height: 10,
            points: [
                { x: -6, y: -5 },
                { x: 6, y: -5 },
                { x: 10, y: -1 },
                { x: 10, y: 5 },
                { x: -10, y: 5 },
                { x: -10, y: -1 },
            ],
        };

        const assemble = createBoardAssemble(layout);

        assert.deepEqual(assemble.board?.polygon, layout.board.outline.points.map((point) => ({
            x: point.x,
            y: -point.y,
        })).reverse());
    });

    test('exports automatically placed designator text without separate layer', () => {
        const { layout } = autoPlacePcbWithReport(fakePcbPlacementExample);
        const component = layout.components[0];
        layout.components = [component];
        layout.board.outline = { type: 'rect', width: 40, height: 30 };
        component.x = 0;
        component.y = 0;
        component.rotate = 0;
        component.designatorText = { height: 1.25, rotations: [0] };

        const assemble = createBoardAssemble(layout);
        const placed = assemble.components?.find((item) => item.designator === component.designator);

        assert.equal(placed?.designatorText?.height, 1.25);
        assert.equal(placed?.designatorText?.rotate, 0);
        assert.equal(placed?.designatorText && 'layer' in placed.designatorText, false);
    });

    test('allows per-component disabling of designator text', () => {
        const { layout } = autoPlacePcbWithReport(fakePcbPlacementExample);
        const component = layout.components[0];
        layout.components = [component];
        layout.board.outline = { type: 'rect', width: 40, height: 30 };
        component.designatorText = { enabled: false };

        const assemble = createBoardAssemble(layout);
        const placed = assemble.components?.find((item) => item.designator === component.designator);

        assert.equal(placed?.designatorText, undefined);
    });

    test('parses global and per-component designator text DSL options', () => {
        const rules = runPcbLayoutDsl(`
            board.rect(20, 20);
            silkscreen.designators({ height: 1.1, rotations: [0, 90] });
            component("U1").designatorText({ height: 1.0, rotations: [0] });
        `);

        assert.equal(rules.silkscreen?.designators?.enabled, null);
        assert.equal(rules.silkscreen?.designators?.height, 1.1);
        assert.deepEqual([...rules.silkscreen!.designators!.rotations!], [0, 90]);
        assert.equal(rules.silkscreen?.designators?.margin, null);

        const componentRule = rules.component_rules.find((item) => item.designator === 'U1');
        assert.equal(componentRule?.designatorText?.enabled, null);
        assert.equal(componentRule?.designatorText?.height, 1);
        assert.deepEqual([...componentRule!.designatorText!.rotations!], [0]);
        assert.equal(componentRule?.designatorText?.margin, null);
    });

    test('parses placement-only module DSL options', () => {
        const rules = runPcbLayoutDsl(`
            board.rect(30, 20);
            block("buck_core", ["U1", "L1"], "power");
            block("buck_output", ["C1", "C2"], "power", { placement: "satellite", attachTo: "buck_core" });
            module("power", ["buck_core", "buck_output"], {
                anchor: anchor("board.left"),
                sidePreference: "left",
                maxBboxScale: 1.8,
                maxWidth: 18,
                maxHeight: 14,
                hardBbox: true,
                lockInternalAfterPlace: true,
                allowInternalRefine: false,
                placementPriority: "high",
            });
        `);

        assert.deepEqual(JSON.parse(JSON.stringify(rules.modules)), [{
            name: 'power',
            block_names: ['buck_core', 'buck_output'],
            anchor: { type: 'board_anchor', anchor: 'board.left' },
            sidePreference: 'left',
            maxBboxScale: 1.8,
            maxWidth: 18,
            maxHeight: 14,
            hardBbox: true,
            lockInternalAfterPlace: true,
            allowInternalRefine: false,
            placementPriority: 'high',
        }]);
    });

    test('schema rejects non-contract fields', () => {
        assert.throws(() => BoardAssembleSchema().parse({
            board: {
                polygon: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
            },
            holes: [],
            schema: 'legacy',
            patches: [],
        }));
    });
});
