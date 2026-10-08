import * as z from 'zod/v4';
import { readFile } from 'node:fs/promises';
import type { ExplainCircuit } from '@copilot/shared/types/circuit';
import type { Bridge } from '../../bridge';

const ExistingPlacementSchema = z.object({
    board: z.object({
        polygon: z.array(z.object({ x: z.number(), y: z.number() }).strict()).min(3),
    }).strict(),
    components: z.array(z.object({
        designator: z.string().min(1),
        x: z.number(), y: z.number(), rotate: z.number(),
        layer: z.enum(['top', 'bottom']),
    }).strict()),
}).strict();

function placementForCircuit(value: unknown, circuit: ExplainCircuit) {
    if (value === undefined || value === null) return undefined;
    const placement = ExistingPlacementSchema.parse(value);
    const circuitDesignators = new Map(circuit.components.map(component => [
        component.designator.trim().toUpperCase(), component.designator,
    ]));
    const seen = new Set<string>();
    const components = placement.components.flatMap(component => {
        const key = component.designator.trim().toUpperCase();
        const designator = circuitDesignators.get(key);
        if (!designator) return [];
        if (seen.has(key)) throw new Error(`Ambiguous EasyEDA PCB designator: ${designator}`);
        seen.add(key);
        return [{ ...component, designator }];
    });
    return { board: placement.board, components };
}

/** Shared snapshot order and normalization for placement and intent validation. */
export async function readPcbLayoutInput(bridge: Bridge, file: string) {
    // Capture placement before schematic extraction changes the active EasyEDA document.
    const [code, rawExistingPlacement] = await Promise.all([
        readFile(file, 'utf8'),
        bridge.requestEasyEda('get-pcb-existing-placement'),
    ]);
    const circuit = await bridge.requestEasyEda(
        'get-multi-page-schematic', { extractFootprintUuid: true },
    ) as ExplainCircuit;
    const existingPlacement = placementForCircuit(rawExistingPlacement, circuit);
    return { code, circuit, ...(existingPlacement ? { existingPlacement } : {}) };
}
