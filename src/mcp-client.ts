import { assembleCircuit } from './eda/assemble';
import { assembleBoard } from './eda/pcb-assemble';
import { checkpointer } from './eda/checkpointer';
import { checkPcbDrc } from './eda/drc';
import { getPcb, getPcbRaw, inspectComponent, inspectNet } from './eda/pcb';
import { getSchematic } from './eda/schematic';
import '@copilot/shared/types/eda';
import { ExplainCircuit } from '@copilot/shared/types/circuit';

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

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function saveCurrentDocument(document: IDMT_EditorDocumentItem) {
    if (document.documentType === EDMT_EditorDocumentType.SCHEMATIC_PAGE) {
        return await eda.sch_Document.save();
    }

    if (document.documentType === EDMT_EditorDocumentType.PCB) {
        return await eda.pcb_Document.save(document.uuid);
    }

    throw new Error(`Unsupported current document type for sync: ${document.documentType}`);
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

async function getProjectInfo() {
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
                pcb: {
                    name: item.pcb.name,
                    itemType: item.pcb.itemType,
                    uuid: item.pcb.uuid,
                    parentBoardName: item.pcb.parentBoardName
                },
            })
        }
        else if (item.itemType === EDMT_ItemType.SCHEMATIC) {
            project_data.push({
                name: item.name,
                itemType: item.itemType,
                page: filterSch(item).page,
                uuid: item.uuid,
                parentBoardUuid: item.parentBoardUuid
            })
        }
        else if (item.itemType === EDMT_ItemType.PCB) {
            project_data.push({
                name: item.name,
                itemType: item.itemType,
                uuid: item.uuid,
                parentBoardName: item.parentBoardName
            })
        }
    }

    return {
        project_data,
        project_name: projectInfo.friendlyName,
        description: projectInfo.description
    };
}

const findDocWithUUID = (data: Awaited<ReturnType<typeof getProjectInfo>>['project_data'], uuid: string) => {
    for (const element of data) {
        if (element.uuid === uuid) {
            return element;
        }

        if (element.pcb?.uuid === uuid) {
            return element.pcb;
        }

        if (element.schematic?.uuid === uuid) {
            return element.schematic;
        }

        for (const page of [...(element.page ?? []), ...(element.schematic?.page ?? [])]) {
            if (page.uuid === uuid) {
                return page;
            }
        }
    }

    return undefined;
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

        if (message.event === 'get-multi-page-schematic') {
            const allPages = await eda.dmt_Schematic.getCurrentSchematicAllSchematicPagesInfo();
            if (!allPages || !allPages.length) throw new Error('Not open any sch or is empty sch');
            const fullSch: ExplainCircuit = { components: [] };

            for (const page of allPages) {
                await eda.dmt_EditorControl.openDocument(page.uuid);
                await new Promise(resolve => setTimeout(resolve, 400));
                const primitiveIds = await eda.sch_PrimitiveComponent.getAllPrimitiveId().catch(() => []);
                const schematic = await getSchematic([...primitiveIds]);
                fullSch.components.push(...schematic.components);
            }

            reply(true, fullSch);
            return;
        }

        if (message.event === 'get-pcb') {
            reply(true, await getPcb());
            return;
        }

        if (message.event === 'get-pcb-raw') {
            reply(true, await getPcbRaw());
            return;
        }

        if (message.event === 'get-current-project-info') {
            const project_data = await getProjectInfo()

            reply(true, {
                current_doc_uuid: await eda.dmt_SelectControl.getCurrentDocumentInfo().then(c => c?.uuid).catch(_ => undefined),
                ...project_data
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

        if (message.event === 'sync-current-document') {
            const settleMs = typeof body.settleMs === 'number' && Number.isFinite(body.settleMs)
                ? Math.max(0, body.settleMs)
                : 500;
            const document = await eda.dmt_SelectControl.getCurrentDocumentInfo();
            if (!document) throw new Error('Current document info not found');

            const saved = await saveCurrentDocument(document);
            if (!saved) throw new Error(`Failed to save current document: ${document.uuid}`);

            const closed = await eda.dmt_EditorControl.closeDocument(document.tabId || document.uuid);
            if (!closed) throw new Error(`Failed to close current document: ${document.uuid}`);

            await delay(settleMs);

            const tabId = await eda.dmt_EditorControl.openDocument(document.uuid);
            if (!tabId) throw new Error(`Failed to reopen current document: ${document.uuid}`);

            reply(true, {
                documentUuid: document.uuid,
                documentType: document.documentType,
                saved,
                closed,
                tabId,
                settleMs,
            });
            return;
        }

        if (message.event === 'get-current-drc-rules') {
            const rules = await eda.pcb_Drc.getCurrentRuleConfiguration();
            reply(true, JSON.stringify(rules));
            return;
        }

        if (message.event === 'check-pcb-drc') {
            const limit = typeof body.limit === 'number' && Number.isFinite(body.limit) && body.limit > 0
                ? Math.floor(body.limit)
                : 24;

            const result = await checkPcbDrc(limit);
            reply(true, result);
            return;
        }

        if (message.event === 'inspect-net') {
            const netName = typeof body.net === 'string' ? body.net : '';
            if (!netName) throw new Error('Missing net');

            const drcLimit = typeof body.drc_limit === 'number' && Number.isFinite(body.drc_limit) && body.drc_limit > 0
                ? Math.floor(body.drc_limit)
                : 24;

            const pcb = await getPcb();
            const result = await inspectNet(pcb, netName, drcLimit);
            reply(true, result);
            return;
        }

        if (message.event === 'inspect-component') {
            const designator = typeof body.designator === 'string' ? body.designator : '';
            if (!designator) throw new Error('Missing designator');

            const radius = typeof body.radius === 'number' && Number.isFinite(body.radius) && body.radius > 0
                ? body.radius
                : 10;

            const pcb = await getPcb();
            const result = await inspectComponent(pcb, designator, radius);
            reply(true, result);
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

        if (message.event === 'modify-name') {
            const name = body.name;
            if (typeof name !== 'string' || !name) {
                throw new Error('Missing name');
            }

            if (typeof body.board_name === 'string') {
                const success = await eda.dmt_Board.modifyBoardName(body.board_name, name);
                return reply(true, { success, new_board_name: name });
            }

            const uuid = body.uuid;

            if (typeof uuid !== 'string' || !uuid) {
                throw new Error('Missing uuid');
            }

            const projectData = await getProjectInfo().then(d => d.project_data);
            const doc = findDocWithUUID(projectData, uuid);

            if (!doc) return reply(false, undefined, "Not found doc with this uuid");

            if (doc.itemType === EDMT_ItemType.SCHEMATIC) {
                const success = await eda.dmt_Schematic.modifySchematicName(uuid, name);
                reply(true, { success, new_sch_name: name });
            }
            else if (doc.itemType === EDMT_ItemType.SCHEMATIC_PAGE) {
                const success = await eda.dmt_Schematic.modifySchematicPageName(uuid, name);
                return reply(true, { success, new_sch_page_name: name });
            }
            else if (doc.itemType === EDMT_ItemType.PCB) {
                const success = await eda.dmt_Pcb.modifyPcbName(uuid, name);
                return reply(true, { success, new_pcb_name: name });
            }

            return reply(false, undefined, "Unsupported doc format: " + doc.itemType);
        }

        if (message.event === 'create-board') {
            const schematicUuid = typeof body.schematicUuid === 'string' ? body.schematicUuid : undefined;
            const pcbUuid = typeof body.pcbUuid === 'string' ? body.pcbUuid : undefined;

            const boardName = await eda.dmt_Board.createBoard(schematicUuid, pcbUuid);
            if (!boardName) throw new Error('Failed to create board');

            reply(true, { boardName, schematicUuid, pcbUuid });
            return;
        }

        if (message.event === 'delete-doc') {
            if (typeof body.board_name === 'string') {
                const success = await eda.dmt_Board.deleteBoard(body.board_name);
                reply(true, { success });
            }

            const uuid = body.uuid;

            if (typeof uuid !== 'string' || !uuid) {
                throw new Error('Missing uuid');
            }

            const projectData = await getProjectInfo().then(d => d.project_data);
            const doc = findDocWithUUID(projectData, uuid);

            if (!doc) return reply(false, undefined, "Not found doc with this uuid");

            if (doc.itemType === EDMT_ItemType.SCHEMATIC) {
                const success = await eda.dmt_Schematic.deleteSchematic(uuid);
                reply(true, { success });
            }
            else if (doc.itemType === EDMT_ItemType.SCHEMATIC_PAGE) {
                const success = await eda.dmt_Schematic.deleteSchematicPage(uuid);
                return reply(true, { success });
            }
            else if (doc.itemType === EDMT_ItemType.PCB) {
                const success = await eda.dmt_Pcb.deletePcb(uuid);
                return reply(true, { success });
            }

            return reply(false, undefined, "Unsupported doc format: " + doc.itemType);
        }

        if (message.event === 'create-pcb') {
            const boardName = typeof body.boardName === 'string' ? body.boardName : undefined;

            const pcbUuid = await eda.dmt_Pcb.createPcb(boardName);
            if (!pcbUuid) throw new Error('Failed to create PCB');

            reply(true, { pcbUuid, boardName });
            return;
        }

        if (message.event === 'import-pcb-changes') {
            const schematicUuid = typeof body.schematicUuid === 'string' ? body.schematicUuid : undefined;

            const success = await eda.pcb_Document.importChanges(schematicUuid);
            if (success) return reply(true, { success, message: `In EasyEDA, when importing changes, the import dialog window opens if there are changes, or it does not open if there are no changes. In either case, the user must manually confirm the action within that dialog window (if it appears) to complete the import process.` });
            return reply(true, { success });
        }

        if (message.event === 'assemble-circuit') {
            const circuit = body.circuit;
            if (!circuit) throw new Error('Missing circuit in assemble-circuit body');

            await checkpointer.save(false);
            await assembleCircuit(circuit as Parameters<typeof assembleCircuit>[0]);
            reply(true, { assembled: true });
            return;
        }

        if (message.event === 'assemble-board') {
            const board = body.boardAssemble ?? body.board ?? body.pcb_board_assemble;
            if (!board) throw new Error('Missing board assemble payload in assemble-board body');

            await checkpointer.save(false);
            await assembleBoard(board as Parameters<typeof assembleBoard>[0]);
            reply(true, { assembled: true });
            return;
        }

        if (message.event === 'checkpoint-list') {
            reply(true, await checkpointer.list().then(cs => cs.slice(0, 16)));
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
