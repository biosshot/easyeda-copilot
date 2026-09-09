import type { ElkNode, ElkExtendedEdge } from 'elkjs';
import type { PositionedSchNode } from '#types/auto-place.ts';
import type { CircuitComponent } from '#types/circuit.ts';
import type { SymbolWithMeta } from '#types/symbol.ts';
import type { MacroInstance } from './patterns/types.ts';
import { rotateSymbolGeometry } from './patterns/helpers.ts';
import { shortSymbolsMap } from './short-symbol.ts';

/** Final leaf geometry, including expanded macros and generated net symbols. */
export function createSchematicScene(positioned: readonly PositionedSchNode[], edges: ElkExtendedEdge[],
    symbols: readonly SymbolWithMeta[], added: readonly CircuitComponent[], macros: readonly MacroInstance[] = [], width = 0, height = 0): ElkNode {
    const originals = new Map(symbols.map(s => [s.designator, s.symbol]));
    const placements = new Map(macros.flatMap(m => m.placements.map(p => [p.designator, p] as const)));
    const flags = new Map(added.map(c => [c.designator, c]));
    const children = positioned.map(p => {
        const original = originals.get(p.designator), macro = placements.get(p.designator), flag = flags.get(p.designator);
        let ports: ElkNode['ports'];
        if (original) ports = rotateSymbolGeometry(original, p.rotate ?? 0).pins.map(pin => ({ id: `${p.designator}_pin_${pin.num}`, x: pin.x, y: pin.y, width: 0, height: 0 }));
        else if (flag) {
            const kind = Object.values(shortSymbolsMap).find(s => s.partUuid === flag.part_uuid);
            const base = kind?.create(flag.pins[0].signal_name, flag.block_name, flag.designator).node;
            if (base) ports = rotateSymbolGeometry({ width: base.width!, height: base.height!, center: { x: base.width! / 2, y: base.height! / 2 },
                pins: base.ports!.map(pin => ({ num: 1, name: '1', signal_name: flag.pins[0].signal_name, part: '', x: pin.x!, y: pin.y! })) }, p.rotate ?? 0)
                .pins.map(pin => ({ id: `${p.designator}_pin_1`, x: pin.x, y: pin.y, width: 0, height: 0 }));
        } else if (macro) ports = macro.pins.map(pin => ({ id: pin.id, x: pin.x, y: pin.y, width: 0, height: 0 }));
        if (!ports) throw new Error(`Missing placed symbol geometry: ${p.designator}`);
        return { id: p.designator, x: p.x, y: p.y, width: p.width, height: p.height, ports, rotation: p.rotate ?? 0, center: p.center };
    });
    return { id: 'scene', width, height, children, edges };
}
