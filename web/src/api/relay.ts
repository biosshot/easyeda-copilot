/**
 * Relay client — runs inside the web/Electron app.
 *
 * Connects to the global server via WebSocket and proxies
 * raw fetch requests to local LLM endpoints (Ollama, LM Studio, etc.).
 *
 * Protocol: JSON over WebSocket
 *   Server → Client: { type: "fetch", id, input, init }
 *   Client → Server: { type: "headers", id, status, headers }  (streaming start)
 *                     { type: "chunk", id, data }               (streaming body)
 *                     { type: "done", id }                      (streaming end)
 *                     { type: "response", id, status, headers, body }  (non-streaming)
 *                     { type: "error", id, message }            (error)
 */

import { __MODE__ } from "../mode";

// ─── Config ────────────────────────────────────────────────────────────────

const RELAY_ID_STORAGE_KEY = 'relay-id';
const GLOBAL_WS_HOST = __MODE__ === 'DEV' ? 'ws://localhost:5120' : 'wss://circuit.tech.ru.net';
const RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;

const DEFAULT_ALLOWED_HOSTS = ['localhost', '127.0.0.1'];

// ─── Types ─────────────────────────────────────────────────────────────────

/** Incoming: server asks us to fetch */
type RelayFetchMessage = {
    type: 'fetch';
    id: string;
    input: string;
    init: {
        method: string;
        headers?: Record<string, string>;
        body?: string; // base64 encoded
    };
};

/** Incoming: server asks us to cancel an in-flight fetch */
type RelayCancelMessage = {
    type: 'cancel';
    id: string;
};

/** Outgoing: streaming headers */
type RelayHeadersMessage = {
    type: 'headers';
    id: string;
    status: number;
    headers: Record<string, string>;
};

/** Outgoing: streaming chunk */
type RelayChunkMessage = {
    type: 'chunk';
    id: string;
    data: string; // base64 encoded
};

/** Outgoing: streaming done */
type RelayDoneMessage = {
    type: 'done';
    id: string;
};

/** Outgoing: non-streaming response */
type RelayResponseMessage = {
    type: 'response';
    id: string;
    status: number;
    headers: Record<string, string>;
    body: string; // base64 encoded
};

/** Outgoing: error */
type RelayErrorMessage = {
    type: 'error';
    id: string;
    message: string;
};

type RelayOutMessage =
    | RelayHeadersMessage
    | RelayChunkMessage
    | RelayDoneMessage
    | RelayResponseMessage
    | RelayErrorMessage;

type StatusListener = (connected: boolean, error: string | null) => void;

// ─── Helpers ───────────────────────────────────────────────────────────────

function generateRelayId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = 'usr-';
    for (let i = 0; i < 8; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
}

function getOrCreateRelayId(): string {
    let id = localStorage.getItem(RELAY_ID_STORAGE_KEY);
    if (id && id.length >= 4 && id.length <= 64) return id;
    id = generateRelayId();
    localStorage.setItem(RELAY_ID_STORAGE_KEY, id);
    return id;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToString(b64: string): string {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const body = new TextDecoder().decode(bytes);
    return body;
}

function isUrlAllowed(url: string): boolean {
    try {
        const parsed = new URL(url);
        const hostOk = DEFAULT_ALLOWED_HOSTS.includes(parsed.hostname);
        return hostOk;
    } catch {
        return false;
    }
}

function isStreamingContentType(ct: string): boolean {
    return ct.includes('text/event-stream') || ct.includes('application/x-ndjson');
}

// ─── RelayConnection (singleton) ───────────────────────────────────────────

class RelayConnection {
    private ws: WebSocket | null = null;
    private relayId: string;
    private _connected = false;
    private _error: string | null = null;
    private listeners = new Set<StatusListener>();
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectAttempts = 0;
    private disposed = false;
    /** Active fetch requests — keyed by request id, used for cancellation */
    private activeControllers = new Map<string, AbortController>();

    constructor() {
        this.relayId = getOrCreateRelayId();
    }

    // ── Public API ──────────────────────────────────────────────────────

    getRelayId(): string {
        return this.relayId;
    }

    isConnected(): boolean {
        return this._connected;
    }

    getError(): string | null {
        return this._error;
    }

    onStatusChange(listener: StatusListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    reactivate(): void {
        this.disposed = false;
        this.reconnectAttempts = 0;
    }

    connect(): void {
        if (this.disposed) return;
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

        this._error = null;
        this.notify();

        const url = `${GLOBAL_WS_HOST}/ws/relay/${encodeURIComponent(this.relayId)}`;
        console.log(`[relay] connecting to ${url}`);

        try {
            this.ws = new WebSocket(url);
        } catch (err) {
            this._error = `WebSocket creation failed: ${(err as Error).message}`;
            this.scheduleReconnect();
            this.notify();
            return;
        }

        this.ws.onopen = () => {
            console.log('[relay] connected');
            this._connected = true;
            this._error = null;
            this.reconnectAttempts = 0;
            this.notify();
        };

        this.ws.onclose = (ev) => {
            console.log(`[relay] disconnected (code=${ev.code}, reason=${ev.reason})`);
            this._connected = false;
            this.ws = null;
            if (!this.disposed) {
                this.scheduleReconnect();
            }
            this.notify();
        };

        this.ws.onerror = () => {
            this._error = 'WebSocket error';
            this.notify();
        };

        this.ws.onmessage = (ev) => {
            this.handleRawMessage(ev.data);
        };
    }

    disconnect(): void {
        this.disposed = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.onmessage = null;
            this.ws.close();
            this.ws = null;
        }
        this._connected = false;
        this._error = null;
        this.notify();
    }

    // ── Internal ────────────────────────────────────────────────────────

    private notify() {
        for (const listener of this.listeners) {
            try {
                listener(this._connected, this._error);
            } catch { /* ignore */ }
        }
    }

    private scheduleReconnect() {
        if (this.disposed) return;
        if (this.reconnectTimer) return;

        const delay = Math.min(
            RECONNECT_DELAY_MS * Math.pow(1.5, this.reconnectAttempts),
            MAX_RECONNECT_DELAY_MS
        );
        this.reconnectAttempts++;

        console.log(`[relay] reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delay);
    }

    private send(msg: RelayOutMessage) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    private async handleRawMessage(raw: string | ArrayBuffer | Blob | BufferSource) {
        let text: string;
        if (typeof raw === 'string') {
            text = raw;
        } else if (raw instanceof Blob) {
            text = await raw.text();
        } else if (raw instanceof ArrayBuffer) {
            text = new TextDecoder().decode(raw);
        } else {
            text = new TextDecoder().decode(raw as unknown as ArrayBuffer);
        }

        let msg: RelayFetchMessage | RelayCancelMessage;
        try {
            msg = JSON.parse(text);
        } catch {
            console.warn('[relay] invalid JSON:', text);
            return;
        }

        if (msg.type === 'cancel') {
            this.handleCancel(msg);
            return;
        }

        if (msg.type !== 'fetch') return;

        await this.handleFetchRequest(msg);
    }

    private handleCancel(msg: RelayCancelMessage) {
        const controller = this.activeControllers.get(msg.id);
        if (controller) {
            console.log(`[relay] cancel request id=${msg.id}`);
            controller.abort();
            this.activeControllers.delete(msg.id);
        }
    }

    private async handleFetchRequest(msg: RelayFetchMessage) {
        const { id, input, init } = msg;

        console.log(`[relay] fetch request id=${id} ${init.method} ${input}`);

        // 1. Whitelist check
        if (!isUrlAllowed(input)) {
            this.send({ type: 'error', id, message: `URL not allowed: ${input}` });
            return;
        }

        // 2. Create AbortController for this request
        const controller = new AbortController();
        this.activeControllers.set(id, controller);

        try {
            // 3. Build fetch init
            const fetchInit: RequestInit = {
                method: init.method || 'GET',
                headers: init.headers || {},
                signal: controller.signal,
            };

            if (init.body) {
                fetchInit.body = base64ToString(init.body);
            }

            // 4. Execute fetch
            const response = await fetch(input, fetchInit);

            // 5. Collect response headers
            const respHeaders: Record<string, string> = {};
            response.headers.forEach((v, k) => {
                respHeaders[k] = v;
            });

            const ct = response.headers.get('content-type') || '';
            const isSSE = isStreamingContentType(ct);

            if (isSSE) {
                // 6a. Streaming response
                this.send({ type: 'headers', id, status: response.status, headers: respHeaders });

                if (!response.body) {
                    this.send({ type: 'done', id });
                    return;
                }

                const reader = response.body.getReader();

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        this.send({ type: 'chunk', id, data: arrayBufferToBase64(value.buffer) });
                    }
                } catch (readErr) {
                    // Stream interrupted — still send done so server can clean up
                    console.warn(`[relay] stream read error id=${id}:`, readErr);
                }

                this.send({ type: 'done', id });
            } else {
                // 6b. Non-streaming response
                const bodyBuffer = await response.arrayBuffer();
                this.send({
                    type: 'response',
                    id,
                    status: response.status,
                    headers: respHeaders,
                    body: arrayBufferToBase64(bodyBuffer),
                });
            }
        } catch (err) {
            // Don't send error for aborted requests — server already knows
            if ((err as Error).name !== 'AbortError') {
                this.send({
                    type: 'error',
                    id,
                    message: `Fetch failed: ${(err as Error).message}`,
                });
            }
        } finally {
            this.activeControllers.delete(id);
        }
    }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

let _instance: RelayConnection | null = null;

export function getRelayConnection(): RelayConnection {
    if (!_instance) {
        _instance = new RelayConnection();
    }
    return _instance;
}

export function startRelay(): void {
    const conn = getRelayConnection();
    conn.reactivate();
    conn.connect();
}

export function stopRelay(): void {
    const conn = getRelayConnection();
    conn.disconnect();
}

export function getRelayId(): string {
    return getRelayConnection().getRelayId();
}
