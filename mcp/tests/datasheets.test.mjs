import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, readdir, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { download, wrapperLink } from '../docs/datasheets/scripts/download.mjs';
import { summarize, outline } from '../docs/datasheets/scripts/pdf-outline.mjs';

const exec = promisify(execFile);
const pdf = Buffer.from('%PDF-1.4\n1 0 obj <<>> endobj\n%%EOF\n');
test('page navigation preserves actual PDF positions and labels heuristics', () => {
  const r = summarize('Contents\nPin Configuration ........ 7\fIntroduction\fPin Configuration\nEN input\f');
  assert.equal(r.scannedPages, 3);
  assert.equal(r.entries[0].pdfPage, 1);
  assert.equal(r.entries[0].kind, 'contents_page');
  assert.equal(r.entries[1].pdfPage, 3);
  assert.equal(summarize('x\fENABLE threshold\f', 'enable').entries[0].pdfPage, 2);
  assert.equal(summarize(Array(40).fill('thermal').join('\f')).truncated, true);
});
test('wrapper parsing resolves relative links, escaped URLs, ambiguity and unsafe protocols', () => {
  assert.equal(wrapperLink('<a href="/a.pdf?x=1&amp;y=2">PDF</a>', 'https://lcsc.com/x'), 'https://lcsc.com/a.pdf?x=1&y=2');
  assert.equal(wrapperLink('<meta http-equiv="refresh" content="0; URL=/a.pdf">', 'https://lcsc.com/x'), 'https://lcsc.com/a.pdf');
  assert.throws(() => wrapperLink('<a href="a.pdf"></a><a href="b.pdf"></a>', 'https://lcsc.com'), /Multiple/);
  assert.throws(() => wrapperLink('{"pdfUrl":"file:///a.pdf"}', 'https://lcsc.com'), /HTTP/);
});
test('download follows redirects/wrappers, refuses HTML, loops, truncation and overwrite', async t => {
  const root = await mkdtemp(join(tmpdir(), 'datasheets-test-'));
  const server = createServer((req, res) => {
    if (req.url === '/redirect') { res.writeHead(302, { Location: '/wrapper' }); res.end(); }
    else if (req.url === '/wrapper') res.end('<a href="/file.pdf">Datasheet</a>');
    else if (req.url === '/file.pdf') res.end(pdf);
    else if (req.url === '/other.pdf') res.end(Buffer.from('%PDF-1.4\nother\n%%EOF'));
    else if (req.url === '/cut') res.end('%PDF-1.4\ncut');
    else if (req.url === '/loop') { res.writeHead(302, { Location: '/loop' }); res.end(); }
    else res.end('<html>Access denied</html>');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const options = { out: join(root, 'part.pdf'), pdftotext: join(root, 'missing-tool') };
  const r = await download(base + '/redirect', options);
  assert.equal(r.outline.status, 'unavailable');
  assert.equal(r.finalUrl, base + '/file.pdf');
  assert.deepEqual(await readFile(r.path), pdf);
  assert.equal((await download(base + '/file.pdf', options)).reused, true);
  await assert.rejects(download(base + '/other.pdf', options), /different content/);
  await assert.rejects(download(base + '/cut', options), /incomplete/);
  await assert.rejects(download(base + '/loop', options), /loop/);
  await assert.rejects(download(base + '/denied', options), /not a PDF/);
  assert.deepEqual(await readdir(root), ['part.pdf']);
  assert.equal((await outline(r.path, { pdftotext: options.pdftotext })).status, 'unavailable');
});
test('copied standalone skill runs outside repository without node_modules', async () => {
  const root = await mkdtemp(join(tmpdir(), 'datasheets-portable-'));
  const source = new URL('../docs/datasheets/', import.meta.url);
  await cp(source, join(root, 'skill'), { recursive: true });
  for (const script of ['download', 'pdf-outline']) {
    const { stdout } = await exec(process.execPath, [resolve(root, 'skill/scripts', script + '.mjs'), '--help'], { cwd: root, windowsHide: true });
    assert.ok(JSON.parse(stdout).usage);
  }
  await assert.rejects(exec(process.execPath, [resolve(root, 'skill/scripts/download.mjs'), 'file:///secret', '--bogus', 'x'], { cwd: root, windowsHide: true }), e => JSON.parse(e.stdout).status === 'error');
});
