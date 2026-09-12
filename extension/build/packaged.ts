import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import JSZip from 'jszip';
import extensionConfig from '../extension.json';

// Archive paths are relative to the extension package, regardless of the caller's cwd.
// Keep the public root build/dist output so existing local/CI consumers keep working.
const extensionRoot = resolve(__dirname, '..');
const repositoryRoot = resolve(extensionRoot, '..');
const outputRoot = join(repositoryRoot, 'build', 'dist');

async function main() {
    assert.match(extensionConfig.uuid, /^[a-z0-9]{32}$/, 'Extension UUID must be stable and valid');
    const zip = new JSZip();
    async function addDirectory(directory: string) {
        for (const entry of await readdir(join(extensionRoot, directory), { withFileTypes: true })) {
            const path = `${directory}/${entry.name}`;
            if (entry.isDirectory()) await addDirectory(path);
            else if (entry.isFile()) zip.file(path, await readFile(join(extensionRoot, path)));
        }
    }
    for (const directory of ['dist', 'iframe', 'images', 'locales']) await addDirectory(directory);
    zip.file('extension.json', await readFile(join(extensionRoot, 'extension.json')));
    zip.file('LICENSE', await readFile(join(repositoryRoot, 'LICENSE')));
    for (const required of ['extension.json', 'dist/index.js', 'iframe/index.html', 'iframe/graph.html', 'iframe/reused.html', 'images/logo.png', 'images/banner.png', 'LICENSE']) {
        assert.ok(zip.file(required), `Missing extension artifact: ${required}`);
    }
    const contents = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 1 } });
    await mkdir(outputRoot, { recursive: true });
    const output = join(outputRoot, `${extensionConfig.name}_v${extensionConfig.version}.eext`);
    await writeFile(output, contents);
    console.log(`Extension packaged: ${output} (${Object.keys(zip.files).length} entries)`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
