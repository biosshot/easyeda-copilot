import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { applyNativeBoardPackSolution } from '../src/pcb-layout/pcb-auto-place-v2/native/apply-board-solution.ts';
import type { NativeBoardPackProblemV3, NativePassiveIslandProblemV1 } from '../src/pcb-layout/pcb-auto-place-v2/native/contract.ts';
import { loadNativeBoardPacker } from '../src/pcb-layout/pcb-auto-place-v2/native/load-native-board-packer.ts';
import type { PlacementPrimitive } from '../src/pcb-layout/pcb-auto-place-v2/primitives.ts';

const nativeDirectory = resolve('native', 'pcb-board-packer');
const nativeTest = test;

nativeTest('native board packer is deterministic and returns an applicable rigid transform', () => {
    const addon = loadNativeBoardPacker();
    const problem = minimalProblem();
    const first = addon.solveBoardPacked(structuredClone(problem));
    const second = addon.solveBoardPacked(structuredClone(problem));

    assert.deepEqual(second, first);
    assert.equal(first.version, 3);
    assert.equal(first.states.length, 1);
    assert.ok(Number.isFinite(first.rank.score));

    const result = applyNativeBoardPackSolution([minimalPrimitive()], first);
    assert.equal(result.length, 1);
    assert.deepEqual(
        result[0].placements.map(({ designator, x, y, rotate, layer }) => ({ designator, x, y, rotate, layer })),
        first.states[0].placements?.map(({ designator, x, y, rotate, layer }) => ({ designator, x, y, rotate, layer })),
    );
});

nativeTest('native board packer rejects incompatible and non-finite input', () => {
    const addon = loadNativeBoardPacker();
    assert.throws(() => addon.solveBoardPacked({ ...minimalProblem(), version: 2 } as unknown as NativeBoardPackProblemV3), /unsupported contract/i);
    assert.throws(() => addon.solveBoardPacked({ ...minimalProblem(), grid: Number.NaN }), /not finite|serde_json::Number/i);
});

nativeTest('native board packer skips orientations wider than the board', () => {
    const addon = loadNativeBoardPacker();
    const problem = minimalProblem();
    problem.bounds = { left: -0.75, right: 0.75, top: -5, bottom: 5 };
    problem.fullBoardBounds = problem.bounds;
    problem.boardOutline = [
        { x: -0.75, y: -5 },
        { x: 0.75, y: -5 },
        { x: 0.75, y: 5 },
        { x: -0.75, y: 5 },
    ];

    const result = addon.solveBoardPacked(problem);

    assert.equal(result.states.length, 1);
    assert.ok(Number.isFinite(result.rank.score));
});

nativeTest('native board packer preserves locked edge-mounted overflow geometry', () => {
    const addon = loadNativeBoardPacker();
    const problem = minimalProblem();
    const primitive = problem.primitives[0];
    primitive.locked = true;
    primitive.canRotate = false;
    primitive.allowedOrientations = [0];
    primitive.bbox = { left: -7, right: -3, top: -1, bottom: 1 };
    primitive.collisionBoxes = [{ ...primitive.bbox }];
    primitive.placements = [{ designator: 'U1', x: -5, y: 0, rotate: 0, layer: 'top', score: 0 }];
    problem.components[0].bodyBox = { ...primitive.bbox };
    problem.components[0].boardOverflow.left = 2;

    const result = addon.solveBoardPacked(problem);

    assert.equal(result.rank.hardCount, 0);
    assert.equal(result.states[0].placements?.[0].x, -5);
    assert.equal(result.states[0].translationX, 0);
});

nativeTest('native passive island solver is deterministic and streams compact placements', () => {
    const addon = loadNativeBoardPacker();
    const problem = minimalPassiveIslandProblem();
    const first = addon.solvePassiveNetIsland(structuredClone(problem));
    const second = addon.solvePassiveNetIsland(structuredClone(problem));
    assert.deepEqual(second, first);
    assert.equal(first.version, 1);
    assert.equal(first.placements.length, 2);
    assert.equal(first.legal, true);
    assert.ok(first.evaluatedVariants > 0);
    assert.ok(Number.isFinite(first.score));
});

nativeTest('native passive island solver rejects malformed matrices', () => {
    const addon = loadNativeBoardPacker();
    assert.throws(
        () => addon.solvePassiveNetIsland({ ...minimalPassiveIslandProblem(), componentConflict: [] }),
        /component matrices/i,
    );
});

nativeTest('native block solver accepts the versioned contract directly', () => {
    const addon = loadNativeBoardPacker();
    const board = minimalProblem();
    const primitive = board.primitives[0];
    const solution = addon.solveBlockPrimitives({
        version: 2,
        grid: board.grid,
        clearance: board.clearance,
        searchWidth: 4,
        compactness: 'normal',
        bounds: board.bounds,
        collisionMode: 'components',
        hardCollisionMode: 'components',
        candidateBoxMode: 'bbox',
        primitives: [primitive],
        relations: [],
        obstacles: [],
        components: [{
            designator: 'U1',
            primitiveId: primitive.id,
            blockName: 'core',
            layer: 'top',
            bodyBox: primitive.bbox,
            throughHoleBoxes: [],
            pinCount: 1,
            role: 'ic',
            powerComponent: false,
        }],
        componentPairClearance: [0],
        componentConflict: [0],
    });
    assert.equal(addon.blockContractVersion(), 2);
    assert.equal(solution.version, 2);
    assert.equal(solution.states.length, 1);
    assert.ok(Number.isFinite(solution.rank.score));
});

nativeTest('native signal-path API is the shared evaluator and bridge generator', () => {
    const addon = loadNativeBoardPacker();
    const port = (order: number, x: number, y: number) => ({
        x, y, pathId: 'rf', order, ref: `P${order}`, role: order === 0 ? 'source' as const : 'target' as const,
        normal: { x: 0, y: 0 },
    });
    const evaluation = addon.evaluateSignalPath({
        version: 1,
        pathId: 'rf',
        ports: [port(0, 0, 0), port(1, 1, 0), port(2, 2, 0)],
        shape: 'straight',
        priority: 'normal',
        weight: 1,
        preferFacingPads: false,
    });
    assert.equal(addon.signalPathContractVersion(), 1);
    assert.ok(evaluation);
    assert.equal(evaluation.penalty, 0);
    const deltas = addon.signalPathBridgeDeltas({
        version: 1,
        movingPorts: [port(1, 0, 1)],
        placedPorts: [port(0, 0, 0), port(2, 2, 0)],
    });
    assert.deepEqual(deltas[0], { x: 1, y: -1 });
});

nativeTest('native post-place score owns ratsnest scoring', () => {
    const addon = loadNativeBoardPacker();
    const score = addon.scorePostPlace({
        version: 1,
        nets: [{ name: 'SIG', points: [{ x: 0, y: 0 }, { x: 3, y: 0 }], weight: 1 }],
        distances: [],
        clearances: [],
        fixedPenalties: [],
        edges: [],
        paths: [],
    });
    assert.equal(addon.postPlaceScoreContractVersion(), 1);
    assert.equal(score, 33.15);
});

function minimalProblem(): NativeBoardPackProblemV3 {
    const primitive = minimalPrimitive();
    return {
        version: 3,
        grid: 0.5,
        clearance: 0.2,
        searchWidth: 32,
        compactness: 'normal',
        bounds: { left: -5, right: 5, top: -5, bottom: 5 },
        fullBoardBounds: { left: -5, right: 5, top: -5, bottom: 5 },
        boardOutline: [
            { x: -5, y: -5 },
            { x: 5, y: -5 },
            { x: 5, y: 5 },
            { x: -5, y: 5 },
        ],
        edgeClearance: 0.2,
        primitives: [{
            ...primitive,
            sourceNodeIds: [primitive.sourceNodeId],
            locked: false,
            canRotate: true,
            allowedOrientations: [0, 90, 180, 270],
            collisionBoxes: primitive.collisionBoxes ?? [],
            pathPorts: [],
            edgePlace: null,
        }],
        relations: [],
        obstacles: [],
        constraintRegions: [],
        components: [{
            designator: 'U1',
            primitiveId: primitive.id,
            blockName: 'core',
            layer: 'top',
            bodyBox: primitive.bbox,
            throughHoleBoxes: [],
            boardOverflow: { left: 0, right: 0, top: 0, bottom: 0 },
            edgeClearance: 0.2,
        }],
        componentPairClearance: [0],
        componentConflict: [0],
    };
}

function minimalPrimitive(): PlacementPrimitive {
    return {
        id: 'primitive:core',
        kind: 'block',
        label: 'core',
        sourceNodeId: 'tree:block:core',
        locked: false,
        canRotate: true,
        allowedOrientations: [0, 90, 180, 270],
        bbox: { left: -1, right: 1, top: -0.5, bottom: 0.5 },
        collisionBoxes: [{ left: -1, right: 1, top: -0.5, bottom: 0.5 }],
        width: 2,
        height: 1,
        placements: [{ designator: 'U1', x: 0, y: 0, rotate: 0, layer: 'top', score: 0 }],
        connectionPoints: [{ ref: 'U1.1', net: 'SIG', x: 0.8, y: 0 }],
        children: [],
    };
}

function minimalPassiveIslandProblem(): NativePassiveIslandProblemV1 {
    const orientation = (rotation: number, padX: number) => ({
        rotation,
        width: 1,
        height: 0.5,
        bodyBox: { left: -0.5, right: 0.5, top: -0.25, bottom: 0.25 },
        throughHoleBoxes: [],
        pinPoints: [{ x: padX, y: 0 }, { x: -padX, y: 0 }],
    });
    return {
        version: 1,
        grid: 0.1,
        clearance: 0.2,
        mainNetId: 0,
        netNames: ['VCC', 'GND'],
        netGround: [false, true],
        components: [
            { id: 0, designator: 'C1', layer: 'top', pinNetIds: [0, 1], orientations: [orientation(0, 0.35), orientation(180, -0.35)] },
            { id: 1, designator: 'C2', layer: 'top', pinNetIds: [0, 1], orientations: [orientation(0, 0.35), orientation(180, -0.35)] },
        ],
        componentPairClearance: [0, 0.2, 0.2, 0],
        componentConflict: [0, 1, 1, 0],
    };
}
