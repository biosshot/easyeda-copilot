import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import * as z from 'zod/v4';
import {
    EXECUTE_JS_MAX_CODE_BYTES, EXECUTE_JS_TIMEOUT_MS, type ExecuteJsWireResult,
} from '@copilot/shared/types/execute-js';
import type { Bridge } from '../bridge';
import { DOCS_DIR, TEMP_DIR } from '../utils/dirs';
import { textResult } from '../utils/tool-result';

export const ExecuteJsInputSchema = z.object({
    code: z.string().min(1).max(EXECUTE_JS_MAX_CODE_BYTES).optional()
        .describe('JavaScript async-function body. Use return for the result; await all changes.'),
    file_path: z.string().min(1).max(4096).optional()
        .describe('Absolute path to a UTF-8 JavaScript file on the MCP host. Alternative to code.'),
}).refine(value => (value.code !== undefined) !== (value.file_path !== undefined), {
    message: 'Provide exactly one of code or file_path.',
});

const MAX_INLINE_RESPONSE_BYTES = 16 * 1024;
const ARTIFACT_DIR = join(TEMP_DIR, 'responses');
const extensions: Record<string, string> = {
    'application/json': 'json', 'text/plain': 'txt', 'image/png': 'png',
    'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'application/pdf': 'pdf',
};

async function saveArtifact(data: string | Uint8Array, mimeType: string) {
    const mime = mimeType.split(';')[0].trim().toLowerCase();
    const mime_type = mime.length <= 100 && /^[\w.+-]+\/[\w.+-]+$/.test(mime)
        ? mime : 'application/octet-stream';
    const extension = extensions[mime_type] ?? 'bin';
    const path = join(ARTIFACT_DIR, `${randomUUID()}.${extension}`);
    await fs.mkdir(ARTIFACT_DIR, { recursive: true });
    await fs.writeFile(path, data, { flag: 'wx' });
    return { path, mime_type, bytes: typeof data === 'string' ? Buffer.byteLength(data) : data.byteLength,
        ...(extension === 'bin' ? { note: 'Unsupported format; saved as binary.' } : {}) };
}

type ExecuteJsResult = { checkpoint: string | null; result: unknown; artifacts: Awaited<ReturnType<typeof saveArtifact>>[] };
const artifactError = 'Could not save the response artifact. Payload withheld; changes may already have been applied.';

async function response(payload: ExecuteJsResult, isError = false): Promise<CallToolResult> {
    try {
        let result: CallToolResult = { ...textResult(payload), ...(isError ? { isError: true } : {}) };
        if (Buffer.byteLength(JSON.stringify(result)) <= MAX_INLINE_RESPONSE_BYTES) return result;
        const artifact = await saveArtifact(JSON.stringify(payload), 'application/json');
        result = { ...textResult({ checkpoint: payload.checkpoint, result: null, artifacts: [artifact] }),
            ...(isError ? { isError: true } : {}) };
        if (Buffer.byteLength(JSON.stringify(result)) > MAX_INLINE_RESPONSE_BYTES) throw new Error('Artifact path too long.');
        return result;
    } catch {
        return { ...textResult({ checkpoint: payload.checkpoint, result: { error: { phase: 'artifact', message: artifactError } },
            artifacts: [] }), isError: true };
    }
}

export async function executeJs(
    bridge: Pick<Bridge, 'requestEasyEda'>,
    input: z.infer<typeof ExecuteJsInputSchema>,
): Promise<CallToolResult> {
    let checkpoint: string | null = null;
    let phase = 'input';
    try {
        ExecuteJsInputSchema.parse(input);
        if (input.file_path !== undefined && !isAbsolute(input.file_path)) throw new Error('file_path must be absolute on the MCP host.');
        const code = input.code ?? await fs.readFile(input.file_path!, 'utf8');
        if (!code.trim()) throw new Error('JavaScript code is empty.');
        if (Buffer.byteLength(code) > EXECUTE_JS_MAX_CODE_BYTES) throw new Error('JavaScript exceeds 1 MiB.');
        phase = 'transport';
        const reply = await bridge.requestEasyEda('execute-js', { code }, EXECUTE_JS_TIMEOUT_MS) as ExecuteJsWireResult;
        checkpoint = reply.checkpoint;
        phase = 'response';
        if (reply.error) {
            return await response({ checkpoint, result: { error: reply.error }, artifacts: [] }, true);
        }
        if (reply.result?.kind === 'binary') {
            phase = 'artifact';
            const artifact = await saveArtifact(Buffer.from(reply.result.base64, 'base64'), reply.result.mime_type);
            return await response({ checkpoint, result: null, artifacts: [artifact] });
        }
        if (reply.result?.kind !== 'json') throw new Error('Invalid JavaScript execution response.');
        return await response({ checkpoint, result: JSON.parse(reply.result.json), artifacts: [] });
    } catch (error) {
        let message = 'An error occurred that could not be converted to text.';
        try { message = error instanceof Error ? String(error.message) : String(error); } catch { /* Keep the fixed message. */ }
        const suffix = phase === 'transport'
            ? ' Execution/checkpoint completion is unconfirmed. A timeout or disconnect does not stop JavaScript. Do not automatically retry.'
            : '';
        return response({ checkpoint, result: { error: { phase,
            message: phase === 'artifact' ? artifactError : message + suffix } }, artifacts: [] }, true);
    }
}

export function registerExecuteJsTools(server: McpServer, bridge: Bridge) {
    server.registerTool('execute_js', {
        title: 'Execute JavaScript in EasyEDA',
        description: 'Execute JavaScript in the selected EasyEDA window using code OR an absolute file_path. '
            + 'Automatically checkpoints the current document before execution. Waits up to 60 seconds; timeout does NOT cancel code. '
            + 'Returns {checkpoint,result,artifacts}; binary and oversized results are saved as local files. '
            + `Read ${DOCS_DIR}/execution/instructions.md for the contract and API reference.`,
        inputSchema: ExecuteJsInputSchema,
    }, input => executeJs(bridge, input));
}
