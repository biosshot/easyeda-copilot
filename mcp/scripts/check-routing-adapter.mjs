import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const adapter = await import(pathToFileURL(resolve('dist/routing/easyeda-autoroute-adapter.js')).href);
const drcAdapter = await import(pathToFileURL(resolve('dist/routing/easyeda-drc-adapter.js')).href);
const router = await import('eda-copilot-router');

const fixture = {
    boardOutline: { path: [[-5, -5], [5, -5], [5, 5], [-5, 5], [-5, -5]] },
    layers: { route: [1, 2], notRoute: [] },
    rules: {
        safeClearances: { cls: [{ layers: [1, 2], trackToTrack: 0.2, trackToBoardOutline: 0.5 }] },
        trackWidths: { cls: [{ layers: [1, 2], trackWidth: [0.2, 0.25, 0.3] }] },
        viaSizes: { via_cls: [0.6, 0.3] },
        differentialPairs: {},
    },
    classes: { differentialPairClasses: { pair: ['SIG', 'SIG_N'] } },
    nets: [
        { net: 'SIG', safeClearance: 'cls', trackWidth: 'cls', viaSize: 'via_cls' },
        { net: 'SIG_N', safeClearance: 'cls', trackWidth: 'cls', viaSize: 'via_cls' },
    ],
    components: {
        U1: {
            name: 'SHARED-MPN', footprint: 'fp', layer: 1, location: [1, 2], rotation: 90,
            nets: { p0: 'SIG', p1: 'SIG' }, pinName: { p0: 'VIN', p1: 'VIN' },
        },
        J1: {
            name: 'SHARED-MPN', footprint: 'tht', layer: 1, location: [-2, 0], rotation: 0,
            nets: { p0: 'SIG_N' }, pinName: { p0: '1' },
        },
    },
    footprints: {
        fp: {
            pads: {
                p0: { number: '1', layers: [1], location: [1, 0], path: [[0.5, -0.5], [1.5, -0.5], [1.5, 0.5], [0.5, 0.5]] },
                p1: { number: '1', layers: [1], location: [-1, 0], path: [[-1.5, -0.5], [-0.5, -0.5], [-0.5, 0.5], [-1.5, 0.5]] },
            },
        },
        tht: {
            pads: {
                p0: {
                    number: '1', layers: [1, 2], location: [0, 0], diameter: 2.5,
                    path: [[1.25, 0], [-1.25, 0, -180], [1.25, 0, -180]],
                },
            },
        },
    },
    tracks: [{ id: 'old', net: 'SIG', layer: 1, width: 0.2, path: [[1, 1], [2, 1]] }],
    vias: [], fillRegions: [], prohibitedRegions: [],
};

const imported = adapter.importEasyEdaAutorouteJson(fixture);
assert.ok(imported.board, JSON.stringify(imported.diagnostics));
assert.equal(imported.diagnostics.filter(item => item.severity === 'error').length, 0);
assert.deepEqual(imported.board.layers.map(item => item.name), ['TOP', 'BOTTOM']);
assert.deepEqual(imported.board.components.map(item => item.designator), ['U1', 'J1']);
assert.equal(imported.board.pads.length, 3, 'duplicate logical pad numbers are physical pads, not an error');
assert.deepEqual(imported.board.pads.map(item => item.number), ['1', '1', '1']);
assert.deepEqual(imported.board.pads.map(item => item.at), [{ x: 1, y: -3 }, { x: 1, y: -1 }, { x: -2, y: 0 }]);
assert.deepEqual(imported.board.pads[0].shape, { kind: 'rect', widthMm: 1, heightMm: 1 });
assert.deepEqual(imported.board.pads[1].shape, { kind: 'rect', widthMm: 1, heightMm: 1 });

assert.equal(imported.board.pads[2].hole, undefined,
    'autoroute diameter is copper geometry, not drill metadata; importing it must not invent a hole');

const fourLayerPadFixture = structuredClone(fixture);
fourLayerPadFixture.footprints.tht.pads.p0.layers = [1, 2, 15, 16];
const fourLayerPadImport = adapter.importEasyEdaAutorouteJson(fourLayerPadFixture);
assert.ok(fourLayerPadImport.board, JSON.stringify(fourLayerPadImport.diagnostics));
assert.deepEqual(fourLayerPadImport.board.layers.map(item => item.name), ['TOP', 'INNER_1', 'INNER_2', 'BOTTOM'],
    'through-hole pad layers must recover a multilayer stack omitted by EasyEDA autoroute layers');

const fourLayerStackImport = adapter.importEasyEdaAutorouteJson(fixture, {
    copperLayerCount: 4,
    copperLayerIds: [1, 15, 16, 2],
});
assert.ok(fourLayerStackImport.board, JSON.stringify(fourLayerStackImport.diagnostics));
assert.deepEqual(fourLayerStackImport.board.layers.map(item => item.name), ['TOP', 'INNER_1', 'INNER_2', 'BOTTOM'],
    'authoritative EasyEDA stack metadata must augment an outer-only autoroute layer list');

const fourLayerRuleFixture = structuredClone(fixture);
fourLayerRuleFixture.rules.safeClearances.cls[0].layers = [1, 2, 15, 16];
fourLayerRuleFixture.rules.trackWidths.cls[0].layers = [1, 2, 15, 16];
const fourLayerRuleImport = adapter.importEasyEdaAutorouteJson(fourLayerRuleFixture);
assert.ok(fourLayerRuleImport.board, JSON.stringify(fourLayerRuleImport.diagnostics));
assert.deepEqual(fourLayerRuleImport.board.layers.map(item => item.name), ['TOP', 'INNER_1', 'INNER_2', 'BOTTOM'],
    'the one-file import must recover copper layers represented only by autoroute rule tables');
assert.deepEqual(imported.board.pads[2].shape, { kind: 'circle', diameterMm: 2.5 });
assert.equal(imported.board.copper.editable.tracks.length, 0);
assert.equal(imported.board.copper.fixed.tracks.length, 1);
assert.equal(imported.board.copper.fixed.tracks[0].layer, 'TOP');
assert.equal(imported.board.rules.nets[0].values.preferredTrackWidthMm, 0.25);
assert.deepEqual(imported.board.rules.differentialPairs, [{ id: 'pair', positive: 'SIG', negative: 'SIG_N' }]);

const bottomFixture = structuredClone(fixture);
bottomFixture.components = {
    B1: {
        ...fixture.components.U1,
        layer: 2,
        location: [1, 2],
        rotation: 270,
        nets: { p0: 'SIG', p1: 'SIG_N', p2: 'GND' },
    },
};
bottomFixture.footprints.fp.pads = {
    p0: { number: '2', layers: [1], location: [1, 1], path: [[0.5, 0.5], [1.5, 0.5], [1.5, 1.5], [0.5, 1.5]] },
    p1: { number: '1', layers: [1], location: [1, -1], path: [[0.5, -1.5], [1.5, -1.5], [1.5, -0.5], [0.5, -0.5]] },
    p2: { number: '3', layers: [1], location: [-1, 0], path: [[-1.5, -0.5], [-0.5, -0.5], [-0.5, 0.5], [-1.5, 0.5]] },
};
bottomFixture.tracks = [];
const bottomImport = adapter.importEasyEdaAutorouteJson(bottomFixture);
assert.ok(bottomImport.board, JSON.stringify(bottomImport.diagnostics));
assert.deepEqual(bottomImport.board.components, [
    { designator: 'B1', at: { x: 1, y: -2 }, rotationDeg: -270, side: 'bottom' },
]);
assert.deepEqual(bottomImport.board.pads.map(item => ({
    id: item.id, number: item.number, net: item.net, at: item.at, layers: item.layers, shape: item.shape,
})), [
    { id: 'B1:p0', number: '2', net: 'SIG', at: { x: 0, y: -1 }, layers: ['BOTTOM'], shape: { kind: 'rect', widthMm: 1, heightMm: 1 } },
    { id: 'B1:p1', number: '1', net: 'SIG_N', at: { x: 2, y: -1 }, layers: ['BOTTOM'], shape: { kind: 'rect', widthMm: 1, heightMm: 1 } },
    { id: 'B1:p2', number: '3', net: 'GND', at: { x: 1, y: -3 }, layers: ['BOTTOM'], shape: { kind: 'rect', widthMm: 1, heightMm: 1 } },
]);

const curvedRegionFixture = structuredClone(fixture);
curvedRegionFixture.fillRegions = [{
    id: 'round-zone', net: 'SIG', layers: [1, 2],
    path: [[3.2150114300228427, -10.680871361742723],
        [2.565024130048242, -10.680871361742723, 180],
        [3.2150114300228427, -10.680871361742723, 180]],
}];
curvedRegionFixture.prohibitedRegions = [{
    id: 'round-keepout', layers: [1, 2],
    path: [[-2.565024130048271, -10.680871361742723],
        [-3.2150114300228716, -10.680871361742723, 180],
        [-2.565024130048271, -10.680871361742723, 180]],
}];
const curvedRegionImport = adapter.importEasyEdaAutorouteJson(curvedRegionFixture);
assert.ok(curvedRegionImport.board, JSON.stringify(curvedRegionImport.diagnostics));
assert.equal(curvedRegionImport.board.copper.fixed.zones.length, 1);
assert.equal(curvedRegionImport.board.keepouts.length, 1);
assert.ok(curvedRegionImport.board.copper.fixed.zones[0].outline.outer.length >= 32);
assert.ok(curvedRegionImport.board.keepouts[0].polygon.outer.length >= 32);
const keepoutXs = curvedRegionImport.board.keepouts[0].polygon.outer.map(point => point.x);
const keepoutYs = curvedRegionImport.board.keepouts[0].polygon.outer.map(point => point.y);
assert.ok(Math.abs(Math.min(...keepoutXs) - -3.2150114300228716) < 1e-9);
assert.ok(Math.abs(Math.max(...keepoutXs) - -2.565024130048271) < 1e-9);
assert.ok(Math.abs((Math.min(...keepoutYs) + Math.max(...keepoutYs)) / 2 - 10.680871361742723) < 1e-9);

const complexRegionFixture = structuredClone(fixture);
const complexPath = [
    [[-4, -4], [4, -4], [4, 4], [-4, 4]],
    [[0.5, 0], [-0.5, 0, -180], [0.5, 0, -180]],
];
complexRegionFixture.fillRegions = [{ id: 'zone-with-hole', net: 'SIG', layer: 1, path: complexPath }];
complexRegionFixture.prohibitedRegions = [{ id: 'keepout-with-hole', layers: [1, 2], path: complexPath }];
const complexRegionImport = adapter.importEasyEdaAutorouteJson(complexRegionFixture);
assert.ok(complexRegionImport.board, JSON.stringify(complexRegionImport.diagnostics));
assert.equal(complexRegionImport.board.copper.fixed.zones[0].outline.holes.length, 1);
assert.equal(complexRegionImport.board.keepouts[0].polygon.holes.length, 1);
assert.ok(complexRegionImport.board.copper.fixed.zones[0].outline.holes[0].length >= 32);

const unsupportedRegionsFixture = structuredClone(fixture);
unsupportedRegionsFixture.fillRegions = [{
    id: 'bad-zone', net: 'SIG', layer: 1,
    path: [[0, 0], [0, 0, 180]],
}];
unsupportedRegionsFixture.prohibitedRegions = [{
    id: 'bad-keepout', layers: [1, 2],
    path: [[0, 0], [0, 0, 180]],
}];
const unsupportedRegionsImport = adapter.importEasyEdaAutorouteJson(unsupportedRegionsFixture);
assert.ok(unsupportedRegionsImport.board, JSON.stringify(unsupportedRegionsImport.diagnostics));
assert.equal(unsupportedRegionsImport.board.copper.fixed.zones.length, 0);
assert.equal(unsupportedRegionsImport.board.keepouts.length, 0);
assert.deepEqual(
    unsupportedRegionsImport.diagnostics.map(item => [item.code, item.severity]),
    [
        ['EASYEDA_FILL_REGION_UNSUPPORTED', 'warning'],
        ['EASYEDA_PROHIBITED_REGION_UNSUPPORTED', 'warning'],
    ],
);
assert.match(unsupportedRegionsImport.diagnostics[0].message, /was skipped/);
assert.match(unsupportedRegionsImport.diagnostics[1].message, /was skipped/);

const differentialPresetFixture = structuredClone(fixture);
differentialPresetFixture.rules.differentialPairs = {
    diff: [{ width: [0.2], clearance: [0.25], lengthTolerance: 0.1 }],
};
for (const net of differentialPresetFixture.nets) net.differentialPair = 'diff';
differentialPresetFixture.nets.push({
    net: 'GND', safeClearance: 'cls', trackWidth: 'cls', viaSize: 'via_cls', differentialPair: 'diff',
});
const differentialPresetImport = adapter.importEasyEdaAutorouteJson(differentialPresetFixture);
assert.ok(differentialPresetImport.board, JSON.stringify(differentialPresetImport.diagnostics));
assert.ok(differentialPresetImport.board.rules.nets.find(rule => rule.net === 'SIG').values.differential);
assert.equal(
    differentialPresetImport.board.rules.nets.find(rule => rule.net === 'GND').values.differential,
    undefined,
    'a selected differential preset does not make an ordinary net a pair member',
);

const rerouteImport = adapter.importEasyEdaAutorouteJson(fixture, {
    clearRouting: { tracks: ['SIG'] },
});
assert.ok(rerouteImport.board, JSON.stringify(rerouteImport.diagnostics));
assert.equal(rerouteImport.board.copper.editable.tracks.length, 1);
assert.equal(rerouteImport.board.copper.fixed.tracks.length, 0);

const independentClearFixture = structuredClone(fixture);
independentClearFixture.tracks.push({
    id: 'old_n', net: 'SIG_N', layer: 1, width: 0.2, path: [[-2, 0], [-1, 0]],
});
independentClearFixture.fillRegions = [
    { id: 'sig_zone', net: 'SIG', layer: 1, path: [[-4, -4], [-3, -4], [-3, -3], [-4, -3]] },
    { id: 'sig_n_zone', net: 'SIG_N', layer: 1, path: [[3, 3], [4, 3], [4, 4], [3, 4]] },
];
const independentClearImport = adapter.importEasyEdaAutorouteJson(independentClearFixture, {
    clearRouting: { tracks: ['SIG'], zones: ['SIG_N'] },
});
assert.ok(independentClearImport.board, JSON.stringify(independentClearImport.diagnostics));
assert.deepEqual(independentClearImport.board.copper.editable.tracks.map(item => item.net), ['SIG']);
assert.deepEqual(independentClearImport.board.copper.fixed.tracks.map(item => item.net), ['SIG_N']);
assert.deepEqual(independentClearImport.board.copper.editable.zones.map(item => item.net), ['SIG_N']);
assert.deepEqual(independentClearImport.board.copper.fixed.zones.map(item => item.net), ['SIG']);

const copperOnly = await router.run({
    board: rerouteImport.board,
    dsl: `clearRouting({ nets: ["SIG"], items: ["tracks"] }); runCopper();`,
});
assert.equal(copperOnly.status, 'complete');
assert.deepEqual(copperOnly.clearRouting, { tracks: ['SIG'] });
assert.equal(copperOnly.copper.tracks.length, 0);

const preferenceProgram = router.compileRoutingDsl(`
    signalNet("SIG", { priority: "critical", viaPreference: "avoid" });
    signalNet("SIG_N", { priority: "high" });
    runRouting();
`);
const preferencePlan = router.resolveRoutePlan(imported.board, preferenceProgram, imported.board.rules);
assert.deepEqual(
    preferencePlan.netPolicies.filter(item => item.net === 'SIG' || item.net === 'SIG_N')
        .map(item => [item.net, item.priority, item.viaPreference, item.protectOnSuccess]),
    [
        ['SIG', 'critical', 'avoid', true],
        ['SIG_N', 'high', 'auto', false],
    ],
);
assert.deepEqual(preferencePlan.fanout, { enabled: false, targets: [] },
    'dense-package fanout must remain disabled until the DSL explicitly requests it');
const explicitFanoutProgram = router.compileRoutingDsl(`fanout(component("U1")); runRouting();`);
assert.equal(router.resolveRoutePlan(imported.board, explicitFanoutProgram, imported.board.rules).fanout.enabled, true);
assert.throws(
    () => router.compileRoutingDsl(`quality({ profile: "balanced" }); runRouting();`),
    /quality is not defined/i,
    'the EasyEDA host must expose the one-policy router rather than the removed quality DSL',
);

const plannedZone = await router.run({
    board: imported.board,
    dsl: `plane({
        net: "SIG", layers: "TOP",
        zone: {
            clearanceMm: 0.24,
            minThicknessMm: 0.18,
            fill: { style: "solid" },
            padConnection: {
                mode: "thermal", thermalGapMm: 0.26, spokeWidthMm: 0.31, spokeAngleDeg: 90
            },
            removeIslandsBelowMm2: 0
        }
    }); runCopper();`,
});
assert.equal(plannedZone.status, 'complete');
assert.equal(plannedZone.copper.zones[0].clearanceMm, 0.24);
assert.deepEqual(plannedZone.copper.zones[0].padConnection, {
    mode: 'thermal', thermalGapMm: 0.26, spokeWidthMm: 0.31, spokeAngleDeg: 90,
});

const application = adapter.routingResultToEasyEdaApplication({
    status: 'complete', operation: 'route',
    rules: imported.board.rules,
    copper: {
        tracks: [{ net: 'SIG', layer: 'TOP', widthMm: 0.2, points: [{ x: 1, y: -3 }, { x: 2, y: -3 }] }],
        vias: [{ net: 'SIG', at: { x: 2, y: -3 }, diameterMm: 0.6, drillMm: 0.3, fromLayer: 'TOP', toLayer: 'BOTTOM' }],
        zones: [{
            id: 'gnd-plane', net: 'SIG', layers: ['TOP'],
            outline: { outer: [{ x: -4, y: -4 }, { x: 4, y: -4 }, { x: 4, y: 4 }, { x: -4, y: 4 }] },
            priority: 2, minThicknessMm: 0.18, clearanceMm: 0.24,
            fill: { style: 'hatched', hatchOrientationDeg: 45 },
            padConnection: {
                mode: 'thermal', thermalGapMm: 0.26, spokeWidthMm: 0.31, spokeAngleDeg: 90,
            },
            removeIslandsBelowMm2: 0,
        }],
    },
    diagnostics: [], metrics: { elapsedMs: 1 }, requiresNativeVerification: true,
});
assert.deepEqual(application.tracks[0].points, [[1, 3], [2, 3]]);
assert.deepEqual(application.vias[0].location, [2, 3]);
assert.deepEqual(application.zones[0], {
    id: 'gnd-plane', net: 'SIG', layers: [1],
    outline: [[-4, 4], [4, 4], [4, -4], [-4, -4]], holes: [],
    priority: 2, minThicknessMm: 0.18, clearanceMm: 0.24,
    connection: undefined,
    fill: { style: 'hatched', hatchOrientationDeg: 45 },
    padConnection: {
        mode: 'thermal', thermalGapMm: 0.26, spokeWidthMm: 0.31, spokeAngleDeg: 90,
    },
    removeIslandsBelowMm2: 0,
});
assert.deepEqual(application.diagnostics.map(item => item.code), ['EASYEDA_RESULT_ZONE_HATCH_APPROXIMATED']);

const legacyKiCadLayerApplication = adapter.routingResultToEasyEdaApplication({
    status: 'complete', operation: 'route', rules: imported.board.rules,
    copper: {
        tracks: [{ net: 'SIG', layer: 'F.Cu', widthMm: 0.2, points: [{ x: 1, y: -3 }, { x: 2, y: -3 }] }],
        vias: [], zones: [],
    },
    diagnostics: [], metrics: { elapsedMs: 1 }, requiresNativeVerification: true,
});
assert.equal(legacyKiCadLayerApplication.tracks.length, 0);
assert.equal(legacyKiCadLayerApplication.diagnostics[0].code, 'EASYEDA_RESULT_LAYER_UNSUPPORTED',
    'KiCad layer names must not leak across the canonical router/host boundary');

const stackupApplication = adapter.routingResultToEasyEdaApplication({
    status: 'complete', operation: 'apply-stackup',
    rules: imported.board.rules,
    stackup: {
        applyRequested: true,
        effective: {
            layers: [
                { kind: 'copper', layer: 'TOP', thicknessMm: 0.035 },
                { kind: 'dielectric', name: 'Core', thicknessMm: 1.5, relativePermittivity: 4.2 },
                { kind: 'copper', layer: 'BOTTOM', thicknessMm: 0.035 },
            ],
        },
    },
    diagnostics: [], metrics: { elapsedMs: 1 }, requiresNativeVerification: true,
});
assert.equal(stackupApplication.copperLayerCount, 2);
assert.equal(stackupApplication.diagnostics[0].code, 'EASYEDA_STACKUP_LAYER_COUNT_ONLY');
assert.equal(stackupApplication.diagnostics[0].severity, 'warning');

const invalidStackupApplication = adapter.routingResultToEasyEdaApplication({
    status: 'complete', operation: 'apply-stackup',
    rules: imported.board.rules,
    stackup: {
        applyRequested: true,
        effective: {
            layers: [
                { kind: 'copper', layer: 'TOP', thicknessMm: 0.035 },
                { kind: 'dielectric', name: 'Core 1', thicknessMm: 0.7 },
                { kind: 'copper', layer: 'INNER_1', thicknessMm: 0.035 },
                { kind: 'dielectric', name: 'Core 2', thicknessMm: 0.7 },
                { kind: 'copper', layer: 'BOTTOM', thicknessMm: 0.035 },
            ],
        },
    },
    diagnostics: [], metrics: { elapsedMs: 1 }, requiresNativeVerification: true,
});
assert.equal(invalidStackupApplication.copperLayerCount, undefined);
assert.equal(invalidStackupApplication.diagnostics[0].code, 'EASYEDA_STACKUP_COPPER_LAYER_COUNT_UNSUPPORTED');
assert.equal(invalidStackupApplication.diagnostics[0].severity, 'error');

const values = {
    clearanceMm: 0.22, edgeClearanceMm: 0.5,
    minTrackWidthMm: 0.2, preferredTrackWidthMm: 0.3,
    via: { minDiameterMm: 0.6, preferredDiameterMm: 0.7, minDrillMm: 0.3, preferredDrillMm: 0.35 },
    differential: { trackWidthMm: 0.2, gapMm: 0.25, maxSkewMm: 0.1 },
};
const sourceValues = {
    ...values,
    clearanceMm: 0.2,
    preferredTrackWidthMm: 0.2,
    differential: undefined,
};
const sourceRoutingRules = {
    default: sourceValues,
    nets: ['SIG', 'SIG_N', 'MATCH_A', 'MATCH_B'].map(net => ({ net, values: sourceValues })),
};
const nativeDrcFixture = {
    ruleConfiguration: {
        Physics: {
            Track: { default: { editName: 'default', isSetDefault: true, form: { data: { '1': { minValue: 0.1, defaultValue: 0.2, maxValue: 1 } } } } },
            'Via Size': { default: { editName: 'default', isSetDefault: true, viaOuterdiameterMin: 0.5, viaOuterdiameterDefault: 0.6, viaOuterdiameterMax: 1, viaInnerdiameterMin: 0.2, viaInnerdiameterDefault: 0.3, viaInnerdiameterMax: 0.5 } },
            'Net Length Range': { default: { editName: 'default', netLengthMax: 100 } },
            'Net Length Tolerance': { default: { editName: 'default', isSetDefault: true, netLengthTolerance: 1 } },
            'Differential Pair': { default: { editName: 'default', isSetDefault: true, strokeWidthTables: { 1: [0.2] }, diffPairSpacingTables: { 1: [0.2] }, differentailPairLenTolerMax: 1 } },
        },
        Spacing: { 'Safe Spacing': { default: { editName: 'default', isSetDefault: true, tables: { 1: { content: [[0.2, 0.2]] } } } } },
        Plane: {
            'Copper Zone': {
                default: {
                    editName: 'copperRegion', isSetDefault: true, form: {
                        singleLayerPadModel: { status: 1, data: { 1: { connectMode: 0, lineClearance: 0.254, lineWidth: 0.254, lineAngle: 90 } } },
                        multiLayerPadModel: { status: 1, data: { 1: { connectMode: 0, lineClearance: 0.254, lineWidth: 0.254, lineAngle: 90 } } },
                        trackConnectModel: { status: 1, data: { 1: { trackConnectMode: 0 } } },
                    },
                },
            },
        },
    },
    netRules: [
        { type: 'net', name: 'SIG' },
        { type: 'net', name: 'SIG_N' },
        { type: 'net', name: 'MATCH_A' },
        { type: 'net', name: 'MATCH_B' },
    ],
};
const targetRoutingRules = {
    default: values,
    nets: [
        { net: 'SIG', values },
        { net: 'SIG_N', values },
        { net: 'MATCH_A', values },
        { net: 'MATCH_B', values },
    ],
    netClasses: [{ name: 'FAST', nets: ['SIG', 'SIG_N'], values }],
    differentialPairs: [{ id: 'pair', positive: 'SIG', negative: 'SIG_N' }],
    matchedGroups: [{ id: 'MATCHED', nets: ['MATCH_A', 'MATCH_B'], toleranceMm: 0.15 }],
};
const translated = drcAdapter.routingRulesToEasyEdaDrcBundle(
    nativeDrcFixture, sourceRoutingRules, targetRoutingRules,
);
assert.deepEqual(translated.netRules.map(rule => [rule.type, rule.name]), [
    ['netClass', 'FAST'],
    ['equalLengthGroup', 'MATCHED'],
    ['differentialPair', 'pair'],
]);
assert.equal('netClasses' in translated, false, 'relations belong to the native netRules tree');
assert.equal('differentialPairs' in translated, false, 'relations belong to the native netRules tree');
assert.equal('equalLengthGroups' in translated, false, 'relations belong to the native netRules tree');
assert.equal(JSON.stringify(translated).includes('"color"'), false, 'color is not routing/DRC data');

const fastClass = translated.netRules.find(rule => rule.type === 'netClass' && rule.name === 'FAST');
assert.deepEqual(fastClass.sub.map(rule => rule.name), ['SIG', 'SIG_N']);
assert.equal(fastClass.Track, 'copilot_router_class_0_track');
assert.equal(fastClass.sub[0].Track, fastClass.Track, 'class presets are repeated on native child nets');
assert.equal(fastClass.sub[0]['Differential Pair'], 'copilot_router_diff_0');

const pairRule = translated.netRules.find(rule => rule.type === 'differentialPair' && rule.name === 'pair');
assert.equal(pairRule.positiveNet, 'SIG');
assert.equal(pairRule.negativeNet, 'SIG_N');
assert.deepEqual(pairRule.sub, [{ type: 'net', name: 'SIG' }, { type: 'net', name: 'SIG_N' }]);

const matchedGroup = translated.netRules.find(rule => rule.type === 'equalLengthGroup' && rule.name === 'MATCHED');
assert.deepEqual(matchedGroup.sub.map(rule => rule.name), ['MATCH_A', 'MATCH_B']);
assert.equal(matchedGroup['Net Length Tolerance'], 'copilot_router_match_0');
assert.equal(matchedGroup.sub[0]['Net Length Tolerance'], 'copilot_router_match_0');
assert.equal(matchedGroup.sub[0].Track, 'copilot_router_class_0_track');
assert.equal(matchedGroup.sub[0]['Differential Pair'], undefined);
assert.deepEqual(
    Object.keys(translated.ruleConfiguration.Physics.Track).sort(),
    ['copilot_router_class_0_track', 'default'],
    'equal physical rules must share one newly created Track preset',
);
assert.deepEqual(
    Object.keys(translated.ruleConfiguration.Physics['Via Size']).sort(),
    ['copilot_router_class_0_via', 'default'],
    'equal physical rules must share one newly created Via Size preset',
);
assert.deepEqual(
    Object.keys(translated.ruleConfiguration.Spacing['Safe Spacing']).sort(),
    ['copilot_router_class_0_spacing', 'default'],
    'equal physical rules must share one newly created Safe Spacing preset',
);

assert.equal(translated.ruleConfiguration.Physics.Track.copilot_router_class_0_track.form.data['1'].defaultValue, 0.3);
assert.equal(translated.ruleConfiguration.Physics.Track.copilot_router_class_0_track.form.data['1'].maxValue, 1.3);
assert.equal(translated.ruleConfiguration.Physics.Track.copilot_router_class_0_track.isSetDefault, false);
assert.equal(translated.ruleConfiguration.Spacing['Safe Spacing'].copilot_router_class_0_spacing.tables['1'].content[0][0], 0.22);
assert.equal(
    translated.ruleConfiguration.Physics.Track.default.form.data['1'].defaultValue,
    0.3,
    'a changed global rule must update the native default Track preset',
);
assert.equal(
    translated.ruleConfiguration.Physics.Track.default.form.data['1'].maxValue,
    1.3,
    'a changed Track preset must leave 1mm headroom above the requested width',
);
assert.equal(
    translated.ruleConfiguration.Spacing['Safe Spacing'].default.tables['1'].content[0][0],
    0.22,
    'a changed global rule must update the native default Safe Spacing preset',
);

const compactDrc = drcAdapter.summarizeEasyEdaDrcBundle(translated);
assert.deepEqual(compactDrc.global.trackWidthMm, { min: 0.2, preferred: 0.3, max: 1.3 });
assert.deepEqual(compactDrc.global.viaDiameterMm, { min: 0.6, preferred: 0.7, max: 0.7 });
assert.deepEqual(compactDrc.netClasses.FAST.nets, ['SIG', 'SIG_N']);
assert.deepEqual(
    { positive: compactDrc.differentialPairs.pair.positive, negative: compactDrc.differentialPairs.pair.negative },
    { positive: 'SIG', negative: 'SIG_N' },
);
assert.deepEqual(compactDrc.equalLengthGroups.MATCHED.nets, ['MATCH_A', 'MATCH_B']);
assert.equal(compactDrc.equalLengthGroups.MATCHED.toleranceMm, 0.15);
const compactDrcJson = JSON.stringify(compactDrc);
assert.equal(compactDrcJson.includes('ruleConfiguration'), false);
assert.equal(compactDrcJson.includes('copilot_router_'), false);
assert.equal(compactDrcJson.includes('editName'), false);
assert.equal(compactDrcJson.includes('color'), false);

const deletedRelations = drcAdapter.routingRulesToEasyEdaDrcBundle(
    translated,
    targetRoutingRules,
    { default: values, nets: targetRoutingRules.nets },
);
assert.deepEqual(
    deletedRelations.netRules.filter(rule => rule.type !== 'net').map(rule => rule.type),
    [],
    'deleting all relation state must remove native class, differential-pair, and equal-length nodes',
);
assert.deepEqual(
    deletedRelations.netRules.filter(rule => rule.type === 'net').map(rule => rule.name).sort(),
    ['MATCH_A', 'MATCH_B', 'SIG', 'SIG_N'],
    'relation deletion must restore standalone native net roots',
);
assert.equal(
    deletedRelations.netRules.some(rule => rule.type === 'net' && rule['Differential Pair'] !== undefined),
    false,
    'deleting a differential pair must clear its native member assignments',
);

const noOpDrc = drcAdapter.routingRulesToEasyEdaDrcBundle(nativeDrcFixture, sourceRoutingRules, sourceRoutingRules);
assert.deepEqual(noOpDrc, nativeDrcFixture, 'a semantic no-op must preserve the native DRC bundle exactly');
assert.equal(drcAdapter.diffRoutingRules(sourceRoutingRules, sourceRoutingRules).hasChanges, false);

const existingPresetDrc = structuredClone(nativeDrcFixture);
const existingTrack = structuredClone(existingPresetDrc.ruleConfiguration.Physics.Track.default);
existingTrack.editName = 'existing_track';
existingTrack.isSetDefault = false;
existingTrack.form.data['1'] = { minValue: 0.1999996, defaultValue: 0.2999994, maxValue: 1.2999994 };
existingPresetDrc.ruleConfiguration.Physics.Track.existing_track = existingTrack;
const existingVia = structuredClone(existingPresetDrc.ruleConfiguration.Physics['Via Size'].default);
existingVia.editName = 'existing_via';
existingVia.isSetDefault = false;
Object.assign(existingVia, {
    viaOuterdiameterMin: 0.5999988,
    viaOuterdiameterDefault: 0.6999986,
    viaOuterdiameterMax: 0.6999986,
    viaInnerdiameterMin: 0.2999994,
    viaInnerdiameterDefault: 0.3499993,
    viaInnerdiameterMax: 0.3499993,
});
existingPresetDrc.ruleConfiguration.Physics['Via Size'].existing_via = existingVia;
const existingSpacing = structuredClone(existingPresetDrc.ruleConfiguration.Spacing['Safe Spacing'].default);
existingSpacing.editName = 'existing_spacing';
existingSpacing.isSetDefault = false;
existingSpacing.tables['1'].content = [[0.2199996, 0.2199996]];
existingPresetDrc.ruleConfiguration.Spacing['Safe Spacing'].existing_spacing = existingSpacing;
const reusedExistingPresets = drcAdapter.routingRulesToEasyEdaDrcBundle(
    existingPresetDrc, sourceRoutingRules, targetRoutingRules,
);
const reusedExistingClass = reusedExistingPresets.netRules.find(rule => rule.type === 'netClass' && rule.name === 'FAST');
assert.equal(reusedExistingClass.Track, 'existing_track');
assert.equal(reusedExistingClass['Via Size'], 'existing_via');
assert.equal(reusedExistingClass['Safe Spacing'], 'existing_spacing');
assert.equal(
    Object.keys(reusedExistingPresets.ruleConfiguration.Physics.Track).some(name => name.startsWith('copilot_router_')),
    false,
    'an equivalent existing Track preset must be reused despite native numeric round-trip noise',
);
assert.equal(
    Object.keys(reusedExistingPresets.ruleConfiguration.Physics['Via Size']).some(name => name.startsWith('copilot_router_')),
    false,
    'an equivalent existing Via Size preset must be reused despite native numeric round-trip noise',
);
assert.equal(
    Object.keys(reusedExistingPresets.ruleConfiguration.Spacing['Safe Spacing']).some(name => name.startsWith('copilot_router_')),
    false,
    'an equivalent existing Safe Spacing preset must be reused despite native numeric round-trip noise',
);

const zoneDrc = drcAdapter.routingZonesToEasyEdaDrcBundle(nativeDrcFixture, application.zones);
const zoneRule = zoneDrc.netRules.find(rule => rule.type === 'net' && rule.name === 'SIG');
assert.equal(zoneRule['Copper Zone'], 'copilot_router_zone_0_copper');
assert.equal(zoneRule['Copper Safe Spacing'], 'copilot_router_zone_0_spacing');
const zonePreset = zoneDrc.ruleConfiguration.Plane['Copper Zone'].copilot_router_zone_0_copper;
assert.equal(zonePreset.form.singleLayerPadModel.data['1'].connectMode, 0);
assert.equal(zonePreset.form.singleLayerPadModel.data['1'].lineClearance, 0.26);
assert.equal(zonePreset.form.singleLayerPadModel.data['1'].lineWidth, 0.31);
assert.equal(zonePreset.form.multiLayerPadModel.data['1'].lineAngle, 90);
assert.equal(
    zoneDrc.ruleConfiguration.Spacing['Safe Spacing'].copilot_router_zone_0_spacing.tables['1'].content[0][0],
    0.24,
);
const conflictingZoneDrc = drcAdapter.routingZonesToEasyEdaDrcBundle(nativeDrcFixture, [
    application.zones[0],
    { ...application.zones[0], padConnection: { mode: 'solid' } },
]);
const conflictingZoneRule = conflictingZoneDrc.netRules.find(rule => rule.type === 'net' && rule.name === 'SIG');
const conflictingZonePreset = conflictingZoneDrc.ruleConfiguration.Plane['Copper Zone'][conflictingZoneRule['Copper Zone']];
assert.equal(
    conflictingZonePreset.form.singleLayerPadModel.data['1'].connectMode,
    1,
    'EasyEDA must keep the geometry and use the last declared per-net Copper Zone policy',
);

const existingClassBundle = structuredClone(nativeDrcFixture);
existingClassBundle.netRules = [{
    type: 'netClass', name: 'OLD', Track: 'default', 'Via Size': 'default', 'Safe Spacing': 'default',
    sub: [
        { type: 'net', name: 'SIG', Track: 'default', 'Via Size': 'default', 'Safe Spacing': 'default' },
        { type: 'net', name: 'SIG_N', Track: 'default', 'Via Size': 'default', 'Safe Spacing': 'default' },
    ],
}];
const importedRelationRules = drcAdapter.mergeEasyEdaDrcIntoRoutingRules(existingClassBundle, sourceRoutingRules);
assert.deepEqual(importedRelationRules.netClasses.map(item => [item.name, item.nets]), [
    ['OLD', ['SIG', 'SIG_N']],
]);
const movedRelationRules = {
    ...importedRelationRules,
    netClasses: [{ name: 'NEW', nets: ['SIG', 'SIG_N'], values: sourceValues }],
};
const movedRelationBundle = drcAdapter.routingRulesToEasyEdaDrcBundle(
    existingClassBundle, importedRelationRules, movedRelationRules,
);
assert.deepEqual(
    movedRelationBundle.netRules.filter(rule => rule.type === 'netClass').map(rule => [rule.type, rule.name]),
    [['netClass', 'NEW']],
);
assert.deepEqual(movedRelationBundle.netRules.find(rule => rule.type === 'netClass').sub.map(rule => rule.name), ['SIG', 'SIG_N']);
assert.equal(
    movedRelationBundle.netRules.flatMap(rule => rule.type === 'net' ? [rule] : rule.sub)
        .filter(rule => rule.name === 'SIG').length,
    1,
    'moving a net class must not duplicate the member in an old class',
);

const integratedSourceRules = drcAdapter.mergeEasyEdaDrcIntoRoutingRules(existingClassBundle, imported.board.rules);
assert.equal(
    integratedSourceRules.differentialPairs,
    undefined,
    'native DRC relations must override stale or inferred autoroute relations even when the native list is empty',
);
const integratedMove = await router.run({
    board: { ...imported.board, rules: integratedSourceRules },
    dsl: `netClass("NEW", { nets: ["SIG", "SIG_N"], trackWidthMm: 0.25 }); applyDrcRules();`,
});
assert.equal(integratedMove.status, 'complete');
assert.deepEqual(integratedMove.rules.netClasses.map(item => item.name), ['NEW']);
const integratedDiff = drcAdapter.diffRoutingRules(integratedSourceRules, integratedMove.rules);
assert.equal(integratedDiff.hasChanges, true);
assert.deepEqual([...integratedDiff.netClasses].sort(), ['NEW', 'OLD']);
const integratedBundle = drcAdapter.routingRulesToEasyEdaDrcBundle(
    existingClassBundle, integratedSourceRules, integratedMove.rules,
);
assert.deepEqual(integratedBundle.netRules.filter(rule => rule.type === 'netClass').map(rule => rule.name), ['NEW']);
assert.equal(
    integratedBundle.netRules.some(rule => rule.type === 'netClass' && rule.name === 'OLD'),
    false,
);

const integratedIncremental = await router.run({
    board: { ...imported.board, rules: integratedSourceRules },
    dsl: `signalNet("SIG", { trackWidthMm: 0.27 }); applyDrcRules();`,
});
assert.deepEqual(
    integratedIncremental.rules.netClasses,
    integratedSourceRules.netClasses,
    'an explicit per-net value change must preserve imported class membership',
);
const integratedIncrementalBundle = drcAdapter.routingRulesToEasyEdaDrcBundle(
    existingClassBundle, integratedSourceRules, integratedIncremental.rules,
);
assert.deepEqual(
    integratedIncrementalBundle.netRules.filter(rule => rule.type === 'netClass').map(rule => [
        rule.name, rule.sub.map(member => member.name),
    ]),
    [['OLD', ['SIG', 'SIG_N']]],
);
assert.equal(
    integratedIncrementalBundle.netRules.flatMap(rule => rule.type === 'net' ? [rule] : rule.sub)
        .filter(rule => rule.name === 'SIG').length,
    1,
    'an incremental per-net edit must not duplicate the native net root',
);

process.stdout.write('EasyEDA routing adapter: ok\n');

const linkedFixture = structuredClone(fixture);
linkedFixture.tracks[0].pads = [['U1','p0'],['U1','p1'],['missing','p0']];
const linked = adapter.importEasyEdaAutorouteJson(linkedFixture);
assert.deepEqual(linked.board.copper.fixed.tracks[0].connectedPadIds, ['U1:p0','U1:p1']);
const clearedLinks = adapter.importEasyEdaAutorouteJson(linkedFixture, {clearRouting:{vias:['SIG']}});
assert.equal(clearedLinks.board.copper.fixed.tracks[0].connectedPadIds, undefined,
    'Clearing vias invalidates native connectivity evidence on retained tracks');
console.log('Native pad links preserve physical pad identity and expire on copper cleanup: ok');
