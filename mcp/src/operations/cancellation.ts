import { AsyncLocalStorage } from 'node:async_hooks';

const execution = new AsyncLocalStorage<AbortSignal>();
export const currentSignal = () => execution.getStore();
export function withExecutionSignal<T>(signal: AbortSignal, action: () => T): T {
    signal.throwIfAborted();
    return execution.run(signal, action);
}

/** Stop waiting without replaying or pretending that native work was rolled back. */
export function abortable<T>(promise: Promise<T>, signal?: AbortSignal, onAbort?: () => void): Promise<T> {
    if (!signal) return promise;
    return new Promise<T>((resolve, reject) => {
        let settled = false;
        const finish = (action: () => void) => {
            if (settled) return;
            settled = true;
            signal.removeEventListener('abort', abort);
            action();
        };
        const abort = () => finish(() => {
            try { onAbort?.(); }
            finally { reject(signal.reason ?? new Error('Request cancelled')); }
        });
        if (signal.aborted) abort();
        else signal.addEventListener('abort', abort, { once: true });
        promise.then(value => finish(() => resolve(value)), error => finish(() => reject(error)));
    });
}
