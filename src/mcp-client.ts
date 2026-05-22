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

let isRegistered = false;

function parseBody<T = Record<string, unknown>>(message: McpMessage): T {
    return message.body ? JSON.parse(message.body) as T : {} as T;
}

function send(event: string, body: Record<string, unknown>) {
    eda.sys_WebSocket.send(MCP_WS_ID, JSON.stringify({
        event,
        body: JSON.stringify(body),
    } satisfies McpMessage));
}

async function handleMessage(message: McpMessage) {
    if (message.event === 'connected') {
        eda.sys_Log.add('MCP WebSocket connected', ESYS_LogType.INFO);
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
            const schematicUuid = await eda.dmt_Schematic.createSchematic(boardName);
            if (!schematicUuid) throw new Error('Failed to create schematic');

            reply(true, { schematicUuid });
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
            reply(true, checkpoint);
            return;
        }

        if (message.event === 'checkpoint-restore') {
            const restored = await checkpointer.restore(typeof body.checkpointId === 'string' ? body.checkpointId : undefined);
            reply(true, { restored });
            return;
        }

        throw new Error(`Unknown MCP event: ${message.event}`);
    } catch (error) {
        eda.sys_Log.add(`MCP event error: ${message.event}: ${(error as Error).message}`, ESYS_LogType.ERROR);
        reply(false, undefined, error);
    }
}

export function connectMcp() {
    if (isRegistered) {
        eda.sys_WebSocket.register(MCP_WS_ID, MCP_WS_URL);
        return;
    }

    isRegistered = true;
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
            eda.sys_Log.add(`MCP WebSocket opened: ${MCP_WS_URL}`, ESYS_LogType.INFO);
            eda.sys_Message.showToastMessage('MCP connected', ESYS_ToastMessageType.SUCCESS);
        }
    );
}

export function disconnectMcp() {
    eda.sys_WebSocket.close(MCP_WS_ID, 1000, 'Closed by EasyEDA Copilot');
    isRegistered = false;
}
