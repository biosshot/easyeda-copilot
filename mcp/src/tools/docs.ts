import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import * as z from 'zod/v4';
import { Bridge } from "../bridge";
import { textResult } from "../utils/tool-result";

export const OpenDocumentInputSchema = z.object({
    document_uuid: z.string().trim().min(1).optional().describe('Document UUID from get_current_project_info.'),
    project_uuid: z.string().trim().min(1).optional().describe('Project UUID from get_all_projects or create_doc.'),
}).refine(
    input => Number(input.document_uuid !== undefined) + Number(input.project_uuid !== undefined) === 1,
    { message: 'Provide exactly one of document_uuid or project_uuid.' },
);

export const CreateDocInputSchema = z.object({
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
        z.object({
            doc_type: z.literal('project'),
            project_friendly_name: z.string().trim().min(1).describe('Human-readable EasyEDA project name.'),
            project_name: z.string().trim().regex(/^[A-Za-z0-9-]+$/).optional()
                .describe('Optional unique identifier containing only ASCII letters, digits, and hyphens.'),
            team_uuid: z.string().trim().min(1).optional().describe('Optional team UUID. Omit for a personal project.'),
            folder_uuid: z.string().trim().min(1).optional().describe('Optional destination folder UUID.'),
            description: z.string().trim().optional().describe('Optional project description.'),
        }),
    ]),
});

export async function openDocument(bridge: Bridge, input: z.infer<typeof OpenDocumentInputSchema>) {
    return input.project_uuid
        ? bridge.requestEasyEda('open-project', { projectUuid: input.project_uuid })
        : bridge.requestEasyEda('open-document', { documentUuid: input.document_uuid });
}

export async function saveDoc(bridge: Bridge) {
    return bridge.requestEasyEda('save-document');
}

export async function createDoc(bridge: Bridge, { doc }: z.infer<typeof CreateDocInputSchema>) {
    switch (doc.doc_type) {
        case 'schematic':
            return bridge.requestEasyEda('create-schematic', { boardName: doc.board_name });
        case 'schematic_page':
            return bridge.requestEasyEda('create-schematic-page', { schematicUuid: doc.schematic_uuid });
        case 'board':
            return bridge.requestEasyEda('create-board', {
                schematicUuid: doc.schematic_uuid,
                pcbUuid: doc.pcb_uuid,
            });
        case 'pcb':
            return bridge.requestEasyEda('create-pcb', { boardName: doc.board_name });
        case 'project':
            return bridge.requestEasyEda('create-project', {
                projectFriendlyName: doc.project_friendly_name,
                projectName: doc.project_name,
                teamUuid: doc.team_uuid,
                folderUuid: doc.folder_uuid,
                description: doc.description,
            });
    }
}

export function registerDocsTools(server: McpServer, bridge: Bridge) {

    server.registerTool(
        'open_document',
        {
            title: 'Open EasyEDA Project or Document',
            description: 'Open either a project or a document by UUID. Before switching projects, every open EasyEDA schematic, PCB, and panel tab is saved; the switch is aborted if any save fails.',
            inputSchema: OpenDocumentInputSchema,
        },
        async input => textResult(await openDocument(bridge, input)),
    );

    server.registerTool(
        'save_doc',
        {
            title: 'Save Current EasyEDA Document',
            description: 'Save the currently active EasyEDA schematic, PCB, or panel document.',
            inputSchema: z.object({}),
        },
        async () => textResult(await saveDoc(bridge)),
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
            });
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
            title: 'Create EasyEDA Project or Document',
            description: 'Create a project, or create a document in the current EasyEDA project. Project creation uses an experimental EasyEDA beta API and does not open the new project.',
            inputSchema: CreateDocInputSchema,
        },
        async input => textResult(await createDoc(bridge, input)),
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
