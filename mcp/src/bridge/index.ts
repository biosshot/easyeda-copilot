import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';

type WsMessage = {
    event: string;
    body: string;
};

export type EasyEdaInstance = {
    instanceId: string;
    projectName: string;
    connectedAt: number;
    lastSeenAt: number;
};

export type Bridge = {
    requestEasyEda(event: string, body?: Record<string, unknown>, timeoutMs?: number): Promise<unknown>;
    listEasyEdaInstances(): Promise<EasyEdaInstance[]>;
    selectEasyEdaInstance(instanceId: string): Promise<EasyEdaInstance>;
    getSelectedEasyEdaInstance(): Promise<EasyEdaInstance | undefined>;
};

type PendingRequest = {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timer: ReturnType<typeof setTimeout>;
    targetInstanceId?: string;
};

type EasyEdaClient = EasyEdaInstance & {
    socket: WebSocket;
};

type SocketRole = 'unknown' | 'easyeda' | 'proxy';

const ROLE = Symbol('easyeda-copilot-bridge-role');
const INSTANCE_ID = Symbol('easyeda-copilot-easyeda-instance-id');

type RoleSocket = WebSocket & {
    [ROLE]?: SocketRole;
    [INSTANCE_ID]?: string;
};

function parseBody<T = Record<string, unknown>>(message: WsMessage): T {
    return message.body ? JSON.parse(message.body) as T : {} as T;
}

function sendWs(socket: WebSocket, message: WsMessage) {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(message));
}

function toError(error: unknown) {
    return error instanceof Error ? error : new Error(error ? String(error) : 'Unknown bridge error');
}

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function electionDelayMs() {
    return 100 + Math.floor(Math.random() * 901);
}

const RECOVERY_WAIT_MS = Number(process.env.EASYEDA_COPILOT_MCP_RECOVERY_WAIT_MS || 10_000);
const RECOVERY_POLL_MS = 500;

class OwnerBroker {
    private readonly easyEdaClients = new Map<string, EasyEdaClient>();
    private readonly pendingEasyEdaRequests = new Map<string, PendingRequest>();
    private readonly staleTimer: ReturnType<typeof setInterval>;

    constructor(private readonly server: WebSocketServer) {
        this.server.on('connection', socket => this.handleConnection(socket as RoleSocket));
        this.staleTimer = setInterval(() => this.removeStaleEasyEdaClients(), 10_000);
    }

    close() {
        clearInterval(this.staleTimer);
        for (const pending of this.pendingEasyEdaRequests.values()) {
            clearTimeout(pending.timer);
            pending.reject(new Error('EasyEDA bridge owner closed.'));
        }
        this.pendingEasyEdaRequests.clear();
        for (const client of this.easyEdaClients.values()) {
            client.socket.close();
        }
        this.easyEdaClients.clear();
        this.server.close();
    }

    listEasyEdaInstances() {
        return [...this.easyEdaClients.values()].map(client => ({
            instanceId: client.instanceId,
            projectName: client.projectName,
            connectedAt: client.connectedAt,
            lastSeenAt: client.lastSeenAt,
        }));
    }

    requestEasyEda(event: string, body: Record<string, unknown> = {}, timeoutMs = 120_000, targetInstanceId?: string) {
        const client = this.resolveEasyEdaClient(targetInstanceId);
        const id = randomUUID();

        const response = new Promise<unknown>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingEasyEdaRequests.delete(id);
                reject(new Error(`Timeout waiting EasyEDA event: ${event}`));
            }, timeoutMs);

            this.pendingEasyEdaRequests.set(id, {
                resolve,
                reject,
                timer,
                targetInstanceId: client.instanceId,
            });
        });

        sendWs(client.socket, {
            event,
            body: JSON.stringify({ ...body, id }),
        });

        return response;
    }

    private handleConnection(socket: RoleSocket) {
        socket[ROLE] = 'unknown';

        sendWs(socket, {
            event: 'connected',
            body: JSON.stringify({ ok: true }),
        });

        socket.on('message', data => {
            try {
                const raw = typeof data === 'string' ? data : data.toString();
                this.handleMessage(socket, JSON.parse(raw) as WsMessage);
            } catch {
                socket.close();
            }
        });

        socket.on('close', () => this.removeSocket(socket));
        socket.on('error', () => this.removeSocket(socket));
    }

    private handleMessage(socket: RoleSocket, message: WsMessage) {
        if (message.event === 'ping') {
            this.touchEasyEdaSocket(socket);
            sendWs(socket, {
                event: 'pong',
                body: message.body || JSON.stringify({ ok: true }),
            });
            return;
        }

        if (message.event === 'easyeda:hello') {
            this.registerEasyEdaClient(socket, parseBody(message));
            return;
        }

        if (message.event === 'proxy:hello') {
            socket[ROLE] = 'proxy';
            sendWs(socket, {
                event: 'proxy:hello:result',
                body: JSON.stringify({ ok: true }),
            });
            return;
        }

        if (socket[ROLE] === 'proxy') {
            this.handleProxyMessage(socket, message);
            return;
        }

        this.handleEasyEdaMessage(socket, message);
    }

    private registerEasyEdaClient(socket: RoleSocket, body: unknown) {
        if (!body || typeof body !== 'object') return;
        const value = body as Record<string, unknown>;
        const instanceId = typeof value.instanceId === 'string' && value.instanceId.trim()
            ? value.instanceId.trim()
            : randomUUID();
        const projectName = typeof value.projectName === 'string' && value.projectName.trim()
            ? value.projectName.trim()
            : 'Untitled EasyEDA project';

        const existing = this.easyEdaClients.get(instanceId);
        if (existing && existing.socket !== socket) {
            existing.socket.close();
            this.rejectPendingForInstance(instanceId, 'EasyEDA instance reconnected.');
        }

        const now = Date.now();
        socket[ROLE] = 'easyeda';
        socket[INSTANCE_ID] = instanceId;
        this.easyEdaClients.set(instanceId, {
            instanceId,
            projectName,
            socket,
            connectedAt: existing?.connectedAt ?? now,
            lastSeenAt: now,
        });
    }

    private handleProxyMessage(socket: WebSocket, message: WsMessage) {
        const body = parseBody<{
            id?: string;
            event?: string;
            body?: Record<string, unknown>;
            targetInstanceId?: string;
            timeoutMs?: number;
        }>(message);
        const id = typeof body.id === 'string' ? body.id : undefined;
        if (!id) return;

        const reply = (ok: boolean, result?: unknown, error?: unknown) => {
            sendWs(socket, {
                event: 'proxy:response',
                body: JSON.stringify({
                    id,
                    ok,
                    result,
                    error: error instanceof Error ? error.message : error ? String(error) : undefined,
                }),
            });
        };

        if (message.event === 'proxy:ping') {
            reply(true, { ts: Date.now() });
            return;
        }

        if (message.event === 'proxy:list-easyeda-instances') {
            reply(true, this.listEasyEdaInstances());
            return;
        }

        if (message.event === 'proxy:request-easyeda') {
            if (typeof body.event !== 'string') {
                reply(false, undefined, 'Missing EasyEDA event.');
                return;
            }

            this.requestEasyEda(
                body.event,
                body.body && typeof body.body === 'object' ? body.body : {},
                typeof body.timeoutMs === 'number' ? body.timeoutMs : undefined,
                body.targetInstanceId,
            ).then(
                result => reply(true, result),
                error => reply(false, undefined, error),
            );
        }
    }

    private handleEasyEdaMessage(socket: RoleSocket, message: WsMessage) {
        this.touchEasyEdaSocket(socket);
        const parsedBody = parseBody<{ id?: string; ok?: boolean; result?: unknown; error?: string }>(message);
        const id = parsedBody?.id;
        if (!id || typeof id !== 'string') return;

        const pending = this.pendingEasyEdaRequests.get(id);
        if (!pending) return;

        clearTimeout(pending.timer);
        this.pendingEasyEdaRequests.delete(id);

        if (parsedBody.ok === false) {
            pending.reject(new Error(parsedBody.error || `EasyEDA event failed: ${message.event}`));
            return;
        }

        pending.resolve(parsedBody.result);
    }

    private touchEasyEdaSocket(socket: RoleSocket) {
        const instanceId = socket[INSTANCE_ID];
        if (!instanceId) return;
        const client = this.easyEdaClients.get(instanceId);
        if (client) client.lastSeenAt = Date.now();
    }

    private removeSocket(socket: RoleSocket) {
        if (socket[ROLE] !== 'easyeda') return;
        const instanceId = socket[INSTANCE_ID];
        if (!instanceId) return;
        const client = this.easyEdaClients.get(instanceId);
        if (client?.socket !== socket) return;
        this.easyEdaClients.delete(instanceId);
        this.rejectPendingForInstance(instanceId, 'EasyEDA instance disconnected.');
    }

    private removeStaleEasyEdaClients() {
        const staleBefore = Date.now() - 35_000;
        for (const client of this.easyEdaClients.values()) {
            if (client.lastSeenAt >= staleBefore) continue;
            client.socket.terminate();
            this.easyEdaClients.delete(client.instanceId);
            this.rejectPendingForInstance(client.instanceId, 'EasyEDA instance heartbeat timed out.');
        }
    }

    private rejectPendingForInstance(instanceId: string, reason: string) {
        for (const [id, pending] of this.pendingEasyEdaRequests.entries()) {
            if (pending.targetInstanceId !== instanceId) continue;
            clearTimeout(pending.timer);
            this.pendingEasyEdaRequests.delete(id);
            pending.reject(new Error(reason));
        }
    }

    private resolveEasyEdaClient(targetInstanceId?: string) {
        if (targetInstanceId) {
            const client = this.easyEdaClients.get(targetInstanceId);
            if (client) return client;
            throw new Error(`Selected EasyEDA instance is not connected: ${targetInstanceId}`);
        }

        const clients = [...this.easyEdaClients.values()];
        if (clients.length === 0) {
            throw new Error(`EasyEDA MCP interface is not connected.
1. Open EasyEDA Pro.
2. Open a project.
3. Ensure Copilot -> MCP is enabled.`);
        }

        if (clients.length === 1) return clients[0];

        throw new Error([
            'Multiple EasyEDA instances are connected. Call list_easyeda_instances, then select_easyeda_instance.',
            JSON.stringify(this.listEasyEdaInstances(), null, 2),
        ].join('\n'));
    }
}

class ProxyBridge {
    private socket?: WebSocket;
    private readonly pendingProxyRequests = new Map<string, PendingRequest>();
    private heartbeatTimer?: ReturnType<typeof setInterval>;
    private heartbeatTimeout?: ReturnType<typeof setTimeout>;
    private disconnected = false;

    constructor(
        private readonly url: string,
        private readonly onDisconnected: () => void,
    ) { }

    async connect() {
        const socket = new WebSocket(this.url);

        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
                socket.close();
                reject(new Error(`Timeout connecting bridge owner: ${this.url}`));
            }, 2_000);

            socket.once('open', () => {
                clearTimeout(timer);
                resolve();
            });
            socket.once('error', error => {
                clearTimeout(timer);
                reject(toError(error));
            });
        });

        this.socket = socket;
        this.disconnected = false;

        socket.on('message', data => {
            try {
                const raw = typeof data === 'string' ? data : data.toString();
                this.handleMessage(JSON.parse(raw) as WsMessage);
            } catch {
                this.disconnect();
            }
        });
        socket.on('close', () => this.disconnect());
        socket.on('error', () => this.disconnect());

        sendWs(socket, {
            event: 'proxy:hello',
            body: JSON.stringify({ ok: true }),
        });
        this.startHeartbeat();
    }

    close() {
        this.disconnected = true;
        this.stopHeartbeat();
        this.rejectPending('Bridge owner disconnected.');
        this.socket?.close();
        this.socket = undefined;
    }

    listEasyEdaInstances() {
        return this.requestOwner<EasyEdaInstance[]>('proxy:list-easyeda-instances', {});
    }

    requestEasyEda(event: string, body: Record<string, unknown> = {}, timeoutMs = 120_000, targetInstanceId?: string) {
        return this.requestOwner('proxy:request-easyeda', {
            event,
            body,
            timeoutMs,
            targetInstanceId,
        }, timeoutMs + 1_000);
    }

    private requestOwner<T = unknown>(event: string, body: Record<string, unknown>, timeoutMs = 120_000) {
        const socket = this.socket;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            throw new Error('EasyEDA bridge owner is not connected.');
        }

        const id = randomUUID();
        const response = new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingProxyRequests.delete(id);
                reject(new Error(`Timeout waiting bridge owner event: ${event}`));
            }, timeoutMs);

            this.pendingProxyRequests.set(id, {
                resolve: value => resolve(value as T),
                reject,
                timer,
            });
        });

        sendWs(socket, {
            event,
            body: JSON.stringify({ ...body, id }),
        });

        return response;
    }

    private handleMessage(message: WsMessage) {
        if (message.event === 'connected' || message.event === 'proxy:hello:result') return;
        if (message.event !== 'proxy:response') return;

        const body = parseBody<{ id?: string; ok?: boolean; result?: unknown; error?: string }>(message);
        const id = body.id;
        if (!id) return;

        const pending = this.pendingProxyRequests.get(id);
        if (!pending) return;

        clearTimeout(pending.timer);
        this.pendingProxyRequests.delete(id);

        if (body.ok === false) {
            pending.reject(new Error(body.error || 'Bridge owner request failed.'));
            return;
        }

        pending.resolve(body.result);
    }

    private startHeartbeat() {
        this.stopHeartbeat();
        const ping = () => {
            this.heartbeatTimeout = setTimeout(() => this.disconnect(), 5_000);
            this.requestOwner('proxy:ping', {}, 4_000)
                .then(() => {
                    if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
                    this.heartbeatTimeout = undefined;
                })
                .catch(() => this.disconnect());
        };

        ping();
        this.heartbeatTimer = setInterval(ping, 5_000);
    }

    private stopHeartbeat() {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
        this.heartbeatTimer = undefined;
        this.heartbeatTimeout = undefined;
    }

    private disconnect() {
        if (this.disconnected) return;
        this.disconnected = true;
        this.close();
        this.onDisconnected();
    }

    private rejectPending(reason: string) {
        for (const pending of this.pendingProxyRequests.values()) {
            clearTimeout(pending.timer);
            pending.reject(new Error(reason));
        }
        this.pendingProxyRequests.clear();
    }
}

class MeshBridge implements Bridge {
    private owner?: OwnerBroker;
    private proxy?: ProxyBridge;
    private selectedEasyEdaInstanceId?: string;
    private recovering = false;

    constructor(
        private readonly host: string,
        private readonly port: number,
    ) { }

    async start() {
        await this.becomeOwnerOrProxy(false);
    }

    async requestEasyEda(event: string, body: Record<string, unknown> = {}, timeoutMs = 120_000) {
        await this.waitForRecoverableConnection();

        if (this.owner) {
            return this.owner.requestEasyEda(event, body, timeoutMs, this.selectedEasyEdaInstanceId);
        }
        if (this.proxy) {
            return this.proxy.requestEasyEda(event, body, timeoutMs, this.selectedEasyEdaInstanceId);
        }
        throw new Error('EasyEDA bridge is not ready yet.');
    }

    private async waitForRecoverableConnection() {
        const deadline = Date.now() + RECOVERY_WAIT_MS;

        while (Date.now() < deadline) {
            if (!this.owner && !this.proxy) {
                await delay(RECOVERY_POLL_MS);
                continue;
            }

            try {
                const instances = await this.listEasyEdaInstances();

                if (this.selectedEasyEdaInstanceId) {
                    if (instances.some(instance => instance.instanceId === this.selectedEasyEdaInstanceId)) return;
                } else if (instances.length > 0) {
                    return;
                }
            } catch {
                // Owner/proxy may be switching during election; keep the next MCP call pending briefly.
            }

            await delay(RECOVERY_POLL_MS);
        }
    }

    async listEasyEdaInstances() {
        if (this.owner) return this.owner.listEasyEdaInstances();
        if (this.proxy) return this.proxy.listEasyEdaInstances();
        return [];
    }

    async selectEasyEdaInstance(instanceId: string) {
        const instances = await this.listEasyEdaInstances();
        const instance = instances.find(item => item.instanceId === instanceId);
        if (!instance) throw new Error(`EasyEDA instance is not connected: ${instanceId}`);
        this.selectedEasyEdaInstanceId = instanceId;
        return instance;
    }

    async getSelectedEasyEdaInstance() {
        if (!this.selectedEasyEdaInstanceId) return undefined;
        const instances = await this.listEasyEdaInstances();
        return instances.find(item => item.instanceId === this.selectedEasyEdaInstanceId);
    }

    private async becomeOwnerOrProxy(afterFailure: boolean) {
        if (this.recovering) return;
        this.recovering = true;

        try {
            if (afterFailure) await delay(electionDelayMs());
            await this.tryBecomeOwner();
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') {
                await delay(500);
            }
            await this.tryBecomeProxy();
        } finally {
            this.recovering = false;
        }
    }

    private async tryBecomeOwner() {
        this.proxy?.close();
        this.proxy = undefined;

        const server = new WebSocketServer({
            host: this.host,
            port: this.port,
        });

        await new Promise<void>((resolve, reject) => {
            const onListening = () => {
                cleanup();
                resolve();
            };
            const onError = (error: NodeJS.ErrnoException) => {
                cleanup();
                server.close();
                reject(error);
            };
            const cleanup = () => {
                server.off('listening', onListening);
                server.off('error', onError);
            };

            server.once('listening', onListening);
            server.once('error', onError);
        });

        this.owner = new OwnerBroker(server);
    }

    private async tryBecomeProxy() {
        this.owner?.close();
        this.owner = undefined;
        this.proxy?.close();

        const proxy = new ProxyBridge(`ws://${this.host}:${this.port}`, () => {
            this.proxy = undefined;
            this.becomeOwnerOrProxy(true).catch(() => undefined);
        });

        try {
            await proxy.connect();
            this.proxy = proxy;
        } catch {
            proxy.close();
            setTimeout(() => {
                this.becomeOwnerOrProxy(true).catch(() => undefined);
            }, 500);
        }
    }
}

export async function startBridge(options: { host: string; port: number }): Promise<Bridge> {
    const bridge = new MeshBridge(options.host, options.port);
    await bridge.start();
    return bridge;
}
