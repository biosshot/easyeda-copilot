import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import * as z from 'zod/v4';
import { Bridge } from "../bridge";
import { textResult } from "../utils/tool-result";

export function registerDocsTools(server: McpServer, bridge: Bridge) {

    server.registerTool(
        'open_document',
        {
            title: 'Open EasyEDA Project Document',
            description: 'Open a schematic, schematic page, PCB, or panel document from the current EasyEDA project by document UUID.',
            inputSchema: z.object({
                document_uuid: z.string().min(1).describe('Document UUID from get_current_project_info.'),
            }),
        },
        async ({ document_uuid }) => {
            const result = await bridge.requestEasyEda('open-document', {
                documentUuid: document_uuid,
            });
            return textResult(result);
        },
    );

    server.registerTool(
        'sync_current_document',
        {
            title: 'Sync Current EasyEDA Document',
            description: 'Force EasyEDA to synchronize the current schematic or PCB document by saving it, closing the current editor tab, waiting briefly, and reopening the same document.',
            inputSchema: z.object({
                settle_ms: z.number().min(0).max(10000).default(500).describe('Delay in milliseconds between close and reopen.'),
            }),
        },
        async ({ settle_ms }) => {
            const result = await bridge.requestEasyEda('sync-current-document', {
                settleMs: settle_ms,
            }, 300000);
            return textResult(result);
        },
    );

    const DOC_QUERY = z.object({
        uuid: z.string().min(1).describe('Schematic, Schematic page or PCB UUID.'),
    }).or(z.object({
        board_name: z.string().min(1)
    }))

    server.registerTool(
        'modify_name',
        {
            title: 'Rename EasyEDA: Schematic, Schematic page, PCB',
            description: 'Modify the name of an EasyEDA Schematic, Schematic page, PCB',
            inputSchema: z.object({
                doc: DOC_QUERY,
                name: z.string().min(1).describe('New short name. Use UPPERCASE or PascalCase'),
            }),
        },
        async ({ name, doc }) => {
            const result = await bridge.requestEasyEda('modify-name', { name, ...doc });
            return textResult(result);
        },
    );

    server.registerTool(
        'create_doc',
        {
            title: 'Create EasyEDA Doc',
            description: 'Create a doc in the current EasyEDA project',
            inputSchema: z.object({
                doc: z.union([
                    z.object({
                        doc_type: z.literal('board'),
                        schematic_uuid: z.string().min(1).optional().describe('Optional schematic UUID to link to the new board.'),
                        pcb_uuid: z.string().min(1).optional().describe('Optional PCB UUID to link to the new board.'),
                    }),
                    z.object({
                        doc_type: z.literal('schematic'),
                        board_name: z.string().min(1).optional().describe('Optional parent board name.'),
                    }),
                    z.object({
                        doc_type: z.literal('schematic_page'),
                        schematic_uuid: z.string().min(1).describe('Parent schematic UUID.'),
                    }),
                    z.object({
                        doc_type: z.literal('pcb'),
                        board_name: z.string().min(1).optional().describe('Optional parent board name.'),
                    }),
                ]),
            })
        },
        async ({ doc }) => {
            switch (doc.doc_type) {
                case 'schematic': {
                    const result = await bridge.requestEasyEda('create-schematic', {
                        boardName: doc.board_name,
                    });
                    return textResult(result);
                }
                case 'schematic_page': {
                    const result = await bridge.requestEasyEda('create-schematic-page', {
                        schematicUuid: doc.schematic_uuid,
                    });
                    return textResult(result);
                }
                case 'board': {
                    const result = await bridge.requestEasyEda('create-board', {
                        schematicUuid: doc.schematic_uuid,
                        pcbUuid: doc.pcb_uuid,
                    });
                    return textResult(result);
                }
                case 'pcb': {
                    const result = await bridge.requestEasyEda('create-pcb', {
                        boardName: doc.board_name,
                    });
                    return textResult(result);
                }
                default:
                    throw new Error(`Unsupported create_doc doc_type`);
            }
        },
    );

    server.registerTool(
        'delete_doc',
        {
            title: 'Delete EasyEDA Doc',
            description: 'Delete a doc from the current EasyEDA project. This is destructive!',
            inputSchema: z.object({
                doc: DOC_QUERY,
            }),
        },
        async ({ doc }) => {
            const result = await bridge.requestEasyEda('delete-doc', { ...doc });
            return textResult(result);
        },
    );


    server.registerTool(
        'get_current_project_info',
        {
            title: 'Get Current EasyEDA Project Info',
            description: 'Read the current EasyEDA project tree and document metadata through the connected extension. BOARD items show the linked schematic and PCB document; use this before PCB assembly.',
            inputSchema: z.object({}),
        },
        async () => {
            const result = await bridge.requestEasyEda('get-current-project-info');
            return textResult(result);
        },
    );
}