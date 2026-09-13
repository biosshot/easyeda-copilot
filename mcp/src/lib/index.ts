import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Blob, File } from 'node:buffer';
import { ProxyBridge, type EasyEdaInstance } from '../bridge/index';
import type { ExecuteJsWireResult } from '@copilot/shared/types/execute-js';
import { remoteRuntime } from './runtime';

type Expression = { k: 'root' } | { k: 'ref'; id: string; sessionId: string }
    | { k: 'get'; target: Expression; key: string | number }
    | { k: 'call'; id: string; target: Expression; args: unknown[] };
const remote = new WeakMap<object, { session: Session; expression: Expression }>();
const binaryTypes = new Set(['ArrayBuffer', 'DataView', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array']);

export class SdkError extends Error {
    constructor(message: string, public checkpoint: string | null = null, public outcomeUnknown = false,
        public failedIndex?: number) { super(message); this.name = 'SdkError'; }
}
export interface ConnectOptions {
    url?: string;
    instanceId?: string;
    /** Omit to bind to the current document; null explicitly permits document switching. */
    documentUuid?: string | null;
    timeoutMs?: number;
}
export interface ExecuteJsOptions {
    code?: string;
    file_path?: string;
    inputs?: Record<string, string>;
    input_files?: Record<string, { path: string; encoding?: 'utf8' }>;
}

export async function encode(value: any, session?: Session, seen = new Set<any>()): Promise<any> {
    if ((typeof value === 'object' && value !== null) || typeof value === 'function') {
        const ref = remote.get(value);
        if (ref) {
            if (ref.session !== session) throw new SdkError('Cannot pass an object from a different SDK session');
            return { t: 'expr', value: ref.expression };
        }
    }
    if (value === undefined) return { t: 'undefined' };
    if (typeof value === 'bigint') return { t: 'bigint', value: String(value) };
    if (typeof value === 'number' && !Number.isFinite(value)) return { t: 'number', value: String(value) };
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return { t: 'value', value };
    const type = Object.prototype.toString.call(value).slice(8, -1);
    if (type === 'Blob' || type === 'File') return { t: 'binary', type, mime: value.type, name: value.name,
        lastModified: value.lastModified, data: Buffer.from(await value.arrayBuffer()).toString('base64') };
    if (binaryTypes.has(type)) {
        const bytes = type === 'ArrayBuffer' ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        return { t: 'binary', type, data: Buffer.from(bytes).toString('base64') };
    }
    if (value instanceof Date) return { t: 'date', value: value.toISOString() };
    if (typeof value !== 'object') throw new SdkError('Functions/callbacks and symbols cannot cross the SDK bridge; use executeJs/eval');
    if (seen.has(value)) throw new SdkError('Cyclic local arguments are unsupported');
    seen.add(value);
    try {
        if (Array.isArray(value)) return { t: 'array', value: await Promise.all(value.map(v => encode(v, session, new Set(seen)))) };
        if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new SdkError('Pass plain data, binary data or a remote object');
        const entries = [];
        for (const [k, v] of Object.entries(value)) entries.push([k, await encode(v, session, seen)]);
        return { t: 'object', value: entries };
    } finally { seen.delete(value); }
}

export function decode(value: any, session?: Session): any {
    switch (value.t) {
        case 'value': return value.value;
        case 'undefined': return undefined;
        case 'bigint': return BigInt(value.value);
        case 'number': return Number(value.value);
        case 'date': return new Date(value.value);
        case 'array': return value.value.map((v: any) => decode(v, session));
        case 'object': return Object.fromEntries(value.value.map(([k, v]: any) => [k, decode(v, session)]));
        case 'ref': {
            if (!session || value.sessionId !== session.id) throw new SdkError('Invalid SDK object session');
            return session.proxy({ k: 'ref', id: value.id, sessionId: value.sessionId }, false);
        }
        case 'binary': {
            const bytes = Uint8Array.from(Buffer.from(value.data, 'base64'));
            if (value.type === 'Blob') return new Blob([bytes], { type: value.mime });
            if (value.type === 'File') return new File([bytes], value.name, { type: value.mime, lastModified: value.lastModified });
            if (!binaryTypes.has(value.type)) throw new SdkError('Unsupported SDK binary type');
            if (value.type === 'ArrayBuffer') return bytes.buffer;
            return new (globalThis as any)[value.type](bytes.buffer);
        }
        default: throw new SdkError('Invalid SDK response');
    }
}

export class Session {
    readonly id = randomUUID();
    readonly eda: any;
    documentUuid: string | null = null;
    lastCheckpoint: string | null = null;
    private closed = false;
    private broken = false;
    private tail: Promise<unknown> = Promise.resolve();
    private pending: { expression: Promise<Expression>; resolve: (v: any) => void; reject: (e: any) => void }[] = [];
    private scheduled?: ReturnType<typeof setImmediate>;
    constructor(private bridge: ProxyBridge, readonly instanceId: string, private timeoutMs: number) {
        this.eda = this.proxy({ k: 'root' }, false);
    }
    async initialize(documentUuid?: string | null) {
        const result = await this.request({ action: 'init', documentUuid });
        this.documentUuid = result.documentUuid;
    }
    /** Internal expression builder, also used by the bundled Python worker. */
    proxy(expression: Expression | Promise<Expression>, awaitable: boolean): any {
        let promise: Promise<any> | undefined;
        const proxy = new Proxy(function () {}, {
            get: (_target, key) => {
                if (key === 'then') return awaitable ? (resolve: any, reject: any) => {
                    promise ??= this.enqueue(Promise.resolve(expression));
                    return promise.then(resolve, reject);
                } : undefined;
                if (key === Symbol.toStringTag) return 'EasyEDAProxy';
                if (key === Symbol.toPrimitive) return () => { throw new SdkError('Await the remote value before using it locally'); };
                if (typeof key === 'symbol') return undefined;
                if (['__proto__', 'prototype', 'constructor', 'toJSON'].includes(key)) return undefined;
                const target = expression instanceof Promise
                    ? expression.then(target => ({ k: 'get' as const, target, key }))
                    : { k: 'get' as const, target: expression, key };
                return this.proxy(target, true);
            },
            apply: (_target, _this, args) => {
                const id = randomUUID();
                const call = Promise.all([Promise.resolve(expression), Promise.all(args.map(a => encode(a, this)))]).then(
                    ([target, args]) => ({ k: 'call' as const, id, target, args }));
                // Attach a handler immediately; argument errors are reported when awaited, not as unhandled rejections.
                call.catch(() => undefined);
                return this.proxy(call, true);
            },
            set: () => { throw new SdkError('Use native API setters/modify(); assigning to a proxy is unsupported'); },
        });
        // Deferred argument expressions are resolved before dispatch.
        remote.set(proxy, { session: this, expression: expression as Expression });
        return proxy;
    }
    private enqueue(expression: Promise<Expression>) {
        return new Promise((resolve, reject) => {
            this.pending.push({ expression, resolve, reject });
            this.scheduled ??= setImmediate(() => { this.scheduled = undefined; void this.flush(); });
        });
    }
    private async flush() {
        const jobs = this.pending.splice(0);
        if (!jobs.length) return;
        try {
            const expressions = await Promise.all(jobs.map(async j => resolveExpressions(await j.expression)));
            const results = await this.request({ action: 'calls', expressions });
            for (let i = 0; i < jobs.length; i++) {
                const item = results[i];
                if (item?.ok) jobs[i].resolve(decode(item.value, this));
                else jobs[i].reject(new SdkError(item?.error?.message ?? 'Not executed because an earlier call in this batch failed', this.lastCheckpoint, false, i));
            }
        } catch (error) { for (const job of jobs) job.reject(error); }
    }
    private serialize<T>(fn: () => Promise<T>): Promise<T> {
        const result = this.tail.then(fn);
        this.tail = result.catch(() => undefined);
        return result;
    }
    private async wire(code: string, inputs: Record<string, string> = {}) {
        if (this.closed || this.broken) throw new SdkError('SDK session is closed or disconnected; reconnect explicitly');
        let reply: ExecuteJsWireResult;
        try {
            reply = await this.bridge.requestEasyEda('execute-js', { code, inputs }, this.timeoutMs, this.instanceId) as ExecuteJsWireResult;
        } catch (error) {
            this.broken = true;
            this.bridge.close();
            throw new SdkError(`${String(error)}. Execution may still be running; do not automatically retry.`, null, true);
        }
        this.lastCheckpoint = reply.checkpoint;
        if (reply.error) throw new SdkError(`${reply.error.phase}: ${reply.error.message}`, reply.checkpoint);
        if (!reply.result) throw new SdkError('Empty execute-js result', reply.checkpoint);
        return reply.result;
    }
    /** Internal wire-level entry point shared with Python; does not start a broker. */
    request(packet: Record<string, unknown>): Promise<any> {
        return this.serialize(async () => {
            const code = `return await (${remoteRuntime.toString()})(eda, JSON.parse(inputs.packet));`;
            const result = await this.wire(code, { packet: JSON.stringify({ ...packet, sessionId: this.id }) });
            if (result.kind !== 'json') throw new SdkError('Unexpected SDK envelope');
            return JSON.parse(result.json);
        });
    }
    async eval(code: string, inputs: unknown = {}) {
        return decode(await this.request({ action: 'eval', code, inputs: await resolveExpressions(await encode(inputs, this)) }), this);
    }
    /** Existing EasyEDA script semantics, including inputs[name] strings. Returns data, not MCP file artifacts. */
    async executeJs(options: ExecuteJsOptions): Promise<any> {
        if ((options.code !== undefined) === (options.file_path !== undefined)) throw new SdkError('Provide exactly one of code or file_path');
        const code = options.code ?? await readFile(options.file_path!, 'utf8');
        const inputs = { ...options.inputs };
        for (const [name, file] of Object.entries(options.input_files ?? {})) inputs[name] = await readFile(file.path, 'utf8');
        if (Object.values(inputs).some(v => typeof v !== 'string')) throw new SdkError('Legacy inputs must be strings');
        return this.serialize(async () => {
            const result = await this.wire(code, inputs);
            return result.kind === 'json' ? JSON.parse(result.json)
                : new Blob([Buffer.from(result.base64, 'base64')], { type: result.mime_type });
        });
    }
    async release(...objects: object[]) {
        const ids = objects.map(obj => {
            const ref = remote.get(obj);
            if (!ref || ref.session !== this || ref.expression.k !== 'ref') throw new SdkError('Expected an object from this session');
            return ref.expression.id;
        });
        await this.request({ action: 'release', ids });
    }
    async close() {
        if (this.closed) return;
        if (this.scheduled) { clearImmediate(this.scheduled); this.scheduled = undefined; }
        await this.flush();
        try { if (!this.broken) await this.request({ action: 'close' }); }
        finally { this.closed = true; this.bridge.close(); }
    }
}

async function resolveExpressions(value: any): Promise<any> {
    value = await value;
    if (Array.isArray(value)) return Promise.all(value.map(resolveExpressions));
    if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([k, v]) => [k, await resolveExpressions(v)])));
    return value;
}

function url(options: ConnectOptions) {
    return options.url ?? `ws://${process.env.EASYEDA_COPILOT_MCP_WS_HOST || '127.0.0.1'}:${process.env.EASYEDA_COPILOT_MCP_WS_PORT || '8787'}`;
}
export async function listInstances(options: Pick<ConnectOptions, 'url'> = {}): Promise<EasyEdaInstance[]> {
    const bridge = new ProxyBridge(url(options), () => undefined);
    try { await bridge.connect(); return await bridge.listEasyEdaInstances(); }
    finally { bridge.close(); }
}
export async function connect(options: ConnectOptions = {}): Promise<Session> {
    const bridge = new ProxyBridge(url(options), () => undefined);
    try {
        await bridge.connect();
        const instances = await bridge.listEasyEdaInstances();
        const instance = options.instanceId ? instances.find(i => i.instanceId === options.instanceId)
            : instances.length === 1 ? instances[0] : undefined;
        if (!instance) throw new SdkError('Select a connected instanceId; use listInstances()');
        const timeout = options.timeoutMs ?? 60_000;
        if (!Number.isFinite(timeout) || timeout <= 0) throw new SdkError('timeoutMs must be positive');
        const session = new Session(bridge, instance.instanceId, timeout);
        await session.initialize(options.documentUuid);
        return session;
    } catch (error) { bridge.close(); throw error; }
}
