import { mkdir, open, link, unlink, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { args, fail, isMain, output } from './common.mjs';
import { outline } from './pdf-outline.mjs';

function address(value, base) {
  const url = new URL(String(value).startsWith('//') ? `https:${value}` : value, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Expected an HTTP(S) URL without embedded credentials.');
  return url;
}
const decode = s => s.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/\\\//g, '/');
export function wrapperLink(html, base) {
  // Parse explicit links only; never execute a downloaded page's scripts.
  const candidates = [];
  for (const m of html.matchAll(/(?:href|src|data)\s*=\s*["']([^"']+)["']/gi)) if (/\.pdf(?:[?#]|$)/i.test(decode(m[1]))) candidates.push(decode(m[1]));
  for (const m of html.matchAll(/["'](?:pdfUrl|dataSheetUrl|datasheetUrl)["']\s*:\s*["']([^"']+)["']/g)) candidates.push(decode(m[1]));
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (!/http-equiv\s*=\s*["']refresh["']/i.test(m[0])) continue;
    const content = m[0].match(/content\s*=\s*(["'])(.*?)\1/i)?.[2];
    const target = content?.match(/url\s*=\s*(.+)$/i)?.[1]?.replace(/^["']|["']$/g, '');
    if (target) candidates.push(decode(target));
  }
  const urls = [...new Set(candidates.map(s => address(s, base).href))];
  if (urls.length > 1) throw new Error('Multiple PDF links found; select the correct datasheet using the environment browser.');
  return urls[0];
}

export async function download(url, options = {}) {
  const source = address(url).href;
  const target = resolve(options.out || `datasheets/${createHash('sha256').update(source).digest('hex').slice(0, 16)}.pdf`);
  const timeout = Number(options.timeout || 30);
  if (!Number.isFinite(timeout) || timeout < 1 || timeout > 120) throw new Error('--timeout must be 1–120 seconds.');
  const limit = 50 * 1024 * 1024;
  const signal = AbortSignal.timeout(timeout * 1000);
  let current = source;
  const visited = new Set();
  for (let hop = 0; hop < 8; hop++) {
    if (visited.has(current)) throw new Error('Redirect loop.');
    visited.add(current);
    const response = await fetch(current, { redirect: 'manual', signal, headers: { 'User-Agent': 'Mozilla/5.0 DataSheets/1.0', Accept: 'application/pdf,text/html;q=0.8,*/*;q=0.5' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const next = response.headers.get('location');
      if (!next) throw new Error('Redirect without Location.');
      current = address(next, current).href;
      continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}: ${current}`); }
    if (!response.body) throw new Error('Empty response.');
    const chunks = [];
    let size = 0;
    try {
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > limit) throw new Error('Download exceeds 50 MiB.');
        chunks.push(chunk);
      }
    } catch (error) { throw new Error(`Download interrupted: ${error.message}`); }
    const data = Buffer.concat(chunks);
    if (!data.subarray(0, 8).toString('ascii').match(/^%PDF-\d\.\d/)) {
      if (size > 2 * 1024 * 1024) throw new Error('Response is not a PDF; wrapper exceeds 2 MiB.');
      const next = wrapperLink(data.toString('utf8'), current);
      if (!next) throw new Error(`Response is not a PDF and has no unambiguous supported PDF link: ${current}`);
      current = next;
      continue;
    }
    if (!data.subarray(-4096).includes(Buffer.from('%%EOF'))) throw new Error('PDF appears incomplete (missing EOF marker).');
    await mkdir(dirname(target), { recursive: true });
    const sha256 = createHash('sha256').update(data).digest('hex');
    const temporary = `${target}.${randomUUID()}.part`;
    let reused = false;
    try {
      const file = await open(temporary, 'wx');
      try { await file.writeFile(data); } finally { await file.close(); }
      try { await link(temporary, target); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const existing = await readFile(target);
        if (createHash('sha256').update(existing).digest('hex') !== sha256) throw new Error(`Output already exists with different content: ${target}. Choose another --out path.`);
        reused = true;
      }
    } finally { await unlink(temporary).catch(() => {}); }
    return { status: 'downloaded', path: target, sourceUrl: source, finalUrl: current, sha256, bytes: size, reused, validation: 'PDF header and EOF only; identity and rendering must be checked by the reader.', outline: await outline(target, options) };
  }
  throw new Error('Too many redirects or wrapper pages.');
}

if (isMain(import.meta.url)) {
  try {
    const options = args(process.argv.slice(2), ['out', 'timeout', 'pdftotext']);
    if (options.help) output({ usage: 'node download.mjs "URL" [--out datasheets/part.pdf] [--timeout 30] [--pdftotext /path/to/pdftotext]' });
    else {
      if (options._.length !== 1) throw new Error('Provide one datasheet URL.');
      output(await download(options._[0], options));
    }
  } catch (error) { fail(error); }
}
