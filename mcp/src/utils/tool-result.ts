import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import { TEMP_DIR } from './dirs';

export const MAX_INLINE_RESPONSE_BYTES = 8 * 1024;

// execute_js applies the same budget itself to preserve its checkpoint/artifacts contract.
export function inlineTextResult(value: unknown) {
    return {
        content: [{
            type: 'text' as const,
            text: typeof value === 'string' ? value : JSON.stringify(value) ?? 'null',
        }],
    };
}

export async function textResult(value: unknown) {
    const result = inlineTextResult(value);
    if (Buffer.byteLength(JSON.stringify(result)) <= MAX_INLINE_RESPONSE_BYTES) return result;

    try {
        const isText = typeof value === 'string';
        const directory = join(TEMP_DIR, 'responses');
        const path = join(directory, `${randomUUID()}.${isText ? 'txt' : 'json'}`);
        const text = result.content[0].text;
        const reference = inlineTextResult({
            message: 'Response exceeds 8 KiB; full content saved to file.',
            path,
            mime_type: isText ? 'text/plain' : 'application/json',
            bytes: Buffer.byteLength(text),
        });
        if (Buffer.byteLength(JSON.stringify(reference)) > MAX_INLINE_RESPONSE_BYTES) {
            throw new Error('Artifact path too long.');
        }
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(path, text, { flag: 'wx' });
        return reference;
    } catch {
        return {
            ...inlineTextResult('Could not save the response artifact. Payload withheld; changes may already have been applied.'),
            isError: true,
        };
    }
}
