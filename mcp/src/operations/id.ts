import { randomBytes } from 'node:crypto';

export const OPERATION_KINDS = ['pcb-layout', 'pcb-dsl', 'mutation'] as const;

export type OperationKind = typeof OPERATION_KINDS[number];

export const OPERATION_ID_PATTERN = /^(pcb-layout|pcb-dsl|mutation):([0-9a-f]{8})$/;

export function createOperationId(kind: OperationKind) {
    return `${kind}:${randomBytes(4).toString('hex')}`;
}

export function parseOperationId(operationId: string) {
    const match = OPERATION_ID_PATTERN.exec(operationId);
    if (!match) {
        throw new Error(
            'Invalid operation_id. Expected pcb-layout:<8 hex>, pcb-dsl:<8 hex> or mutation:<8 hex>.',
        );
    }
    return { kind: match[1] as OperationKind, id: operationId };
}
