import { isRecord, sleep } from "./utils";

export const apiUrl = true ? 'http://localhost:5120' : 'https://circuit.tech.ru.net';
export const COPILOT_SERVER_URL = (process.env.EASYEDA_COPILOT_SERVER_URL || apiUrl).replace(/\/$/, '');
export const SERVER_AUTHORIZATION = 'Basic Y2lyY3VpdDp4eU9BTE5INHBmb05HNjB2VmtBNTg0MTg=';

export type AsyncOperationResponse<T = unknown> = {
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
    result?: T;
    intermediateResult?: unknown;
    error?: string;
    createdAt: string;
    completedAt?: string;
};

async function parseJsonResponse(response: Response) {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

export async function postJson(path: string, payload: unknown): Promise<unknown> {
    const response = await fetch(`${COPILOT_SERVER_URL}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': SERVER_AUTHORIZATION
        },
        body: JSON.stringify(payload),
    });

    const data = await parseJsonResponse(response);

    if (!response.ok) {
        const message = typeof data === 'object' && data && 'error' in data
            ? String(data.error)
            : `HTTP ${response.status}`;
        throw new Error(message);
    }

    return data;
}

export function asyncProgressText(intermediate: unknown) {
    if (!isRecord(intermediate)) return undefined;
    if (typeof intermediate.stage === 'string' && typeof intermediate.progress === 'number') {
        const percent = Math.max(0, Math.min(100, Math.round(intermediate.progress)));
        const content = typeof intermediate.content === 'string' ? intermediate.content : `PCB layout stage: ${intermediate.stage}`;
        return `${percent}% ${intermediate.stage}: ${content}`;
    }
    if (typeof intermediate.content === 'string') return intermediate.content;
    if (typeof intermediate.action === 'string') return intermediate.action;
    if (typeof intermediate.stage === 'string') return `PCB layout stage: ${intermediate.stage}`;
    return undefined;
}

export async function cancelAsyncTask(path: string, operationId: string) {
    const cancelResponse = await fetch(`${COPILOT_SERVER_URL}${path}/cancel/${encodeURIComponent(operationId)}`, {
        headers: { 'Authorization': SERVER_AUTHORIZATION },
    });
    const result = await parseJsonResponse(cancelResponse);

    if (!cancelResponse.ok) {
        throw new Error(`Cancel failed: ${cancelResponse.status} ${JSON.stringify(result)}`);
    }

    return result;
}

export async function getAsyncTaskStatus<T = unknown>(path: string, operationId: string) {
    const statusResponse = await fetch(`${COPILOT_SERVER_URL}${path}/status/${encodeURIComponent(operationId)}`, {
        headers: { 'Authorization': SERVER_AUTHORIZATION },
    });
    const operation = await parseJsonResponse(statusResponse) as AsyncOperationResponse<T>;

    if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status} ${JSON.stringify(operation)}`);
    }

    return operation;
}

export async function waitForAsyncTask<T = unknown>(path: string, operationId: string, options: {
    pollIntervalMs?: number;
    waitMs?: number;
} = {}) {
    const pollIntervalMs = options.pollIntervalMs ?? 2000;
    const waitMs = options.waitMs ?? 60_000;
    const startedAt = Date.now();
    let lastProgress = '';

    while (true) {
        const operation = await getAsyncTaskStatus<T>(path, operationId);
        const progress = asyncProgressText(operation.intermediateResult);
        if (progress && progress !== lastProgress) {
            lastProgress = progress;
            console.error(`[make_pcb_layout] ${progress}`);
        }

        if (operation.status !== 'pending') {
            return operation;
        }

        if (Date.now() - startedAt >= waitMs) {
            return operation;
        }

        await sleep(Math.min(pollIntervalMs, Math.max(0, waitMs - (Date.now() - startedAt))));
    }
}

export async function startAsyncTask(path: string, payload: unknown) {
    const startResponse = await fetch(`${COPILOT_SERVER_URL}${path}/start`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': SERVER_AUTHORIZATION,
        },
        body: JSON.stringify(payload),
    });

    const startData = await parseJsonResponse(startResponse);
    if (!startResponse.ok) {
        throw new Error(`Failed to start operation: ${startResponse.status} ${JSON.stringify(startData)}`);
    }

    const operationId = isRecord(startData) && typeof startData.operationId === 'string'
        ? startData.operationId
        : undefined;
    if (!operationId) throw new Error('Missing operationId');

    return operationId;
}