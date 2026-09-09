import { rotatePrimitive, translatePrimitive, type PlacementPrimitive } from '../primitives.ts';
import { roundPlacement } from '../../pcb-auto-place/geometry.ts';
import { NATIVE_BOARD_PACK_CONTRACT_VERSION, type NativePrimitivePackSolution } from './contract.ts';

export function applyNativeBoardPackSolution(
    primitives: PlacementPrimitive[],
    solution: NativePrimitivePackSolution,
    expectedVersion: number = NATIVE_BOARD_PACK_CONTRACT_VERSION,
) {
    if (solution.version !== expectedVersion) {
        throw new Error(`Unsupported native board pack solution version ${solution.version}`);
    }
    const states = new Map(solution.states.map((state) => [state.primitiveId, state]));
    const primitivesById = new Map(primitives.map((primitive) => [primitive.id, primitive]));
    if (states.size !== primitives.length) {
        throw new Error(`Native board packer returned ${states.size} primitive states for ${primitives.length} primitives`);
    }
    return solution.states.map((state) => {
        const primitive = primitivesById.get(state.primitiveId);
        if (!primitive) throw new Error(`Native board packer returned unknown primitive ${state.primitiveId}`);
        // Preserve fixed path endpoints byte-for-byte. They are routing anchors and
        // may carry more precision than the native placement grid.
        if (primitive.locked && (primitive.pathPorts?.length ?? 0) > 0
            && state.rotation === 0 && state.translationX === 0 && state.translationY === 0) {
            return primitive;
        }
        const rotated = rotatePrimitive(primitive, state.rotation);
        const transformed = translatePrimitive(rotated, state.translationX, state.translationY);
        if (state.placements) {
            const canonical = ({ designator, x, y, rotate, layer }: typeof state.placements[number]) => ({
                designator,
                x: roundPlacement(x),
                y: roundPlacement(y),
                rotate,
                layer,
            });
            const expected = JSON.stringify(state.placements.map(canonical));
            const actual = JSON.stringify(transformed.placements.map(canonical));
            if (expected !== actual) throw new Error(`Native primitive transform mismatch for ${primitive.id}: expected=${expected} actual=${actual}`);
        }
        return transformed;
    });
}
