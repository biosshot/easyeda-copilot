import type { ElkExtendedEdge } from 'elkjs';
import type { CircuitComponent } from '#types/circuit.ts';
import type { SymbolWithMeta } from '#types/symbol.ts';
import type { MacroInstance } from '../patterns/types.ts';
import { rotateSymbolGeometry } from '../patterns/helpers.ts';
import { isGroundSignal } from '../ground.ts';
import { type Placed, type Point, pinPositions, normal, shift, boundsOf, path, EPS } from './geometry.ts';
import { SCHEMATIC_CLEARANCE as gap, componentClearance } from './policy.ts';

export type LocalGroup = { ids: string[]; flexible?: string; flags: Map<string, string>; rotations?: readonly (90 | 180 | 270)[]; loneFlag?: boolean };
export type GroupPose = { nodes: Placed[]; transform?: (p: Point) => Point; requiresShorter?: boolean };

/** Membership follows physical terminal references. Sharing a supply name is
 * deliberately insufficient to attach a capacitor to a particular IC. */
export function localGroups(nodes: Placed[], edges: ElkExtendedEdge[], components: readonly CircuitComponent[],
    added: readonly CircuitComponent[], macros: readonly MacroInstance[]): LocalGroup[] {
    const owner = new Map(nodes.flatMap(n => (n.ports ?? []).map(p => [p.id, n.id])));
    const flags = new Set(added.map(c => c.designator)), used = new Set<string>();
    const groups: LocalGroup[] = [];
    for (const macro of macros) {
        const ids = macro.placements.map(p => p.designator).filter(id => nodes.some(n => n.id === id));
        // An input connector on a private series net can travel with the macro.
        // Preserve its orientation and all internal geometry; never absorb an IC.
        for (const c of components) {
            if (used.has(c.designator) || !/^(?:J|CN)\d/i.test(c.designator) || c.pins.length > 4 || c.block_name !== macro.blockName) continue;
            if (!c.pins.some(p => {
                if (!p.signal_name || /^NC$/i.test(p.signal_name) || isGroundSignal(p.signal_name)) return false;
                const endpoints = components.flatMap(other => other.pins.filter(q => q.signal_name && q.signal_name === p.signal_name).map(() => other.designator));
                return endpoints.length === 2 && endpoints.some(id => ids.includes(id));
            })) continue;
            ids.push(c.designator);
        }
        // An absorbed connector remains fixed in orientation. Rotation is
        // allowed only for explicitly opted-in, entirely two-pin passive macros.
        const rotatable = ids.length === macro.placements.length && ids.every(id => flags.has(id)
            || (!/^U/i.test(id) && nodes.find(n => n.id === id)?.ports?.length === 2));
        ids.forEach(id => used.add(id)); groups.push({ ids, flags: new Map(), rotations: rotatable ? macro.refinementRotations : undefined });
    }
    for (const c of [...components].sort((a, b) => a.designator.localeCompare(b.designator))) {
        if (used.has(c.designator) || c.pins.length !== 2 || /^U/i.test(c.designator)) continue;
        const attached = new Map<string, string>();
        for (const flag of flags) {
            if (used.has(flag)) continue;
            const incident = edges.filter(e => [...e.sources, ...e.targets].some(p => owner.get(p) === flag));
            const others = new Set(incident.flatMap(e => [...e.sources, ...e.targets]).filter(p => owner.get(p) !== flag));
            if (others.size === 1 && owner.get([...others][0]) === c.designator) attached.set(flag, [...others][0]);
        }
        const ids = [c.designator, ...attached.keys()]; ids.forEach(id => used.add(id));
        groups.push({ ids, flexible: c.designator, flags: attached });
    }
    // A rigid group's joint move may fail because only one flag is obstructed.
    // Each flag also gets a local attempt without moving its component/group.
    for (const id of [...flags].sort()) groups.push({ ids: [id], flags: new Map(), loneFlag: true });
    const byId = new Map(components.map(c => [c.designator, c]));
    const seriesPriority = (group: LocalGroup) => group.ids.some(id => {
        const c = byId.get(id);
        if (!c || c.pins.length !== 2 || c.pins.some(p => isGroundSignal(p.signal_name))) return false;
        const ownPins = new Set(c.pins.map(p => `${id}_pin_${p.pin_number}`));
        const attachments = new Set(edges.filter(e => [...e.sources, ...e.targets].some(p => ownPins.has(p)))
            .flatMap(e => [...e.sources, ...e.targets]).filter(p => !ownPins.has(p) && !group.ids.includes(owner.get(p)!))
            .filter(p => /^U/i.test(owner.get(p) ?? '') || (nodes.find(n => n.id === owner.get(p))?.ports?.length ?? 0) > 4));
        return attachments.size === 1;
    });
    // Reserve the narrow IC exit corridor for its small series attachment
    // before a tall shunt/divider group occupies that corridor on both sides.
    const priorities = new Map(groups.map(g => [g, seriesPriority(g)]));
    return groups.sort((a, b) => Number(priorities.get(b)) - Number(priorities.get(a))
        || (priorities.get(a) ? a.ids.length - b.ids.length : 0));
}

function alignFlags(pose: GroupPose, group: LocalGroup) {
    const nodes = pose.nodes.map(n => structuredClone(n)), component = nodes.find(n => n.id === group.flexible)!;
    const pins = pinPositions([component]);
    for (const [id, terminal] of group.flags) {
        const flag = nodes.find(n => n.id === id)!, port = flag.ports![0], anchor = pins.get(terminal)!;
        const outward = normal(component, terminal), inward = normal(flag, port.id);
        // A flag keeps its symbol orientation, but may lie on ANY side of its
        // owner. Opposing normals make a straight lead; others need two stubs.
        const opposed = outward.x * inward.x + outward.y * inward.y < -0.5;
        const target = shift(anchor, opposed ? { x: outward.x * gap.port, y: outward.y * gap.port }
            : { x: outward.x * gap.branch - inward.x * gap.pinEscape, y: outward.y * gap.branch - inward.y * gap.pinEscape });
        flag.x = target.x - port.x!; flag.y = target.y - port.y!;
    }
    return { ...pose, nodes };
}

/** Turn the body and its physical terminals together. Rotation metadata is
 * carried through to the serialized ASM, including generated supply symbols. */
export function turnNode(node: Placed, delta: number): Placed {
    const g = rotateSymbolGeometry({ width: node.width, height: node.height,
        center: node.center ?? { x: node.width / 2, y: node.height / 2 },
        pins: (node.ports ?? []).map(p => ({ num: p.id, name: '', signal_name: '', part: '', x: p.x!, y: p.y! })) }, delta);
    return { ...node, x: node.x + (node.width - g.width) / 2, y: node.y + (node.height - g.height) / 2,
        width: g.width, height: g.height, center: g.center, rotation: ((node.rotation ?? 0) + delta) % 360,
        ports: g.pins.map(p => ({ id: String(p.num), x: p.x, y: p.y, width: 0, height: 0 })) };
}

export function orientations(group: LocalGroup, current: Placed[], symbols: readonly SymbolWithMeta[]): GroupPose[] {
    const nodes = current.filter(n => group.ids.includes(n.id));
    const result: GroupPose[] = [{ nodes }];
    if (group.loneFlag && nodes.length === 1) result.push({ nodes: [turnNode(nodes[0], 180)] });
    if (group.rotations?.length && nodes.length) {
        const bounds = boundsOf(nodes), pivot = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        for (const rotation of group.rotations) {
            const transform = (p: Point) => {
                const x = p.x - pivot.x, y = p.y - pivot.y;
                return rotation === 180 ? { x: pivot.x - x, y: pivot.y - y }
                    : rotation === 90 ? { x: pivot.x + y, y: pivot.y - x } : { x: pivot.x - y, y: pivot.y + x };
            };
            const turned = nodes.map(n => {
                const next = turnNode(n, rotation), center = transform({ x: n.x + n.width / 2, y: n.y + n.height / 2 });
                return { ...next, x: center.x - next.width / 2, y: center.y - next.height / 2 };
            });
            result.push({ nodes: turned, transform, requiresShorter: true });
        }
    }
    const symbol = symbols.find(s => s.designator === group.flexible)?.symbol;
    const original = nodes.find(n => n.id === group.flexible);
    if (!symbol || !original || symbol.pins.length !== 2) return result;
    for (const rotation of [0, 90, 180, 270]) {
        const g = rotateSymbolGeometry(symbol, rotation);
        const n: Placed = { ...original, x: original.x + original.width / 2 - g.width / 2,
            y: original.y + original.height / 2 - g.height / 2, width: g.width, height: g.height,
            ports: g.pins.map(p => ({ id: `${original.id}_pin_${p.num}`, x: p.x, y: p.y, width: 0, height: 0 })), rotation, center: g.center };
        const pose = { nodes: nodes.map(old => old.id === n.id ? n : old) };
        result.push(alignFlags(pose, group));
        if (group.flags.size) result.push(alignFlags({ nodes: pose.nodes.map(n => group.flags.has(n.id) ? turnNode(n, 180) : n), requiresShorter: true }, group));
    }
    return result;
}

export function translations(pose: GroupPose, boundary: ElkExtendedEdge[], fixed: Placed[], rails: ElkExtendedEdge[], nets: ReadonlyMap<string, string>) {
    const own = pinPositions(pose.nodes), external = pinPositions(fixed);
    const anchors: Point[][] = [];
    for (const edge of boundary) {
        const result: Point[] = [];
        const aId = own.has(edge.sources[0]) ? edge.sources[0] : edge.targets[0];
        const bId = aId === edge.sources[0] ? edge.targets[0] : edge.sources[0];
        const a = own.get(aId), b = external.get(bId);
        if (!a || !b) continue;
        const aNode = pose.nodes.find(n => n.ports?.some(p => p.id === aId))!, bNode = fixed.find(n => n.ports?.some(p => p.id === bId))!;
        const an = normal(aNode, aId), bn = normal(bNode, bId);
        const opposed = an.x * bn.x + an.y * bn.y < -0.5;
        const bounds = boundsOf(pose.nodes);
        const loneFlag = pose.nodes.length === 1 && aNode.ports?.length === 1;
        const overhang = bn.x > EPS ? a.x - bounds.x : bn.x < -EPS ? bounds.x + bounds.width - a.x
            : bn.y > EPS ? a.y - bounds.y : bounds.y + bounds.height - a.y;
        const minimum = (loneFlag ? gap.port : componentClearance(aNode, bNode)) + Math.max(0, overhang);
        const distances = [Math.max(loneFlag ? gap.port : gap.branch, minimum), Math.max(gap.branch * 2, minimum + gap.branch)];
        distances.push((Math.abs(bn.x) > EPS ? bounds.width : bounds.height) + gap.port + gap.pinEscape);
        for (const d of distances) {
            const target = shift(b, opposed ? { x: bn.x * d, y: bn.y * d }
                : { x: bn.x * d - an.x * gap.pinEscape, y: bn.y * d - an.y * gap.pinEscape });
            result.push({ x: target.x - a.x, y: target.y - a.y });
        }
        // Search the neighbouring rows/columns too. A crowded flag row must
        // not force a service marker back to the far end of a long ELK lead.
        const base = result.slice(-distances.length);
        // A crowded pin-side corridor is not the only place for its load.
        // Try the adjacent faces of the anchor too (e.g. a pull-down below an
        // IC with left-side pins), with room for the required outward stub.
        const faceGap = (loneFlag ? gap.port : componentClearance(aNode, bNode)) + gap.pinEscape;
        if (Math.abs(bn.x) > EPS) {
            for (const y of [bNode.y + bNode.height + faceGap, bNode.y - faceGap - bounds.height]) {
                for (const x of [b.x, bNode.x + bNode.width / 2, b.x + bn.x * gap.branch]) result.push({ x: x - a.x, y: y - bounds.y });
            }
        } else {
            for (const x of [bNode.x + bNode.width + faceGap, bNode.x - faceGap - bounds.width]) {
                for (const y of [b.y, bNode.y + bNode.height / 2, b.y + bn.y * gap.branch]) result.push({ x: x - bounds.x, y: y - a.y });
            }
        }
        // A tall group may not fit beside the pin, yet can travel most of the
        // way there. Sample that approach instead of leaving it at the old rank.
        for (const fraction of [0.75, 0.5, 0.25]) result.push({ x: base[0].x * fraction, y: base[0].y * fraction });
        const neighbours = fixed.filter(n => n !== bNode && Math.abs(n.x + n.width / 2 - b.x) < 180
            && Math.abs(n.y + n.height / 2 - b.y) < 180).sort((a, c) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) - Math.abs(c.x - b.x) - Math.abs(c.y - b.y)).slice(0, 6);
        for (const d of base.slice(0, 2)) {
            const shifted = { x: bounds.x + d.x, y: bounds.y + d.y, width: bounds.width, height: bounds.height };
            for (const n of neighbours) {
                if (Math.abs(bn.x) > EPS) {
                    for (const y of [n.y - gap.port - shifted.height, n.y + n.height + gap.port]) result.push({ x: d.x, y: y - bounds.y });
                    const clearance = loneFlag ? gap.port : componentClearance(aNode, n);
                    const x = bn.x < 0 ? n.x - clearance - bounds.width : n.x + n.width + clearance;
                    result.push({ x: x - bounds.x, y: d.y });
                } else {
                    for (const x of [n.x - gap.port - shifted.width, n.x + n.width + gap.port]) result.push({ x: x - bounds.x, y: d.y });
                    const clearance = loneFlag ? gap.port : componentClearance(aNode, n);
                    const y = bn.y < 0 ? n.y - clearance - bounds.height : n.y + n.height + clearance;
                    result.push({ x: d.x, y: y - bounds.y });
                }
            }
        }
        // Attach to an existing rail along its normal, not just to the far-away
        // terminal used as the logical source of the ELK edge.
        for (const rail of [edge, ...rails.filter(r => nets.get(r.sources[0]) === nets.get(aId))].slice(0, 12)) {
            const p = path(rail);
            for (let i = 1; i < p.length; i++) {
                const start = p[i - 1], end = p[i], vertical = Math.abs(start.x - end.x) < EPS;
                if (vertical === (Math.abs(an.x) < EPS)) continue;
                const q = vertical ? { x: start.x, y: Math.max(Math.min(a.y, Math.max(start.y, end.y)), Math.min(start.y, end.y)) }
                    : { x: Math.max(Math.min(a.x, Math.max(start.x, end.x)), Math.min(start.x, end.x)), y: start.y };
                result.push({ x: q.x - an.x * gap.branch - a.x, y: q.y - an.y * gap.branch - a.y });
            }
        }
        anchors.push(result);
    }
    // Fairly sample both ends of a series part. Previously the first net's
    // obstacle channels could exhaust the budget before its IC pin was tried.
    const result: Point[] = [{ x: 0, y: 0 }];
    if (pose.nodes.length && boundary.length === 2) {
        const pairs = boundary.map(e => {
            const aId = own.has(e.sources[0]) ? e.sources[0] : e.targets[0];
            const bId = aId === e.sources[0] ? e.targets[0] : e.sources[0];
            return { a: own.get(aId), b: external.get(bId), node: fixed.find(n => n.ports?.some(p => p.id === bId)), bId };
        });
        const [a, b] = pairs;
        if (a.a && b.a && a.b && b.b && a.node && a.node === b.node) {
            const an = normal(a.node, a.bId), bn = normal(b.node!, b.bId);
            if (an.x === bn.x && an.y === bn.y) {
                const bounds = boundsOf(pose.nodes), middle = { x: (a.a.x + b.a.x) / 2, y: (a.a.y + b.a.y) / 2 };
                const extent = Math.abs(an.x) > EPS ? bounds.width / 2 : bounds.height / 2;
                for (const d of [gap.branch + extent, gap.branch * 2 + extent]) result.push({
                    x: (a.b.x + b.b.x) / 2 + an.x * d - middle.x,
                    y: (a.b.y + b.b.y) / 2 + an.y * d - middle.y,
                });
            } else if (an.x === -bn.x && an.y === -bn.y) {
                // A termination across opposite sides of one symbol belongs
                // beside its body, not beyond one arbitrarily chosen pin.
                const bounds = boundsOf(pose.nodes), node = a.node;
                if (Math.abs(an.x) > EPS) {
                    for (const y of [node.y + node.height + gap.branch, node.y - gap.branch - bounds.height]) result.push({
                        x: node.x + node.width / 2 - bounds.x - bounds.width / 2, y: y - bounds.y,
                    });
                } else {
                    for (const x of [node.x + node.width + gap.branch, node.x - gap.branch - bounds.width]) result.push({
                        x: x - bounds.x, y: node.y + node.height / 2 - bounds.y - bounds.height / 2,
                    });
                }
            }
        }
    }
    for (let i = 0; i < Math.max(0, ...anchors.map(a => a.length)); i++) for (const anchor of anchors) {
        if (anchor[i]) result.push(anchor[i]);
    }
    const seen = new Set<string>();
    return result.filter(d => {
        const key = `${d.x.toFixed(3)},${d.y.toFixed(3)}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
    });
}
