export async function sleep(ms: number) {
    await new Promise(resolve => setTimeout(resolve, ms));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}