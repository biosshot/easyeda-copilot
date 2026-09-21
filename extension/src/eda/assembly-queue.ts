import type PQueue from 'p-queue';
import { withTimeout } from '../timeout';

export const ASSEMBLY_QUEUE_TIMEOUT_MS = 120_000;

export function runAssemblyQueueTask<T>(
    queue: PQueue,
    kind: 'schematic' | 'PCB',
    parentSignal: AbortSignal | undefined,
    action: (signal: AbortSignal) => PromiseLike<T>,
    timeoutMs = ASSEMBLY_QUEUE_TIMEOUT_MS,
) {
    const message = `${kind === 'PCB' ? 'PCB' : 'Schematic'} assembly timed out after ${timeoutMs / 1000} seconds. `
        + 'Already-started EasyEDA actions may still complete.';
    return queue.add(() => withTimeout(action, timeoutMs, message, parentSignal));
}
