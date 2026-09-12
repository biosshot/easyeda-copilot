import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { after, mock, test } from 'node:test';
import { build } from 'esbuild';

const root = new URL('../', import.meta.url);
const output = new URL(`.test-data/tool-result-${randomUUID()}.mjs`, root);
await fs.mkdir(new URL('.test-data/', root), { recursive: true });
await build({
    entryPoints: [fileURLToPath(new URL('src/utils/tool-result.ts', root))],
    outfile: fileURLToPath(output),
    bundle: true, platform: 'node', format: 'esm', packages: 'external', logLevel: 'silent',
});
const { textResult, inlineTextResult, MAX_INLINE_RESPONSE_BYTES } = await import(output.href);
const artifacts = [];
after(async () => {
    await Promise.all([output, ...artifacts].map(path => fs.unlink(path)));
});
const size = value => Buffer.byteLength(JSON.stringify(value));

test('small objects use compact JSON and strings retain intentional whitespace', async () => {
    assert.equal((await textResult({ a: [1, 2] })).content[0].text, '{"a":[1,2]}');
    assert.equal((await textResult('a\n  b')).content[0].text, 'a\n  b');
});

test('exactly 8 KiB stays inline; one extra byte is saved without loss', async () => {
    const text = 'x'.repeat(MAX_INLINE_RESPONSE_BYTES - size(inlineTextResult('')));
    const inline = await textResult(text);
    assert.equal(size(inline), MAX_INLINE_RESPONSE_BYTES);
    assert.equal(inline.content[0].text, text);
    const result = await textResult(text + 'x');
    assert.ok(size(result) <= MAX_INLINE_RESPONSE_BYTES);
    const reference = JSON.parse(result.content[0].text);
    artifacts.push(reference.path);
    assert.equal(reference.mime_type, 'text/plain');
    assert.equal(await fs.readFile(reference.path, 'utf8'), text + 'x');
});

test('UTF-8 and JSON escaping count toward the wire budget; JSON artifact is compact', async () => {
    for (const value of [{ text: 'Я'.repeat(9000) }, { text: '"'.repeat(6000) }]) {
        const result = await textResult(value);
        assert.ok(size(result) <= MAX_INLINE_RESPONSE_BYTES);
        const reference = JSON.parse(result.content[0].text);
        artifacts.push(reference.path);
        const saved = await fs.readFile(reference.path, 'utf8');
        assert.equal(reference.mime_type, 'application/json');
        assert.equal(saved, JSON.stringify(value));
        assert.equal(reference.bytes, Buffer.byteLength(saved));
        assert.deepEqual(JSON.parse(saved), value);
    }
});

test('write failure returns a bounded error instead of leaking the oversized payload', async () => {
    const write = mock.method(fs, 'writeFile', async () => { throw new Error('disk full'); });
    try {
        const result = await textResult('x'.repeat(20000));
        assert.equal(result.isError, true);
        assert.ok(size(result) <= MAX_INLINE_RESPONSE_BYTES);
        assert.match(result.content[0].text, /changes may already have been applied/);
    } finally {
        write.mock.restore();
    }
});
