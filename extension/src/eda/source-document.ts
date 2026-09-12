export interface SourceRecord {
    outer: Record<string, unknown>;
    inner: Record<string, unknown> | null;
}

const stripRecordTerminator = (value: string) => value.endsWith('|') ? value.slice(0, -1) : value;

export function parseDocumentSource(source: string): SourceRecord[] {
    return source
        .split(/\r?\n/)
        .filter(line => line.length > 0)
        .map((line, index) => {
            const separator = line.indexOf('||');
            if (separator < 0) throw new Error(`Malformed document source at line ${index + 1}: missing ||`);

            const outerText = line.slice(0, separator);
            const innerText = stripRecordTerminator(line.slice(separator + 2));

            try {
                return {
                    outer: JSON.parse(outerText) as Record<string, unknown>,
                    inner: innerText ? JSON.parse(innerText) as Record<string, unknown> : null,
                };
            } catch (error) {
                throw new Error(`Malformed document source at line ${index + 1}: ${(error as Error).message}`);
            }
        });
}

export function serializeSourceRecord(record: SourceRecord, terminate: boolean): string {
    const inner = record.inner === null ? '' : JSON.stringify(record.inner);
    return `${JSON.stringify(record.outer)}||${inner}${terminate ? '|' : ''}`;
}

export function serializeDocumentSource(records: SourceRecord[]): string {
    return records
        .map((record, index) => serializeSourceRecord(record, index < records.length - 1))
        .join('\n');
}

/**
 * getDocumentSource() omits the final pipe from the last record. A newly
 * appended block therefore needs `|\n` at the boundary, while its own last
 * record must remain unterminated.
 */
export function appendDocumentSource(source: string, records: SourceRecord[]): string {
    if (!records.length) return source;

    const normalizedSource = source.replace(/\n+$/, '');
    const terminatedSource = normalizedSource.endsWith('|') ? normalizedSource : `${normalizedSource}|`;
    return `${terminatedSource}\n${serializeDocumentSource(records)}`;
}

export function getMaxTicket(records: SourceRecord[]): number {
    return records.reduce((max, record) => {
        const ticket = Number(record.outer.ticket);
        return Number.isFinite(ticket) ? Math.max(max, ticket) : max;
    }, 0);
}

export function getMaxZIndex(records: SourceRecord[]): number {
    return records.reduce((max, record) => {
        const zIndex = Number(record.inner?.zIndex);
        return Number.isFinite(zIndex) ? Math.max(max, zIndex) : max;
    }, 0);
}

export function makeSourceId(): string {
    return crypto.randomUUID().replaceAll('-', '').slice(0, 16);
}

export function cloneSourceRecord(record: SourceRecord): SourceRecord {
    return {
        outer: structuredClone(record.outer),
        inner: record.inner === null ? null : structuredClone(record.inner),
    };
}
