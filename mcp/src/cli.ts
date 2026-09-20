#!/usr/bin/env node
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { createConnection, createServer as createSocketServer } from 'node:net';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { disposeBackend } from 'eda-copilot-backend/pcb';
import { createServer } from './server';
import { startBridge } from './bridge';
import { operationManager } from './operations/manager';
import { DOCS_DIR, ROOT_DIR } from './utils/dirs';

const ID_PATTERN = /^[a-z0-9]{4}$/;
const MAX_BYTES = 64 * 1024 * 1024;
const REQUEST_TIMEOUT = 10 * 60_000;
const ENTRY = fileURLToPath(import.meta.url);
const STATE_DIR = resolve(process.env.EASYEDA_COPILOT_CLI_HOME || join(homedir(), '.easyeda-copilot', 'cli'));
const namespace = createHash('sha256').update(STATE_DIR).digest('hex').slice(0, 16);
type Metadata = { id: string; token: string; pid?: number; entry: string; version: string; ready: boolean };
type Request = { token: string; command: string; name?: string; args?: Record<string, unknown>; force?: boolean };
type Response = { ok: boolean; result?: unknown; error?: string; toolError?: boolean };

function statePath(id: string) {
    if (!ID_PATTERN.test(id)) throw new Error('Expected a four-character daemon ID (a-z, 0-9).');
    return join(STATE_DIR, id, 'daemon.json');
}
function endpoint(id: string) {
    statePath(id);
    return process.platform === 'win32'
        ? `\\\\.\\pipe\\easyeda-copilot-${namespace}-${id}`
        : join(tmpdir(), `easyeda-${namespace}-${id}.sock`);
}
async function metadata(id: string): Promise<Metadata> {
    try { return JSON.parse(await readFile(statePath(id), 'utf8')); }
    catch { throw new Error(`Daemon ${id} is unavailable. Run start for a new ID; old operations cannot be resumed in a new process.`); }
}
async function request(id: string, body: Omit<Request, 'token'>, timeout = REQUEST_TIMEOUT): Promise<Response> {
    const meta = await metadata(id);
    return new Promise((resolveResponse, reject) => {
        const socket = createConnection(endpoint(id));
        let buffer = '';
        let bytes = 0;
        let settled = false;
        const finish = (error?: Error, value?: Response) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            socket.destroy();
            if (error) reject(error); else resolveResponse(value!);
        };
        const timer = setTimeout(() => finish(new Error('CLI request timed out. Execution may still be running; do not retry a mutation blindly.')), timeout);
        socket.setEncoding('utf8');
        socket.on('connect', () => socket.write(JSON.stringify({ ...body, token: meta.token }) + '\n'));
        socket.on('data', chunk => {
            bytes += Buffer.byteLength(chunk);
            if (bytes > MAX_BYTES) return finish(new Error('CLI response exceeds 64 MiB.'));
            buffer += chunk;
            const end = buffer.indexOf('\n');
            if (end < 0) return;
            try { finish(undefined, JSON.parse(buffer.slice(0, end))); }
            catch { finish(new Error('Invalid daemon response.')); }
        });
        socket.on('error', error => finish(new Error(`Cannot reach daemon ${id}: ${error.message}. Requests are never automatically retried.`)));
        socket.on('close', () => finish(new Error('Daemon disconnected. The execution outcome may be unknown; inspect before retrying.')));
    });
}

async function serve(id: string) {
    const meta = await metadata(id);
    const bridge = await startBridge({
        host: process.env.EASYEDA_COPILOT_MCP_WS_HOST || '127.0.0.1',
        port: Number(process.env.EASYEDA_COPILOT_MCP_WS_PORT || 8787),
    });
    const server = createServer(bridge);
    const client = new Client({ name: 'easyeda-copilot-cli', version: meta.version });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    let activeCalls = 0;
    let stopping = false;
    const startedAt = new Date().toISOString();
    const sockets = new Set<ReturnType<typeof createConnection>>();

    const shutdown = async () => {
        if (stopping) return;
        stopping = true;
        listener.close();
        await unlink(statePath(id)).catch(() => undefined);
        const deadline = setTimeout(() => process.exit(1), 10_000);
        try {
            await Promise.allSettled(operationManager.runningIds().map(operation => operationManager.cancel(operation)));
            await disposeBackend();
            await client.close();
            await server.close();
            // Preserve the existing broker lifecycle if other MCP processes depend on this owner.
            if (!bridge.enterBrokerOnlyMode()) await bridge.close();
        } finally {
            for (const socket of sockets) socket.destroy();
            clearTimeout(deadline);
        }
    };
    async function dispatch(input: Request): Promise<Response> {
        if (input.token !== meta.token) throw new Error('Invalid daemon token.');
        if (stopping) throw new Error('Daemon is stopping.');
        switch (input.command) {
            case 'status': return { ok: true, result: {
                id, pid: process.pid, version: meta.version, startedAt, activeCalls,
                running_operations: operationManager.runningIds(), docs: DOCS_DIR,
                instances: await bridge.listEasyEdaInstances(),
            } };
            case 'stop': {
                if (!input.force && (activeCalls || operationManager.runningIds().length)) {
                    throw new Error('Daemon has active calls or operations. Wait for completion, or explicitly use stop --force.');
                }
                return { ok: true, result: { id, stopped: true } };
            }
            case 'list':
            case 'help': {
                const catalog = [];
                let cursor: string | undefined;
                do {
                    const page = await client.listTools(cursor ? { cursor } : undefined);
                    catalog.push(...page.tools);
                    cursor = page.nextCursor;
                } while (cursor);
                if (input.command === 'list') return { ok: true, result: catalog.map(({ name, description }) => ({ name, description })) };
                const tool = catalog.find(tool => tool.name === input.name);
                if (!tool) throw new Error(`Unknown tool: ${input.name}`);
                return { ok: true, result: tool };
            }
            case 'call': {
                if (!input.name) throw new Error('Tool name is required.');
                activeCalls++;
                try {
                    const result = await client.callTool({ name: input.name, arguments: input.args ?? {} }, undefined, { timeout: REQUEST_TIMEOUT });
                    return { ok: true, result, toolError: Boolean(result.isError) };
                } finally { activeCalls--; }
            }
            default: throw new Error(`Unknown command: ${input.command}`);
        }
    }
    const listener = createSocketServer(socket => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
        socket.on('error', () => undefined);
        socket.setEncoding('utf8');
        socket.setTimeout(10_000, () => socket.destroy());
        let buffer = '';
        let bytes = 0;
        let received = false;
        socket.on('data', chunk => {
            if (received) return;
            bytes += Buffer.byteLength(chunk);
            if (bytes > MAX_BYTES) return socket.destroy();
            buffer += chunk;
            const end = buffer.indexOf('\n');
            if (end < 0) return;
            received = true;
            socket.setTimeout(0);
            void (async () => {
                let response: Response;
                let input: Request | undefined;
                try {
                    input = JSON.parse(buffer.slice(0, end));
                    response = await dispatch(input!);
                } catch (error) { response = { ok: false, error: error instanceof Error ? error.message : String(error) }; }
                const shouldStop = response.ok && input?.command === 'stop';
                socket.end(JSON.stringify(response) + '\n');
                if (shouldStop) void shutdown().catch(console.error);
            })();
        });
    });
    await new Promise<void>((ready, reject) => {
        listener.once('error', reject);
        listener.listen(endpoint(id), ready);
    });
    if (process.platform !== 'win32') {
        const { chmod } = await import('node:fs/promises');
        await chmod(endpoint(id), 0o600);
    }
    await writeFile(statePath(id), JSON.stringify({ ...meta, pid: process.pid, ready: true }), { mode: 0o600 });
    process.once('SIGINT', () => void shutdown().catch(console.error));
    process.once('SIGTERM', () => void shutdown().catch(console.error));
}

async function start() {
    await mkdir(STATE_DIR, { recursive: true, mode: 0o700 });
    let id = '';
    for (let attempt = 0; attempt < 100; attempt++) {
        id = Array.from({ length: 4 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[randomInt(36)]).join('');
        try { await mkdir(dirname(statePath(id)), { mode: 0o700 }); break; }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; id = ''; }
    }
    if (!id) throw new Error('Cannot allocate daemon ID.');
    const pkg = JSON.parse(await readFile(join(ROOT_DIR, 'package.json'), 'utf8'));
    await writeFile(statePath(id), JSON.stringify({ id, token: randomBytes(32).toString('hex'), entry: ENTRY, version: pkg.version, ready: false }), { mode: 0o600 });
    const logPath = join(dirname(statePath(id)), 'daemon.log');
    const log = openSync(logPath, 'a', 0o600);
    const child = spawn(process.execPath, [ENTRY, '__serve', id], { detached: true, windowsHide: true, stdio: ['ignore', log, log] });
    closeSync(log);
    let spawnError: Error | undefined;
    let exited = false;
    child.once('error', error => { spawnError = error; });
    child.once('exit', () => { exited = true; });
    child.unref();
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline && !spawnError && !exited) {
        try {
            const meta = await metadata(id);
            if (meta.ready) {
                const status = await request(id, { command: 'status' }, 2000);
                if (status.ok) { process.stdout.write(id + '\n'); return; }
            }
        } catch { /* Only readiness probes are retried, never tool calls. */ }
        await new Promise(resolveDelay => setTimeout(resolveDelay, 100));
    }
    child.kill();
    await unlink(statePath(id)).catch(() => undefined);
    throw new Error(`Daemon failed to start: ${spawnError?.message ?? 'see log'} (${logPath})`);
}

function output(value: unknown) { process.stdout.write(JSON.stringify(value, null, 2) + '\n'); }
const usage = `easyeda-copilot-cli start
easyeda-copilot-cli <id> status
easyeda-copilot-cli <id> tools list
easyeda-copilot-cli <id> tools help <tool>
easyeda-copilot-cli <id> call <tool> [--input file.json | --json '{...}'] [--raw]
easyeda-copilot-cli <id> stop [--force]
Omitted tool arguments default to {}. Use absolute paths inside tool arguments.
Each agent starts its own daemon and retains its ID. Node.js >=20.19 is required.`;

async function main() {
    const [id, command, ...rest] = process.argv.slice(2);
    if (!id || id === '--help' || id === 'help') { console.log(usage); return; }
    if (id === '__serve' && command && !rest.length) { await serve(command); return; }
    if (id === 'start' && !command) { await start(); return; }
    statePath(id);
    let body: Omit<Request, 'token'>;
    let raw = false;
    if (command === 'tools' && rest[0] === 'list' && rest.length === 1) body = { command: 'list' };
    else if (command === 'tools' && rest[0] === 'help' && rest.length === 2) body = { command: 'help', name: rest[1] };
    else if (command === 'status' && !rest.length) body = { command };
    else if (command === 'stop' && (!rest.length || rest.length === 1 && rest[0] === '--force')) body = { command, force: rest[0] === '--force' };
    else if (command === 'call' && rest[0]) {
        let args: unknown = {};
        let supplied = false;
        for (let i = 1; i < rest.length; i++) {
            const option = rest[i];
            if (option === '--raw' && !raw) { raw = true; continue; }
            if ((option !== '--input' && option !== '--json') || supplied || !rest[i + 1]) throw new Error(usage);
            const value = rest[++i];
            args = JSON.parse(option === '--input' ? await readFile(resolve(value), 'utf8') : value);
            supplied = true;
        }
        if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Tool arguments must be a JSON object.');
        body = { command, name: rest[0], args: args as Record<string, unknown> };
    } else throw new Error(usage);
    const response = await request(id, body);
    if (!response.ok) throw new Error(response.error);
    let result = response.result;
    if (body.command === 'call' && !raw) {
        const mcp = result as { structuredContent?: unknown; content?: Array<{ type: string; text?: string }> };
        for (const warning of mcp.content?.slice(1) ?? []) {
            if (warning.type === 'text' && warning.text) console.error(warning.text);
        }
        if (mcp.structuredContent !== undefined) result = mcp.structuredContent;
        else if (mcp.content?.[0]?.type === 'text') {
            const value = mcp.content[0].text!;
            try { result = JSON.parse(value); } catch { result = value; }
        }
    }
    output(result);
    if (response.toolError) process.exitCode = 1;
}
main().catch(error => { console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) })); process.exitCode = 1; });
