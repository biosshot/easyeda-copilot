/** Scene units. The same clearances govern placement candidates and routing.
 * Distances are multiples of the 5-unit CAD grid. Pin escape applies at the
 * terminal; wire spacing applies after fan-out. */
export const SCHEMATIC_CLEARANCE = Object.freeze({
    component: 20,
    port: 15,
    wire: 10,
    pinEscape: 15,
    branch: 30,
    bridge: 25,
    largeIC: 40,
});

/** Extra fan-out room applies to real neighbouring parts, not to net flags. */
export function componentClearance(a: { id: string; ports?: readonly unknown[] }, b: { id: string; ports?: readonly unknown[] }) {
    return [a, b].some(n => /^U/i.test(n.id) && (n.ports?.length ?? 0) >= 16)
        ? SCHEMATIC_CLEARANCE.largeIC : SCHEMATIC_CLEARANCE.component;
}

export const REFINEMENT_LIMITS = Object.freeze({
    members: 12, boundaryEdges: 8, candidates: 96, passes: 2,
    netSegments: 250, channels: 10,
});

export const LOCAL_SUPPLY_POLICY = Object.freeze({ minimumComponents: 16, minimumPins: 16 });
