export function stripNulls<T>(value: T): T {
    if (Array.isArray(value)) {
        return value
            .map((item) => stripNulls(item))
            .filter((item) => item !== null && item !== undefined) as T;
    }

    if (value && typeof value === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(value)) {
            const stripped = stripNulls(item);
            if (stripped !== null && stripped !== undefined) {
                result[key] = stripped;
            }
        }
        return result as T;
    }

    return value;
}

export function roundForMessage(value: number) {
    return Number(value.toFixed(3));
}
