import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { textResult } from '../utils/tool-result';

/** Preserve the tool result and its error/artifact contract, adding the discoverable operation ID. */
export async function operationToolResult(value: unknown): Promise<CallToolResult> {
    const operation = value as { operation_id?: string; tool_result?: CallToolResult };
    if (!operation?.tool_result) return textResult(value);
    const result = operation.tool_result;
    if (result.content.length === 1 && result.content[0].type === 'text') {
        let payload: unknown;
        try { payload = JSON.parse(result.content[0].text); } catch { payload = { message: result.content[0].text }; }
        const body = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : { result: payload };
        const response = await textResult({ ...body, operation_id: operation.operation_id });
        // An oversized result may have become an artifact reference. Keep its operation ID inline.
        try {
            const inline = JSON.parse(response.content[0].text);
            if (inline.operation_id === undefined) response.content[0].text = JSON.stringify({ ...inline, operation_id: operation.operation_id });
        } catch {
            response.content.push({ type: 'text', text: JSON.stringify({ operation_id: operation.operation_id }) });
        }
        return { ...response, ...(result.isError ? { isError: true } : {}) };
    }
    return { ...result, content: [...result.content, { type: 'text', text: JSON.stringify({ operation_id: operation.operation_id }) }] };
}
