#!/usr/bin/env node
import { disposeBackend } from 'eda-copilot-backend/pcb';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { startBridge } from './bridge/index';
import { createServer } from './server';

const MCP_WS_PORT = Number(process.env.EASYEDA_COPILOT_MCP_WS_PORT || 8787);
const MCP_WS_HOST = process.env.EASYEDA_COPILOT_MCP_WS_HOST || '127.0.0.1';

async function main() {
    const bridge = await startBridge({
        host: MCP_WS_HOST,
        port: MCP_WS_PORT,
    });

    const server = createServer(bridge);

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
        await disposeBackend();
        if (forceShutdownStarted) return;
        if (bridge.enterBrokerOnlyMode()) return;
        await closeBridge();
    };
    const forceShutdown = async () => {
        if (forceShutdownStarted) return;
        forceShutdownStarted = true;
        await disposeBackend();
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
