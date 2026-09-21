/** Bounds waiting, not native execution. Existing Promise callers need no changes. */
export function withTimeout<T>(
    action: (signal: AbortSignal) => PromiseLike<T>,
    timeout_ms: number,
    errorMessage?: string,
    parentSignal?: AbortSignal,
): Promise<T>;
export function withTimeout<T extends PromiseLike<unknown>>(
    promise: T,
    timeout_ms: number,
    errorMessage?: string,
    parentSignal?: AbortSignal,
): Promise<Awaited<T>>;
export async function withTimeout(
    promise: PromiseLike<unknown> | ((signal: AbortSignal) => PromiseLike<unknown>),
    timeout_ms: number,
    errorMessage = 'Operation timeout',
    parentSignal?: AbortSignal,
): Promise<unknown> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: () => void = () => {};
    const expired = new Promise<never>((_, reject) => {
        const stop = (reason: unknown) => {
            controller.abort(reason);
            reject(reason);
        };
        onAbort = () => stop(parentSignal!.reason);
        const timeout = () => stop(new Error(errorMessage));
        if (parentSignal?.aborted) onAbort();
        else if (timeout_ms <= 0) timeout();
        else {
            parentSignal?.addEventListener('abort', onAbort, { once: true });
            timer = setTimeout(timeout, timeout_ms);
        }
    });
    try {
        return await Promise.race([
            expired,
            typeof promise === 'function' ? Promise.resolve().then(() => {
                controller.signal.throwIfAborted();
                return promise(controller.signal);
            }) : promise,
        ]);
    } finally {
        clearTimeout(timer);
        parentSignal?.removeEventListener('abort', onAbort);
    }
}
