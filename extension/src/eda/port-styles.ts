export type PortStyle = 'in' | 'out' | 'bi';
type Point = { x: number; y: number };
export type PinContact = Point & { designator: string; pin_number: string | number; signal_name: string };
export type PortContact = Point & { signal_name: string; style: PortStyle };

const EPS = 1e-4;
const key = ({ x, y }: Point) => `${Math.round(x / EPS)},${Math.round(y / EPS)}`;

function onSegment(point: Point, a: Point, b: Point): boolean {
    const dx = b.x - a.x, dy = b.y - a.y;
    return point.x >= Math.min(a.x, b.x) - EPS && point.x <= Math.max(a.x, b.x) + EPS
        && point.y >= Math.min(a.y, b.y) - EPS && point.y <= Math.max(a.y, b.y) + EPS
        && Math.abs((point.x - a.x) * dy - (point.y - a.y) * dx) <= EPS * Math.hypot(dx, dy);
}

/** Match each port to the nearest component pin on its physical wire island. */
export function matchPortStyles(pins: PinContact[], ports: PortContact[], segments: number[][]): Map<string, PortStyle> {
    const points = new Map<string, Point>();
    const edges = new Map<string, Map<string, number>>();
    const addPoint = (point: Point) => {
        const id = key(point);
        if (!points.has(id)) points.set(id, point);
        if (!edges.has(id)) edges.set(id, new Map());
        return id;
    };
    const contacts = [...pins, ...ports].filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    const validSegments = segments.filter(segment => segment.length >= 4 && segment.slice(0, 4).every(Number.isFinite));
    const vertices = [...contacts, ...validSegments.flatMap(segment => [
        { x: segment[0], y: segment[1] }, { x: segment[2], y: segment[3] },
    ])];
    for (const point of vertices) addPoint(point);
    for (const segment of validSegments) {
        const a = { x: segment[0], y: segment[1] }, b = { x: segment[2], y: segment[3] };
        const along = vertices.filter(point => onSegment(point, a, b));
        along.sort((u, v) => (u.x - v.x) * (b.x - a.x) + (u.y - v.y) * (b.y - a.y));
        for (let i = 1; i < along.length; i++) {
            const left = addPoint(along[i - 1]), right = addPoint(along[i]);
            if (left === right) continue;
            const distance = Math.hypot(along[i].x - along[i - 1].x, along[i].y - along[i - 1].y);
            edges.get(left)!.set(right, distance);
            edges.get(right)!.set(left, distance);
        }
    }

    const matches = new Map<string, PortStyle>();
    const conflicts = new Set<string>();
    for (const port of ports) {
        const start = key(port);
        if (!edges.has(start) || !port.signal_name) continue;
        const distances = new Map<string, number>([[start, 0]]);
        const visited = new Set<string>();
        while (visited.size < distances.size) {
            let current: string | undefined;
            for (const id of distances.keys()) {
                if (!visited.has(id) && (current === undefined || distances.get(id)! < distances.get(current)!)) current = id;
            }
            if (current === undefined) break;
            visited.add(current);
            for (const [next, length] of edges.get(current) ?? []) {
                const distance = distances.get(current)! + length;
                if (distance < (distances.get(next) ?? Infinity)) distances.set(next, distance);
            }
        }
        const candidates = pins
            .filter(pin => pin.signal_name === port.signal_name && distances.has(key(pin)))
            .map(pin => ({ pin, distance: distances.get(key(pin))! }))
            .sort((a, b) => a.distance - b.distance);
        if (!candidates.length || (candidates[1] && Math.abs(candidates[0].distance - candidates[1].distance) < EPS)) continue;
        const target = `${candidates[0].pin.designator}.${candidates[0].pin.pin_number}`;
        if (matches.has(target) && matches.get(target) !== port.style) conflicts.add(target);
        else matches.set(target, port.style);
    }
    for (const target of conflicts) matches.delete(target);
    return matches;
}

/** Optional read: unsupported or malformed port APIs leave the schematic unchanged. */
export async function readPortStyles(pins: PinContact[]): Promise<Map<string, PortStyle>> {
    try {
        if (!pins.length || typeof eda.sch_PrimitiveComponent.getAll !== 'function'
            || typeof eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId !== 'function'
            || typeof eda.sch_PrimitiveWire.getAll !== 'function') return new Map();
        const primitives = await eda.sch_PrimitiveComponent.getAll();
        const ports: PortContact[] = [];
        for (const primitive of primitives) {
            try {
                if (primitive.getState_ComponentType() !== ESCH_PrimitiveComponentType.NET_PORT) continue;
                const net = primitive.getState_Net?.()
                    || primitive.getState_OtherProperty?.()?.['Global Net Name'];
                if (typeof net !== 'string' || !net.trim()) continue;
                const portPins = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(primitive.getState_PrimitiveId());
                if (!Array.isArray(portPins) || portPins.length !== 1) continue;
                const portPin = portPins[0];
                const pinType = portPin.getState_pinType?.();
                if (pinType !== 'IN' && pinType !== 'OUT' && pinType !== 'BI') continue;
                ports.push({ x: portPin.getState_X(), y: portPin.getState_Y(), signal_name: net, style: pinType.toLowerCase() as PortStyle });
            } catch { /* A broken port must not prevent reading the page. */ }
        }
        if (!ports.length) return new Map();
        const { normalizeWireLine } = await import('./utils');
        const wires = await eda.sch_PrimitiveWire.getAll();
        const segments = wires.flatMap(wire => {
            try { return normalizeWireLine(wire.getState_Line()); }
            catch { return []; }
        });
        return matchPortStyles(pins, ports, segments);
    } catch { return new Map(); }
}
