import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { compactMarkdown, restoreExamples } from '../scripts/update-easyeda-api.mjs';

test('tables preserve empty columns, links, enum values and union types', () => {
    const source = '<table><thead><tr><th>Name</th><th>Modifiers</th><th>Type</th></tr></thead>'
        + '<tbody><tr><td>\n[pin](./pin.md)\n</td><td>\n\n</td><td>string \\| undefined</td></tr>'
        + '<tr><td>NO_COMPONENTS</td><td></td><td>`2`</td></tr></tbody></table>\n';
    assert.equal(compactMarkdown(source), '|Name|Modifiers|Type|\n|---|---|---|\n'
        + '|[pin](./pin.md)||string \\| undefined|\n|NO_COMPONENTS||`2`|\n');
});

test('fenced code retains indentation, empty lines, strings and literal HTML tables', () => {
    const code = '```typescript\nfunction run() {\n\tconst s = "  x  ";\n\n\n'
        + '  return "<table><tr><td>x</td></tr></table>";\n}\n```\n';
    assert.equal(compactMarkdown('# Title\n\n\n' + code), '# Title\n\n' + code);
    assert.equal(compactMarkdown(code.replaceAll('\n', '\r\n')), code);
});

test('inline code does not become table markup; pipes are escaped once', () => {
    const source = '<table><tr><th>Type</th><th>Notes</th></tr>'
        + '<tr><td>`Array<number> | undefined`</td><td>Keep `<tr>` and `"  x  "`</td></tr></table>';
    const result = compactMarkdown(source);
    assert.match(result, /`Array<number> \\\| undefined`/);
    assert.ok(result.includes('Keep `<tr>` and `"  x  "`'));
    assert.equal(compactMarkdown(result), result);
});

test('prose, examples, hard breaks, warnings and paragraph boundaries remain', () => {
    const source = '# API\n\n> BETA warning.\n\n## Remarks\n\nLine  \nNext\n\n- Optional: null.\n';
    assert.equal(compactMarkdown(source), source);
});

test('Markdown table padding shrinks without changing alignment or inline code', () => {
    const source = '| Name        | Type                 |\n| :---------- | ------------------: |\n'
        + '| value       | `"  a | b  "`       |\n';
    const expected = '|Name|Type|\n|:---|---:|\n|value|`"  a | b  "`|\n';
    assert.equal(compactMarkdown(source), expected);
    assert.equal(compactMarkdown(expected), expected);
});

test('unknown or malformed table structure fails instead of dropping content', () => {
    for (const source of [
        '<table><tr><th colspan="2">X</th></tr></table>',
        '<table><tr><th>X</th></tr><tr><td>A</td><td>B</td></tr></table>',
        '<table>unexpected<tr><th>X</th></tr></table>',
        '<table><tr><th>X</th></tr>',
    ]) assert.throws(() => compactMarkdown(source));
});

test('all generated references match their manifest and compaction is idempotent', async () => {
    const root = new URL('../docs/execution/easyeda-api/', import.meta.url);
    const manifest = JSON.parse(await fs.readFile(new URL('source.json', root), 'utf8'));
    assert(!manifest.files.some(file => file.path === 'references/_quick-reference.md'));
    assert(manifest.files.some(file => file.path === 'format/index.md'));
    await assert.rejects(fs.access(new URL('references/_quick-reference.md', root)));
    for (const file of manifest.files) {
        const data = await fs.readFile(new URL(file.path, root));
        assert.equal(createHash('sha256').update(data).digest('hex'), file.sha256, file.path);
        if (file.path.endsWith('.md')) assert.equal(compactMarkdown(data.toString()), data.toString(), file.path);
    }
});

test('local examples survive refresh, precede the next method and are not duplicated', () => {
    const source = '# API.one() method\n\n## Signature\n```ts\nfunction one(): void;\n```\n\n### two\n\n# API.two() method\n';
    const examples = [{ heading: '# API.one() method', occurrence: 0, markdown: '## Example\n\n```js\nawait one();\n```\n' }];
    const result = restoreExamples(source, examples);
    assert(result.indexOf('## Example') < result.indexOf('### two'));
    assert.equal(restoreExamples(result, examples), result);
    assert.throws(() => restoreExamples(source, [{ ...examples[0], heading: '# Missing' }]));
});

test('generated docs retain every local example code block', async () => {
    const root = new URL('../docs/execution/easyeda-api/', import.meta.url);
    const examples = JSON.parse(await fs.readFile(new URL('../scripts/easyeda-api-examples.json', import.meta.url), 'utf8'));
    for (const [path, entries] of Object.entries(examples.files)) {
        const text = await fs.readFile(new URL(path, root), 'utf8');
        for (const entry of entries) {
            for (const block of entry.markdown.matchAll(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm)) {
                assert(text.includes(block[0]), `${path}: example missing for ${entry.heading}`);
            }
        }
    }
});
