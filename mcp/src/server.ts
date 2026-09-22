import { abortable, withExecutionSignal } from './operations/cancellation';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { Bridge } from './bridge/index';
import { registerPcbTools } from './tools/pcb/index';
import { registerCheckpointTools } from './tools/checkpoint';
import { registerCircuitTools } from './tools/circuit';
import { registerSchematicGroupTools } from './tools/schematic-groups';
import { registerDesignatorTools } from './tools/designators';
import { registerDocsTools } from './tools/docs';
import { registerDrcTools } from './tools/drc';
import { registerEasyEdaInstancesTools } from './tools/easyeda-instances';
import { registerOperationTools } from './tools/operations';
import { registerProjectTools } from './tools/projects';
import { registerExecuteJsTools } from './tools/execute-js';
import { DOCS_DIR, MCP_VERSION, SKILL_DOC_PATH } from './utils/dirs';

const SKILL_DOC_URI = 'easyeda-copilot-mcp://local-docs/SKILL.md';

function localSkillDocText() {
    return [
        'EasyEDA Copilot MCP documentation is cached locally.',
        `Skill file: ${SKILL_DOC_PATH}`,
        `Docs directory: ${DOCS_DIR}`,
        'Read SKILL.md first. It points to the rest of the local docs.'
    ].filter(Boolean).join('\n');
}

export function createServer(bridge: Bridge) {
    const server = new McpServer({
        name: 'easyeda-copilot',
        version: MCP_VERSION,
    });

    const registerTool = server.registerTool.bind(server);
    server.registerTool = ((name: string, config: unknown, handler: (...args: unknown[]) => unknown) =>
        registerTool(name, config as never, async (...args: unknown[]) => {
            const extra = args[args.length - 1] as { signal: AbortSignal };
            const result = await withExecutionSignal(extra.signal, () =>
                abortable(Promise.resolve(handler(...args)), extra.signal),
            ) as { content?: unknown[] };
            extra.signal.throwIfAborted();
            const warning = await bridge.getVersionWarning(MCP_VERSION);
            if (warning && Array.isArray(result?.content)) {
                result.content.push({ type: 'text', text: warning });
            }
            return result as never;
        })) as typeof server.registerTool;

    server.registerResource(
        'easyeda_copilot_mcp_skill',
        SKILL_DOC_URI,
        {
            title: 'EasyEDA Copilot MCP Skill',
            description: 'Path to the locally cached EasyEDA Copilot MCP SKILL.md.',
            mimeType: 'text/plain',
        },
        async (uri) => ({
            contents: [{
                uri: uri.toString(),
                mimeType: 'text/plain',
                text: localSkillDocText(),
            }],
        }),
    );

    server.registerPrompt(
        'easyeda_copilot_mcp_skill',
        {
            title: 'EasyEDA Copilot MCP Skill',
            description: 'Use the locally cached EasyEDA Copilot MCP SKILL.md.',
        },
        async () => ({
            description: 'Local EasyEDA Copilot MCP skill documentation.',
            messages: [{
                role: 'user',
                content: {
                    type: 'text',
                    text: localSkillDocText(),
                },
            }],
        }),
    );

    registerPcbTools(server, bridge);
    registerCheckpointTools(server, bridge);
    registerCircuitTools(server, bridge);
    registerSchematicGroupTools(server, bridge);
    registerDesignatorTools(server, bridge);
    registerDocsTools(server, bridge);
    registerDrcTools(server, bridge);
    registerEasyEdaInstancesTools(server, bridge);
    registerOperationTools(server);
    registerProjectTools(server, bridge);
    registerExecuteJsTools(server, bridge);

    return server;
}
