import type { PcbSchematicGroups } from 'eda-copilot-backend/pcb';
import type { ExplainCircuit } from '@copilot/shared/types/circuit';
import type { SchematicGroups } from '@copilot/shared/types/schematic-groups';

/** Translate EasyEDA's compact references into the backend's editor-independent contract. */
export function toPcbSchematicGroups(source: SchematicGroups, circuit: ExplainCircuit): PcbSchematicGroups {
    const designators = new Set(circuit.components.map(c => c.designator));
    let incomplete = !!source.errors?.length;
    const groups = source.maybe_blocks.flatMap(block => {
        const references = block.trim().split(/\s+/).filter(Boolean);
        const components = references.map(ref => designators.has(ref) ? ref : ref.replace(/\.\d+$/, ''));
        if (components.some(name => !designators.has(name))) { incomplete = true; return []; }
        return components.length ? [{ components: [...new Set(components)].sort() }] : [];
    });
    // Wire references name actual pins, whereas maybe_blocks references name symbol sections.
    const pinRefs = new Map<string, Array<{ designator: string; pin_number: string | number }>>();
    for (const component of circuit.components) for (const pin of component.pins) {
        const key = component.designator + '.' + String(pin.pin_number);
        const refs = pinRefs.get(key) ?? [];
        refs.push({ designator: component.designator, pin_number: pin.pin_number }); pinRefs.set(key, refs);
    }
    const wireIslands = (source.wires ?? []).flatMap(wire => {
        if (wire.net !== null && typeof wire.net !== 'string') { incomplete = true; return []; }
        const refs = [...new Set(wire.pins.trim().split(/\s+/).filter(Boolean))].sort();
        if (refs.some(ref => pinRefs.get(ref)?.length !== 1)) { incomplete = true; return []; }
        return refs.length >= 2 ? [{ net: wire.net, pins: refs.map(ref => pinRefs.get(ref)![0]) }] : [];
    });
    return { groups, ...(wireIslands.length ? { wireIslands } : {}), ...(incomplete ? { incomplete: true } : {}) };
}
