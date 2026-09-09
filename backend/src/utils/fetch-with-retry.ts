import fetchRetry from 'fetch-retry';

const fetchWithAgent = (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers as never);

    // Устанавливаем User-Agent, если не задан
    if (!headers.has('User-Agent')) {
        // headers.set('User-Agent', 'Mozilla/5.0 (compatible; Node.js;)');
        headers.set('User-Agent', 'node');
    }

    return globalThis.fetch(url, {
        ...options,
        headers,
    });
};

export const fetchWithRetry = fetchRetry(fetchWithAgent, {
    retries: 3,
    retryDelay: 1000,
});