/** The cross-page hint is optional; schematic assembly must work without it. */
export async function readOtherPageSignals(request: () => Promise<unknown>): Promise<string[]> {
    try {
        const signals = await request();
        return Array.isArray(signals) && signals.every(signal => typeof signal === 'string')
            ? signals : [];
    } catch {
        return [];
    }
}
