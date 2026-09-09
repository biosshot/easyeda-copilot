import { AsyncLocalStorage } from 'node:async_hooks';
import type { BoardPackParams } from './board-packer.ts';
import { applyNativeBoardPackSolution } from './native/apply-board-solution.ts';
import { NATIVE_BOARD_PACK_CONTRACT_VERSION } from './native/contract.ts';
import { encodeNativeBoardPackProblem } from './native/encode-board-problem.ts';
import { loadNativeBoardPacker } from './native/load-native-board-packer.ts';
import type { PlacementPrimitive } from './primitives.ts';

const boardPackerCapture = new AsyncLocalStorage<(params: BoardPackParams) => void>();

export function withBoardPackerCapture<T>(capture: (params: BoardPackParams) => void, run: () => T): T {
    return boardPackerCapture.run(capture, run);
}

export function solveBoardPackedPrimitives(params: BoardPackParams): PlacementPrimitive[] {
    boardPackerCapture.getStore()?.(params);
    return solveBoardPackedPrimitivesRust(params).result;
}

export function solveBoardPackedPrimitivesRust(params: BoardPackParams) {
    const addon = loadNativeBoardPacker();
    const nativeVersion = addon.contractVersion();
    if (nativeVersion !== NATIVE_BOARD_PACK_CONTRACT_VERSION) {
        throw new Error(`Rust PCB board packer contract ${nativeVersion} does not match TypeScript contract ${NATIVE_BOARD_PACK_CONTRACT_VERSION}`);
    }
    const nativeSolution = addon.solveBoardPacked(encodeNativeBoardPackProblem(params));
    return {
        result: applyNativeBoardPackSolution(params.primitives, nativeSolution),
        rank: nativeSolution.rank,
    };
}
