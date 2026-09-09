import { AsyncLocalStorage } from 'node:async_hooks';
import type { BlockSolveParams } from './block-solver.ts';
import { applyNativeBoardPackSolution } from './native/apply-board-solution.ts';
import { NATIVE_BLOCK_SOLVE_CONTRACT_VERSION } from './native/contract.ts';
import { encodeNativeBlockSolveProblem } from './native/encode-block-problem.ts';
import { loadNativeBoardPacker } from './native/load-native-board-packer.ts';
import type { PlacementPrimitive } from './primitives.ts';

const blockSolverCapture = new AsyncLocalStorage<(params: BlockSolveParams) => void>();

export function withBlockSolverCapture<T>(capture: (params: BlockSolveParams) => void, run: () => T): T {
    return blockSolverCapture.run(capture, run);
}

export function solveBlockPrimitives(params: BlockSolveParams): PlacementPrimitive[] {
    blockSolverCapture.getStore()?.(params);
    return solveBlockPrimitivesRust(params).result;
}

export function solveBlockPrimitivesRust(params: BlockSolveParams) {
    const addon = loadNativeBoardPacker();
    const nativeVersion = addon.blockContractVersion();
    if (nativeVersion !== NATIVE_BLOCK_SOLVE_CONTRACT_VERSION) {
        throw new Error(`Rust PCB block solver contract ${nativeVersion} does not match TypeScript contract ${NATIVE_BLOCK_SOLVE_CONTRACT_VERSION}`);
    }
    const solution = addon.solveBlockPrimitives(encodeNativeBlockSolveProblem(params));
    return { result: applyNativeBoardPackSolution(params.primitives, solution, NATIVE_BLOCK_SOLVE_CONTRACT_VERSION), rank: solution.rank };
}
