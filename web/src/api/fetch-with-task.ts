import { __MODE__ } from "../mode";
import { isEasyEda } from "../eda/utils";
import { getUserAuth } from "../eda/user";

type FetchWithTaskInput = {
    url: string,
    body: BodyInit,
    fetchOptions: RequestInit,
    pollIntervalMs?: number,
    timeoutMs?: number,
    onProgress?: ((s: string) => void)
}

export async function fetchEda(
    input: string | URL | Request,
    init?: RequestInit
) {
    if (!isEasyEda()) return fetch(input, init);

    const url = typeof input === 'string'
        ? input
        : input instanceof URL
            ? input.href
            : input.url;

    const method = (init?.method || 'GET').toUpperCase();
    if (!['GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        throw new TypeError(`Unsupported method: ${method}`);
    }

    let data;
    if (init?.body !== undefined) {
        if (typeof init.body === 'string' || init.body instanceof Blob || init.body instanceof FormData || init.body instanceof URLSearchParams || init.body instanceof ArrayBuffer || ArrayBuffer.isView(init.body)) {
            data = init.body;
            if (init.body instanceof ArrayBuffer || ArrayBuffer.isView(init.body)) {
                data = new Blob([init.body]);
            }
        } else {
            data = JSON.stringify(init.body);
            if (!init.headers || !('content-type' in init.headers) && !('Content-Type' in init.headers)) {
                init.headers = { ...init.headers, 'Content-Type': 'application/json' };
            }
        }
    }

    return await eda.sys_ClientUrl.request(url, method as any, data as any, { headers: init?.headers, integrity: init?.integrity });
}

export async function fetchWithTask({
    url,
    body,
    fetchOptions = {},
    pollIntervalMs = 2000,
    timeoutMs = Infinity,
    onProgress = undefined,
}: FetchWithTaskInput) {
    onProgress?.('Connecting...');

    const startRes = await fetchEda(apiUrl + url + '/start', {
        ...fetchOptions,

        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...fetchOptions.headers,
            'Authorization': authorization,
            'x-eda-user': getUserAuth(),
        },
        body: body,
    });

    if (!startRes.ok) {
        const text = await startRes.text();
        throw new Error(`Failed to start operation: ${startRes.status} ${text}`);
    }

    const { operationId } = await startRes.json();
    if (!operationId) throw new Error('Missing operationId');

    const statusUrl = `${apiUrl}${url}/status/${encodeURIComponent(operationId)}`;
    const cancelUrl = `${apiUrl}${url}/cancel/${encodeURIComponent(operationId)}`;
    const startTime = Date.now();
    let lastStatusUpdateTime = startTime;
    let lastProgressMessage = 'Processing...';
    const noUpdateTimeoutMs = 5000; // Если нет обновлений 5 сек, принудительно обновляем UI

    // support cancellation via AbortSignal passed in fetchOptions.signal
    const signal: AbortSignal | null | undefined = fetchOptions?.signal;

    // Handle abort signal by sending cancel request to server
    let abortHandler: (() => Promise<void>) | undefined;
    if (signal) {
        abortHandler = async () => {
            try {
                await fetchEda(cancelUrl, { method: 'DELETE', headers: { 'Authorization': authorization } });
            } catch (err) {
                console.error('Failed to cancel operation:', err);
            }
        };
        if (signal.aborted) {
            await abortHandler();
            throw new Error('Operation aborted');
        }
        signal.addEventListener('abort', abortHandler, { once: true });
    }

    try {
        while (true) {
            if (signal?.aborted) {
                throw new Error('Operation aborted');
            }

            if (Date.now() - startTime > timeoutMs) {
                throw new Error(`Operation timed out after ${timeoutMs} ms`);
            }

            const statusRes = await fetchEda(statusUrl, { ...fetchOptions, headers: { 'Authorization': authorization, ...fetchOptions.headers } });
            if (!statusRes.ok) {
                if (statusRes.status === 404) {
                    // wait but allow abort
                    await new Promise((res, rej) => {
                        const t = setTimeout(() => res(undefined), pollIntervalMs);
                        if (signal) {
                            signal.addEventListener('abort', () => {
                                clearTimeout(t);
                                rej(new Error('Operation aborted'));
                            }, { once: true });
                        }
                    });
                    continue;
                }
                const text = await statusRes.text();
                throw new Error(`Status check failed: ${statusRes.status} ${text}`);
            }

            const op: { status: string, result: any, error: string, intermediateResult: { action: string } } = await statusRes.json();

            const currentAction = op?.intermediateResult?.action;

            // Проверяем, изменилось ли действие
            if (currentAction && currentAction !== lastProgressMessage) {
                // Новое действие - обновляем
                onProgress?.(currentAction);
                lastStatusUpdateTime = Date.now();
                lastProgressMessage = currentAction;
            } else {
                // Действие не изменилось - проверяем, долго ли оно не меняется
                const timeSinceLastUpdate = Date.now() - lastStatusUpdateTime;
                if (timeSinceLastUpdate > noUpdateTimeoutMs) {
                    const elapsedSeconds = Math.round((Date.now() - lastStatusUpdateTime) / 1000);
                    const statusMessage = `${lastProgressMessage} (${elapsedSeconds}s)`;
                    onProgress?.(statusMessage);
                }
            }

            if (signal?.aborted) {
                throw new Error('Operation aborted');
            }

            if (op.status === 'completed') {
                if (op.result === undefined) throw new Error('Result missing');
                return op.result;
            }
            if (op.status === 'failed') {
                throw new Error(op.error || 'Operation failed');
            }

            await new Promise(res => setTimeout(res, pollIntervalMs));
        }
    } finally {
        // Clean up abort listener
        if (signal && abortHandler) {
            signal.removeEventListener('abort', abortHandler);
        }
    }
}

// @ts-ignore
export const apiUrl = __MODE__ === 'DEV' ? 'http://localhost:5120' : 'https://circuit.tech.ru.net';
export const authorization = 'Basic Y2lyY3VpdDp4eU9BTE5INHBmb05HNjB2VmtBNTg0MTg=';