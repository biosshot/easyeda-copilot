type Segment = [number, number, number, number];

export const LEGACY_PORT_LENGTHS = [20, 30, ...Array.from({ length: 39 }, (_, i) => 40 + i * 20), 15, 10, 5];

// Schematic units are 0.254 mm: 1.27 mm/character and 2.54 mm total padding.
const textLengthWithPadding = (net: string) => Array.from(net).length * 5 + 10;

export function wirePortMinLength(net: string): number {
    return Math.max(20, Math.ceil(textLengthWithPadding(net) / 10) * 10);
}

export function wirePortLengths(net: string, preferred?: number): number[] {
    const minimum = wirePortMinLength(net);
    return [...new Set([
        preferred ?? minimum, minimum,
        ...LEGACY_PORT_LENGTHS.filter(length => length > minimum),
        ...LEGACY_PORT_LENGTHS,
    ])].filter(length => Number.isFinite(length) && length > 0);
}

/** Source coordinates, directed from the component pin to the free wire end. */
export function wirePortLabel(net: string, segment: Segment) {
    if (!segment.every(Number.isFinite)) return undefined;
    const [pinX, pinY, endX, endY] = segment;
    const dx = endX - pinX, dy = endY - pinY;
    if ((!dx && !dy) || (dx && dy)) return undefined;
    const short = Math.abs(dx || dy) < textLengthWithPadding(net);
    // A 90-degree label reads toward negative source Y (positive native Y).
    const outwardAlongText = dx ? dx > 0 : dy < 0;
    const alignRight = short ? !outwardAlongText : outwardAlongText;
    const inset = short ? 0 : 5;
    return {
        x: endX - Math.sign(dx) * inset,
        y: endY - Math.sign(dy) * inset,
        rotation: dx ? 0 : 90,
        align: alignRight ? 'RIGHT_BOTTOM' : 'LEFT_BOTTOM',
    };
}

/** Keep the cosmetic hint only when normalization leaves an isolated straight stub. */
export function matchingWirePort(segments: Segment[], candidates: Segment[]): Segment | undefined {
    if (segments.length !== 1) return undefined;
    const [x1, y1, x2, y2] = segments[0];
    return candidates.find(([a, b, c, d]) =>
        (a === x1 && b === y1 && c === x2 && d === y2) ||
        (a === x2 && b === y2 && c === x1 && d === y1),
    );
}
