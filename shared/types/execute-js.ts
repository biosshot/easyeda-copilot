export const EXECUTE_JS_TIMEOUT_MS = 60_000;
export const EXECUTE_JS_MAX_CODE_BYTES = 64 * 1024 * 1024;
export const EXECUTE_JS_MAX_INPUT_BYTES = 512 * 1024 * 1024;
// Account for JSON escaping and the bridge's nested JSON body/envelopes.
export const EXECUTE_JS_MAX_WIRE_BYTES = 12 * (EXECUTE_JS_MAX_CODE_BYTES + EXECUTE_JS_MAX_INPUT_BYTES) + 1024 * 1024;

/** Internal bridge payload; binary data and serialized JSON never go straight to MCP. */
export type ExecuteJsWireResult = {
    checkpoint: string | null;
    result:
        | { kind: 'json'; json: string }
        | { kind: 'binary'; base64: string; mime_type: string }
        | null;
    error?: { phase: 'checkpoint' | 'execute' | 'serialize'; message: string };
};
