export async function fetchEda(
    input: string | URL | Request,
    init?: RequestInit
) {
    console.log('fetchEda', input, init);
    if (!("eda" in window)) return fetch(input, init);

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
    pollIntervalMs = 5000,
    timeoutMs = Infinity,
    onProgress = undefined,
}: { url: string, body: string, fetchOptions: RequestInit, pollIntervalMs: number, timeoutMs: number, onProgress: ((s: string) => any) | undefined }) {
    const startRes = await fetchEda(url + '/start', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...fetchOptions.headers,
            'Authorization': authorization,
        },
        body: body,
        // mode: 'no-cors',
        ...fetchOptions,
    });

    if (!startRes.ok) {
        const text = await startRes.text();
        throw new Error(`Failed to start operation: ${startRes.status} ${text}`);
    }

    const { operationId } = await startRes.json();
    if (!operationId) throw new Error('Missing operationId');

    const statusUrl = `${url}/status/${encodeURIComponent(operationId)}`;
    const cancelUrl = `${url}/cancel/${encodeURIComponent(operationId)}`;
    const startTime = Date.now();
    onProgress?.('pending');

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

            const op = await statusRes.json();
            onProgress?.(op.status);

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

// export const apiUrl = 'http://localhost:5120';

export const apiUrl = 'https://circuit.tech.ru.net';
export const authorization = 'Basic Y2lyY3VpdDp4eU9BTE5INHBmb05HNjB2VmtBNTg0MTg=';