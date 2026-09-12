import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = 'https://github.com/easyeda/easyeda-api-skill';
const destination = fileURLToPath(new URL('../docs/execution/easyeda-api', import.meta.url));
const hash = text => createHash('sha256').update(text).digest('hex');
const sections = ['references', 'format'];

export function restoreExamples(source, examples = []) {
    const text = source.replace(/\r\n/g, '\n');
    const visible = text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm,
        block => block.replace(/[^\n]/g, ' '));
    const headings = [...visible.matchAll(/^# [^\n]+/gm)];
    const insertions = [];
    for (const example of examples) {
        const matching = headings.filter(heading => heading[0].trim() === example.heading);
        const heading = matching[example.occurrence];
        assert(heading, `Local example target missing: ${example.heading} (${example.occurrence})`);
        const index = headings.indexOf(heading);
        let end = headings[index + 1]?.index ?? text.length;
        const section = visible.slice(heading.index, end);
        const body = example.markdown.replace(/^## Example\s*\n/, '').trim();
        if (text.slice(heading.index, end).includes(body)) continue;
        const markdown = /^## Example\s*$/m.test(section)
            ? example.markdown.replace(/^## Example/, '## Example (local)') : example.markdown;
        // The next method's navigation heading precedes its top-level API heading.
        const prelude = section.match(/\n### [^\n]+\n\s*$/);
        if (prelude) end = heading.index + prelude.index;
        insertions.push({ at: end, text: '\n\n' + markdown.trim() + '\n\n' });
    }
    let result = text;
    for (const insertion of insertions.sort((a, b) => b.at - a.at)) {
        result = result.slice(0, insertion.at) + insertion.text + result.slice(insertion.at);
    }
    return result;
}

function compactPipeTables(prose) {
    return prose.replace(/(?:^\|[^\n]*\|[ \t]*(?:\n|$)){2,}/gm, table => {
        const code = [];
        const masked = table.replace(/(`+)([^\n]*?)\1/g, text => `\uE000${code.push(text) - 1}\uE001`);
        const rows = masked.trimEnd().split('\n').map(line => line.trim().slice(1, -1).split(/(?<!\\)\|/).map(cell => cell.trim()));
        if (!rows[1].every(cell => /^:?-+:?$/.test(cell)) || !rows.every(row => row.length === rows[0].length)) return table;
        rows[1] = rows[1].map(cell => `${cell.startsWith(':') ? ':' : ''}---${cell.endsWith(':') ? ':' : ''}`);
        return rows.map(row => `|${row.join('|')}|`).join('\n').replace(/\uE000(\d+)\uE001/g, (_, index) => code[Number(index)]) + '\n';
    });
}

// Do not parse HTML generally: API types such as Array<number> are literal content.
// Only the known documentation table wrappers are replaced.
function compactTable(table) {
    const inline = [];
    assert(!table.includes('\uE000'), 'Reserved placeholder in source');
    table = table.replace(/(`+)([^\n]*?)\1/g, code => `\uE000${inline.push(code) - 1}\uE001`);
    assert(!/<(?:table|thead|tbody|tr|th|td)\s+[^>]+>/i.test(table), 'Unsupported table attributes');
    const rows = [];
    let residue = table.replace(/<\/?(?:table|thead|tbody)>/g, '');
    residue = residue.replace(/<tr>([\s\S]*?)<\/tr>/g, (_, row) => {
        const cells = [];
        const rest = row.replace(/<(th|td)>([\s\S]*?)<\/\1>/g, (__, tag, value) => {
            assert(!/<\/?(?:table|thead|tbody|tr|th|td)\b/.test(value), 'Nested table');
            assert(!/```|~~~/.test(value), 'Fenced code inside table');
            cells.push(value.trim().replace(/\s+/g, ' ')
                .replace(/\uE000(\d+)\uE001/g, (_, index) => inline[Number(index)])
                .replace(/(?<!\\)\|/g, '\\|'));
            return '';
        });
        assert.equal(rest.trim(), '', 'Unrecognized table row content');
        assert(cells.length, 'Empty table row');
        rows.push(cells);
        return '';
    });
    assert.equal(residue.trim(), '', 'Unrecognized table content');
    assert(rows.length, 'Empty table');
    assert(rows.every(row => row.length === rows[0].length), 'Unequal table columns');
    const line = cells => `|${cells.join('|')}|`;
    return [line(rows[0]), line(rows[0].map(() => '---')), ...rows.slice(1).map(line)].join('\n');
}

export function compactMarkdown(source) {
    const lines = source.replace(/\r\n/g, '\n').split('\n');
    let prose = '', output = '', fence;
    const flush = () => {
        prose = prose.replace(/<table>[\s\S]*?<\/table>/g, compactTable);
        assert(!/<\/?(?:table|thead|tbody|tr|th|td)\b/.test(prose.replace(/(`+)([^\n]*?)\1/g, '')), 'Unconverted table markup');
        // Preserve Markdown hard breaks, indentation, paragraph and list boundaries.
        output += compactPipeTables(prose).replace(/\n{3,}/g, '\n\n');
        prose = '';
    };
    for (const line of lines) {
        if (fence) {
            output += line + '\n';
            const end = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
            if (end && end[1][0] === fence[0] && end[1].length >= fence.length) fence = undefined;
        } else {
            const start = line.match(/^ {0,3}(`{3,}|~{3,})/);
            if (start) {
                flush();
                fence = start[1];
                output += line + '\n';
            } else prose += line + '\n';
        }
    }
    assert(!fence, 'Unclosed code fence');
    flush();
    return output.replace(/\n+$/, '\n');
}

async function filesUnder(root, prefix = '') {
    const files = [];
    for (const entry of await fs.readdir(join(root, prefix), { withFileTypes: true })) {
        assert(!entry.isSymbolicLink(), `Symlinks are not supported: ${entry.name}`);
        const name = join(prefix, entry.name);
        if (entry.isDirectory()) files.push(...await filesUnder(root, name));
        else if (entry.isFile()) files.push(name);
    }
    return files.sort();
}

function git(cwd, ...args) {
    return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export async function update({ source, ref } = {}) {
    const temporaryRoot = await fs.realpath(tmpdir());
    const work = await fs.mkdtemp(join(temporaryRoot, 'easyeda-api-docs-'));
    try {
        if (!source) {
            source = join(work, 'upstream');
            execFileSync('git', ['-c', 'core.autocrlf=false', 'clone', '--depth', '1', `${repository}.git`, source], { stdio: 'inherit' });
            if (ref) {
                git(source, 'fetch', '--depth', '1', 'origin', ref);
                git(source, 'checkout', '--detach', 'FETCH_HEAD');
            }
        } else {
            assert(!ref, 'Use --ref with cloning, or --source with an existing checkout');
            source = await fs.realpath(resolve(source));
        }
        const commit = git(source, 'rev-parse', 'HEAD');
        assert(/^[a-f0-9]{40}$/.test(commit), 'Invalid upstream commit');
        assert.equal(git(source, 'status', '--porcelain', '--', ...sections), '', 'Upstream documentation has uncommitted changes');
        const sourceRoot = source;
        const names = [];
        for (const section of sections) {
            names.push(...(await filesUnder(join(sourceRoot, section))).map(name => join(section, name)));
        }
        const quickReference = names.indexOf(join('references', '_quick-reference.md'));
        if (quickReference >= 0) names.splice(quickReference, 1);
        assert(names.includes(join('references', '_index.md')) && names.includes(join('format', 'index.md')), 'Missing documentation index');
        const generated = new Map();
        const records = [];
        const examplesData = await fs.readFile(new URL('./easyeda-api-examples.json', import.meta.url));
        const localExamples = JSON.parse(examplesData).files;
        for (const path of Object.keys(localExamples)) {
            assert(names.includes(path.split('/').join(sep)), `Local example file missing upstream: ${path}`);
        }
        for (const name of names) {
            // Read the committed blob so --source and clones agree across Git EOL settings.
            const original = execFileSync('git', ['-C', source, 'show', `HEAD:${name.split(sep).join('/')}`],
                { maxBuffer: 16 * 1024 * 1024 });
            let result;
            try {
                let text = restoreExamples(original.toString('utf8'), localExamples[name.split(sep).join('/')]);
                // Upstream website routes must resolve inside the packaged format snapshot.
                if (name.endsWith('.md')) text = text.replace(/\]\(\/en\/format\/([^\s)#]*)(#[^\s)]*)?\)/g, (_, route, anchor = '') => {
                    const file = route.replace(/\/$/, '').replace(/\.md$/, '') + '.md';
                    return `](${relative(dirname(join(sourceRoot, name)), join(sourceRoot, 'format', file)).split(sep).join('/')}${anchor})`;
                });
                text = text.replace(/\]\((\/storage\/images\/[^\s)]+)\)/g, '](' + 'https://prodocs.easyeda.com$1)');
                result = name.endsWith('.md') ? Buffer.from(compactMarkdown(text)) : original;
            }
            catch (error) { throw new Error(`Cannot compact ${name}: ${error.message}`, { cause: error }); }
            generated.set(name, result);
            records.push({ path: name.split(sep).join('/'), sourceBytes: original.length, bytes: result.length,
                sourceSha256: hash(original), sha256: hash(result) });
        }
        // Validate before replacing any packaged files. References must stay self-contained.
        for (const [name, data] of generated) {
            if (!name.endsWith('.md')) continue;
            const prose = data.toString().replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '');
            for (const [, target] of prose.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
                if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(target)) continue;
                const path = resolve(sourceRoot, dirname(name), decodeURIComponent(target.split('#')[0]));
                const local = relative(sourceRoot, path);
                assert(local !== '..' && !local.startsWith(`..${sep}`) && !isAbsolute(local), `External local link: ${name}: ${target}`);
                assert(generated.has(local) || names.some(n => n.startsWith(local + sep)), `Missing link: ${name}: ${target}`);
            }
        }
        const outputRoot = destination;
        await fs.mkdir(outputRoot, { recursive: true });
        assert.equal(await fs.realpath(outputRoot), resolve(outputRoot), 'Output must not be a symlink');
        const old = [];
        for (const section of sections) {
            await fs.mkdir(join(outputRoot, section), { recursive: true });
            old.push(...(await filesUnder(join(outputRoot, section))).map(name => join(section, name)));
        }
        for (const [name, data] of generated) {
            const path = join(outputRoot, name);
            await fs.mkdir(dirname(path), { recursive: true });
            await fs.writeFile(path, data);
        }
        for (const name of old) if (!generated.has(name)) await fs.unlink(join(outputRoot, name));
        const sourceBytes = records.reduce((sum, file) => sum + file.sourceBytes, 0);
        const bytes = records.reduce((sum, file) => sum + file.bytes, 0);
        await fs.writeFile(join(destination, 'source.json'), JSON.stringify({ repository, commit,
            generator: 'mcp/scripts/update-easyeda-api.mjs', formatVersion: 3, examplesSha256: hash(examplesData), sourceBytes, bytes, files: records }) + '\n');
        // Preserve an upstream license if one is supplied; never import its skill or bridge code.
        for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'NOTICE']) {
            try { await fs.copyFile(join(source, name), join(destination, name)); }
            catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
        console.log(`${records.length} documentation files, commit ${commit}\nUpstream: ${sourceBytes} bytes; compact output including local examples: ${bytes} bytes.`);
    } finally {
        const target = resolve(work);
        assert.equal(dirname(target), temporaryRoot, 'Cleanup target is outside temporary directory');
        assert(target.startsWith(join(temporaryRoot, 'easyeda-api-docs-')), 'Unexpected cleanup target');
        await fs.rm(target, { recursive: true, force: true });
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const options = {};
    for (let i = 2; i < process.argv.length; i += 2) {
        const key = process.argv[i];
        assert(['--source', '--ref'].includes(key) && process.argv[i + 1], 'Usage: update-easyeda-api.mjs [--ref COMMIT | --source CHECKOUT]');
        options[key.slice(2)] = process.argv[i + 1];
    }
    await update(options);
}
