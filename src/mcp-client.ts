import { assembleCircuit } from './eda/assemble';
import { checkpointer } from './eda/checkpointer';
import { getSchematic } from './eda/schematic';
import '@copilot/shared/types/eda';

type McpMessage = {
    event: string;
    body: string;
};

const MCP_WS_ID = 'easyeda-copilot-mcp';
const MCP_WS_URL = 'ws://127.0.0.1:8787';
const MCP_SCAN_INTERVAL_MS = 5000;
const MCP_CONNECT_TIMEOUT_MS = 2000;
const MCP_HEARTBEAT_INTERVAL_MS = 10000;
const MCP_HEARTBEAT_TIMEOUT_MS = 3000;

type McpClientState = {
    isRegistered: boolean;
    isConnecting: boolean;
    isScanEnabled: boolean;
    isUserPaused: boolean;
    isStartupInitialized: boolean;
    scanTimer?: ReturnType<typeof setInterval>;
    connectTimeout?: ReturnType<typeof setTimeout>;
    heartbeatTimer?: ReturnType<typeof setInterval>;
    heartbeatTimeout?: ReturnType<typeof setTimeout>;
};

const state = ((eda as typeof eda & {
    __easyedaCopilotMcpState?: McpClientState;
}).__easyedaCopilotMcpState ??= {
    isRegistered: false,
    isConnecting: false,
    isScanEnabled: false,
    isUserPaused: false,
    isStartupInitialized: false,
});

function parseBody<T = Record<string, unknown>>(message: McpMessage): T {
    return message.body ? JSON.parse(message.body) as T : {} as T;
}

function send(event: string, body: Record<string, unknown>) {
    eda.sys_WebSocket.send(MCP_WS_ID, JSON.stringify({
        event,
        body: JSON.stringify(body),
    } satisfies McpMessage));
}

function clearHeartbeatTimeout() {
    if (!state.heartbeatTimeout) return;
    clearTimeout(state.heartbeatTimeout);
    state.heartbeatTimeout = undefined;
}

function stopHeartbeat() {
    if (state.heartbeatTimer) {
        clearInterval(state.heartbeatTimer);
        state.heartbeatTimer = undefined;
    }

    clearHeartbeatTimeout();
}

function markMcpDisconnected(reason: string) {
    if (!state.isRegistered && !state.isConnecting) return;

    state.isRegistered = false;
    state.isConnecting = false;
    clearConnectTimeout();
    stopHeartbeat();
    closeMcpSocket(reason);
    eda.sys_Log.add(`MCP disconnected: ${reason}`, ESYS_LogType.WARNING);
}

function sendHeartbeatPing() {
    if (!state.isRegistered) return;

    clearHeartbeatTimeout();

    try {
        send('ping', { ts: Date.now() });
    } catch (error) {
        markMcpDisconnected(`heartbeat send failed: ${(error as Error).message}`);
        return;
    }

    state.heartbeatTimeout = setTimeout(() => {
        markMcpDisconnected('heartbeat timeout');
    }, MCP_HEARTBEAT_TIMEOUT_MS);
}

function startHeartbeat() {
    stopHeartbeat();
    sendHeartbeatPing();
    state.heartbeatTimer = setInterval(sendHeartbeatPing, MCP_HEARTBEAT_INTERVAL_MS);
}

async function handleMessage(message: McpMessage) {
    if (message.event === 'connected') {
        eda.sys_Log.add('MCP WebSocket connected', ESYS_LogType.INFO);
        return;
    }

    if (message.event === 'pong') {
        clearHeartbeatTimeout();
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
        eda.sys_Log.add(`MCP event: ${message.event}`, ESYS_LogType.INFO);

        if (message.event === 'get-schematic') {
            const primitiveIds = await eda.sch_PrimitiveComponent.getAllPrimitiveId().catch(() => []);
            const schematic = await getSchematic([...primitiveIds]);
            reply(true, schematic);
            return;
        }

        if (message.event === 'get-current-project-info') {
            const projectInfo = await eda.dmt_Project.getCurrentProjectInfo();
            if (!projectInfo) throw new Error('Current project info not found');

            const project_data = [];

            const filterSchPage = (page: IDMT_SchematicPageItem) => {
                return {
                    name: page.name,
                    itemType: page.itemType,
                    uuid: page.uuid
                }
            };

            const filterSch = (sch: IDMT_SchematicItem) => {
                return {
                    name: sch.name,
                    itemType: sch.itemType,
                    page: sch.page.map(filterSchPage),
                    uuid: sch.uuid
                }
            };

            for (const item of projectInfo.data) {
                if (item.itemType === EDMT_ItemType.BOARD) {

                    project_data.push({
                        name: item.name,
                        itemType: item.itemType,
                        schematic: filterSch(item.schematic),
                    })
                }
                else if (item.itemType === EDMT_ItemType.SCHEMATIC) {
                    project_data.push({
                        name: item.name,
                        itemType: item.itemType,
                        page: filterSch(item).page,
                        uuid: item.uuid
                    })
                }
            }

            reply(true, {
                data: project_data,
                project_name: projectInfo.friendlyName,
                description: projectInfo.description
            });
            return;
        }

        if (message.event === 'open-document') {
            const documentUuid = body.documentUuid;
            if (typeof documentUuid !== 'string' || !documentUuid) {
                throw new Error('Missing documentUuid');
            }

            const tabId = await eda.dmt_EditorControl.openDocument(documentUuid);
            if (!tabId) throw new Error(`Failed to open document: ${documentUuid}`);

            reply(true, { tabId, documentUuid });
            return;
        }

        if (message.event === 'create-schematic') {
            const boardName = typeof body.boardName === 'string' ? body.boardName : undefined;
            const schematicFirstPageUuid = await eda.dmt_Schematic.createSchematic(boardName);
            if (!schematicFirstPageUuid) throw new Error('Failed to create schematic');

            reply(true, { schematicFirstPageUuid });
            return;
        }

        if (message.event === 'create-schematic-page') {
            const schematicUuid = body.schematicUuid;
            if (typeof schematicUuid !== 'string' || !schematicUuid) {
                throw new Error('Missing schematicUuid');
            }

            const schematicPageUuid = await eda.dmt_Schematic.createSchematicPage(schematicUuid);
            if (!schematicPageUuid) throw new Error(`Failed to create schematic page for schematic: ${schematicUuid}`);

            reply(true, { schematicUuid, schematicPageUuid });
            return;
        }

        if (message.event === 'modify-schematic-name') {
            const schematicUuid = body.schematicUuid;
            const schematicName = body.schematicName;
            if (typeof schematicUuid !== 'string' || !schematicUuid) {
                throw new Error('Missing schematicUuid');
            }
            if (typeof schematicName !== 'string' || !schematicName) {
                throw new Error('Missing schematicName');
            }

            const success = await eda.dmt_Schematic.modifySchematicName(schematicUuid, schematicName);
            reply(true, { success, schematicUuid, schematicName });
            return;
        }

        if (message.event === 'modify-schematic-page-name') {
            const schematicPageUuid = body.schematicPageUuid;
            const schematicPageName = body.schematicPageName;
            if (typeof schematicPageUuid !== 'string' || !schematicPageUuid) {
                throw new Error('Missing schematicPageUuid');
            }
            if (typeof schematicPageName !== 'string' || !schematicPageName) {
                throw new Error('Missing schematicPageName');
            }

            const success = await eda.dmt_Schematic.modifySchematicPageName(schematicPageUuid, schematicPageName);
            reply(true, { success, schematicPageUuid, schematicPageName });
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

        if (message.event === 'checkpoint-read') {
            const checkpoint = await checkpointer.read(String(body.checkpointId));
            if (!checkpoint) throw new Error('Checkpoint not found');
            reply(true, { ...checkpoint, content: 'too big' });
            return;
        }

        if (message.event === 'checkpoint-restore') {
            const restored = await checkpointer.restore(typeof body.checkpointId === 'string' ? body.checkpointId : undefined, true);
            reply(true, { restored });
            return;
        }

        throw new Error(`Unknown MCP event: ${message.event}`);
    } catch (error) {
        eda.sys_Log.add(`MCP event error: ${message.event}: ${(error as Error).message}`, ESYS_LogType.ERROR);
        reply(false, undefined, error);
    }
}

function clearConnectTimeout() {
    if (!state.connectTimeout) return;
    clearTimeout(state.connectTimeout);
    state.connectTimeout = undefined;
}

function closeMcpSocket(reason: string) {
    try {
        eda.sys_WebSocket.close(MCP_WS_ID, 1000, reason);
    } catch {
        // EasyEDA may throw when the socket id is not registered yet.
    }
}

function tryConnectMcp(showErrors = false) {
    if (state.isRegistered || state.isConnecting || !state.isScanEnabled) {
        return;
    }

    state.isConnecting = true;
    closeMcpSocket('Reconnect by EasyEDA Copilot');

    state.connectTimeout = setTimeout(() => {
        state.isConnecting = false;
        clearConnectTimeout();
        closeMcpSocket('MCP connect timeout');

        if (showErrors) {
            eda.sys_Log.add('Fail connect MCP WebSocket', ESYS_LogType.ERROR);
            eda.sys_Message.showToastMessage('MCP server not found', ESYS_ToastMessageType.WARNING);
        }
    }, MCP_CONNECT_TIMEOUT_MS);

    eda.sys_WebSocket.register(
        MCP_WS_ID,
        MCP_WS_URL,
        async (event) => {
            try {
                const data = typeof event.data === 'string' ? event.data : String(event.data);
                await handleMessage(JSON.parse(data) as McpMessage);
            } catch (error) {
                eda.sys_Log.add(`MCP message error: ${(error as Error).message}`, ESYS_LogType.ERROR);
            }
        },
        () => {
            state.isRegistered = true;
            state.isConnecting = false;
            clearConnectTimeout();
            startHeartbeat();
            eda.sys_Log.add(`MCP WebSocket opened: ${MCP_WS_URL}`, ESYS_LogType.INFO);
            eda.sys_Message.showToastMessage('MCP connected', ESYS_ToastMessageType.SUCCESS);
        }
    );
}

export function startMcpScan(showErrors = false, respectUserPause = false) {
    if (respectUserPause && state.isUserPaused) {
        eda.sys_Log.add('MCP scan is paused by user', ESYS_LogType.INFO);
        return;
    }

    state.isUserPaused = false;

    if (state.isScanEnabled) {
        tryConnectMcp(showErrors);
        return;
    }

    state.isScanEnabled = true;
    tryConnectMcp(showErrors);
    state.scanTimer = setInterval(() => tryConnectMcp(false), MCP_SCAN_INTERVAL_MS);
    eda.sys_Log.add('MCP scan started', ESYS_LogType.INFO);
}

export function startMcpScanOnStartup() {
    if (!state.isStartupInitialized) {
        state.isStartupInitialized = true;
        state.isUserPaused = false;
        startMcpScan(false);
        return;
    }

    startMcpScan(false, true);
}

export function stopMcpScan(showToast = true) {
    state.isScanEnabled = false;
    state.isConnecting = false;
    state.isUserPaused = true;
    clearConnectTimeout();
    stopHeartbeat();

    if (state.scanTimer) {
        clearInterval(state.scanTimer);
        state.scanTimer = undefined;
    }

    closeMcpSocket('MCP scan stopped by EasyEDA Copilot');
    state.isRegistered = false;

    if (showToast) {
        eda.sys_Message.showToastMessage('MCP scan stopped', ESYS_ToastMessageType.SUCCESS);
    }
    eda.sys_Log.add('MCP scan stopped', ESYS_LogType.INFO);
}

export function toggleMcpScan() {
    if (state.isScanEnabled) {
        stopMcpScan();
        return;
    }

    startMcpScan(true);
    eda.sys_Message.showToastMessage('MCP scan started', ESYS_ToastMessageType.SUCCESS);
}
