#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { startBridge } from './bridge/index';
import { registerPcbTools } from './tools/pcb/index';
import { registerCheckpointTools } from './tools/checkpoint';
import { registerCircuitTools } from './tools/circuit';
import { registerDocsTools } from './tools/docs';
import { registerDrcTools } from './tools/drc';
import { registerEasyEdaInstancesTools } from './tools/easyeda-instances';
import { DOCS_DIR, SKILL_DOC_PATH } from './utils/dirs';

const MCP_WS_PORT = Number(process.env.EASYEDA_COPILOT_MCP_WS_PORT || 8787);
const MCP_WS_HOST = process.env.EASYEDA_COPILOT_MCP_WS_HOST || '127.0.0.1';

const SKILL_DOC_URI = 'easyeda-copilot-mcp://local-docs/SKILL.md';

function localSkillDocText() {
    return [
        'EasyEDA Copilot MCP documentation is cached locally.',
        `Skill file: ${SKILL_DOC_PATH}`,
        `Docs directory: ${DOCS_DIR}`,
        'Read SKILL.md first. It points to the rest of the local docs.'
    ].filter(Boolean).join('\n');
}

const server = new McpServer({
    name: 'easyeda-copilot',
    version: '1.1.5',
});

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

async function main() {
    const bridge = await startBridge({
        host: MCP_WS_HOST,
        port: MCP_WS_PORT,
    });

    registerPcbTools(server, bridge);
    registerCheckpointTools(server, bridge);
    registerCircuitTools(server, bridge);
    registerDocsTools(server, bridge);
    registerDrcTools(server, bridge);
    registerEasyEdaInstancesTools(server, bridge);

    const transport = new StdioServerTransport();

    let transportEnded = false;
    let transportEndStarted = false;
    let forceShutdownStarted = false;
    let transportClosePromise: Promise<void> | undefined;
    let bridgeClosePromise: Promise<void> | undefined;

    const closeTransport = () => {
        if (transportClosePromise) return transportClosePromise;
        if (transportEnded) return Promise.resolve();
        transportEnded = true;
        transportClosePromise = transport.close().catch(() => undefined);
        return transportClosePromise;
    };
    const closeBridge = () => {
        bridgeClosePromise ??= bridge.close();
        return bridgeClosePromise;
    };
    const handleTransportEnd = async () => {
        if (transportEndStarted || forceShutdownStarted) return;
        transportEndStarted = true;

        await closeTransport();
        if (forceShutdownStarted) return;
        if (bridge.enterBrokerOnlyMode()) return;
        await closeBridge();
    };
    const forceShutdown = async () => {
        if (forceShutdownStarted) return;
        forceShutdownStarted = true;
        await closeBridge();
        await closeTransport();
    };
    const request = (action: () => Promise<void>) => {
        action().catch(() => {
            process.exitCode = 1;
        });
    };

    let transportReady = false;
    let transportEndRequested = false;
    const requestTransportEnd = () => {
        transportEndRequested = true;
        if (transportReady) request(handleTransportEnd);
    };

    transport.onclose = () => {
        transportEnded = true;
        requestTransportEnd();
    };
    process.stdin.once('end', requestTransportEnd);
    process.stdin.once('close', requestTransportEnd);
    process.once('SIGINT', () => request(forceShutdown));
    process.once('SIGTERM', () => request(forceShutdown));

    await server.connect(transport);
    transportReady = true;
    if (transportEndRequested || process.stdin.readableEnded || process.stdin.destroyed) {
        request(handleTransportEnd);
    }
}

main().catch(() => {
    // console.error('Fatal error in main():', error);
    process.exit(1);
});
