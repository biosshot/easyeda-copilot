import type { CircuitComponent } from '#types/circuit.ts';

/** Matches EasyEDA Copilot's placeNet/bulkAddNetAttachments rule: fewer than
 * five *unwired named pins per component*, not fewer than five physical pins.
 * Existing local supplies and cross-block ports already have routed endpoints.
 * Five or more missing attachments are left to the client's wire/net labels. */
export function singletonPortSignals(components: readonly CircuitComponent[],
    signalMap: Readonly<Record<string, { nodeId: string; portId: string }[] | undefined>>) {
    const byOwner = new Map<string, string[]>();
    const originalPins = new Map<string, string>(components.flatMap(c => c.pins.map(p =>
        [`${c.designator}_pin_${p.pin_number}`, p.signal_name] as const)));
    for (const [signal, endpoints] of Object.entries(signalMap)) {
        if (!signal.trim() || /^nc$/i.test(signal.trim()) || endpoints?.length !== 1) continue;
        const endpoint = endpoints[0];
        if (originalPins.get(endpoint.portId) !== signal) continue;
        const signals = byOwner.get(endpoint.nodeId) ?? [];
        signals.push(signal); byOwner.set(endpoint.nodeId, signals);
    }
    return [...byOwner.values()].filter(signals => signals.length < 5).flat();
}
