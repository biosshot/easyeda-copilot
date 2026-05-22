import { assembleCircuit } from './eda/assemble-circuit';
import { checkpointer } from './eda/checkpointer';
import { getSchematic } from './eda/schematic';
import '@copilot/shared/types/eda';

export type McpConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export type McpLog = {
    timestamp: number;
    event: string;
    message: string;
};

type McpMessage = {
    event: string;
    body: string;
};

type StateListener = (state: McpConnectionState) => void;
type LogListener = (log: McpLog) => void;

const WS_URL = 'ws://127.0.0.1:8787';

let socket: WebSocket | undefined;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let shouldReconnect = true;
const stateListeners = new Set<StateListener>();
const logListeners = new Set<LogListener>();

function emitState(state: McpConnectionState) {
    for (const listener of stateListeners) listener(state);
}

function emitLog(event: string, message: string) {
    for (const listener of logListeners) {
        listener({ timestamp: Date.now(), event, message });
    }
}

function parseBody<T = Record<string, unknown>>(message: McpMessage): T {
    return message.body ? JSON.parse(message.body) as T : {} as T;
}

function send(event: string, body: Record<string, unknown>) {
    socket?.send(JSON.stringify({
        event,
        body: JSON.stringify(body),
    } satisfies McpMessage));
}

async function handleMessage(message: McpMessage) {
    if (message.event === 'connected') {
        emitLog(message.event, 'MCP WebSocket connected');
        return;
    }

    const body = parseBody<{ id?: string } & Record<string, unknown>>(message);
    const id = body.id;

    const reply = (ok: boolean, result?: unknown, error?: unknown) => {
        if (!id) return;
        send(`${message.event}:result`, {
            id,
            ok,
            result,
            error: error instanceof Error ? error.message : error ? String(error) : undefined,
        });
    };

    try {
        emitLog(message.event, 'Handling event');

        if (message.event === 'get-schematic') {
            const primitiveIds = await eda.sch_PrimitiveComponent.getAllPrimitiveId().catch(() => []);
            const schematic = await getSchematic([...primitiveIds]);
            reply(true, schematic);
            return;
        }

        if (message.event === 'assemble-circuit') {
            const circuit = body.circuit;
            if (!circuit) throw new Error('Missing circuit in assemble-circuit body');

            await checkpointer.save(false);
            await assembleCircuit(circuit as Parameters<typeof assembleCircuit>[0]);
            reply(true, { assembled: true });
            return;
        }

        if (message.event === 'checkpoint-list') {
            reply(true, await checkpointer.list());
            return;
        }

        if (message.event === 'checkpoint-save') {
            const checkpointId = await checkpointer.save(false);
            reply(true, { checkpointId });
            return;
        }

        if (message.event === 'checkpoint-restore') {
            const restored = await checkpointer.restore(typeof body.checkpointId === 'string' ? body.checkpointId : undefined);
            reply(true, { restored });
            return;
        }

        throw new Error(`Unknown MCP event: ${message.event}`);
    } catch (error) {
        console.error(error)
        emitLog(message.event, error instanceof Error ? error.message : String(error));
        reply(false, undefined, error);
    }
}

export function connectMcp() {
    shouldReconnect = true;

    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    emitState('connecting');
    socket = new WebSocket(WS_URL);

    socket.addEventListener('open', () => {
        emitState('connected');
        emitLog('open', WS_URL);
    });

    socket.addEventListener('message', event => {
        try {
            handleMessage(JSON.parse(String(event.data)) as McpMessage);
        } catch (error) {
            emitLog('message-error', error instanceof Error ? error.message : String(error));
        }
    });

    socket.addEventListener('close', () => {
        emitState('disconnected');
        emitLog('close', 'MCP WebSocket closed');
        if (shouldReconnect) reconnectTimer = setTimeout(connectMcp, 1500);
    });

    socket.addEventListener('error', () => {
        emitState('error');
        emitLog('error', 'Failed to connect MCP WebSocket');
    });
}

export function disconnectMcp() {
    shouldReconnect = false;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.close();
    socket = undefined;
    emitState('disconnected');
}

export function onMcpState(listener: StateListener) {
    stateListeners.add(listener);
    return () => stateListeners.delete(listener);
}

export function onMcpLog(listener: LogListener) {
    logListeners.add(listener);
    return () => logListeners.delete(listener);
}
