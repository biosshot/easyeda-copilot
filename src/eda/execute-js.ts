import type { ExecuteJsWireResult } from '@copilot/shared/types/execute-js';

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

/** Runs in the existing extension command queue. No timeout race may release that queue. */
export async function executeJavaScript(
    code: string,
    api: unknown,
    createCheckpoint: () => Promise<string | null>,
    inputs: Record<string, string> = {},
): Promise<ExecuteJsWireResult> {
    let checkpoint: string | null = null;
    let phase: NonNullable<ExecuteJsWireResult['error']>['phase'] = 'checkpoint';
    try {
        checkpoint = await createCheckpoint();
        if (!checkpoint) throw new Error('Could not create a checkpoint; JavaScript was not executed.');

        phase = 'execute';
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        // Compilation itself reports syntax errors; no separate parser or preflight execution.
        const result: unknown = await new AsyncFunction('eda', 'inputs', code)(api, inputs);

        phase = 'serialize';
        if (isBlob(result)) {
            return { checkpoint, result: {
                kind: 'binary',
                base64: base64(new Uint8Array(await result.arrayBuffer())),
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
    } catch (error) {
        return { checkpoint, result: null, error: { phase, message: errorMessage(error) } };
    }
}
