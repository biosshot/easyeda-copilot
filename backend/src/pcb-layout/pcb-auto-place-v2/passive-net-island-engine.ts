import { AsyncLocalStorage } from 'node:async_hooks';
import type { PcbComponent, Placement, PlacementTreeNode } from '#types/pcb/layout-model.ts';
import {
    createPassiveNetIslandPrimitive,
    selectPassiveNetMainNet,
    type PassiveNetIslandOptions,
} from './passive-net-island.ts';
import {
    encodeNativePassiveIslandProblem,
    type PassiveNetIslandSolveParams,
} from './native/encode-passive-island-problem.ts';
import { NATIVE_PASSIVE_ISLAND_CONTRACT_VERSION } from './native/contract.ts';
import { loadNativeBoardPacker } from './native/load-native-board-packer.ts';
import type { PlacementPrimitive } from './primitives.ts';

const passiveIslandCapture = new AsyncLocalStorage<(params: PassiveNetIslandSolveParams) => void>();

export function withPassiveNetIslandCapture<T>(capture: (params: PassiveNetIslandSolveParams) => void, run: () => T): T {
    return passiveIslandCapture.run(capture, run);
}

export function solvePassiveNetIslandPrimitive(
    node: PlacementTreeNode,
    components: PcbComponent[],
    options: PassiveNetIslandOptions,
): PlacementPrimitive | null {
    const mainNet = selectPassiveNetMainNet(components);
    if (!mainNet) return null;
    const params = { node, components, options, mainNet };
    passiveIslandCapture.getStore()?.(params);
    return solvePassiveNetIslandPrimitiveRust(params).result;
}

export function solvePassiveNetIslandPrimitiveRust(params: PassiveNetIslandSolveParams) {
    const addon = loadNativeBoardPacker();
    const nativeVersion = addon.passiveIslandContractVersion();
    if (nativeVersion !== NATIVE_PASSIVE_ISLAND_CONTRACT_VERSION) {
        throw new Error(`Rust passive island contract ${nativeVersion} does not match TypeScript contract ${NATIVE_PASSIVE_ISLAND_CONTRACT_VERSION}`);
    }
    const solution = addon.solvePassiveNetIsland(encodeNativePassiveIslandProblem(params));
    const placements: Placement[] = solution.placements.map((placement) => {
        const component = params.components[placement.componentId];
        if (!component) throw new Error(`Rust passive island returned unknown component ${placement.componentId}`);
        return {
            designator: component.designator,
            x: placement.x,
            y: placement.y,
            rotate: placement.rotation,
            layer: component.pcb.allowedLayers[0] ?? 'top',
            score: 0,
        };
    });
    return {
        result: createPassiveNetIslandPrimitive(params.node, params.components, params.mainNet, placements),
        score: solution.score,
        legal: solution.legal,
        evaluatedVariants: solution.evaluatedVariants,
    };
}
