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
    enterBrokerOnlyMode(): boolean;
    close(): Promise<void>;
};

type PendingRequest = {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timer: ReturnType<typeof setTimeout>;
    deadlineAt: number;
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
    if (socket.readyState !== WebSocket.OPEN) {
        throw new Error(`WebSocket is not open: readyState=${socket.readyState}`);
    }
    socket.send(JSON.stringify(message));
}

function trySendWs(socket: WebSocket, message: WsMessage) {
    try {
        sendWs(socket, message);
        return true;
    } catch {
        return false;
    }
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
const RECOVERY_PROBE_TIMEOUT_MS = 1_000;
const EASYEDA_STALE_TIMEOUT_MS = 60_000;
const SOCKET_ROLE_TIMEOUT_MS = 5_000;
const MAX_PENDING_REQUESTS = 64;
const PROXY_HEARTBEAT_INTERVAL_MS = 10_000;
const PROXY_HEARTBEAT_MAX_MISSES = 3;
const PROXY_HANDSHAKE_TIMEOUT_MS = 2_000;
const BRIDGE_DEADLINE_FIELD = '__easyedaCopilotDeadlineAt';
const configuredBrokerIdleMs = Number(process.env.EASYEDA_COPILOT_MCP_BROKER_IDLE_MS ?? 60_000);
const BROKER_IDLE_TIMEOUT_MS = Number.isFinite(configuredBrokerIdleMs) && configuredBrokerIdleMs >= 0
    ? configuredBrokerIdleMs
    : 60_000;

class OwnerBroker {
    private readonly easyEdaClients = new Map<string, EasyEdaClient>();
    private readonly pendingEasyEdaRequests = new Map<string, PendingRequest>();
    private readonly sockets = new Set<RoleSocket>();
    private readonly roleTimers = new Map<RoleSocket, ReturnType<typeof setTimeout>>();
    private readonly staleTimer: ReturnType<typeof setInterval>;
    private brokerOnly = false;
    private brokerIdleTimer?: ReturnType<typeof setTimeout>;
    private onBrokerIdle?: () => void;

    constructor(private readonly server: WebSocketServer) {
        this.server.on('connection', socket => this.handleConnection(socket as RoleSocket));
        this.staleTimer = setInterval(() => this.removeStaleEasyEdaClients(), 10_000);
    }

    async close() {
        clearInterval(this.staleTimer);
        this.clearBrokerIdleTimer();
        this.onBrokerIdle = undefined;
        for (const pending of this.pendingEasyEdaRequests.values()) {
            clearTimeout(pending.timer);
            pending.reject(new Error('EasyEDA bridge owner closed.'));
        }
        this.pendingEasyEdaRequests.clear();
        for (const timer of this.roleTimers.values()) clearTimeout(timer);
        this.roleTimers.clear();
        for (const socket of this.sockets) {
            socket.terminate();
        }
        this.sockets.clear();
        this.easyEdaClients.clear();

        await new Promise<void>(resolve => {
            try {
                this.server.close(() => resolve());
            } catch {
                resolve();
            }
        });
    }

    listEasyEdaInstances() {
        return [...this.easyEdaClients.values()].map(client => ({
            instanceId: client.instanceId,
            projectName: client.projectName,
            connectedAt: client.connectedAt,
            lastSeenAt: client.lastSeenAt,
        }));
    }

    enterBrokerOnlyMode(onIdle: () => void) {
        if (this.easyEdaClients.size === 0) return false;
        this.brokerOnly = true;
        this.onBrokerIdle = onIdle;
        this.clearBrokerIdleTimer();
        return true;
    }

    requestEasyEda(event: string, body: Record<string, unknown> = {}, timeoutMs = 120_000, targetInstanceId?: string) {
        if (this.pendingEasyEdaRequests.size >= MAX_PENDING_REQUESTS) {
            throw new Error(`EasyEDA bridge has too many pending requests (${MAX_PENDING_REQUESTS}).`);
        }

        const client = this.resolveEasyEdaClient(targetInstanceId);
        const id = randomUUID();
        const deadlineAt = Date.now() + timeoutMs;

        const response = new Promise<unknown>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingEasyEdaRequests.delete(id);
                reject(new Error(`Timeout waiting EasyEDA event: ${event}`));
            }, timeoutMs);

            this.pendingEasyEdaRequests.set(id, {
                resolve,
                reject,
                timer,
                deadlineAt,
                targetInstanceId: client.instanceId,
            });
        });

        try {
            sendWs(client.socket, {
                event,
                body: JSON.stringify({ ...body, id, [BRIDGE_DEADLINE_FIELD]: deadlineAt }),
            });
        } catch (error) {
            const pending = this.pendingEasyEdaRequests.get(id);
            if (pending) {
                clearTimeout(pending.timer);
                this.pendingEasyEdaRequests.delete(id);
                pending.reject(toError(error));
            }
        }

        return response;
    }

    private handleConnection(socket: RoleSocket) {
        this.sockets.add(socket);
        socket[ROLE] = 'unknown';
        this.roleTimers.set(socket, setTimeout(() => {
            if (socket[ROLE] === 'unknown') socket.close(1008, 'Bridge handshake timed out.');
        }, SOCKET_ROLE_TIMEOUT_MS));

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

        socket.on('close', () => {
            this.clearRoleTimer(socket);
            this.sockets.delete(socket);
            this.removeSocket(socket);
        });
        socket.on('error', () => {
            this.clearRoleTimer(socket);
            this.removeSocket(socket);
            socket.terminate();
        });
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
            if (socket[ROLE] === 'proxy') {
                socket.close(1008, 'Bridge role cannot be changed.');
                return;
            }
            this.registerEasyEdaClient(socket, parseBody(message));
            return;
        }

        if (message.event === 'proxy:hello') {
            if (socket[ROLE] === 'easyeda') {
                socket.close(1008, 'Bridge role cannot be changed.');
                return;
            }
            socket[ROLE] = 'proxy';
            this.clearRoleTimer(socket);
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

        if (socket[ROLE] === 'easyeda') {
            this.handleEasyEdaMessage(socket, message);
            return;
        }

        socket.close(1008, 'Bridge handshake required.');
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

        const previousInstanceId = socket[INSTANCE_ID];
        if (previousInstanceId && previousInstanceId !== instanceId) {
            const previous = this.easyEdaClients.get(previousInstanceId);
            if (previous?.socket === socket) {
                this.easyEdaClients.delete(previousInstanceId);
                this.rejectPendingForInstance(previousInstanceId, 'EasyEDA instance identity changed.');
            }
        }

        const existing = this.easyEdaClients.get(instanceId);
        if (existing && existing.socket !== socket) {
            existing.socket.close();
            this.rejectPendingForInstance(instanceId, 'EasyEDA instance reconnected.');
        }

        const now = Date.now();
        socket[ROLE] = 'easyeda';
        socket[INSTANCE_ID] = instanceId;
        this.clearRoleTimer(socket);
        this.clearBrokerIdleTimer();
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
            return trySendWs(socket, {
                event: 'proxy:response',
                body: JSON.stringify({
                    id,
                    ok,
                    result,
                    error: error instanceof Error ? error.message : error ? String(error) : undefined,
                }),
            });
        };

        if (message.event === 'proxy:list-easyeda-instances') {
            reply(true, this.listEasyEdaInstances());
            return;
        }

        if (message.event === 'proxy:request-easyeda') {
            if (typeof body.event !== 'string') {
                reply(false, undefined, 'Missing EasyEDA event.');
                return;
            }

            try {
                void this.requestEasyEda(
                    body.event,
                    body.body && typeof body.body === 'object' ? body.body : {},
                    typeof body.timeoutMs === 'number' ? body.timeoutMs : undefined,
                    body.targetInstanceId,
                ).then(
                    result => reply(true, result),
                    error => reply(false, undefined, error),
                ).catch(() => undefined);
            } catch (error) {
                reply(false, undefined, error);
            }
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
        if (client?.socket === socket) client.lastSeenAt = Date.now();
    }

    private clearRoleTimer(socket: RoleSocket) {
        const timer = this.roleTimers.get(socket);
        if (timer) clearTimeout(timer);
        this.roleTimers.delete(socket);
    }

    private removeSocket(socket: RoleSocket) {
        if (socket[ROLE] !== 'easyeda') return;
        const instanceId = socket[INSTANCE_ID];
        if (!instanceId) return;
        const client = this.easyEdaClients.get(instanceId);
        if (client?.socket !== socket) return;
        this.easyEdaClients.delete(instanceId);
        this.rejectPendingForInstance(instanceId, 'EasyEDA instance disconnected.');
        this.scheduleBrokerIdleShutdown();
    }

    private removeStaleEasyEdaClients() {
        const now = Date.now();
        const staleBefore = now - EASYEDA_STALE_TIMEOUT_MS;
        for (const client of this.easyEdaClients.values()) {
            if (client.lastSeenAt >= staleBefore) continue;

            const hasActiveRequest = [...this.pendingEasyEdaRequests.values()].some(pending => (
                pending.targetInstanceId === client.instanceId && pending.deadlineAt > now
            ));
            if (hasActiveRequest) continue;

            client.socket.terminate();
            this.easyEdaClients.delete(client.instanceId);
            this.rejectPendingForInstance(client.instanceId, 'EasyEDA instance heartbeat timed out.');
            this.scheduleBrokerIdleShutdown();
        }
    }

    private clearBrokerIdleTimer() {
        if (this.brokerIdleTimer) clearTimeout(this.brokerIdleTimer);
        this.brokerIdleTimer = undefined;
    }

    private scheduleBrokerIdleShutdown() {
        if (!this.brokerOnly || this.easyEdaClients.size > 0 || this.brokerIdleTimer) return;

        this.brokerIdleTimer = setTimeout(() => {
            this.brokerIdleTimer = undefined;
            if (!this.brokerOnly || this.easyEdaClients.size > 0) return;
            const onIdle = this.onBrokerIdle;
            this.onBrokerIdle = undefined;
            onIdle?.();
        }, BROKER_IDLE_TIMEOUT_MS);
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
    private awaitingPong = false;
    private missedPongs = 0;
    private disconnected = false;
    private handshake?: {
        resolve: () => void;
        reject: (reason: Error) => void;
        timer: ReturnType<typeof setTimeout>;
    };

    private readonly handlePong = () => {
        this.markOwnerAlive();
    };

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
                this.markOwnerAlive();
                const raw = typeof data === 'string' ? data : data.toString();
                this.handleMessage(JSON.parse(raw) as WsMessage);
            } catch {
                this.disconnect();
            }
        });
        socket.on('close', () => this.disconnect());
        socket.on('error', () => this.disconnect());

        const handshake = this.waitForHandshake();
        sendWs(socket, {
            event: 'proxy:hello',
            body: JSON.stringify({ ok: true, protocolVersion: 1 }),
        });
        await handshake;
        if (!this.isConnected()) throw new Error('Bridge owner disconnected during handshake.');
        this.startHeartbeat();
    }

    isConnected() {
        return !this.disconnected && this.socket?.readyState === WebSocket.OPEN;
    }

    close() {
        this.disconnected = true;
        this.stopHeartbeat();
        this.rejectHandshake('Bridge owner disconnected.');
        this.rejectPending('Bridge owner disconnected.');
        this.socket?.close();
        this.socket = undefined;
    }

    listEasyEdaInstances(timeoutMs = 120_000) {
        return this.requestOwner<EasyEdaInstance[]>('proxy:list-easyeda-instances', {}, timeoutMs);
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
        if (this.pendingProxyRequests.size >= MAX_PENDING_REQUESTS) {
            throw new Error(`EasyEDA bridge proxy has too many pending requests (${MAX_PENDING_REQUESTS}).`);
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
                deadlineAt: Date.now() + timeoutMs,
            });
        });

        try {
            sendWs(socket, {
                event,
                body: JSON.stringify({ ...body, id }),
            });
        } catch (error) {
            const pending = this.pendingProxyRequests.get(id);
            if (pending) {
                clearTimeout(pending.timer);
                this.pendingProxyRequests.delete(id);
                pending.reject(toError(error));
            }
        }

        return response;
    }

    private handleMessage(message: WsMessage) {
        if (message.event === 'connected') return;
        if (message.event === 'proxy:hello:result') {
            const body = parseBody<{ ok?: boolean }>(message);
            if (body.ok === true) this.resolveHandshake();
            else this.rejectHandshake('Bridge owner rejected proxy handshake.');
            return;
        }
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

    private waitForHandshake() {
        this.rejectHandshake('Bridge proxy handshake restarted.');
        return new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
                if (this.handshake?.timer !== timer) return;
                this.handshake = undefined;
                reject(new Error(`Timeout waiting bridge owner handshake: ${this.url}`));
            }, PROXY_HANDSHAKE_TIMEOUT_MS);
            this.handshake = { resolve, reject, timer };
        });
    }

    private resolveHandshake() {
        const handshake = this.handshake;
        if (!handshake) return;
        this.handshake = undefined;
        clearTimeout(handshake.timer);
        handshake.resolve();
    }

    private rejectHandshake(reason: string) {
        const handshake = this.handshake;
        if (!handshake) return;
        this.handshake = undefined;
        clearTimeout(handshake.timer);
        handshake.reject(new Error(reason));
    }

    private startHeartbeat() {
        this.stopHeartbeat();
        const socket = this.socket;
        if (!socket) return;

        socket.on('pong', this.handlePong);

        const ping = () => {
            if (socket !== this.socket || socket.readyState !== WebSocket.OPEN) {
                this.disconnect();
                return;
            }

            if (this.awaitingPong) {
                this.missedPongs++;
                if (this.missedPongs >= PROXY_HEARTBEAT_MAX_MISSES) {
                    this.disconnect();
                    return;
                }
            }

            this.awaitingPong = true;
            try {
                socket.ping();
            } catch {
                this.disconnect();
            }
        };

        ping();
        this.heartbeatTimer = setInterval(ping, PROXY_HEARTBEAT_INTERVAL_MS);
    }

    private stopHeartbeat() {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.socket?.off('pong', this.handlePong);
        this.heartbeatTimer = undefined;
        this.awaitingPong = false;
        this.missedPongs = 0;
    }

    private markOwnerAlive() {
        this.awaitingPong = false;
        this.missedPongs = 0;
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
    private closed = false;
    private recoveryTimer?: ReturnType<typeof setTimeout>;

    constructor(
        private readonly host: string,
        private readonly port: number,
    ) { }

    async start() {
        this.closed = false;
        await this.becomeOwnerOrProxy(false);
    }

    async close() {
        this.closed = true;
        if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
        this.recoveryTimer = undefined;

        this.proxy?.close();
        this.proxy = undefined;

        const owner = this.owner;
        this.owner = undefined;
        if (owner) await owner.close();
    }

    enterBrokerOnlyMode() {
        const owner = this.owner;
        if (this.closed || !owner) return false;

        return owner.enterBrokerOnlyMode(() => {
            if (this.closed || this.owner !== owner) return;
            this.close().catch(() => undefined);
        });
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
            if (this.closed) throw new Error('EasyEDA bridge is closed.');
            if (!this.owner && !this.proxy) {
                await delay(RECOVERY_POLL_MS);
                continue;
            }

            try {
                const remainingMs = Math.max(1, deadline - Date.now());
                const instances = this.owner
                    ? this.owner.listEasyEdaInstances()
                    : await this.proxy!.listEasyEdaInstances(Math.min(RECOVERY_PROBE_TIMEOUT_MS, remainingMs));

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

        if (this.closed) throw new Error('EasyEDA bridge is closed.');
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
        if (this.closed || this.recovering) return;
        this.recovering = true;

        try {
            if (afterFailure) await delay(electionDelayMs());
            if (this.closed) return;
            await this.tryBecomeOwner();
        } catch (error) {
            if (this.closed) return;
            if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') {
                await delay(500);
            }
            if (this.closed) return;
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

        if (this.closed) {
            await new Promise<void>(resolve => server.close(() => resolve()));
            return;
        }

        this.owner = new OwnerBroker(server);
    }

    private async tryBecomeProxy() {
        if (this.owner) await this.owner.close();
        this.owner = undefined;
        this.proxy?.close();

        const proxy = new ProxyBridge(`ws://${this.host}:${this.port}`, () => {
            if (this.proxy === proxy) this.proxy = undefined;
            if (this.closed) return;
            this.becomeOwnerOrProxy(true).catch(() => undefined);
        });

        try {
            await proxy.connect();
            if (this.closed || !proxy.isConnected()) {
                proxy.close();
                return;
            }
            this.proxy = proxy;
        } catch {
            proxy.close();
            if (this.closed || this.recoveryTimer) return;
            this.recoveryTimer = setTimeout(() => {
                this.recoveryTimer = undefined;
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
