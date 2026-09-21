import { EXECUTE_JS_TIMEOUT_MS, type ExecuteJsWireResult } from '@copilot/shared/types/execute-js';
import { MCP_TIMEOUT_MESSAGE } from '../mcp-command-timeout';
import { withTimeout } from '../timeout';

function isBlob(value: unknown): value is Blob {
    if (!value || typeof value !== 'object') return false;
    // API values may originate in a different editor frame, where instanceof is insufficient.
    return (typeof Blob !== 'undefined' && value instanceof Blob)
        || (['[object Blob]', '[object File]'].includes(Object.prototype.toString.call(value))
            && typeof (value as Blob).arrayBuffer === 'function');
}

function isArrayBuffer(value: unknown): value is ArrayBuffer {
    return value instanceof ArrayBuffer || Object.prototype.toString.call(value) === '[object ArrayBuffer]';
}

// Encode in bounded chunks without spread/apply argument limits or browser-only helpers.
export function base64(bytes: Uint8Array): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const chunks: string[] = [];
    let chunk = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const a = bytes[i];
        const b = bytes[i + 1];
        const c = bytes[i + 2];
        chunk += alphabet[a >> 2] + alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)]
            + (i + 1 < bytes.length ? alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)] : '=')
            + (i + 2 < bytes.length ? alphabet[c & 63] : '=');
        if (chunk.length >= 32_768) {
            chunks.push(chunk);
            chunk = '';
        }
    }
    chunks.push(chunk);
    return chunks.join('');
}

function errorMessage(error: unknown): string {
    try {
        return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    } catch {
        return 'An error was thrown that could not be converted to text.';
    }
}

/** Timeout releases the caller, but cannot cancel already-started native actions. */
export async function executeJavaScript(
    code: string,
    api: unknown,
    createCheckpoint: () => Promise<string | null>,
    inputs: Record<string, string> = {},
    options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<ExecuteJsWireResult> {
    let checkpoint: string | null = null;
    let phase: NonNullable<ExecuteJsWireResult['error']>['phase'] = 'checkpoint';
    let executionSignal: AbortSignal | undefined;
    let scopeApi: object | undefined;
    const clearScope = () => {
        // Shallow cleanup only: nested namespaces belong to the real editor API.
        // Saved references and native calls already in flight are not revoked.
        if (scopeApi) for (const key of Reflect.ownKeys(scopeApi)) Reflect.deleteProperty(scopeApi, key);
    };
    try {
        return await withTimeout(async signal => {
            executionSignal = signal;
            signal.addEventListener('abort', clearScope, { once: true });
            checkpoint = await createCheckpoint();
            signal.throwIfAborted();
            if (!checkpoint) throw new Error('Could not create a checkpoint; JavaScript was not executed.');

            phase = 'execute';
            scopeApi = { ...(api as object) };
            const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
            // Compilation itself reports syntax errors; no separate parser or preflight execution.
            const result: unknown = await new AsyncFunction('eda', 'inputs', code)(scopeApi, inputs);
            signal.throwIfAborted();

            phase = 'serialize';
            if (isBlob(result)) {
                const buffer = await result.arrayBuffer();
                signal.throwIfAborted();
                return { checkpoint, result: {
                    kind: 'binary',
                    base64: base64(new Uint8Array(buffer)),
                    mime_type: result.type || 'application/octet-stream',
                } };
            }
            if (isArrayBuffer(result) || ArrayBuffer.isView(result)) {
                const bytes = isArrayBuffer(result)
                    ? new Uint8Array(result)
                    : new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
                return { checkpoint, result: {
                    kind: 'binary', base64: base64(bytes), mime_type: 'application/octet-stream',
                } };
            }
            if (typeof result === 'function' || typeof result === 'symbol') {
                throw new Error('Return JSON-compatible data, a Blob, an ArrayBuffer or a typed array.');
            }
            const json = JSON.stringify(result, (_key, value: unknown) => {
                if (isBlob(value) || isArrayBuffer(value) || ArrayBuffer.isView(value)) {
                    throw new Error('Return binary data directly, not nested inside a JSON object.');
                }
                if (typeof value === 'function' || typeof value === 'symbol') {
                    throw new Error('Return plain JSON data; functions and symbols cannot be serialized.');
                }
                return value;
            });
            return { checkpoint, result: { kind: 'json', json: json ?? 'null' } };
        }, Math.min(options.timeoutMs ?? EXECUTE_JS_TIMEOUT_MS, EXECUTE_JS_TIMEOUT_MS), MCP_TIMEOUT_MESSAGE, options.signal);
    } catch (error) {
        return { checkpoint, result: null, error: { phase, message: errorMessage(error) } };
    } finally {
        executionSignal?.removeEventListener('abort', clearScope);
    }
}
